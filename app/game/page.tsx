"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { GameLayout } from "@/components/layout/GameLayout";
import { StoryFeed } from "@/components/game/StoryFeed";
import { InputBar } from "@/components/game/InputBar";
import { CharacterSheet } from "@/components/game/sidebar/CharacterSheet";
import { InventoryPanel } from "@/components/game/sidebar/InventoryPanel";
import { Genre } from "@/types/game";
import type { MasterState } from "@/types/game";
import { createClient } from "@/lib/supabase/client";
import { useGameStore, makeMessage } from "@/lib/stores/game-store";
import { useGameLoop } from "@/hooks/useGameLoop";

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
  const currentAscii  = useGameStore((s) => s.currentAsciiArt);

  const { submitAction, isProcessing, processingStep } = useGameLoop();

  // ── Load active session on mount ─────────────────────────────────────────
  // Note: initRef guards against React strict-mode's double effect invocation.
  // We deliberately don't use a "cancelled" flag — strict mode's interleaved
  // cleanup would set it to true on the in-flight first call and prevent the
  // session from ever being loaded.
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    async function loadSession() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: sessions } = (await (supabase.from("game_sessions") as any)
        .select("id, master_state")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("last_played", { ascending: false })
        .limit(1)) as { data: { id: string; master_state: MasterState }[] | null };

      if (!sessions || sessions.length === 0) {
        router.push("/game/new");
        return;
      }

      const state = sessions[0].master_state;
      const store = useGameStore.getState();

      store.clearMessages();
      store.setMasterState(state);
      store.setAsciiArt(null);

      const worldName = WORLD_NAMES[state.metadata.genre] ?? "World";
      const opening =
        `You are ${state.player_state.name}, a ${state.player_state.background} in the ${worldName}. ` +
        `Your adventure begins at ${state.world_state.current_location_id}. What do you do?`;
      store.addMessage(makeMessage("SYSTEM", opening));

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
          {currentAscii && (
            <pre
              className="ascii-art text-glow shrink-0 overflow-x-auto px-4 py-3"
              style={{
                color: "var(--color-primary)",
                borderBottom: "1px solid var(--color-border)",
              }}
            >
              {currentAscii}
            </pre>
          )}
          <StoryFeed messages={messages} isLoading={isProcessing} />
          <InputBar
            onSubmit={(input) => {
              void submitAction(input);
            }}
            disabled={isProcessing}
            processingStep={processingStep}
          />
        </>
      }
      sidebar={
        <>
          <CharacterSheet genre={genre} />
          <InventoryPanel />
        </>
      }
    />
  );
}
