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
  kickoffCombatIfEnemyFirst,
  advanceUntilPlayerTurnOrEnd,
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
    // V8.51 — calibrated for the new abilityMod formula
    // (floor((stat - 2) / 2)). STR 6 / AGI 6 both yield +2 modifiers,
    // matching the assertions in this file written under the legacy
    // D&D formula (STR 14 also gave +2). The other stats stay at the
    // 2-10 ceiling — they don't feed combat math.
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
    ],
    level: 1,
    xp:    50,
    // P6 — ability fields are required on PlayerState; populated by P7.
    learned_abilities:      [],
    equipped_ability_slots: [null, null, null, null],
    passive_ability:        null,
    // P8 — perks default empty for tests.
    perks:                  [],
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
    // Prompt 1 — HP reset to 75% of max (was 50%). 30 * 0.75 = 22.
    expect(result.newPlayer.health).toBe(Math.floor(player.max_health * 0.75));
    // XP rolled back to pre_combat_xp
    expect(result.newPlayer.xp).toBe(50);
    // Prompt 1 — currency loss = min(50, 10% of current). 100 gold →
    // 10 loss → 90 remaining (same as old 90% formula at this scale).
    expect(result.newPlayer.resources.gold).toBe(90);
  });

  // ── Day 20.4 TASK 4 — fallback chain ──────────────────────────────────
  it("falls back to defeat_fallback_node_id when last_settlement_hub_id is missing", () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const combat = makeCombatState([makeEnemy("g1")], { pre_combat_xp: 0 });
      const player = makePlayer({ health: 1 });
      // Force enemy crit to KO player.
      const rng = seqRng([0.0, 0.95, 0.95]);

      const result = executePlayerAction({
        action:                   { action: "attack", target_instance_id: "g1" },
        state:                    combat,
        player,
        world_genre:              Genre.FANTASY,
        // No last_settlement_hub_id → must fall back.
        defeat_fallback_node_id:  "starting_region_settlement",
        rng,
      });

      expect(result.resolution?.kind).toBe("defeat");
      if (result.resolution?.kind !== "defeat") throw new Error("expected defeat");
      expect(result.resolution.teleport_to_node_id).toBe("starting_region_settlement");
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("last_settlement_hub_id missing"),
        "starting_region_settlement"
      );
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("falls back to encounter origin when both settlement ids missing (defensive)", () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const combat = makeCombatState([makeEnemy("g1")], {
        pre_combat_xp:    0,
        origin_node_id:   "encounter_origin_node",
      });
      const player = makePlayer({ health: 1 });
      const rng = seqRng([0.0, 0.95, 0.95]);

      const result = executePlayerAction({
        action:      { action: "attack", target_instance_id: "g1" },
        state:       combat,
        player,
        world_genre: Genre.FANTASY,
        rng,
      });

      expect(result.resolution?.kind).toBe("defeat");
      if (result.resolution?.kind !== "defeat") throw new Error("expected defeat");
      expect(result.resolution.teleport_to_node_id).toBe("encounter_origin_node");
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("both last_settlement_hub_id and defeat_fallback_node_id missing"),
        "encounter_origin_node"
      );
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("populates destination metadata on defeat events when world_graph_nodes supplied", () => {
    const combat = makeCombatState([makeEnemy("g1")], { pre_combat_xp: 0 });
    const player = makePlayer({ health: 1 });
    const rng = seqRng([0.0, 0.95, 0.95]);

    // Build a tiny graph: settlement node + a region zone above it.
    const world_graph_nodes = {
      oathwatch_crossing: {
        id:                 "oathwatch_crossing",
        name:               "Oathwatch Crossing",
        type:               "zone" as const,
        zone_id:            "the_rust_valley",
        is_expandable:      false,
        connections:        [],
        npc_ids:            [],
        item_ids:           [],
        asset_id:           "location_oathwatch_crossing",
        discovered:         true,
        map_position:       { x: 0, y: 0 },
        is_settlement_node: true,
      },
      the_rust_valley: {
        id:                 "the_rust_valley",
        name:               "The Rust Valley",
        type:               "zone" as const,
        zone_id:            "the_rust_valley",
        is_expandable:      true,
        connections:        ["oathwatch_crossing"],
        npc_ids:            [],
        item_ids:           [],
        asset_id:           "location_the_rust_valley",
        discovered:         true,
        map_position:       { x: 0, y: 0 },
      },
    };

    const result = executePlayerAction({
      action:                  { action: "attack", target_instance_id: "g1" },
      state:                   combat,
      player,
      world_genre:             Genre.FANTASY,
      last_settlement_hub_id:  "oathwatch_crossing",
      world_graph_nodes,
      rng,
    });

    if (result.resolution?.kind !== "defeat") throw new Error("expected defeat");
    const defeatEvent = result.events.find((e) => e.type === "defeat");
    expect(defeatEvent?.destination).toEqual({
      node_id:     "oathwatch_crossing",
      node_name:   "Oathwatch Crossing",
      region_id:   "the_rust_valley",
      region_name: "The Rust Valley",
    });
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
// Day 20.1 TASK 3 — turn-boundary phase events
// ===========================================================================

describe("phase events: enemy_phase_start + player_turn_start (Day 20.1)", () => {
  it("emits enemy_phase_start after a player action when enemies remain", () => {
    // 1 goblin, full HP. Player attacks but doesn't kill.
    // Player rolls d20=14 (hit), d8=1 → damage 3 (str_mod 2). Goblin
    // hp 8 → 5. Survives. Loop should advance into enemy phase.
    const combat = makeCombatState([
      makeEnemy("g1", { current_hp: 8, max_hp: 8 }),
    ]);
    const player = makePlayer();
    // Sequence: player attack d20+dmg, then enemy attack.
    const rng = seqRng([0.65, 0.0, 0.5, 0.5]);

    const result = executePlayerAction({
      action:      { action: "attack", target_instance_id: "g1" },
      state:       combat,
      player,
      world_genre: Genre.FANTASY,
      rng,
    });

    const types = result.events.map((e) => e.type);
    expect(types).toContain("enemy_phase_start");
  });

  it("emits player_turn_start after enemy phase when control returns to player", () => {
    const combat = makeCombatState([
      makeEnemy("g1", { current_hp: 8, max_hp: 8 }),
    ]);
    const player = makePlayer();
    const rng = seqRng([0.65, 0.0, 0.5, 0.5]);

    const result = executePlayerAction({
      action:      { action: "attack", target_instance_id: "g1" },
      state:       combat,
      player,
      world_genre: Genre.FANTASY,
      rng,
    });

    const types = result.events.map((e) => e.type);
    expect(types).toContain("player_turn_start");
    // Order: enemy_phase_start must precede player_turn_start.
    const enemyIdx  = types.indexOf("enemy_phase_start");
    const playerIdx = types.indexOf("player_turn_start");
    expect(enemyIdx).toBeGreaterThanOrEqual(0);
    expect(playerIdx).toBeGreaterThan(enemyIdx);
  });

  it("does NOT emit phase events on victory (combat ends — no next phase)", () => {
    // Goblin has 1 HP — single attack kills it.
    const combat = makeCombatState([
      makeEnemy("g1", { current_hp: 1, max_hp: 1 }),
    ]);
    const player = makePlayer();
    // Crit: d20=20, then crit's bonus die (1d8 max + 1d8 + str = 8+8+2 = 18)
    const rng = seqRng([0.95, 0.95]);

    const result = executePlayerAction({
      action:      { action: "attack", target_instance_id: "g1" },
      state:       combat,
      player,
      world_genre: Genre.FANTASY,
      rng,
    });

    expect(result.resolution?.kind).toBe("victory");
    const types = result.events.map((e) => e.type);
    expect(types).not.toContain("enemy_phase_start");
    expect(types).not.toContain("player_turn_start");
  });

  it("does NOT emit phase events on defeat (combat ends in enemy phase)", () => {
    const combat = makeCombatState([makeEnemy("g1")]);
    const player = makePlayer({ health: 1, xp: 100 });
    // Player fumble, then enemy crit lethal.
    const rng = seqRng([0.0, 0.95, 0.95]);

    const result = executePlayerAction({
      action:                 { action: "attack", target_instance_id: "g1" },
      state:                  combat,
      player,
      world_genre:            Genre.FANTASY,
      last_settlement_hub_id: "settlement",
      rng,
    });

    expect(result.resolution?.kind).toBe("defeat");
    const types = result.events.map((e) => e.type);
    // enemy_phase_start fires before the enemy turn that kills the
    // player — that's correct (the phase did happen). But
    // player_turn_start MUST NOT appear: control never returned to
    // the player.
    expect(types).not.toContain("player_turn_start");
  });

  it("does NOT emit phase events on successful flee (combat ends mid-action)", () => {
    const combat = makeCombatState([makeEnemy("g1")]);
    const player = makePlayer();
    // d20 = 20 (0.95). Player AGI mod = +2. flee_roll = 22. dc = 11. Success.
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
    const types = result.events.map((e) => e.type);
    expect(types).not.toContain("enemy_phase_start");
    expect(types).not.toContain("player_turn_start");
  });
});

// ===========================================================================
// Day 20.2 TASK 1 — kickoffCombatIfEnemyFirst (enemy-wins-initiative fix)
// ===========================================================================

describe("kickoffCombatIfEnemyFirst (Day 20.2 TASK 1)", () => {
  it("no-op when player has initiative — empty events, state unchanged", () => {
    const combat = makeCombatState([makeEnemy("g1")]);
    // Default makeCombatState seeds turn_order = [PLAYER, g1].
    expect(combat.turn_order[0]).toBe(PLAYER_ID);
    const player = makePlayer();

    const result = kickoffCombatIfEnemyFirst({
      state:       combat,
      player,
      world_genre: Genre.FANTASY,
    });

    expect(result.events).toEqual([]);
    expect(result.newState).toBe(combat); // referential — no clone on no-op
    expect(result.newPlayer).toBe(player);
    expect(result.resolution).toBeUndefined();
  });

  it("runs the enemy phase and returns control to the player", () => {
    // Enemy at index 0 — kickoff should drive it through and leave
    // current_turn_index pointing at PLAYER.
    const combat = makeCombatState(
      [makeEnemy("g1")],
      { turn_order: ["g1", PLAYER_ID], current_turn_index: 0 }
    );
    const player = makePlayer();
    // Enemy attack: d20 = 14 (0.65, hits) + d6 = 4 (0.55) + str_mod 0 = 4 dmg.
    const rng = seqRng([0.65, 0.55]);

    const result = kickoffCombatIfEnemyFirst({
      state:       combat,
      player,
      world_genre: Genre.FANTASY,
      rng,
    });

    expect(result.resolution).toBeUndefined();
    expect(result.newState).toBeDefined();
    // Control should be back at the player's slot.
    expect(
      result.newState!.turn_order[result.newState!.current_turn_index]
    ).toBe(PLAYER_ID);
    // Player took a hit.
    expect(result.newPlayer.health).toBeLessThan(player.health);
  });

  it("emits enemy_phase_start, at least one enemy_attack, and player_turn_start", () => {
    const combat = makeCombatState(
      [makeEnemy("g1")],
      { turn_order: ["g1", PLAYER_ID], current_turn_index: 0 }
    );
    const player = makePlayer();
    const rng = seqRng([0.65, 0.55]);

    const result = kickoffCombatIfEnemyFirst({
      state:       combat,
      player,
      world_genre: Genre.FANTASY,
      rng,
    });

    const types = result.events.map((e) => e.type);
    expect(types[0]).toBe("enemy_phase_start");
    expect(types).toContain("enemy_attack");
    expect(types[types.length - 1]).toBe("player_turn_start");
  });

  it("propagates defeat resolution when the enemy KOs the player on kickoff", () => {
    const combat = makeCombatState(
      [makeEnemy("g1")],
      { turn_order: ["g1", PLAYER_ID], current_turn_index: 0 }
    );
    const player = makePlayer({ health: 1 });
    // Enemy crit on nat 20 → 6 + d6(forced 6) + 0 = 12 dmg, lethal.
    const rng = seqRng([0.95, 0.95]);

    const result = kickoffCombatIfEnemyFirst({
      state:                  combat,
      player,
      world_genre:            Genre.FANTASY,
      last_settlement_hub_id: "settlement",
      rng,
    });

    expect(result.resolution?.kind).toBe("defeat");
    expect(result.newState).toBeUndefined();
    // Defeat from kickoff path still emits enemy_phase_start as the
    // first event — the phase did start, even if it ended in defeat.
    const types = result.events.map((e) => e.type);
    expect(types[0]).toBe("enemy_phase_start");
    // No player_turn_start — combat won't return to the player.
    expect(types).not.toContain("player_turn_start");
  });

  it("multi-enemy turn order resolves in order on kickoff", () => {
    const combat = makeCombatState(
      [makeEnemy("g1"), makeEnemy("g2", { instance_id: "g2" })],
      { turn_order: ["g1", "g2", PLAYER_ID], current_turn_index: 0 }
    );
    const player = makePlayer();
    // Two enemy attacks, both miss for clean test.
    // d20 = 5 (0.20, miss). Each enemy emits one enemy_attack event.
    const rng = seqRng([0.20, 0.20]);

    const result = kickoffCombatIfEnemyFirst({
      state:       combat,
      player,
      world_genre: Genre.FANTASY,
      rng,
    });

    const enemyAttacks = result.events.filter((e) => e.type === "enemy_attack");
    expect(enemyAttacks.length).toBe(2);
    expect(enemyAttacks[0].actor).toBe("g1");
    expect(enemyAttacks[1].actor).toBe("g2");
    // Control returned to player.
    expect(
      result.newState!.turn_order[result.newState!.current_turn_index]
    ).toBe(PLAYER_ID);
  });
});

// ===========================================================================
// Day 20.2 TASK 1 — advanceUntilPlayerTurnOrEnd (extracted helper)
// ===========================================================================

describe("advanceUntilPlayerTurnOrEnd (Day 20.2 TASK 1 refactor)", () => {
  it("returns immediately when already at player's turn", () => {
    const combat = makeCombatState([makeEnemy("g1")]);
    expect(combat.turn_order[combat.current_turn_index]).toBe(PLAYER_ID);
    const player = makePlayer();

    const result = advanceUntilPlayerTurnOrEnd({
      state:       combat,
      player,
      world_genre: Genre.FANTASY,
    });

    expect(result.events).toEqual([]);
    expect(result.newPlayer).toBe(player);
    expect(result.resolution).toBeUndefined();
  });

  it("clears player_defending when control returns to the player", () => {
    const combat = makeCombatState(
      [makeEnemy("g1")],
      {
        turn_order:         ["g1", PLAYER_ID],
        current_turn_index: 0,
        player_defending:   true,
      }
    );
    const player = makePlayer();
    // Enemy hits (halved by defend buff).
    const rng = seqRng([0.65, 0.55]);

    const result = advanceUntilPlayerTurnOrEnd({
      state:       combat,
      player,
      world_genre: Genre.FANTASY,
      rng,
    });

    expect(result.newState!.player_defending).toBe(false);
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
