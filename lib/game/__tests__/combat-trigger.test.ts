import { Genre } from "@/types/game";
import type {
  CombatState,
  Enemy,
  RegionBible,
  WorldBible,
  WorldNode,
} from "@/types/game";
import {
  shouldRollEncounter,
  resolveEnemyLookup,
  rollEncounter,
  type RollEncounterResult,
} from "../combat-engine";
import { renderRoutineCombatEvent } from "../combat-narration/templates";

function seqRng(values: number[]): () => number {
  let i = 0;
  return () => {
    const v = values[i % values.length];
    i += 1;
    return v;
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
  encounter_chance:  0.5,
  encounter_roster:  ["fantasy_goblin"],
  is_boss_room:      false,
};

const fakeEnemy: Enemy = {
  id:              "themed_wraith",
  name:            "Themed Wraith",
  description:     "A test wraith.",
  hp_range:        [10, 14],
  agi_mod:         1,
  str_mod:         2,
  damage_die:      "1d8",
  armor_bonus:     1,
  xp_value:        50,
  loot_table_id:   "themed_wraith_loot",
  is_boss:         false,
  behavior_flavor: "implacable melee",
};

// ─────────────────────────────────────────────────────────────────────────────
// shouldRollEncounter
// ─────────────────────────────────────────────────────────────────────────────

describe("shouldRollEncounter", () => {
  it("true when chance > 0 and roster non-empty", () => {
    expect(shouldRollEncounter(baseNode)).toBe(true);
  });

  it("false when chance is 0", () => {
    expect(shouldRollEncounter({ ...baseNode, encounter_chance: 0 })).toBe(false);
  });

  it("false when chance is undefined", () => {
    expect(shouldRollEncounter({ ...baseNode, encounter_chance: undefined })).toBe(false);
  });

  it("false when roster is empty", () => {
    expect(shouldRollEncounter({ ...baseNode, encounter_roster: [] })).toBe(false);
  });

  it("false when roster is undefined", () => {
    expect(shouldRollEncounter({ ...baseNode, encounter_roster: undefined })).toBe(false);
  });

  it("false when combat is already active", () => {
    const active: CombatState = {
      active:             true,
      encounter_id:       "x",
      enemies:            [],
      turn_order:         ["PLAYER"],
      current_turn_index: 0,
      round_number:       1,
      player_defending:   false,
      combat_log:         [],
      origin_node_id:     "elsewhere",
      pre_combat_xp:      0,
    };
    expect(shouldRollEncounter(baseNode, active)).toBe(false);
  });

  it("false on undefined node (defensive)", () => {
    expect(shouldRollEncounter(undefined)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// resolveEnemyLookup
// ─────────────────────────────────────────────────────────────────────────────

describe("resolveEnemyLookup", () => {
  it("finds bestiary enemies first (genre lookup)", () => {
    const found = resolveEnemyLookup(
      "fantasy_goblin",
      baseNode,
      undefined,
      undefined,
      Genre.FANTASY
    );
    expect(found?.name).toBe("Goblin");
  });

  it("finds region-specific enemies via region_bibles", () => {
    const rb: RegionBible = {
      id:          "the_rustveil_commons",
      name:        "The Rustveil Commons",
      type:        "wilderness",
      grid_centre: { x: 0, y: 0 },
      grid_radius: 3,
      atmosphere:  "test",
      locations:   [],
      npcs:        [],
      exits:       [],
      enemies:     [fakeEnemy],
    };
    const found = resolveEnemyLookup(
      "themed_wraith",
      baseNode,
      undefined,
      { the_rustveil_commons: rb },
      Genre.FANTASY
    );
    expect(found?.name).toBe("Themed Wraith");
  });

  it("finds enemies in WorldBible.starting_region.enemies", () => {
    const wb: WorldBible = {
      starting_region: {
        id:          "the_rustveil_commons",
        name:        "The Rustveil Commons",
        type:        "wilderness",
        grid_centre: { x: 0, y: 0 },
        grid_radius: 3,
        atmosphere:  "x",
        locations:   [],
        npcs:        [],
        exits:       [],
        enemies:     [fakeEnemy],
      },
      adjacent_regions: [],
      main_quest:       {} as WorldBible["main_quest"],
      generated_at:     "2026-01-01T00:00:00.000Z",
    };
    const found = resolveEnemyLookup(
      "themed_wraith",
      { ...baseNode, zone_id: "different_region" },
      wb,
      undefined,
      Genre.FANTASY
    );
    expect(found?.name).toBe("Themed Wraith");
  });

  it("returns null when id is unresolvable", () => {
    const found = resolveEnemyLookup(
      "fantasy_does_not_exist",
      baseNode,
      undefined,
      undefined,
      Genre.FANTASY
    );
    expect(found).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// rollEncounter
// ─────────────────────────────────────────────────────────────────────────────

describe("rollEncounter", () => {
  it("respects encounter_chance — high chance, low roll → encounter", () => {
    // chance = 0.7, rng = 0.5 → 0.5 <= 0.7 → trigger.
    // Then count distribution roll = 0.0 → count 1.
    // Then roster pick = 0.0 → goblin.
    // Then HP roll = 0.0 → hp_range[0].
    // Then encounter_id rng = 0.5 (used in encounter_id).
    // Then initiative rolls.
    const rng = seqRng([0.5, 0.0, 0.0, 0.0, 0.5, 0.5, 0.5]);
    const result: RollEncounterResult = rollEncounter({
      node:          { ...baseNode, encounter_chance: 0.7 },
      world_bible:   undefined,
      region_bibles: undefined,
      genre:         Genre.FANTASY,
      current_xp:    0,
      rng,
    });
    expect(result.combatStarted).toBe(true);
    expect(result.combat?.enemies.length ?? 0).toBeGreaterThan(0);
    expect(result.enemyNames).toEqual(["Goblin"]);
  });

  it("respects encounter_chance — low chance, high roll → no encounter", () => {
    // chance = 0.4, rng = 0.5 → 0.5 > 0.4 → no trigger.
    const rng = seqRng([0.5]);
    const result = rollEncounter({
      node:          { ...baseNode, encounter_chance: 0.4 },
      world_bible:   undefined,
      region_bibles: undefined,
      genre:         Genre.FANTASY,
      current_xp:    0,
      rng,
    });
    expect(result.combatStarted).toBe(false);
  });

  it("forced spawn (forceEnemyIds) bypasses encounter_chance", () => {
    // chance = 0.0, but forceEnemyIds set → trigger anyway.
    const rng = seqRng([0.5, 0.5, 0.5, 0.5, 0.5]);
    const result = rollEncounter({
      node:          { ...baseNode, encounter_chance: 0.0 },
      world_bible:   undefined,
      region_bibles: undefined,
      genre:         Genre.FANTASY,
      current_xp:    0,
      rng,
      forceEnemyIds: ["fantasy_goblin", "fantasy_skeleton"],
    });
    expect(result.combatStarted).toBe(true);
    expect(result.enemyNames).toEqual(["Goblin", "Skeleton"]);
  });

  it("boss room spawns the entire roster", () => {
    const rng = seqRng([0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5]);
    const result = rollEncounter({
      node: {
        ...baseNode,
        encounter_chance: 1.0,
        is_boss_room:     true,
        encounter_roster: ["fantasy_skeleton", "fantasy_skeleton", "fantasy_orc"],
      },
      world_bible:   undefined,
      region_bibles: undefined,
      genre:         Genre.FANTASY,
      current_xp:    0,
      rng,
    });
    expect(result.combatStarted).toBe(true);
    expect(result.combat?.enemies.length).toBe(3);
  });

  it("regular encounters pick a weighted count from the roster", () => {
    // count distribution rng=0.0 → 1 enemy
    const rng = seqRng([0.0, 0.0, 0.0, 0.0, 0.5, 0.5, 0.5, 0.5]);
    const result = rollEncounter({
      node: {
        ...baseNode,
        encounter_chance: 1.0,
        encounter_roster: ["fantasy_goblin", "fantasy_skeleton"],
      },
      world_bible:   undefined,
      region_bibles: undefined,
      genre:         Genre.FANTASY,
      current_xp:    0,
      rng,
    });
    expect(result.combat?.enemies.length).toBe(1);
  });

  it("logs a warning + skips when an enemy id is unresolvable", () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    try {
      // Forced roster with one bad id and one good one.
      const rng = seqRng([0.5, 0.5, 0.5, 0.5, 0.5]);
      const result = rollEncounter({
        node:          baseNode,
        world_bible:   undefined,
        region_bibles: undefined,
        genre:         Genre.FANTASY,
        current_xp:    0,
        rng,
        forceEnemyIds: ["fantasy_goblin", "fantasy_does_not_exist"],
      });
      expect(result.combatStarted).toBe(true);
      // Goblin spawned, the bogus id was skipped with a warning.
      expect(result.combat?.enemies.length).toBe(1);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Cannot resolve enemy id")
      );
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("returns combatStarted=false when ALL roster ids are unresolvable", () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const rng = seqRng([0.5, 0.5, 0.5]);
      const result = rollEncounter({
        node:          baseNode,
        world_bible:   undefined,
        region_bibles: undefined,
        genre:         Genre.FANTASY,
        current_xp:    0,
        rng,
        forceEnemyIds: ["bogus_a", "bogus_b"],
      });
      expect(result.combatStarted).toBe(false);
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("populates origin_node_id and pre_combat_xp on the CombatState", () => {
    const rng = seqRng([0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5]);
    const result = rollEncounter({
      node:          baseNode,
      world_bible:   undefined,
      region_bibles: undefined,
      genre:         Genre.FANTASY,
      current_xp:    420,
      rng,
      forceEnemyIds: ["fantasy_goblin"],
    });
    expect(result.combat?.origin_node_id).toBe(baseNode.id);
    expect(result.combat?.pre_combat_xp).toBe(420);
  });

  it("emits a combat_start event in the combat_log", () => {
    const rng = seqRng([0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5]);
    const result = rollEncounter({
      node:          baseNode,
      world_bible:   undefined,
      region_bibles: undefined,
      genre:         Genre.FANTASY,
      current_xp:    0,
      rng,
      forceEnemyIds: ["fantasy_goblin"],
    });
    expect(result.combat?.combat_log[0].type).toBe("combat_start");
  });

  // HF1 FIX 2 — the combat_start event must produce a visible,
  // non-empty story-feed line naming the enemies. useGameLoop (step
  // 7c-3) and useDungeonRuntime (navigateToRoom) both pull the
  // combat_start event out of combat_log and run it through
  // renderRoutineCombatEvent; this pins that data path end-to-end.
  it("HF1 FIX 2 — combat_start renders a non-empty banner naming the enemies", () => {
    const rng = seqRng([0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5]);
    const result = rollEncounter({
      node:          baseNode,
      world_bible:   undefined,
      region_bibles: undefined,
      genre:         Genre.FANTASY,
      current_xp:    0,
      rng,
      forceEnemyIds: ["fantasy_goblin", "fantasy_skeleton"],
    });
    const startEvent = result.combat!.combat_log.find(
      (e) => e.type === "combat_start"
    );
    expect(startEvent).toBeDefined();

    const banner = renderRoutineCombatEvent(startEvent!, {
      enemyNames:   result.combat!.enemies.map((e) => e.name),
      locationName: baseNode.name,
    });
    expect(banner).not.toBeNull();
    expect(banner!.primary.trim().length).toBeGreaterThan(0);
    // Names of the spawned enemies appear in the feed line.
    expect(banner!.primary).toContain("Goblin");
    expect(banner!.primary).toContain("Skeleton");
    expect(banner!.primary).toContain(baseNode.name);
  });
});
