"use client";

import React, { useMemo } from "react";
import { useGameStore } from "@/lib/stores/game-store";
import type {
  Genre,
  MasterState,
  WorldGraph,
  WorldNode,
} from "@/types/game";

/**
 * Navigation Bar — typed card system.
 *
 * The map is display-only; the nav bar owns every navigation action.
 * Cards always appear left to right in this fixed order:
 *
 *   [← BACK] [→ DEEPER...] [↑ EXIT] [◆ PEER...] [◇ UNDISCOVERED...]
 *
 * Each category builds an independent array, and the final list is the
 * concatenation in display order:
 *
 *   • TYPE A — back  (0 or 1)
 *   • TYPE B — deeper (0–4)
 *   • TYPE C — exit  (0 or 1)
 *   • TYPE D — peer  (region_locations + adjacent regions)
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

type CardKind = "back" | "deeper" | "exit" | "peer-known" | "peer-unknown";

interface Card {
  /** Stable key for React. */
  key:        string;
  kind:       CardKind;
  /** Node id (or adjacent region outline id) handed to onNavigate. */
  targetId:   string;
  /** Primary label — destination name, ALL CAPS. */
  name:       string;
  /** Secondary label — category / "EXIT TO REGION" / etc., ALL CAPS. */
  sublabel:   string;
  /** Whether the player has already visited this node. */
  discovered: boolean;
}

// ────────────────────────────────────────────────────────────────────────────

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

  const breadcrumb = useMemo<string>(
    () => buildBreadcrumb(worldGraph),
    [worldGraph]
  );

  if (cards.length === 0) return null;

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
      <div
        className="ew-scroll"
        style={{
          display:                 "flex",
          gap:                     8,
          overflowX:               "auto",
          padding:                 "12px 16px",
          WebkitOverflowScrolling: "touch",
          scrollbarWidth:          "none",
        }}
      >
        {cards.map((c) => (
          <NavCard
            key={c.key}
            card={c}
            onClick={() => onNavigate(c.targetId)}
            generatingRegionId={generatingRegionId}
          />
        ))}
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

// ── Card builder ────────────────────────────────────────────────────────────

function buildCards(
  worldGraph: WorldGraph | undefined,
  masterState: MasterState | null,
): Card[] {
  if (!worldGraph) return [];
  const current = worldGraph.nodes[worldGraph.current_node_id];
  if (!current) return [];

  const isAtRegionZone =
    current.type === "zone" &&
    current.is_expandable === true &&
    current.zone_id === current.id;

  const isAtSettlementHub =
    current.type === "zone" &&
    current.is_settlement_node === true;

  const isAtSubLocation = current.type === "sub_location";

  const isAtDungeon =
    current.type === "zone" &&
    current.is_settlement_node !== true &&
    current.is_expandable === false;

  // Resolve the settlement hub for this region (used by exit/back logic
  // in multiple branches). For a sub_location, the hub is current.zone_id.
  // For everyone else, find the is_settlement_node node that shares
  // zone_id with the geographic region.
  const settlementHub: WorldNode | null = (() => {
    if (isAtSubLocation) {
      return worldGraph.nodes[current.zone_id] ?? null;
    }
    if (isAtSettlementHub) return current;
    // At region zone OR dungeon — settlement hub is whichever node sits
    // under this region with is_settlement_node=true.
    const regionId = isAtRegionZone ? current.id : current.zone_id;
    return (
      Object.values(worldGraph.nodes).find(
        (n) => n.zone_id === regionId && n.is_settlement_node === true
      ) ?? null
    );
  })();

  // Resolve the geographic region zone for this location.
  const regionZone: WorldNode | null = (() => {
    if (isAtRegionZone) return current;
    const direct = current.zone_id ? worldGraph.nodes[current.zone_id] : null;
    if (direct?.is_expandable && direct.zone_id === direct.id) return direct;
    if (direct?.zone_id) {
      const grandparent = worldGraph.nodes[direct.zone_id];
      if (grandparent?.is_expandable && grandparent.zone_id === grandparent.id) {
        return grandparent;
      }
    }
    return null;
  })();

  // ── TYPE A — back ────────────────────────────────────────────────────────
  const backCards: Card[] = [];
  if (isAtSubLocation) {
    const parent = worldGraph.nodes[current.zone_id];
    if (parent && parent.id !== current.id) {
      backCards.push({
        key:        `back-${parent.id}`,
        kind:       "back",
        targetId:   parent.id,
        name:       parent.name.toUpperCase(),
        sublabel:   typeLabel(parent),
        discovered: parent.discovered,
      });
    }
  } else if (isAtDungeon) {
    // For a standalone dungeon the parent zone is the geographic region.
    const parent = worldGraph.nodes[current.zone_id];
    if (parent && parent.id !== current.id) {
      backCards.push({
        key:        `back-${parent.id}`,
        kind:       "back",
        targetId:   parent.id,
        name:       parent.name.toUpperCase(),
        sublabel:   typeLabel(parent),
        discovered: parent.discovered,
      });
    }
  } else if (isAtRegionZone && settlementHub) {
    backCards.push({
      key:        `back-${settlementHub.id}`,
      kind:       "back",
      targetId:   settlementHub.id,
      name:       settlementHub.name.toUpperCase(),
      sublabel:   typeLabel(settlementHub),
      discovered: settlementHub.discovered,
    });
  }

  // ── TYPE B — deeper ──────────────────────────────────────────────────────
  const deeperCards: Card[] = [];
  if (isAtSettlementHub) {
    for (const id of current.connections) {
      const node = worldGraph.nodes[id];
      if (!node) continue;
      if (node.type !== "sub_location") continue;
      if (node.zone_id !== current.id) continue;
      deeperCards.push({
        key:        `deeper-${node.id}`,
        kind:       "deeper",
        targetId:   node.id,
        name:       node.name.toUpperCase(),
        sublabel:   typeLabel(node),
        discovered: node.discovered,
      });
    }
  } else if (isAtDungeon) {
    // Future-proof: sub_locations of the dungeon. Today there are none,
    // but the loop below handles them cleanly when they arrive.
    for (const id of current.connections) {
      const node = worldGraph.nodes[id];
      if (!node) continue;
      if (node.type !== "sub_location") continue;
      if (node.zone_id !== current.id) continue;
      deeperCards.push({
        key:        `deeper-${node.id}`,
        kind:       "deeper",
        targetId:   node.id,
        name:       node.name.toUpperCase(),
        sublabel:   typeLabel(node),
        discovered: node.discovered,
      });
    }
  }
  // At sub_location: no sibling deeper cards — the player must return to
  // the hub to choose another building (Fix 3).

  // ── TYPE C — exit ────────────────────────────────────────────────────────
  // ONLY the settlement hub gets the ↑ exit card. From a sub-location the
  // only nav is ← back to hub; from a dungeon the only nav is ← back to
  // the region zone. (Fix 1)
  const exitCards: Card[] = [];
  if (isAtSettlementHub && regionZone) {
    exitCards.push({
      key:        `exit-${regionZone.id}`,
      kind:       "exit",
      targetId:   regionZone.id,
      name:       regionZone.name.toUpperCase(),
      sublabel:   "EXIT TO REGION",
      discovered: regionZone.discovered,
    });
  }

  // ── TYPE D — peer (region_locations + adjacent regions) ─────────────────
  const peerCards: Card[] = [];
  if (isAtRegionZone) {
    // D1 — known region_locations under this region (dungeons,
    // wilderness, shrines).
    for (const node of Object.values(worldGraph.nodes)) {
      if (node.id === current.id) continue;
      if (node.zone_id !== current.id) continue;
      if (node.is_settlement_node === true) continue;
      if (node.type !== "zone") continue;
      if (node.is_expandable === true) continue;
      peerCards.push({
        key:        `peer-known-${node.id}`,
        kind:       "peer-known",
        targetId:   node.id,
        name:       node.name.toUpperCase(),
        sublabel:   typeLabel(node),
        discovered: node.discovered,
      });
    }

    // D2 — adjacent regions from the WorldBible. FIX 3 — list ALL
    // adjacent regions regardless of expansion state or current
    // graph connection state. The previous version filtered on
    // current.connections, which dropped a region as soon as
    // apply-regional-bible's step 6 stripped the placeholder link
    // — so already-expanded regions silently disappeared from the
    // nav bar after one trip. Now:
    //   - Already-expanded regions render as ◆ peer-known cards
    //     (the graph node exists and is discovered).
    //   - Never-expanded regions render as ◇ peer-unknown cards
    //     (still trigger RegionBible expansion via navigateTo).
    // Self-skip prevents the current region from listing itself.
    const wb           = masterState?.metadata.world_bible;
    const knownPeerIds = new Set(peerCards.map((c) => c.targetId));
    const seen         = new Set<string>();
    for (const r of wb?.adjacent_regions ?? []) {
      if (r.id === current.id) continue;
      if (knownPeerIds.has(r.id)) continue;
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      const graphNode = worldGraph.nodes[r.id];
      const isExpanded = !!graphNode && graphNode.discovered === true;
      peerCards.push({
        key:        isExpanded ? `peer-known-${r.id}` : `peer-unknown-${r.id}`,
        kind:       isExpanded ? "peer-known" : "peer-unknown",
        targetId:   r.id,
        name:       r.name.toUpperCase(),
        sublabel:   isExpanded ? "REGION" : "UNDISCOVERED REGION",
        discovered: isExpanded,
      });
    }
  }

  return [...backCards, ...deeperCards, ...exitCards, ...peerCards];
}

// ── Card component ──────────────────────────────────────────────────────────

const ARROW: Record<CardKind, string> = {
  back:           "←",
  deeper:         "→",
  exit:           "↑",
  "peer-known":   "◆",
  "peer-unknown": "◇",
};

function NavCard({
  card,
  onClick,
  generatingRegionId,
}: {
  card: Card;
  onClick: () => void;
  /** When non-null, RegionBible expansion is in flight. Every card
   *  disables; the targeted ◇ swaps its badge to "GENERATING...". */
  generatingRegionId: string | null;
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

  const arrowColor =
    isBack ? "var(--ink-3)"
    : isUnknown ? "var(--ink-4)"
    : "var(--accent)";
  const nameColor =
    isBack    ? "var(--ink-3)"
    : isUnknown ? "var(--ink-3)"
    : isNew   ? "var(--ink-3)"
    : "var(--ink-1)";
  const subColor =
    isPeerKnown ? "var(--accent)"
    : isUnknown  ? "var(--accent)"
    : "var(--ink-4)";

  // Backgrounds — Fix 7: TYPE B (deeper) is transparent so settlement
  // sub-loc cards read flatter; TYPE D1 keeps the elevated --bg-2 fill;
  // TYPE D2 (undiscovered) is transparent.
  const background =
    isExit       ? "var(--bg-3)"
    : isDeeper   ? "transparent"
    : isUnknown  ? "transparent"
    : "var(--bg-2)";

  // Border — TYPE B uses 60% accent opacity, TYPE D2 dashed 35%.
  const borderColor =
    isBack       ? "var(--line)"
    : isUnknown  ? "color-mix(in srgb, var(--accent) 35%, transparent)"
    : isDeeper   ? "color-mix(in srgb, var(--accent) 60%, transparent)"
    : isNew      ? "color-mix(in srgb, var(--accent) 40%, transparent)"
    : "var(--accent)";
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
        minWidth:       140,
        maxWidth:       200,
        height:         64,
        padding:        "0 14px",
        background,
        border:         `1px ${borderStyle} ${borderColor}`,
        borderRadius:   4,
        color:          "var(--ink-2)",
        fontFamily:     "var(--mono)",
        cursor:         isGenerating ? "wait" : "pointer",
        flexShrink:     0,
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
              color:         "var(--accent)",
              border:        "1px solid var(--accent)",
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
                ? "color-mix(in srgb, var(--accent) 35%, transparent)"
                : "color-mix(in srgb, var(--accent) 60%, transparent)"}`,
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

// ── Helpers ─────────────────────────────────────────────────────────────────

function typeLabel(node: WorldNode): string {
  if (node.is_expandable === true && node.zone_id === node.id) return "REGION";
  const raw = (node.category ?? node.type ?? "").toString();
  return raw.toUpperCase();
}
