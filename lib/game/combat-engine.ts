import { ItemType } from "@/types/game";
import type {
  AbilityId,
  AbilityStatShort,
  ActiveStatusEffect,
  Attributes,
  CombatEnemyInstance,
  CombatEvent,
  CombatState,
  Enemy,
  Genre,
  PlayerState,
  RegionBible,
  StatusEffectId,
  WorldBible,
  WorldNode,
} from "@/types/game";
import { ABILITY_LIBRARY, remainingCharges } from "./abilities";
import { isDungeonNode } from "./dungeon-navigation";
import { getGenreBestiary } from "./bestiary";
// Day 21 — rollStubDrops, makeStubItem, and the BASIC_HEALTH_POTION_ID
// import are all removed: loot is now resolved on demand by the
// floor-loot SEARCH REMAINS path through lib/game/loot-resolver.ts.
// The lib/game/loot/stub-drops module remains for combat-resolver's
// use_item heal lookup (which imports its own copy of the constant
// directly).
import {
  applyDefendDamageReduction,
  buildStatusEffect,
  resolveAttack,
  resolveFlee,
  resolveUseItem,
  rollDamageDie,
  rollEnemyHP,
  rollInitiative,
  rollStatusApplication,
  rollStatusSave,
  type Rng,
} from "./combat-resolver";
import { applyStatBoost, checkLevelUp } from "./level-resolver";
import { getArchetype } from "./archetypes";

/**
 * Day 20 Combat — state-transition engine.
 *
 * Pure (almost) functions that take an existing CombatState +
 * PlayerState and return updated copies plus the events emitted.
 * No React, no game store imports — combat-engine is testable in
 * isolation.
 *
 * Layered above combat-resolver.ts (pure math). Consumed by
 * useCombat.ts (the React hook) and useGameLoop step 7 (the
 * encounter trigger).
 */

const DEFAULT_RNG: Rng = Math.random;

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Sentinel used in turn_order and event actor/target fields. */
export const PLAYER_ID = "PLAYER";

/** Enemy count distribution (combat-spec §3.1) — index = count - 1. */
const ENEMY_COUNT_WEIGHTS: number[] = [0.50, 0.30, 0.15, 0.05];

/** Genre → currency key (mirrors useGameLoop's GENRE_CURRENCY_KEY). */
const GENRE_CURRENCY_KEY: Partial<Record<Genre, string>> = {
  ["fantasy" as Genre]:          "gold",
  ["cyberpunk" as Genre]:        "credits",
  ["space_opera" as Genre]:      "stellar_units",
  ["post_apocalyptic" as Genre]: "caps",
};

function currencyKeyFor(genre: Genre | string | undefined): string {
  return GENRE_CURRENCY_KEY[genre as Genre] ?? "gold";
}

// ─────────────────────────────────────────────────────────────────────────────
// Console logger (Prompt 2 only — Prompt 3 replaces with story-feed events)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Print a CombatEvent to the dev console in a single-line readable
 * format. Temporary: Prompt 3 will render these into the story feed.
 */
export function logCombatEvent(event: CombatEvent): void {
  const parts = [
    `[Combat] ${event.type}`,
    `actor=${event.actor}`,
    event.target  != null ? `target=${event.target}`  : null,
    event.outcome != null ? `outcome=${event.outcome}` : null,
    event.damage_dealt        != null ? `damage=${event.damage_dealt}`         : null,
    event.remaining_target_hp != null ? `hp_remaining=${event.remaining_target_hp}` : null,
    event.context_note ? `note=${event.context_note}` : null,
  ].filter(Boolean);
  // eslint-disable-next-line no-console
  console.log(parts.join(" | "));
}

function makeEvent(partial: Partial<CombatEvent> & { type: CombatEvent["type"]; actor: CombatEvent["actor"] }): CombatEvent {
  return {
    timestamp:           Date.now(),
    target:              partial.target              ?? null,
    outcome:             partial.outcome             ?? null,
    damage_dealt:        partial.damage_dealt        ?? null,
    remaining_target_hp: partial.remaining_target_hp ?? null,
    weapon_or_item:      partial.weapon_or_item      ?? null,
    context_note:        partial.context_note        ?? null,
    ...partial,
  };
}

function appendEvents(state: CombatState, events: CombatEvent[]): CombatState {
  if (events.length === 0) return state;
  for (const e of events) logCombatEvent(e);
  return { ...state, combat_log: [...state.combat_log, ...events] };
}

// ─────────────────────────────────────────────────────────────────────────────
// Encounter trigger (combat-spec §3.1, §6.7)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns true when the node carries a non-zero encounter chance
 * with a non-empty roster AND no combat is currently active.
 *
 * Boss rooms still gate through this — encounter_chance for boss
 * rooms is 1.0, so the predicate trivially passes.
 */
export function shouldRollEncounter(
  node:           WorldNode | undefined,
  currentCombat?: CombatState
): boolean {
  if (currentCombat?.active) return false;
  if (!node) return false;
  if (typeof node.encounter_chance !== "number" || node.encounter_chance <= 0) {
    return false;
  }
  if (!Array.isArray(node.encounter_roster) || node.encounter_roster.length === 0) {
    return false;
  }
  return true;
}

// ── HF2 — Dungeon fallback enemy ──────────────────────────────────────────────
// Per the HF2 spec, dungeon encounters must NEVER silently cancel. When every
// roster id fails the 4-layer lookup (legacy save data, cache leakage per
// session-84 Bug 2, etc.) we spawn a generic tier-appropriate creature so the
// dungeon still has bite.
//
// Tier derivation: a dungeon whose zone_id matches world_bible.starting_region
// .id is tier 1; everything else is tier 2 (expanded region).

const FALLBACK_NAME_BY_GENRE: Record<string, string> = {
  fantasy:             "Dungeon Creature",
  cyberpunk:           "Rogue Drone",
  horror_lovecraftian: "Crawling Horror",
  space_opera:         "Void Stalker",
  post_apocalyptic:    "Mutated Husk",
};

/** Derive a dungeon's tier from its zone_id. */
export function dungeonTierForNode(
  node:        WorldNode | undefined,
  world_bible: WorldBible | undefined,
): number {
  const startingId = world_bible?.starting_region?.id;
  if (startingId && node?.zone_id === startingId) return 1;
  return 2;
}

/**
 * HF2 — generic dungeon-tier fallback enemy. Returns an Enemy that mirrors
 * the shape rollEncounter expects so the existing spawn pipeline can build a
 * CombatEnemyInstance with no special-casing.
 *
 * Stats per HF2 spec:
 *   hp:     15 + tier * 8         (tier 1 → 23, tier 2 → 31)
 *   attack: 4  + tier              folded into agi_mod (1 for tier 1, 2 for 2+)
 *                                  + damage die scaled by tier
 *   armor:  0
 *   behavior_flavor: "aggressive"
 *   loot:   "fantasy_loot_basic"  (resolves to a tier-1 drop: 2–5 gold, no item)
 *   xp_value: 25                   (tier-1 baseline; consumers don't currently
 *                                   read tier 2 differently)
 */
export function buildDungeonFallbackEnemy(
  tier:  number,
  genre: Genre | string | undefined,
): Enemy {
  const t        = Math.max(1, Math.floor(tier));
  const hp       = 15 + (t * 8);
  const dieByTier = t >= 3 ? "1d10" : t === 2 ? "1d8" : "1d6";
  const genreKey = typeof genre === "string" ? genre : String(genre ?? "fantasy");
  const name     = FALLBACK_NAME_BY_GENRE[genreKey] ?? "Dungeon Creature";
  return {
    id:              `dungeon_fallback_tier_${t}`,
    name,
    description:     "A shape barely separated from the dungeon dark.",
    hp_range:        [hp, hp],
    agi_mod:         t,
    str_mod:         t - 1,
    damage_die:      dieByTier,
    armor_bonus:     0,
    xp_value:        25,
    loot_table_id:   "fantasy_loot_basic",
    is_boss:         false,
    behavior_flavor: "aggressive",
  };
}

/**
 * Resolve an enemy id against the layered enemy registries.
 *
 * Search order (combat-spec §6.1):
 *   1. Genre bestiary (always available, hand-authored)
 *   2. Current region's enemies (via metadata.region_bibles or
 *      world_bible.starting_region.enemies)
 *   3. Any other RegionBible.enemies (player roamed regions)
 *   4. WorldBible.adjacent_regions[i].enemies (outline level)
 *
 * Genre bestiary first means common enemies always resolve regardless
 * of which region the player is in.
 */
export function resolveEnemyLookup(
  enemyId:       string,
  node:          WorldNode | undefined,
  world_bible:   WorldBible | undefined,
  region_bibles: Record<string, RegionBible> | undefined,
  genre:         Genre | string | undefined
): Enemy | null {
  // 1. Genre bestiary
  for (const e of getGenreBestiary(genre)) {
    if (e.id === enemyId) return e;
  }
  // 2/3. Region bibles (current region first if resolvable, then any other)
  if (region_bibles) {
    const currentRegionId = node?.zone_id;
    if (currentRegionId && region_bibles[currentRegionId]) {
      const found = region_bibles[currentRegionId].enemies?.find((e) => e.id === enemyId);
      if (found) return found;
    }
    // HF2 — id-prefix shortcut. RegionBible enemy ids are minted with the
    // region's id as a prefix (e.g. "the_seam_foothills_rockfall_sentinel"
    // belongs to bible "the_seam_foothills"). When node.zone_id has been
    // corrupted (Bug 2 in session 84 — cache leakage stamps a node's
    // zone_id with the wrong region), the standard layer-2 lookup misses
    // even though the bible IS present. Try every bible whose id is a
    // prefix of the enemy id BEFORE the slower full sweep.
    for (const [rid, rb] of Object.entries(region_bibles)) {
      if (rid === currentRegionId) continue;
      if (!enemyId.startsWith(`${rid}_`)) continue;
      const found = rb.enemies?.find((e) => e.id === enemyId);
      if (found) return found;
    }
    for (const [rid, rb] of Object.entries(region_bibles)) {
      if (rid === currentRegionId) continue;
      const found = rb.enemies?.find((e) => e.id === enemyId);
      if (found) return found;
    }
  }
  // 2 (alt). Starting region enemies live on world_bible directly.
  if (world_bible?.starting_region?.enemies) {
    const found = world_bible.starting_region.enemies.find((e) => e.id === enemyId);
    if (found) return found;
  }
  // 4. Adjacent region outlines (less detail; covers the case where the
  // player triggers combat at a node inside an outline-only region —
  // currently impossible since outline regions aren't navigable, but
  // defensive against future changes).
  if (world_bible?.adjacent_regions) {
    for (const r of world_bible.adjacent_regions) {
      const found = r.enemies?.find((e) => e.id === enemyId);
      if (found) return found;
    }
  }
  return null;
}

/** Pick an integer count from the §3.1 weighted distribution. */
function pickEncounterCount(rosterLength: number, rng: Rng): number {
  if (rosterLength === 0) return 0;
  const r = rng();
  let acc = 0;
  for (let i = 0; i < ENEMY_COUNT_WEIGHTS.length; i += 1) {
    acc += ENEMY_COUNT_WEIGHTS[i];
    if (r < acc) return i + 1;
  }
  return ENEMY_COUNT_WEIGHTS.length;
}

export interface RollEncounterResult {
  combatStarted: boolean;
  combat?:       CombatState;
  enemyNames?:   string[];
}

/**
 * Roll the encounter chance and, on success, build a CombatState
 * containing the spawned enemies and rolled initiative. The caller
 * is responsible for splicing the returned CombatState into
 * MasterState.
 */
export function rollEncounter({
  node, world_bible, region_bibles, genre, current_xp, rng = DEFAULT_RNG,
  forceEnemyIds,
}: {
  node:          WorldNode;
  world_bible:   WorldBible | undefined;
  region_bibles: Record<string, RegionBible> | undefined;
  genre:         Genre | string | undefined;
  current_xp:    number;
  rng?:          Rng;
  /** Test override: when set, bypass encounter_chance + roster sampling
   *  and spawn exactly these ids. Used by window.__forceEncounter. */
  forceEnemyIds?: string[];
}): RollEncounterResult {
  const isForced = Array.isArray(forceEnemyIds) && forceEnemyIds.length > 0;

  // Encounter chance roll (skipped when forced).
  if (!isForced) {
    const chance = node.encounter_chance ?? 0;
    if (rng() > chance) {
      return { combatStarted: false };
    }
  }

  const roster = isForced
    ? forceEnemyIds!
    : Array.isArray(node.encounter_roster) ? node.encounter_roster : [];
  if (roster.length === 0) return { combatStarted: false };

  // Spawn count: boss rooms spawn the full roster; regular rooms pick a
  // weighted random count from the roster (with replacement so the
  // same enemy id can spawn twice).
  let spawnIds: string[];
  if (isForced) {
    spawnIds = roster.slice();
  } else if (node.is_boss_room) {
    spawnIds = roster.slice();
  } else {
    const count = pickEncounterCount(roster.length, rng);
    spawnIds = [];
    for (let i = 0; i < count; i += 1) {
      const idx = Math.floor(rng() * roster.length);
      spawnIds.push(roster[Math.min(idx, roster.length - 1)]);
    }
  }

  const enemies: CombatEnemyInstance[] = [];
  const unresolvedIds: string[] = [];
  spawnIds.forEach((enemyId, idx) => {
    const enemy = resolveEnemyLookup(enemyId, node, world_bible, region_bibles, genre);
    if (!enemy) {
      unresolvedIds.push(enemyId);
      console.warn(`[combat-engine] Cannot resolve enemy id "${enemyId}" — skipping spawn.`);
      return;
    }
    const max_hp = rollEnemyHP(enemy, rng);
    enemies.push({
      instance_id:     `${enemy.id}_${idx + 1}`,
      enemy_id:        enemy.id,
      name:            enemy.name,
      description:     enemy.description,
      current_hp:      max_hp,
      max_hp,
      agi_mod:         enemy.agi_mod,
      str_mod:         enemy.str_mod,
      damage_die:      enemy.damage_die,
      armor_bonus:     enemy.armor_bonus,
      xp_value:        enemy.xp_value,
      loot_table_id:   enemy.loot_table_id,
      is_boss:         enemy.is_boss,
      behavior_flavor: enemy.behavior_flavor,
      alive:           true,
      // Prompt 1 — mirror bestiary status fields onto the instance.
      // can_weaken: when true and the bestiary didn't declare an
      // explicit status_effect, apply WEAKENED at 20% on hit.
      status_effect:       enemy.status_effect
                             ?? (enemy.can_weaken
                                 ? { id: "weakened" as StatusEffectId, chance: 0.20 }
                                 : undefined),
      primary_damage_type: enemy.primary_damage_type,
      status_effects:      [],
    });
  });

  if (enemies.length === 0) {
    // HF2 — rich diagnostic so the next time we see this in a save dump,
    // the exact missing layer is obvious. Surfaces zone_id, the region
    // bible keys present, and whether the starting-region enemies array
    // is populated.
    const bibleKeys     = region_bibles ? Object.keys(region_bibles) : [];
    const startingCount = world_bible?.starting_region?.enemies?.length ?? 0;
    console.warn(
      `[combat-engine] All enemy ids unresolvable at node ${node.id}`,
      {
        nodeZoneId:           node.zone_id,
        nodeType:             node.node_type,
        unresolvedIds,
        regionBibleKeys:      bibleKeys,
        startingRegionId:     world_bible?.starting_region?.id,
        startingEnemiesCount: startingCount,
      }
    );

    // HF2 CHANGE 2 — dungeons must always have a chance to spawn. When a
    // dungeon node would otherwise silently cancel, mint a generic tier-
    // appropriate fallback so the player still meets resistance. Non-
    // dungeon encounters preserve the existing silent-cancel behaviour
    // (wilderness / landmark / abandoned-settlement nodes have already
    // passed an encounter_chance roll; cancelling on resolution failure
    // there is intentional).
    if (isDungeonNode(node)) {
      const tier        = dungeonTierForNode(node, world_bible);
      const fallback    = buildDungeonFallbackEnemy(tier, genre);
      const fbHp        = rollEnemyHP(fallback, rng);
      enemies.push({
        instance_id:     `${fallback.id}_1`,
        enemy_id:        fallback.id,
        name:            fallback.name,
        description:     fallback.description,
        current_hp:      fbHp,
        max_hp:          fbHp,
        agi_mod:         fallback.agi_mod,
        str_mod:         fallback.str_mod,
        damage_die:      fallback.damage_die,
        armor_bonus:     fallback.armor_bonus,
        xp_value:        fallback.xp_value,
        loot_table_id:   fallback.loot_table_id,
        is_boss:         fallback.is_boss,
        behavior_flavor: fallback.behavior_flavor,
        alive:           true,
        status_effects:  [],
      });
      console.warn(
        `[combat-engine] Dungeon fallback spawned at ${node.id}: ${fallback.name} (tier ${tier}).`
      );
    } else {
      return { combatStarted: false };
    }
  }

  // Initiative: player + each enemy instance. Player AGI passed via the
  // caller — we don't have player state here, so we use 0 and let the
  // hook layer override. Actually, simpler — accept player AGI mod.
  // To keep this signature stable, we ROLL initiative below using
  // each combatant's agi_mod field. Player's agi_mod must be supplied
  // via a caller-side wrapper in useCombat that has access to player state.
  // To do so cleanly without breaking signature, we attach a placeholder
  // and let executePlayerAction recompute. For Prompt 2 we accept a
  // simple convention: the encounter starts with player initiative = 0
  // and useCombat re-rolls if needed. To avoid that complexity, we
  // expose a small overload via rollEncounterWithPlayer below.

  const initiative = rollInitiative(
    [
      { id: PLAYER_ID, agi_mod: 0 }, // placeholder — see rollEncounterWithPlayer
      ...enemies.map((e) => ({ id: e.instance_id, agi_mod: e.agi_mod })),
    ],
    rng
  );

  const combat: CombatState = {
    active:             true,
    encounter_id:       `enc_${Date.now()}_${Math.floor(rng() * 1e6)}`,
    enemies,
    turn_order:         initiative,
    current_turn_index: 0,
    round_number:       1,
    player_defending:   false,
    combat_log:         [],
    origin_node_id:     node.id,
    pre_combat_xp:      current_xp,
    // Prompt 1 — status effects start clean.
    player_status_effects: [],
  };

  const startEvent = makeEvent({
    type:         "combat_start",
    actor:        PLAYER_ID,
    target:       null,
    context_note: enemies.map((e) => e.name).join(", "),
  });
  const withStart = appendEvents(combat, [startEvent]);

  return {
    combatStarted: true,
    combat:        withStart,
    enemyNames:    enemies.map((e) => e.name),
  };
}

/**
 * Wrapper that takes the player's agi_mod and re-rolls initiative
 * with the proper player roll. Use this from useCombat where the
 * player state is available; rollEncounter alone is fine for tests.
 */
export function rollEncounterWithPlayer(
  args: Parameters<typeof rollEncounter>[0] & { player_agi_mod: number }
): RollEncounterResult {
  const result = rollEncounter(args);
  if (!result.combatStarted || !result.combat) return result;
  // Re-roll initiative with the actual player agi_mod.
  const rng = args.rng ?? DEFAULT_RNG;
  const initiative = rollInitiative(
    [
      { id: PLAYER_ID, agi_mod: args.player_agi_mod },
      ...result.combat.enemies.map((e) => ({ id: e.instance_id, agi_mod: e.agi_mod })),
    ],
    rng
  );
  return {
    ...result,
    combat: { ...result.combat, turn_order: initiative },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Turn loop helpers
// ─────────────────────────────────────────────────────────────────────────────

/** All living enemies are dead. */
export function checkVictory(state: CombatState): boolean {
  return state.enemies.length > 0 && state.enemies.every((e) => !e.alive);
}

/** Player HP <= 0. */
export function checkDefeat(player: PlayerState): boolean {
  return player.health <= 0;
}

function findEnemyByInstanceId(state: CombatState, instanceId: string): CombatEnemyInstance | undefined {
  return state.enemies.find((e) => e.instance_id === instanceId);
}

/**
 * Advance turn_order to the next combatant. Wraps round counter when
 * the index passes the end. Skips dead enemies — defeated enemies
 * stay in turn_order but their turns are no-ops.
 */
function advanceTurn(state: CombatState): { state: CombatState; events: CombatEvent[] } {
  const events: CombatEvent[] = [];
  let nextIndex = state.current_turn_index + 1;
  let round     = state.round_number;
  if (nextIndex >= state.turn_order.length) {
    nextIndex = 0;
    round    += 1;
    events.push(makeEvent({
      type:         "round_start",
      actor:        PLAYER_ID,
      target:       null,
      context_note: `round ${round}`,
    }));
  }
  return {
    state:  { ...state, current_turn_index: nextIndex, round_number: round },
    events,
  };
}

/** Mutate enemies array to set hp/alive after damage. */
function applyEnemyDamage(state: CombatState, instanceId: string, damage: number): CombatState {
  return {
    ...state,
    enemies: state.enemies.map((e) => {
      if (e.instance_id !== instanceId) return e;
      const newHp = Math.max(0, e.current_hp - damage);
      return { ...e, current_hp: newHp, alive: newHp > 0 };
    }),
  };
}

/** Subtract one of the given item id from player.inventory; remove the row if it hits 0. */
function consumeItem(player: PlayerState, itemId: string): PlayerState {
  const item = player.inventory.find((i) => i.id === itemId);
  if (!item) return player;
  const nextQty = item.quantity - 1;
  const inventory = nextQty > 0
    ? player.inventory.map((i) => (i.id === itemId ? { ...i, quantity: nextQty } : i))
    : player.inventory.filter((i) => i.id !== itemId);
  return { ...player, inventory };
}

// ─────────────────────────────────────────────────────────────────────────────
// Player action
// ─────────────────────────────────────────────────────────────────────────────

export type PlayerActionInput =
  | { action: "attack"; target_instance_id: string }
  | { action: "defend" }
  | { action: "use_item"; item_id: string }
  | { action: "flee" }
  // P7 — ability dispatch. target_instance_id is required for damage /
  // debuff abilities; heal / buff / utility abilities omit it.
  | { action: "ability"; ability_id: AbilityId; target_instance_id?: string };

// ── P7 — ability resolution helpers ────────────────────────────────────────

/** Stat short-form → full Attributes key. Mirrors the map in abilities.ts;
 *  duplicated here so combat-engine has no cross-import gymnastics. */
const ABILITY_STAT_KEY: Record<AbilityStatShort, keyof Attributes> = {
  str: "strength",
  agi: "agility",
  int: "intelligence",
  per: "perception",
  cha: "charisma",
};

/** Compact context_note for an "ability_used" event — summarises what
 *  the ability did so the story-feed templates have a one-liner without
 *  having to re-derive from the template. */
function summariseAbilityResolution(args: {
  abilityName:    string;
  totalDamage:    number;
  healedAmount:   number;
  selfStatuses:   StatusEffectId[];
  targetStatusId: StatusEffectId | null;
  clearedSelf:    string[];
}): string {
  const parts: string[] = [args.abilityName];
  if (args.totalDamage > 0)  parts.push(`${args.totalDamage} damage`);
  if (args.healedAmount > 0) parts.push(`healed ${args.healedAmount} HP`);
  if (args.selfStatuses.length > 0) parts.push(`self: ${args.selfStatuses.join(", ")}`);
  if (args.targetStatusId) parts.push(`target: ${args.targetStatusId}`);
  if (args.clearedSelf.length > 0) parts.push(`cleared ${args.clearedSelf.join(", ")}`);
  return parts.join(" — ");
}

export interface PlayerActionResult {
  newState:  CombatState | undefined;   // undefined when combat dismissed
  newPlayer: PlayerState;
  events:    CombatEvent[];
  /** Set when the action resolved combat. The hook layer reads this
   *  to apply teleport / loot side-effects. */
  resolution?: CombatResolutionPayload;
}

export type CombatResolutionPayload =
  | {
      kind:           "victory";
      /** Day 21 — pending loot refs that the FloorLootStrip's SEARCH
       *  REMAINS button will resolve into items + gold. Gold no longer
       *  auto-adds to player resources on victory; items no longer
       *  auto-add to inventory. The loot drops onto the floor and the
       *  player claims it. */
      pending_loot:   {
        node_id:            string;
        enemy_instance_ids: string[];
        enemy_loot_refs:    Array<{ loot_table_id: string; is_boss: boolean; xp_value?: number }>;
      };
      xp_awarded:     number;
    }
  | {
      kind:                "defeat";
      teleport_to_node_id: string;
    }
  | {
      kind:                "flee_success";
      teleport_to_node_id: string;
    };

/**
 * Resolve the player's action. After the player resolves, this
 * automatically advances enemy turns until the next player turn or
 * until combat ends. Returns the final state + everything needed
 * for the hook layer to apply side-effects.
 */
export function executePlayerAction({
  action, state, player, world_genre, last_settlement_hub_id,
  navigation_trail, defeat_fallback_node_id, world_graph_nodes,
  rng = DEFAULT_RNG,
}: {
  action:                   PlayerActionInput;
  state:                    CombatState;
  player:                   PlayerState;
  world_genre:              Genre | string | undefined;
  last_settlement_hub_id?:  string;
  navigation_trail?:        string[];
  /** Day 20.4 TASK 4 — secondary defeat teleport target. */
  defeat_fallback_node_id?: string;
  /** Day 20.4 TASK 4 — used by handleDefeat / handleFleeSuccess to
   *  populate destination metadata (display name + parent region). */
  world_graph_nodes?:       Record<string, WorldNode>;
  rng?:                     Rng;
}): PlayerActionResult {
  if (state.turn_order[state.current_turn_index] !== PLAYER_ID) {
    // Out-of-turn submissions get dropped without state change. The
    // UI in Prompt 3 should already gate on isPlayerTurn.
    console.warn("[combat-engine] executePlayerAction called out of turn — ignoring.");
    return { newState: state, newPlayer: player, events: [] };
  }

  const events: CombatEvent[] = [];
  let s = state;
  let p = player;

  // Prompt 1 — Status tick. DoT effects (poisoned, burning) damage at
  // the START of the player turn. If the tick KOs the player, we
  // resolve as defeat immediately — no action this turn.
  const activeEffects = s.player_status_effects ?? [];
  if (activeEffects.length > 0) {
    const { newHp, tickEvents } = applyPlayerStatusTicks(p, activeEffects);
    p = { ...p, health: newHp };
    s = appendEvents(s, tickEvents);
    events.push(...tickEvents);
    if (checkDefeat(p)) {
      const defeat = handleDefeat({
        state: s, player: p, last_settlement_hub_id, world_genre,
        defeat_fallback_node_id, world_graph_nodes,
      });
      return {
        newState:  undefined,
        newPlayer: defeat.newPlayer,
        events:    [...events, ...defeat.events],
        resolution: {
          kind: "defeat",
          teleport_to_node_id: defeat.newCurrentNodeId,
        },
      };
    }
  }

  switch (action.action) {
    case "attack": {
      const target = findEnemyByInstanceId(s, action.target_instance_id);
      if (!target || !target.alive) {
        console.warn(`[combat-engine] Attack target ${action.target_instance_id} invalid — turn forfeit.`);
        // Fall through to advance turn even on bad input so UI doesn't deadlock.
        break;
      }
      const result = resolveAttack({
        attacker: {
          name:       player.name,
          // Prompt 1 — fold status modifiers (chilled, weakened,
          // frightened, hastened) into the player's effective attack
          // mods.
          ...playerEffectiveAttackMods(p, s.player_status_effects ?? []),
          damage_die: weaponDamageDie(player),
        },
        target: {
          name:        target.name,
          agi_mod:     target.agi_mod,
          armor_bonus: target.armor_bonus,
          current_hp:  target.current_hp,
        },
        rng,
      });
      s = applyEnemyDamage(s, target.instance_id, result.damage);
      const remaining = findEnemyByInstanceId(s, target.instance_id)?.current_hp ?? 0;
      events.push(makeEvent({
        type:                "player_attack",
        actor:               PLAYER_ID,
        target:              target.instance_id,
        outcome:             result.outcome,
        damage_dealt:        result.damage,
        remaining_target_hp: remaining,
        weapon_or_item:      weaponName(player),
        context_note:        target.behavior_flavor,
        rolls:               result.rolls,
        damage_type:         "physical",
      }));
      if (result.killed_target) {
        events.push(makeEvent({
          type:                "kill",
          actor:               PLAYER_ID,
          target:              target.instance_id,
          outcome:             "kill",
          damage_dealt:        result.damage,
          remaining_target_hp: 0,
          weapon_or_item:      weaponName(player),
          context_note:        target.name,
          rolls:               result.rolls,
        }));
      }
      break;
    }
    case "defend": {
      s = { ...s, player_defending: true };
      events.push(makeEvent({
        type:         "defend",
        actor:        PLAYER_ID,
        target:       null,
        outcome:      "defended",
        context_note: "halved damage until next player turn",
      }));
      break;
    }
    case "use_item": {
      const owned = player.inventory.find((i) => i.id === action.item_id);
      if (!owned) {
        console.warn(`[combat-engine] use_item: ${action.item_id} not in inventory — turn forfeit.`);
        break;
      }

      // Day 22 — STAT_XP fast-apply for mid-combat use. The inventory
      // picker isn't shown during combat (would slow the action loop),
      // so the boost auto-targets the player's archetype primary stat.
      // Falls back to STR if the background isn't a registered archetype.
      // The item is consumed exactly like any other consumable; a
      // use_item event renders the templated story-feed beat.
      if (owned.type === ItemType.STAT_XP) {
        const arch = getArchetype(player.background);
        const targetStat = arch?.primary ?? "strength";
        const beforeValue = player.attributes[targetStat];
        const afterAttrs  = applyStatBoost(player, targetStat);
        const capped      = afterAttrs[targetStat] === beforeValue;
        p = consumeItem({ ...p, attributes: afterAttrs }, action.item_id);
        events.push(makeEvent({
          type:                "use_item",
          actor:               PLAYER_ID,
          target:              PLAYER_ID,
          outcome:             "item_used",
          damage_dealt:        0,
          remaining_target_hp: player.health,
          weapon_or_item:      owned.name,
          context_note:        capped
                                ? `${targetStat} already at cap`
                                : `+1 ${targetStat} (mid-combat fast-apply → primary)`,
        }));
        break;
      }

      const result = resolveUseItem({
        item_id:     action.item_id,
        // V8.49 — pass the item's effect through so resolveUseItem can
        // read effect.heal directly. Without this, looted potions
        // (which carry crypto.randomUUID() ids from loot-resolver,
        // never the static BASIC_HEALTH_POTION_ID) silently no-oped
        // mid-combat with no HP restored and the potion still in
        // inventory.
        item_effect: owned.effect,
        player:      { current_hp: player.health, max_hp: player.max_health },
        rng,
      });
      if (result.item_consumed) {
        p = consumeItem({ ...p, health: result.new_hp }, action.item_id);
      }
      events.push(makeEvent({
        type:                "use_item",
        actor:               PLAYER_ID,
        target:              PLAYER_ID,
        outcome:             "item_used",
        damage_dealt:        -result.healed_amount, // negative damage = heal
        remaining_target_hp: result.new_hp,
        weapon_or_item:      owned.name,
        context_note:        result.item_consumed
                              ? `healed ${result.healed_amount} hp`
                              : "no effect",
        rolls:               result.rolls,
      }));
      break;
    }
    case "flee": {
      const flee = resolveFlee({
        player: { agi_mod: abilityMod(player.attributes.agility) },
        enemies: s.enemies,
        rng,
      });
      events.push(makeEvent({
        type:         "flee_attempt",
        actor:        PLAYER_ID,
        target:       null,
        outcome:      flee.success ? "fled" : "fled_failed",
        context_note: `roll ${flee.flee_roll} vs DC ${flee.flee_dc.toFixed(1)}`,
        rolls:        flee.rolls,
      }));
      if (flee.success) {
        // Resolve flee — state dismissed.
        const fleePayload = handleFleeSuccess({
          state:             appendEvents(s, events),
          navigation_trail,
          world_graph_nodes,
        });
        return {
          newState:   undefined,
          newPlayer:  p,
          events:     [...events, ...fleePayload.events],
          resolution: { kind: "flee_success", teleport_to_node_id: fleePayload.newCurrentNodeId },
        };
      }
      // Failed flee: turn forfeit, fall through to advance turn into enemy phase.
      break;
    }
    // ── P7 — Ability dispatch ───────────────────────────────────────────────
    case "ability": {
      const ability = ABILITY_LIBRARY[action.ability_id];
      if (!ability) {
        console.warn(`[combat-engine] ability ${action.ability_id} not in library — turn forfeit.`);
        break;
      }
      // Must be in the player's equipped slot loadout. Passives + pool-
      // only abilities cannot be dispatched directly.
      const equipped = (player.equipped_ability_slots ?? []).some(
        (sid) => sid === action.ability_id
      );
      if (!equipped) {
        console.warn(`[combat-engine] ability ${action.ability_id} not equipped — turn forfeit.`);
        break;
      }

      // Charge gate — no charges = no turn advance. Emit the "no_charges"
      // event and return early so the player can pick a different action.
      const usedSoFar = s.ability_charges_used?.[action.ability_id] ?? 0;
      const remaining = remainingCharges(
        ability, p.level, p.attributes, usedSoFar,
        // P8 — total charge bonus from perks (Momentum, Arcane Reserve, …).
        p.perk_charge_bonus ?? 0,
      );
      if (remaining <= 0) {
        const noCharges = makeEvent({
          type:           "ability_no_charges",
          actor:          PLAYER_ID,
          target:         action.target_instance_id ?? null,
          outcome:        null,
          weapon_or_item: action.ability_id,
          context_note:   `no charges remaining for ${ability.base_name}`,
        });
        events.push(noCharges);
        s = appendEvents(s, [noCharges]);
        return { newState: s, newPlayer: p, events };
      }

      // Deduct one charge for this dispatch.
      s = {
        ...s,
        ability_charges_used: {
          ...(s.ability_charges_used ?? {}),
          [action.ability_id]: usedSoFar + 1,
        },
      };

      // Resolve the effects payload (P7 — see types/game.ts AbilityEffects).
      const eff = ability.effects;
      let totalDamage    = 0;
      let healedAmount   = 0;
      const appliedSelf:   StatusEffectId[] = [];
      let appliedTarget:  StatusEffectId | null = null;
      const cleared:       string[] = [];

      if (eff) {
        // ── Self heal (capped at max_health) ──────────────────────────
        if (typeof eff.heal_amount === "number" && eff.heal_amount > 0) {
          const newHp = Math.min(p.max_health, p.health + eff.heal_amount);
          healedAmount = newHp - p.health;
          p = { ...p, health: newHp };
        }

        // ── Damage (single or multi-hit) ───────────────────────────────
        if (eff.damage_die && action.target_instance_id) {
          const hits     = Math.max(1, eff.hits ?? 1);
          const statKey  = ABILITY_STAT_KEY[eff.damage_stat ?? "str"];
          const statMod  = abilityMod(p.attributes[statKey] ?? 2);
          for (let i = 0; i < hits; i += 1) {
            const fresh = findEnemyByInstanceId(s, action.target_instance_id);
            if (!fresh || !fresh.alive) break;
            const dieRoll = rollDamageDie(eff.damage_die, rng);
            const dmg     = Math.max(1, dieRoll + statMod);
            s = applyEnemyDamage(s, action.target_instance_id, dmg);
            totalDamage += dmg;
          }
        }

        // ── Self statuses (FORTIFIED / HASTENED / FOCUSED) ─────────────
        if (eff.self_statuses && eff.self_statuses.length > 0) {
          let nextEffects = s.player_status_effects ?? [];
          for (const sid of eff.self_statuses) {
            const built = buildStatusEffect(sid, ability.base_name);
            // Replace any existing instance of the same id (don't stack
            // duplicates); buffs are not affected by the one-curse rule.
            nextEffects = [
              ...nextEffects.filter((x) => x.id !== sid),
              built,
            ];
            appliedSelf.push(sid);
          }
          s = { ...s, player_status_effects: nextEffects };
        }

        // ── Target status (debuff on the enemy instance) ───────────────
        if (eff.target_status && action.target_instance_id) {
          const { id: tsId, chance } = eff.target_status;
          const application = rollStatusApplication(tsId, chance, rng);
          if (application.applied) {
            const tgt = findEnemyByInstanceId(s, action.target_instance_id);
            if (tgt && tgt.alive) {
              const newEffect = buildStatusEffect(
                tsId, p.name, application.damage_per_tick
              );
              // One-curse limit on enemies too (no enemy-side tick loop
              // ticks today — data is set for forward compat).
              const existing = tgt.status_effects ?? [];
              const isAilment = AILMENT_IDS.includes(tsId);
              const filtered  = isAilment
                ? existing.filter((x) => !AILMENT_IDS.includes(x.id))
                : existing;
              s = {
                ...s,
                enemies: s.enemies.map((e) =>
                  e.instance_id === tgt.instance_id
                    ? { ...e, status_effects: [...filtered, newEffect] }
                    : e
                ),
              };
              appliedTarget = tsId;
            }
          }
        }

        // ── Self status clears (Fade, Antidote Mastery, etc.) ──────────
        if (eff.clears_self_ids && eff.clears_self_ids.length > 0) {
          let nextEffects = s.player_status_effects ?? [];
          for (const cid of eff.clears_self_ids) {
            if (cid === "any_ailment") {
              nextEffects = nextEffects.filter(
                (e) => !AILMENT_IDS.includes(e.id)
              );
              cleared.push("any_ailment");
            } else {
              nextEffects = nextEffects.filter((e) => e.id !== cid);
              cleared.push(cid);
            }
          }
          s = { ...s, player_status_effects: nextEffects };
        }
      }

      // Did damage kill the target? Emit a kill event so the loot /
      // victory pipeline picks it up the same way attack kills do.
      let killed = false;
      if (totalDamage > 0 && action.target_instance_id) {
        const t = findEnemyByInstanceId(s, action.target_instance_id);
        if (t && !t.alive) killed = true;
      }

      const damageDealtForEvent =
        totalDamage > 0
          ? totalDamage
          : healedAmount > 0
            ? -healedAmount
            : null;

      events.push(makeEvent({
        type:                "ability_used",
        actor:               PLAYER_ID,
        target:              action.target_instance_id ?? null,
        outcome:             killed ? "kill" : null,
        damage_dealt:        damageDealtForEvent,
        remaining_target_hp: action.target_instance_id
          ? (findEnemyByInstanceId(s, action.target_instance_id)?.current_hp ?? null)
          : null,
        weapon_or_item:      action.ability_id,
        context_note:        summariseAbilityResolution({
          abilityName:    ability.base_name,
          totalDamage,
          healedAmount,
          selfStatuses:   appliedSelf,
          targetStatusId: appliedTarget,
          clearedSelf:    cleared,
        }),
        damage_type:         "physical",
      }));

      if (killed && action.target_instance_id) {
        events.push(makeEvent({
          type:                "kill",
          actor:               PLAYER_ID,
          target:              action.target_instance_id,
          outcome:             "kill",
          damage_dealt:        totalDamage,
          remaining_target_hp: 0,
          weapon_or_item:      action.ability_id,
        }));
      }
      break;
    }
  }

  s = appendEvents(s, events);

  // Prompt 1 — Status saves. END of player turn: every active ailment
  // rolls d20 + stat-mod vs save_dc. Buffs decrement duration without
  // rolling. Saves/expiries emit dedicated events.
  const effectsNow = s.player_status_effects ?? [];
  if (effectsNow.length > 0) {
    const { newEffects, saveEvents } =
      rollPlayerStatusSaves(p, effectsNow, rng);
    s = { ...s, player_status_effects: newEffects };
    s = appendEvents(s, saveEvents);
    events.push(...saveEvents);
  }

  // Did the player just clear the field?
  if (checkVictory(s)) {
    const victory = handleVictory({ state: s, player: p, world_genre, rng });
    return {
      newState:   undefined,
      newPlayer:  victory.newPlayer,
      events:     [...events, ...victory.events],
      resolution: {
        kind:         "victory",
        pending_loot: victory.pending_loot,
        xp_awarded:   victory.xp_awarded,
      },
    };
  }

  // Advance turn pointer, then auto-resolve enemy turns until player's turn or end.
  const advanced = advanceTurn(s);
  s = appendEvents(advanced.state, advanced.events);
  events.push(...advanced.events);

  // Day 20.1 TASK 3 — emit enemy_phase_start when control transitions
  // to an enemy phase. Used by useCombat for the 800ms pacing pause +
  // by templates.ts for the "─── Enemies' turn ───" separator.
  // Skipped when combat already ended (victory/defeat — defensive;
  // shouldn't reach here in those cases).
  const isEnemyNext = s.turn_order[s.current_turn_index] !== PLAYER_ID;
  const enemyPhaseHappened = isEnemyNext && !checkVictory(s) && !checkDefeat(p);
  if (enemyPhaseHappened) {
    const phaseEvent = makeEvent({
      type:   "enemy_phase_start",
      actor:  PLAYER_ID,
      target: null,
    });
    s = appendEvents(s, [phaseEvent]);
    events.push(phaseEvent);
  }

  // Day 20.2 TASK 1 — enemy-turn loop extracted to
  // advanceUntilPlayerTurnOrEnd so kickoffCombatIfEnemyFirst can
  // reuse the same loop semantics. The defend-buff clear that used
  // to live below moved into the helper.
  const advanceResult = advanceUntilPlayerTurnOrEnd({
    state:                   s,
    player:                  p,
    last_settlement_hub_id,
    world_genre,
    defeat_fallback_node_id,
    world_graph_nodes,
    rng,
  });
  events.push(...advanceResult.events);
  if (advanceResult.resolution) {
    return {
      newState:   undefined,
      newPlayer:  advanceResult.newPlayer,
      events,
      resolution: advanceResult.resolution,
    };
  }
  s = advanceResult.newState!;
  p = advanceResult.newPlayer;

  // Day 20.1 TASK 3 — emit player_turn_start when control returns to
  // the player AFTER an enemy phase actually fired. If isEnemyNext was
  // false (player got initiative twice in a row, or the loop didn't
  // execute), there was no enemy phase to separate from — skip the
  // separator. Also skipped on victory/defeat (combat won't continue).
  if (
    enemyPhaseHappened &&
    s.turn_order[s.current_turn_index] === PLAYER_ID &&
    !checkVictory(s) &&
    !checkDefeat(p)
  ) {
    const phaseEvent = makeEvent({
      type:   "player_turn_start",
      actor:  PLAYER_ID,
      target: null,
    });
    s = appendEvents(s, [phaseEvent]);
    events.push(phaseEvent);
  }

  return { newState: s, newPlayer: p, events };
}

/**
 * Resolve a single enemy turn. Per spec §6.3 every enemy attacks
 * the player. behavior_flavor is narrator-only.
 */
export function advanceEnemyTurn({
  state, player, last_settlement_hub_id, world_genre,
  defeat_fallback_node_id, world_graph_nodes, rng = DEFAULT_RNG,
}: {
  state:                    CombatState;
  player:                   PlayerState;
  last_settlement_hub_id?:  string;
  world_genre:              Genre | string | undefined;
  /** Day 20.4 TASK 4 — defeat teleport fallbacks. */
  defeat_fallback_node_id?: string;
  world_graph_nodes?:       Record<string, WorldNode>;
  rng?:                     Rng;
}): PlayerActionResult {
  const events: CombatEvent[] = [];
  const currentId = state.turn_order[state.current_turn_index];

  // Skip dead-enemy slots cleanly — emit no event and just advance.
  const actor = state.enemies.find((e) => e.instance_id === currentId);
  if (!actor || !actor.alive) {
    const advanced = advanceTurn(state);
    const s = appendEvents(advanced.state, advanced.events);
    return { newState: s, newPlayer: player, events: advanced.events };
  }

  // Prompt 1 — track in-flight player status effects so an enemy hit's
  // status application is committed to state alongside the damage event.
  let pendingPlayerEffects = state.player_status_effects ?? [];

  // Defend buff: halve damage AND +2 to player AGI for defense. Apply
  // the AGI bonus by passing inflated agi_mod to resolveAttack via the
  // target field; halve damage post-roll.
  const playerAgi = abilityMod(player.attributes.agility) + (state.player_defending ? 2 : 0);

  const result = resolveAttack({
    attacker: {
      name:       actor.name,
      agi_mod:    actor.agi_mod,
      str_mod:    actor.str_mod,
      damage_die: actor.damage_die,
    },
    target: {
      name:        player.name,
      agi_mod:     playerAgi,
      // Prompt 1 — fortified +3 (and any future armor status_modifier)
      // is folded into the effective armor bonus here so the resolver
      // sees the buffed DC.
      armor_bonus: playerEffectiveArmorBonus(player, pendingPlayerEffects),
      current_hp:  player.health,
    },
    rng,
  });

  let damage = result.damage;
  if (state.player_defending && damage > 0) {
    damage = applyDefendDamageReduction(damage);
  }

  // Prompt 1 — armor.damage_resistances. If the player's equipped armor
  // resists this enemy's primary_damage_type, subtract that flat
  // amount (minimum 1 if any damage got through). Applies AFTER the
  // defend buff so resistance stacks but doesn't compound oddly.
  if (damage > 0 && actor.primary_damage_type) {
    const armor = player.inventory.find(
      (i) => i.type === ItemType.ARMOR && i.equipped
    );
    const resist =
      armor?.damage_resistances?.[actor.primary_damage_type] ?? 0;
    if (resist > 0) damage = Math.max(1, damage - resist);
  }

  const newHealth = Math.max(0, player.health - damage);
  const newPlayer: PlayerState = { ...player, health: newHealth };

  // Defend buff post-roll halve mutates `damage` but leaves the
  // resolver's raw rolls intact. UI can show both — the d20 hit
  // detail + the actual landed damage — without surprise.
  events.push(makeEvent({
    type:                "enemy_attack",
    actor:               actor.instance_id,
    target:              PLAYER_ID,
    outcome:             result.outcome,
    damage_dealt:        damage,
    remaining_target_hp: newHealth,
    weapon_or_item:      null,
    context_note:        actor.behavior_flavor,
    rolls:               result.rolls,
    damage_type:         actor.primary_damage_type ?? "physical",
  }));

  // Prompt 1 — on-hit status application. Bestiary-declared
  // status_effect (or the can_weaken-derived WEAKENED@20%) rolls
  // against rng. One-curse-limit: any existing ailment is replaced
  // when a new one applies. Buffs aren't touched.
  if (result.outcome === "hit" || result.outcome === "crit") {
    // P8 — perk resist for this status id (0-1), default 0.
    const perkResist = actor.status_effect
      ? player.perk_status_resist?.[actor.status_effect.id] ?? 0
      : 0;
    const { newEffects, applicationEvent } =
      maybeApplyEnemyStatus(actor, pendingPlayerEffects, rng, perkResist);
    pendingPlayerEffects = newEffects;
    if (applicationEvent) events.push(applicationEvent);
  }

  // Did the enemy KO the player?
  if (newHealth <= 0) {
    const sWithEvents = appendEvents(state, events);
    const defeat = handleDefeat({
      state:                   sWithEvents,
      player:                  newPlayer,
      last_settlement_hub_id,
      world_genre,
      defeat_fallback_node_id,
      world_graph_nodes,
    });
    return {
      newState:   undefined,
      newPlayer:  defeat.newPlayer,
      events:     [...events, ...defeat.events],
      resolution: { kind: "defeat", teleport_to_node_id: defeat.newCurrentNodeId },
    };
  }

  // Advance turn; emit any round_start event from advanceTurn.
  let s = appendEvents(state, events);
  // Prompt 1 — commit any status applied this enemy turn before
  // handing control back to the caller. status saves happen on the
  // player's NEXT turn (end-of-turn pass in executePlayerAction).
  s = { ...s, player_status_effects: pendingPlayerEffects };
  const advanced = advanceTurn(s);
  s = appendEvents(advanced.state, advanced.events);

  return { newState: s, newPlayer, events: [...events, ...advanced.events] };
}

/**
 * Day 20.2 TASK 1 — loop enemy turns until control returns to the
 * player or combat ends. Extracted from executePlayerAction so
 * kickoffCombatIfEnemyFirst can reuse the same loop semantics
 * without duplicating the resolution / defend-buff plumbing.
 *
 * Caller is responsible for emitting `enemy_phase_start` /
 * `player_turn_start` separator events around the call when desired
 * — this helper just runs the mechanical loop.
 */
export function advanceUntilPlayerTurnOrEnd({
  state, player, world_genre, last_settlement_hub_id,
  defeat_fallback_node_id, world_graph_nodes, rng = DEFAULT_RNG,
}: {
  state:                    CombatState;
  player:                   PlayerState;
  world_genre:              Genre | string | undefined;
  last_settlement_hub_id?:  string;
  /** Day 20.4 TASK 4 — defeat teleport fallbacks. */
  defeat_fallback_node_id?: string;
  world_graph_nodes?:       Record<string, WorldNode>;
  rng?:                     Rng;
}): PlayerActionResult {
  let s: CombatState = state;
  let p = player;
  const events: CombatEvent[] = [];

  while (
    s.turn_order[s.current_turn_index] !== PLAYER_ID &&
    !checkVictory(s) &&
    !checkDefeat(p)
  ) {
    const enemyTurn = advanceEnemyTurn({
      state:                   s,
      player:                  p,
      last_settlement_hub_id,
      world_genre,
      defeat_fallback_node_id,
      world_graph_nodes,
      rng,
    });
    if (enemyTurn.resolution) {
      return {
        newState:   undefined,
        newPlayer:  enemyTurn.newPlayer,
        events:     [...events, ...enemyTurn.events],
        resolution: enemyTurn.resolution,
      };
    }
    s = enemyTurn.newState!;
    p = enemyTurn.newPlayer;
    events.push(...enemyTurn.events);
  }

  // Reaching the player's turn with player_defending=true means we just
  // ran a full round of enemy turns under the defend buff — clear it.
  if (s.turn_order[s.current_turn_index] === PLAYER_ID && s.player_defending) {
    s = { ...s, player_defending: false };
  }

  return { newState: s, newPlayer: p, events };
}

/**
 * Day 20.2 TASK 1 — fix enemy-wins-initiative deadlock.
 *
 * On combat start, if rollInitiative seats an enemy at turn_order[0],
 * the player can't act (ActionBar gates on isPlayerTurn) and the
 * normal post-action enemy loop never runs (executePlayerAction
 * requires a player turn to fire). Permanent deadlock.
 *
 * The fix: after rollEncounter commits combat state, useCombat
 * detects "enemy has initiative" and calls this helper to drive the
 * initial enemy phase. Behaves like a no-op when the player has
 * initiative (most encounters), so it's safe to call unconditionally
 * after every fresh combat.
 *
 * Emits `enemy_phase_start` BEFORE the loop and `player_turn_start`
 * AFTER (when combat continues to the player's turn) so the story
 * feed gets the same separator framing as a regular post-action
 * enemy phase. On resolution (defeat in the kickoff phase, edge case
 * but defensive), returns the resolution payload exactly like
 * executePlayerAction does.
 */
export function kickoffCombatIfEnemyFirst({
  state, player, world_genre, last_settlement_hub_id,
  defeat_fallback_node_id, world_graph_nodes, rng = DEFAULT_RNG,
}: {
  state:                    CombatState;
  player:                   PlayerState;
  world_genre:              Genre | string | undefined;
  last_settlement_hub_id?:  string;
  /** Day 20.4 TASK 4 — defeat teleport fallbacks. */
  defeat_fallback_node_id?: string;
  world_graph_nodes?:       Record<string, WorldNode>;
  rng?:                     Rng;
}): PlayerActionResult {
  // Player has initiative — no-op. Combat proceeds with the player's
  // first action as normal.
  if (state.turn_order[state.current_turn_index] === PLAYER_ID) {
    return { newState: state, newPlayer: player, events: [] };
  }

  // Defensive: combat already ended somehow before kickoff fired.
  if (checkVictory(state) || checkDefeat(player)) {
    return { newState: state, newPlayer: player, events: [] };
  }

  let s = state;
  const events: CombatEvent[] = [];

  // Emit enemy_phase_start for feed framing.
  const enterPhase = makeEvent({
    type:   "enemy_phase_start",
    actor:  PLAYER_ID,
    target: null,
  });
  s = appendEvents(s, [enterPhase]);
  events.push(enterPhase);

  // Run the enemy turns.
  const result = advanceUntilPlayerTurnOrEnd({
    state:                   s,
    player,
    world_genre,
    last_settlement_hub_id,
    defeat_fallback_node_id,
    world_graph_nodes,
    rng,
  });
  events.push(...result.events);
  if (result.resolution) {
    return {
      newState:   undefined,
      newPlayer:  result.newPlayer,
      events,
      resolution: result.resolution,
    };
  }

  s = result.newState!;
  const p = result.newPlayer;

  // Combat continues — control is back at the player. Emit
  // player_turn_start so the feed pacing mirrors the regular flow.
  if (s.turn_order[s.current_turn_index] === PLAYER_ID) {
    const exitPhase = makeEvent({
      type:   "player_turn_start",
      actor:  PLAYER_ID,
      target: null,
    });
    s = appendEvents(s, [exitPhase]);
    events.push(exitPhase);
  }

  return { newState: s, newPlayer: p, events };
}

// ─────────────────────────────────────────────────────────────────────────────
// Resolution handlers
// ─────────────────────────────────────────────────────────────────────────────

export interface VictoryResult {
  newPlayer:    PlayerState;
  /** Day 21 — loot is no longer rolled on victory. The hook layer
   *  reads this to build a pending FloorLootEntry whose SEARCH REMAINS
   *  button resolves the real items + gold. */
  pending_loot: {
    node_id:            string;
    enemy_instance_ids: string[];
    enemy_loot_refs:    Array<{ loot_table_id: string; is_boss: boolean; xp_value?: number }>;
  };
  xp_awarded:   number;
  events:       CombatEvent[];
}

/**
 * Day 21 — tally XP and emit a pending-loot manifest for the dead
 * enemies. Gold + items DO NOT auto-apply on victory; they're
 * resolved when the player presses SEARCH REMAINS on the FloorLoot
 * strip. The CombatEnemyInstance already carries loot_table_id +
 * is_boss, so the manifest is everything the loot resolver needs.
 *
 * `newPlayer` gets XP only — resources and inventory are untouched
 * to preserve the soulslike "claim your spoils" beat the prompt
 * requires.
 */
export function handleVictory({
  state, player, world_genre, rng = DEFAULT_RNG,
}: {
  state:       CombatState;
  player:      PlayerState;
  world_genre: Genre | string | undefined;
  /** rng is accepted for signature symmetry with handleDefeat /
   *  handleFleeSuccess, but unused by Day 21 victory (no rolls happen
   *  here — loot is rolled at SEARCH REMAINS time with its own rng). */
  rng?:        Rng;
}): VictoryResult {
  // Reference the param so the unused-args lint stays satisfied
  // without breaking the soulslike "no loot at victory" contract.
  void rng;
  let totalXp = 0;
  const enemyInstanceIds: string[] = [];
  const enemyLootRefs: Array<{ loot_table_id: string; is_boss: boolean; xp_value?: number }> = [];

  for (const e of state.enemies) {
    if (e.alive) continue;  // shouldn't happen post-victory, but safe
    totalXp += e.xp_value;
    enemyInstanceIds.push(e.instance_id);
    // Prompt 1 — propagate xp_value so the gold tier (Tier 2 fires
    // when xp_value >= 20) is computable at SEARCH REMAINS time.
    enemyLootRefs.push({
      loot_table_id: e.loot_table_id,
      is_boss:       e.is_boss,
      xp_value:      e.xp_value,
    });
  }

  // XP only — no resource / inventory mutation. world_genre is kept
  // in the signature for symmetry with handleDefeat / handleFleeSuccess
  // and so the hook layer can still introspect it from the result
  // without re-fetching MasterState.
  void world_genre;
  const newXp = player.xp + totalXp;

  // Day 22 — detect XP threshold crossing. The level-up modal opens
  // AFTER combat dismisses (gated on `!combat?.active && pending`),
  // so we just flag it here. checkLevelUp clamps at LEVEL_CAP — a
  // capped player accumulates XP without re-triggering the modal.
  const { leveled_up } = checkLevelUp(newXp, player.level);
  const newPlayer: PlayerState = {
    ...player,
    xp: newXp,
    ...(leveled_up ? { pending_level_up: true } : {}),
  };

  const events: CombatEvent[] = [makeEvent({
    type:         "victory",
    actor:        "PLAYER",
    target:       null,
    outcome:      null,
    damage_dealt: null,
    weapon_or_item: null,
    context_note: `xp +${totalXp}, ${enemyInstanceIds.length} enemy(ies) defeated — search remains for loot`,
  })];

  // eslint-disable-next-line no-console
  console.log(
    `[Combat] Victory! XP +${totalXp}, ` +
    `${enemyInstanceIds.length} enemies dropped pending loot.`
  );

  return {
    newPlayer,
    pending_loot: {
      node_id:            state.origin_node_id,
      enemy_instance_ids: enemyInstanceIds,
      enemy_loot_refs:    enemyLootRefs,
    },
    xp_awarded: totalXp,
    events,
  };
}

export interface DefeatResult {
  newPlayer:          PlayerState;
  newCurrentNodeId:   string;
  events:             CombatEvent[];
}

/**
 * Apply the §9 defeat penalty. HP -> 50% of max, currency -> 90%
 * of the genre's currency key, XP rolled back to pre_combat_xp.
 * Returns the teleport target id; the hook layer applies it to
 * world_state.current_node_id.
 *
 * Day 20.4 TASK 4 — explicit fallback chain with diagnostic logs.
 * Caller can pass:
 *   - last_settlement_hub_id (preferred — soulslike model)
 *   - defeat_fallback_node_id (starting region settlement; safe net
 *     when last_settlement_hub_id was never set)
 *   - world_graph_nodes (for resolving destination display name +
 *     parent region name into the event's destination metadata)
 *
 * Cross-region teleport is INTENDED. Defeat returns the player to
 * whatever settlement they last visited, even if that's in a
 * previous region. Settlements are the deliberate checkpoint.
 */
export function handleDefeat({
  state, player, last_settlement_hub_id, world_genre,
  defeat_fallback_node_id, world_graph_nodes,
}: {
  state:                    CombatState;
  player:                   PlayerState;
  last_settlement_hub_id?:  string;
  world_genre:              Genre | string | undefined;
  /** Day 20.4 TASK 4 — secondary fallback, e.g.
   *  metadata.world_bible.starting_region.settlement_id. */
  defeat_fallback_node_id?: string;
  /** Day 20.4 TASK 4 — used to resolve display names + parent
   *  region for the destination metadata. Optional; when omitted
   *  the destination payload is built from ids only. */
  world_graph_nodes?:       Record<string, WorldNode>;
}): DefeatResult {
  // Prompt 1 — death penalty rebalanced. HP restored to 75% of max
  // (was 50%) so the player isn't immediately one-shot by ambient
  // wandering enemies on respawn. Gold penalty: 10% of current
  // balance, capped at 50 (was a flat 10% with no cap) — keeps the
  // sting on a small purse without crushing a wealthy save.
  // player_status_effects lives on CombatState which is dismissed
  // wholesale on defeat (rule 29), so no explicit clear needed here.
  const respawnHp   = Math.max(1, Math.floor(player.max_health * 0.75));
  const currencyKey = currencyKeyFor(world_genre);
  const currentBal  = player.resources[currencyKey] ?? 0;
  const goldLoss    = Math.min(50, Math.floor(currentBal * 0.1));
  const newBal      = Math.max(0, currentBal - goldLoss);
  const newPlayer: PlayerState = {
    ...player,
    health:    respawnHp,
    xp:        state.pre_combat_xp, // forfeit gains
    resources: {
      ...player.resources,
      [currencyKey]: newBal,
    },
  };

  // Day 20.4 TASK 4 — fallback chain with explicit diagnostic logging.
  let teleportTo: string;
  if (last_settlement_hub_id) {
    teleportTo = last_settlement_hub_id;
  } else if (defeat_fallback_node_id) {
    console.warn(
      "[handleDefeat] last_settlement_hub_id missing — falling back to starting settlement:",
      defeat_fallback_node_id
    );
    teleportTo = defeat_fallback_node_id;
  } else {
    console.warn(
      "[handleDefeat] both last_settlement_hub_id and defeat_fallback_node_id missing — falling back to encounter origin:",
      state.origin_node_id
    );
    teleportTo = state.origin_node_id;
  }

  // Resolve destination metadata for the StoryFeed info line.
  const destination = resolveDefeatDestination(teleportTo, world_graph_nodes);

  const events: CombatEvent[] = [makeEvent({
    type:         "defeat",
    actor:        "PLAYER",
    target:       null,
    outcome:      null,
    context_note: `teleport to ${teleportTo}`,
    destination,
  })];

  // eslint-disable-next-line no-console
  console.log(`[Combat] Defeat. Returning to ${teleportTo}.`);

  return {
    newPlayer,
    newCurrentNodeId: teleportTo,
    events,
  };
}

/**
 * Day 20.4 TASK 4 — build the destination metadata payload by
 * looking up the teleport target node + its parent geographic
 * region. Returns ids-only when world_graph_nodes isn't supplied.
 */
function resolveDefeatDestination(
  nodeId: string,
  nodes:  Record<string, WorldNode> | undefined
): { node_id: string; node_name: string; region_id?: string; region_name?: string } {
  const node = nodes?.[nodeId];
  if (!node) {
    return { node_id: nodeId, node_name: nodeId };
  }
  // Walk zone_id chain to the geographic region zone (zone_id === id).
  let regionId:   string | undefined;
  let regionName: string | undefined;
  let cur:        WorldNode | undefined = node;
  const visited = new Set<string>();
  while (cur && !visited.has(cur.id)) {
    visited.add(cur.id);
    if (!cur.zone_id || cur.zone_id === cur.id) {
      // Only count this as a "region" when it's distinct from the
      // node itself (settlement nodes are at zone_id = region id, so
      // their chain naturally walks UP to the region).
      if (cur.id !== node.id) {
        regionId   = cur.id;
        regionName = cur.name;
      }
      break;
    }
    cur = nodes?.[cur.zone_id];
  }
  return {
    node_id:     node.id,
    node_name:   node.name,
    region_id:   regionId,
    region_name: regionName,
  };
}

export interface FleeSuccessResult {
  newCurrentNodeId: string;
  events:           CombatEvent[];
}

/**
 * Flee success — return one node back along the navigation_trail.
 * If the trail is too short (player started here), fall back to
 * the combat's origin node.
 *
 * Day 20.4 TASK 4 — accepts an optional world_graph_nodes for
 * resolving the destination's display name into the flee_success
 * event payload (no region context — flee is a short hop).
 */
export function handleFleeSuccess({
  state, navigation_trail, world_graph_nodes,
}: {
  state:              CombatState;
  navigation_trail?:  string[];
  world_graph_nodes?: Record<string, WorldNode>;
}): FleeSuccessResult {
  const trail = Array.isArray(navigation_trail) ? navigation_trail : [];
  // The trail's last entry is "where the player is now". The previous
  // entry is "where they came from" — that's the rollback target.
  const previous = trail.length >= 2 ? trail[trail.length - 2] : null;
  const target   = previous ?? state.origin_node_id;
  const targetNode = world_graph_nodes?.[target];
  const events: CombatEvent[] = [makeEvent({
    type:         "flee_success",
    actor:        "PLAYER",
    target:       null,
    outcome:      "fled",
    context_note: `returned to ${target}`,
    destination: {
      node_id:   target,
      node_name: targetNode?.name ?? target,
      // No region context for short-hop flees per spec.
    },
  })];
  // eslint-disable-next-line no-console
  console.log(`[Combat] Fled. Returned to ${target}.`);
  return { newCurrentNodeId: target, events };
}

// ─────────────────────────────────────────────────────────────────────────────
// Prompt 1 — Status effect helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Ailments (debuffs) vs buffs. Saves are rolled for ailments only;
 *  buffs decrement duration and drop off when they reach 0. */
const AILMENT_IDS: StatusEffectId[] = [
  "poisoned", "burning", "chilled", "weakened", "frightened",
];

/** Sum stat_modifier contributions across active effects to produce the
 *  player's effective AGI/STR for attack rolls. Buffs add; debuffs (with
 *  negative `amount`) subtract. */
function playerEffectiveAttackMods(
  player:  PlayerState,
  effects: ActiveStatusEffect[],
): { agi_mod: number; str_mod: number } {
  let agiMod = abilityMod(player.attributes.agility);
  let strMod = abilityMod(player.attributes.strength);
  for (const e of effects) {
    if (!e.stat_modifier) continue;
    const { stat, amount } = e.stat_modifier;
    if (stat === "all_rolls") { agiMod += amount; strMod += amount; }
    else if (stat === "agility")  agiMod += amount;
    else if (stat === "strength") strMod += amount;
  }
  return { agi_mod: agiMod, str_mod: strMod };
}

/** Effective armor bonus = equipped armor + sum of armor stat_modifiers
 *  (fortified +3, etc.). Negative armor modifiers are theoretically
 *  possible but the canonical effect set only uses positive values. */
function playerEffectiveArmorBonus(
  player:  PlayerState,
  effects: ActiveStatusEffect[],
): number {
  let bonus = playerArmorBonus(player);
  for (const e of effects) {
    if (e.stat_modifier?.stat === "armor") bonus += e.stat_modifier.amount;
  }
  return bonus;
}

/** Apply DoT damage for every active effect carrying damage_per_tick.
 *  Returns the player's new HP and a tick event per ailment that dealt
 *  damage. Pure — caller commits the HP back to PlayerState. */
function applyPlayerStatusTicks(
  player:  PlayerState,
  effects: ActiveStatusEffect[],
): { newHp: number; tickEvents: CombatEvent[] } {
  let hp = player.health;
  const tickEvents: CombatEvent[] = [];
  for (const e of effects) {
    if (!e.damage_per_tick || e.damage_per_tick <= 0) continue;
    hp = Math.max(0, hp - e.damage_per_tick);
    tickEvents.push(makeEvent({
      type:                "status_tick",
      actor:               e.source,
      target:              PLAYER_ID,
      damage_dealt:        e.damage_per_tick,
      remaining_target_hp: hp,
      weapon_or_item:      e.id,
      context_note:        `${e.id} tick`,
    }));
  }
  return { newHp: hp, tickEvents };
}

/** End-of-turn save pass. Buffs decrement duration without rolling;
 *  ailments roll d20 + stat-mod vs save_dc. A save OR a duration
 *  expiry drops the effect. Emits status_saved / status_expired events. */
function rollPlayerStatusSaves(
  player:  PlayerState,
  effects: ActiveStatusEffect[],
  rng:     Rng,
): { newEffects: ActiveStatusEffect[]; saveEvents: CombatEvent[] } {
  const saveEvents: CombatEvent[] = [];
  const surviving: ActiveStatusEffect[] = [];
  for (const e of effects) {
    const isBuff    = !AILMENT_IDS.includes(e.id);
    const newRounds = e.rounds_remaining - 1;
    if (isBuff) {
      if (newRounds > 0) {
        surviving.push({ ...e, rounds_remaining: newRounds });
      } else {
        saveEvents.push(makeEvent({
          type:           "status_expired",
          actor:          PLAYER_ID,
          target:         PLAYER_ID,
          weapon_or_item: e.id,
          context_note:   `${e.id} expired`,
        }));
      }
      continue;
    }
    const statVal    = player.attributes[e.save_stat] ?? 2;
    const saveResult = rollStatusSave(e, abilityMod(statVal), rng);
    if (saveResult.saved || newRounds <= 0) {
      saveEvents.push(makeEvent({
        type:           saveResult.saved ? "status_saved" : "status_expired",
        actor:          PLAYER_ID,
        target:         PLAYER_ID,
        weapon_or_item: e.id,
        context_note:   saveResult.saved
          ? `saved (${saveResult.total} vs DC${saveResult.dc})`
          : `expired`,
        rolls:          saveResult.rolls,
      }));
    } else {
      surviving.push({ ...e, rounds_remaining: newRounds });
    }
  }
  return { newEffects: surviving, saveEvents };
}

/** One-curse-limit applicator. Rolls the enemy's on-hit status. If it
 *  applies, removes any existing AILMENT from the player's effect list
 *  before adding the new one. Buffs are preserved.
 *
 *  P8 — `perkResist` is the player's per-status resist chance from perks
 *  (0-1). After the enemy's application roll passes, a second roll vs
 *  the perk chance can shrug the status off. Default 0 = no resist. */
function maybeApplyEnemyStatus(
  actor:       CombatEnemyInstance,
  current:     ActiveStatusEffect[],
  rng:         Rng,
  perkResist:  number = 0,
): { newEffects: ActiveStatusEffect[]; applicationEvent: CombatEvent | null } {
  const cfg = actor.status_effect;
  if (!cfg) return { newEffects: current, applicationEvent: null };
  const { applied, damage_per_tick } =
    rollStatusApplication(cfg.id, cfg.chance, rng);
  if (!applied) return { newEffects: current, applicationEvent: null };
  // P8 — perk resist roll. Applied AFTER the enemy's chance passes, so
  // a 25% resist means a 25% chance to negate the application.
  if (perkResist > 0 && rng() < perkResist) {
    return { newEffects: current, applicationEvent: null };
  }
  const next = [
    ...current.filter((e) => !AILMENT_IDS.includes(e.id)),
    buildStatusEffect(cfg.id, actor.name, damage_per_tick),
  ];
  return {
    newEffects: next,
    applicationEvent: makeEvent({
      type:           "status_applied",
      actor:          actor.instance_id,
      target:         PLAYER_ID,
      weapon_or_item: cfg.id,
      context_note:   `${actor.name} applied ${cfg.id}`,
    }),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Player stat helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ability modifier calibrated for our 2-10 stat range (V8.51+).
 *
 *   score 2-3 → +0    score 6-7 →  +2
 *   score 4-5 → +1    score 8-9 →  +3
 *   score 10  → +4    (max achievable)
 *
 * The legacy D&D 5e formula `floor((score - 10) / 2)` produced
 * negative modifiers across our whole stat range — a Knight with
 * archetype-rolled AGI 3 was rolling d20-4 to hit, ~25% hit rate
 * against typical enemy DC. Combat was unwinnable at level 1.
 * dice.ts's getAttributeModifier mirrors this formula so display
 * and stat-check paths stay consistent.
 */
function abilityMod(score: number): number {
  return Math.floor((score - 2) / 2);
}

/**
 * Resolve the player's equipped weapon damage die. Falls back to
 * "1d4" (unarmed) when nothing is equipped.
 */
function weaponDamageDie(player: PlayerState): string {
  const weapon = player.inventory.find((i) => i.type === ItemType.WEAPON && i.equipped);
  const die = weapon?.effect?.damage_die;
  if (typeof die === "string" && /^\d+d\d+$/.test(die)) return die;
  return "1d4";
}

function weaponName(player: PlayerState): string {
  const weapon = player.inventory.find((i) => i.type === ItemType.WEAPON && i.equipped);
  return weapon?.name ?? "fists";
}

/**
 * Resolve the player's equipped armor bonus. Falls back to 0 when
 * nothing is equipped.
 */
function playerArmorBonus(player: PlayerState): number {
  const armor = player.inventory.find((i) => i.type === ItemType.ARMOR && i.equipped);
  const bonus = armor?.effect?.armor_bonus;
  if (typeof bonus === "number" && Number.isFinite(bonus)) return bonus;
  return 0;
}

// Day 21 — makeStubItem removed. Victory no longer stamps loot
// items inline; the FloorLootStrip's SEARCH REMAINS button resolves
// real Item rows via loot-resolver instead.
