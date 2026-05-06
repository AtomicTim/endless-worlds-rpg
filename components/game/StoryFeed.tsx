"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { StoryMessage } from "@/lib/stores/game-store";
import { useGameStore } from "@/lib/stores/game-store";
import { Genre } from "@/types/game";
import type { PointOfInterest } from "@/types/game";
import { InteractionPopover } from "./InteractionPopover";
import { POI_COLORS } from "./poi-colors";
import { getGenreColors } from "./genre-ui";
import {
  buildExactHighlights,
  findExactHighlights,
  type HighlightCandidate,
  type HighlightMatch,
} from "@/lib/game/highlights";

// Re-export so existing import sites keep working.
export type { StoryMessage } from "@/lib/stores/game-store";
export type MessageType = StoryMessage["type"];

interface StoryFeedProps {
  messages:  StoryMessage[];
  isLoading?: boolean;
  onSubmit?: (input: string) => void;
  /** Navigation redesign — when a LOCATION highlight has a nodeId, the
   *  click handler routes directly through this callback instead of
   *  opening a popover and submitting "go to <name>" text. Maps to
   *  useGameLoop.navigateTo. */
  onNavigate?: (nodeId: string) => void;
}

/** Detect SYSTEM messages that are stat-check feedback — rendered as a
 *  framed mechanical receipt. Format produced by buildRollFeedback. */
function isStatCheckMessage(content: string): { isCheck: boolean; passed: boolean } {
  if (!content.includes("check:")) return { isCheck: false, passed: false };
  if (content.includes("Passed")) return { isCheck: true, passed: true };
  if (content.includes("Failed")) return { isCheck: true, passed: false };
  return { isCheck: false, passed: false };
}

interface PopoverState {
  point:    PointOfInterest;
  position: { x: number; y: number };
}

export function StoryFeed({ messages, isLoading = false, onSubmit, onNavigate }: StoryFeedProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [popover, setPopover] = useState<PopoverState | null>(null);
  // Day 18 — every genre themes the feed via getGenreColors. Read once here
  // and pass down so MessageEntry doesn't subscribe N times.
  const genre = useGameStore((s) => s.masterState?.metadata.genre) ?? Genre.FANTASY;

  // Day 19E — exact-match highlight candidates computed from live state.
  // Replaces narrator-emitted points_of_interest fuzzy scanning. Recomputed
  // when masterState or locationAssets change (i.e. on every move/asset
  // refresh) — earlier messages re-render with the candidates that exist
  // RIGHT NOW; that's intentional, since highlights drive interactions
  // available at the player's current node.
  const masterState    = useGameStore((s) => s.masterState);
  const locationAssets = useGameStore((s) => s.locationAssets);
  const highlightCandidates = useMemo<HighlightCandidate[]>(() => {
    if (!masterState) return [];
    return buildExactHighlights(masterState, locationAssets);
  }, [masterState, locationAssets]);

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
    // `min-h-0` is required so this flex child can actually shrink below its
    // content size and scroll independently when the DialogueModal takes up
    // its own row in the column. Without it, flex's default `min-height: auto`
    // would let the feed grow and push the modal/InputBar off-screen.
    <div
      className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-4 py-4"
      style={{ fontFamily: "var(--font-mono)" }}
    >
      {messages.map((msg) => (
        <MessageEntry
          key={msg.id}
          message={msg}
          onPoiClick={openPopover}
          onNavigate={onNavigate}
          genre={genre}
          highlightCandidates={highlightCandidates}
        />
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
  message:             StoryMessage;
  onPoiClick:          (point: PointOfInterest, e: React.MouseEvent) => void;
  onNavigate?:         (nodeId: string) => void;
  genre:               Genre;
  highlightCandidates: HighlightCandidate[];
}

function MessageEntry({ message, onPoiClick, onNavigate, genre, highlightCandidates }: MessageEntryProps) {
  const { type, content, metadata } = message;
  const restored  = metadata?.restored === true;
  const npcName   =
    typeof metadata?.npcName === "string" ? metadata.npcName : undefined;
  const locationName =
    typeof metadata?.locationName === "string" ? metadata.locationName : undefined;

  // Day 18 — every accent on every message ultimately reads through this.
  const colors = getGenreColors(genre);

  const inner = (() => {
  switch (type) {
    case "NARRATIVE":
      // 6a — NARRATIVE with a locationName on metadata renders the genre-themed
      // arrival header (◈ NAME) above the body prose.
      return (
        <div className="message-enter">
          {locationName && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "12px 0 8px" }}>
              <div style={{ flex: 1, height: 1, background: "#2a3040" }} />
              <span
                style={{
                  color:         colors.primary,
                  fontSize:      13,
                  fontWeight:    "bold",
                  letterSpacing: "0.05em",
                  fontFamily:    "var(--font-mono)",
                }}
              >
                ◈ {locationName}
              </span>
              <div style={{ flex: 1, height: 1, background: "#2a3040" }} />
            </div>
          )}
          <p
            style={{
              color:      "#8899aa",
              lineHeight: 1.7,
              margin:     "8px 0",
              fontFamily: "var(--font-mono)",
              fontSize:   12,
            }}
          >
            {renderNarrativeText(content, highlightCandidates, onPoiClick, onNavigate)}
          </p>
        </div>
      );

    case "SYSTEM": {
      // 6f — Player action echo (lines starting with "> ").
      if (content.startsWith("> ")) {
        return (
          <div
            className="message-enter"
            style={{
              color:      "#446644",
              fontSize:   12,
              margin:     "10px 0 4px",
              fontFamily: "var(--font-mono)",
            }}
          >
            ◈ &gt; {content.slice(2)}
          </div>
        );
      }
      // 6c — Stat check feedback (mechanical receipt).
      const check = isStatCheckMessage(content);
      if (check.isCheck) {
        const barColor   = check.passed ? "#22aa44" : "#aa3322";
        const labelColor = check.passed ? "#44aa66" : "#aa4433";
        return (
          <div
            className="message-enter"
            style={{
              background:    "rgba(0,0,0,0.3)",
              borderLeft:    `3px solid ${barColor}`,
              padding:       "6px 10px",
              margin:        "6px 0",
              fontFamily:    "var(--font-mono)",
              fontSize:      11,
            }}
          >
            <div
              style={{
                fontSize:      10,
                letterSpacing: "0.1em",
                color:         "#556677",
                marginBottom:  3,
              }}
            >
              stat check
            </div>
            <div style={{ color: labelColor }}>{content}</div>
          </div>
        );
      }
      // 6d — Generic system event (items acquired, trust, etc.) — italic primary.
      return (
        <div
          className="message-enter"
          style={{
            fontSize:   11,
            color:      colors.primary,
            fontStyle:  "italic",
            margin:     "4px 0",
            fontFamily: "var(--font-mono)",
          }}
        >
          ✦ {content}
        </div>
      );
    }

    case "COMBAT":
      return (
        <p
          className="message-enter"
          style={{
            color:      "#ef9a9a",
            fontSize:   12,
            margin:     "6px 0",
            fontFamily: "var(--font-mono)",
          }}
        >
          <span style={{ marginRight: 6 }}>⚔</span>
          {content}
        </p>
      );

    case "DIALOGUE":
      // 6b — NPC dialogue: name in genre-primary above a quoted block.
      return (
        <div className="message-enter" style={{ margin: "8px 0" }}>
          <div
            style={{
              fontSize:      11,
              fontWeight:    "bold",
              color:         colors.primary,
              letterSpacing: "0.08em",
              marginBottom:  4,
              fontFamily:    "var(--font-mono)",
              textTransform: "uppercase",
            }}
          >
            {npcName ?? "Unknown"}
          </div>
          <div
            style={{
              borderLeft:  `3px solid ${colors.primary}`,
              padding:     "4px 10px",
              background:  "rgba(0,0,0,0.2)",
              color:       "#ccd8e8",
              fontFamily:  "var(--font-mono)",
              fontSize:    12,
              lineHeight:  1.7,
            }}
          >
            {parseDialogueText(content).map((seg, i) =>
              seg.isQuote ? (
                <span
                  key={i}
                  style={{ color: colors.primary, fontStyle: "italic" }}
                >
                  {seg.content}
                </span>
              ) : (
                <span key={i} style={{ color: "#ccd8e8" }}>
                  {seg.content}
                </span>
              )
            )}
          </div>
        </div>
      );

    case "ASCII_ART":
      return (
        <pre
          className="message-enter ascii-art text-glow overflow-x-auto"
          style={{ color: colors.primary, fontFamily: "var(--font-mono)" }}
        >
          {content}
        </pre>
      );

    case "LORE": {
      const itemName =
        typeof metadata?.item_name === "string" ? metadata.item_name : undefined;
      return (
        <div
          className="message-enter"
          style={{
            borderLeft:  `2px solid color-mix(in srgb, ${colors.primary} 50%, transparent)`,
            paddingLeft: 12,
            margin:      "8px 0",
            fontFamily:  "var(--font-mono)",
          }}
        >
          {itemName && (
            <span
              style={{
                display:       "block",
                fontSize:      10,
                fontWeight:    "bold",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color:         colors.primary,
              }}
            >
              {itemName}
            </span>
          )}
          <p
            style={{
              fontSize:   13,
              fontStyle:  "italic",
              lineHeight: 1.6,
              color:      "color-mix(in srgb, #8899aa 90%, transparent)",
            }}
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
//
// Day 19E: switched from narrator-emitted points_of_interest fuzzy scanning
// to exact, whole-word, case-insensitive matching against highlight
// candidates derived from live world state (Tier 1 objects, NPCs in the
// graph, connected locations, WCD landmarks).

function renderNarrativeText(
  text:       string,
  candidates: HighlightCandidate[],
  onPoiClick: (point: PointOfInterest, e: React.MouseEvent) => void,
  onNavigate?: (nodeId: string) => void
): React.ReactNode {
  const matches: HighlightMatch[] = findExactHighlights(text, candidates);
  if (matches.length === 0) return text;

  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  matches.forEach((m, i) => {
    if (m.start > cursor) nodes.push(text.slice(cursor, m.start));
    const accent = POI_COLORS[m.point.type];

    // Navigation redesign — when a LOCATION highlight carries a nodeId
    // and the parent provided onNavigate, click goes straight to
    // navigateTo without opening the popover. Other types (NPC, ITEM,
    // CONTAINER, HAZARD, LANDMARK) still open the popover.
    const isDirectNav = m.point.type === "LOCATION" && !!m.nodeId && !!onNavigate;
    const handleClick = (e: React.MouseEvent) => {
      if (isDirectNav && m.nodeId) {
        onNavigate!(m.nodeId);
      } else {
        onPoiClick(m.point, e);
      }
    };
    nodes.push(
      <span
        key={`poi-${i}-${m.start}`}
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (isDirectNav && m.nodeId) {
              onNavigate!(m.nodeId);
            } else {
              const target = e.currentTarget.getBoundingClientRect();
              onPoiClick(m.point, {
                clientX: target.left,
                clientY: target.bottom,
              } as React.MouseEvent);
            }
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
