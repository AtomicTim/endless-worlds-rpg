"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { GameLayout } from "@/components/layout/GameLayout";
import { StoryFeed } from "@/components/game/StoryFeed";
import { InputBar, type InputBarHandle } from "@/components/game/InputBar";
import { DialogueModal } from "@/components/game/DialogueModal";
import { TradeModal } from "@/components/game/TradeModal";
import { SceneArt } from "@/components/game/SceneArt";
// UI-9 — CharacterSheet + InventoryPanel merged into a single unified
// CharacterPanel. The legacy components still live in the repo (orphaned
// imports) so any incidental caller still compiles.
import { CharacterPanel } from "@/components/game/sidebar/CharacterPanel";
import { LogBook } from "@/components/game/sidebar/LogBook";
import { WorldMap } from "@/components/game/WorldMap";
import { NavigationBar } from "@/components/game/NavigationBar";
import { CombatMode } from "@/components/game/CombatMode";
import { CodexModal } from "@/components/game/CodexModal";
import { JournalModal } from "@/components/game/JournalModal";
import { LevelUpModal } from "@/components/game/LevelUpModal";
import { QuestRevealModal } from "@/components/game/QuestRevealModal";
import { ContextPanel } from "@/components/game/ContextPanel";
import WorldIntroModal from "@/components/WorldIntroModal";
import { AttunementModal } from "@/components/game/AttunementModal";
import { ToastManager } from "@/components/game/ToastManager";
import { AssetCategory, Genre } from "@/types/game";
import type { MasterState } from "@/types/game";
import { createClient } from "@/lib/supabase/client";
import { useGameStore, makeMessage } from "@/lib/stores/game-store";
import { useGameLoop } from "@/hooks/useGameLoop";
import { useCombat } from "@/hooks/useCombat";
import { useDungeonRuntime } from "@/hooks/useDungeonRuntime";
import { useDeferredQuestReveal } from "@/lib/game/quest-discovery-pipeline";
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
  // Day 23.5D — world intro cinematic modal. Replaces the in-feed
  // NARRATIVE world_intro beat. worldIntroShownRef latches at fire
  // time so the modal can never re-trigger on store updates that
  // happen during normal play.
  const [showWorldIntroModal, setShowWorldIntroModal] = useState(false);
  const worldIntroShownRef = useRef(false);

  const masterState    = useGameStore((s) => s.masterState);
  const messages       = useGameStore((s) => s.messages);
  const locationAssets = useGameStore((s) => s.locationAssets);
  // P7 — Attunement modal. Opens when rest signal increments (Inn Rest
  // completes; rule 156) or when the player taps the settlement Attune
  // button. Guarded against opening during combat by the modal itself
  // (rule 166).
  const restCompleteSignal = useGameStore((s) => s.restCompleteSignal);
  const [attunementOpen, setAttunementOpen] = useState(false);
  const restSignalSeenRef = useRef(restCompleteSignal);
  useEffect(() => {
    if (restCompleteSignal !== restSignalSeenRef.current) {
      restSignalSeenRef.current = restCompleteSignal;
      setAttunementOpen(true);
    }
  }, [restCompleteSignal]);

  const { submitAction, navigateTo, isProcessing, processingStep, buyItem, sellItem, openTrade, restAtInn } = useGameLoop();
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
  // V8.64 — defer Act 1 quest reveal until the dialogue panel closes.
  // The hook watches currentDialogueNpc → null transitions; when
  // pendingAct1Reveal is set, it runs the discovery pipeline once.
  useDeferredQuestReveal();
  const inCombat = activeCombat?.active === true;
  // PR-7v-d — DialogueModal moved into the CombatMode bottom-swap slot
  // as a persistent DialogueBar (NavigationBar + InputBar hidden while
  // talking). `dialogueActive` is derived from currentDialogueNpc so
  // the bar follows the same NPC presence that drives the rest of the
  // dialogue state — minimize / close affordances were dropped along
  // with the modal chrome, so the only exit path is END CONVERSATION
  // (clearDialogueOptions) inside the bar itself.
  const currentDialogueNpc = useGameStore((s) => s.currentDialogueNpc);
  const dialogueActive = !!currentDialogueNpc;

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
        // V8.34 (Prompt 3 Task 7) + Day 23B pt 2 (TASK 1) — fresh-session
        // preamble. Two paths now (Day 23.5D):
        //
        //   A. world_intro IS set (new games on 23.5D+):
        //      1. SYSTEM "You are {name}, a {class} in the {World}." beat
        //      2. Schedule the WorldIntroModal — the cinematic overlay
        //         renders the world intro prose. "Your adventure begins."
        //         fires inside handleWorldIntroDismiss when the player
        //         clicks/keypresses to dismiss it.
        //
        //   B. world_intro is NOT set (legacy saves predating Day 23B):
        //      1. SYSTEM "You are {name}, a {class} in the {World}." beat
        //      2. SYSTEM "Your adventure begins..." beat — immediate,
        //         no modal (rule 42 fallback path).
        const worldName    = WORLD_NAMES[state.metadata.genre] ?? "World";
        const locationName = formatLocationId(state.world_state.current_location_id);
        store.addMessage(makeMessage("SYSTEM",
          `You are ${state.player_state.name}, a ${state.player_state.background} in the ${worldName}. ` +
          `Your adventure begins at ${locationName}.`
        ));
        const intro = state.metadata.world_intro;
        if (typeof intro === "string" && intro.trim().length > 0) {
          // Day 23.5D — cinematic overlay replaces the in-feed NARRATIVE
          // beat. Latch the ref synchronously so the trigger can't fire
          // again from any subsequent state update.
          worldIntroShownRef.current = true;
          setShowWorldIntroModal(true);
        } else {
          // Legacy path — no world_intro means no modal. Fire the
          // soft-prompt SYSTEM beat immediately so the player still
          // sees the "begin adventure" cue.
          store.addMessage(makeMessage("SYSTEM",
            "Your adventure begins. What will you do first?",
            { isFreshGamePreamble: true }
          ));
        }
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

  // Day 23.5D — dismiss handler for the world intro modal. Fires the
  // "Your adventure begins…" SYSTEM beat that previously fired
  // immediately in the fresh-game preamble. Idempotent: subsequent
  // calls (e.g. very fast double-click) are absorbed by the
  // showWorldIntroModal guard.
  const handleWorldIntroDismiss = () => {
    if (!showWorldIntroModal) return;
    setShowWorldIntroModal(false);
    useGameStore.getState().addMessage(makeMessage(
      "SYSTEM",
      "Your adventure begins. What will you do first?",
      { isFreshGamePreamble: true },
    ));
  };

  return (
    <GameLayout
      genre={genre}
      mainPanel={
        <>
          {/* Day 23.5D — World intro cinematic. Mounts at z-60 above
              every other modal; self-dismissed via click or keypress.
              Only shows on the fresh-game branch when metadata.world_intro
              is set (legacy saves skip directly to the soft-prompt beat). */}
          {showWorldIntroModal && masterState?.metadata.world_intro && (
            <WorldIntroModal
              worldName={
                masterState.metadata.world_consistency?.world_name
                ?? masterState.metadata.world_seed?.world_name
                ?? ""
              }
              worldIntro={masterState.metadata.world_intro}
              genre={masterState.metadata.genre}
              onDismiss={handleWorldIntroDismiss}
            />
          )}
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
            // PR-7v-d — DialogueModal no longer renders inside the feed
            // (the `bottomSlot` prop is gone). It is mounted below as a
            // bar in the CombatMode swap slot when dialogueActive is true.
          />
          <TradeModal onBuy={buyItem} onSell={sellItem} />
          {/* Day 20.4.2 TASK 4 — Codex modal overlay. Opens on top of
              /game without changing routes, so combat / dialogue stay
              mounted while the player consults the codex. */}
          {/* UI-11 — Toast notifications. Mounted once at the root of
              the game view; renders nothing until a toast is queued. */}
          <ToastManager />
          <CodexModal />
          {/* Day 23C — Journal modal overlay. Same overlay pattern as
              Codex. JOURNAL button in GameLayout toggles it. */}
          <JournalModal />
          {/* Day 23C — Act 1 cinematic. Mounts at z-60 so it sits above
              every other modal. Self-clears when its animation cycle
              completes; pointer-events: none so it never blocks input. */}
          <QuestRevealModal />
          {/* Day 22 — Level-up modal. Opens when player_state
              .pending_level_up=true AND combat is no longer active. */}
          <LevelUpModal />
          {/* P7 — Attunement modal. Opens on Inn Rest signal or via the
              settlement Attune button. Locked during combat (rule 166)
              — the modal itself guards on combat?.active. */}
          <AttunementModal
            open={attunementOpen}
            onClose={() => setAttunementOpen(false)}
          />
          {/* V8.34 (Prompt 3 Task 3) — when combat is active, swap the
              navigation strip + input bar for the CombatMode panel.
              CombatMode covers more vertical space so the player has
              room for portraits + HP bars + action buttons; the story
              feed above it shrinks via flex but stays scrollable.
              PR-7v-d — dialogue gets the same swap treatment via the
              middle branch below. NavigationBar + InputBar hidden while
              an NPC is active; the DialogueBar replaces them and the
              story feed naturally hosts the conversation history above. */}
          {inCombat && activeCombat && masterState ? (
            <CombatMode
              combat={activeCombat}
              player={masterState.player_state}
              isResolving={combatResolving}
              displayPhase={combatDisplayPhase}
              floatingByActor={combatFloatingByActor}
              wcd={masterState.metadata.world_consistency}
              onAction={(a) => { void submitCombatAction(a); }}
            />
          ) : dialogueActive ? (
            <DialogueModal
              onSubmit={(input, opts) => { void submitAction(input, opts); }}
              onFocusInput={() => { inputBarRef.current?.focus(); }}
              onOpenTrade={(name) => { void openTrade(name); }}
              onRest={() => { restAtInn(); }}
            />
          ) : (
            <>
              {/* UI-fix-D 4b — the P7 floating Attune button used to
                  live here (between FloorLootStrip and NavigationBar)
                  with no designed surface. It is now an Attune card
                  inside the Context Panel "In This Space" section,
                  rendered only at settlement_hub nodes and only out
                  of combat. setAttunementOpen is wired through
                  ContextPanel's new onAttune prop below. */}
              <NavigationBar
                masterState={masterState}
                worldGraph={masterState?.world_graph}
                onNavigate={(nodeId) => navigateTo(nodeId)}
                genre={genre}
                // UI-5 — action-bar loading dims every card to opacity
                // 0.4 + pointer-events: none. Mirrors the existing
                // StoryFeed isLoading wiring above.
                isLoading={isProcessing && !!processingStep}
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
          <CharacterPanel onSubmit={(input) => { void submitAction(input); }} />
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
      contextPanel={
        <ContextPanel
          onSubmit={(input, opts) => { void submitAction(input, opts); }}
          // UI-fix-D 4b — relocated Attune entry. Only the open
          // signal crosses the boundary; the modal itself + its
          // close handler stay in this page (above) so the
          // restCompleteSignal Inn-Rest auto-open path still
          // works without ContextPanel knowing about it.
          onAttune={() => setAttunementOpen(true)}
        />
      }
    />
  );
}
