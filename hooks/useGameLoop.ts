"use client";

import { startTransition, useCallback } from "react";
import { useGameStore, makeMessage, type StoryMessage } from "@/lib/stores/game-store";
import { parseIntent, IntentParserError } from "@/lib/game/intent-parser";
import { resolveAction } from "@/lib/game/logic-resolver";
import { narrateAction } from "@/lib/game/narrator";
import { applyStateDelta, addLogEntry, addToInventory, removeFromInventory, updateNPCTrust, findNpcInRegistry, seedNpcRegistry } from "@/lib/game/state-utils";
import { isNarrativeAction, isEquipIntent, isDropIntent, isReadIntent } from "@/lib/game/action-classifier";
import { saveCodexEntry, saveWorldAsset, getWorldAssetsForLocation, normalizeAssetId, normalizeLocationId, updateWorldAssetSvg, updateAssetNameRevealed } from "@/lib/game/codex";
import { generateArt, generateNpcPortrait, getSceneType } from "@/lib/game/art-generator";
import { generateLocationStub } from "@/lib/game/location-stub-generator";
import { ActionType, AssetCategory, Genre, ItemRarity, ItemType, LocationStatus, LogEntryType } from "@/types/game";
import type { Item, MasterState, ParsedAction, ResolutionResult, StoredMessage, WorldAsset } from "@/types/game";

const MAX_INPUT_LENGTH  = 500;
const AUTO_SAVE_INTERVAL = 10;

// Genre → resources key under which the primary currency is stored. Mirrors
// the table in CharacterSheet — kept here so the trade hook never imports UI.
// Horror/Lovecraftian has no primary currency by design (sanity is its scarcity).
const GENRE_CURRENCY_KEY: Partial<Record<Genre, string>> = {
  [Genre.FANTASY]:          "gold",
  [Genre.CYBERPUNK]:        "credits",
  [Genre.SPACE_OPERA]:      "stellar_units",
  [Genre.POST_APOCALYPTIC]: "caps",
};

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

  // Generic stat-check feedback (charisma / strength / perception / intelligence).
  // Reads ctx.success (NOT resolution.success — DIALOGUE always succeeds at the
  // resolver layer; the in-fiction outcome lives in narrative_context).
  const statKey =
    typeof ctx.stat_checked === "string" ? ctx.stat_checked.toLowerCase() : null;
  if (statKey || ctx.charisma_check === true) {
    const STAT_ICON: Record<string, string> = {
      charisma: "🎭", strength: "💪", perception: "👁", intelligence: "🧠",
    };
    const STAT_NAME: Record<string, string> = {
      charisma: "Charisma", strength: "Strength", perception: "Perception", intelligence: "Intelligence",
    };
    const STAT_SHORT: Record<string, string> = {
      charisma: "CHA", strength: "STR", perception: "PER", intelligence: "INT",
    };
    const key   = statKey ?? "charisma";
    const icon  = STAT_ICON[key] ?? "🎲";
    const name  = STAT_NAME[key] ?? "Stat";
    const short = STAT_SHORT[key] ?? "STAT";
    const passed = ctx.success === true;
    const label  = passed ? "Passed!" : "Failed.";
    return `${icon} ${name} check: ${roll} ${sign} (${short}) = ${total}${diffStr} — ${label}`;
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
 * Fire-and-forget: immediately persist world_state to the DB after a MOVE or
 * any action that mutates world flags. Ensures current_location_id and flag
 * changes survive a hard refresh without waiting for the 10-action auto-save.
 */
function saveWorldStateAsync(sessionId: string, worldState: import("@/types/game").WorldState): void {
  void (async () => {
    try {
      await fetch("/api/game/world-state", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ sessionId, worldState }),
      });
    } catch {
      // Silently swallow — best-effort; the 10-action auto-save is the fallback.
    }
  })();
}

/**
 * Fire-and-forget: immediately persist the full log_book (entries +
 * recent_messages) to the DB so both survive a hard page refresh without
 * waiting for the 10-action auto-save.
 */
function saveLogEntriesAsync(sessionId: string, logBook: import("@/types/game").LogBook): void {
  void (async () => {
    try {
      await fetch("/api/game/log-entries", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ sessionId, logBook }),
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

  const submitAction = useCallback(async (input: string, options?: { npcName?: string }) => {
    const store = useGameStore.getState();

    // BUG FIX 1: track whether step 7d revealed a true name this beat. If it
    // did, step 7g must use that name in setDialogueOptions instead of the
    // stale placeholder, otherwise step 7g's call overwrites step 7d's update.
    let justRevealedName: string | null = null;

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

      // ── 2b. NPC name override ──────────────────────────────────────────────
      // When the caller provides an authoritative NPC name (e.g. dialogue
      // modal click, or InputBar submit while a dialogue is active), pin
      // primary_target to that name for DIALOGUE actions. This sidesteps the
      // Intent Parser ever having to extract an NPC name from quoted speech —
      // the name is whatever the game state says it is.
      if (options?.npcName && parsedAction.action_type === ActionType.DIALOGUE) {
        parsedAction = { ...parsedAction, primary_target: options.npcName };
      }

      // ── 3. Resolve action ──────────────────────────────────────────────────
      const resolution = resolveAction(parsedAction, state);

      // ── 4. Apply state_delta ───────────────────────────────────────────────
      let updatedState = applyStateDelta(state, resolution.state_delta);

      // ── 4b. Roll feedback (feed + log book) ────────────────────────────────
      // The roll line goes into both the live story feed AND the persistent
      // log book — stat checks are mechanically meaningful events that
      // belong in the journal. Runs after step 4 so updatedState exists for
      // persistLogEntry.
      const rollMsg = buildRollFeedback(resolution);
      if (rollMsg) {
        store.addMessage(makeMessage("SYSTEM", rollMsg));
        updatedState = persistLogEntry(updatedState, LogEntryType.COMBAT, rollMsg);
      }

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

        // Day 17 — generate a location stub when MOVING to a place that has no
        // LOCATION asset yet. Fire-and-forget: the stub may not arrive before
        // the narrator runs THIS turn, but it locks in the canonical name /
        // type / faction so all FUTURE visits see consistent established facts.
        // saveWorldAsset uses ignoreDuplicates, so racing narrator codex_entries
        // never overwrite each other — first write wins.
        {
          const liveAssets = useGameStore.getState().locationAssets;
          const stubAssetId = `location_${newLocationId}`;
          const exists = liveAssets.find(
            (a) =>
              a.category === AssetCategory.LOCATION &&
              (a.id === stubAssetId || a.first_seen_location === newLocationId)
          );
          if (!exists) {
            void generateLocationStub(
              parsedAction.primary_target ?? newLocationId,
              state.world_state.current_location_id,
              state.metadata.world_seed,
              state.metadata.genre
            ).then(async (stub) => {
              const asset: WorldAsset = {
                id:                  `location_${stub.id}`,
                category:            AssetCategory.LOCATION,
                name:                stub.name,
                constitution: {
                  physical_description: stub.description,
                  ...(stub.faction_id ? { faction_affiliation: stub.faction_id } : {}),
                  notes: `type=${stub.type}`,
                },
                significance:        "NOTABLE",
                first_seen_location: stub.id,
                session_id:          artSessionId,
                name_known:          true,
                created_at:          new Date().toISOString(),
              };
              await saveWorldAsset(artSessionId, asset);
              const refreshed = await getWorldAssetsForLocation(artSessionId, newLocationId);
              useGameStore.getState().setLocationAssets(refreshed);
              console.log(`[GameLoop/7] Location stub saved: ${stub.name} (${stub.id})`);
            });
          }
        }

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

          // Day 17 — codex populates from player ENCOUNTER, not seed time.
          // On first arrival at any location with a world_asset (whether
          // seeded or stub-generated), write the codex entry from the
          // asset's constitution. saveCodexEntry uses ignoreDuplicates,
          // so this is safe to call on every arrival; the entry is
          // created exactly once.
          const locationAsset = assets.find(
            (a) =>
              a.category === AssetCategory.LOCATION &&
              (a.id === arrivedAt ||
               a.id === `location_${arrivedAt}` ||
               normalizeLocationId(a.first_seen_location ?? "") === arrivedAt)
          );
          if (locationAsset) {
            const c = locationAsset.constitution;
            const description =
              (typeof c.physical_description === "string" && c.physical_description) ||
              (typeof c.notes === "string" && c.notes) ||
              (typeof c.atmosphere === "string" && c.atmosphere) ||
              "A location in the world.";
            void saveCodexEntry(sessionId, {
              id:                  locationAsset.id,
              category:            "LOCATION",
              name:                locationAsset.name,
              description,
              first_seen_location: arrivedAt,
              significance:        "NOTABLE",
            });
          }
        });
      } else {
        // Late-load fallback: if locationAssets is still empty at this point,
        // page.tsx's seed must have failed (network error, race, hard reload
        // restored masterState before the seed completed). Try once now so
        // subsequent narrator calls aren't blind.
        const liveAssets = useGameStore.getState().locationAssets;
        if (liveAssets.length === 0 && currentLocationId) {
          void getWorldAssetsForLocation(sessionId, currentLocationId).then((assets) => {
            if (assets.length > 0) {
              console.log("[GameLoop/7c] Late locationAssets load:", assets.length);
              useGameStore.getState().setLocationAssets(assets);
            }
          });
        }
      }

      // ── 7d. Process revealed NPC names ───────────────────────────────────────
      // When the narrator signals that the player learned a character's true
      // identity this turn, persist the reveal and optimistically patch the
      // Zustand locationAssets store so the codex UI reflects it immediately.
      console.log(
        "[GameLoop/7d] revealed_npc_names from narrator:",
        JSON.stringify(narratorResponse.revealed_npc_names)
      );
      if (narratorResponse.revealed_npc_names && narratorResponse.revealed_npc_names.length > 0) {
        // PART 1 (modal timing fix) + PART 2a (narrator simplification):
        // Compute the active NPC name from the CURRENT action context
        // (option-click override → previous-beat store value → primary_target).
        // This is independent of step 7g's pending store update and is also
        // what the game engine uses to resolve the asset_id since the
        // narrator no longer emits one.
        const gsBefore7d = useGameStore.getState();
        const activeNpcName: string | null =
          options?.npcName ??
          gsBefore7d.currentDialogueNpc ??
          parsedAction.primary_target ??
          null;

        for (const reveal of narratorResponse.revealed_npc_names) {
          const trueName = reveal.true_name;
          const currentAssets = useGameStore.getState().locationAssets;

          // Asset resolution priority:
          //   1. CHARACTER asset whose name already equals the revealed name.
          //   2. CHARACTER asset whose constitution.true_name matches
          //      (placeholder asset where the narrator pre-recorded the name).
          //   3. CHARACTER asset matching the active dialogue NPC by name —
          //      most likely candidate when the player is mid-conversation.
          let matchedAsset =
            currentAssets.find(
              (a) =>
                a.category === AssetCategory.CHARACTER &&
                a.name.toLowerCase() === trueName.toLowerCase()
            ) ?? null;

          if (!matchedAsset) {
            matchedAsset =
              currentAssets.find(
                (a) =>
                  a.category === AssetCategory.CHARACTER &&
                  typeof a.constitution.true_name === "string" &&
                  a.constitution.true_name.toLowerCase() === trueName.toLowerCase()
              ) ?? null;
          }

          if (!matchedAsset && activeNpcName) {
            matchedAsset =
              currentAssets.find(
                (a) =>
                  a.category === AssetCategory.CHARACTER &&
                  a.name.toLowerCase() === activeNpcName.toLowerCase()
              ) ?? null;
          }

          // Derive the effective asset_id from whichever asset we matched, or
          // fall back to normalizing the active NPC name (placeholder), or as
          // a last resort the revealed name itself.
          const effectiveAssetId =
            matchedAsset?.id ??
            (activeNpcName
              ? normalizeAssetId(AssetCategory.CHARACTER, activeNpcName)
              : normalizeAssetId(AssetCategory.CHARACTER, trueName));

          const placeholderName = matchedAsset?.name ?? activeNpcName ?? "";

          // Persist to DB — fire-and-forget.
          void updateAssetNameRevealed(sessionId, effectiveAssetId, trueName);

          // Optimistic local patch of locationAssets.
          const patched = currentAssets.map((a) =>
            a.id === effectiveAssetId
              ? { ...a, name: trueName, name_known: true }
              : a
          );
          useGameStore.getState().setLocationAssets(patched);

          // Update any DIALOGUE feed messages that still carry the placeholder.
          if (placeholderName) {
            useGameStore.getState().updateMessagesNpcName(placeholderName, trueName);
          }

          // PART 1 (modal timing): two-channel check uses a key COMPUTED from
          // the active NPC name (independent of step 7g's pending store
          // update), then ALSO honors the activeNpcName text channel for
          // placeholder collisions. This works on beat 1 too.
          {
            const gs = useGameStore.getState();
            const computedNpcKey = activeNpcName
              ? normalizeAssetId(AssetCategory.CHARACTER, activeNpcName)
              : null;
            const isActiveNpc =
              (!!activeNpcName &&
               placeholderName !== "" &&
               activeNpcName.toLowerCase() === placeholderName.toLowerCase()) ||
              (!!computedNpcKey && computedNpcKey === effectiveAssetId);

            console.log(
              "[GameLoop/7d] two-channel check:",
              "computedNpcKey:", computedNpcKey,
              "effectiveAssetId:", effectiveAssetId,
              "match:", isActiveNpc
            );

            // FIX 3: pin the revealed name FIRST so any subsequent step that
            // reads justRevealedName (notably step 7g's setDialogueOptions)
            // sees the true name, not the stale placeholder. This must run
            // even when there are no current dialogue options to update —
            // the asset name update happened above and step 7g still needs
            // to know about the reveal.
            if (isActiveNpc) {
              justRevealedName = trueName;

              const gs2 = useGameStore.getState();
              if (gs2.currentDialogueOptions.length > 0) {
                gs2.setDialogueOptions(
                  gs2.currentDialogueOptions,
                  trueName,
                  gs2.currentNpcPortrait,
                  gs2.currentDialogueNpcKey ?? computedNpcKey ?? effectiveAssetId
                );
                console.log("[GameLoop/7d] Modal updated to:", trueName);
              }
            }
          }
        }
      }

      // ── 7e. Trust changes from dialogue ──────────────────────────────────────
      // Resolve narrator-provided npc_key against whatever scheme the registry
      // is actually using (snake_case, asset-id, or name match). Seed a default
      // entry first if missing so the delta isn't silently dropped — common
      // when the NPC was introduced via codex_entries without going through
      // new_npcs.
      if (narratorResponse.trust_changes && narratorResponse.trust_changes.length > 0) {
        for (const tc of narratorResponse.trust_changes) {
          const found = findNpcInRegistry(updatedState.npc_registry, tc.npc_key);
          const key   = found?.key ?? tc.npc_key;
          if (!found) {
            const matchingAsset = useGameStore.getState().locationAssets.find(
              (a) =>
                a.category === AssetCategory.CHARACTER &&
                (a.id === key || a.name.toLowerCase() === tc.npc_key.toLowerCase())
            );
            updatedState = seedNpcRegistry(
              updatedState,
              key,
              matchingAsset?.name ?? tc.npc_key,
              matchingAsset?.constitution.role
            );
          }
          updatedState = updateNPCTrust(updatedState, key, tc.delta);
        }
      }

      // ── 7f. NPC portrait generation (DIALOGUE or new NPC introduced) ─────────
      // Fire-and-forget: generates a FRONT_PORTRAIT SVG for the NPC and stores it
      // in artCache[npc.id]. Silently no-ops if the portrait already exists.
      if (isDialogueAction || narratorResponse.new_npcs.length > 0) {
        const npcTargetName = parsedAction.primary_target ?? null;
        if (npcTargetName) {
          const currentAssets = useGameStore.getState().locationAssets;
          const npcAsset = currentAssets.find(
            (a) =>
              a.category === AssetCategory.CHARACTER &&
              a.name.toLowerCase() === npcTargetName.toLowerCase()
          ) ?? null;

          if (npcAsset) {
            const alreadyCached = !!npcAsset.svg_content || !!useGameStore.getState().artCache[npcAsset.id];
            if (!alreadyCached) {
              void generateNpcPortrait(npcAsset, String(updatedState.metadata.genre), sessionId)
                .then(async (res) => {
                  if (!res?.svg) return;
                  useGameStore.getState().setArtCache(npcAsset.id, res.svg);
                  // If the Dialogue Modal is still showing this NPC, update its portrait live.
                  const gs = useGameStore.getState();
                  if (gs.currentDialogueNpc === npcTargetName) {
                    gs.setDialogueOptions(gs.currentDialogueOptions, npcTargetName, res.svg);
                  }
                  await updateWorldAssetSvg(sessionId, npcAsset.id, res.svg);
                });
            }
          }
        }
      }

      // ── 7g. Dialogue options — store for the Dialogue Modal ──────────────────
      // Show after every DIALOGUE action; clear after any non-DIALOGUE action.
      // Preserve the existing NPC name + portrait across consecutive turns with
      // the same NPC so the modal doesn't flash blank between turns.
      {
        const dialogueOpts = narratorResponse.dialogue_options ?? [];
        if (isDialogueAction && dialogueOpts.length > 0) {
          const newNpcName       = parsedAction.primary_target ?? null;
          const gsBefore         = useGameStore.getState();
          const existingNpc      = gsBefore.currentDialogueNpc;
          const existingPortrait = gsBefore.currentNpcPortrait;

          // FIX 1: When the player clicks a dialogue option, the Intent Parser
          // sees only the option's speech text and sets primary_target to null
          // (it's classifying speech, not extracting "talk to X"). Fall back to
          // the NPC we were already conversing with so the modal stays anchored
          // to the same character across consecutive option clicks.
          const effectiveNpcName =
            newNpcName ??
            (isDialogueAction && existingNpc ? existingNpc : null);

          // "Continuing" means: same NPC as last turn (case-insensitive match).
          // When the player addresses a different NPC, we always swap.
          const continuingSameNpc =
            !!existingNpc &&
            !!effectiveNpcName &&
            existingNpc.toLowerCase() === effectiveNpcName.toLowerCase();

          // Resolve the NPC asset for portrait fallback.
          const currentAssets = gsBefore.locationAssets;
          const npcAsset = effectiveNpcName
            ? currentAssets.find(
                (a) =>
                  a.category === AssetCategory.CHARACTER &&
                  a.name.toLowerCase() === effectiveNpcName.toLowerCase()
              ) ?? null
            : null;

          // BUG FIX 1: if step 7d revealed a true name this beat, that's the
          // authoritative current display name — use it instead of the stale
          // placeholder that effectiveNpcName / existingNpc still hold.
          const npcName =
            justRevealedName
              ?? (continuingSameNpc ? existingNpc : effectiveNpcName);
          const portrait =
            continuingSameNpc && existingPortrait
              ? existingPortrait
              : (npcAsset
                  ? (gsBefore.artCache[npcAsset.id] ?? npcAsset.svg_content ?? null)
                  : null);

          // FIX (key prefix): currentDialogueNpcKey MUST always be the FULL
          // canonical asset-id form ("character_<slug>") so it matches the
          // narrator's revealed_npc_names asset_id in step 7d's two-channel
          // check. Derive it directly from effectiveNpcName (the resolved
          // NPC name including the option-click fallback to existingNpc) so
          // option-click beats — where parsedAction.primary_target is null
          // and so npcName could collapse to null without the fallback —
          // still produce a non-null key. findNpcInRegistry's prefix-strip
          // fallback handles legacy unprefixed entries during reads.
          const npcRegistryKey: string | null = effectiveNpcName
            ? normalizeAssetId(AssetCategory.CHARACTER, effectiveNpcName)
            : null;

          // Seed a neutral entry when no variant of this key exists in the
          // registry yet. findNpcInRegistry covers all historical schemes
          // (raw, snake_case, prefixed, unprefixed) so we don't accidentally
          // create a duplicate next to a legacy record.
          if (
            npcRegistryKey &&
            npcName &&
            !findNpcInRegistry(updatedState.npc_registry, npcRegistryKey)
          ) {
            const matchingAsset = gsBefore.locationAssets.find(
              (a) =>
                a.category === AssetCategory.CHARACTER &&
                (a.id === npcRegistryKey || a.name.toLowerCase() === npcName.toLowerCase())
            );
            updatedState = seedNpcRegistry(
              updatedState,
              npcRegistryKey,
              npcName,
              matchingAsset?.constitution.role
            );
            console.log(`[GameLoop/7g] Seeded npc_registry entry for ${npcName} → ${npcRegistryKey}`);

            // FIX 2: patch the live store IMMEDIATELY so the next action's
            // resolveDialogue (which reads state from the store BEFORE step 10
            // commits updatedState) sees the seeded entry. Without this, the
            // resolver would log "NPC not in registry" on every consecutive
            // dialogue beat against this same character.
            const currentMaster = useGameStore.getState().masterState;
            if (currentMaster) {
              useGameStore.getState().setMasterState({
                ...currentMaster,
                npc_registry: updatedState.npc_registry,
              });
            }

            // Day 17 — codex populates on encounter. First dialogue with this
            // NPC writes the codex entry from the world_asset's constitution.
            // ignoreDuplicates makes this idempotent — runs only when the
            // registry seed runs (i.e. truly the first beat with this NPC).
            //
            // FIX 2: pre-seeded NPCs may have first_seen_location pointing
            // somewhere the current locationAssets snapshot doesn't include
            // by direct name match. Broaden the lookup to also match on
            // normalizeAssetId(asset.name) === npcRegistryKey so seed NPCs
            // are reliably found even when their name slug differs slightly
            // from what the player typed.
            const liveAssets = useGameStore.getState().locationAssets;
            const npcCodexAsset =
              // First try: name match (covers most cases including stubs).
              liveAssets.find(
                (a) =>
                  a.category === AssetCategory.CHARACTER &&
                  effectiveNpcName !== null &&
                  a.name.toLowerCase() === effectiveNpcName.toLowerCase()
              )
              // Second try: registry-key-normalized lookup. Catches pre-seeded
              // NPCs whose stored asset.name spells slightly differently from
              // what the player or narrator referred to them as.
              ?? liveAssets.find(
                (a) =>
                  a.category === AssetCategory.CHARACTER &&
                  normalizeAssetId(AssetCategory.CHARACTER, a.name) === npcRegistryKey
              )
              // Third try: matchingAsset from earlier in the seed block (it
              // already searched by id and name so we won't re-find anything
              // new, but keep it as a final fallback for completeness).
              ?? matchingAsset;

            if (npcCodexAsset) {
              const c = npcCodexAsset.constitution;
              const description = [
                typeof c.role        === "string" ? c.role        : "",
                typeof c.personality === "string" ? c.personality : "",
                typeof c.notes       === "string" ? c.notes       : "",
              ]
                .map((s) => s.trim())
                .filter(Boolean)
                .join(" ");
              void saveCodexEntry(sessionId, {
                id:                  npcCodexAsset.id,
                category:            "CHARACTER",
                name:                npcCodexAsset.name,
                description:         description || "A character encountered in the world.",
                first_seen_location: updatedState.world_state.current_location_id,
                significance:        "NOTABLE",
              });
              console.log("[GameLoop/7g] Codex entry written for NPC:", npcCodexAsset.name);
            } else {
              console.log(
                "[GameLoop/7g] No world_asset found for NPC:",
                effectiveNpcName,
                "— codex entry skipped"
              );
            }
          }

          store.setDialogueOptions(dialogueOpts, npcName, portrait, npcRegistryKey);
          // Verification log — confirms the canonical key actually reaches
          // the store. After this lands, currentDialogueNpcKey should be the
          // "character_<slug>" form matching the narrator's asset_id, so
          // step 7d's two-channel match resolves on identity reveals.
          console.log(
            "[GameLoop/7g] setDialogueOptions called with npcKey:",
            effectiveNpcName
              ? normalizeAssetId(AssetCategory.CHARACTER, effectiveNpcName)
              : null
          );
        } else if (!isDialogueAction) {
          // SMALL FIX 1: covers EVERY non-DIALOGUE action. MOVE, ATTACK,
          // EXAMINE, INTERACT, USE_ITEM, CUSTOM (e.g. "I leave and find
          // someone else") all set isDialogueAction=false → modal clears.
          // The player walking away ends the conversation, as it should.
          store.clearDialogueOptions();
        }
      }

      // ── 7h. Day 16 — TRADE: items_for_sale → Trade Modal ────────────────────
      // The narrator emits items_for_sale when resolveInteract flagged
      // trade_available. Push them into the store so the Trade Modal opens.
      // Subsequent non-trade actions don't auto-clear — the player closes the
      // modal explicitly so they can browse over multiple turns.
      if (narratorResponse.items_for_sale && narratorResponse.items_for_sale.length > 0) {
        store.setTradeItems(narratorResponse.items_for_sale);
        console.log(
          "[GameLoop/7h] items_for_sale received:",
          narratorResponse.items_for_sale.length
        );
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
        // Always key freshly-introduced NPCs by normalizeAssetId(CHARACTER, name).
        // This matches the locationAssets / world_assets ID format and the
        // disposition-lookup path used by the Dialogue Modal. trust_score
        // defaults to 50 (neutral) when missing, memory_snippets to [].
        const merged = { ...updatedState.npc_registry };
        for (const npc of narratorResponse.new_npcs) {
          const standardKey = normalizeAssetId(AssetCategory.CHARACTER, npc.name);
          merged[standardKey] = {
            ...npc,
            npc_key:         standardKey,
            trust_score:     typeof npc.trust_score === "number" ? npc.trust_score : 50,
            memory_snippets: Array.isArray(npc.memory_snippets) ? npc.memory_snippets : [],
          };
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
        // DIALOGUE entry priority: log_summary → last quoted speech → first
        // sentence. The first quote in narrator prose is usually atmospheric
        // (e.g. "Oh, this?"); the LAST quote is typically the meaningful NPC
        // line that should land in the log book.
        const npcLabel  = parsedAction.primary_target ? `${parsedAction.primary_target}: ` : "";
        // Array.from instead of [...] — the project's tsconfig doesn't enable
        // downlevelIteration so iterator spread on matchAll() won't compile.
        const allQuotes = Array.from(narratorResponse.narrative_text.matchAll(/"([^"]*)"/g));
        const lastQuote = allQuotes.length > 0
          ? allQuotes[allQuotes.length - 1][1].trim()
          : null;
        const quotedText = narratorResponse.log_summary
          ?? lastQuote
          ?? firstSentence;
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
        console.log("[GameLoop/9b] recent_messages captured:", recent.length, recent.map((m) => m.type));
        updatedState = {
          ...updatedState,
          log_book: { ...updatedState.log_book, recent_messages: recent },
        };
      }

      // Fire-and-forget: persist world_state immediately after MOVE or any
      // action that mutated world flags (locked doors, discovered secrets, etc.).
      // Prevents current_location_id and flag changes from being lost on reload.
      {
        const wsKeys = Object.keys(resolution.state_delta?.world_state ?? {});
        if (wsKeys.some((k) => k !== "location_status")) {
          saveWorldStateAsync(updatedState.metadata.session_id, updatedState.world_state);
        }
      }

      // Fire-and-forget: persist the full log_book (entries + recent_messages)
      // immediately after every narrative action so both survive a hard refresh
      // without waiting for the 10-action auto-save.
      saveLogEntriesAsync(updatedState.metadata.session_id, updatedState.log_book);

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

  // ── Day 16 — Trade actions ─────────────────────────────────────────────────
  // Buy / sell are dispatched from the TradeModal. They mutate masterState and
  // currentTradeItems directly via the store, log a DISCOVERY entry, and
  // fire-and-forget the world-state persist. They never go through the
  // narrator — pure mechanical commerce.

  const buyItem = useCallback((item: Item) => {
    const gs = useGameStore.getState();
    const state = gs.masterState;
    if (!state) return;

    const currencyKey = GENRE_CURRENCY_KEY[state.metadata.genre];
    if (!currencyKey) {
      gs.addMessage(makeMessage("SYSTEM", "This genre does not use currency."));
      return;
    }
    const balance = state.player_state.resources[currencyKey] ?? 0;
    const cost    = typeof item.value === "number" ? item.value : 0;
    if (balance < cost) {
      gs.addMessage(makeMessage("SYSTEM", `You can't afford ${item.name} (need ${cost}, have ${balance}).`));
      return;
    }

    // Add a single copy with quantity 1 (merchant offer is per-item).
    const purchased: Item = { ...item, quantity: 1, equipped: false };
    let next = addToInventory(state, purchased);
    next = {
      ...next,
      player_state: {
        ...next.player_state,
        resources: { ...next.player_state.resources, [currencyKey]: balance - cost },
      },
    };
    next = persistLogEntry(next, LogEntryType.DISCOVERY, `Bought: ${item.name} (${cost})`);

    gs.setMasterState(next);
    gs.setTradeItems(gs.currentTradeItems.filter((i) => i.id !== item.id));
    gs.addMessage(makeMessage("SYSTEM", `[ Bought: ${item.name} for ${cost} ]`));
  }, []);

  const sellItem = useCallback((item: Item) => {
    const gs = useGameStore.getState();
    const state = gs.masterState;
    if (!state) return;

    const currencyKey = GENRE_CURRENCY_KEY[state.metadata.genre];
    if (!currencyKey) {
      gs.addMessage(makeMessage("SYSTEM", "This genre does not use currency."));
      return;
    }

    const owned = state.player_state.inventory.find((i) => i.id === item.id);
    if (!owned) return;

    const sellPrice = Math.max(1, Math.floor(((item.value ?? 0)) * 0.5));
    let next        = removeFromInventory(state, item.id, 1);
    const balance   = next.player_state.resources[currencyKey] ?? 0;
    next = {
      ...next,
      player_state: {
        ...next.player_state,
        resources: { ...next.player_state.resources, [currencyKey]: balance + sellPrice },
      },
    };
    next = persistLogEntry(next, LogEntryType.DISCOVERY, `Sold: ${item.name} for ${sellPrice}`);

    gs.setMasterState(next);
    gs.addMessage(makeMessage("SYSTEM", `[ Sold: ${item.name} for ${sellPrice} ]`));
  }, []);

  return {
    submitAction,
    isProcessing,
    processingStep,
    messages,
    masterState,
    buyItem,
    sellItem,
  };
}
