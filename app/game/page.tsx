"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { GameLayout } from "@/components/layout/GameLayout";
import { StoryFeed } from "@/components/game/StoryFeed";
import { InputBar, type InputBarHandle } from "@/components/game/InputBar";
import { DialogueModal } from "@/components/game/DialogueModal";
import { SceneArt } from "@/components/game/SceneArt";
import { CharacterSheet } from "@/components/game/sidebar/CharacterSheet";
import { InventoryPanel } from "@/components/game/sidebar/InventoryPanel";
import { LogBook } from "@/components/game/sidebar/LogBook";
import { Genre } from "@/types/game";
import type { MasterState } from "@/types/game";
import { createClient } from "@/lib/supabase/client";
import { useGameStore, makeMessage } from "@/lib/stores/game-store";
import { useGameLoop } from "@/hooks/useGameLoop";
import { getWorldAssetsForLocation } from "@/lib/game/codex";
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

  const masterState   = useGameStore((s) => s.masterState);
  const messages      = useGameStore((s) => s.messages);

  const { submitAction, isProcessing, processingStep } = useGameLoop();

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
        // Fresh session — show the opening welcome message.
        const worldName    = WORLD_NAMES[state.metadata.genre] ?? "World";
        const locationName = formatLocationId(state.world_state.current_location_id);
        store.addMessage(makeMessage("SYSTEM",
          `You are ${state.player_state.name}, a ${state.player_state.background} in the ${worldName}. ` +
          `Your adventure begins at ${locationName}. What do you do?`
        ));
      }

      // Preload established world assets so the first narrator call sees
      // them. The player is PRESENT on session load, never ARRIVING — so
      // step 7c in useGameLoop won't trigger this; the page MUST seed
      // locationAssets here or the narrator runs blind for the first beat.
      void getWorldAssetsForLocation(
        state.metadata.session_id,
        state.world_state.current_location_id
      ).then((assets) => {
        console.log("[GamePage] Initial locationAssets loaded:", assets.length);
        useGameStore.getState().setLocationAssets(assets);
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
              locationName={masterState.world_state.current_location_id.replace(/_/g, " ")}
              genre={String(masterState.metadata.genre)}
              description={masterState.player_state.background}
              sessionId={masterState.metadata.session_id}
            />
          )}
          <StoryFeed
            messages={messages}
            isLoading={isProcessing && !!processingStep}
            onSubmit={(input) => { void submitAction(input); }}
          />
          <DialogueModal
            onSubmit={(input, opts) => { void submitAction(input, opts); }}
            onFocusInput={() => { inputBarRef.current?.focus(); }}
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
      }
      sidebar={
        <>
          <CharacterSheet />
          <InventoryPanel onSubmit={(input) => { void submitAction(input); }} />
          <LogBook />
        </>
      }
    />
  );
}
