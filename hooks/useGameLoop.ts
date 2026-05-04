"use client";

import { startTransition, useCallback } from "react";
import { useGameStore, makeMessage, type StoryMessage } from "@/lib/stores/game-store";
import { parseIntent, IntentParserError } from "@/lib/game/intent-parser";
import { resolveAction } from "@/lib/game/logic-resolver";
import { narrateAction } from "@/lib/game/narrator";
import { applyStateDelta, addLogEntry, addToInventory, removeFromInventory } from "@/lib/game/state-utils";
import { isNarrativeAction, isEquipIntent, isDropIntent, isReadIntent } from "@/lib/game/action-classifier";
import { saveCodexEntry, saveWorldAsset, getWorldAssetsForLocation, normalizeAssetId, updateWorldAssetSvg, updateAssetNameRevealed } from "@/lib/game/codex";
import { generateArt, getSceneType } from "@/lib/game/art-generator";
import { ActionType, AssetCategory, ItemRarity, ItemType, LocationStatus, LogEntryType } from "@/types/game";
import type { MasterState, ParsedAction, ResolutionResult, StoredMessage, WorldAsset } from "@/types/game";

const MAX_INPUT_LENGTH  = 500;
const AUTO_SAVE_INTERVAL = 10;

// Module-level counter — persists across renders, resets when the module reloads.
let autoSaveActionCount = 0;

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

const RARITY_LABELS: Record<ItemRarity, string> = {
  [ItemRarity.COMMON]:    "Common",
  [ItemRarity.UNCOMMON]:  "Uncommon",
  [ItemRarity.RARE]:      "Rare",
  [ItemRarity.LEGENDARY]: "Legendary",
};

/**
 * Adds a log entry to masterState AND syncs it to the Zustand persistedLogEntries
 * so the LogBook survives SPA navigation without waiting for a DB auto-save.
 */
function persistLogEntry(state: MasterState, type: LogEntryType, content: string): MasterState {
  const updated = addLogEntry(state, type, content);
  // addLogEntry PREPENDS — the new entry is always at index [0].
  const latest  = updated.log_book.entries[0];
  if (latest) {
    useGameStore.getState().addPersistedLogEntry(latest);
  }
  return updated;
}

/**
 * Fire-and-forget: immediately persist just the log_book.entries to the DB so
 * they survive a hard page refresh without waiting for the 10-action auto-save.
 * Entries should be in newest-first order (same as masterState.log_book.entries).
 */
function saveLogEntriesAsync(sessionId: string, entries: import("@/types/game").LogEntry[]): void {
  void (async () => {
    try {
      await fetch("/api/game/log-entries", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ sessionId, entries }),
      });
    } catch {
      // Silently swallow — this is best-effort; the 10-action auto-save is the fallback.
    }
  })();
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
      const lastNarrative   = useGameStore.getState().lastNarrativeText;
      const locationAssets  = useGameStore.getState().locationAssets;

      // Always give the narrator the most current world_state (including
      // location_status from the resolution) so it never infers location
      // from narrative history.
      const narratorState: MasterState = resolution.state_delta.world_state
        ? {
            ...updatedState,
            world_state: { ...updatedState.world_state, ...resolution.state_delta.world_state },
          }
        : updatedState;

      let narratorResponse;
      try {
        narratorResponse = await narrateAction(
          resolution,
          narratorState,
          lastNarrative,
          parsedAction,
          locationAssets
        );
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
      // DIALOGUE actions get their own message type so StoryFeed can style
      // them with the NPC accent colour and quoted presentation.
      const isDialogueAction = parsedAction.action_type === ActionType.DIALOGUE;
      store.addMessage(
        makeMessage(
          isDialogueAction ? "DIALOGUE" : "NARRATIVE",
          narratorResponse.narrative_text,
          {
            outcome_type:       resolution.outcome_type,
            sound_id:           narratorResponse.sound_id,
            response_tier:      narratorResponse.response_tier,
            points_of_interest: narratorResponse.points_of_interest,
            ...(isDialogueAction && parsedAction.primary_target
              ? { npcName: parsedAction.primary_target }
              : {}),
          }
        )
      );
      store.setLastNarrativeText(narratorResponse.narrative_text);

      // ── 7. Art engine — fire async on MOVE_SUCCESS (non-blocking) ────────
      if (resolution.outcome_type === "MOVE_SUCCESS") {
        const newLocationId = updatedState.world_state.current_location_id;
        const artSessionId  = updatedState.metadata.session_id;
        const cached = useGameStore.getState().artCache[newLocationId];
        if (!cached) {
          const genre = String(updatedState.metadata.genre);
          const desc  = narratorResponse.narrative_text.slice(0, 200);
          console.log(`[GameLoop/art] Generating art for ${newLocationId} (session=${artSessionId})`);

          // Helper: try to link the generated SVG to the world asset.
          // Returns true when the asset was found and the update was issued;
          // false when the asset isn't in the store yet (race condition).
          const tryLinkSvgToAsset = async (svg: string): Promise<boolean> => {
            const store = useGameStore.getState();
            const matching = store.locationAssets.find(
              (a) => a.category === AssetCategory.LOCATION && a.first_seen_location === newLocationId
            );
            if (!matching) {
              console.log(
                `[GameLoop/art] LOCATION asset not in store yet for ${newLocationId}` +
                ` (locationAssets=${store.locationAssets.length}) — will retry in 2s`
              );
              return false;
            }
            if (matching.svg_content) {
              console.log(`[GameLoop/art] SVG already set on asset ${matching.id}, skipping backfill.`);
              return true;
            }
            console.log(`[GameLoop/art] Linking SVG → asset ${matching.id} (session=${artSessionId})`);
            await updateWorldAssetSvg(artSessionId, matching.id, svg);
            return true;
          };

          // Fire and forget — art shows up when ready, never blocks the loop.
          void generateArt({
            location_id:   newLocationId,
            location_name: newLocationId.replace(/_/g, " "),
            scene_type:    getSceneType(newLocationId),
            genre,
            description:   desc,
            session_id:    artSessionId,
          }).then(async (res) => {
            if (!res?.svg) return;
            useGameStore.getState().setArtCache(newLocationId, res.svg);
            // Attempt to backfill svg_content on the world asset. The asset
            // is saved in step 7b (fire-and-forget), so it might not be in
            // locationAssets yet if art finishes first. Retry once after 2s.
            if (!(await tryLinkSvgToAsset(res.svg))) {
              setTimeout(() => { void tryLinkSvgToAsset(res.svg!); }, 2000);
            }
          });
        }
      }

      // ── 7b. Process codex_entries — only NOTABLE/MAJOR are saved ──────────
      // Both saveCodexEntry and saveWorldAsset are fire-and-forget: they
      // upsert with ignoreDuplicates so first-introduction is law, and any
      // failures are logged inside the helpers without crashing the loop.
      const sessionId = updatedState.metadata.session_id;
      const currentLocationId = updatedState.world_state.current_location_id;
      for (const entry of narratorResponse.codex_entries) {
        if (entry.significance !== "NOTABLE" && entry.significance !== "MAJOR") continue;

        // Codex (player-facing encyclopedia row).
        try {
          void saveCodexEntry(sessionId, entry);
        } catch (err) {
          console.error("[useGameLoop] saveCodexEntry threw", err);
        }

        // World asset (immutable narrator constitution).
        const assetCategory: AssetCategory =
          (Object.values(AssetCategory) as string[]).includes(entry.category)
            ? (entry.category as AssetCategory)
            : AssetCategory.LORE;

        // For LOCATION assets introduced while ARRIVING, attach the cached SVG
        // if it is already ready — otherwise the art-engine retry in step 7
        // will backfill it once the asset lands in the store.
        const isArrivingLocation =
          assetCategory === AssetCategory.LOCATION &&
          resolution.state_delta.world_state?.location_status === LocationStatus.ARRIVING;
        const cachedSvg = isArrivingLocation
          ? useGameStore.getState().artCache[currentLocationId]
          : undefined;
        if (isArrivingLocation) {
          console.log(
            `[GameLoop/7b] Saving LOCATION asset for ${currentLocationId}` +
            ` (session=${sessionId}, cachedSvg=${!!cachedSvg})`
          );
        }

        const asset: WorldAsset = {
          id:                  normalizeAssetId(assetCategory, entry.name),
          category:            assetCategory,
          name:                entry.name,
          constitution:        { notes: entry.description },
          significance:        entry.significance,
          first_seen_location: currentLocationId,
          session_id:          sessionId,
          created_at:          new Date().toISOString(),
          // CHARACTER assets default to name_known=false; all others are known.
          name_known:          assetCategory !== AssetCategory.CHARACTER,
          ...(cachedSvg ? { svg_content: cachedSvg } : {}),
        };
        try {
          void saveWorldAsset(sessionId, asset);
        } catch (err) {
          console.error("[useGameLoop] saveWorldAsset threw", err);
        }

        if (entry.significance === "MAJOR") {
          updatedState = persistLogEntry(
            updatedState,
            LogEntryType.DISCOVERY,
            `New codex entry: ${entry.name} — ${entry.description}`
          );
        }
      }

      // ── 7c. After ARRIVING — refresh location assets for the next call ────
      // Fire-and-forget: when it lands, it populates the Zustand store so the
      // next narrator call sees ESTABLISHED WORLD ASSETS injected as fact.
      const arrivedAt =
        resolution.state_delta.world_state?.location_status === LocationStatus.ARRIVING
          ? resolution.state_delta.world_state.current_location_id ?? null
          : null;
      if (arrivedAt) {
        void getWorldAssetsForLocation(sessionId, arrivedAt).then((assets) => {
          useGameStore.getState().setLocationAssets(assets);
        });
      }

      // ── 7d. Process revealed NPC names ───────────────────────────────────────
      // When the narrator signals that the player learned a character's true
      // identity this turn, persist the reveal and optimistically patch the
      // Zustand locationAssets store so the codex UI reflects it immediately.
      if (narratorResponse.revealed_npc_names && narratorResponse.revealed_npc_names.length > 0) {
        for (const reveal of narratorResponse.revealed_npc_names) {
          // FIX 3b: Validate the narrator-provided asset_id against locationAssets.
          // The narrator may generate an ID based on the true name instead of the
          // existing placeholder asset_id. Resolve the correct ID here.
          const currentAssets = useGameStore.getState().locationAssets;
          let effectiveAssetId = reveal.asset_id;
          let matchedAsset     = currentAssets.find((a) => a.id === reveal.asset_id);

          if (!matchedAsset) {
            // Fallback: find a CHARACTER whose constitution.true_name matches.
            matchedAsset = currentAssets.find(
              (a) =>
                a.category === AssetCategory.CHARACTER &&
                typeof a.constitution.true_name === "string" &&
                a.constitution.true_name.toLowerCase() === reveal.true_name.toLowerCase()
            );
            if (matchedAsset) {
              effectiveAssetId = matchedAsset.id;
              console.log(
                `[GameLoop/7d] asset_id corrected "${reveal.asset_id}" → "${effectiveAssetId}"`
              );
            }
          }

          // Capture placeholder name BEFORE the reveal (needed for FIX 2).
          const placeholderName = matchedAsset?.name ?? "";

          // Persist to DB — fire-and-forget.
          void updateAssetNameRevealed(sessionId, effectiveAssetId, reveal.true_name);

          // Optimistic local patch of locationAssets.
          const patched = currentAssets.map((a) =>
            a.id === effectiveAssetId
              ? { ...a, name: reveal.true_name, name_known: true }
              : a
          );
          useGameStore.getState().setLocationAssets(patched);

          // FIX 2: Update any DIALOGUE messages in the feed that still carry
          // the old placeholder name so the header reflects the reveal immediately.
          if (placeholderName) {
            useGameStore.getState().updateMessagesNpcName(placeholderName, reveal.true_name);
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
          // DISCOVERY log entry per item acquired.
          const rarityLabel = RARITY_LABELS[item.rarity] ?? item.rarity;
          updatedState = persistLogEntry(
            updatedState,
            LogEntryType.DISCOVERY,
            `Found: ${item.name} (${rarityLabel})`
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

      // ── 9. Append a structured log entry for this beat ────────────────────
      // Extract first sentence (up to 120 chars) as fallback for log content.
      const firstSentence =
        (narratorResponse.narrative_text.match(/^[^.!?]*[.!?]/) ?? [])[0]?.trim() ??
        narratorResponse.narrative_text.slice(0, 120);

      if (resolution.outcome_type.startsWith("ATTACK")) {
        // COMBAT entry: compact roll+outcome format.
        const ctx2      = resolution.narrative_context;
        const roll2     = typeof ctx2.roll      === "number" ? ctx2.roll      : null;
        const mod2      = typeof ctx2.modifier  === "number" ? ctx2.modifier  : 0;
        const total2    = typeof ctx2.total     === "number" ? ctx2.total     : (roll2 ?? 0) + mod2;
        const diff2     = typeof ctx2.difficulty === "number" ? ctx2.difficulty : null;
        const damage2   = typeof ctx2.damage    === "number" ? ctx2.damage    : 0;
        const sign2     = mod2 >= 0 ? `+${mod2}` : `${mod2}`;
        const diffStr2  = diff2 !== null ? ` vs ${diff2}` : "";
        const label2    = ctx2.critical_hit  ? "Crit!"  :
                          ctx2.critical_miss ? "Miss!"  :
                          resolution.success ? "Hit!"   : "Miss!";
        const dmgStr2   = damage2 > 0 ? ` (${damage2} dmg)` : "";
        updatedState = persistLogEntry(updatedState, LogEntryType.COMBAT,
          `Attack: ${roll2}${sign2}=${total2}${diffStr2} — ${label2}${dmgStr2}`);
      } else if (parsedAction.action_type === ActionType.DIALOGUE) {
        // DIALOGUE entry: extract first NPC quote, fall back to first sentence.
        const npcLabel   = parsedAction.primary_target ? `${parsedAction.primary_target}: ` : "";
        const quotedText = narratorResponse.narrative_text.match(/"([^"]*)"/)?.[1]?.trim() ?? firstSentence;
        updatedState = persistLogEntry(updatedState, LogEntryType.DIALOGUE, `${npcLabel}${quotedText}`);
      } else {
        // STORY entry: use narrator's log_summary when present, else first sentence.
        const storyContent = narratorResponse.log_summary ?? firstSentence;
        updatedState = persistLogEntry(updatedState, LogEntryType.STORY, storyContent);
      }

      // ── 9b. Capture recent feed messages for session restoration ─────────────
      // Grab the last 8 NARRATIVE/DIALOGUE messages from the live feed and store
      // them in log_book.recent_messages so they can be restored on page reload.
      {
        const allMsgs = useGameStore.getState().messages;
        const recent: StoredMessage[] = allMsgs
          .filter((m) => m.type === "NARRATIVE" || m.type === "DIALOGUE")
          .slice(-8)
          .map((m) => ({
            id:        m.id,
            type:      m.type as "NARRATIVE" | "DIALOGUE",
            content:   m.content,
            timestamp: m.timestamp instanceof Date ? m.timestamp.toISOString() : String(m.timestamp),
            metadata:  m.metadata,
          }));
        updatedState = {
          ...updatedState,
          log_book: { ...updatedState.log_book, recent_messages: recent },
        };
      }

      // Fire-and-forget: persist log entries immediately after every narrative
      // action so they survive a hard refresh without the 10-action auto-save.
      saveLogEntriesAsync(updatedState.metadata.session_id, updatedState.log_book.entries);

      // Bump last_played so the session sorts correctly on reload.
      updatedState = {
        ...updatedState,
        metadata: { ...updatedState.metadata, last_played: new Date().toISOString() },
      };

      // ── 10. Commit local state; auto-save every 10 narrative actions ───────
      store.setMasterState(updatedState);
      autoSaveActionCount++;
      if (autoSaveActionCount % AUTO_SAVE_INTERVAL === 0) {
        await persistState(updatedState, store.addMessage);
      }
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
