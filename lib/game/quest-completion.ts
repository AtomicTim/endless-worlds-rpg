/**
 * P4 — Quest completion gate enforcement (pure resolver).
 *
 * The narrator never decides quest completion. Item-type
 * QuestCompletionCondition is enforced HERE: the player must hold the
 * required item in inventory; on success one unit is consumed and the
 * quest moves to "completed". On failure the caller is told why so it
 * can flag the narrator payload with `quest_gate_blocked` for a
 * deflect response (NPC says they're still waiting, etc.).
 *
 * Only `type === "item"` is implemented in this prompt (CLAUDE.md
 * MERCHANT TRADING note: "Quest completion gates (type === 'item')
 * must be mechanically enforced (P4)"). The other condition types
 * (`location`, `enemy_defeated`, `npc_return`) are accepted but
 * unevaluated — their gates are out of scope for P4 and behaviour is
 * unchanged for those quests.
 */

import type {
  Item,
  MasterState,
  QuestCompletionCondition,
  SideQuest,
} from "@/types/game";
import { removeFromInventory } from "./state-utils";

// ─────────────────────────────────────────────────────────────────────────────
// Item id matching
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalize an id-like string so a generator-supplied `target_id`
 * ("iron_ring") matches a real Item.id ("item_iron_ring") or
 * Item.name ("Iron Ring"). Strips an "item_" prefix, lowercases, and
 * folds non-alphanumerics to a single underscore.
 */
function normItemId(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/^item_/, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** True when this item satisfies the condition's target_id (matched
 *  by id or name with normalization). */
export function itemMatchesCondition(item: Item, targetId: string): boolean {
  const target = normItemId(targetId);
  if (!target) return false;
  return normItemId(item.id) === target || normItemId(item.name) === target;
}

/** Does the player hold at least one unit of the conditioned item? */
export function playerHoldsConditionItem(state: MasterState, targetId: string): boolean {
  return state.player_state.inventory.some(
    (i) => (i.quantity ?? 0) > 0 && itemMatchesCondition(i, targetId),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Condition evaluation (peek — no mutation)
// ─────────────────────────────────────────────────────────────────────────────

export type ConditionEval =
  | { success: true }
  | { success: false; reason: "missing_item" };

/**
 * Peek-evaluate a quest completion condition. Returns null for
 * condition types this prompt does not enforce (P4 only handles
 * `item`). Pure — no state mutation.
 */
export function evaluateQuestCondition(
  state:     MasterState,
  condition: QuestCompletionCondition,
): ConditionEval | null {
  if (condition.type !== "item") return null;
  return playerHoldsConditionItem(state, condition.target_id)
    ? { success: true }
    : { success: false, reason: "missing_item" };
}

// ─────────────────────────────────────────────────────────────────────────────
// NPC → completable quests
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Active side quests where this NPC is the source AND the quest has
 * already been discovered AND its completion_condition is item-type.
 * Used by the dialogue gate at the NPC-dialogue handler to decide
 * whether to peek-evaluate the gate this turn.
 *
 * Quests must be discovered first (the player needs to know they have
 * a quest); same-turn discover-and-complete is intentionally a
 * two-turn flow.
 */
export function findCompletableSideQuestsForNpc(
  state:        MasterState,
  npcAssetId:   string | null | undefined,
): SideQuest[] {
  if (!npcAssetId) return [];
  const quests = state.quest_threads?.side_quests ?? [];
  return quests.filter((q) =>
    q.source_id === npcAssetId &&
    q.status === "active" &&
    q.discovered === true &&
    q.completion_condition?.type === "item",
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Try-complete (peek + mutate in one)
// ─────────────────────────────────────────────────────────────────────────────

export type QuestGateOutcome =
  | { success: true;  item_consumed: true;  state: MasterState }
  | { success: false; reason: "missing_item" }
  | { success: false; reason: "not_item_condition" }
  | { success: false; reason: "quest_not_active" };

/**
 * Attempt to complete a side quest's item gate.
 *
 *   item present → remove one unit from inventory, mark the quest
 *                  completed (status="completed" + push to
 *                  completed_quest_ids), return success + new state.
 *   item missing → state unchanged, return missing_item.
 *   non-item     → state unchanged, return not_item_condition
 *                  (behaviour for other condition types is unchanged
 *                  by this prompt).
 *
 * Idempotent against already-completed quests — they return
 * quest_not_active without mutating.
 */
export function tryCompleteSideQuest(
  state: MasterState,
  quest: SideQuest,
): QuestGateOutcome {
  if (quest.status !== "active") {
    return { success: false, reason: "quest_not_active" };
  }
  const cond = quest.completion_condition;
  if (!cond || cond.type !== "item") {
    return { success: false, reason: "not_item_condition" };
  }
  const itemIdx = state.player_state.inventory.findIndex(
    (i) => (i.quantity ?? 0) > 0 && itemMatchesCondition(i, cond.target_id),
  );
  if (itemIdx < 0) {
    return { success: false, reason: "missing_item" };
  }
  const heldItem = state.player_state.inventory[itemIdx];
  const consumed = removeFromInventory(state, heldItem.id, 1);
  const completed = markSideQuestCompleted(consumed, quest.id);
  return { success: true, item_consumed: true, state: completed };
}

/** Immutably set a side quest's status to "completed" and push its id
 *  onto completed_quest_ids (deduped). */
function markSideQuestCompleted(state: MasterState, questId: string): MasterState {
  const qt = state.quest_threads;
  if (!qt) return state;
  const nextSide = (qt.side_quests ?? []).map((q) =>
    q.id === questId ? { ...q, status: "completed" as const } : q,
  );
  const completedIds = qt.completed_quest_ids ?? [];
  const nextCompleted = completedIds.includes(questId)
    ? completedIds
    : [...completedIds, questId];
  return {
    ...state,
    quest_threads: {
      ...qt,
      side_quests:         nextSide,
      completed_quest_ids: nextCompleted,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Narrative context payload
// ─────────────────────────────────────────────────────────────────────────────

export interface QuestGatePeek {
  /** Side quests whose item gate is satisfied right now — the game
   *  loop will mark them completed AFTER narration. */
  ready:   SideQuest[];
  /** Side quests whose item gate is currently blocked. The narrator
   *  gets `quest_gate_blocked: true` so the NPC can express that the
   *  item hasn't been delivered yet. */
  blocked: SideQuest[];
}

/**
 * Build the narrative_context fragment the narrator reads to drive
 * its deflect / acknowledgement response. The narrator only DESCRIBES;
 * the actual quest mutation happens in code (tryCompleteSideQuest).
 *
 *   blocked.length > 0 → `{ quest_gate_blocked: true,
 *                           quest_gate_reason: "missing_item",
 *                           quest_id: <first blocked id> }`
 *   ready.length   > 0 → `{ quest_gate_ready: true,
 *                           quest_ready_ids: [<ids…>] }`
 *
 * When neither, returns an empty object (a no-op spread at the
 * call site). Pure — never mutates inputs.
 */
export function buildQuestGateNarrativeContext(
  peek: QuestGatePeek,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (peek.blocked.length > 0) {
    out.quest_gate_blocked = true;
    out.quest_gate_reason  = "missing_item";
    out.quest_id           = peek.blocked[0].id;
  }
  if (peek.ready.length > 0) {
    out.quest_gate_ready = true;
    out.quest_ready_ids  = peek.ready.map((q) => q.id);
  }
  return out;
}

/**
 * One-shot peek over every candidate quest for an NPC. Splits the
 * candidates into `ready` vs `blocked` per the item-condition check.
 * `ready` and `blocked` mirror the SideQuest objects (not just ids)
 * so the caller can read `quest.title` etc. for log entries / feed
 * beats without re-looking-up.
 */
export function peekQuestGatesForNpc(
  state:      MasterState,
  npcAssetId: string | null | undefined,
): QuestGatePeek {
  const ready:   SideQuest[] = [];
  const blocked: SideQuest[] = [];
  for (const quest of findCompletableSideQuestsForNpc(state, npcAssetId)) {
    const cond = quest.completion_condition;
    if (!cond) continue;
    const r = evaluateQuestCondition(state, cond);
    if (r?.success === true) ready.push(quest);
    else if (r?.success === false && r.reason === "missing_item") blocked.push(quest);
  }
  return { ready, blocked };
}
