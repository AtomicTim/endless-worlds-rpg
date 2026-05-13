import type { MasterState, QuestBreadcrumb, QuestThreads } from "@/types/game";

/**
 * Day 23B pt 2 — pure helpers for quest discovery triggers.
 *
 * The two triggers (first NPC conversation, first dungeon boss clear)
 * share the same discovery semantics:
 *   • Find the Act 1 breadcrumb (act === 1) in quest_threads.main_quest.
 *   • If it is still discovered: false, mark it discovered: true.
 *   • Both triggers are IDEMPOTENT — once the breadcrumb is discovered
 *     by either path, the other path's check returns null cleanly.
 *
 * The pure helpers below are consumed by useGameLoop (TRIGGER A) and
 * useDungeonRuntime (TRIGGER B). Keeping the logic outside the hooks
 * lets us unit-test the rule without React-testing-library noise.
 */

/**
 * Find the Act 1 breadcrumb (regardless of discovered state). Returns
 * null if no main quest, no breadcrumbs array, or no act:1 entry.
 */
export function findActOneBreadcrumb(
  qt: QuestThreads | undefined | null
): QuestBreadcrumb | null {
  const bcs = qt?.main_quest?.breadcrumbs;
  if (!Array.isArray(bcs)) return null;
  return bcs.find((b) => b.act === 1) ?? null;
}

/**
 * True when the Act 1 breadcrumb exists AND is still undiscovered. The
 * discovery triggers check this before mutating quest_threads so the
 * mutation never runs twice.
 */
export function isActOneAwaitingDiscovery(
  qt: QuestThreads | undefined | null
): boolean {
  const bc = findActOneBreadcrumb(qt);
  return bc !== null && bc.discovered === false;
}

/**
 * Returns an updated QuestThreads with the Act 1 breadcrumb's
 * `discovered` field flipped to true. Pure: never mutates input.
 *
 * Returns null when:
 *   • quest_threads is missing
 *   • main_quest is missing
 *   • no act:1 breadcrumb in breadcrumbs
 *   • the breadcrumb is already discovered (the canonical idempotency
 *     signal — caller skips its side effects when this returns null)
 */
export function markActOneDiscovered(
  qt: QuestThreads | undefined | null
): QuestThreads | null {
  if (!qt?.main_quest) return null;
  const bcs = qt.main_quest.breadcrumbs;
  if (!Array.isArray(bcs)) return null;
  const idx = bcs.findIndex((b) => b.act === 1);
  if (idx === -1) return null;
  if (bcs[idx].discovered === true) return null;

  const updatedBcs = bcs.slice();
  updatedBcs[idx] = { ...updatedBcs[idx], discovered: true };

  return {
    ...qt,
    main_quest: {
      ...qt.main_quest,
      breadcrumbs: updatedBcs,
    },
  };
}

/**
 * TRIGGER A predicate — should the first-NPC-conversation hook fire on
 * this MasterState transition? Caller has already confirmed the action
 * was a successful DIALOGUE; this is the breadcrumb-side gate.
 *
 * Returns true when:
 *   • world_state.flags.first_npc_conversation_had !== true
 *   • Act 1 breadcrumb exists AND is undiscovered
 *
 * Idempotent: once first_npc_conversation_had is set, this stays false.
 */
export function shouldTriggerDialogueDiscovery(
  state: MasterState | null | undefined
): boolean {
  if (!state) return false;
  const flag = state.world_state.flags?.first_npc_conversation_had;
  if (flag === true) return false;
  return isActOneAwaitingDiscovery(state.quest_threads);
}

/**
 * TRIGGER B predicate — should the boss-clear hook discover Act 1? Combat
 * resolution and boss-room checks are gated upstream in useDungeonRuntime;
 * this isolates the breadcrumb-side gate so the test pins what matters.
 *
 * Returns true when the Act 1 breadcrumb is still undiscovered. Unlike
 * Trigger A there is no world_state flag — the boss-clear ref in
 * useDungeonRuntime already prevents repeat fires for the same room.
 */
export function shouldTriggerBossClearDiscovery(
  state: MasterState | null | undefined
): boolean {
  if (!state) return false;
  return isActOneAwaitingDiscovery(state.quest_threads);
}

// ── Day 23D — Side quest discovery ──────────────────────────────────────────

import type { SideQuest } from "@/types/game";

/**
 * Find an undiscovered side quest whose source_id matches the given NPC
 * id. Returns null when no match — meaning the conversation doesn't
 * trigger a discovery this turn. The lookup is O(n) over side_quests;
 * for the ~10-50 quest ceiling of a long playthrough that's fine.
 *
 * Pure: never mutates input.
 */
export function findUndiscoveredSideQuestForNpc(
  qt:    import("@/types/game").QuestThreads | undefined | null,
  npcId: string | null | undefined,
): SideQuest | null {
  if (!qt || !npcId) return null;
  const quests = qt.side_quests ?? [];
  return quests.find(
    (q) => q.source_id === npcId && q.discovered !== true,
  ) ?? null;
}

/**
 * Returns updated quest_threads with the named side quest's discovered
 * field flipped to true. Null when:
 *   • no quest_threads
 *   • no quest matches questId
 *   • the quest is already discovered (idempotency signal)
 * Pure: never mutates input.
 */
export function markSideQuestDiscovered(
  qt:      import("@/types/game").QuestThreads | undefined | null,
  questId: string,
): import("@/types/game").QuestThreads | null {
  if (!qt) return null;
  const quests = qt.side_quests ?? [];
  const idx = quests.findIndex((q) => q.id === questId);
  if (idx === -1) return null;
  if (quests[idx].discovered === true) return null;
  const updated = quests.slice();
  updated[idx] = { ...updated[idx], discovered: true };
  return { ...qt, side_quests: updated };
}
