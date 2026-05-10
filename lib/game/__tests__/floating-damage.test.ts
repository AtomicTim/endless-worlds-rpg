import type { CombatEvent } from "@/types/game";
// Day 20.4.1 TASK 5 — makeFloatingEntry routing tests.
//
// The helper lives in CombatMode.tsx but is exported as a pure
// function so jest can hit it without a DOM. Verifies the per-
// event-type host id resolution after the V8.38 bug where attacks
// floated over the actor portrait instead of the target portrait.

import { makeFloatingEntry } from "@/components/game/CombatMode/CombatMode";
import { PLAYER_ID } from "@/lib/game/combat-engine";

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
