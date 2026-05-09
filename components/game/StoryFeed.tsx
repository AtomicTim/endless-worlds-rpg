"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import type { StoryMessage } from "@/lib/stores/game-store";
import { useGameStore } from "@/lib/stores/game-store";
import { Genre } from "@/types/game";
import type { PointOfInterest } from "@/types/game";
import { InteractionPopover } from "./InteractionPopover";
import {
  NarrativeBlock,
  NPCSpeech,
  SceneDivider,
  LocationSpan,
  RegionSpan,
  NpcSpan,
  ItemSpan,
  LandmarkSpan,
  StatPill,
  wrapQuotes,
} from "./StoryComponents";
import {
  buildExactHighlights,
  findExactHighlights,
  type HighlightCandidate,
  type HighlightMatch,
} from "@/lib/game/highlights";

/**
 * Story Feed — redesign per /design/desktop-ui.jsx + /design/ui-pieces.jsx.
 *
 * Typography is serif body prose with mono dividers. Inline highlight roles
 * (LOCATION / NPC / ITEM / LANDMARK) are rendered through the design's
 * .ew-link-* span classes. Direct character speech ("...") is wrapped in
 * .ew-said for the typographic accent.
 *
 * Messages render as:
 *   - NARRATIVE   → NarrativeBlock (or muted player echo when isPlayerDialogue)
 *   - DIALOGUE    → NPCSpeech (NPC name header + serif italic speech)
 *   - SYSTEM      → SceneDivider for major events; small mono line for codex/etc.
 *   - COMBAT      → red-tinted serif line
 *   - ASCII_ART / LORE — preserved styles
 *
 * Stat-check SYSTEM messages render through StatPill so the descriptor is
 * highlighted with pass/fail tinting and the roll annotation sits in mono.
 */

// Re-export so existing import sites keep working.
export type { StoryMessage } from "@/lib/stores/game-store";
export type MessageType = StoryMessage["type"];

interface StoryFeedProps {
  messages:    StoryMessage[];
  isLoading?:  boolean;
  loadingText?: string | null;
  onSubmit?:   (input: string) => void;
  onNavigate?: (nodeId: string) => void;
  /** In-flow slot rendered at the bottom of the scroll container, after
   *  the last message. Used to host the inline DialogueModal so the panel
   *  pushes the feed up rather than overlaying it as a fixed element. */
  bottomSlot?: React.ReactNode;
}

// ── Stat-check parsing ──────────────────────────────────────────────────────
// buildRollFeedback (in useGameLoop) emits strings like:
//   "🎭 Charisma check: 14 +0 (CHA) = 14 vs difficulty 12 — Passed!"
//   "💪 Strength check: 5 -1 (STR) = 4 vs difficulty 12 — Failed."
// We parse these out to a structured pill instead of rendering the raw line.

interface StatCheck {
  stat:    string;
  total:   number;
  dc:      number;
  pass:    boolean;
}

function parseStatCheck(content: string): StatCheck | null {
  // capture the short stat code in parens, the running total, the difficulty,
  // and whether it passed.
  const m = content.match(/\(([A-Z]{3})\)\s*=\s*(-?\d+)\s*vs\s*difficulty\s*(\d+)\s*—\s*(Passed|Failed)/i);
  if (!m) return null;
  return {
    stat:  m[1],
    total: parseInt(m[2], 10),
    dc:    parseInt(m[3], 10),
    pass:  /^Pass/i.test(m[4]),
  };
}

interface PopoverState {
  point:    PointOfInterest;
  position: { x: number; y: number };
}

export function StoryFeed({ messages, isLoading = false, loadingText, onSubmit, onNavigate, bottomSlot }: StoryFeedProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [popover, setPopover] = useState<PopoverState | null>(null);
  const genre = useGameStore((s) => s.masterState?.metadata.genre) ?? Genre.FANTASY;

  const masterState    = useGameStore((s) => s.masterState);
  const locationAssets = useGameStore((s) => s.locationAssets);
  const dialogueOpen   = useGameStore((s) => s.currentDialogueOptions.length > 0);
  const highlightCandidates = useMemo<HighlightCandidate[]>(() => {
    if (!masterState) return [];
    return buildExactHighlights(masterState, locationAssets);
  }, [masterState, locationAssets]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Auto-scroll the feed when the dialogue panel opens so the new in-flow
  // panel comes into view rather than appearing under the player's
  // current scroll position.
  useEffect(() => {
    if (!dialogueOpen) return;
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [dialogueOpen]);

  const openPopover = (point: PointOfInterest, e: React.MouseEvent) => {
    setPopover({ point, position: { x: e.clientX, y: e.clientY } });
  };
  const closePopover = () => setPopover(null);
  const submitFromPopover = (input: string) => onSubmit?.(input);

  return (
    <div
      ref={scrollRef}
      className="ew-scroll min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-8 md:py-6"
      style={{
        position:        "relative",
        background:      "var(--bg-0)",
        fontFamily:      "var(--sans)",
      }}
    >
      <div
        className="ew-grain"
        style={{ ["--grain" as string]: 0.15 }}
      />
      <div style={{ position: "relative", margin: "0 auto" }}>
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
          <div
            className="ew-mono"
            style={{
              display:       "flex",
              alignItems:    "center",
              gap:           8,
              fontSize:      11,
              letterSpacing: "0.18em",
              color:         "var(--ink-4)",
              fontStyle:     "italic",
              padding:       "8px 0",
            }}
          >
            <span className="cursor-blink" style={{ color: "var(--accent)" }}>▋</span>
            <span>{loadingText ?? "Thinking…"}</span>
          </div>
        )}

        {bottomSlot}

        <div ref={bottomRef} />
      </div>

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

// ── Message entry ───────────────────────────────────────────────────────────

interface MessageEntryProps {
  message:             StoryMessage;
  onPoiClick:          (point: PointOfInterest, e: React.MouseEvent) => void;
  onNavigate?:         (nodeId: string) => void;
  genre:               Genre;
  highlightCandidates: HighlightCandidate[];
}

function MessageEntry({ message, onPoiClick, onNavigate, genre, highlightCandidates }: MessageEntryProps) {
  void genre;
  const { type, content, metadata } = message;
  const restored         = metadata?.restored === true;
  const npcName          = typeof metadata?.npcName === "string" ? metadata.npcName : undefined;
  const locationName     = typeof metadata?.locationName === "string" ? metadata.locationName : undefined;
  const isPlayerDialogue = metadata?.isPlayerDialogue === true;

  const inner = (() => {
    switch (type) {
      case "NARRATIVE": {
        // Player echo (DialogueModal inline submit / option click).
        // Fix 5 — muted teal so the player can scan their own actions
        // distinct from narration / NPC dialogue.
        if (isPlayerDialogue) {
          return (
            <div
              className="message-enter"
              style={{
                color:         "#7ab8c8",
                fontFamily:    "var(--mono)",
                fontSize:      12,
                letterSpacing: "0.05em",
                margin:        "10px 0 4px",
                fontStyle:     "italic",
              }}
            >
              ◈ {content.replace(/^"|"$/g, "")}
            </div>
          );
        }
        // Arrival divider sits above the body paragraph.
        return (
          <div className="message-enter">
            {locationName && (
              <SceneDivider
                label={
                  <span style={{ color: "var(--accent)" }}>◈ {locationName}</span>
                }
              />
            )}
            <NarrativeBlock skipQuoteWrap>
              {renderNarrativeText(content, highlightCandidates, onPoiClick, onNavigate)}
            </NarrativeBlock>
          </div>
        );
      }

      case "SYSTEM": {
        // V8.34 — soft preamble for fresh games. Italic + low opacity
        // so it reads as an invitation, not a system event.
        if (metadata?.isFreshGamePreamble === true) {
          return (
            <div
              className="message-enter ew-serif"
              style={{
                fontSize:    14,
                fontStyle:   "italic",
                color:       "var(--ink-3)",
                opacity:     0.85,
                margin:      "10px 0 18px",
                lineHeight:  1.5,
              }}
            >
              {content}
            </div>
          );
        }
        // Player action echo — Fix 5: muted teal to mark the player's
        // own input apart from system events / narration.
        if (content.startsWith("> ")) {
          return (
            <div
              className="message-enter"
              style={{
                color:         "#7ab8c8",
                fontFamily:    "var(--mono)",
                fontSize:      12,
                letterSpacing: "0.05em",
                margin:        "10px 0 4px",
                fontStyle:     "italic",
              }}
            >
              ◈ {content.slice(2)}
            </div>
          );
        }

        // Stat-check receipt — render as a StatPill on its own line.
        const check = parseStatCheck(content);
        if (check) {
          return (
            <div className="message-enter" style={{ margin: "8px 0" }}>
              <StatPill
                stat={check.stat}
                total={check.total}
                dc={check.dc}
                pass={check.pass}
                descriptor={check.pass ? "the moment turned in your favor" : "the moment slipped past you"}
              />
            </div>
          );
        }

        // Codex-add notification — small mono line with accent diamond.
        if (content.includes("added to codex")) {
          return (
            <div
              className="message-enter ew-mono"
              style={{
                fontSize:      10,
                letterSpacing: "0.22em",
                color:         "var(--accent)",
                margin:        "6px 0",
                fontStyle:     "italic",
                opacity:       0.9,
              }}
            >
              {content}
            </div>
          );
        }

        // Section dividers — anything wrapped in em-dashes is a beat marker.
        if (/^—\s.+\s—$/.test(content)) {
          return <SceneDivider label={content.replace(/^—\s|\s—$/g, "")} />;
        }

        // Generic system event — small italic accent.
        return (
          <div
            className="message-enter ew-mono"
            style={{
              fontSize:      11,
              letterSpacing: "0.12em",
              color:         "var(--accent)",
              margin:        "6px 0",
              fontStyle:     "italic",
            }}
          >
            ✦ {content}
          </div>
        );
      }

      case "COMBAT": {
        // Day 20 Combat — style by event metadata (locked decisions §10).
        // Fields: combat, event_type, actor, target, outcome.
        const m = metadata ?? {};
        const eventType = typeof m.event_type === "string" ? m.event_type : null;
        const actor     = typeof m.actor === "string" ? m.actor : null;
        const outcome   = typeof m.outcome === "string" ? m.outcome : null;

        // Event-class buckets:
        //   victory / defeat / flee_success → 1.5x bold colored line
        //   crit                              → bold + darker color, ⚔ prefix
        //   routine                           → normal weight + side color, ⚔ prefix
        const isVictory = eventType === "victory";
        const isDefeat  = eventType === "defeat";
        const isFlee    = eventType === "flee_success";
        const isHero    = isVictory || isDefeat || isFlee;
        const isCrit    = outcome === "crit";
        const isPlayer  = actor === "PLAYER";

        const color = isVictory ? "var(--combat-victory)"
          : isDefeat ? "var(--combat-defeat)"
          : isFlee   ? "var(--combat-flee)"
          : isCrit
            ? (isPlayer ? "var(--combat-player-crit)" : "var(--combat-enemy-crit)")
            : (isPlayer ? "var(--combat-player)" : "var(--combat-enemy)");

        const fontSize = isHero ? 19 : 13;
        const fontWeight = isHero || isCrit ? 700 : 400;
        const fontStyle  = isHero ? "normal" : "italic";

        return (
          <p
            className="message-enter ew-serif"
            style={{
              color,
              fontSize,
              fontWeight,
              fontStyle,
              margin:        isHero ? "10px 0" : "6px 0",
              letterSpacing: isHero ? "0.04em" : undefined,
            }}
          >
            <span style={{ marginRight: 6 }}>⚔</span>
            {content}
          </p>
        );
      }

      case "DIALOGUE": {
        // NPC speech bubble — design's NPCSpeech component.
        return (
          <NPCSpeech name={npcName ?? "Unknown"}>
            {wrapQuotes(content)}
          </NPCSpeech>
        );
      }

      case "ASCII_ART":
        return (
          <pre
            className="message-enter ascii-art text-glow overflow-x-auto"
            style={{ color: "var(--accent)", fontFamily: "var(--mono)" }}
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
              borderLeft:  "2px solid color-mix(in srgb, var(--accent) 50%, transparent)",
              paddingLeft: 12,
              margin:      "8px 0",
              maxWidth:    640,
            }}
          >
            {itemName && (
              <span
                className="ew-mono"
                style={{
                  display:       "block",
                  fontSize:      10,
                  fontWeight:    "bold",
                  textTransform: "uppercase",
                  letterSpacing: "0.18em",
                  color:         "var(--accent)",
                  marginBottom:  4,
                }}
              >
                {itemName}
              </span>
            )}
            <p
              className="ew-serif"
              style={{
                fontSize:   13,
                fontStyle:  "italic",
                lineHeight: 1.7,
                color:      "var(--ink-3)",
                margin:     0,
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
  return <div style={{ opacity: 0.78 }}>{inner}</div>;
}

// ── Narrative-with-highlights renderer ──────────────────────────────────────
//
// Produces a React node array where every match against a HighlightCandidate
// becomes a clickable inline span with the design's role class. Plain runs
// in between are wrapped in wrapQuotes() so direct character speech inside
// the prose still styles via .ew-said.

function spanForType(
  type:        PointOfInterest["type"],
  text:        string,
  onClick:     (e: React.MouseEvent) => void,
  onKeyDown:   (e: React.KeyboardEvent) => void,
  key:         string,
  /** FIX 1 — when true, the highlight resolves to a region-tier node
   *  (e.g. "The Drift Barrens") and renders through RegionSpan with
   *  the lavender hl-region token instead of the sky-blue hl-loc. */
  isRegion:    boolean
): React.ReactNode {
  // FIX 4 — separate `key` from the rest of props. Spreading an object
  // that contains `key` into JSX is a React warning ("React keys must
  // be passed directly to JSX without using spread"); pass it on its
  // own attribute and spread only the remaining props.
  const rest = {
    role:       "button" as const,
    tabIndex:   0,
    onClick,
    onKeyDown,
    style:      { cursor: "pointer" } as React.CSSProperties,
  };
  switch (type) {
    case "LOCATION": return isRegion
      ? <RegionSpan   key={key} {...rest}>{text}</RegionSpan>
      : <LocationSpan key={key} {...rest}>{text}</LocationSpan>;
    case "NPC":      return <NpcSpan      key={key} {...rest}>{text}</NpcSpan>;
    case "LANDMARK": return <LandmarkSpan key={key} {...rest}>{text}</LandmarkSpan>;
    case "ITEM":
    case "CONTAINER":
    case "HAZARD":
    default:         return <ItemSpan     key={key} {...rest}>{text}</ItemSpan>;
  }
}

function renderNarrativeText(
  text:        string,
  candidates:  HighlightCandidate[],
  onPoiClick:  (point: PointOfInterest, e: React.MouseEvent) => void,
  onNavigate?: (nodeId: string) => void
): React.ReactNode {
  const matches: HighlightMatch[] = findExactHighlights(text, candidates);
  if (matches.length === 0) return wrapQuotes(text);

  const nodes: React.ReactNode[] = [];
  let cursor = 0;

  matches.forEach((m, i) => {
    if (m.start > cursor) {
      // Plain text run — pass through quote-wrapping so .ew-said styles work.
      nodes.push(
        <React.Fragment key={`txt-${i}-${cursor}`}>
          {wrapQuotes(text.slice(cursor, m.start))}
        </React.Fragment>
      );
    }

    const isDirectNav = m.point.type === "LOCATION" && !!m.nodeId && !!onNavigate;
    const handleClick = (e: React.MouseEvent) => {
      if (isDirectNav && m.nodeId) {
        onNavigate!(m.nodeId);
      } else {
        onPoiClick(m.point, e);
      }
    };
    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      if (isDirectNav && m.nodeId) {
        onNavigate!(m.nodeId);
      } else {
        const target = (e.currentTarget as HTMLElement).getBoundingClientRect();
        onPoiClick(m.point, {
          clientX: target.left,
          clientY: target.bottom,
        } as React.MouseEvent);
      }
    };

    nodes.push(
      spanForType(
        m.point.type,
        text.slice(m.start, m.end),
        handleClick,
        handleKeyDown,
        `poi-${i}-${m.start}`,
        m.isRegion === true
      )
    );

    cursor = m.end;
  });

  if (cursor < text.length) {
    nodes.push(
      <React.Fragment key={`txt-tail-${cursor}`}>
        {wrapQuotes(text.slice(cursor))}
      </React.Fragment>
    );
  }
  return nodes;
}
