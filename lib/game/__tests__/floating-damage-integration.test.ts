/**
 * Day 20.4.2 TASK 1 — End-to-end "field-name drift" tripwire.
 *
 * What V8.38 broke and 20.4.2 fixed:
 *   The floating damage helper (makeFloatingEntry) reads
 *   `event.target` to figure out which portrait to host the float on.
 *   If anyone ever renames CombatEvent.target → CombatEvent.target_id
 *   (or anything else), the helper silently returns null on every
 *   player_attack — and the bug is invisible until someone manually
 *   plays combat, because the existing unit tests in floating-damage
 *   .test.ts construct synthetic events with hard-coded field names.
 *
 * This test wires the REAL pieces together:
 *   resolveAttack / resolveUseItem  (the math layer)
 *     → makeEvent inside combat-engine.executePlayerAction
 *       (where the field names get assigned from the resolver output)
 *         → makeFloatingEntry
 *           (which reads those field names)
 *
 * If field names drift anywhere along that chain, this test fails
 * before anyone hits the bug in the browser.
 *
 * NOTE: floating-damage.test.ts (the sibling file) still tests the
 * helper in isolation with synthetic events — that's faster + finer-
 * grained for routing logic. THIS file deliberately uses real engine
 * output so a rename can't hide behind a stale test fixture.
 */

import { Genre, ItemRarity, ItemType } from "@/types/game";
import type {
  CombatEnemyInstance,
  CombatState,
  PlayerState,
  WorldNode,
} from "@/types/game";
import {
  PLAYER_ID,
  executePlayerAction,
} from "@/lib/game/combat-engine";
import { BASIC_HEALTH_POTION_ID } from "@/lib/game/combat-resolver";
import { makeFloatingEntry } from "@/components/game/CombatMode/CombatMode";

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures — mirror the structure used in combat-flow.test.ts so the
// integration scenarios behave like real combat (not a stripped-down
// minimal stub that could mask a field-name drift).
// ─────────────────────────────────────────────────────────────────────────────

/** Deterministic RNG — replays a fixed sequence in [0, 1). */
function seqRng(values: number[]): () => number {
  let i = 0;
  return () => {
    const v = values[i % values.length];
    i += 1;
    return v;
  };
}

/** Force d20 = 14: Math.floor(0.65 * 20) + 1 = 14. */
const RNG_D20_14 = 0.65;
/** Force d20 = 20 (crit): Math.floor(0.99 * 20) + 1 = 20. */
const RNG_D20_CRIT = 0.99;
/** Damage roll: forces 4 on 1d8 (Math.floor(0.4 * 8) + 1 = 4) or
 *  4 on 1d6 (Math.floor(0.55 * 6) + 1 = 4). */
const RNG_DMG_MID = 0.55;

function makePlayer(overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    name:        "TestHero",
    background:  "knight",
    health:      20,
    max_health:  30,    // 10 HP "headroom" so the heal lands a positive roll
    resources:   { gold: 100 },
    // V8.51 — calibrated for the new abilityMod formula
    // (floor((stat - 2) / 2)). STR/AGI 6 → +2 mods, preserves the math
    // baked into the file's RNG sequences (originally STR/AGI 14 under
    // the legacy D&D formula gave the same +2). Other stats stay at the
    // 2-10 ceiling.
    attributes: {
      strength:     6,
      agility:      6,
      charisma:     10,
      intelligence: 10,
      perception:   10,
    },
    inventory: [
      {
        id:          "iron_sword",
        name:        "Iron Sword",
        type:        ItemType.WEAPON,
        rarity:      ItemRarity.COMMON,
        description: "A test sword.",
        quantity:    1,
        stackable:   false,
        equipped:    true,
        effect:      { damage_die: "1d8" },
      },
      {
        id:          BASIC_HEALTH_POTION_ID,
        name:        "Basic Health Potion",
        type:        ItemType.CONSUMABLE,
        rarity:      ItemRarity.COMMON,
        description: "Heals 1d8 + 4 HP.",
        quantity:    1,
        stackable:   true,
        equipped:    false,
      },
    ],
    level: 1,
    xp:    50,
    // P6 — ability fields are required on PlayerState; populated by P7.
    learned_abilities:      [],
    equipped_ability_slots: [null, null, null, null],
    passive_ability:        null,
    ...overrides,
  };
}

function makeEnemy(
  instanceId: string,
  overrides: Partial<CombatEnemyInstance> = {}
): CombatEnemyInstance {
  return {
    instance_id:     instanceId,
    enemy_id:        "fantasy_goblin",
    name:            "Goblin",
    description:     "Test goblin.",
    current_hp:      20,    // tank enough not to die in one hit
    max_hp:          20,
    agi_mod:         0,
    str_mod:         2,
    damage_die:      "1d6",
    armor_bonus:     0,     // DC = 10 — d20=14 with +2 AGI passes cleanly
    xp_value:        25,
    loot_table_id:   "fantasy_goblin_loot",
    is_boss:         false,
    behavior_flavor: "aggressive melee",
    alive:           true,
    ...overrides,
  };
}

function makeCombatState(
  enemies:    CombatEnemyInstance[],
  overrides:  Partial<CombatState> = {}
): CombatState {
  return {
    active:             true,
    encounter_id:       "test_enc_integration",
    enemies,
    turn_order:         [PLAYER_ID, ...enemies.map((e) => e.instance_id)],
    current_turn_index: 0,
    round_number:       1,
    player_defending:   false,
    combat_log:         [],
    origin_node_id:     "test_node",
    pre_combat_xp:      50,
    ...overrides,
  };
}

const baseNode: WorldNode = {
  id:                "test_node",
  name:              "Test Node",
  type:              "zone",
  zone_id:           "test_zone",
  is_expandable:     false,
  connections:       [],
  npc_ids:           [],
  item_ids:          [],
  asset_id:          "test_asset",
  discovered:        true,
  map_position:      { x: 0, y: 0 },
  encounter_chance:  0,
  encounter_roster:  [],
};

// ─────────────────────────────────────────────────────────────────────────────
// Field-name drift tripwires
// ─────────────────────────────────────────────────────────────────────────────

describe("Day 20.4.2 TASK 1 — floating damage end-to-end integration", () => {
  it("player_attack: real engine event → makeFloatingEntry hosts on the targeted enemy's instance_id", () => {
    // Real combat state with a uniquely-named enemy instance id so a
    // string-equality assertion proves the helper read THIS specific
    // event's target field (not, say, a hardcoded "fantasy_goblin_1").
    const enemy  = makeEnemy("custom_goblin_xyz_42");
    const player = makePlayer();
    const combat = makeCombatState([enemy]);
    // Force d20 = 14 (hit, not crit), damage = 4. Single attack
    // resolves; enemy survives (HP 20, damage 4 + 2 STR = 6).
    const rng = seqRng([RNG_D20_14, RNG_DMG_MID, /* enemy turn d20 */ 0.05]);

    const result = executePlayerAction({
      action:       { action: "attack", target_instance_id: enemy.instance_id },
      state:        combat,
      player,
      world_genre:  Genre.FANTASY,
      world_graph_nodes: { test_node: baseNode },
      rng,
    });

    // Find the player_attack event the engine emitted.
    const playerAttack = result.events.find((e) => e.type === "player_attack");
    expect(playerAttack).toBeDefined();
    expect(playerAttack!.outcome).toBe("hit");
    // FIELD-NAME TRIPWIRE: the engine wrote target = enemy.instance_id
    // (not target_id, not targetId). If this assertion fails it means
    // CombatEvent.target was renamed or makeEvent stopped populating it.
    expect(playerAttack!.target).toBe(enemy.instance_id);

    // Now feed the REAL event through makeFloatingEntry. The host id
    // it returns must match the real enemy's instance_id — not a fake
    // string, not PLAYER, not the actor.
    const float = makeFloatingEntry(playerAttack!);
    expect(float).not.toBeNull();
    expect(float!.targetId).toBe(enemy.instance_id);
    expect(float!.targetId).not.toBe(PLAYER_ID);
    expect(float!.targetId).not.toBe("fantasy_goblin_1"); // not the test fixture sibling
    expect(float!.payload.kind).toBe("hit");
    expect(float!.payload.color).toBe("var(--combat-player)");
  });

  it("player_attack crit: real engine event → makeFloatingEntry hosts on enemy with crit color + TOTAL damage", () => {
    const enemy  = makeEnemy("crit_target_alpha");
    const player = makePlayer();
    const combat = makeCombatState([enemy]);
    // Nat-20 forces crit. Crit damage = max(1d6)=6 + bonus 1d6 roll + STR(2).
    const rng = seqRng([RNG_D20_CRIT, RNG_DMG_MID, /* enemy turn */ 0.05]);

    const result = executePlayerAction({
      action:       { action: "attack", target_instance_id: enemy.instance_id },
      state:        combat,
      player,
      world_genre:  Genre.FANTASY,
      world_graph_nodes: { test_node: baseNode },
      rng,
    });

    const critEvent = result.events.find(
      (e) => e.type === "player_attack" && e.outcome === "crit"
    );
    expect(critEvent).toBeDefined();
    expect(critEvent!.target).toBe(enemy.instance_id);
    expect(typeof critEvent!.damage_dealt).toBe("number");
    expect(critEvent!.damage_dealt!).toBeGreaterThan(0);

    const float = makeFloatingEntry(critEvent!);
    expect(float).not.toBeNull();
    expect(float!.targetId).toBe(enemy.instance_id);
    expect(float!.payload.kind).toBe("crit");
    expect(float!.payload.color).toBe("var(--combat-player-crit)");
    // Crit floats display TOTAL damage (the climactic moment), not
    // just the bonus die roll. Verify by matching damage_dealt.
    expect(float!.payload.value).toBe(critEvent!.damage_dealt);
  });

  it("enemy_attack: real engine event → makeFloatingEntry hosts on PLAYER (string sentinel)", () => {
    // Player goes second so we get an enemy_attack in the result.
    const enemy  = makeEnemy("goblin_attacker_1", { str_mod: 1 });
    const player = makePlayer();
    const combat = makeCombatState([enemy], {
      // Force enemy initiative slot so the player's "defend" action
      // gives the enemy a chance to attack on the auto-resolved phase.
      turn_order:         [PLAYER_ID, enemy.instance_id],
      current_turn_index: 0,
    });
    // Player defends (no roll), then enemy d20 = 14 (hit), damage 4.
    const rng = seqRng([RNG_D20_14, RNG_DMG_MID]);

    const result = executePlayerAction({
      action:       { action: "defend" },
      state:        combat,
      player,
      world_genre:  Genre.FANTASY,
      world_graph_nodes: { test_node: baseNode },
      rng,
    });

    const enemyAttack = result.events.find((e) => e.type === "enemy_attack");
    expect(enemyAttack).toBeDefined();
    expect(enemyAttack!.actor).toBe(enemy.instance_id);
    // FIELD-NAME TRIPWIRE: target on an enemy attack is the literal
    // string "PLAYER", NOT player.name or a player UUID. Defend halves
    // damage but the event itself still resolves.
    expect(enemyAttack!.target).toBe(PLAYER_ID);

    const float = makeFloatingEntry(enemyAttack!);
    // The enemy might miss with this RNG seed; if so the helper
    // correctly returns null (no float for miss). Only assert routing
    // when the resolver returned a hit.
    if (enemyAttack!.outcome === "hit" || enemyAttack!.outcome === "crit") {
      expect(float).not.toBeNull();
      expect(float!.targetId).toBe(PLAYER_ID);
      expect(float!.targetId).not.toBe(enemy.instance_id);
      expect(float!.payload.color).toMatch(/var\(--combat-enemy/);
    } else {
      expect(float).toBeNull();
    }
  });

  it("use_item heal: real engine event → makeFloatingEntry hosts on PLAYER with hl-pass green", () => {
    const enemy  = makeEnemy("bystander_goblin");
    const player = makePlayer({ health: 10 }); // wound so heal lands non-zero
    const combat = makeCombatState([enemy]);
    // Heal die: 1d8 with rng=0.4 → Math.floor(0.4*8)+1 = 4. Flat +4 = 8.
    // Enemy turn rolls follow.
    const rng = seqRng([0.4, /* enemy d20 */ 0.05]);

    const result = executePlayerAction({
      action:       { action: "use_item", item_id: BASIC_HEALTH_POTION_ID },
      state:        combat,
      player,
      world_genre:  Genre.FANTASY,
      world_graph_nodes: { test_node: baseNode },
      rng,
    });

    const useItem = result.events.find((e) => e.type === "use_item");
    expect(useItem).toBeDefined();
    // FIELD-NAME TRIPWIRE: actor + target are both PLAYER for a heal.
    expect(useItem!.actor).toBe(PLAYER_ID);
    expect(useItem!.target).toBe(PLAYER_ID);
    // Engine convention: negative damage_dealt = healing.
    expect(useItem!.damage_dealt!).toBeLessThan(0);
    // The rolls payload carries the heal die roll (the value the float
    // surfaces, BEFORE the flat +4 bonus).
    expect(useItem!.rolls?.damage_die).toBe("1d8");
    expect(useItem!.rolls?.damage_die_roll).toBe(4);

    const float = makeFloatingEntry(useItem!);
    expect(float).not.toBeNull();
    expect(float!.targetId).toBe(PLAYER_ID);
    expect(float!.payload.kind).toBe("heal");
    expect(float!.payload.color).toBe("var(--hl-pass)");
    // Heal floats show the die roll (4), not the total healed (8).
    expect(float!.payload.value).toBe(4);
  });

  it("multiple enemies: player attack on enemy[1] routes to enemy[1]'s id, NOT enemy[0]", () => {
    // Regression guard: with multiple enemies present, the engine must
    // write the *specific* attacked enemy's id into event.target, and
    // makeFloatingEntry must read THAT field — not the first enemy in
    // the array. This caught a class of bugs where helpers grabbed
    // state.enemies[0] instead of event.target.
    const goblinA = makeEnemy("alpha_goblin_111");
    const goblinB = makeEnemy("beta_goblin_222");
    const player  = makePlayer();
    const combat  = makeCombatState([goblinA, goblinB]);
    const rng = seqRng([RNG_D20_14, RNG_DMG_MID, 0.05, 0.05, 0.05, 0.05]);

    const result = executePlayerAction({
      action:       { action: "attack", target_instance_id: goblinB.instance_id },
      state:        combat,
      player,
      world_genre:  Genre.FANTASY,
      world_graph_nodes: { test_node: baseNode },
      rng,
    });

    const playerAttack = result.events.find((e) => e.type === "player_attack");
    expect(playerAttack!.target).toBe(goblinB.instance_id);
    expect(playerAttack!.target).not.toBe(goblinA.instance_id);

    const float = makeFloatingEntry(playerAttack!);
    expect(float!.targetId).toBe(goblinB.instance_id);
    expect(float!.targetId).not.toBe(goblinA.instance_id);
  });
});
