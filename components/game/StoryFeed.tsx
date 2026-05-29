"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import type { StoryMessage } from "@/lib/stores/game-store";
import { useGameStore } from "@/lib/stores/game-store";
import { Genre, LocationStatus } from "@/types/game";
import type { MasterState, PointOfInterest } from "@/types/game";
import { InteractionPopover } from "./InteractionPopover";
import {
  NarrativeBlock,
  NPCSpeech,
  SceneDivider,
  SceneArrival,
  LocationSpan,
  RegionSpan,
  NpcSpan,
  ItemSpan,
  LandmarkSpan,
  StatPill,
  wrapQuotes,
} from "./StoryComponents";
import { StreamCursor } from "./StreamCursor";
import { pickAtmosphericFragment } from "@/lib/game/atmospheric-fragments";
import { LootList } from "@/components/game/loot/LootList";
import { useFloorLoot } from "@/hooks/useFloorLoot";
import { currencyLabelFor } from "@/lib/game/currency";
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
  // PR-7v-d — `bottomSlot` retired. DialogueModal is no longer hosted
  // inside the feed scroll container; it renders in the page-level
  // CombatMode swap slot as a persistent bottom bar (DialogueBar).
  // The feed is now a pure scroll container and naturally shows the
  // conversation history above the bar.
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

export function StoryFeed({ messages, isLoading = false, loadingText, onSubmit, onNavigate }: StoryFeedProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [popover, setPopover] = useState<PopoverState | null>(null);
  const genre = useGameStore((s) => s.masterState?.metadata.genre) ?? Genre.FANTASY;

  const masterState    = useGameStore((s) => s.masterState);
  const locationAssets = useGameStore((s) => s.locationAssets);
  const dialogueOpen   = useGameStore((s) => s.currentDialogueOptions.length > 0);
  // UI-8 — loot handlers for the inline "Search the remains" / LootList
  // beneath the Victory banner. Pulled once at component scope and
  // closed over by the per-message renderer below.
  const lootHandlers   = useFloorLoot();
  const highlightCandidates = useMemo<HighlightCandidate[]>(() => {
    if (!masterState) return [];
    return buildExactHighlights(masterState, locationAssets);
  }, [masterState, locationAssets]);

  // UI-4 Loading Pattern 1 — atmospheric fragment after 1.2s. The
  // narrator-client buffers the response into a single string before
  // returning (lib/game/narrator.ts), so the feed sees a complete
  // message today — no per-token stream lands on the UI yet. Cursor +
  // optional fragment are the user-facing wait state until streaming-
  // to-feed lands; the cursor + fragment will follow the live stream
  // and unmount on completion.
  const [fragment, setFragment]   = useState<string | null>(null);
  const [skipSignal, setSkipSignal] = useState(false);
  useEffect(() => {
    if (!isLoading) {
      setFragment(null);
      setSkipSignal(false);
      return;
    }
    setFragment(null);
    setSkipSignal(false);
    const t = setTimeout(
      () => setFragment(pickAtmosphericFragment(genre)),
      1200,
    );
    return () => clearTimeout(t);
  }, [isLoading, genre]);

  // UI-4 Loading Pattern 2 — new-area arrival. While navigating,
  // location_status === ARRIVING and isLoading is true; current_node_id
  // is already the destination, so type/region labels can be resolved
  // without the narrator.
  const arrivingNodeId = isLoading && masterState?.world_state.location_status === LocationStatus.ARRIVING
    ? (masterState.world_state.current_node_id ?? masterState.world_state.current_location_id ?? null)
    : null;
  const arrivingLabels = useMemo(
    () => arrivingNodeId ? resolveArrivalLabelsById(masterState, arrivingNodeId) : null,
    [arrivingNodeId, masterState],
  );

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
        // UI-fix-A — story feed background per design ref §A3:
        // #191308 (very dark warm brown) — pulls the prose out of
        // the cooler --bg-0 main shell so the feed reads as the
        // game's central warm vellum surface.
        background:      "var(--bg-story-feed)",
        fontFamily:      "var(--sans)",
      }}
      // UI-4: tap-to-skip hook. Today (no per-token feed stream yet)
      // this just dismisses the pending fragment + halts the visible
      // cursor. Wires to a real stream-abort once streaming-to-feed is
      // wired.
      onClick={() => {
        if (isLoading) setSkipSignal(true);
      }}
    >
      <div
        className="ew-grain"
        style={{ ["--grain" as string]: 0.15 }}
      />
      {/* UI-fix-A — three overlay divs (design ref §3 + Group A
          step 4d). Inert except where the active genre opts in
          (.ol-tex amber candlelight for Fantasy, .ol-scan/.ol-grid
          for the others). pointer-events:none so they never block
          clicks; z-index 2 so they sit above .ew-grain but under
          the content stack (which gets z-10 below). */}
      <div
        className="ol-tex"
        aria-hidden
        style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 2 }}
      />
      <div
        className="ol-scan"
        aria-hidden
        style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 2 }}
      />
      <div
        className="ol-grid"
        aria-hidden
        style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 2 }}
      />
      <div style={{ position: "relative", zIndex: 10, margin: "0 auto" }}>
        {messages.map((msg) => (
          <MessageEntry
            key={msg.id}
            message={msg}
            onPoiClick={openPopover}
            onNavigate={onNavigate}
            genre={genre}
            highlightCandidates={highlightCandidates}
            masterState={masterState}
            lootHandlers={lootHandlers}
          />
        ))}

        {/* UI-4 — Loading state.
            Pattern 2 (new area): SceneArrival header + Revealing… +
            sweep progress bar. Pattern 1 (action wait): inline cursor
            + optional 1.2s atmospheric fragment. skipSignal hides
            cursor + fragment while preserving the layout slot. */}
        {isLoading && arrivingLabels && (
          <div className="message-enter">
            <SceneArrival
              name={arrivingLabels.name}
              typeLabel={arrivingLabels.typeLabel}
              region={arrivingLabels.region}
            />
            <div
              className="ew-sans uppercase"
              style={{
                marginTop:     6,
                fontSize:      7,
                letterSpacing: "0.14em",
                color:         "var(--nav-breadcrumb)",
              }}
            >
              Revealing…
            </div>
            <div className="ew-progress-track" style={{ marginTop: 4 }} />
          </div>
        )}

        {isLoading && !arrivingLabels && !skipSignal && (
          <div style={{ padding: "8px 0" }}>
            {fragment && (
              <p
                className="ew-serif italic"
                style={{
                  fontSize:   14,
                  lineHeight: 1.82,
                  color:      "var(--ui-text-prose)",
                  margin:     "0 0 6px",
                }}
              >
                {fragment}
              </p>
            )}
            <span
              className="ew-mono inline-flex items-center gap-2"
              style={{
                fontSize:      11,
                letterSpacing: "0.18em",
                color:         "var(--ink-4)",
                fontStyle:     "italic",
              }}
            >
              <StreamCursor genreOverride={genre} style={{ fontSize: 13 }} />
              {loadingText && <span>{loadingText}</span>}
            </span>
          </div>
        )}

        {/* PR-7v-d — `{bottomSlot}` removed. See StoryFeedProps. */}
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
  /** UI-4 — needed to resolve type/region labels for SceneArrival
   *  on arrival NARRATIVE messages. */
  masterState:         MasterState | null;
  /** UI-8 — Search / Take / Take All handlers for the inline LootList
   *  rendered below the Victory banner. Threaded from the StoryFeed
   *  parent (single useFloorLoot() call) rather than re-invoking the
   *  hook per message. */
  lootHandlers:        {
    onSearchRemains: (entry_id: string) => void;
    onTake:          (entry_id: string, item_id: string) => void;
    onTakeGold:      (entry_id: string) => void;
    onTakeAll:       (entry_id: string) => void;
  };
}

function MessageEntry({ message, onPoiClick, onNavigate, genre, highlightCandidates, masterState, lootHandlers }: MessageEntryProps) {
  void genre;
  const { type, content, metadata } = message;
  const restored         = metadata?.restored === true;
  const npcName          = typeof metadata?.npcName === "string" ? metadata.npcName : undefined;
  const locationName     = typeof metadata?.locationName === "string" ? metadata.locationName : undefined;
  const isPlayerDialogue = metadata?.isPlayerDialogue === true;

  const inner = (() => {
    switch (type) {
      case "NARRATIVE": {
        // Day 23B pt 2 — cinematic world intro. 3-part second-person
        // opening generated by the WorldBible (world_intro_template),
        // resolved with the player's name + class at apply time, and
        // emitted as the very first beat in a new game. Distinct
        // italic-serif styling marks it as a once-per-world reveal
        // — not a system note, not regular narration.
        if (metadata?.world_intro === true) {
          return (
            <div
              className="message-enter ew-serif ew-world-intro"
              style={{
                fontSize:      14,
                fontStyle:     "italic",
                color:         "var(--ink-2)",
                margin:        "12px 0 18px",
                lineHeight:    1.6,
                whiteSpace:    "pre-wrap",
              }}
            >
              {content}
            </div>
          );
        }
        // Player echo (DialogueModal inline submit / option click).
        // Fix 5 — muted teal so the player can scan their own actions
        // distinct from narration / NPC dialogue.
        if (isPlayerDialogue) {
          return (
            <div
              className="message-enter"
              style={{
                color:         "var(--combat-player)",
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
        // UI-4 — Scene arrival divider: multi-line (rule · type label ·
        // name · region · rule) replacing the single-line ◈ banner.
        // Type/region resolved from world_graph; partial divider when
        // the lookup misses.
        const arrival = locationName
          ? resolveArrivalLabelsByName(masterState, locationName)
          : null;
        return (
          <div className="message-enter">
            {arrival && (
              <SceneArrival
                name={arrival.name}
                typeLabel={arrival.typeLabel}
                region={arrival.region}
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
                color:         "var(--combat-player)",
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

        // Day 23B pt 2 — quest discovery beat. Larger and more prominent
        // than the codex-add notification: this is a story reveal, not a
        // background notification. Amber/gold serif italic, ✦ prefix.
        if (metadata?.quest_discovery === true) {
          return (
            <div
              className="message-enter ew-serif ew-quest-discovery"
              style={{
                fontSize:    13,
                fontStyle:   "italic",
                color:       "var(--accent)",
                margin:      "10px 0",
                lineHeight:  1.5,
              }}
            >
              ✦ {content}
            </div>
          );
        }

        // Day 23D — side quest discovery beat. Smaller than the main
        // quest reveal (rule 116) — same amber/gold + ✦ prefix so the
        // player recognizes the family, but quiet enough to read as
        // "a new direction" rather than "a revelation". Fires on the
        // FIRST successful conversation with the quest giver; the
        // discovered flag on the SideQuest ensures it never re-fires.
        if (metadata?.side_quest_discovery === true) {
          return (
            <div
              className="message-enter ew-serif ew-side-quest-discovery"
              style={{
                fontSize:    11,
                fontStyle:   "italic",
                color:       "var(--accent)",
                margin:      "6px 0",
                lineHeight:  1.45,
                opacity:     0.9,
              }}
            >
              ✦ {content}
            </div>
          );
        }

        // Codex-add notification — small UI-chrome label with accent
        // diamond. UI-fix-A: was ew-mono; system labels are UI chrome,
        // not numeric, so they take Inter Tight via ew-sans.
        if (content.includes("added to codex")) {
          return (
            <div
              className="message-enter ew-sans"
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

        // Day 22 — level-up beat. Centered, bright pass-green to mark
        // the moment, sized like the victory banner. Tagged via
        // metadata.level_up so the visual treatment is decoupled from
        // the message text.
        if (metadata?.level_up === true) {
          return (
            <div
              // UI-fix-A — banner label → ew-sans (Inter Tight).
              className="message-enter ew-sans"
              style={{
                fontSize:      13,
                letterSpacing: "0.24em",
                color:         "var(--hl-pass)",
                margin:        "12px 0",
                fontStyle:     "normal",
                fontWeight:    700,
                textAlign:     "center",
                textTransform: "uppercase",
              }}
            >
              {content}
            </div>
          );
        }

        // Generic system event — small italic UI label, accent colour.
        // UI-fix-A: was ew-mono; system labels are UI chrome.
        return (
          <div
            className="message-enter ew-sans"
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
        // Day 20 / 20.1 / 20.3 Combat — style by event metadata.
        // Fields: combat, event_type, actor, outcome,
        // is_crit_banner, is_crit_prose, is_resolution_banner,
        // resolution_prose.
        const m = metadata ?? {};
        const eventType            = typeof m.event_type === "string" ? m.event_type : null;
        const actor                = typeof m.actor === "string" ? m.actor : null;
        const outcome              = typeof m.outcome === "string" ? m.outcome : null;
        const isCritBanner         = m.is_crit_banner === true;
        const isCritProse          = m.is_crit_prose === true;
        const isResolutionBanner   = m.is_resolution_banner === true;
        const resolutionProse      = typeof m.resolution_prose === "string" ? m.resolution_prose : "";
        // Day 20.4 TASK 2 — dimmed-mono roll-detail suffix. Optional;
        // events without rolls (turn separators, defend, combat_start)
        // pass null and the suffix span doesn't render.
        const rollsSuffix          = typeof m.rolls_suffix === "string" ? m.rolls_suffix : null;
        // Day 20.4 TASK 4 — defeat / flee_success destination payload
        // for the templated info line below the resolution prose.
        const destination = m.destination as
          | {
              node_id:      string;
              node_name:    string;
              region_id?:   string;
              region_name?: string;
            }
          | undefined;
        // UI-8 — floor_loot entry id for THIS victory. Threaded by
        // useCombat. StoryFeed looks up the live entry below the
        // banner to render either "Search the remains →" or the
        // inline LootList — depending on whether the entry has been
        // resolved yet.
        const floorLootEntryId = typeof m.floor_loot_entry_id === "string"
          ? m.floor_loot_entry_id
          : null;

        // Day 20.3 TASK 1 — full-width turn separators. Strip the
        // V8.35 dash bookends from the templated string and render
        // the label centered between flex-grown rule lines.
        if (
          eventType === "round_start" ||
          eventType === "player_turn_start" ||
          eventType === "enemy_phase_start"
        ) {
          const label = content
            .replace(/^─+\s*/, "")
            .replace(/\s*─+$/, "")
            .trim();
          return (
            <div className="message-enter combat-turn-separator">
              <span className="combat-turn-separator-line" aria-hidden />
              <span className="combat-turn-separator-label">{label}</span>
              <span className="combat-turn-separator-line" aria-hidden />
            </div>
          );
        }

        // CRITICAL HIT banner. HF1 FIX 1 — this is now the ONLY line a
        // crit renders (rule 54's two-line banner-plus-LLM-prose render
        // is reversed: crit = one templated line + roll suffix, no LLM
        // call). Color from actor. Day 20.4 TASK 2 — append the
        // dimmed-mono rolls suffix when present.
        if (isCritBanner) {
          const isPlayerCrit = actor === "PLAYER";
          const color = isPlayerCrit
            ? "var(--combat-player-crit)"
            : "var(--combat-enemy-crit)";
          return (
            <div
              className="message-enter combat-crit-banner"
              style={{ color }}
            >
              {content}
              {rollsSuffix && (
                <span className="combat-roll-detail">{rollsSuffix}</span>
              )}
            </div>
          );
        }

        // Crit prose (legacy line 2). HF1 FIX 1 — no COMBAT message is
        // ever flagged is_crit_prose anymore (the narrate-combat call
        // for crits was removed). This branch is kept only as a
        // defensive renderer for any stale persisted message; live
        // play never reaches it.
        if (isCritProse) {
          const isPlayerCrit = actor === "PLAYER";
          const color = isPlayerCrit
            ? "var(--combat-player-crit)"
            : "var(--combat-enemy-crit)";
          return (
            <p
              className="message-enter ew-serif"
              style={{
                color,
                fontSize:   13,
                fontWeight: 700,
                fontStyle:  "italic",
                margin:     "2px 0 6px",
              }}
            >
              <span style={{ marginRight: 6 }}>⚔</span>
              {content}
            </p>
          );
        }

        // Day 20.3 TASK 5 — Victory / Defeat / Escaped two-line
        // banner. Banner word above (uppercase 18px bold), short
        // LLM prose below (italic 13px), both centered, both colored
        // by resolution type.
        if (isResolutionBanner) {
          const color =
            eventType === "victory" ? "var(--combat-victory)"
            : eventType === "defeat" ? "var(--combat-defeat)"
            : "var(--combat-flee)";

          // Day 20.4 TASK 4 — templated destination info line. Defeat
          // includes the parent region ("at <Settlement> in <Region>");
          // flee is a short hop without region context ("to <Node>").
          // Victory has no destination — player stays where they were.
          let destinationLine: string | null = null;
          if (eventType === "defeat" && destination) {
            destinationLine = destination.region_name
              ? `You wake at ${destination.node_name} in ${destination.region_name}.`
              : `You wake at ${destination.node_name}.`;
          } else if (eventType === "flee_success" && destination) {
            destinationLine = `You break to ${destination.node_name}.`;
          }

          // UI-8 — Resolve the live floor_loot entry for THIS victory
          // (if any). The block below the banner renders:
          //   • a "Search the remains →" link while entry.pending is set
          //   • a "Searched ✓" badge + inline LootList after search
          //   • nothing when no entry id is attached (defeat/flee or a
          //     legacy victory message)
          const victoryLootEntry =
            eventType === "victory" && floorLootEntryId
              ? masterState?.floor_loot?.find((e) => e.id === floorLootEntryId)
              : undefined;
          const lootIsPending  = !!victoryLootEntry?.pending;
          const lootIsResolved = !!victoryLootEntry && !victoryLootEntry.pending;
          const currencyWord   = masterState
            ? currencyLabelFor(masterState.metadata.genre)
            : "gold";

          return (
            <div className="message-enter combat-resolution-block">
              <div
                className="combat-resolution-banner"
                style={{ color }}
              >
                {content}
              </div>
              {resolutionProse && (
                <div
                  className="combat-resolution-prose"
                  style={{ color }}
                >
                  {resolutionProse}
                </div>
              )}
              {destinationLine && (
                <div className="combat-resolution-destination">
                  {destinationLine}
                </div>
              )}

              {/* UI-8 — Search-the-remains link / inline loot list. */}
              {eventType === "victory" && victoryLootEntry && (
                <div
                  style={{
                    marginTop:    10,
                    paddingTop:   8,
                    borderTop:    "1px solid rgba(var(--genre-accent-rgb), .14)",
                    textAlign:    "center",
                  }}
                >
                  {lootIsPending && (
                    <button
                      type="button"
                      onClick={() => lootHandlers.onSearchRemains(victoryLootEntry.id)}
                      style={{
                        display:        "inline-flex",
                        alignItems:     "center",
                        gap:            6,
                        padding:        "8px 16px",
                        background:     "rgba(var(--genre-accent-rgb), 0.12)",
                        border:         "1px solid rgba(var(--genre-accent-rgb), 0.40)",
                        borderRadius:   6,
                        color:          "var(--genre-accent)",
                        fontFamily:     "var(--ui-sans)",
                        fontSize:       13,
                        fontWeight:     600,
                        cursor:         "pointer",
                        marginTop:      8,
                      }}
                    >
                      <span aria-hidden>⚔</span>
                      Search the remains
                    </button>
                  )}
                  {lootIsResolved && (
                    <>
                      <div
                        className="ew-serif"
                        role="status"
                        style={{
                          color:     "var(--status-resolved)",
                          fontStyle: "italic",
                          fontSize:  12,
                          marginBottom: 6,
                        }}
                      >
                        Searched ✓
                      </div>
                      {masterState && (
                        <div style={{ textAlign: "left" }}>
                          <LootList
                            entry={victoryLootEntry}
                            currencyLabel={currencyWord}
                            playerInventorySize={masterState.player_state.inventory.length}
                            header="You search the remains"
                            onTake={lootHandlers.onTake}
                            onTakeGold={lootHandlers.onTakeGold}
                            onTakeAll={lootHandlers.onTakeAll}
                          />
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          );
        }

        // Day 20.1 TASK 2 — encounter banner. Bigger than routine but
        // smaller than victory/defeat. Bold + italic, center-aligned,
        // light coral. Optional thin rule above/below for separation.
        if (eventType === "combat_start") {
          return (
            <div
              className="message-enter"
              style={{
                margin:    "12px 0",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  height:     1,
                  background: "color-mix(in srgb, var(--combat-encounter-banner) 35%, transparent)",
                  margin:     "0 auto 8px",
                  maxWidth:   320,
                }}
              />
              <p
                className="ew-serif"
                style={{
                  margin:        0,
                  color:         "var(--combat-encounter-banner)",
                  fontSize:      15,
                  fontWeight:    700,
                  fontStyle:     "italic",
                  letterSpacing: "0.02em",
                }}
              >
                <span style={{ marginRight: 6 }}>⚔</span>
                {content}
              </p>
              <div
                style={{
                  height:     1,
                  background: "color-mix(in srgb, var(--combat-encounter-banner) 35%, transparent)",
                  margin:     "8px auto 0",
                  maxWidth:   320,
                }}
              />
            </div>
          );
        }

        // PR-11v-c — ability_used / ability_no_charges events get their
        // own visual branch: ✦ prefix already in content (from the
        // template), genre accent italic so abilities read as a
        // distinct beat type vs the ⚔ routine combat lines. No rolls
        // suffix (abilities auto-hit; no d20 to surface today).
        if (eventType === "ability_used" || eventType === "ability_no_charges") {
          return (
            <p
              className="message-enter ew-serif"
              style={{
                color:      "var(--genre-accent)",
                fontSize:   13,
                fontStyle:  "italic",
                fontWeight: eventType === "ability_used" ? 600 : 400,
                opacity:    eventType === "ability_no_charges" ? 0.6 : 1,
                margin:     "6px 0",
              }}
            >
              {content}
            </p>
          );
        }

        // Event-class buckets:
        //   victory / defeat / flee_success → handled above as
        //     isResolutionBanner two-line block (Day 20.3 TASK 5)
        //   crit                              → handled above as the
        //     isCritBanner single templated line (HF1 FIX 1)
        //   routine                           → normal weight + side color, ⚔ prefix
        const isCrit    = outcome === "crit";
        const isPlayer  = actor === "PLAYER";

        const color = isCrit
          ? (isPlayer ? "var(--combat-player-crit)" : "var(--combat-enemy-crit)")
          : (isPlayer ? "var(--combat-player)" : "var(--combat-enemy)");

        const fontSize   = 13;
        const fontWeight = isCrit ? 700 : 400;
        const fontStyle  = "italic" as const;

        return (
          <p
            className="message-enter ew-serif"
            style={{
              color,
              fontSize,
              fontWeight,
              fontStyle,
              margin: "6px 0",
            }}
          >
            <span style={{ marginRight: 6 }}>⚔</span>
            {content}
            {/* Day 20.4 TASK 2 — dimmed-mono roll-detail suffix
                appended after routine event lines (hit/miss/fumble/
                heal/flee_fail). Null on events without rolls. */}
            {rollsSuffix && (
              <span className="combat-roll-detail">{rollsSuffix}</span>
            )}
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
                // UI-fix-A — lore item name header is UI chrome label
                // (uppercase tracked, accent-coloured), not a numeric
                // value: switch ew-mono → ew-sans.
                className="ew-sans"
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

// ─────────────────────────────────────────────────────────────────────────────
// UI-4 — SceneArrival label resolvers
//
// Pull location type + parent-region name off the world graph so the
// arrival divider can render its 4-row block (rule · type · name ·
// region · rule) without the caller knowing the graph shape. ById is
// used by the in-flight loading state (Pattern 2); ByName by rendered
// NARRATIVE messages where only the locationName is known. Both walk
// zone_id upward to find the self-zoned expandable region zone;
// `region` is omitted when the node itself IS the region zone or no
// parent region is reachable.
// ─────────────────────────────────────────────────────────────────────────────

interface ArrivalLabels {
  name:       string;
  typeLabel?: string;
  region?:    string;
}

function regionLabelFor(
  state: MasterState | null,
  startNodeId: string,
): string | undefined {
  if (!state?.world_graph) return undefined;
  const nodes = state.world_graph.nodes;
  const start = nodes[startNodeId];
  if (!start) return undefined;
  if (start.is_expandable === true && start.zone_id === start.id) return undefined;
  const seen = new Set<string>([start.id]);
  let cur = start.zone_id ? nodes[start.zone_id] : undefined;
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    if (cur.is_expandable === true && cur.zone_id === cur.id) return cur.name;
    cur = cur.zone_id ? nodes[cur.zone_id] : undefined;
  }
  return undefined;
}

function arrivalFromNode(
  state: MasterState | null,
  nodeId: string,
): ArrivalLabels | null {
  if (!state?.world_graph) return null;
  const node = state.world_graph.nodes[nodeId];
  if (!node) return null;
  const typeLabel = node.node_type ?? node.category ?? undefined;
  return {
    name:      node.name,
    typeLabel: typeLabel ? String(typeLabel).replace(/_/g, " ") : undefined,
    region:    regionLabelFor(state, nodeId),
  };
}

function resolveArrivalLabelsById(
  state:  MasterState | null,
  nodeId: string,
): ArrivalLabels | null {
  return arrivalFromNode(state, nodeId);
}

function resolveArrivalLabelsByName(
  state: MasterState | null,
  name:  string,
): ArrivalLabels | null {
  if (!state?.world_graph) return { name };
  const match = Object.values(state.world_graph.nodes).find(
    (n) => n.name === name,
  );
  if (!match) return { name };
  return arrivalFromNode(state, match.id);
}
