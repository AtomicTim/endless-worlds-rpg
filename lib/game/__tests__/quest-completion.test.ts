/**
 * P4 — Quest completion gate enforcement.
 *
 * The narrator never decides completion. This module pins:
 *   - item-condition gate: present → consume + complete; missing →
 *     missing_item, state unchanged.
 *   - non-item condition types: behaviour unchanged (not_item_condition,
 *     no state change).
 *   - already-completed quests: idempotent (quest_not_active).
 *   - id matching: lenient across "item_iron_ring" / "iron_ring" /
 *     display name "Iron Ring".
 *   - narrator payload helper: blocked → quest_gate_blocked +
 *     quest_gate_reason; ready → quest_gate_ready.
 */

import { ItemRarity, ItemType } from "@/types/game";
import type {
  Item,
  MasterState,
  QuestCompletionCondition,
  SideQuest,
} from "@/types/game";
import {
  buildQuestGateNarrativeContext,
  evaluateQuestCondition,
  findCompletableSideQuestsForNpc,
  itemMatchesCondition,
  peekQuestGatesForNpc,
  tryCompleteSideQuest,
} from "@/lib/game/quest-completion";

// ── Fixtures ─────────────────────────────────────────────────────────────────

function makeItem(p: Partial<Item> & { id: string }): Item {
  return {
    id:          p.id,
    name:        p.name ?? p.id,
    type:        p.type ?? ItemType.QUEST_ITEM,
    rarity:      p.rarity ?? ItemRarity.COMMON,
    description: p.description ?? "",
    quantity:    p.quantity ?? 1,
    stackable:   p.stackable ?? false,
    value:       p.value,
  } as Item;
}

function makeQuest(p: Partial<SideQuest> & Pick<SideQuest, "id">): SideQuest {
  return {
    id:                p.id,
    title:             p.title ?? `Quest ${p.id}`,
    status:            p.status ?? "active",
    source_type:       p.source_type ?? "npc",
    source_id:         p.source_id ?? "character_quest_giver",
    current_objective: p.current_objective ?? "Bring the relic.",
    entries:           p.entries ?? [],
    can_fail:          p.can_fail ?? false,
    discovered:        p.discovered ?? true,
    completion_condition: p.completion_condition,
  } as SideQuest;
}

function makeState(opts: {
  inventory?:   Item[];
  sideQuests?:  SideQuest[];
  completedIds?: string[];
} = {}): MasterState {
  return {
    metadata: { session_id: "sess_test" },
    player_state: {
      health:     30,
      max_health: 30,
      resources:  { gold: 0 },
      inventory:  opts.inventory ?? [],
    },
    npc_registry: {},
    quest_threads: {
      side_quests:         opts.sideQuests ?? [],
      faction_alignment:   {},
      completed_quest_ids: opts.completedIds ?? [],
      failed_quest_ids:    [],
    },
  } as unknown as MasterState;
}

// ── itemMatchesCondition — lenient id normalization ──────────────────────────

describe("itemMatchesCondition — lenient id normalization", () => {
  const ring = makeItem({ id: "item_iron_ring", name: "Iron Ring" });

  it("matches when the condition id equals the bare slug", () => {
    expect(itemMatchesCondition(ring, "iron_ring")).toBe(true);
  });
  it("matches when the condition id equals the full item_ form", () => {
    expect(itemMatchesCondition(ring, "item_iron_ring")).toBe(true);
  });
  it("matches when the condition id equals the display name", () => {
    expect(itemMatchesCondition(ring, "Iron Ring")).toBe(true);
  });
  it("matches case-insensitively across punctuation", () => {
    expect(itemMatchesCondition(ring, "  Iron-Ring  ")).toBe(true);
  });
  it("does NOT match an unrelated id", () => {
    expect(itemMatchesCondition(ring, "silver_amulet")).toBe(false);
  });
});

// ── evaluateQuestCondition — peek only ───────────────────────────────────────

describe("evaluateQuestCondition — item-type peek", () => {
  const cond: QuestCompletionCondition = { type: "item", target_id: "iron_ring" };

  it("item present → { success: true }", () => {
    const state = makeState({ inventory: [makeItem({ id: "item_iron_ring", name: "Iron Ring" })] });
    expect(evaluateQuestCondition(state, cond)).toEqual({ success: true });
  });

  it("item missing → { success: false, reason: 'missing_item' }", () => {
    const state = makeState({ inventory: [makeItem({ id: "item_other" })] });
    expect(evaluateQuestCondition(state, cond)).toEqual({ success: false, reason: "missing_item" });
  });

  it("item present but quantity 0 → missing_item (stack-aware)", () => {
    const state = makeState({
      inventory: [makeItem({ id: "item_iron_ring", quantity: 0 })],
    });
    expect(evaluateQuestCondition(state, cond)).toEqual({ success: false, reason: "missing_item" });
  });

  it("non-item condition types return null (P4 does not evaluate them)", () => {
    const state = makeState();
    expect(evaluateQuestCondition(state, { type: "location",        target_id: "x" })).toBeNull();
    expect(evaluateQuestCondition(state, { type: "enemy_defeated",  target_id: "x" })).toBeNull();
    expect(evaluateQuestCondition(state, { type: "npc_return",      target_id: "x" })).toBeNull();
  });
});

// ── tryCompleteSideQuest — peek + mutate ─────────────────────────────────────

describe("tryCompleteSideQuest", () => {
  const quest = makeQuest({
    id:    "sq_ring_delivery",
    title: "Return the Iron Ring",
    completion_condition: { type: "item", target_id: "iron_ring" },
  });

  it("REQUIRED 1 — item condition met: consumes the item, marks the quest completed", () => {
    const ring  = makeItem({ id: "item_iron_ring", name: "Iron Ring" });
    const state = makeState({ inventory: [ring], sideQuests: [quest] });

    const result = tryCompleteSideQuest(state, quest);

    expect("success" in result && result.success).toBe(true);
    if (!("ok" in result) && result.success === true) {
      // Inventory: the ring was the only item, so it's removed entirely.
      expect(result.state.player_state.inventory.find((i) => i.id === "item_iron_ring")).toBeUndefined();
      // Quest: status flipped + id appended to completed_quest_ids.
      const sq = result.state.quest_threads!.side_quests.find((q) => q.id === "sq_ring_delivery");
      expect(sq?.status).toBe("completed");
      expect(result.state.quest_threads!.completed_quest_ids).toContain("sq_ring_delivery");
      expect(result.item_consumed).toBe(true);
    }
  });

  it("REQUIRED 1 — consumes ONE unit when the player holds a stack", () => {
    const stack = makeItem({ id: "item_iron_ring", quantity: 3, stackable: true });
    const state = makeState({ inventory: [stack], sideQuests: [quest] });
    const result = tryCompleteSideQuest(state, quest);
    if (!("success" in result) || result.success !== true) throw new Error("expected success");
    const remaining = result.state.player_state.inventory.find((i) => i.id === "item_iron_ring");
    expect(remaining?.quantity).toBe(2);
  });

  it("REQUIRED 2 — item condition NOT met: state unchanged, missing_item", () => {
    const state  = makeState({ inventory: [makeItem({ id: "item_other" })], sideQuests: [quest] });
    const result = tryCompleteSideQuest(state, quest);

    expect(result).toEqual({ success: false, reason: "missing_item" });
    // Inventory untouched.
    expect(state.player_state.inventory).toHaveLength(1);
    expect(state.player_state.inventory[0].id).toBe("item_other");
    // Quest still active, not in completed list.
    expect(state.quest_threads!.side_quests[0].status).toBe("active");
    expect(state.quest_threads!.completed_quest_ids).not.toContain("sq_ring_delivery");
  });

  it("REQUIRED 3 — non-item condition types: behaviour unchanged (not_item_condition)", () => {
    const locQuest = makeQuest({
      id: "sq_visit_shrine",
      completion_condition: { type: "location", target_id: "the_shrine" },
    });
    const state  = makeState({ sideQuests: [locQuest] });
    const result = tryCompleteSideQuest(state, locQuest);

    expect(result).toEqual({ success: false, reason: "not_item_condition" });
    // Quest still active.
    expect(state.quest_threads!.side_quests[0].status).toBe("active");
  });

  it("already-completed quest → quest_not_active (idempotent)", () => {
    const done = makeQuest({
      id: "sq_done",
      status: "completed",
      completion_condition: { type: "item", target_id: "iron_ring" },
    });
    const result = tryCompleteSideQuest(makeState(), done);
    expect(result).toEqual({ success: false, reason: "quest_not_active" });
  });

  it("quest without a completion_condition → not_item_condition", () => {
    const proseOnly = makeQuest({ id: "sq_prose" });
    const result = tryCompleteSideQuest(makeState(), proseOnly);
    expect(result).toEqual({ success: false, reason: "not_item_condition" });
  });
});

// ── findCompletableSideQuestsForNpc ──────────────────────────────────────────

describe("findCompletableSideQuestsForNpc", () => {
  const npcId = "character_kessian";
  const active = makeQuest({
    id: "sq_for_kessian", source_id: npcId, discovered: true,
    completion_condition: { type: "item", target_id: "iron_ring" },
  });
  const undiscovered = makeQuest({
    id: "sq_hidden", source_id: npcId, discovered: false,
    completion_condition: { type: "item", target_id: "anything" },
  });
  const otherNpc = makeQuest({
    id: "sq_other", source_id: "character_other", discovered: true,
    completion_condition: { type: "item", target_id: "x" },
  });
  const nonItem = makeQuest({
    id: "sq_loc", source_id: npcId, discovered: true,
    completion_condition: { type: "location", target_id: "x" },
  });
  const state = makeState({ sideQuests: [active, undiscovered, otherNpc, nonItem] });

  it("returns ONLY active + discovered + item-condition quests for the named NPC", () => {
    const result = findCompletableSideQuestsForNpc(state, npcId);
    expect(result.map((q) => q.id)).toEqual(["sq_for_kessian"]);
  });

  it("returns [] when npcAssetId is null", () => {
    expect(findCompletableSideQuestsForNpc(state, null)).toEqual([]);
  });
});

// ── peekQuestGatesForNpc + buildQuestGateNarrativeContext ────────────────────

describe("peekQuestGatesForNpc — splits ready vs blocked", () => {
  const npcId = "character_quester";
  const ringQ = makeQuest({
    id: "sq_ring", source_id: npcId,
    completion_condition: { type: "item", target_id: "iron_ring" },
  });
  const sealQ = makeQuest({
    id: "sq_seal", source_id: npcId,
    completion_condition: { type: "item", target_id: "wax_seal" },
  });

  it("player holds the ring but not the seal → ring ready, seal blocked", () => {
    const state = makeState({
      inventory: [makeItem({ id: "item_iron_ring", name: "Iron Ring" })],
      sideQuests: [ringQ, sealQ],
    });
    const peek = peekQuestGatesForNpc(state, npcId);
    expect(peek.ready.map((q) => q.id)).toEqual(["sq_ring"]);
    expect(peek.blocked.map((q) => q.id)).toEqual(["sq_seal"]);
  });
});

describe("buildQuestGateNarrativeContext — narrator payload flags", () => {
  it("REQUIRED 4 — blocked quest → { quest_gate_blocked: true, quest_gate_reason: 'missing_item', quest_id }", () => {
    const blocked = makeQuest({ id: "sq_blocked" });
    const ctx = buildQuestGateNarrativeContext({ ready: [], blocked: [blocked] });
    expect(ctx.quest_gate_blocked).toBe(true);
    expect(ctx.quest_gate_reason).toBe("missing_item");
    expect(ctx.quest_id).toBe("sq_blocked");
    // No "ready" flag when nothing is ready.
    expect(ctx.quest_gate_ready).toBeUndefined();
  });

  it("ready quest → { quest_gate_ready: true, quest_ready_ids: [...] }", () => {
    const ready = makeQuest({ id: "sq_ready" });
    const ctx = buildQuestGateNarrativeContext({ ready: [ready], blocked: [] });
    expect(ctx.quest_gate_ready).toBe(true);
    expect(ctx.quest_ready_ids).toEqual(["sq_ready"]);
    expect(ctx.quest_gate_blocked).toBeUndefined();
  });

  it("no candidates → empty object (no flags injected)", () => {
    expect(buildQuestGateNarrativeContext({ ready: [], blocked: [] })).toEqual({});
  });

  it("both ready AND blocked → both sets of flags ride along", () => {
    const ready   = makeQuest({ id: "sq_a" });
    const blocked = makeQuest({ id: "sq_b" });
    const ctx = buildQuestGateNarrativeContext({ ready: [ready], blocked: [blocked] });
    expect(ctx.quest_gate_ready).toBe(true);
    expect(ctx.quest_gate_blocked).toBe(true);
  });
});
