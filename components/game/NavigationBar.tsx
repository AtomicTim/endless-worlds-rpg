"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  Genre,
  MasterState,
  RegionOutline,
  WorldGraph,
  WorldLandmark,
  WorldNode,
} from "@/types/game";
import { getGenreColors } from "./genre-ui";

/**
 * Navigation Redesign — UI-driven movement.
 *
 * A persistent horizontally-scrollable strip of cards, one per
 * connected location at the player's current node, plus
 * outline-cards for any adjacent undiscovered region the WorldBible
 * declared. Every card is a touch target ≥ 52px tall.
 *
 * Tapping a card calls onNavigate(nodeId). The hook routes that
 * through submitAction with `forceMoveToNode` set so it bypasses
 * parseIntent and the text-side MOVE intercept entirely — the only
 * sanctioned navigation channel after the redesign.
 *
 * FIX 5 — desktop (≥ 768px) gets ‹ / › overflow arrows when the row
 * scrolls. Mobile relies on touch-momentum scrolling and hides them.
 */

interface Props {
  masterState: MasterState | null;
  worldGraph:  WorldGraph | undefined;
  onNavigate:  (nodeId: string) => void;
  genre:       Genre;
}

const TYPE_ICON: Record<string, string> = {
  // Fantasy / shared
  settlement:      "🏛",
  settlement_hub:  "🏛",
  tavern:          "🍺",
  inn:             "🍺",
  bar:             "🍺",
  market:          "🏪",
  shop:            "🏪",
  smithy:          "⚒",
  forge:           "⚒",
  wilderness:      "🌲",
  nature:          "🌲",
  dungeon:         "💀",
  ruin:            "💀",
  stronghold:      "🏰",
  garrison:        "🏰",
  temple:          "✨",
  shrine:          "✨",
  guild:           "⚜",
  port:            "⚓",
  docks:           "⚓",
  // Space Opera
  station:         "🚀",
  ship:            "🚀",
  // Cyberpunk
  "data-hub":      "🔌",
  "corp-zone":     "🏢",
  // Default
  other:           "📍",
};

function iconFor(node: WorldNode): string {
  const candidates = [
    node.category?.toLowerCase() ?? "",
    node.type?.toLowerCase()     ?? "",
  ];
  for (const c of candidates) {
    if (c && TYPE_ICON[c]) return TYPE_ICON[c];
  }
  return TYPE_ICON.other;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

export function NavigationBar({ masterState, worldGraph, onNavigate, genre }: Props) {
  const colors = getGenreColors(genre);

  const { connectedNodes, returnNode, adjacentOutlines, landmarkOutlines } = useMemo(() => {
    if (!worldGraph) {
      return {
        connectedNodes:    [] as WorldNode[],
        returnNode:        null as WorldNode | null,
        adjacentOutlines:  [] as RegionOutline[],
        landmarkOutlines:  [] as Array<{ landmark: WorldLandmark; outline: RegionOutline }>,
      };
    }
    const current = worldGraph.nodes[worldGraph.current_node_id];
    if (!current) {
      return {
        connectedNodes:    [] as WorldNode[],
        returnNode:        null as WorldNode | null,
        adjacentOutlines:  [] as RegionOutline[],
        landmarkOutlines:  [] as Array<{ landmark: WorldLandmark; outline: RegionOutline }>,
      };
    }

    // CHANGE 4 — outline fallback for unresolved connections. When a
    // connection id doesn't resolve to a known graph node BUT it
    // matches a WorldBible adjacent_region outline, we still show the
    // outline as a navigation card. This prevents the bar from going
    // empty for outline-only neighbours that haven't been expanded
    // into full graph nodes yet.
    const wbForOutlineFallback = masterState?.metadata.world_bible;
    const outlinesById: Map<string, RegionOutline> = new Map();
    for (const o of wbForOutlineFallback?.adjacent_regions ?? []) {
      outlinesById.set(o.id, o);
    }
    const connected: WorldNode[] = [];
    const fallbackOutlines: RegionOutline[] = [];
    for (const id of current.connections) {
      const node = worldGraph.nodes[id];
      if (node) {
        connected.push(node);
      } else {
        const outline = outlinesById.get(id);
        if (outline) fallbackOutlines.push(outline);
      }
    }

    // CHANGE 4 — robust "← Return" card per architecture spec
    // (Navigation — Code Only / Region Location Back-Connections).
    // Conditions ALL of:
    //   1. currentNode exists in worldGraph
    //   2. currentNode.type === "zone" (not sub_location)
    //   3. currentNode.is_settlement_node !== true
    //   4. there exists another node in the same zone whose
    //      is_settlement_node === true
    // Search runs against the live graph independently of
    // currentNode.connections, so the player always has a way back
    // even if generation-time stitching missed an edge.
    let parentSettlement: WorldNode | null = null;
    const isCandidateForReturn =
      current.type === "zone" &&
      current.is_settlement_node !== true;
    if (isCandidateForReturn) {
      parentSettlement =
        Object.values(worldGraph.nodes).find(
          (n) =>
            n.id !== current.id &&
            n.zone_id === current.zone_id &&
            n.is_settlement_node === true
        ) ?? null;
      // Backwards-compat fallback for older save files where
      // is_settlement_node wasn't yet populated. The legacy heuristic
      // is is_expandable === true on a zone-typed sibling.
      if (!parentSettlement) {
        parentSettlement =
          Object.values(worldGraph.nodes).find(
            (n) =>
              n.id !== current.id &&
              n.zone_id === current.zone_id &&
              n.type === "zone" &&
              n.is_expandable === true
          ) ?? null;
      }
    }
    // Don't double-render: if the parent settlement is already in the
    // resolved connections list, skip the return card.
    const alreadyConnected = parentSettlement
      ? connected.some((n) => n.id === parentSettlement!.id)
      : false;
    if (alreadyConnected) parentSettlement = null;

    // Outline cards for adjacent undiscovered regions. Skip any outline
    // whose id collides with an already-resolved graph node so we never
    // double-render the same destination.
    const wb       = masterState?.metadata.world_bible;
    const wcd      = masterState?.metadata.world_consistency;
    const knownIds = new Set([
      ...connected.map((n) => n.id),
      ...(parentSettlement ? [parentSettlement.id] : []),
    ]);
    const outlinesSeen = new Set<string>();
    const outlines: RegionOutline[] = [];
    // CHANGE 4 — surface outline cards for unresolved connection ids
    // FIRST. These are the player's most-relevant exits because they
    // already exist on currentNode.connections; the AI just hasn't
    // expanded them into real graph nodes yet.
    for (const o of fallbackOutlines) {
      if (knownIds.has(o.id) || outlinesSeen.has(o.id)) continue;
      outlinesSeen.add(o.id);
      outlines.push(o);
    }
    for (const r of wb?.adjacent_regions ?? []) {
      if (knownIds.has(r.id) || outlinesSeen.has(r.id)) continue;
      outlinesSeen.add(r.id);
      outlines.push(r);
    }

    // FIX 2 — surface WCD landmarks that aren't yet a discovered graph
    // node but DO have a matching adjacent_region in the WorldBible.
    // The match is loose (id OR name) because the bible/AI sometimes
    // mints a different slug for the same place; this gives players a
    // reliable way to reach a landmark like "Bellhaven" from the start.
    const adjacentRegions = wb?.adjacent_regions ?? [];
    const everyoneLandmarks = (wcd?.landmarks ?? []).filter(
      (lm) => lm.known_by === "everyone"
    );
    const landmarkPairs: Array<{ landmark: WorldLandmark; outline: RegionOutline }> = [];
    for (const lm of everyoneLandmarks) {
      // Skip when the landmark already has a discovered graph node
      // — the player can navigate to it via normal means.
      const existingNode = worldGraph.nodes[lm.id];
      if (existingNode && existingNode.discovered) continue;

      // Find a matching adjacent_region by id or name.
      const lmNameLower = lm.name.toLowerCase();
      const match = adjacentRegions.find(
        (r) =>
          r.landmark_id === lm.id ||
          r.id === lm.id ||
          r.name.toLowerCase() === lmNameLower
      );
      if (!match) continue;
      // Skip if we're already showing this outline as a regular adjacent
      // region card OR if it's already a known connection.
      if (knownIds.has(match.id)) continue;
      if (outlines.some((o) => o.id === match.id)) {
        // Promote: drop from the regular outlines list and re-render
        // it as a landmark card so the diamond + name reads as one.
        const idx = outlines.findIndex((o) => o.id === match.id);
        if (idx >= 0) outlines.splice(idx, 1);
      }
      landmarkPairs.push({ landmark: lm, outline: match });
    }

    return {
      connectedNodes:   connected,
      returnNode:       parentSettlement,
      adjacentOutlines: outlines,
      landmarkOutlines: landmarkPairs,
    };
  }, [worldGraph, masterState]);

  // ── Desktop overflow arrows ──────────────────────────────────────────────
  // Track horizontal scroll position so we can show / hide the arrows
  // when the row actually overflows. Mobile keeps using native momentum
  // scrolling — the arrows are display: none on viewports below 768px.
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft,  setCanScrollLeft]  = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const update = () => {
      const max = el.scrollWidth - el.clientWidth;
      setCanScrollLeft(el.scrollLeft > 0);
      // Account for sub-pixel rounding by giving 1px of slack at the end.
      setCanScrollRight(el.scrollLeft < max - 1);
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    if (ro) ro.observe(el);
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      if (ro) ro.disconnect();
      window.removeEventListener("resize", update);
    };
    // Re-bind whenever the card list changes — the scrollWidth is what
    // determines whether the right arrow is needed.
  }, [connectedNodes.length, adjacentOutlines.length]);

  function scrollBy(direction: -1 | 1) {
    const el = scrollerRef.current;
    if (!el) return;
    const amount = Math.max(160, Math.floor(el.clientWidth * 0.7));
    el.scrollBy({ left: direction * amount, behavior: "smooth" });
  }

  if (
    connectedNodes.length === 0 &&
    adjacentOutlines.length === 0 &&
    landmarkOutlines.length === 0 &&
    !returnNode
  ) {
    return null;
  }

  const visited = new Set(masterState?.world_state.visited_locations ?? []);

  return (
    <div
      className="relative shrink-0"
      role="navigation"
      aria-label="Connected locations"
      style={{
        borderTop:       "1px solid var(--color-border)",
        backgroundColor: "color-mix(in srgb, var(--color-bg) 92%, #000)",
      }}
    >
      <div
        ref={scrollerRef}
        className="flex gap-2 overflow-x-auto px-3 py-2"
        style={{
          // -webkit-overflow-scrolling for momentum scroll on iOS.
          WebkitOverflowScrolling: "touch",
          scrollbarWidth: "none",
        }}
      >
        {/* FIX 1b — return card pinned first when relevant so the
            player's most likely action (walk back to town) is the
            leftmost option. Only rendered when the connections graph
            doesn't already contain the parent settlement. */}
        {returnNode && (
          <NavigationCard
            key={`return-${returnNode.id}`}
            label={`← ${returnNode.name}`}
            icon="↩"
            visited={visited.has(returnNode.id) || returnNode.discovered}
            primary={colors.primary}
            onClick={() => onNavigate(returnNode.id)}
            kind="return"
          />
        )}
        {connectedNodes.map((node) => (
          <NavigationCard
            key={node.id}
            label={node.name}
            icon={iconFor(node)}
            visited={visited.has(node.id) || node.discovered}
            primary={colors.primary}
            onClick={() => onNavigate(node.id)}
            kind="known"
          />
        ))}
        {/* FIX 2 — WCD landmark cards. Distinct golden border + ◆
            prefix so the player can spot them as "world-tier"
            destinations rather than ordinary adjacent regions.
            Tapping them triggers RegionBible expansion via the same
            navigateTo channel as a regular outline card. */}
        {landmarkOutlines.map(({ landmark, outline }) => (
          <NavigationCard
            key={`landmark-${landmark.id}`}
            label={`◆ ${landmark.name}`}
            icon="🗺"
            visited={false}
            primary={colors.primary}
            onClick={() => onNavigate(outline.id)}
            kind="landmark"
          />
        ))}
        {adjacentOutlines.map((outline) => (
          <NavigationCard
            key={`outline-${outline.id}`}
            label={`→ ${outline.name}`}
            icon="🗺"
            visited={false}
            primary={colors.primary}
            onClick={() => onNavigate(outline.id)}
            kind="outline"
          />
        ))}
      </div>

      {/* FIX 5 — desktop overflow arrows. Mobile (< md) hides them
          entirely; touch users get native momentum scroll + visible
          card edges as the affordance. */}
      {canScrollLeft && (
        <ScrollArrow direction="left"  primary={colors.primary} onClick={() => scrollBy(-1)} />
      )}
      {canScrollRight && (
        <ScrollArrow direction="right" primary={colors.primary} onClick={() => scrollBy(1)} />
      )}
    </div>
  );
}

// ── Card ────────────────────────────────────────────────────────────────────

interface CardProps {
  label:   string;
  icon:    string;
  visited: boolean;
  primary: string;
  onClick: () => void;
  kind:    "known" | "outline" | "return" | "landmark";
}

const LANDMARK_GOLD = "#f5b942";

function NavigationCard({ label, icon, visited, primary, onClick, kind }: CardProps) {
  const isOutline   = kind === "outline";
  const isLandmark  = kind === "landmark";
  const isReturn    = kind === "return";
  // Border + opacity vary per kind so the player can read intent at a
  // glance: solid for graph-resolved connections, dashed for
  // un-discovered outlines, gold for WCD landmarks, primary-tinted
  // for the return-to-settlement card.
  const border = isLandmark
    ? `1.5px solid ${LANDMARK_GOLD}`
    : isOutline
      ? `1px dashed color-mix(in srgb, ${primary} 50%, var(--color-border))`
      : isReturn
        ? `1px solid color-mix(in srgb, ${primary} 60%, var(--color-border))`
        : "0.5px solid var(--color-border)";
  const opacity = isOutline ? 0.85 : 1;
  return (
    <button
      onClick={onClick}
      title={label}
      className="flex shrink-0 items-center gap-2 rounded-md px-3 transition-colors hover:bg-white/5 active:bg-white/10"
      style={{
        minHeight:       52,                       // touch target floor
        minWidth:        140,
        maxWidth:        220,
        background:      isLandmark
          ? `color-mix(in srgb, ${LANDMARK_GOLD} 8%, var(--color-bg))`
          : isReturn
            // CHANGE 4 — return card gets a faint primary tint so the
            // "← back" reads as the most-likely action, distinct from
            // ordinary connection cards.
            ? `color-mix(in srgb, ${primary} 10%, color-mix(in srgb, var(--color-bg) 80%, #000))`
            : "color-mix(in srgb, var(--color-bg) 80%, #000)",
        border,
        color:           isLandmark ? LANDMARK_GOLD : "var(--color-text)",
        fontFamily:      "var(--font-mono)",
        fontSize:        13,
        cursor:          "pointer",
        opacity,
      }}
    >
      <span aria-hidden style={{ fontSize: 16, lineHeight: 1 }}>
        {icon}
      </span>
      <span
        style={{
          flex:        1,
          minWidth:    0,
          textAlign:   "left",
          overflow:    "hidden",
          whiteSpace:  "nowrap",
          textOverflow:"ellipsis",
        }}
      >
        {truncate(label, 18)}
      </span>
      <span
        aria-hidden
        title={visited ? "Visited" : "Unvisited"}
        style={{
          width:           8,
          height:          8,
          borderRadius:    "50%",
          backgroundColor: visited ? primary : "var(--color-muted)",
          opacity:         visited ? 1 : 0.4,
          flexShrink:      0,
        }}
      />
    </button>
  );
}

// ── Scroll arrow ─────────────────────────────────────────────────────────────

interface ScrollArrowProps {
  direction: "left" | "right";
  primary:   string;
  onClick:   () => void;
}

function ScrollArrow({ direction, primary, onClick }: ScrollArrowProps) {
  const isLeft = direction === "left";
  return (
    <button
      onClick={onClick}
      aria-label={isLeft ? "Scroll left" : "Scroll right"}
      // Desktop only — mobile users get native touch-momentum scrolling.
      className="absolute top-1/2 hidden -translate-y-1/2 rounded-full md:flex"
      style={{
        [isLeft ? "left" : "right"]: 4,
        width:           28,
        height:          28,
        alignItems:      "center",
        justifyContent:  "center",
        color:           primary,
        backgroundColor: "color-mix(in srgb, var(--color-bg) 80%, #000)",
        border:          `1px solid color-mix(in srgb, ${primary} 50%, transparent)`,
        cursor:          "pointer",
        fontFamily:      "var(--font-mono)",
        fontSize:        16,
        fontWeight:      700,
        zIndex:          2,
        boxShadow:       "0 0 8px rgba(0,0,0,0.4)",
      }}
    >
      {isLeft ? "‹" : "›"}
    </button>
  );
}
