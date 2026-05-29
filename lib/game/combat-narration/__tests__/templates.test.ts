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
    expect(out!.primary.includes("6 damage")).toBe(true);
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
    expect(out!.primary.toLowerCase()).not.toMatch(/damage/);
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
    expect(typeof out!.primary).toBe("string");
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
    expect(out!.primary.includes("4 damage")).toBe(true);
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
    expect(out!.primary.includes("3 damage")).toBe(true);
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
    expect(out!.primary.toLowerCase()).not.toMatch(/damage/);
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
    expect(renderRoutineCombatEvent(ev)).toEqual({
      primary: "You raise your guard.",
      rolls:   null,
    });
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
    expect(out?.primary).toBe("You use Basic Health Potion. Restored 8 HP.");
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
    expect(out?.primary).toBe("You use Strange Trinket.");
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
    expect(out?.primary).toBe("You use Inert Tonic.");
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
    // Day 20.4 — return shape is { primary, rolls }; same event input
    // must produce the same primary string (rolls suffix may differ if
    // event.rolls payloads differ, but here event is identical).
    expect(a?.primary).toBe(b?.primary);
    expect(a?.primary).toBe(c?.primary);
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
      if (out) seen.add(out.primary);
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
    expect(out?.primary).toBe("You encounter Goblin at The Thorned Cloister.");
  });

  it("2 enemies with location: '... and ... at <loc>.'", () => {
    const out = renderRoutineCombatEvent(
      makeEvent({ type: "combat_start" }),
      { enemyNames: ["Goblin", "Skeleton"], locationName: "The Thorned Cloister" }
    );
    expect(out?.primary).toBe("You encounter Goblin and Skeleton at The Thorned Cloister.");
  });

  it("3+ enemies with location: Oxford-comma list at <loc>.", () => {
    const out = renderRoutineCombatEvent(
      makeEvent({ type: "combat_start" }),
      { enemyNames: ["Goblin", "Skeleton", "Orc"], locationName: "The Thorned Cloister" }
    );
    expect(out?.primary).toBe("You encounter Goblin, Skeleton, and Orc at The Thorned Cloister.");
  });

  it("4+ enemies with location: Oxford-comma list with full chain", () => {
    const out = renderRoutineCombatEvent(
      makeEvent({ type: "combat_start" }),
      {
        enemyNames:   ["Goblin", "Skeleton", "Orc", "Bandit"],
        locationName: "The Thorned Cloister",
      }
    );
    expect(out?.primary).toBe("You encounter Goblin, Skeleton, Orc, and Bandit at The Thorned Cloister.");
  });

  it("drops the 'at <location>' suffix when location_name is omitted", () => {
    const out = renderRoutineCombatEvent(
      makeEvent({ type: "combat_start" }),
      { enemyNames: ["Goblin"] }
    );
    expect(out?.primary).toBe("You encounter Goblin.");
  });

  it("drops the suffix when location_name is empty / whitespace", () => {
    const out = renderRoutineCombatEvent(
      makeEvent({ type: "combat_start" }),
      { enemyNames: ["Goblin"], locationName: "   " }
    );
    expect(out?.primary).toBe("You encounter Goblin.");
  });

  it("falls back to a generic banner when no enemy names supplied", () => {
    // Defensive — combat_start should always carry names, but the
    // template doesn't crash if it doesn't.
    const out = renderRoutineCombatEvent(
      makeEvent({ type: "combat_start" }),
      { locationName: "The Thorned Cloister" }
    );
    expect(out?.primary).toBe("You encounter foes at The Thorned Cloister.");
  });
});

// Day 20.3 TASK 3 — CRITICAL HIT banner.

describe("renderCritBanner (Day 20.3 TASK 3 / Day 20.4 TASK 2 shape)", () => {
  it("interpolates damage from the event when present", () => {
    const ev = makeEvent({
      type:         "player_attack",
      outcome:      "crit",
      damage_dealt: 14,
    });
    expect(renderCritBanner(ev).primary).toBe("⚔ CRITICAL HIT — 14 damage.");
  });

  it("falls back to a generic banner when damage isn't carried", () => {
    const ev = makeEvent({
      type:    "player_attack",
      outcome: "crit",
    });
    expect(renderCritBanner(ev).primary).toBe("⚔ CRITICAL HIT.");
  });

  it("treats zero damage as missing (banner doesn't lie about a 0-damage crit)", () => {
    const ev = makeEvent({
      type:         "player_attack",
      outcome:      "crit",
      damage_dealt: 0,
    });
    expect(renderCritBanner(ev).primary).toBe("⚔ CRITICAL HIT.");
  });

  it("returns rolls suffix when event.rolls populated (Day 20.4 TASK 2)", () => {
    const ev = makeEvent({
      type:         "player_attack",
      outcome:      "crit",
      damage_dealt: 11,
      rolls: {
        d20:             20,
        d20_modifier:    2,
        target_dc:       12,
        damage_die:      "1d6",
        damage_die_roll: 3,
        crit_max_damage: 6,
        str_modifier:    2,
      },
    });
    const out = renderCritBanner(ev);
    expect(out.primary).toBe("⚔ CRITICAL HIT — 11 damage.");
    expect(out.rolls).toBe("(d20: 20 | 6 (max) + 3 (1d6) + 2)");
  });

  it("returns null rolls when event.rolls absent", () => {
    const ev = makeEvent({
      type:         "player_attack",
      outcome:      "crit",
      damage_dealt: 7,
    });
    expect(renderCritBanner(ev).rolls).toBeNull();
  });
});

// Day 20.4.2 TASK 5 — D&D-style rolls suffix display.
//
// Pre-20.4.2: showed only the raw d20 against the DC ("d20: 14 vs 12").
// 20.4.2 surfaces the full math the engine uses so the player can see
// WHY a high-looking raw roll still failed:
//   hit:    "(d20: 17, +2 → 19 vs 12 | 1d6+2)"
//   miss:   "(d20: 4, +2 → 6 vs 12)"
//   fumble: "(d20: 1)"                          [nat-1, auto-miss]
//   crit:   "(d20: 20 | 6 (max) + 3 (1d6) + 2)" [nat-20, auto-hit]
//   heal:   "(1d8: 4 +4 = 8)"
// Modifier sign: positive→"+N", negative→"+(-N)", zero→"+0".

describe("rolls suffix — Day 20.4.2 TASK 5 D&D-style display", () => {
  it("hit shows d20 + modifier → total vs DC, plus damage formula", () => {
    const ev = makeEvent({
      type:         "player_attack",
      outcome:      "hit",
      damage_dealt: 5,
      rolls: {
        d20:             14,
        d20_modifier:    2,
        target_dc:       12,
        damage_die:      "1d6",
        damage_die_roll: 4,
        str_modifier:    1,
      },
    });
    const out = renderRoutineCombatEvent(ev);
    // Full math: 14 + 2 → 16 (passes DC 12) | damage = 1d6+1
    expect(out?.rolls).toBe("(d20: 14, +2 → 16 vs 12 | 1d6+1)");
  });

  it("miss shows d20 + modifier → total vs DC", () => {
    const ev = makeEvent({
      type:    "player_attack",
      outcome: "miss",
      rolls:   { d20: 5, d20_modifier: 2, target_dc: 12 },
    });
    const out = renderRoutineCombatEvent(ev);
    // Player sees 5+2=7, lower than DC 12 — clear why this missed.
    expect(out?.rolls).toBe("(d20: 5, +2 → 7 vs 12)");
  });

  it("fumble (nat-1) skips mod/total (auto-miss, modifier is irrelevant)", () => {
    const ev = makeEvent({
      type:    "player_attack",
      outcome: "fumble",
      rolls:   { d20: 1, d20_modifier: -1, target_dc: 12 },
    });
    const out = renderRoutineCombatEvent(ev);
    expect(out?.rolls).toBe("(d20: 1)");
  });

  it("negative modifier formats as +(-N)", () => {
    // Visible-modifier disambiguation: the suffix always uses a leading
    // "+" connector, so a negative mod gets wrapped to read clearly:
    //    "d20: 12, +(-2) → 10 vs 10"
    const ev = makeEvent({
      type:    "flee_attempt",
      outcome: "fled_failed",
      rolls:   {
        d20:          12,
        d20_modifier: -2,
        target_dc:    10,
      },
    });
    const out = renderRoutineCombatEvent(ev);
    expect(out?.rolls).toBe("(d20: 12, +(-2) → 10 vs 10)");
  });

  it("zero modifier formats as +0 (not blank, not '+')", () => {
    const ev = makeEvent({
      type:    "flee_attempt",
      outcome: "fled_failed",
      rolls:   { d20: 6, d20_modifier: 0, target_dc: 10 },
    });
    const out = renderRoutineCombatEvent(ev);
    expect(out?.rolls).toBe("(d20: 6, +0 → 6 vs 10)");
  });

  it("flee fail with negative AGI mod shows the full math", () => {
    // Reproduces the original Day 20.4.2 TASK 5 bug case — player rolls
    // a d20 that looks high enough but with a negative modifier still
    // misses the DC. The display now makes that obvious.
    const ev = makeEvent({
      type:    "flee_attempt",
      outcome: "fled_failed",
      rolls:   { d20: 9, d20_modifier: -1, target_dc: 10 },
    });
    const out = renderRoutineCombatEvent(ev);
    expect(out?.rolls).toBe("(d20: 9, +(-1) → 8 vs 10)");
  });

  it("rounds fractional flee DC to integer for display (Day 20.4.1 TASK 3a, preserved)", () => {
    // Fractional DC (10.666...) comes from averaging an odd number
    // of enemy AGI mods. Display rounds; the raw float still drives
    // the engine's pass/fail check.
    const ev = makeEvent({
      type:    "flee_attempt",
      outcome: "fled_failed",
      rolls:   {
        d20:          6,
        d20_modifier: -1,
        target_dc:    10.666666666666666,
      },
    });
    const out = renderRoutineCombatEvent(ev);
    expect(out?.rolls).toBe("(d20: 6, +(-1) → 5 vs 11)");
  });

  it("rounds fractional flee DC down on .4 (banker's rounding not used)", () => {
    const ev = makeEvent({
      type:    "flee_attempt",
      outcome: "fled_failed",
      rolls:   { d20: 6, d20_modifier: 0, target_dc: 10.4 },
    });
    const out = renderRoutineCombatEvent(ev);
    expect(out?.rolls).toBe("(d20: 6, +0 → 6 vs 10)");
  });

  it("heal shows die roll + flat +4 + total sum", () => {
    const ev = makeEvent({
      type:           "use_item",
      target:         "PLAYER",
      outcome:        "item_used",
      damage_dealt:   -8,
      weapon_or_item: "Basic Health Potion",
      rolls:          { damage_die: "1d8", damage_die_roll: 4 },
    });
    const out = renderRoutineCombatEvent(ev);
    // 1d8 rolled 4, plus the flat +4 bonus = 8 total restored.
    expect(out?.rolls).toBe("(1d8: 4 +4 = 8)");
  });

  it("hit with negative str_modifier still shows the damage formula sign correctly", () => {
    // Negative str mods are rare but possible (weak class / curse).
    // The damage formula uses "1d6-1" (no "+" prefix) when the bonus
    // is negative.
    const ev = makeEvent({
      type:         "player_attack",
      outcome:      "hit",
      damage_dealt: 3,
      rolls: {
        d20:             14,
        d20_modifier:    2,
        target_dc:       12,
        damage_die:      "1d6",
        damage_die_roll: 4,
        str_modifier:    -1,
      },
    });
    const out = renderRoutineCombatEvent(ev);
    expect(out?.rolls).toBe("(d20: 14, +2 → 16 vs 12 | 1d6-1)");
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

// Prompt 5 — status effect story-feed templates.

describe("renderRoutineCombatEvent — status effects (Prompt 5)", () => {
  it("status_applied (player target) renders the source and the status id", () => {
    const ev = makeEvent({
      type:           "status_applied",
      actor:          "g1",
      target:         "PLAYER",
      weapon_or_item: "poisoned",
    });
    const out = renderRoutineCombatEvent(ev, { enemyName: ENEMY_LOOKUP });
    expect(out).not.toBeNull();
    expect(out!.primary).toContain("Goblin");
    expect(out!.primary).toContain("poisoned");
    expect(out!.primary).toBe("Goblin inflicts poisoned on you.");
  });

  it("status_applied falls back to a generic source when the actor can't resolve", () => {
    const ev = makeEvent({
      type:           "status_applied",
      actor:          "unknown_enemy",
      target:         "PLAYER",
      weapon_or_item: "burning",
    });
    const out = renderRoutineCombatEvent(ev, { enemyName: () => undefined });
    expect(out!.primary).toBe("An enemy inflicts burning on you.");
  });

  it("status_tick (player target) includes the damage number", () => {
    const ev = makeEvent({
      type:           "status_tick",
      actor:          "Goblin",
      target:         "PLAYER",
      damage_dealt:   3,
      weapon_or_item: "poisoned",
    });
    const out = renderRoutineCombatEvent(ev);
    expect(out).not.toBeNull();
    expect(out!.primary).toContain("3");
    expect(out!.primary).toBe("poisoned deals 3 damage.");
  });

  it("status_saved includes the status id", () => {
    const ev = makeEvent({
      type:           "status_saved",
      actor:          "PLAYER",
      target:         "PLAYER",
      weapon_or_item: "chilled",
    });
    const out = renderRoutineCombatEvent(ev);
    expect(out).not.toBeNull();
    expect(out!.primary).toContain("chilled");
    expect(out!.primary).toBe("You shake off the chilled.");
  });

  it("status_expired renders an ailment fade line", () => {
    const ev = makeEvent({
      type:           "status_expired",
      actor:          "PLAYER",
      target:         "PLAYER",
      weapon_or_item: "frightened",
    });
    expect(renderRoutineCombatEvent(ev)?.primary).toBe("The frightened fades.");
  });

  it("status_expired renders a buff wear-off line", () => {
    const ev = makeEvent({
      type:           "status_expired",
      actor:          "PLAYER",
      target:         "PLAYER",
      weapon_or_item: "fortified",
    });
    expect(renderRoutineCombatEvent(ev)?.primary).toBe("fortified wears off.");
  });
});

// Day 20.1 TASK 3 — turn-boundary separators.

describe("renderRoutineCombatEvent — turn separators (Day 20.1 TASK 3 + PR-11v-e)", () => {
  // PR-11v-e — player_turn_start / enemy_phase_start now return null so
  // the feed stays quiet on phase transitions; the combat panel header
  // pill (Your Turn / Enemy Turn) carries that information already.
  it("player_turn_start returns null (no feed line)", () => {
    expect(
      renderRoutineCombatEvent(makeEvent({ type: "player_turn_start" }))
    ).toBeNull();
  });

  it("enemy_phase_start returns null (no feed line)", () => {
    expect(
      renderRoutineCombatEvent(makeEvent({ type: "enemy_phase_start" }))
    ).toBeNull();
  });

  // PR-11v-e — round separator is now bare text ("round N") so StoryFeed
  // can wrap it in its own styled centred-rule presentation.
  it("round_start renders 'round N' when roundNumber is supplied", () => {
    expect(
      renderRoutineCombatEvent(
        makeEvent({ type: "round_start" }),
        { roundNumber: 2 }
      )
    ).toEqual({ primary: "round 2", rolls: null });
  });

  it("round_start falls back to 'new round' without a number", () => {
    expect(
      renderRoutineCombatEvent(makeEvent({ type: "round_start" }))
    ).toEqual({ primary: "new round", rolls: null });
  });
});
