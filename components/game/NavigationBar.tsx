"use client";

import React, { useMemo } from "react";
import { useGameStore } from "@/lib/stores/game-store";
import {
  buildCards,
  groupCardsByDirection,
  type Card,
  type CardDirection,
  type CardKind,
  type CardTier,
} from "@/lib/game/nav-cards";
import type {
  Genre,
  MasterState,
  WorldGraph,
} from "@/types/game";

/**
 * Navigation Bar — typed card system.
 *
 * The map is display-only; the nav bar owns every navigation action.
 *
 * Polish 4a TASK 1 — cards group into 4 direction buckets (BACK /
 * DEEPER / PEER / UNDISCOVERED), with EXIT folding into BACK.
 *
 * Polish 4a TASK 2 — each card's border, leading arrow, and title
 * are colored by destination tier (region lavender / settlement
 * sky-blue / sub-location mint / dungeon burnt-copper).
 *
 * Polish 4a TASK 3a — the region-zone BACK card prefers the
 * previous region's settlement on cross-region arrival.
 *
 * Polish 4c TASK 3 — layout changed from 4 stacked rows to 4
 * side-by-side columns. Each column is 156 px wide (fixed), has a
 * subtle framing border, and stacks cards vertically. The column
 * container overflows-x on mobile (hidden scrollbar via .ew-nav-cols)
 * with overflow-y: visible per rule 70 (CSS containment).
 *
 * Polish 4c Rule 80 — DEEPER is suppressed when BACK already targets
 * the same settlement (same-region inbound navigation).
 *
 * Tapping a card calls onNavigate(nodeId), which the parent routes
 * through useGameLoop.navigateTo (the only sanctioned UI nav channel).
 */

interface Props {
  masterState: MasterState | null;
  worldGraph:  WorldGraph | undefined;
  onNavigate:  (nodeId: string) => void;
  /** Genre is wired through for legacy reasons; theming now lives in
   *  CSS via [data-genre] on the GameLayout root. */
  genre:       Genre;
}

// ────────────────────────────────────────────────────────────────────────────

/** Split an array into sub-arrays of at most `size` elements.
 *  Used to build the 2-row-max mini-column grid inside each group block. */
function chunkArray<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

export function NavigationBar({ worldGraph, masterState, onNavigate }: Props) {
  // Adjacent region travel — outline id currently being expanded into
  // a full RegionBible. Set when the player clicks a ◇ peer-unknown
  // card; cleared when apply-regional-bible resolves. We disable every
  // card while truthy so a stray double-click can't fire a second
  // generate, and replace the targeted ◇'s "UNDISCOVERED" badge with
  // "GENERATING..." so the 5-15s wait reads as intentional.
  const generatingRegionId = useGameStore((s) => s.generatingRegionId);

  const cards = useMemo<Card[]>(
    () => buildCards(worldGraph, masterState),
    [worldGraph, masterState]
  );

  const grouped = useMemo(() => groupCardsByDirection(cards), [cards]);

  const breadcrumb = useMemo<string>(
    () => buildBreadcrumb(worldGraph),
    [worldGraph]
  );

  if (cards.length === 0) return null;

  // Column order — back first, then deeper / peer / undiscovered.
  // Empty columns are skipped entirely (no whitespace, no label).
  const colOrder: CardDirection[] = ["back", "deeper", "peer", "undiscovered"];
  const colLabels: Record<CardDirection, string> = {
    back:         "back",
    deeper:       "deeper",
    peer:         "peer",
    undiscovered: "undiscovered",
  };

  return (
    <div
      role="navigation"
      aria-label="Connected locations"
      className="shrink-0"
      style={{
        borderTop:  "1px solid var(--line)",
        background: "var(--bg-1)",
      }}
    >
      {breadcrumb && (
        <div
          style={{
            padding:       "6px 16px 0",
            fontFamily:    "var(--mono)",
            fontSize:      8,
            letterSpacing: "0.2em",
            color:         "var(--ink-4)",
            whiteSpace:    "nowrap",
            overflow:      "hidden",
            textOverflow:  "ellipsis",
          }}
        >
          {breadcrumb}
        </div>
      )}
      {/* Polish 4c TASK 3 — 4-column layout. Columns are side-by-side with
          a fixed 156 px width each. On mobile the container scrolls
          horizontally (hidden scrollbar via .ew-nav-cols). overflow-y is
          explicitly "visible" to prevent CSS auto-promotion from clipping
          absolutely-positioned descendants (rule 70). */}
      <div
        className="ew-nav-cols"
        style={{
          display:        "flex",
          flexDirection:  "row",
          gap:            8,
          padding:        "10px 16px 12px",
          overflowX:      "auto",
          overflowY:      "visible",
        }}
      >
        {colOrder.map((dir) => {
          const colCards = grouped[dir];
          if (colCards.length === 0) return null;
          // Chunk into mini-columns of max 2 cards. Extra cards overflow
          // rightward into new mini-columns. justifyContent: flex-end on
          // each mini-column ensures a lone card in a partial column sits
          // at the bottom (row 2), not the top.
          const miniCols = chunkArray(colCards, 2);
          return (
            <div
              key={dir}
              style={{
                flexShrink:     0,
                display:        "flex",
                flexDirection:  "column",
                gap:            4,
                padding:        "8px",
                border:         "1px solid var(--line-2)",
                borderRadius:   4,
              }}
            >
              <span
                style={{
                  fontFamily:    "var(--serif)",
                  fontStyle:     "italic",
                  fontSize:      10,
                  color:         "var(--ink-4)",
                  opacity:       0.7,
                  letterSpacing: "0.04em",
                  marginBottom:  2,
                }}
              >
                {colLabels[dir]}
              </span>
              {/* Mini-column grid — flex row of fixed-width columns. */}
              <div style={{ display: "flex", flexDirection: "row", gap: 4 }}>
                {miniCols.map((chunk, colIdx) => (
                  <div
                    key={colIdx}
                    style={{
                      display:        "flex",
                      flexDirection:  "column",
                      justifyContent: "flex-end",
                      gap:            4,
                      width:          140,
                    }}
                  >
                    {chunk.map((c) => (
                      <NavCard
                        key={c.key}
                        card={c}
                        onClick={() => onNavigate(c.targetId)}
                        generatingRegionId={generatingRegionId}
                        fullWidth
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Breadcrumb builder ───────────────────────────────────────────────────────

function buildBreadcrumb(worldGraph: WorldGraph | undefined): string {
  if (!worldGraph) return "";
  const current = worldGraph.nodes[worldGraph.current_node_id];
  if (!current) return "";

  const parts: string[] = [];

  const isRegionZone =
    current.type === "zone" &&
    current.is_expandable === true &&
    current.zone_id === current.id;

  if (isRegionZone) {
    parts.push(current.name.toUpperCase());
  } else if (current.zone_id && current.zone_id !== current.id) {
    const parent = worldGraph.nodes[current.zone_id];
    if (parent) {
      // If parent is a settlement hub, its geographic region is the grandparent
      const grandparentId = parent.zone_id && parent.zone_id !== parent.id
        ? parent.zone_id
        : null;
      const grandparent = grandparentId ? worldGraph.nodes[grandparentId] : null;
      if (grandparent) {
        parts.push(grandparent.name.toUpperCase());
      }
      parts.push(parent.name.toUpperCase());
    }
    parts.push(current.name.toUpperCase());
  } else {
    parts.push(current.name.toUpperCase());
  }

  return parts.join(" › ");
}

// ── Card component ──────────────────────────────────────────────────────────

const ARROW: Record<CardKind, string> = {
  back:           "←",
  deeper:         "→",
  exit:           "↑",
  "peer-known":   "◆",
  "peer-unknown": "◇",
};

/** Polish 4a TASK 2 — map destination tier to its CSS color token.
 *  Border + leading arrow + title pick up this color so the player
 *  can scan tier at a glance. Background stays neutral. */
const TIER_COLOR: Record<CardTier, string> = {
  region:         "var(--hl-region)",
  settlement:     "var(--hl-loc)",
  "sub-location": "var(--hl-sublocation)",
  dungeon:        "var(--hl-dungeon)",
};

function NavCard({
  card,
  onClick,
  generatingRegionId,
  fullWidth = false,
}: {
  card: Card;
  onClick: () => void;
  /** When non-null, RegionBible expansion is in flight. Every card
   *  disables; the targeted ◇ swaps its badge to "GENERATING...". */
  generatingRegionId: string | null;
  /** Column layout mode — card fills the column width instead of using
   *  fixed min/maxWidth. Set by the column container. */
  fullWidth?: boolean;
}) {
  const isBack       = card.kind === "back";
  const isExit       = card.kind === "exit";
  const isDeeper     = card.kind === "deeper";
  const isPeerKnown  = card.kind === "peer-known";
  const isUnknown    = card.kind === "peer-unknown";
  const isNew        = !card.discovered && !isUnknown && !isBack;
  const arrow        = ARROW[card.kind];

  const isGenerating       = generatingRegionId !== null;
  const isGeneratingTarget = isUnknown && generatingRegionId === card.targetId;

  // Polish 4a TASK 2 — tier color drives border, arrow, and title.
  const tierColor = TIER_COLOR[card.tier];

  const arrowColor =
    isBack ? "var(--ink-3)"
    : isUnknown ? "var(--ink-4)"
    : tierColor;
  const nameColor =
    isBack    ? "var(--ink-3)"
    : isUnknown ? "var(--ink-3)"
    : isNew   ? "var(--ink-3)"
    : tierColor;
  const subColor =
    isPeerKnown ? tierColor
    : isUnknown  ? tierColor
    : "var(--ink-4)";

  // Backgrounds — TYPE B (deeper) is transparent so settlement
  // sub-loc cards read flatter; TYPE D1 keeps the elevated --bg-2 fill;
  // TYPE D2 (undiscovered) is transparent.
  const background =
    isExit       ? "var(--bg-3)"
    : isDeeper   ? "transparent"
    : isUnknown  ? "transparent"
    : "var(--bg-2)";

  // Border — colored by destination tier. Undiscovered uses a softer
  // dashed variant. Back uses the neutral --line so it doesn't read
  // as a destination color cue.
  const borderColor =
    isBack       ? "var(--line)"
    : isUnknown  ? `color-mix(in srgb, ${tierColor} 35%, transparent)`
    : isNew      ? `color-mix(in srgb, ${tierColor} 50%, transparent)`
    : tierColor;
  const borderStyle = isUnknown || isNew ? "dashed" : "solid";

  // Category / undiscovered badge under the primary name — diamond cards
  // (◆ / ◇) carry an explicit badge so the player can tell a region
  // dungeon apart from a settlement → DEEPER card at a glance.
  // While the player's clicked ◇ is being expanded, swap that card's
  // badge to "GENERATING..." so the wait reads as in-progress work.
  const showBadge = isPeerKnown || isUnknown;
  const badgeText = isGeneratingTarget
    ? "GENERATING..."
    : isUnknown
      ? "UNDISCOVERED"
      : card.sublabel;

  return (
    <button
      onClick={onClick}
      title={card.name}
      disabled={isGenerating}
      aria-busy={isGeneratingTarget}
      style={{
        display:        "flex",
        alignItems:     "center",
        gap:            10,
        // fullWidth (column mode): fill the column; row mode: fixed range.
        ...(fullWidth
          ? { width: "100%" }
          : { minWidth: 140, maxWidth: 200, flexShrink: 0 }
        ),
        height:         64,
        padding:        "0 14px",
        background,
        border:         `1px ${borderStyle} ${borderColor}`,
        borderRadius:   4,
        color:          "var(--ink-2)",
        fontFamily:     "var(--mono)",
        cursor:         isGenerating ? "wait" : "pointer",
        textAlign:      "left",
        whiteSpace:     "nowrap",
        transition:     "all 120ms",
        opacity:        isGenerating && !isGeneratingTarget ? 0.45 : 1,
      }}
    >
      <span
        style={{
          fontFamily:    "var(--mono)",
          fontSize:      16,
          color:         arrowColor,
          flexShrink:    0,
          fontWeight:    600,
        }}
      >
        {arrow}
      </span>
      <span
        style={{
          display:        "flex",
          flexDirection:  "column",
          gap:            2,
          minWidth:       0,
          flex:           1,
        }}
      >
        <span
          style={{
            display:       "flex",
            alignItems:    "center",
            gap:           4,
            overflow:      "hidden",
          }}
        >
          <span
            style={{
              fontFamily:    "var(--mono)",
              fontSize:      9,
              letterSpacing: "0.18em",
              fontWeight:    600,
              color:         nameColor,
              overflow:      "hidden",
              textOverflow:  "ellipsis",
              whiteSpace:    "nowrap",
              minWidth:      0,
            }}
          >
            {card.name}
          </span>
          {isNew && (
            <span style={{
              fontSize:      7,
              fontFamily:    "var(--mono)",
              letterSpacing: "0.2em",
              color:         tierColor,
              border:        `1px solid ${tierColor}`,
              padding:       "1px 4px",
              flexShrink:    0,
            }}>
              NEW
            </span>
          )}
        </span>
        <span
          style={{
            fontFamily:    "var(--mono)",
            fontSize:      showBadge ? 7 : 8,
            letterSpacing: "0.2em",
            color:         subColor,
            overflow:      "hidden",
            textOverflow:  "ellipsis",
            whiteSpace:    "nowrap",
            ...(showBadge ? {
              alignSelf:    "flex-start",
              border:       `1px solid ${isUnknown
                ? `color-mix(in srgb, ${tierColor} 35%, transparent)`
                : `color-mix(in srgb, ${tierColor} 60%, transparent)`}`,
              padding:      "1px 5px",
              marginTop:    2,
            } : {}),
          }}
        >
          {showBadge ? badgeText : card.sublabel}
        </span>
      </span>
    </button>
  );
}
