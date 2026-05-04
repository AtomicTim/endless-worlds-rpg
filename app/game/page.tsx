"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { GameLayout } from "@/components/layout/GameLayout";
import { StoryFeed } from "@/components/game/StoryFeed";
import { InputBar } from "@/components/game/InputBar";
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

export default function GamePage() {
  const router = useRouter();
  const initRef = useRef(false);
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

      store.clearMessages();
      store.setMasterState(state);
      store.mergePersistedLogEntries(state.log_book?.entries ?? []);
      store.setAsciiArt(null);

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

      // Preload established world assets so the first narrator call sees them.
      void getWorldAssetsForLocation(
        state.metadata.session_id,
        state.world_state.current_location_id
      ).then((assets) => {
        useGameStore.getState().setLocationAssets(assets);
      });

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
          <InputBar
            onSubmit={(input) => { void submitAction(input); }}
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
