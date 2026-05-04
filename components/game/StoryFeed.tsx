"use client";

import { useEffect, useRef, useState } from "react";
import type { StoryMessage } from "@/lib/stores/game-store";
import type { PointOfInterest } from "@/types/game";
import { InteractionPopover } from "./InteractionPopover";
import { POI_COLORS } from "./poi-colors";

// Re-export so existing import sites keep working.
export type { StoryMessage } from "@/lib/stores/game-store";
export type MessageType = StoryMessage["type"];

interface StoryFeedProps {
  messages:  StoryMessage[];
  isLoading?: boolean;
  onSubmit?: (input: string) => void;
}

interface PopoverState {
  point:    PointOfInterest;
  position: { x: number; y: number };
}

export function StoryFeed({ messages, isLoading = false, onSubmit }: StoryFeedProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [popover, setPopover] = useState<PopoverState | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const openPopover = (point: PointOfInterest, e: React.MouseEvent) => {
    setPopover({ point, position: { x: e.clientX, y: e.clientY } });
  };

  const closePopover = () => setPopover(null);

  const submitFromPopover = (input: string) => {
    onSubmit?.(input);
  };

  return (
    <div className="scrollbar-thin flex-1 space-y-3 overflow-y-auto px-4 py-4">
      {messages.map((msg) => (
        <MessageEntry key={msg.id} message={msg} onPoiClick={openPopover} />
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

      {popover && (
        <InteractionPopover
          point={popover.point}
          position={popover.position}
          onAction={submitFromPopover}
          onClose={closePopover}
        />
      )}
    </div>
  );
}

interface MessageEntryProps {
  message:    StoryMessage;
  onPoiClick: (point: PointOfInterest, e: React.MouseEvent) => void;
}

function MessageEntry({ message, onPoiClick }: MessageEntryProps) {
  const { type, content, metadata } = message;
  const restored = metadata?.restored === true;
  const npcName =
    typeof metadata?.npcName === "string" ? metadata.npcName : undefined;
  const points =
    Array.isArray(metadata?.points_of_interest)
      ? (metadata!.points_of_interest as PointOfInterest[])
      : [];

  const inner = (() => {
  switch (type) {
    case "NARRATIVE":
      return (
        <p
          className="message-enter font-mono text-sm leading-relaxed"
          style={{ color: "var(--color-text)" }}
        >
          {renderNarrativeText(content, points, onPoiClick)}
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
          className="message-enter space-y-0.5 border-l-2"
          style={{ borderColor: "var(--color-accent)", paddingLeft: "12px" }}
        >
          {npcName && (
            <span
              className="block text-[10px] font-bold uppercase tracking-widest"
              style={{ color: "var(--color-accent)" }}
            >
              {npcName}
            </span>
          )}
          <p className="font-mono text-sm leading-relaxed">
            {parseDialogueText(content).map((seg, i) =>
              seg.isQuote ? (
                <span
                  key={i}
                  style={{ color: "var(--color-accent)", fontStyle: "italic" }}
                >
                  {seg.content}
                </span>
              ) : (
                <span key={i} style={{ color: "var(--color-text)" }}>
                  {seg.content}
                </span>
              )
            )}
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
  })();

  if (!inner) return null;
  if (!restored) return <>{inner}</>;
  // Restored messages from a previous session — slightly muted to distinguish
  // them from new messages in the current session.
  return <div style={{ opacity: 0.8 }}>{inner}</div>;
}

// ── Dialogue text parsing ─────────────────────────────────────────────────────

interface DialogueSegment {
  content: string;
  isQuote: boolean;
}

/**
 * Splits narrator dialogue text into prose segments and quoted segments.
 * Quoted segments are text inside "double quotes" — the narrator's speech
 * format. Prose segments stay in --color-text; quoted segments get
 * --color-accent + italic so only the spoken words pop visually.
 */
function parseDialogueText(text: string): DialogueSegment[] {
  const segments: DialogueSegment[] = [];
  // Match content inside "double quotes" (the narrator's dialogue format).
  // Simple non-greedy match — doesn't need to handle escaped quotes because
  // the LLM output doesn't produce them in this context.
  const quoteRegex = /"[^"]*"/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = quoteRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ content: text.slice(lastIndex, match.index), isQuote: false });
    }
    segments.push({ content: match[0], isQuote: true });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    segments.push({ content: text.slice(lastIndex), isQuote: false });
  }
  // If no quotes found (plain narrative fallback), return whole text as prose.
  return segments.length > 0 ? segments : [{ content: text, isQuote: false }];
}

// ── POI rendering ─────────────────────────────────────────────────────────────

interface PoiMatch {
  start: number;
  end:   number;
  point: PointOfInterest;
}

function findPoiMatches(text: string, points: PointOfInterest[]): PoiMatch[] {
  if (points.length === 0) return [];
  const lower = text.toLowerCase();
  const raw: PoiMatch[] = [];
  for (const point of points) {
    const label = point.label?.trim();
    if (!label) continue;
    const idx = lower.indexOf(label.toLowerCase());
    if (idx >= 0) raw.push({ start: idx, end: idx + label.length, point });
  }
  // Sort by start ascending; on tie prefer the longer label.
  raw.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));
  // Drop overlapping matches — first one wins.
  const out: PoiMatch[] = [];
  let lastEnd = -1;
  for (const m of raw) {
    if (m.start >= lastEnd) {
      out.push(m);
      lastEnd = m.end;
    }
  }
  return out;
}

function renderNarrativeText(
  text: string,
  points: PointOfInterest[],
  onPoiClick: (point: PointOfInterest, e: React.MouseEvent) => void
): React.ReactNode {
  const matches = findPoiMatches(text, points);
  if (matches.length === 0) return text;

  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  matches.forEach((m, i) => {
    if (m.start > cursor) nodes.push(text.slice(cursor, m.start));
    const accent = POI_COLORS[m.point.type];
    nodes.push(
      <span
        key={`poi-${i}-${m.start}`}
        role="button"
        tabIndex={0}
        onClick={(e) => onPoiClick(m.point, e)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            const target = e.currentTarget.getBoundingClientRect();
            onPoiClick(m.point, {
              clientX: target.left,
              clientY: target.bottom,
            } as React.MouseEvent);
          }
        }}
        className="cursor-pointer underline decoration-dotted underline-offset-2 transition-opacity hover:opacity-80"
        style={{ color: accent, textDecorationColor: accent }}
      >
        {text.slice(m.start, m.end)}
      </span>
    );
    cursor = m.end;
  });
  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
}
