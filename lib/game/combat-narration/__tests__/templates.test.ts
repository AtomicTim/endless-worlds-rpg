import type { CombatEvent } from "@/types/game";
import {
  renderCritBanner,
  renderResolutionBanner,
  renderRoutineCombatEvent,
} from "../templates";

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

  it("use_item interpolates the item name and heal amount (Day 20.3 TASK 2 wording)", () => {
    const ev = makeEvent({
      type:           "use_item",
      target:         "PLAYER",
      outcome:        "item_used",
      damage_dealt:   -8,
      weapon_or_item: "Basic Health Potion",
    });
    const out = renderRoutineCombatEvent(ev);
    expect(out).toBe("You use Basic Health Potion. Restored 8 HP.");
  });

  it("use_item without heal effect drops the heal suffix (Day 20.3 TASK 2)", () => {
    const ev = makeEvent({
      type:           "use_item",
      target:         "PLAYER",
      outcome:        "item_used",
      // No damage_dealt → fallback path; no "Restored N HP" suffix.
      weapon_or_item: "Strange Trinket",
    });
    const out = renderRoutineCombatEvent(ev);
    expect(out).toBe("You use Strange Trinket.");
  });

  it("use_item with damage_dealt = 0 still drops the heal suffix", () => {
    const ev = makeEvent({
      type:           "use_item",
      target:         "PLAYER",
      outcome:        "item_used",
      damage_dealt:   0,
      weapon_or_item: "Inert Tonic",
    });
    const out = renderRoutineCombatEvent(ev);
    expect(out).toBe("You use Inert Tonic.");
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

// Day 20.1 — combat_start is now templated (banner). round_start /
// player_turn_start / enemy_phase_start are templated separators.
// Only victory / defeat / kill stay LLM-only.

describe("non-routine events return null", () => {
  it("victory", () => {
    expect(renderRoutineCombatEvent(makeEvent({ type: "victory" }))).toBeNull();
  });
  it("defeat", () => {
    expect(renderRoutineCombatEvent(makeEvent({ type: "defeat" }))).toBeNull();
  });
  it("kill", () => {
    expect(renderRoutineCombatEvent(makeEvent({ type: "kill", outcome: "kill" }))).toBeNull();
  });
});

// Day 20.1 TASK 2 — combat_start banner.

describe("renderRoutineCombatEvent — combat_start banner (Day 20.1 TASK 2)", () => {
  it("1 enemy with location: 'You encounter X at <loc>.'", () => {
    const out = renderRoutineCombatEvent(
      makeEvent({ type: "combat_start" }),
      { enemyNames: ["Goblin"], locationName: "The Thorned Cloister" }
    );
    expect(out).toBe("You encounter Goblin at The Thorned Cloister.");
  });

  it("2 enemies with location: '... and ... at <loc>.'", () => {
    const out = renderRoutineCombatEvent(
      makeEvent({ type: "combat_start" }),
      { enemyNames: ["Goblin", "Skeleton"], locationName: "The Thorned Cloister" }
    );
    expect(out).toBe("You encounter Goblin and Skeleton at The Thorned Cloister.");
  });

  it("3+ enemies with location: Oxford-comma list at <loc>.", () => {
    const out = renderRoutineCombatEvent(
      makeEvent({ type: "combat_start" }),
      { enemyNames: ["Goblin", "Skeleton", "Orc"], locationName: "The Thorned Cloister" }
    );
    expect(out).toBe("You encounter Goblin, Skeleton, and Orc at The Thorned Cloister.");
  });

  it("4+ enemies with location: Oxford-comma list with full chain", () => {
    const out = renderRoutineCombatEvent(
      makeEvent({ type: "combat_start" }),
      {
        enemyNames:   ["Goblin", "Skeleton", "Orc", "Bandit"],
        locationName: "The Thorned Cloister",
      }
    );
    expect(out).toBe("You encounter Goblin, Skeleton, Orc, and Bandit at The Thorned Cloister.");
  });

  it("drops the 'at <location>' suffix when location_name is omitted", () => {
    const out = renderRoutineCombatEvent(
      makeEvent({ type: "combat_start" }),
      { enemyNames: ["Goblin"] }
    );
    expect(out).toBe("You encounter Goblin.");
  });

  it("drops the suffix when location_name is empty / whitespace", () => {
    const out = renderRoutineCombatEvent(
      makeEvent({ type: "combat_start" }),
      { enemyNames: ["Goblin"], locationName: "   " }
    );
    expect(out).toBe("You encounter Goblin.");
  });

  it("falls back to a generic banner when no enemy names supplied", () => {
    // Defensive — combat_start should always carry names, but the
    // template doesn't crash if it doesn't.
    const out = renderRoutineCombatEvent(
      makeEvent({ type: "combat_start" }),
      { locationName: "The Thorned Cloister" }
    );
    expect(out).toBe("You encounter foes at The Thorned Cloister.");
  });
});

// Day 20.3 TASK 3 — CRITICAL HIT banner.

describe("renderCritBanner (Day 20.3 TASK 3)", () => {
  it("interpolates damage from the event when present", () => {
    const ev = makeEvent({
      type:         "player_attack",
      outcome:      "crit",
      damage_dealt: 14,
    });
    expect(renderCritBanner(ev)).toBe("⚔ CRITICAL HIT — 14 damage.");
  });

  it("falls back to a generic banner when damage isn't carried", () => {
    const ev = makeEvent({
      type:    "player_attack",
      outcome: "crit",
    });
    expect(renderCritBanner(ev)).toBe("⚔ CRITICAL HIT.");
  });

  it("treats zero damage as missing (banner doesn't lie about a 0-damage crit)", () => {
    const ev = makeEvent({
      type:         "player_attack",
      outcome:      "crit",
      damage_dealt: 0,
    });
    expect(renderCritBanner(ev)).toBe("⚔ CRITICAL HIT.");
  });
});

// Day 20.3 TASK 5 — Victory / Defeat / Escaped banner words.

describe("renderResolutionBanner (Day 20.3 TASK 5)", () => {
  it("victory → 'Victory'", () => {
    expect(renderResolutionBanner(makeEvent({ type: "victory" }))).toBe("Victory");
  });
  it("defeat → 'Defeat'", () => {
    expect(renderResolutionBanner(makeEvent({ type: "defeat" }))).toBe("Defeat");
  });
  it("flee_success → 'Escaped'", () => {
    expect(renderResolutionBanner(makeEvent({ type: "flee_success" }))).toBe("Escaped");
  });
  it("returns null for non-resolution events", () => {
    expect(renderResolutionBanner(makeEvent({ type: "player_attack" }))).toBeNull();
    expect(renderResolutionBanner(makeEvent({ type: "kill" }))).toBeNull();
  });
});

// Day 20.1 TASK 3 — turn-boundary separators.

describe("renderRoutineCombatEvent — turn separators (Day 20.1 TASK 3)", () => {
  it("player_turn_start renders the 'Your turn' separator", () => {
    expect(
      renderRoutineCombatEvent(makeEvent({ type: "player_turn_start" }))
    ).toBe("─── Your turn ───");
  });

  it("enemy_phase_start renders the 'Enemies' turn' separator", () => {
    expect(
      renderRoutineCombatEvent(makeEvent({ type: "enemy_phase_start" }))
    ).toBe("─── Enemies' turn ───");
  });

  it("round_start renders 'Round N' when roundNumber is supplied", () => {
    expect(
      renderRoutineCombatEvent(
        makeEvent({ type: "round_start" }),
        { roundNumber: 2 }
      )
    ).toBe("─── Round 2 ───");
  });

  it("round_start falls back to 'New round' without a number", () => {
    expect(
      renderRoutineCombatEvent(makeEvent({ type: "round_start" }))
    ).toBe("─── New round ───");
  });
});
