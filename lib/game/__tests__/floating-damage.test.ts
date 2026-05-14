import type { CombatEvent } from "@/types/game";
// Day 20.4.1 TASK 5 — makeFloatingEntry routing tests.
//
// The helper lives in CombatMode.tsx but is exported as a pure
// function so jest can hit it without a DOM. Verifies the per-
// event-type host id resolution after the V8.38 bug where attacks
// floated over the actor portrait instead of the target portrait.

import { makeFloatingEntry } from "@/components/game/CombatMode/CombatMode";
import { PLAYER_ID } from "@/lib/game/combat-engine";
import { computeFloatStartDelay } from "@/hooks/useCombat";

function evt(p: Partial<CombatEvent> & { type: CombatEvent["type"] }): CombatEvent {
  return {
    timestamp:           1700000000000,
    actor:               "PLAYER",
    target:              null,
    outcome:             null,
    damage_dealt:        null,
    remaining_target_hp: null,
    weapon_or_item:      null,
    context_note:        null,
    ...p,
  };
}

describe("makeFloatingEntry — Day 20.4.1 TASK 1 routing", () => {
  it("player_attack hit hosts on the targeted enemy (not the player)", () => {
    const result = makeFloatingEntry(evt({
      type:         "player_attack",
      actor:        PLAYER_ID,
      target:       "fantasy_goblin_1",
      outcome:      "hit",
      damage_dealt: 6,
      rolls: { d20: 14, d20_modifier: 2, target_dc: 12, damage_die: "1d6", damage_die_roll: 4, str_modifier: 2 },
    }));
    expect(result?.targetId).toBe("fantasy_goblin_1");
    expect(result?.targetId).not.toBe(PLAYER_ID);
    expect(result?.payload.color).toBe("var(--combat-player)");
    expect(result?.payload.kind).toBe("hit");
    // Hit shows the rolled damage die value (not the total damage).
    expect(result?.payload.value).toBe(4);
  });

  it("player_attack crit hosts on the targeted enemy and shows TOTAL damage", () => {
    const result = makeFloatingEntry(evt({
      type:         "player_attack",
      actor:        PLAYER_ID,
      target:       "fantasy_goblin_1",
      outcome:      "crit",
      damage_dealt: 13,
      rolls: { d20: 20, d20_modifier: 2, target_dc: 12, damage_die: "1d6", damage_die_roll: 6, crit_max_damage: 6, str_modifier: 1 },
    }));
    expect(result?.targetId).toBe("fantasy_goblin_1");
    expect(result?.payload.color).toBe("var(--combat-player-crit)");
    expect(result?.payload.kind).toBe("crit");
    // Crits show TOTAL (the climactic moment).
    expect(result?.payload.value).toBe(13);
  });

  it("enemy_attack hit hosts on PLAYER (not the enemy)", () => {
    const result = makeFloatingEntry(evt({
      type:         "enemy_attack",
      actor:        "fantasy_goblin_1",
      target:       PLAYER_ID,
      outcome:      "hit",
      damage_dealt: 4,
      rolls: { d20: 15, d20_modifier: 1, target_dc: 13, damage_die: "1d6", damage_die_roll: 4, str_modifier: 0 },
    }));
    expect(result?.targetId).toBe(PLAYER_ID);
    expect(result?.targetId).not.toBe("fantasy_goblin_1");
    expect(result?.payload.color).toBe("var(--combat-enemy)");
    expect(result?.payload.kind).toBe("hit");
  });

  it("enemy_attack crit hosts on PLAYER with crit color and TOTAL damage", () => {
    const result = makeFloatingEntry(evt({
      type:         "enemy_attack",
      actor:        "fantasy_goblin_1",
      target:       PLAYER_ID,
      outcome:      "crit",
      damage_dealt: 12,
      rolls: { d20: 20, d20_modifier: 1, target_dc: 13, damage_die: "1d6", damage_die_roll: 6, crit_max_damage: 6, str_modifier: 0 },
    }));
    expect(result?.targetId).toBe(PLAYER_ID);
    expect(result?.payload.color).toBe("var(--combat-enemy-crit)");
    expect(result?.payload.kind).toBe("crit");
    expect(result?.payload.value).toBe(12);
  });

  it("use_item heal hosts on PLAYER with hl-pass green and damage_die_roll value", () => {
    const result = makeFloatingEntry(evt({
      type:         "use_item",
      actor:        PLAYER_ID,
      target:       PLAYER_ID,
      outcome:      "item_used",
      damage_dealt: -8,  // negative = heal (engine convention)
      rolls: { damage_die: "1d8", damage_die_roll: 4 },
    }));
    expect(result?.targetId).toBe(PLAYER_ID);
    expect(result?.payload.color).toBe("var(--hl-pass)");
    expect(result?.payload.kind).toBe("heal");
    // Heal shows the rolled die value (before the flat +4).
    expect(result?.payload.value).toBe(4);
  });

  it("returns null for miss", () => {
    expect(makeFloatingEntry(evt({
      type:    "player_attack",
      actor:   PLAYER_ID,
      target:  "fantasy_goblin_1",
      outcome: "miss",
    }))).toBeNull();
  });

  it("returns null for fumble", () => {
    expect(makeFloatingEntry(evt({
      type:    "player_attack",
      actor:   PLAYER_ID,
      target:  "fantasy_goblin_1",
      outcome: "fumble",
    }))).toBeNull();
  });

  it("returns null for defend", () => {
    expect(makeFloatingEntry(evt({
      type:    "defend",
      outcome: "defended",
    }))).toBeNull();
  });

  it("returns null for flee_attempt (success or fail)", () => {
    expect(makeFloatingEntry(evt({ type: "flee_attempt", outcome: "fled" }))).toBeNull();
    expect(makeFloatingEntry(evt({ type: "flee_attempt", outcome: "fled_failed" }))).toBeNull();
  });

  it("returns null for phase separator events", () => {
    expect(makeFloatingEntry(evt({ type: "player_turn_start" }))).toBeNull();
    expect(makeFloatingEntry(evt({ type: "enemy_phase_start" }))).toBeNull();
    expect(makeFloatingEntry(evt({ type: "round_start" }))).toBeNull();
  });

  it("returns null for victory / defeat / kill / combat_start", () => {
    expect(makeFloatingEntry(evt({ type: "victory" }))).toBeNull();
    expect(makeFloatingEntry(evt({ type: "defeat" }))).toBeNull();
    expect(makeFloatingEntry(evt({ type: "kill", outcome: "kill" }))).toBeNull();
    expect(makeFloatingEntry(evt({ type: "combat_start" }))).toBeNull();
  });

  // Prompt 5 — status DoT ticks float a muted-orange number on the
  // affected portrait (same size as a regular hit, never a crit).
  it("status_tick produces a muted-orange float on the affected portrait", () => {
    const result = makeFloatingEntry(evt({
      type:           "status_tick",
      actor:          "Goblin",
      target:         PLAYER_ID,
      damage_dealt:   3,
      weapon_or_item: "poisoned",
    }));
    expect(result).not.toBeNull();
    expect(result?.targetId).toBe(PLAYER_ID);
    expect(result?.payload.value).toBe(3);
    expect(result?.payload.kind).toBe("hit");   // no crit size upgrade
    expect(result?.payload.color).toBe("#fb923c");
  });

  it("status_tick with no damage returns null", () => {
    expect(makeFloatingEntry(evt({
      type:         "status_tick",
      actor:        "Goblin",
      target:       PLAYER_ID,
      damage_dealt: 0,
    }))).toBeNull();
  });

  it("player_attack with empty target returns null (defensive)", () => {
    expect(makeFloatingEntry(evt({
      type:    "player_attack",
      actor:   PLAYER_ID,
      target:  null,
      outcome: "hit",
      damage_dealt: 4,
    }))).toBeNull();
  });

  it("player_attack with PLAYER as target returns null (can't hit yourself)", () => {
    // Defensive: the engine wouldn't emit this, but the helper
    // refuses anyway so a corrupted event can't put a player-attack
    // float on the player portrait.
    expect(makeFloatingEntry(evt({
      type:    "player_attack",
      actor:   PLAYER_ID,
      target:  PLAYER_ID,
      outcome: "hit",
      damage_dealt: 4,
    }))).toBeNull();
  });
});

// Day 20.4.2 TASK 2 — multi-enemy stagger via sequential start_delay.
//
// computeFloatStartDelay is a pure helper exported from useCombat so
// the stagger math can be tested without a React renderer. The hook
// uses it to figure out how long each new float on a given host
// should wait before its visible animation begins — back-to-back
// emissions on the same host are spaced at least 300ms apart so the
// numbers don't stack pixel-on-pixel.
describe("computeFloatStartDelay — Day 20.4.2 TASK 2", () => {
  it("first emission on a host returns 0 (no prior timestamp)", () => {
    expect(computeFloatStartDelay(/* now */ 1000, /* lastAt */ undefined, undefined)).toBe(0);
  });

  it("emission well past the 300ms spacing returns 0", () => {
    // 500ms apart → no stagger needed.
    expect(computeFloatStartDelay(1500, 1000, 0)).toBe(0);
  });

  it("emission exactly at the 300ms boundary returns 0", () => {
    // Boundary is INclusive — 300ms gap is enough, no delay.
    expect(computeFloatStartDelay(1300, 1000, 0)).toBe(0);
  });

  it("emission 100ms after the prior on the same host returns 200ms", () => {
    // 300 - 100 = 200; no prior delay carried.
    expect(computeFloatStartDelay(1100, 1000, 0)).toBe(200);
  });

  it("emission 0ms after the prior returns 300ms (worst case stagger)", () => {
    expect(computeFloatStartDelay(1000, 1000, 0)).toBe(300);
  });

  it("compounding: third emission stacks on the prior delay", () => {
    // Scenario: three emissions arrive at t=0, t=100, t=200 (all
    // within the 300ms window). Math:
    //   t=0   → delay=0  (lastAt undefined)
    //   t=100 → (300-100) + 0 = 200
    //   t=200 → (300-(200-100)) + 200 = (300-100)+200 = 400
    // Hook updates lastEmittedAt to 200 (NOT 200+400=600), so the
    // measurement is always "since the prior emission timestamp",
    // and the prior delay carries forward via the second arg.
    const d1 = computeFloatStartDelay(0,   undefined, undefined);
    expect(d1).toBe(0);
    const d2 = computeFloatStartDelay(100, 0,         d1);
    expect(d2).toBe(200);
    const d3 = computeFloatStartDelay(200, 100,       d2);
    expect(d3).toBe(400);
  });

  it("clearing the gap resets compounding (lastStartDelay irrelevant when gap >= 300ms)", () => {
    // Prior emission had a stagger of 500ms, but the new emission
    // lands more than 300ms after the prior timestamp — so no
    // staircase, just return 0.
    expect(computeFloatStartDelay(2000, 1500, 500)).toBe(0);
  });
});
