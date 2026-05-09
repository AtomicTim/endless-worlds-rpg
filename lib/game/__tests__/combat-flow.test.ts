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
  rollEncounter,
  type PlayerActionResult,
} from "../combat-engine";

function seqRng(values: number[]): () => number {
  let i = 0;
  return () => {
    const v = values[i % values.length];
    i += 1;
    return v;
  };
}

function makePlayer(overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    name:        "TestHero",
    background:  "knight",
    health:      30,
    max_health:  30,
    resources:   { gold: 100 },
    attributes: {
      strength:     14,
      agility:      14,
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
    ],
    level: 1,
    xp:    50,
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
    current_hp:      8,
    max_hp:          8,
    agi_mod:         1,
    str_mod:         0,
    damage_die:      "1d6",
    armor_bonus:     1,
    xp_value:        25,
    loot_table_id:   "fantasy_goblin_loot",
    is_boss:         false,
    behavior_flavor: "aggressive melee",
    alive:           true,
    ...overrides,
  };
}

function makeCombatState(
  enemies: CombatEnemyInstance[],
  overrides: Partial<CombatState> = {}
): CombatState {
  return {
    active:             true,
    encounter_id:       "test_enc",
    enemies,
    turn_order:         [PLAYER_ID, ...enemies.map((e) => e.instance_id)],
    current_turn_index: 0,
    round_number:       1,
    player_defending:   false,
    combat_log:         [],
    origin_node_id:     "the_thorned_cloister",
    pre_combat_xp:      50,
    ...overrides,
  };
}

const baseNode: WorldNode = {
  id:                "the_thorned_cloister",
  name:              "The Thorned Cloister",
  type:              "zone",
  zone_id:           "the_rustveil_commons",
  is_expandable:     false,
  connections:       [],
  npc_ids:           [],
  item_ids:          [],
  asset_id:          "location_the_thorned_cloister",
  discovered:        true,
  map_position:      { x: 10, y: -5 },
  encounter_chance:  1.0,
  encounter_roster:  ["fantasy_goblin"],
};

// ===========================================================================
// Encounter -> victory flow
// ===========================================================================

describe("integration: encounter -> player attack -> victory", () => {
  it("end-to-end: trigger, kill the goblin, victory awards XP + dismisses combat", () => {
    // Force a single 1-HP goblin so a single attack kills it.
    const combat = makeCombatState([makeEnemy("g1", { current_hp: 1, max_hp: 1 })]);
    const player = makePlayer();

    // d20 = 20 (0.95) -> crit -> max(1d8)=8 + d8(0.95->8) + str_mod(2) = 18 damage.
    // Player goes first by construction (turn_order[0] = PLAYER).
    const rng = seqRng([0.95, 0.95]);
    const result: PlayerActionResult = executePlayerAction({
      action:      { action: "attack", target_instance_id: "g1" },
      state:       combat,
      player,
      world_genre: Genre.FANTASY,
      rng,
    });

    expect(result.resolution?.kind).toBe("victory");
    expect(result.newState).toBeUndefined();   // combat dismissed
    if (result.resolution?.kind !== "victory") throw new Error("expected victory");
    expect(result.resolution.xp_awarded).toBe(25);
    expect(result.newPlayer.xp).toBe(player.xp + 25);  // pre_combat 50 + 25 = 75
  });
});

// ===========================================================================
// Defeat path
// ===========================================================================

describe("integration: defeat path", () => {
  it("enemy KOs the player -> handleDefeat fires, HP reset, XP forfeit, teleport target set", () => {
    // Setup: player at 1 HP, goblin alive. Player attacks (misses), then
    // goblin attacks and kills.
    const combat = makeCombatState([makeEnemy("g1")], {
      pre_combat_xp:      50,
    });
    const player = makePlayer({ health: 1, xp: 100 });  // gained 50 xp pre-defeat

    // Sequence:
    //   Player attack: d20 = 1 (0.0) -> fumble, no damage to goblin.
    //   Enemy turn:   d20 = 20 (0.95) -> crit, damage = max(1d6)=6 + d6(0.95->6) + 0 = 12. Player KO'd.
    const rng = seqRng([0.0, 0.95, 0.95]);

    const result = executePlayerAction({
      action:                  { action: "attack", target_instance_id: "g1" },
      state:                   combat,
      player,
      world_genre:             Genre.FANTASY,
      last_settlement_hub_id:  "oathwatch_crossing",
      rng,
    });

    expect(result.resolution?.kind).toBe("defeat");
    if (result.resolution?.kind !== "defeat") throw new Error("expected defeat");
    expect(result.resolution.teleport_to_node_id).toBe("oathwatch_crossing");
    // HP reset to 50% of max (15)
    expect(result.newPlayer.health).toBe(Math.floor(player.max_health * 0.5));
    // XP rolled back to pre_combat_xp
    expect(result.newPlayer.xp).toBe(50);
    // Currency 90% (gold for fantasy)
    expect(result.newPlayer.resources.gold).toBe(Math.floor(100 * 0.9));
  });
});

// ===========================================================================
// Flee success
// ===========================================================================

describe("integration: flee success", () => {
  it("rollback to previous node via navigation_trail", () => {
    const combat = makeCombatState([makeEnemy("g1")]);
    const player = makePlayer({ health: 5, xp: 75 });

    // d20 = 20 (0.95). Player AGI mod = +2. flee_roll = 22. dc = 10 + 1 = 11. Success.
    const rng = seqRng([0.95]);

    const result = executePlayerAction({
      action:           { action: "flee" },
      state:            combat,
      player,
      world_genre:      Genre.FANTASY,
      navigation_trail: ["origin_a", "origin_b", "the_thorned_cloister"],
      rng,
    });

    expect(result.resolution?.kind).toBe("flee_success");
    if (result.resolution?.kind !== "flee_success") throw new Error("expected flee");
    expect(result.resolution.teleport_to_node_id).toBe("origin_b");
    // No HP/XP/gold penalty.
    expect(result.newPlayer.health).toBe(5);
    expect(result.newPlayer.xp).toBe(75);
    expect(result.newPlayer.resources.gold).toBe(player.resources.gold);
  });

  it("falls back to origin_node_id when navigation_trail too short", () => {
    const combat = makeCombatState([makeEnemy("g1")], {
      origin_node_id: "fallback_origin",
    });
    const player = makePlayer({ health: 5 });
    const rng = seqRng([0.95]);

    const result = executePlayerAction({
      action:           { action: "flee" },
      state:            combat,
      player,
      world_genre:      Genre.FANTASY,
      navigation_trail: ["only_one"],
      rng,
    });

    expect(result.resolution?.kind).toBe("flee_success");
    if (result.resolution?.kind !== "flee_success") throw new Error("expected flee");
    expect(result.resolution.teleport_to_node_id).toBe("fallback_origin");
  });
});

// ===========================================================================
// Flee failure
// ===========================================================================

describe("integration: flee failure", () => {
  it("turn forfeit, enemies attack normally", () => {
    const combat = makeCombatState([makeEnemy("g1")]);
    const player = makePlayer();

    // Player flee roll: d20 = 1 (0.0). flee_roll = 1 + 2 = 3. dc = 10 + 1 = 11. Fail.
    // Enemy turn: d20 = 14 (0.65) -> hit, 1d6 = 4 (0.55) + 0 = 4 damage.
    const rng = seqRng([0.0, 0.65, 0.55]);

    const result = executePlayerAction({
      action:      { action: "flee" },
      state:       combat,
      player,
      world_genre: Genre.FANTASY,
      rng,
    });

    expect(result.resolution).toBeUndefined();
    expect(result.newState).toBeDefined();
    expect(result.newState?.active).toBe(true);
    // Player took damage from the enemy turn.
    expect(result.newPlayer.health).toBeLessThan(player.health);
    // Combat continues; turn_index back to PLAYER.
    expect(result.newState!.turn_order[result.newState!.current_turn_index]).toBe(PLAYER_ID);
  });
});

// ===========================================================================
// Defend
// ===========================================================================

describe("integration: defend halves incoming damage", () => {
  it("defended enemy attack deals at most half damage", () => {
    const combat = makeCombatState([makeEnemy("g1")]);
    const player = makePlayer({ health: 30 });

    // Player chooses defend.
    // Enemy turn: d20 = 14 (0.65) -> hit_total = 14 + 1 = 15. Player AGI base mod = 2,
    //   plus +2 defend bonus = 4 -> target_dc = 10 + 4 + 0 = 14. 15 >= 14 -> hit.
    //   d6 = 6 (0.95) + str_mod 0 = 6 base damage. Halved = 3.
    const rng = seqRng([0.65, 0.95]);

    const result = executePlayerAction({
      action:      { action: "defend" },
      state:       combat,
      player,
      world_genre: Genre.FANTASY,
      rng,
    });

    // Player should have taken halved damage.
    expect(result.newPlayer.health).toBeGreaterThan(player.health - 6);
    expect(result.newPlayer.health).toBeLessThanOrEqual(player.health - 1);
    // Defend buff cleared once back to player turn.
    expect(result.newState?.player_defending).toBe(false);
  });
});

// ===========================================================================
// rollEncounter -> executePlayerAction wiring
// ===========================================================================

describe("integration: rollEncounter -> executePlayerAction round trip", () => {
  it("fresh encounter resolves via the player action loop", () => {
    // Force a single goblin spawn. RNG sequence covers:
    //   spawn HP, encounter_id, initiative rolls (goblin + player), then
    //   the player's attack roll + damage roll.
    const rng = seqRng([
      0.0,   // hp_range[0] (lowest hp)
      0.5,   // encounter_id
      0.0,   // goblin initiative d20=1
      0.95,  // player initiative d20=20
      0.95,  // player attack d20=20 (crit)
      0.0,   // crit d6 -> 1
    ]);

    const enc = rollEncounter({
      node:          baseNode,
      world_bible:   undefined,
      region_bibles: undefined,
      genre:         Genre.FANTASY,
      current_xp:    0,
      rng,
      forceEnemyIds: ["fantasy_goblin"],
    });

    expect(enc.combatStarted).toBe(true);
    expect(enc.combat).toBeDefined();
    expect(enc.combat!.enemies.length).toBe(1);
    expect(enc.combat!.turn_order[0]).toBe(PLAYER_ID); // player won initiative

    const player = makePlayer();
    const result = executePlayerAction({
      action:      { action: "attack", target_instance_id: enc.combat!.enemies[0].instance_id },
      state:       enc.combat!,
      player,
      world_genre: Genre.FANTASY,
      rng,
    });

    // Goblin had hp_range[0]=6, but we forced HP roll to 0.0 -> 6.
    // Crit damage = max(1d8)=8 + d8(forced 1) + str_mod(2) = 11. Lethal.
    expect(result.resolution?.kind).toBe("victory");
  });
});
