import { ItemType } from "@/types/game";
import type {
  CombatEnemyInstance,
  CombatEvent,
  CombatState,
  Enemy,
  Genre,
  PlayerState,
  RegionBible,
  WorldBible,
  WorldNode,
} from "@/types/game";
import { getGenreBestiary } from "./bestiary";
// Day 21 — rollStubDrops, makeStubItem, and the BASIC_HEALTH_POTION_ID
// import are all removed: loot is now resolved on demand by the
// floor-loot SEARCH REMAINS path through lib/game/loot-resolver.ts.
// The lib/game/loot/stub-drops module remains for combat-resolver's
// use_item heal lookup (which imports its own copy of the constant
// directly).
import {
  applyDefendDamageReduction,
  resolveAttack,
  resolveFlee,
  resolveUseItem,
  rollEnemyHP,
  rollInitiative,
  type Rng,
} from "./combat-resolver";

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
  spawnIds.forEach((enemyId, idx) => {
    const enemy = resolveEnemyLookup(enemyId, node, world_bible, region_bibles, genre);
    if (!enemy) {
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
    });
  });

  if (enemies.length === 0) {
    console.warn(`[combat-engine] All enemy ids unresolvable at node ${node.id} — encounter cancelled.`);
    return { combatStarted: false };
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
  | { action: "flee" };

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
        enemy_loot_refs:    Array<{ loot_table_id: string; is_boss: boolean }>;
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
          agi_mod:    abilityMod(player.attributes.agility),
          str_mod:    abilityMod(player.attributes.strength),
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
      const result = resolveUseItem({
        item_id: action.item_id,
        player:  { current_hp: player.health, max_hp: player.max_health },
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
  }

  s = appendEvents(s, events);

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
      armor_bonus: playerArmorBonus(player),
      current_hp:  player.health,
    },
    rng,
  });

  let damage = result.damage;
  if (state.player_defending && damage > 0) {
    damage = applyDefendDamageReduction(damage);
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
  }));

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
    enemy_loot_refs:    Array<{ loot_table_id: string; is_boss: boolean }>;
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
  const enemyLootRefs: Array<{ loot_table_id: string; is_boss: boolean }> = [];

  for (const e of state.enemies) {
    if (e.alive) continue;  // shouldn't happen post-victory, but safe
    totalXp += e.xp_value;
    enemyInstanceIds.push(e.instance_id);
    enemyLootRefs.push({ loot_table_id: e.loot_table_id, is_boss: e.is_boss });
  }

  // XP only — no resource / inventory mutation. world_genre is kept
  // in the signature for symmetry with handleDefeat / handleFleeSuccess
  // and so the hook layer can still introspect it from the result
  // without re-fetching MasterState.
  void world_genre;
  const newPlayer: PlayerState = {
    ...player,
    xp: player.xp + totalXp,
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
  const halvedHp    = Math.max(1, Math.floor(player.max_health * 0.5));
  const currencyKey = currencyKeyFor(world_genre);
  const currentBal  = player.resources[currencyKey] ?? 0;
  const newPlayer: PlayerState = {
    ...player,
    health:    halvedHp,
    xp:        state.pre_combat_xp, // forfeit gains
    resources: {
      ...player.resources,
      [currencyKey]: Math.floor(currentBal * 0.9),
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
// Player stat helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Standard d20 ability modifier: floor((score - 10) / 2). */
function abilityMod(score: number): number {
  return Math.floor((score - 10) / 2);
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
