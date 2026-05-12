"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { GameLayout } from "@/components/layout/GameLayout";
import { StoryFeed } from "@/components/game/StoryFeed";
import { InputBar, type InputBarHandle } from "@/components/game/InputBar";
import { DialogueModal } from "@/components/game/DialogueModal";
import { TradeModal } from "@/components/game/TradeModal";
import { SceneArt } from "@/components/game/SceneArt";
import { CharacterSheet } from "@/components/game/sidebar/CharacterSheet";
import { InventoryPanel } from "@/components/game/sidebar/InventoryPanel";
import { LogBook } from "@/components/game/sidebar/LogBook";
import { WorldMap } from "@/components/game/WorldMap";
import { NavigationBar } from "@/components/game/NavigationBar";
import { CombatMode } from "@/components/game/CombatMode";
import { CodexModal } from "@/components/game/CodexModal";
import { LevelUpModal } from "@/components/game/LevelUpModal";
import { FloorLootStrip } from "@/components/game/FloorLootStrip";
import { useFloorLoot } from "@/hooks/useFloorLoot";
import { AssetCategory, Genre } from "@/types/game";
import type { MasterState } from "@/types/game";
import { createClient } from "@/lib/supabase/client";
import { useGameStore, makeMessage } from "@/lib/stores/game-store";
import { useGameLoop } from "@/hooks/useGameLoop";
import { useCombat } from "@/hooks/useCombat";
import { useDungeonRuntime } from "@/hooks/useDungeonRuntime";
import { getAllWorldAssets, getWorldAssetsForLocation, normalizeLocationId, saveCodexEntry } from "@/lib/game/codex";
import { formatLocationId } from "@/lib/game/location-formatter";

const WORLD_NAMES: Record<Genre, string> = {
  [Genre.FANTASY]:             "Realm",
  [Genre.CYBERPUNK]:           "Grid",
  [Genre.HORROR_LOVECRAFTIAN]: "Void",
  [Genre.SPACE_OPERA]:         "Galaxy",
  [Genre.POST_APOCALYPTIC]:    "Wasteland",
};

// Module-level memo of the last session id we successfully loaded. Survives
// component unmount/remount so that SPA navigation back into /game can be
// distinguished from a genuine session switch (the Zustand store also
// preserves masterState across mounts; both signals must match for SPA nav).
let lastLoadedSessionId: string | null = null;

export default function GamePage() {
  const router = useRouter();
  const initRef    = useRef(false);
  const inputBarRef = useRef<InputBarHandle>(null);
  const [sessionChecked, setSessionChecked] = useState(false);

  const masterState    = useGameStore((s) => s.masterState);
  const messages       = useGameStore((s) => s.messages);
  const locationAssets = useGameStore((s) => s.locationAssets);

  const { submitAction, navigateTo, isProcessing, processingStep, buyItem, sellItem, openTrade } = useGameLoop();
  const {
    combat:           activeCombat,
    isResolving:      combatResolving,
    displayPhase:     combatDisplayPhase,
    floatingByActor:  combatFloatingByActor,
    submitCombatAction,
  } = useCombat();
  // Day 23A pt 2 — dungeon-runtime callbacks for the NavigationBar
  // room cards + locked-room popover. The hook also runs the
  // dungeon-entry side effect (initialize dungeon_state on arrival)
  // and the boss-victory beat observer.
  const dungeon = useDungeonRuntime();
  // Day 21 — SEARCH REMAINS + TAKE handlers backing the FloorLootStrip.
  const floorLootHandlers = useFloorLoot();
  const inCombat = activeCombat?.active === true;

  // ── Load session on mount ─────────────────────────────────────────────────
  // Reads ?session_id= from the URL to load a specific save slot.
  // Falls back to the most recent active session if no param is present.
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    async function loadSession() {
      // Read search param without useSearchParams() to avoid Suspense requirement.
      const params        = new URLSearchParams(window.location.search);
      const sessionIdParam = params.get("session_id");

      // ── SPA navigation short-circuit ───────────────────────────────────────
      // If the Zustand store already has a session loaded AND it matches both
      // the module-level memo and the URL param, this is a tab-switch back
      // into /game (e.g. from /game/codex). Don't wipe dialogue / messages /
      // log book — just refresh ephemeral caches and bail.
      const earlyStore        = useGameStore.getState();
      const existingSessionId = earlyStore.masterState?.metadata.session_id ?? null;
      const queryMatches      = !sessionIdParam || sessionIdParam === existingSessionId;
      if (
        existingSessionId &&
        existingSessionId === lastLoadedSessionId &&
        queryMatches
      ) {
        earlyStore.clearTransientState();
        setSessionChecked(true);
        return;
      }

      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      // Load all active sessions (free tier max = 3, so this is always cheap).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: sessions } = (await (supabase.from("game_sessions") as any)
        .select("id, master_state")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("last_played", { ascending: false })) as {
          data: { id: string; master_state: MasterState }[] | null;
        };

      if (!sessions || sessions.length === 0) {
        router.push("/game/new");
        return;
      }

      // Pick the requested session or fall back to the most recent.
      const session = sessionIdParam
        ? sessions.find((s) => s.master_state.metadata.session_id === sessionIdParam)
        : sessions[0];

      if (!session) {
        router.push("/game/new");
        return;
      }

      const state = session.master_state;
      const store = useGameStore.getState();

      // Wipe all per-session caches BEFORE loading the new session so nothing
      // bleeds across (log entries, location assets, art cache, dialogue modal,
      // last narrative text, ascii art). masterState is set immediately after.
      store.clearSessionState();
      store.clearMessages();
      store.setMasterState(state);
      store.mergePersistedLogEntries(state.log_book?.entries ?? []);

      // ── Restore recent narrative messages from the previous session ──────────
      // Gives the player context to continue without re-reading the entire log.
      console.log("[GamePage] loaded recent_messages:", state.log_book?.recent_messages?.length ?? 0, state.log_book?.recent_messages);
      const recentMsgs = state.log_book?.recent_messages ?? [];

      if (recentMsgs.length > 0) {
        // Resuming — show separator + restored messages only, no extra welcome line.
        store.addMessage(makeMessage("SYSTEM", "— Resuming your adventure —"));
        for (const m of recentMsgs) {
          store.addMessage({
            id:        m.id,
            type:      m.type,
            content:   m.content,
            timestamp: new Date(m.timestamp),
            metadata:  { ...(m.metadata ?? {}), restored: true },
          });
        }
      } else {
        // V8.34 (Prompt 3 Task 7) — fresh session preamble. Replaces the
        // generic "Resuming your adventure" head that was firing on
        // brand-new games. Two short lines: a SYSTEM divider for the
        // opening beat + a soft prompt for the player's first input.
        const worldName    = WORLD_NAMES[state.metadata.genre] ?? "World";
        const locationName = formatLocationId(state.world_state.current_location_id);
        store.addMessage(makeMessage("SYSTEM",
          `You are ${state.player_state.name}, a ${state.player_state.background} in the ${worldName}. ` +
          `Your adventure begins at ${locationName}.`
        ));
        store.addMessage(makeMessage("SYSTEM",
          "Your adventure begins. What will you do first?",
          { isFreshGamePreamble: true }
        ));
      }

      // Debug: log the location identifiers we're about to query against so
      // mismatches between current_location_id and first_seen_location are
      // visible at the moment they bite.
      console.log(
        "[GamePage] current_location_id:",
        state.world_state.current_location_id
      );
      console.log(
        "[GamePage] current_node_id:",
        state.world_state.current_node_id
      );

      // Preload established world assets so the first narrator call sees
      // them. The player is PRESENT on session load, never ARRIVING — so
      // step 7c in useGameLoop won't trigger this; the page MUST seed
      // locationAssets here or the narrator runs blind for the first beat.
      //
      // Fallback: if the location-filtered query comes back empty (e.g.
      // first_seen_location values don't match current_location_id after
      // a fresh apply-world-bible), pull every asset for the session so
      // the narrator and Tier 1 highlight system have something to read.
      // FIX 1 — compute parent region zone id so the region zone asset
      // (first_seen_location = regionId) is included alongside hub /
      // sub-location assets on initial load. Walk the zone_id chain
      // from the current node up to its root geographic-region zone.
      const _initWg = state.world_graph;
      const _initLocId = state.world_state.current_location_id;
      const _initParentRegionId = (() => {
        if (!_initWg) return undefined;
        let cur = _initWg.nodes[_initLocId];
        const vis = new Set<string>();
        while (cur && !vis.has(cur.id)) {
          vis.add(cur.id);
          if (!cur.zone_id || cur.zone_id === cur.id) {
            return cur.id !== _initLocId ? cur.id : undefined;
          }
          cur = _initWg.nodes[cur.zone_id];
        }
        return undefined;
      })();
      void getWorldAssetsForLocation(
        state.metadata.session_id,
        state.world_state.current_location_id,
        _initParentRegionId
      ).then(async (assets) => {
        if (assets.length === 0) {
          const allAssets = await getAllWorldAssets(state.metadata.session_id);
          console.log(
            "[GamePage] Fallback: loaded all assets:",
            allAssets.length
          );
          useGameStore.getState().setLocationAssets(allAssets);
          assets = allAssets;
        } else {
          console.log("[GamePage] Initial locationAssets loaded:", assets.length);
          useGameStore.getState().setLocationAssets(assets);
        }

        // FIX 1 (Day 17): the player begins PRESENT, not ARRIVING, so step 7c
        // in useGameLoop never fires for the starting location. Write the
        // starting-location codex entry here on first load. saveCodexEntry's
        // ignoreDuplicates makes this idempotent across reloads.
        //
        // Audit Issue A fix: use the RAW current_location_id (no longer
        // article-stripped) as the canonical key. apply-world-bible writes
        // assets keyed by `location_<raw>` and first_seen_location: <raw>.
        // We also tolerate the old stripped form via the third clause for
        // backward compat with existing saves.
        const sessionId   = state.metadata.session_id;
        const startingId  = state.world_state.current_location_id;
        const startingAssetId = `location_${startingId}`;
        const startingAsset = assets.find(
          (a) =>
            a.category === AssetCategory.LOCATION &&
            (a.id === startingId ||
             a.id === startingAssetId ||
             a.first_seen_location === startingId ||
             normalizeLocationId(a.first_seen_location ?? "") === startingId)
        );
        if (startingAsset) {
          const c = startingAsset.constitution;
          const description =
            (typeof c.physical_description === "string" && c.physical_description) ||
            (typeof c.notes === "string" && c.notes) ||
            (typeof c.atmosphere === "string" && c.atmosphere) ||
            "Your starting location.";
          void saveCodexEntry(sessionId, {
            id:                  startingAsset.id,
            category:            "LOCATION",
            name:                startingAsset.name,
            description,
            first_seen_location: state.world_state.current_location_id,
            significance:        "NOTABLE",
          });
          console.log("[GamePage] Starting-location codex entry queued:", startingAsset.name);
        }
      });

      // Memoize the session id at module level so the SPA-nav check above can
      // recognise this session on the next mount.
      lastLoadedSessionId = state.metadata.session_id;
      setSessionChecked(true);
    }

    void loadSession();
  }, [router]);

  if (!sessionChecked) return null;

  const genre = masterState?.metadata.genre ?? Genre.FANTASY;

  return (
    <GameLayout
      genre={genre}
      mainPanel={
        <>
          {masterState && (
            <SceneArt
              locationId={masterState.world_state.current_location_id}
              locationName={  /* Day 20.4.4 FIX: use WorldGraphNode.name (display name, e.g.
                               * "Warden's Armory and Hall") instead of the raw
                               * current_location_id slug ("pale edge territory settlement
                               * armory"). Falls back to slug replacement when node not yet
                               * in graph (initial load before graph is hydrated). */
                masterState.world_graph?.nodes?.[masterState.world_state.current_location_id]?.name ??
                masterState.world_state.current_location_id.replace(/_/g, " ")
              }
              genre={String(masterState.metadata.genre)}
              description={masterState.player_state.background}
              sessionId={masterState.metadata.session_id}
            />
          )}
          <StoryFeed
            messages={messages}
            isLoading={isProcessing && !!processingStep}
            // FIX 8 — surface the contextual processingStep ("Speaking
            // with Korven...", "Examining the fountain...") so the feed's
            // loading row matches the InputBar indicator instead of the
            // old hardcoded "Generating response…".
            loadingText={processingStep}
            onSubmit={(input) => { void submitAction(input); }}
            // Navigation redesign — LOCATION highlights with a nodeId
            // route through navigateTo directly (no popover, no text).
            onNavigate={(nodeId) => navigateTo(nodeId)}
            // Dialogue panel renders inline at the bottom of the feed so
            // it pushes earlier messages up rather than overlaying them.
            bottomSlot={
              <DialogueModal
                onSubmit={(input, opts) => { void submitAction(input, opts); }}
                onFocusInput={() => { inputBarRef.current?.focus(); }}
                onOpenTrade={(name) => { void openTrade(name); }}
              />
            }
          />
          <TradeModal onBuy={buyItem} onSell={sellItem} />
          {/* Day 20.4.2 TASK 4 — Codex modal overlay. Opens on top of
              /game without changing routes, so combat / dialogue stay
              mounted while the player consults the codex. */}
          <CodexModal />
          {/* Day 22 — Level-up modal. Opens when player_state
              .pending_level_up=true AND combat is no longer active. */}
          <LevelUpModal />
          {/* V8.34 (Prompt 3 Task 3) — when combat is active, swap the
              navigation strip + input bar for the CombatMode panel.
              CombatMode covers more vertical space so the player has
              room for portraits + HP bars + action buttons; the story
              feed above it shrinks via flex but stays scrollable. */}
          {inCombat && activeCombat && masterState ? (
            <CombatMode
              combat={activeCombat}
              player={masterState.player_state}
              isResolving={combatResolving}
              displayPhase={combatDisplayPhase}
              floatingByActor={combatFloatingByActor}
              onAction={(a) => { void submitCombatAction(a); }}
            />
          ) : (
            <>
              {/* Day 21 — Floor Loot Strip. Renders between story feed
                  and nav cards. Hidden during combat (CombatMode swap
                  above replaces this whole subtree). Auto-unmounts
                  when no entries match the current node. */}
              {masterState && (
                <FloorLootStrip
                  floor_loot={masterState.floor_loot ?? []}
                  current_node_id={
                    masterState.world_state.current_node_id
                    ?? masterState.world_state.current_location_id
                  }
                  genre={masterState.metadata.genre}
                  player_inventory_count={masterState.player_state.inventory.length}
                  onSearchRemains={floorLootHandlers.onSearchRemains}
                  onTake={floorLootHandlers.onTake}
                  onTakeGold={floorLootHandlers.onTakeGold}
                  onTakeAll={floorLootHandlers.onTakeAll}
                />
              )}
              <NavigationBar
                masterState={masterState}
                worldGraph={masterState?.world_graph}
                onNavigate={(nodeId) => navigateTo(nodeId)}
                genre={genre}
                // Day 23A pt 2 — dungeon callbacks. NavigationBar
                // branches to room-card mode when masterState
                // .dungeon_state is set.
                onNavigateRoom={dungeon.navigateToRoom}
                onUseKeyOnRoom={dungeon.useKeyOnRoom}
                onForceRoom={dungeon.forceUnlockRoom}
                canForceUnlock={dungeon.canForceUnlock()}
                keyItemForRoom={dungeon.keyItemForRoom}
                strBypassThreshold={dungeon.strBypassThreshold}
              />
              <InputBar
                ref={inputBarRef}
                onSubmit={(input) => {
                  // While a dialogue is active (modal visible OR collapsed), pin the
                  // active NPC name so the Intent Parser doesn't have to extract it
                  // from quoted speech. Non-DIALOGUE actions ignore the override
                  // inside submitAction (it only applies when action_type === DIALOGUE).
                  const activeNpc = useGameStore.getState().currentDialogueNpc;
                  void submitAction(input, activeNpc ? { npcName: activeNpc } : undefined);
                }}
                disabled={isProcessing}
                processingStep={processingStep}
              />
            </>
          )}
        </>
      }
      sidebar={
        <>
          <CharacterSheet />
          <InventoryPanel onSubmit={(input) => { void submitAction(input); }} />
          <LogBook />
        </>
      }
      mapPanel={
        masterState && masterState.world_graph ? (
          <WorldMap
            masterState={masterState}
            worldGraph={masterState.world_graph}
            locationAssets={locationAssets}
            onExamine={(input) => { void submitAction(input); }}
            onOpenDialogue={(npcName) => {
              void submitAction(`talk to ${npcName}`, { npcName });
            }}
          />
        ) : null
      }
    />
  );
}
