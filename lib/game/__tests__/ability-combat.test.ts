// P7 — ability system integration tests.
//
// Exercises the data layer + combat-engine ability resolution. Class
// assignment seeding lives in /api/game/new (covered by the unit
// helpers below); combat ability dispatch is exercised end-to-end
// against executePlayerAction.

import {
  ABILITY_LIBRARY,
  computeMaxCharges,
  drawStartingLearnedPool,
  getPassiveForClass,
  getSlotAbilitiesForClass,
  getSlotCandidatesForLevelUp,
  remainingCharges,
} from "@/lib/game/abilities";
import {
  PLAYER_ID,
  executePlayerAction,
} from "@/lib/game/combat-engine";
import { ItemType, ItemRarity } from "@/types/game";
import type {
  Attributes, AbilityId, CombatEnemyInstance, CombatState, PlayerState,
} from "@/types/game";

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

function makePlayer(overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    name:        "TestHero",
    background:  "knight",
    health:      30,
    max_health:  30,
    resources:   { gold: 0 },
    attributes:  { strength: 6, agility: 6, charisma: 2, intelligence: 2, perception: 2 },
    inventory:   [],
    level:       1,
    xp:          0,
    learned_abilities:      [],
    equipped_ability_slots: [null, null, null, null],
    passive_ability:        null,
    ...overrides,
  };
}

function makeEnemy(overrides: Partial<CombatEnemyInstance> = {}): CombatEnemyInstance {
  return {
    instance_id:     "g_1",
    enemy_id:        "goblin",
    name:            "Goblin",
    description:     "Test goblin.",
    current_hp:      20,
    max_hp:          20,
    agi_mod:         0,
    str_mod:         0,
    damage_die:      "1d6",
    armor_bonus:     0,
    xp_value:        25,
    loot_table_id:   "fantasy_loot_basic",
    is_boss:         false,
    behavior_flavor: "skirmisher",
    alive:           true,
    status_effects:  [],
    ...overrides,
  };
}

function makeCombat(enemies: CombatEnemyInstance[], overrides: Partial<CombatState> = {}): CombatState {
  return {
    active:             true,
    encounter_id:       "enc_test",
    enemies,
    turn_order:         [PLAYER_ID, ...enemies.map((e) => e.instance_id)],
    current_turn_index: 0,
    round_number:       1,
    player_defending:   false,
    combat_log:         [],
    origin_node_id:     "node_a",
    pre_combat_xp:      0,
    player_status_effects: [],
    ...overrides,
  };
}

// Deterministic RNG cycler for predictable rolls. mid (~0.5) keeps damage
// dice mid-range and status-application rolls firing past 0.5 thresholds.
function makeRng(values: number[]): () => number {
  let i = 0;
  return () => {
    const v = values[i % values.length];
    i += 1;
    return v;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Class assignment seeds slot 1 + passive correctly (Knight)
// ─────────────────────────────────────────────────────────────────────────────

describe("class ability seeding (Knight)", () => {
  it("getPassiveForClass returns Iron Resolve for Knight", () => {
    const p = getPassiveForClass("knight");
    expect(p?.id).toBe("knight_iron_resolve");
    expect(p?.is_passive).toBe(true);
  });

  it("getSlotAbilitiesForClass slot 1 returns exactly Shield Bash", () => {
    const slot1 = getSlotAbilitiesForClass("knight", 1);
    expect(slot1.length).toBe(1);
    expect(slot1[0].id).toBe("knight_shield_bash");
    expect(slot1[0].slot_position).toBe(1);
  });

  it("drawStartingLearnedPool returns the 3 non-slot-1 slot abilities", () => {
    const drawn = drawStartingLearnedPool("knight");
    expect(drawn.length).toBe(3);
    expect(drawn).toEqual(expect.arrayContaining([
      "knight_war_cry",
      "knight_battle_mend",
      "knight_iron_stance",
    ]));
  });

  it("library entry carries effects on slot abilities", () => {
    expect(ABILITY_LIBRARY.knight_shield_bash.effects).toBeDefined();
    expect(ABILITY_LIBRARY.knight_shield_bash.effects?.damage_die).toBe("1d6");
    expect(ABILITY_LIBRARY.knight_shield_bash.effects?.damage_stat).toBe("str");
  });

  it("library entries do NOT carry effects on passives", () => {
    expect(ABILITY_LIBRARY.knight_iron_resolve.effects).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. computeMaxCharges — base + charge_stat + slot-1 level-5 bonus
// ─────────────────────────────────────────────────────────────────────────────

describe("computeMaxCharges", () => {
  const baseAttrs: Attributes = {
    strength: 2, agility: 2, intelligence: 2, perception: 2, charisma: 2,
  };

  it("base case: no charge_stat → exactly base_charges (2)", () => {
    // Cobble a passive (no charge_stat) — base_charges still 2.
    const passive = ABILITY_LIBRARY.knight_iron_resolve;
    expect(computeMaxCharges(passive, /* level */ 1, baseAttrs)).toBe(2);
  });

  it("with charge_stat: base + floor(stat/2)", () => {
    // Shield Bash charge_stat=str. STR 6 → floor(6/2)=3 → base 2 + 3 = 5.
    // At level 1 (no slot-1 bonus): 5 charges.
    const ability = ABILITY_LIBRARY.knight_shield_bash;
    const attrs   = { ...baseAttrs, strength: 6 };
    expect(computeMaxCharges(ability, /* level */ 1, attrs)).toBe(5);
  });

  it("slot-1 bonus: +1 charge at level ≥ 5", () => {
    const ability = ABILITY_LIBRARY.knight_shield_bash;
    const attrs   = { ...baseAttrs, strength: 6 };
    // At level 5 with STR 6: base 2 + 3 + 1 (slot-1 bonus) = 6.
    expect(computeMaxCharges(ability, /* level */ 5, attrs)).toBe(6);
    expect(computeMaxCharges(ability, /* level */ 4, attrs)).toBe(5);
  });

  it("slot-1 bonus does NOT apply to slot-2/3/4 abilities", () => {
    // War Cry is slot 2. STR 6 at level 10 → base 2 + 3, no slot-1 bonus.
    const ability = ABILITY_LIBRARY.knight_war_cry;
    const attrs   = { ...baseAttrs, strength: 6 };
    expect(computeMaxCharges(ability, /* level */ 10, attrs)).toBe(5);
  });

  it("remainingCharges subtracts uses, floors at 0", () => {
    const ability = ABILITY_LIBRARY.knight_shield_bash;
    const attrs   = { ...baseAttrs, strength: 6 };
    expect(remainingCharges(ability, 1, attrs, /* used */ 0)).toBe(5);
    expect(remainingCharges(ability, 1, attrs, /* used */ 4)).toBe(1);
    expect(remainingCharges(ability, 1, attrs, /* used */ 5)).toBe(0);
    expect(remainingCharges(ability, 1, attrs, /* used */ 99)).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Ability action — damage reduces target HP
// ─────────────────────────────────────────────────────────────────────────────

describe("executePlayerAction — ability damage", () => {
  it("a damage ability rolls damage and reduces target HP", () => {
    const player = makePlayer({
      equipped_ability_slots: ["knight_shield_bash", null, null, null],
      learned_abilities:      ["knight_shield_bash"],
    });
    const enemy  = makeEnemy({ current_hp: 20, max_hp: 20 });
    const state  = makeCombat([enemy]);
    // 1d6 roll → mid; status application roll → high (above 0.8, so no apply).
    const rng    = makeRng([0.5, 0.99]);

    const result = executePlayerAction({
      action:      { action: "ability", ability_id: "knight_shield_bash", target_instance_id: enemy.instance_id },
      state,
      player,
      world_genre: "fantasy",
      rng,
    });

    const ability_used = result.events.find((e) => e.type === "ability_used");
    expect(ability_used).toBeDefined();
    expect(ability_used?.damage_dealt).toBeGreaterThan(0);

    const newEnemyHp = result.newState?.enemies[0].current_hp ?? -1;
    expect(newEnemyHp).toBeLessThan(20);
    // Engine clamps damage to ≥ 1 even on a poor roll; STR 6 → +2 mod, so
    // minimum damage = max(1, 0d6 + 2) = at least 3 in our setup.
    expect(20 - newEnemyHp).toBe(ability_used?.damage_dealt);
  });

  it("deducts one charge from the combat state on use", () => {
    const player = makePlayer({
      equipped_ability_slots: ["knight_shield_bash", null, null, null],
      learned_abilities:      ["knight_shield_bash"],
    });
    const enemy  = makeEnemy({ current_hp: 100 });
    const state  = makeCombat([enemy]);

    const result = executePlayerAction({
      action: { action: "ability", ability_id: "knight_shield_bash", target_instance_id: enemy.instance_id },
      state, player, world_genre: "fantasy", rng: makeRng([0.5, 0.99]),
    });

    // After use, ability_charges_used.knight_shield_bash === 1.
    // (newState may be undefined on resolution; here combat continues
    // because the enemy survives.)
    expect(result.newState?.ability_charges_used?.knight_shield_bash).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Ability action — heal capped at max_health
// ─────────────────────────────────────────────────────────────────────────────

describe("executePlayerAction — ability heal", () => {
  it("heal restores HP up to max_health, never above", () => {
    // Knight Battle Mend = heal 20 + FORTIFY self. Equip + use.
    const player = makePlayer({
      health:                10,
      max_health:            25,   // ceiling — heal would push to 30 uncapped
      equipped_ability_slots: ["knight_battle_mend", null, null, null],
      learned_abilities:      ["knight_battle_mend"],
    });
    const enemy = makeEnemy();
    const state = makeCombat([enemy]);

    const result = executePlayerAction({
      action: { action: "ability", ability_id: "knight_battle_mend" },
      state, player, world_genre: "fantasy", rng: makeRng([0.5]),
    });

    expect(result.newPlayer.health).toBe(25);
    expect(result.newPlayer.health).toBeLessThanOrEqual(result.newPlayer.max_health);

    const ability_used = result.events.find((e) => e.type === "ability_used");
    // Heal events carry negative damage_dealt by engine convention.
    expect(ability_used?.damage_dealt).toBe(-15);   // 25 − 10 = 15 actual heal
  });

  it("self-buff statuses land in player_status_effects (FORTIFIED from Battle Mend)", () => {
    const player = makePlayer({
      health:                25,
      max_health:            25,
      equipped_ability_slots: ["knight_battle_mend", null, null, null],
      learned_abilities:      ["knight_battle_mend"],
    });
    const state = makeCombat([makeEnemy()]);

    const result = executePlayerAction({
      action: { action: "ability", ability_id: "knight_battle_mend" },
      state, player, world_genre: "fantasy", rng: makeRng([0.5]),
    });

    const effects = result.newState?.player_status_effects ?? [];
    expect(effects.map((e) => e.id)).toContain("fortified");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. ability_no_charges — no turn advance, no state change beyond the event
// ─────────────────────────────────────────────────────────────────────────────

describe("executePlayerAction — no charges", () => {
  it("emits ability_no_charges and does NOT advance the turn", () => {
    // Pre-set used charges to exceed max — STR 6 + base 2 + slot1 bonus = 6
    // at level 5, so 99 forces remaining to 0.
    const player = makePlayer({
      level:                  5,
      equipped_ability_slots: ["knight_shield_bash", null, null, null],
      learned_abilities:      ["knight_shield_bash"],
    });
    const enemy = makeEnemy();
    const state = makeCombat([enemy], {
      ability_charges_used: { knight_shield_bash: 99 },
    });

    const result = executePlayerAction({
      action: { action: "ability", ability_id: "knight_shield_bash", target_instance_id: enemy.instance_id },
      state, player, world_genre: "fantasy", rng: makeRng([0.5]),
    });

    const noCharges = result.events.find((e) => e.type === "ability_no_charges");
    expect(noCharges).toBeDefined();

    // Turn pointer untouched — combat still on the player.
    expect(result.newState?.current_turn_index).toBe(0);
    expect(result.newState?.turn_order[0]).toBe(PLAYER_ID);

    // Enemy untouched.
    expect(result.newState?.enemies[0].current_hp).toBe(enemy.current_hp);

    // No additional charges deducted — used count stays at the pre-set value.
    expect(result.newState?.ability_charges_used?.knight_shield_bash).toBe(99);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Charge tracking is per-combat (new combat → empty map)
// ─────────────────────────────────────────────────────────────────────────────

describe("ability charges scope to a single combat", () => {
  it("fresh CombatState starts with no ability_charges_used set", () => {
    const state = makeCombat([makeEnemy()]);
    expect(state.ability_charges_used ?? {}).toEqual({});
  });

  it("the field is optional on CombatState (omitted = zero used)", () => {
    // Construct without ability_charges_used at all.
    const partial: CombatState = makeCombat([makeEnemy()]);
    delete (partial as Partial<CombatState>).ability_charges_used;

    const player = makePlayer({
      equipped_ability_slots: ["knight_shield_bash", null, null, null],
      learned_abilities:      ["knight_shield_bash"],
    });
    const result = executePlayerAction({
      action: { action: "ability", ability_id: "knight_shield_bash", target_instance_id: "g_1" },
      state: partial, player, world_genre: "fantasy", rng: makeRng([0.5, 0.99]),
    });
    expect(result.newState?.ability_charges_used?.knight_shield_bash).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. Slot 2 auto-assign at level 5
//
// Per the prompt: "Slot 2 (level 5): auto-assign a random ability from
// the learned pool that fits slot 2." For Knight, the learned pool at
// game start = ["knight_war_cry" (slot 2), "knight_battle_mend" (slot 3),
// "knight_iron_stance" (slot 4)]. So slot 2 should resolve to War Cry.
//
// This test exercises the candidate-fetching helpers so the level-up
// modal can do the right thing when the player crosses 5.
// ─────────────────────────────────────────────────────────────────────────────

describe("slot-2 auto-assign candidates at level 5", () => {
  it("the learned pool yields exactly one slot-2 candidate for Knight", () => {
    const learnedIds = drawStartingLearnedPool("knight");
    const slot2InPool = learnedIds
      .map((id) => ABILITY_LIBRARY[id])
      .filter((e) => !e.is_passive && e.slot_position === 2);
    expect(slot2InPool.length).toBe(1);
    expect(slot2InPool[0].id).toBe("knight_war_cry");
  });

  it("getSlotCandidatesForLevelUp returns the slot-3 candidate (Battle Mend)", () => {
    const candidates = getSlotCandidatesForLevelUp("knight", 3);
    expect(candidates.length).toBeGreaterThanOrEqual(1);
    expect(candidates.map((c) => c.id)).toContain("knight_battle_mend");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Defensive: unknown / unequipped ability id is rejected
// ─────────────────────────────────────────────────────────────────────────────

describe("executePlayerAction — invalid ability dispatch", () => {
  it("unknown ability id forfeits the turn without crashing", () => {
    const player = makePlayer();
    const enemy  = makeEnemy();
    const state  = makeCombat([enemy]);
    const result = executePlayerAction({
      action: { action: "ability", ability_id: "not_a_real_ability" as AbilityId, target_instance_id: enemy.instance_id },
      state, player, world_genre: "fantasy", rng: makeRng([0.5]),
    });
    // No "ability_used" — the dispatch was rejected; turn still advanced.
    expect(result.events.find((e) => e.type === "ability_used")).toBeUndefined();
  });

  it("an ability not in the equipped loadout is rejected", () => {
    // Player only equips slot 1 = Shield Bash. Try to use War Cry.
    const player = makePlayer({
      equipped_ability_slots: ["knight_shield_bash", null, null, null],
      learned_abilities:      ["knight_shield_bash", "knight_war_cry"],
    });
    const enemy = makeEnemy();
    const state = makeCombat([enemy]);
    const result = executePlayerAction({
      action: { action: "ability", ability_id: "knight_war_cry", target_instance_id: enemy.instance_id },
      state, player, world_genre: "fantasy", rng: makeRng([0.5]),
    });
    expect(result.events.find((e) => e.type === "ability_used")).toBeUndefined();
  });
});

// Suppress unused-import warning on ItemType / ItemRarity (kept available
// for future fixtures involving weapon/armor effects in ability resolution).
void ItemType; void ItemRarity;
