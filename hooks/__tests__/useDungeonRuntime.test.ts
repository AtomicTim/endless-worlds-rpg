/**
 * Day 23A pt 2 — pure beat helpers from useDungeonRuntime.
 *
 * The hook itself uses React state + the game store, so full
 * end-to-end behaviour lives in manual playtest. The pure
 * string builders + constants below are extracted from the
 * module so they can be pinned in jest:
 *   - roomArrivalBeat(): the first-visit vs revisit branching
 *     that drives rule 86 (revisit suppression) inside dungeons
 *   - useKeyBeat / forceUnlockBeat / bossClearBeat: templated
 *     story-feed lines (no LLM call)
 *   - STR_BYPASS_THRESHOLD: raw STR score required to render
 *     the "Try to Force It" action on the lock popover
 *
 * Coverage rationale: these strings are surfaced to the player.
 * A typo'd beat or wrong threshold would ship to production
 * without tests; pin them.
 */

import {
  STR_BYPASS_THRESHOLD,
  bossClearBeat,
  forceUnlockBeat,
  roomArrivalBeat,
  useKeyBeat,
} from "@/hooks/useDungeonRuntime";
import type { DungeonRoom } from "@/types/game";

function makeRoom(overrides: Partial<DungeonRoom> & { id: string; room_type: DungeonRoom["room_type"] }): DungeonRoom {
  return {
    name:             `Room ${overrides.id}`,
    description:      `A ${overrides.room_type} room.`,
    connections:      [],
    objects:          [],
    encounter_chance: 0.5,
    discovered:       false,
    ...overrides,
  } as DungeonRoom;
}

describe("STR_BYPASS_THRESHOLD", () => {
  it("is the raw STR score (6) — modifier mapping happens elsewhere", () => {
    // Day 22 abilityMod(6) = floor((6-2)/2) = 2 (rule 92); the
    // threshold is the raw stat, NOT the modifier. The UI label
    // surfaces this exact value ("Try to Force It — STR 6").
    expect(STR_BYPASS_THRESHOLD).toBe(6);
  });
});

describe("roomArrivalBeat", () => {
  it("first visit renders the room's full description", () => {
    const room = makeRoom({ id: "d_entrance", room_type: "entrance" });
    expect(roomArrivalBeat(room, false)).toBe("A entrance room.");
  });

  it("first visit falls back to 'You enter X' when description is empty", () => {
    const room = makeRoom({
      id: "d_entrance",
      name: "The Entrance Hall",
      room_type: "entrance",
      description: "",
    });
    expect(roomArrivalBeat(room, false)).toBe("You enter The Entrance Hall.");
  });

  it("revisit applies rule 86 — short return beat instead of description", () => {
    const room = makeRoom({
      id: "d_entrance",
      name: "The Entrance Hall",
      room_type: "entrance",
      description: "A long atmospheric description that should NOT re-render.",
    });
    expect(roomArrivalBeat(room, true)).toBe("You return to The Entrance Hall.");
  });

  it("trims whitespace-only descriptions before deciding fallback", () => {
    const room = makeRoom({
      id: "d_middle",
      name: "The Chamber",
      room_type: "middle",
      description: "   \n  ",
    });
    expect(roomArrivalBeat(room, false)).toBe("You enter The Chamber.");
  });
});

describe("useKeyBeat", () => {
  it("interpolates the key item name into the templated unlock line", () => {
    expect(useKeyBeat("The Warden's Seal")).toBe(
      "You use The Warden's Seal. The door grinds open."
    );
  });
});

describe("forceUnlockBeat / bossClearBeat", () => {
  it("forceUnlockBeat is a fixed templated line (no interpolation)", () => {
    expect(forceUnlockBeat()).toBe(
      "You force the door. The ancient mechanism gives way."
    );
  });
  it("bossClearBeat is the post-victory templated line", () => {
    expect(bossClearBeat()).toBe("The dungeon falls silent.");
  });
});
