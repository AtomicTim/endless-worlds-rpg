import type {
  MainQuest,
  MasterState,
  QuestBreadcrumb,
  QuestThreads,
} from "@/types/game";
import {
  findActOneBreadcrumb,
  isActOneAwaitingDiscovery,
  markActOneDiscovered,
  shouldTriggerBossClearDiscovery,
  shouldTriggerDialogueDiscovery,
} from "@/lib/game/quest-discovery";

/**
 * Day 23B pt 2 — pin the discovery semantics for the Act 1 breadcrumb.
 *
 * Two triggers (first NPC conversation, first dungeon boss clear) share
 * the same discovery rule, and BOTH must be idempotent so a player who
 * triggers one doesn't get a second discovery beat from the other.
 *
 * The pure helpers below (findActOneBreadcrumb / isActOneAwaitingDiscovery
 * / markActOneDiscovered / shouldTriggerDialogueDiscovery /
 * shouldTriggerBossClearDiscovery) own the rule. useGameLoop and
 * useDungeonRuntime read them.
 */

function buildBreadcrumbs(): QuestBreadcrumb[] {
  return [
    { id: "breadcrumb_act1",   act: 1,        content: "The pillars hum at dawn.",     anchor_type: "fixed",    discovered: false },
    { id: "breadcrumb_act2",   act: 2,        content: "The pattern repeats inland.",  anchor_type: "floating", discovered: false },
    { id: "breadcrumb_act3",   act: 3,        content: "Three sites, three keys.",     anchor_type: "floating", discovered: false },
    { id: "breadcrumb_climax", act: "climax", content: "The chamber breathes.",        anchor_type: "fixed",    discovered: false },
  ];
}

function buildQuestThreads(overrides: Partial<MainQuest> = {}): QuestThreads {
  const mainQuest: MainQuest = {
    id:                 "main_quest",
    title:              "Test Quest",
    archetype:          "ancient_awakening",
    threat_description: "Test threat.",
    factions:           [],
    finale_type:        "confrontation",
    breadcrumbs:        buildBreadcrumbs(),
    resolutions: [
      { id: "resolution_a", summary: "A.", tone: "hopeful" },
      { id: "resolution_b", summary: "B.", tone: "dark"    },
    ],
    status:             "active",
    ...overrides,
  };
  return {
    main_quest:          mainQuest,
    side_quests:         [],
    faction_alignment:   {},
    completed_quest_ids: [],
    failed_quest_ids:    [],
  };
}

function buildState(qt: QuestThreads | undefined, flagSet = false): MasterState {
  return {
    quest_threads: qt,
    world_state: {
      flags: flagSet ? { first_npc_conversation_had: true } : {},
    },
  } as unknown as MasterState;
}

// ── findActOneBreadcrumb ─────────────────────────────────────────────────────
describe("findActOneBreadcrumb", () => {
  it("returns the act:1 breadcrumb when present", () => {
    const qt = buildQuestThreads();
    const bc = findActOneBreadcrumb(qt);
    expect(bc).not.toBeNull();
    expect(bc?.id).toBe("breadcrumb_act1");
    expect(bc?.act).toBe(1);
  });

  it("returns null when quest_threads is missing", () => {
    expect(findActOneBreadcrumb(undefined)).toBeNull();
    expect(findActOneBreadcrumb(null)).toBeNull();
  });

  it("returns null when main_quest is missing", () => {
    expect(findActOneBreadcrumb({ side_quests: [], faction_alignment: {}, completed_quest_ids: [], failed_quest_ids: [] } as QuestThreads)).toBeNull();
  });

  it("returns null when breadcrumbs lacks an act:1 entry", () => {
    const qt = buildQuestThreads({ breadcrumbs: buildBreadcrumbs().filter((b) => b.act !== 1) });
    expect(findActOneBreadcrumb(qt)).toBeNull();
  });
});

// ── isActOneAwaitingDiscovery ────────────────────────────────────────────────
describe("isActOneAwaitingDiscovery", () => {
  it("true on a fresh quest_threads", () => {
    expect(isActOneAwaitingDiscovery(buildQuestThreads())).toBe(true);
  });

  it("false after Act 1 is marked discovered", () => {
    const bcs = buildBreadcrumbs();
    bcs[0] = { ...bcs[0], discovered: true };
    expect(isActOneAwaitingDiscovery(buildQuestThreads({ breadcrumbs: bcs }))).toBe(false);
  });

  it("false when no quest threads", () => {
    expect(isActOneAwaitingDiscovery(undefined)).toBe(false);
  });
});

// ── markActOneDiscovered ─────────────────────────────────────────────────────
describe("markActOneDiscovered", () => {
  it("flips discovered: false → true on the Act 1 breadcrumb without mutating input", () => {
    const qt = buildQuestThreads();
    const before = qt.main_quest!.breadcrumbs[0].discovered;
    const after  = markActOneDiscovered(qt);
    expect(before).toBe(false);                                  // input unchanged
    expect(after).not.toBeNull();
    expect(after!.main_quest!.breadcrumbs[0].discovered).toBe(true);
    // Reference inequality — the returned QuestThreads is a fresh object.
    expect(after).not.toBe(qt);
    expect(after!.main_quest).not.toBe(qt.main_quest);
    expect(after!.main_quest!.breadcrumbs).not.toBe(qt.main_quest!.breadcrumbs);
  });

  it("leaves act:2/3/climax untouched", () => {
    const qt = buildQuestThreads();
    const after = markActOneDiscovered(qt)!;
    const bcs = after.main_quest!.breadcrumbs;
    expect(bcs.find((b) => b.id === "breadcrumb_act2")!.discovered).toBe(false);
    expect(bcs.find((b) => b.id === "breadcrumb_act3")!.discovered).toBe(false);
    expect(bcs.find((b) => b.id === "breadcrumb_climax")!.discovered).toBe(false);
  });

  it("returns null when act:1 is already discovered (idempotency signal)", () => {
    const bcs = buildBreadcrumbs();
    bcs[0] = { ...bcs[0], discovered: true };
    expect(markActOneDiscovered(buildQuestThreads({ breadcrumbs: bcs }))).toBeNull();
  });

  it("returns null when quest_threads is missing", () => {
    expect(markActOneDiscovered(undefined)).toBeNull();
    expect(markActOneDiscovered(null)).toBeNull();
  });

  it("returns null when no act:1 breadcrumb exists", () => {
    const qt = buildQuestThreads({ breadcrumbs: buildBreadcrumbs().filter((b) => b.act !== 1) });
    expect(markActOneDiscovered(qt)).toBeNull();
  });
});

// ── shouldTriggerDialogueDiscovery (TRIGGER A) ───────────────────────────────
describe("shouldTriggerDialogueDiscovery", () => {
  it("true when no flag set + act:1 awaiting discovery", () => {
    expect(shouldTriggerDialogueDiscovery(buildState(buildQuestThreads()))).toBe(true);
  });

  it("false when world_state.flags.first_npc_conversation_had === true (idempotent)", () => {
    expect(shouldTriggerDialogueDiscovery(buildState(buildQuestThreads(), true))).toBe(false);
  });

  it("false when act:1 already discovered (idempotent — boss clear ran first)", () => {
    const bcs = buildBreadcrumbs();
    bcs[0] = { ...bcs[0], discovered: true };
    expect(shouldTriggerDialogueDiscovery(buildState(buildQuestThreads({ breadcrumbs: bcs })))).toBe(false);
  });

  it("false when quest_threads is missing (legacy save)", () => {
    expect(shouldTriggerDialogueDiscovery(buildState(undefined))).toBe(false);
  });

  it("false for null/undefined state", () => {
    expect(shouldTriggerDialogueDiscovery(undefined)).toBe(false);
    expect(shouldTriggerDialogueDiscovery(null)).toBe(false);
  });
});

// ── shouldTriggerBossClearDiscovery (TRIGGER B) ──────────────────────────────
describe("shouldTriggerBossClearDiscovery", () => {
  it("true when act:1 awaiting discovery (no world flag dependency)", () => {
    // Boss clear doesn't read first_npc_conversation_had — only the
    // breadcrumb's own discovered field gates it. The lastBossVictoryRef
    // in useDungeonRuntime is the per-room idempotency layer.
    expect(shouldTriggerBossClearDiscovery(buildState(buildQuestThreads()))).toBe(true);
    expect(shouldTriggerBossClearDiscovery(buildState(buildQuestThreads(), true))).toBe(true);
  });

  it("false when act:1 already discovered (cross-trigger idempotency)", () => {
    const bcs = buildBreadcrumbs();
    bcs[0] = { ...bcs[0], discovered: true };
    expect(shouldTriggerBossClearDiscovery(buildState(buildQuestThreads({ breadcrumbs: bcs })))).toBe(false);
  });

  it("false when quest_threads is missing", () => {
    expect(shouldTriggerBossClearDiscovery(buildState(undefined))).toBe(false);
  });
});

// ── End-to-end idempotency simulation ───────────────────────────────────────
describe("discovery idempotency across both triggers", () => {
  it("Trigger A fires once, Trigger B becomes no-op afterwards", () => {
    // Initial state: both triggers eligible.
    const initial = buildQuestThreads();
    expect(shouldTriggerDialogueDiscovery(buildState(initial))).toBe(true);
    expect(shouldTriggerBossClearDiscovery(buildState(initial))).toBe(true);

    // Trigger A fires: mark act:1 discovered + set world flag.
    const afterA = markActOneDiscovered(initial)!;
    expect(afterA).not.toBeNull();
    const stateAfterA = buildState(afterA, true);

    // Trigger A predicate is now false (flag set + discovered).
    expect(shouldTriggerDialogueDiscovery(stateAfterA)).toBe(false);
    // Trigger B predicate is also false (discovered).
    expect(shouldTriggerBossClearDiscovery(stateAfterA)).toBe(false);
    // Second call to markActOneDiscovered returns null.
    expect(markActOneDiscovered(afterA)).toBeNull();
  });

  it("Trigger B fires first, Trigger A becomes no-op afterwards", () => {
    const initial = buildQuestThreads();
    // Trigger B fires (boss cleared before any NPC convo): only flips
    // the breadcrumb, doesn't touch the world flag.
    const afterB = markActOneDiscovered(initial)!;
    expect(afterB).not.toBeNull();
    const stateAfterB = buildState(afterB, false);

    // Trigger A is blocked by the breadcrumb's discovered field even
    // though first_npc_conversation_had remains false.
    expect(shouldTriggerDialogueDiscovery(stateAfterB)).toBe(false);
    expect(shouldTriggerBossClearDiscovery(stateAfterB)).toBe(false);
  });
});
