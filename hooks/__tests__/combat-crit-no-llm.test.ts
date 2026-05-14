/**
 * HF1 FIX 1 — crits render ONLY the templated banner line.
 *
 * Rule 54's two-line crit (templated banner + LLM prose) is reversed.
 * A critical hit must NOT call /api/game/narrate-combat — the templated
 * "⚔ CRITICAL HIT — N damage." line plus its roll-detail suffix is the
 * entire render.
 *
 * This pins:
 *   1. isDramaticEvent(crit) === false — crit no longer routes to LLM.
 *   2. projectCombatEventsToFeed never calls fetch for a crit event,
 *      and emits exactly one COMBAT message flagged is_crit_banner.
 */

import type { CombatEvent, CombatState, PlayerState } from "@/types/game";
import { isDramaticEvent, projectCombatEventsToFeed } from "@/hooks/useCombat";

function makeCombatEvent(
  p: Partial<CombatEvent> & { type: CombatEvent["type"] }
): CombatEvent {
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

const combatStub = {
  active:             true,
  encounter_id:       "enc_test",
  enemies:            [{ instance_id: "g1", name: "Goblin", description: "", behavior_flavor: "", alive: true }],
  turn_order:         ["PLAYER", "g1"],
  current_turn_index: 0,
  round_number:       1,
  player_defending:   false,
  combat_log:         [],
  origin_node_id:     "node_test",
  pre_combat_xp:      0,
} as unknown as CombatState;

const playerStub = { name: "TestHero", background: "knight" } as unknown as PlayerState;

describe("isDramaticEvent — crit is no longer dramatic (HF1 FIX 1)", () => {
  it("returns false for a crit player_attack", () => {
    expect(
      isDramaticEvent(makeCombatEvent({ type: "player_attack", outcome: "crit" }))
    ).toBe(false);
  });

  it("returns false for a crit enemy_attack", () => {
    expect(
      isDramaticEvent(makeCombatEvent({ type: "enemy_attack", actor: "g1", outcome: "crit" }))
    ).toBe(false);
  });

  it("still returns true for victory / defeat / kill (LLM-narrated)", () => {
    expect(isDramaticEvent(makeCombatEvent({ type: "victory" }))).toBe(true);
    expect(isDramaticEvent(makeCombatEvent({ type: "defeat" }))).toBe(true);
    expect(isDramaticEvent(makeCombatEvent({ type: "kill", outcome: "kill" }))).toBe(true);
  });
});

describe("projectCombatEventsToFeed — crit makes NO narrate-combat call (HF1 FIX 1)", () => {
  let fetchMock: jest.Mock;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    fetchMock = jest.fn(() =>
      Promise.resolve(new Response(JSON.stringify({ text: "should never be used" }), { status: 200 }))
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("a crit player_attack emits one banner message and never hits the LLM endpoint", async () => {
    const addMessage = jest.fn();
    const critEvent = makeCombatEvent({
      type:         "player_attack",
      actor:        "PLAYER",
      target:       "g1",
      outcome:      "crit",
      damage_dealt: 12,
    });

    await projectCombatEventsToFeed({
      events:           [critEvent],
      combat:           combatStub,
      player:           playerStub,
      world_genre:      "fantasy",
      regionAtmosphere: "",
      locationName:     "Test Crypt",
      addMessage,
      setDisplayPhase:  jest.fn(),
      emitFloat:        jest.fn(),
    });

    // No LLM call at all.
    expect(fetchMock).not.toHaveBeenCalled();

    // Exactly one feed message — the templated crit banner.
    expect(addMessage).toHaveBeenCalledTimes(1);
    const msg = addMessage.mock.calls[0][0];
    expect(msg.type).toBe("COMBAT");
    expect(msg.metadata.is_crit_banner).toBe(true);
    expect(msg.content).toBe("⚔ CRITICAL HIT — 12 damage.");
    // No crit-prose message was pushed.
    expect(
      addMessage.mock.calls.some((c) => c[0]?.metadata?.is_crit_prose === true)
    ).toBe(false);
  });
});
