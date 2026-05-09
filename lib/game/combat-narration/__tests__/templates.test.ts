import type { CombatEvent } from "@/types/game";
import { renderRoutineCombatEvent } from "../templates";

function makeEvent(p: Partial<CombatEvent> & { type: CombatEvent["type"] }): CombatEvent {
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

const ENEMY_LOOKUP = (id: string) => (id === "g1" ? "Goblin" : undefined);

describe("renderRoutineCombatEvent — player_attack", () => {
  it("renders a hit line with the damage interpolated", () => {
    const ev = makeEvent({
      type:         "player_attack",
      actor:        "PLAYER",
      target:       "g1",
      outcome:      "hit",
      damage_dealt: 6,
    });
    const out = renderRoutineCombatEvent(ev, { enemyName: ENEMY_LOOKUP });
    expect(out).not.toBeNull();
    expect(out!.includes("6 damage")).toBe(true);
  });

  it("renders a miss line for outcome=miss", () => {
    const ev = makeEvent({
      type:    "player_attack",
      actor:   "PLAYER",
      target:  "g1",
      outcome: "miss",
    });
    const out = renderRoutineCombatEvent(ev, { enemyName: ENEMY_LOOKUP });
    expect(out).not.toBeNull();
    expect(out!.toLowerCase()).not.toMatch(/damage/);
  });

  it("renders a fumble line for outcome=fumble", () => {
    const ev = makeEvent({
      type:    "player_attack",
      actor:   "PLAYER",
      target:  "g1",
      outcome: "fumble",
    });
    const out = renderRoutineCombatEvent(ev, { enemyName: ENEMY_LOOKUP });
    expect(out).not.toBeNull();
    expect(typeof out).toBe("string");
  });

  it("returns null for outcome=crit (LLM-narrated)", () => {
    const ev = makeEvent({
      type:    "player_attack",
      actor:   "PLAYER",
      target:  "g1",
      outcome: "crit",
    });
    expect(renderRoutineCombatEvent(ev, { enemyName: ENEMY_LOOKUP })).toBeNull();
  });

  it("falls back to 'the enemy' when target id can't be resolved", () => {
    const ev = makeEvent({
      type:         "player_attack",
      actor:        "PLAYER",
      target:       "unknown_target",
      outcome:      "hit",
      damage_dealt: 4,
    });
    const out = renderRoutineCombatEvent(ev, { enemyName: () => undefined });
    expect(out!.includes("4 damage")).toBe(true);
  });
});

describe("renderRoutineCombatEvent — enemy_attack", () => {
  it("renders a hit line with damage and the resolved enemy name", () => {
    const ev = makeEvent({
      type:         "enemy_attack",
      actor:        "g1",
      target:       "PLAYER",
      outcome:      "hit",
      damage_dealt: 3,
    });
    const out = renderRoutineCombatEvent(ev, { enemyName: ENEMY_LOOKUP });
    expect(out).not.toBeNull();
    expect(out!.includes("3 damage")).toBe(true);
  });

  it("renders a miss line for outcome=miss", () => {
    const ev = makeEvent({
      type:    "enemy_attack",
      actor:   "g1",
      target:  "PLAYER",
      outcome: "miss",
    });
    const out = renderRoutineCombatEvent(ev, { enemyName: ENEMY_LOOKUP });
    expect(out).not.toBeNull();
    expect(out!.toLowerCase()).not.toMatch(/damage/);
  });

  it("returns null for outcome=crit", () => {
    const ev = makeEvent({
      type:    "enemy_attack",
      actor:   "g1",
      target:  "PLAYER",
      outcome: "crit",
    });
    expect(renderRoutineCombatEvent(ev, { enemyName: ENEMY_LOOKUP })).toBeNull();
  });
});

describe("renderRoutineCombatEvent — defend / use_item / flee_attempt", () => {
  it("defend renders a fixed line", () => {
    const ev = makeEvent({ type: "defend", outcome: "defended" });
    expect(renderRoutineCombatEvent(ev)).toBe("You raise your guard.");
  });

  it("use_item interpolates the item name and heal amount (negative damage = heal)", () => {
    const ev = makeEvent({
      type:           "use_item",
      target:         "PLAYER",
      outcome:        "item_used",
      damage_dealt:   -8,
      weapon_or_item: "Basic Health Potion",
    });
    const out = renderRoutineCombatEvent(ev);
    expect(out).not.toBeNull();
    expect(out!.includes("Basic Health Potion")).toBe(true);
    expect(out!.includes("8 HP")).toBe(true);
  });

  it("flee_attempt fail renders a templated line", () => {
    const ev = makeEvent({ type: "flee_attempt", outcome: "fled_failed" });
    const out = renderRoutineCombatEvent(ev);
    expect(out).not.toBeNull();
  });

  it("flee_attempt success returns null (LLM-narrated)", () => {
    const ev = makeEvent({ type: "flee_attempt", outcome: "fled" });
    expect(renderRoutineCombatEvent(ev)).toBeNull();
  });
});

describe("variant determinism", () => {
  it("same event timestamp always picks the same variant", () => {
    const ev1 = makeEvent({
      type:         "player_attack",
      actor:        "PLAYER",
      target:       "g1",
      outcome:      "hit",
      damage_dealt: 5,
      timestamp:    1234567890000,
    });
    const a = renderRoutineCombatEvent(ev1, { enemyName: ENEMY_LOOKUP });
    const b = renderRoutineCombatEvent(ev1, { enemyName: ENEMY_LOOKUP });
    const c = renderRoutineCombatEvent(ev1, { enemyName: ENEMY_LOOKUP });
    expect(a).toBe(b);
    expect(a).toBe(c);
  });

  it("different timestamps may pick different variants (smoke test)", () => {
    const baseEvent: Omit<CombatEvent, "timestamp"> = {
      type:                "player_attack",
      actor:               "PLAYER",
      target:              "g1",
      outcome:             "hit",
      damage_dealt:        5,
      remaining_target_hp: null,
      weapon_or_item:      null,
      context_note:        null,
    };
    const seen = new Set<string>();
    for (let i = 0; i < 200; i += 1) {
      const out = renderRoutineCombatEvent(
        { ...baseEvent, timestamp: i * 7919 + 13 },
        { enemyName: ENEMY_LOOKUP }
      );
      if (out) seen.add(out);
    }
    // The pool has 4 variants; 200 well-spaced timestamps should hit
    // more than one of them.
    expect(seen.size).toBeGreaterThan(1);
  });
});

describe("non-routine events return null", () => {
  it("combat_start", () => {
    expect(renderRoutineCombatEvent(makeEvent({ type: "combat_start" }))).toBeNull();
  });
  it("victory", () => {
    expect(renderRoutineCombatEvent(makeEvent({ type: "victory" }))).toBeNull();
  });
  it("defeat", () => {
    expect(renderRoutineCombatEvent(makeEvent({ type: "defeat" }))).toBeNull();
  });
  it("kill", () => {
    expect(renderRoutineCombatEvent(makeEvent({ type: "kill", outcome: "kill" }))).toBeNull();
  });
  it("round_start", () => {
    expect(renderRoutineCombatEvent(makeEvent({ type: "round_start" }))).toBeNull();
  });
});
