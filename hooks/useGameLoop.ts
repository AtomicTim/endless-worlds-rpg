"use client";

import { startTransition, useCallback } from "react";
import { useGameStore, makeMessage, type StoryMessage } from "@/lib/stores/game-store";
import { parseIntent, IntentParserError } from "@/lib/game/intent-parser";
import { resolveAction } from "@/lib/game/logic-resolver";
import { narrateAction } from "@/lib/game/narrator";
import { applyStateDelta, addLogEntry, addToInventory, removeFromInventory } from "@/lib/game/state-utils";
import { isNarrativeAction, isEquipIntent, isDropIntent, isReadIntent } from "@/lib/game/action-classifier";
import { saveCodexEntry } from "@/lib/game/codex";
import { generateArt, getSceneType } from "@/lib/game/art-generator";
import { ActionType, ItemType, LogEntryType } from "@/types/game";
import type { MasterState, ParsedAction, ResolutionResult } from "@/types/game";

const MAX_INPUT_LENGTH = 500;

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildRollFeedback(resolution: ResolutionResult): string | null {
  const ctx  = resolution.narrative_context;
  const roll = typeof ctx.roll === "number" ? ctx.roll : null;
  if (roll === null) return null;

  const modifier   = typeof ctx.modifier   === "number" ? ctx.modifier   : 0;
  const total      = typeof ctx.total      === "number" ? ctx.total      : roll + modifier;
  const difficulty = typeof ctx.difficulty === "number" ? ctx.difficulty : null;

  const sign    = modifier >= 0 ? `+${modifier}` : `${modifier}`;
  const diffStr = difficulty !== null ? ` vs difficulty ${difficulty}` : "";

  if (resolution.outcome_type.startsWith("ATTACK")) {
    const label =
      ctx.critical_hit  ? "Critical Hit!"  :
      ctx.critical_miss ? "Critical Miss!" :
      resolution.success ? "Hit!"          :
                           "Miss!";
    return `⚔ Attack roll: ${roll} ${sign} (STR) = ${total}${diffStr} — ${label}`;
  }

  return `🎲 Roll: ${roll} ${sign} = ${total}${diffStr}`;
}

function outcomeToLogType(outcomeType: string): LogEntryType {
  if (outcomeType.startsWith("ATTACK"))   return LogEntryType.COMBAT;
  if (outcomeType.startsWith("DIALOGUE")) return LogEntryType.DIALOGUE;
  if (outcomeType.startsWith("EXAMINE") || outcomeType.startsWith("INTERACT")) {
    return LogEntryType.DISCOVERY;
  }
  return LogEntryType.STORY;
}

async function persistState(
  state: MasterState,
  addMessage: (m: StoryMessage) => void
): Promise<void> {
  try {
    const response = await fetch("/api/game/state", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ sessionId: state.metadata.session_id, state }),
    });

    if (!response.ok) {
      addMessage(
        makeMessage("SYSTEM", "Your progress could not be saved. Check your connection.")
      );
    }
  } catch {
    addMessage(
      makeMessage("SYSTEM", "Your progress could not be saved. Check your connection.")
    );
  }
}

// ── Direct-action parser (no AI call) ────────────────────────────────────────

/**
 * Converts well-known prefixed commands into a ParsedAction without any AI
 * call. Returns null for everything else so the normal parseIntent path runs.
 */
function getDirectAction(input: string, _state: MasterState): ParsedAction | null {
  const lower = input.toLowerCase();

  if (lower.startsWith("equip ")) {
    const target = input.slice(6).trim();
    return { action_type: ActionType.USE_ITEM, primary_target: target, item_used: target, inferred_intent: "equip", confidence: 1 };
  }
  if (lower.startsWith("unequip ")) {
    const target = input.slice(8).trim();
    return { action_type: ActionType.USE_ITEM, primary_target: target, item_used: target, inferred_intent: "unequip", confidence: 1 };
  }
  if (lower.startsWith("drop ")) {
    const target = input.slice(5).trim();
    return { action_type: ActionType.CUSTOM, primary_target: target, inferred_intent: "drop", confidence: 1 };
  }
  if (lower.startsWith("read ")) {
    const target = input.slice(5).trim();
    return { action_type: ActionType.USE_ITEM, primary_target: target, item_used: target, inferred_intent: "read", confidence: 1 };
  }
  // "search [item]" — pre-classified as USE_ITEM so the resolver routes it to
  // the CONTAINER branch, but isNarrativeAction still returns true so the
  // Narrator runs and decides what's inside. NOT a fast-path action.
  if (lower.startsWith("search ")) {
    const target = input.slice(7).trim();
    return { action_type: ActionType.USE_ITEM, primary_target: target, item_used: target, inferred_intent: "search", confidence: 1 };
  }

  return null;
}

// ── Fast-path handler ─────────────────────────────────────────────────────────

type GameStore = ReturnType<typeof import("@/lib/stores/game-store").useGameStore.getState>;

function handleFastPath(
  action: ParsedAction,
  resolution: ResolutionResult,
  state: MasterState,
  store: GameStore,
  originalState: MasterState
): MasterState {
  let updated = state;

  if (
    resolution.outcome_type === "USE_ITEM_EQUIPPED" ||
    resolution.outcome_type === "USE_ITEM_UNEQUIPPED"
  ) {
    const itemName =
      typeof resolution.narrative_context.item_name === "string"
        ? resolution.narrative_context.item_name
        : (action.item_used ?? action.primary_target ?? "item");
    const verb = resolution.outcome_type === "USE_ITEM_EQUIPPED" ? "Equipped" : "Unequipped";
    store.addMessage(makeMessage("SYSTEM", `[ ${verb}: ${itemName} ]`));
    return updated;
  }

  const lookup = (action.item_used ?? action.primary_target ?? "").trim().toLowerCase();
  const item = originalState.player_state.inventory.find(
    (i) => i.id === lookup || i.name.toLowerCase() === lookup
  );

  if (isDropIntent(action.inferred_intent)) {
    if (item) {
      updated = removeFromInventory(updated, item.id, 1);
      store.addMessage(makeMessage("SYSTEM", `[ Dropped: ${item.name} ]`));
    }
    return updated;
  }

  if (isReadIntent(action.inferred_intent)) {
    if (item) {
      store.addMessage(
        makeMessage("LORE", item.description, { item_name: item.name, item_rarity: item.rarity })
      );
      updated = addLogEntry(
        updated,
        LogEntryType.DISCOVERY,
        `Read: ${item.name} — ${item.description}`
      );
    }
    return updated;
  }

  return updated;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useGameLoop() {
  // Reactive subscriptions — re-render when these change.
  const masterState    = useGameStore((s) => s.masterState);
  const messages       = useGameStore((s) => s.messages);
  const isProcessing   = useGameStore((s) => s.isProcessing);
  const processingStep = useGameStore((s) => s.processingStep);

  const submitAction = useCallback(async (input: string) => {
    const store = useGameStore.getState();

    // ── 1. Validate input ────────────────────────────────────────────────────
    const trimmed = input.trim();
    if (!trimmed || trimmed.length > MAX_INPUT_LENGTH) return;

    const state = store.masterState;
    if (!state) {
      store.addMessage(
        makeMessage("SYSTEM", "No active game session. Please start a new game.")
      );
      return;
    }

    // Echo the player's command into the feed.
    store.addMessage(makeMessage("SYSTEM", `> ${trimmed}`));

    try {
      // ── 2. Parse intent (fast-path skips AI call entirely) ────────────────
      const directAction = getDirectAction(trimmed, state);
      let parsedAction: ParsedAction;

      if (directAction) {
        // Direct actions (equip/unequip/drop/read) — zero AI calls, zero delay.
        parsedAction = directAction;
      } else {
        store.setProcessing(true, "Parsing intent...");
        try {
          parsedAction = await parseIntent(trimmed, state);
        } catch (err) {
          if (err instanceof IntentParserError) {
            store.addMessage(
              makeMessage(
                "SYSTEM",
                "The winds of fate are unclear. Try rephrasing your action."
              )
            );
            store.setProcessing(false);
            return;
          }
          throw err;
        }
        store.setProcessing(true, "The world responds...");
      }

      // ── 3. Resolve action ──────────────────────────────────────────────────
      const resolution = resolveAction(parsedAction, state);

      // ── 3b. Roll feedback ──────────────────────────────────────────────────
      const rollMsg = buildRollFeedback(resolution);
      if (rollMsg) {
        store.addMessage(makeMessage("SYSTEM", rollMsg));
      }

      // ── 4. Apply state_delta ───────────────────────────────────────────────
      let updatedState = applyStateDelta(state, resolution.state_delta);

      // ── 4b. Fast path — inventory management actions skip the Narrator ─────
      if (!isNarrativeAction(parsedAction, state)) {
        const finalState = handleFastPath(parsedAction, resolution, updatedState, store, state);
        const stamped: MasterState = {
          ...finalState,
          metadata: { ...finalState.metadata, last_played: new Date().toISOString() },
        };

        if (directAction) {
          // Direct typed prefix (equip/unequip/drop/read) — defer the React
          // re-render so the input clear and the resulting feed update happen
          // in the same paint, eliminating the spinner flash entirely.
          startTransition(() => {
            store.setMasterState(stamped);
          });
        } else {
          store.setMasterState(stamped);
        }

        await persistState(stamped, store.addMessage);
        store.setProcessing(false);
        return;
      }

      // ── 5. Narrate ─────────────────────────────────────────────────────────
      store.setProcessing(true, "Narrating...");
      const lastNarrative = useGameStore.getState().lastNarrativeText;
      let narratorResponse;
      try {
        narratorResponse = await narrateAction(resolution, updatedState, lastNarrative, parsedAction);
      } catch {
        // Narrator failed — still save the resolved state so the action sticks.
        store.addMessage(
          makeMessage(
            "SYSTEM",
            "The oracle falls silent momentarily. Your action occurred but the story pauses."
          )
        );
        updatedState = addLogEntry(
          updatedState,
          LogEntryType.SYSTEM,
          `Action ${resolution.outcome_type} occurred (no narrative).`
        );
        store.setMasterState(updatedState);
        await persistState(updatedState, store.addMessage);
        store.setProcessing(false);
        return;
      }

      // ── 6. Add narrative message ───────────────────────────────────────────
      store.addMessage(
        makeMessage("NARRATIVE", narratorResponse.narrative_text, {
          outcome_type:       resolution.outcome_type,
          sound_id:           narratorResponse.sound_id,
          response_tier:      narratorResponse.response_tier,
          points_of_interest: narratorResponse.points_of_interest,
        })
      );
      store.setLastNarrativeText(narratorResponse.narrative_text);

      // ── 7. Art engine — fire async on MOVE_SUCCESS (non-blocking) ────────
      if (resolution.outcome_type === "MOVE_SUCCESS") {
        const newLocationId = updatedState.world_state.current_location_id;
        const cached = useGameStore.getState().artCache[newLocationId];
        if (!cached) {
          const sessionId = updatedState.metadata.session_id;
          const genre     = String(updatedState.metadata.genre);
          const desc      = narratorResponse.narrative_text.slice(0, 200);
          // Fire and forget — art shows up when ready, never blocks the loop.
          void generateArt({
            location_id:   newLocationId,
            location_name: newLocationId.replace(/_/g, " "),
            scene_type:    getSceneType(newLocationId),
            genre,
            description:   desc,
            session_id:    sessionId,
          }).then((res) => {
            if (res?.svg) useGameStore.getState().setArtCache(newLocationId, res.svg);
          });
        }
      }

      // ── 7b. Process codex_entries — only NOTABLE/MAJOR are saved ──────────
      for (const entry of narratorResponse.codex_entries) {
        if (entry.significance === "NOTABLE" || entry.significance === "MAJOR") {
          saveCodexEntry(entry);
          if (entry.significance === "MAJOR") {
            updatedState = addLogEntry(
              updatedState,
              LogEntryType.DISCOVERY,
              `New codex entry: ${entry.name} — ${entry.description}`
            );
          }
        }
      }

      // ── 8. Merge new NPCs into registry ────────────────────────────────────
      // 8b. Add any items the narrator granted — guarded against management actions.
      const isLoreAction =
        parsedAction.action_type === ActionType.USE_ITEM &&
        (() => {
          const lookup = (parsedAction.item_used ?? parsedAction.primary_target ?? "").trim().toLowerCase();
          const item = updatedState.player_state.inventory.find(
            (i) => i.id === lookup || i.name.toLowerCase() === lookup
          );
          return item?.type === ItemType.LORE;
        })();
      const isMgmtIntent = /\b(equip|unequip|drop|read)\b/i.test(parsedAction.inferred_intent);

      if (
        !isLoreAction &&
        !isMgmtIntent &&
        narratorResponse.items_acquired &&
        narratorResponse.items_acquired.length > 0
      ) {
        for (const item of narratorResponse.items_acquired) {
          updatedState = addToInventory(updatedState, item);
          store.addMessage(
            makeMessage(
              "SYSTEM",
              `[ ${item.rarity} item added to pack: ${item.name} ]`
            )
          );
        }
      }

      if (narratorResponse.new_npcs.length > 0) {
        const merged = { ...updatedState.npc_registry };
        for (const npc of narratorResponse.new_npcs) {
          merged[npc.npc_key] = npc;
        }
        updatedState = { ...updatedState, npc_registry: merged };
      }

      // ── 9. Append a log entry summarising this beat ────────────────────────
      const logSummary = narratorResponse.narrative_text.slice(0, 200);
      updatedState = addLogEntry(
        updatedState,
        outcomeToLogType(resolution.outcome_type),
        logSummary
      );

      // Bump last_played so the session sorts correctly on reload.
      updatedState = {
        ...updatedState,
        metadata: { ...updatedState.metadata, last_played: new Date().toISOString() },
      };

      // ── 10. Commit local state, then persist ───────────────────────────────
      store.setMasterState(updatedState);
      await persistState(updatedState, store.addMessage);
    } catch (err) {
      // Catch-all for unexpected errors — never crash the UI.
      console.error("Game loop error:", err);
      store.addMessage(
        makeMessage("SYSTEM", "Something went wrong. Please try again.")
      );
    } finally {
      store.setProcessing(false);
    }
  }, []);

  return {
    submitAction,
    isProcessing,
    processingStep,
    messages,
    masterState,
  };
}
