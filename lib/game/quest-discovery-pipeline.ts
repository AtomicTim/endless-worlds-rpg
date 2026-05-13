"use client";

import { useEffect, useRef } from "react";
import { useGameStore, makeMessage } from "@/lib/stores/game-store";
import { addLogEntry } from "@/lib/game/state-utils";
import { saveQuestThreadsAsync } from "@/hooks/useGameLoop";
import {
  findActOneBreadcrumb,
  markActOneDiscovered,
  shouldTriggerBossClearDiscovery,
  shouldTriggerDialogueDiscovery,
} from "@/lib/game/quest-discovery";
import { LogEntryType } from "@/types/game";
import type { MasterState, QuestEntry } from "@/types/game";

/**
 * Day 23C — Act 1 quest discovery pipeline.
 *
 * Both triggers (NPC dialogue, dungeon boss clear) feed into the same
 * delayed pipeline so the discovery beat lands as a separate dramatic
 * moment rather than synchronously with the action that caused it.
 *
 * Timeline (DISCOVERY_DELAY_MS after the trigger fires):
 *   1. Re-check the predicate against the LATEST master state. The state
 *      may have shifted in the 1.2s window — another action, a save reload,
 *      or the other trigger landing first. Bail cleanly if the breadcrumb
 *      already discovered or quest_threads cleared.
 *   2. Mark the Act 1 breadcrumb discovered (pure mutation via
 *      markActOneDiscovered).
 *   3. For "dialogue" trigger only: set the
 *      world_state.flags.first_npc_conversation_had flag so the trigger
 *      itself becomes idempotent at the gate, not just the breadcrumb.
 *   4. Add a QUEST log book entry (rule: "QUEST — {breadcrumb.content}")
 *      via persistLogEntry. Log Book renders this with the QUEST tag.
 *   5. Commit the new MasterState.
 *   6. Emit the ✦ discovery beat to the story feed (SYSTEM message,
 *      metadata.quest_discovery: true).
 *   7. Open the QuestRevealModal cinematic (Act 1 only — set
 *      pendingQuestReveal). Acts 2/3 (future) skip this step.
 *   8. Fire-and-forget: persist the new quest_threads via
 *      saveQuestThreadsAsync.
 *   9. Fire-and-forget: POST /api/game/generate-journal-entry, then
 *      append the entry to main_quest.journal_entries + persist again.
 *
 * Returns nothing — the caller is fire-and-forget. The setTimeout handle
 * isn't tracked; both triggers use lastBossVictoryRef / world flag
 * idempotency to prevent duplicate schedules within the same playthrough.
 */

export const DISCOVERY_DELAY_MS = 1200;

export interface SchedulePipelineParams {
  trigger:    "dialogue" | "boss_clear";
  /** Optional context for diagnostic logging. */
  npcName?:   string | null;
  /** Optional context for diagnostic logging. */
  roomId?:    string | null;
}

export function scheduleActOneDiscovery(params: SchedulePipelineParams): void {
  if (typeof window === "undefined") return;
  // Plain setTimeout (not window.setTimeout) so Jest fake timers can
  // intercept the schedule deterministically. In a browser the two
  // resolve to the same callable; under jsdom they diverge.
  setTimeout(() => runActOneDiscovery(params), DISCOVERY_DELAY_MS);
}

/**
 * Run the discovery sequence NOW (skip the delay). Exposed for tests so
 * the timed behavior is verified separately from the state-mutation
 * behavior.
 */
export function runActOneDiscovery({ trigger, npcName, roomId }: SchedulePipelineParams): void {
  const store = useGameStore.getState();
  const state = store.masterState;
  if (!state) return;

  // Re-check the predicate against current state (the 1.2s window may
  // have changed things — another action, the other trigger firing first).
  const eligible =
    trigger === "dialogue"
      ? shouldTriggerDialogueDiscovery(state)
      : shouldTriggerBossClearDiscovery(state);
  if (!eligible) return;

  const act1      = findActOneBreadcrumb(state.quest_threads);
  const updatedQt = markActOneDiscovered(state.quest_threads);
  if (!act1 || !updatedQt) return;

  // For dialogue trigger only — set the world-state flag so re-firing the
  // predicate stays false even if something else clears the breadcrumb.
  // Boss-clear has its own per-room lastBossVictoryRef gate.
  const updatedFlags =
    trigger === "dialogue"
      ? { ...state.world_state.flags, first_npc_conversation_had: true }
      : state.world_state.flags;

  // QUEST log entry. Short, no LLM — the richer diary entry comes later.
  // Mirror persistLogEntry from useGameLoop (addLogEntry + addPersistedLogEntry)
  // so the Log Book sidebar surfaces the entry immediately, not just on the
  // next reload.
  const afterLog = addLogEntry(
    {
      ...state,
      world_state:   { ...state.world_state, flags: updatedFlags },
      quest_threads: updatedQt,
    },
    LogEntryType.QUEST,
    `QUEST — ${act1.content}`
  );
  const latestLogEntry = afterLog.log_book.entries[0];
  if (latestLogEntry) {
    store.addPersistedLogEntry(latestLogEntry);
  }

  store.setMasterState(afterLog);

  // Feed: ✦ amber/gold serif italic.
  store.addMessage(
    makeMessage("SYSTEM", act1.content, {
      quest_discovery: true,
      breadcrumb_id:   act1.id,
      act:             1,
      trigger,
    })
  );

  // Act 1 only — cinematic reveal modal. (Acts 2/3 land in the feed only.)
  if (act1.act === 1) {
    store.setPendingQuestReveal({
      breadcrumb_id: act1.id,
      content:       act1.content,
      act:           1,
    });
  }

  // Persist quest_threads (breadcrumb.discovered + log entry rides along
  // with the master_state via the 10-action auto-save; quest_threads
  // alone lands now so a reload mid-pipeline doesn't lose the flip).
  saveQuestThreadsAsync(afterLog.metadata.session_id, updatedQt);

  console.log(
    `[QuestDiscovery] Act 1 breadcrumb discovered via ${trigger}` +
    (npcName ? ` (npc: ${npcName})` : "") +
    (roomId  ? ` (room: ${roomId})`  : "") +
    `. Generating journal entry…`
  );

  // Fire-and-forget journal entry generation. On success: append the
  // entry to main_quest.journal_entries and persist again.
  void (async () => {
    try {
      const wcd = afterLog.metadata.world_consistency;
      const mq  = updatedQt.main_quest!;
      const res = await fetch("/api/game/generate-journal-entry", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id:         afterLog.metadata.session_id,
          quest_title:        mq.title,
          breadcrumb_content: act1.content,
          world_name:         wcd?.world_name ?? "this world",
          player_name:        afterLog.player_state.name,
          player_class:       afterLog.player_state.background,
          archetype:          mq.archetype,
        }),
      });
      if (!res.ok) {
        console.warn("[QuestDiscovery] journal-entry generation failed:", res.status);
        return;
      }
      const data = await res.json() as { entry_text?: string };
      const entryText = (data.entry_text ?? "").trim();
      if (!entryText) return;

      const latest = useGameStore.getState().masterState;
      if (!latest?.quest_threads?.main_quest) return;
      const entry: QuestEntry = {
        id:        `qe_${act1.id}_${Date.now()}`,
        quest_id:  act1.id,
        text:      entryText,
        timestamp: Date.now(),
        tagged:    true,
      };
      const existing = latest.quest_threads.main_quest.journal_entries ?? [];
      const nextQt = {
        ...latest.quest_threads,
        main_quest: {
          ...latest.quest_threads.main_quest,
          journal_entries: [...existing, entry],
        },
      };
      const nextState: MasterState = {
        ...latest,
        quest_threads: nextQt,
      };
      useGameStore.getState().setMasterState(nextState);
      saveQuestThreadsAsync(nextState.metadata.session_id, nextQt);
      console.log(`[QuestDiscovery] Journal entry appended for breadcrumb ${act1.id}.`);
    } catch (err) {
      console.warn("[QuestDiscovery] journal-entry generation threw:", err);
    }
  })();
}

// ── V8.64 deferred reveal hook ───────────────────────────────────────────────

/**
 * useDeferredQuestReveal — fires the Act 1 discovery pipeline when the
 * dialogue panel closes AFTER a successful NPC conversation that flagged
 * `pendingAct1Reveal: true`.
 *
 * Why deferred: firing the cinematic modal mid-conversation is jarring —
 * the player is still reading the NPC's response. By waiting for
 * currentDialogueNpc to transition from a non-null name back to null
 * (the player closed the dialogue panel), the reveal lands naturally
 * after they've finished the conversation.
 *
 * Boss-clear trigger is unaffected: it uses scheduleActOneDiscovery's
 * 1200ms delay path since there's no dialogue panel to wait on.
 *
 * Mount once in GamePage. Idempotent: the pendingAct1Reveal flag is
 * cleared immediately after the pipeline runs so re-renders can't
 * fire it twice.
 */
export function useDeferredQuestReveal(): void {
  const currentNpc       = useGameStore((s) => s.currentDialogueNpc);
  const pendingAct1      = useGameStore((s) => s.pendingAct1Reveal);
  const setPendingAct1   = useGameStore((s) => s.setPendingAct1Reveal);
  const prevNpcRef       = useRef<string | null>(null);

  useEffect(() => {
    const wasOpen = prevNpcRef.current !== null;
    const isClosed = currentNpc === null;
    prevNpcRef.current = currentNpc;

    // Fire on the transition from "dialogue open" → "dialogue closed"
    // while pendingAct1Reveal is set. setPendingAct1Reveal(false) runs
    // FIRST so a quick re-render can't double-fire the pipeline.
    if (wasOpen && isClosed && pendingAct1) {
      setPendingAct1(false);
      // Small idle pause so the dialogue panel's close animation
      // (if any) gets out of the way before the cinematic backdrop
      // covers the screen.
      setTimeout(() => {
        runActOneDiscovery({ trigger: "dialogue" });
      }, 250);
    }
  }, [currentNpc, pendingAct1, setPendingAct1]);
}
