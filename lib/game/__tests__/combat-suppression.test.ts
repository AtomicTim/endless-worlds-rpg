import type { CombatEvent } from "@/types/game";
import { planEventSuppression } from "@/hooks/useCombat";

/**
 * Day 20.3 TASK 4 — when a victory event lands in the same batch
 * as the killing crit/kill, the crit's LLM prose duplicates the
 * victory banner and the kill prose is redundant. planEventSuppression
 * pre-scans the events array and decides:
 *   - drop kill events entirely (skipEntirely)
 *   - render the killing crit's banner without prose (suppressProseAt)
 */

function evt(overrides: Partial<CombatEvent> & { type: CombatEvent["type"] }): CombatEvent {
  return {
    timestamp:           1700000000000,
    actor:               "PLAYER",
    target:              null,
    outcome:             null,
    damage_dealt:        null,
    remaining_target_hp: null,
    weapon_or_item:      null,
    context_note:        null,
    ...overrides,
  };
}

describe("planEventSuppression (Day 20.3 TASK 4)", () => {
  it("returns empty sets when the batch has no victory event", () => {
    const events = [
      evt({ type: "player_attack", outcome: "hit" }),
      evt({ type: "enemy_attack",  outcome: "miss" }),
    ];
    const { suppressProseAt, skipEntirely } = planEventSuppression(events);
    expect(suppressProseAt.size).toBe(0);
    expect(skipEntirely.size).toBe(0);
  });

  it("marks the last crit before victory for prose suppression", () => {
    // [crit, hit, victory] → suppress crit prose at index 0
    const events = [
      evt({ type: "player_attack", outcome: "crit" }),
      evt({ type: "player_attack", outcome: "hit"  }),
      evt({ type: "victory" }),
    ];
    const { suppressProseAt } = planEventSuppression(events);
    expect(suppressProseAt.has(0)).toBe(true);
    expect(suppressProseAt.size).toBe(1);
  });

  it("only suppresses the LAST crit before victory (most recent killing blow)", () => {
    const events = [
      evt({ type: "player_attack", outcome: "crit" }),  // index 0 — earlier crit
      evt({ type: "enemy_attack",  outcome: "hit"  }),
      evt({ type: "player_attack", outcome: "crit" }),  // index 2 — killing crit
      evt({ type: "victory" }),
    ];
    const { suppressProseAt } = planEventSuppression(events);
    // Only the most recent crit before victory should be marked.
    expect(suppressProseAt.has(2)).toBe(true);
    expect(suppressProseAt.has(0)).toBe(false);
  });

  it("drops kill events entirely when victory is in the batch", () => {
    const events = [
      evt({ type: "player_attack", outcome: "hit" }),
      evt({ type: "kill",          outcome: "kill" }),  // index 1
      evt({ type: "victory" }),
    ];
    const { skipEntirely } = planEventSuppression(events);
    expect(skipEntirely.has(1)).toBe(true);
  });

  it("drops MULTIPLE kill events when victory follows them all", () => {
    const events = [
      evt({ type: "player_attack", outcome: "hit"  }),
      evt({ type: "kill",          outcome: "kill" }),  // 1
      evt({ type: "player_attack", outcome: "hit"  }),
      evt({ type: "kill",          outcome: "kill" }),  // 3
      evt({ type: "victory" }),
    ];
    const { skipEntirely } = planEventSuppression(events);
    expect(skipEntirely.has(1)).toBe(true);
    expect(skipEntirely.has(3)).toBe(true);
  });

  it("kills are NOT skipped when no victory event is in the batch", () => {
    // Mid-fight kill (one of multiple enemies dies; combat continues).
    const events = [
      evt({ type: "player_attack", outcome: "hit"  }),
      evt({ type: "kill",          outcome: "kill" }),
      evt({ type: "enemy_phase_start" }),
      evt({ type: "enemy_attack",  outcome: "hit"  }),
      evt({ type: "player_turn_start" }),
    ];
    const { skipEntirely } = planEventSuppression(events);
    expect(skipEntirely.size).toBe(0);
  });

  it("crit-kill leading to victory: banner renders, prose suppressed, kill dropped", () => {
    // The dramatic case: player crits, killing the last enemy, victory follows.
    // Only ONE LLM call should fire — for victory. Crit shows banner only.
    const events = [
      evt({ type: "player_attack", outcome: "crit" }),  // index 0 — banner only
      evt({ type: "kill",          outcome: "kill" }),  // index 1 — dropped
      evt({ type: "victory" }),                          // index 2 — full banner + prose
    ];
    const { suppressProseAt, skipEntirely } = planEventSuppression(events);
    expect(suppressProseAt.has(0)).toBe(true);
    expect(skipEntirely.has(1)).toBe(true);
    // Victory itself is not in either set — it renders fully.
    expect(suppressProseAt.has(2)).toBe(false);
    expect(skipEntirely.has(2)).toBe(false);
  });

  it("defeat batch is NOT touched (only victory triggers suppression)", () => {
    // Defeat means the player died — no killing crit to dedupe with.
    const events = [
      evt({ type: "enemy_attack", outcome: "crit" }),
      evt({ type: "defeat" }),
    ];
    const { suppressProseAt, skipEntirely } = planEventSuppression(events);
    expect(suppressProseAt.size).toBe(0);
    expect(skipEntirely.size).toBe(0);
  });
});
