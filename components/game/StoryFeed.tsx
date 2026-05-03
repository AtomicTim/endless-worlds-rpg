"use client";

import { useEffect, useRef } from "react";
import type { StoryMessage } from "@/lib/stores/game-store";

// Re-export so existing import sites keep working.
export type { StoryMessage } from "@/lib/stores/game-store";
export type MessageType = StoryMessage["type"];

interface StoryFeedProps {
  messages: StoryMessage[];
  isLoading?: boolean;
}

export function StoryFeed({ messages, isLoading = false }: StoryFeedProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  return (
    <div className="scrollbar-thin flex-1 space-y-3 overflow-y-auto px-4 py-4">
      {messages.map((msg) => (
        <MessageEntry key={msg.id} message={msg} />
      ))}

      {isLoading && (
        <div className="flex items-center gap-2 font-mono text-sm italic">
          <span className="cursor-blink" style={{ color: "var(--color-primary)" }}>
            █
          </span>
          <span style={{ color: "var(--color-muted)" }}>Generating response…</span>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}

function MessageEntry({ message }: { message: StoryMessage }) {
  const { type, content, metadata } = message;
  const npcName =
    typeof metadata?.npcName === "string" ? metadata.npcName : undefined;

  switch (type) {
    case "NARRATIVE":
      return (
        <p
          className="message-enter font-mono text-sm leading-relaxed"
          style={{ color: "var(--color-text)" }}
        >
          {content}
        </p>
      );

    case "SYSTEM":
      return (
        <p
          className="message-enter font-mono text-xs italic"
          style={{ color: "var(--color-muted)" }}
        >
          ◈ {content}
        </p>
      );

    case "COMBAT":
      return (
        <p className="message-enter font-mono text-sm text-red-400/90">
          <span className="mr-1.5">⚔</span>
          {content}
        </p>
      );

    case "DIALOGUE":
      return (
        <div
          className="message-enter space-y-0.5 border-l-2 pl-3"
          style={{ borderColor: "color-mix(in srgb, var(--color-accent) 60%, transparent)" }}
        >
          {npcName && (
            <span
              className="block text-[10px] font-bold uppercase tracking-widest"
              style={{ color: "var(--color-accent)" }}
            >
              {npcName}
            </span>
          )}
          <p
            className="font-mono text-sm italic"
            style={{ color: "color-mix(in srgb, var(--color-text) 88%, transparent)" }}
          >
            &ldquo;{content}&rdquo;
          </p>
        </div>
      );

    case "ASCII_ART":
      return (
        <pre
          className="message-enter ascii-art text-glow overflow-x-auto"
          style={{ color: "var(--color-primary)" }}
        >
          {content}
        </pre>
      );

    case "LORE": {
      const itemName =
        typeof metadata?.item_name === "string" ? metadata.item_name : undefined;
      return (
        <div
          className="message-enter border-l-2 pl-3"
          style={{ borderColor: "color-mix(in srgb, var(--color-primary) 50%, transparent)" }}
        >
          {itemName && (
            <span
              className="block text-[10px] font-bold uppercase tracking-widest"
              style={{ color: "var(--color-primary)" }}
            >
              {itemName}
            </span>
          )}
          <p
            className="font-mono text-sm italic leading-relaxed"
            style={{ color: "color-mix(in srgb, var(--color-text) 80%, transparent)" }}
          >
            {content}
          </p>
        </div>
      );
    }

    default:
      return null;
  }
}
