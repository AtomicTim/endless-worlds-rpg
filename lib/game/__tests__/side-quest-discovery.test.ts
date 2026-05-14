import type {
  NPCDefinition,
  QuestThreads,
  SideQuest,
} from "@/types/game";
import {
  findUndiscoveredSideQuestForNpc,
  markSideQuestDiscovered,
} from "@/lib/game/quest-discovery";
import {
  filterQuestHookNpcs,
  mergeSideQuests,
} from "@/lib/game/side-quest-generator";

/**
 * Day 23D (V8.66) — side quest discovery + dedup regression.
 *
 * Pins three behaviors the runtime depends on:
 *   1. quest_hook NPCs are filtered out of the full RegionBible NPC
 *      array correctly (apply-regional-bible feeds this into the
 *      generator).
 *   2. SideQuest id dedup in mergeSideQuests (apply-regional-bible is
 *      idempotent per rule 35; re-application must NOT add a quest
 *      twice).
 *   3. Discovery trigger flips `discovered: true` on first NPC convo
 *      AND becomes a no-op on subsequent convos with the same NPC.
 */

function makeNpc(overrides: Partial<NPCDefinition> = {}): NPCDefinition {
  return {
    id:               "character_test",
    name:             "Test NPC",
    home_location_id: "test_node",
    role:             "patron",
    archetype:        "townsfolk",
    appearance:       "",
    personality:      "",
    speech_style:     "",
    knowledge:        [],
    default_trust:    50,
    ...overrides,
  };
}

function makeSideQuest(overrides: Partial<SideQuest> = {}): SideQuest {
  return {
    id:                "test_quest_1",
    title:             "The Waiting Shipment",
    status:            "active",
    source_type:       "npc",
    source_id:         "character_marta",
    giver_name:        "Marta",
    region_id:         "salt_plains",
    discovery_trigger: "npc_dialogue",
    current_objective: "Find out what happened to the eastern pass shipment.",
    entries:           [],
    can_fail:          false,
    discovered:        false,
    ...overrides,
  };
}

function makeQt(quests: SideQuest[]): QuestThreads {
  return {
    side_quests:         quests,
    faction_alignment:   {},
    completed_quest_ids: [],
    failed_quest_ids:    [],
  };
}

describe("filterQuestHookNpcs", () => {
  it("returns only NPCs with quest_hook === true", () => {
    const npcs: NPCDefinition[] = [
      makeNpc({ id: "character_marta",  quest_hook: true,  quest_seed: "Waiting on a shipment." }),
      makeNpc({ id: "character_kell",   quest_hook: false }),
      makeNpc({ id: "character_lyric"  }), // no quest_hook field at all
      makeNpc({ id: "character_eric",   quest_hook: true,  quest_seed: "Searching for a grave." }),
    ];
    const filtered = filterQuestHookNpcs(npcs);
    expect(filtered.map((n) => n.id)).toEqual(["character_marta", "character_eric"]);
  });

  it("returns empty array when no quest_hook NPCs", () => {
    const npcs: NPCDefinition[] = [
      makeNpc({ id: "character_kell" }),
      makeNpc({ id: "character_lyric" }),
    ];
    expect(filterQuestHookNpcs(npcs)).toEqual([]);
  });

  it("returns empty array when input is empty", () => {
    expect(filterQuestHookNpcs([])).toEqual([]);
  });
});

describe("mergeSideQuests — id dedup", () => {
  it("appends new quests to an empty existing array", () => {
    const fresh = [makeSideQuest({ id: "q1" }), makeSideQuest({ id: "q2" })];
    expect(mergeSideQuests([], fresh)).toEqual(fresh);
  });

  it("appends only quests whose id is not already in the existing array", () => {
    const existing = [makeSideQuest({ id: "q1", title: "Existing Q1" })];
    const fresh    = [makeSideQuest({ id: "q1", title: "Re-emitted Q1" }), makeSideQuest({ id: "q2" })];
    const merged   = mergeSideQuests(existing, fresh);
    expect(merged.length).toBe(2);
    // The existing q1 is preserved verbatim — player progress on it
    // (entries, status) is NEVER overwritten by re-applying the RB.
    expect(merged[0].title).toBe("Existing Q1");
    expect(merged[1].id).toBe("q2");
  });

  it("is fully idempotent: re-applying the same fresh array twice never duplicates", () => {
    const fresh = [makeSideQuest({ id: "q1" }), makeSideQuest({ id: "q2" })];
    const once  = mergeSideQuests([], fresh);
    const twice = mergeSideQuests(once, fresh);
    expect(twice.length).toBe(2);
    expect(twice.map((q) => q.id)).toEqual(["q1", "q2"]);
  });
});

describe("findUndiscoveredSideQuestForNpc", () => {
  it("returns the matching undiscovered quest", () => {
    const qt = makeQt([
      makeSideQuest({ id: "q1", source_id: "character_marta", discovered: false }),
      makeSideQuest({ id: "q2", source_id: "character_kell",  discovered: false }),
    ]);
    const found = findUndiscoveredSideQuestForNpc(qt, "character_marta");
    expect(found?.id).toBe("q1");
  });

  it("returns null when the matching quest is already discovered", () => {
    const qt = makeQt([
      makeSideQuest({ id: "q1", source_id: "character_marta", discovered: true }),
    ]);
    expect(findUndiscoveredSideQuestForNpc(qt, "character_marta")).toBeNull();
  });

  it("returns null when no quest matches the NPC id", () => {
    const qt = makeQt([
      makeSideQuest({ id: "q1", source_id: "character_marta", discovered: false }),
    ]);
    expect(findUndiscoveredSideQuestForNpc(qt, "character_unknown")).toBeNull();
  });

  it("returns null for null/undefined inputs (legacy save defense)", () => {
    expect(findUndiscoveredSideQuestForNpc(null, "character_x")).toBeNull();
    expect(findUndiscoveredSideQuestForNpc(undefined, "character_x")).toBeNull();
    expect(findUndiscoveredSideQuestForNpc(makeQt([]), null)).toBeNull();
    expect(findUndiscoveredSideQuestForNpc(makeQt([]), undefined)).toBeNull();
  });
});

describe("markSideQuestDiscovered", () => {
  it("flips discovered: false → true without mutating input", () => {
    const original = makeQt([makeSideQuest({ id: "q1", discovered: false })]);
    const updated  = markSideQuestDiscovered(original, "q1");
    expect(updated).not.toBeNull();
    expect(updated!.side_quests[0].discovered).toBe(true);
    // Original untouched.
    expect(original.side_quests[0].discovered).toBe(false);
    // Fresh object identity (no in-place mutation).
    expect(updated).not.toBe(original);
    expect(updated!.side_quests).not.toBe(original.side_quests);
  });

  it("returns null when the quest is already discovered (idempotency)", () => {
    const qt = makeQt([makeSideQuest({ id: "q1", discovered: true })]);
    expect(markSideQuestDiscovered(qt, "q1")).toBeNull();
  });

  it("returns null when no quest matches the id", () => {
    const qt = makeQt([makeSideQuest({ id: "q1" })]);
    expect(markSideQuestDiscovered(qt, "nonexistent")).toBeNull();
  });

  it("only flips the matching quest — others stay untouched", () => {
    const qt = makeQt([
      makeSideQuest({ id: "q1", discovered: false }),
      makeSideQuest({ id: "q2", discovered: false }),
      makeSideQuest({ id: "q3", discovered: false }),
    ]);
    const updated = markSideQuestDiscovered(qt, "q2")!;
    expect(updated.side_quests[0].discovered).toBe(false);
    expect(updated.side_quests[1].discovered).toBe(true);
    expect(updated.side_quests[2].discovered).toBe(false);
  });
});

describe("discovery idempotency end-to-end", () => {
  it("first convo flips discovered, second convo returns null (no re-fire)", () => {
    const qt = makeQt([
      makeSideQuest({ id: "q1", source_id: "character_marta", discovered: false }),
    ]);
    // First conversation: predicate finds the quest.
    const firstFind = findUndiscoveredSideQuestForNpc(qt, "character_marta");
    expect(firstFind?.id).toBe("q1");
    // Mark discovered.
    const afterFirst = markSideQuestDiscovered(qt, firstFind!.id)!;
    expect(afterFirst.side_quests[0].discovered).toBe(true);
    // Second conversation: predicate finds nothing.
    const secondFind = findUndiscoveredSideQuestForNpc(afterFirst, "character_marta");
    expect(secondFind).toBeNull();
    // Mutation also returns null.
    expect(markSideQuestDiscovered(afterFirst, "q1")).toBeNull();
  });
});
