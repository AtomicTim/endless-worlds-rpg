"use client";

import { useState } from "react";
import { GameLayout } from "@/components/layout/GameLayout";
import { StoryFeed, type StoryMessage } from "@/components/game/StoryFeed";
import { InputBar } from "@/components/game/InputBar";
import { CharacterSheet } from "@/components/game/sidebar/CharacterSheet";
import { InventoryPanel } from "@/components/game/sidebar/InventoryPanel";
import { Genre } from "@/types/game";

const INITIAL_MESSAGES: StoryMessage[] = [
  {
    id: "1",
    type: "ASCII_ART",
    content: `╔════════════════════════════════════════╗
║      THORNWOOD FOREST — ENTRANCE        ║
╚════════════════════════════════════════╝`,
  },
  {
    id: "2",
    type: "NARRATIVE",
    content:
      "You stand at the entrance of the Thornwood Forest. Ancient oaks loom overhead, their gnarled branches forming a canopy that blots out the stars. The air smells of pine and something older — something without a name.",
  },
  {
    id: "3",
    type: "DIALOGUE",
    npcName: "Old Hermit",
    content:
      "They say the forest speaks to those who listen... but most who listen never come back.",
  },
  {
    id: "4",
    type: "SYSTEM",
    content:
      "You notice a worn path leading deeper into the forest. Perception check passed (13 vs DC 10).",
  },
  {
    id: "5",
    type: "COMBAT",
    content:
      "A shadow wolf emerges from the undergrowth! Initiative rolled: 14 vs 11. You act first.",
  },
];

const GENRE = Genre.FANTASY;

export default function GamePage() {
  const [messages, setMessages] = useState<StoryMessage[]>(INITIAL_MESSAGES);
  const [isLoading, setIsLoading] = useState(false);

  function handleSubmit(input: string) {
    const echoMsg: StoryMessage = {
      id: crypto.randomUUID(),
      type: "SYSTEM",
      content: `> ${input}`,
    };
    setMessages((prev) => [...prev, echoMsg]);
    setIsLoading(true);

    // Placeholder response — Day 5 wires this to the AI engine
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          type: "NARRATIVE",
          content:
            "The forest watches you in silence. The AI engine will respond here once Day 5 is complete.",
        },
      ]);
      setIsLoading(false);
    }, 1200);
  }

  return (
    <GameLayout
      genre={GENRE}
      mainPanel={
        <>
          <StoryFeed messages={messages} isLoading={isLoading} />
          <InputBar onSubmit={handleSubmit} disabled={isLoading} />
        </>
      }
      sidebar={
        <>
          <CharacterSheet genre={GENRE} />
          <InventoryPanel />
        </>
      }
    />
  );
}
