"use client";

import { useMemo } from "react";
import type { Genre, MasterState, RegionOutline, WorldGraph, WorldNode } from "@/types/game";
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

  const { connectedNodes, adjacentOutlines } = useMemo(() => {
    if (!worldGraph) {
      return { connectedNodes: [] as WorldNode[], adjacentOutlines: [] as RegionOutline[] };
    }
    const current = worldGraph.nodes[worldGraph.current_node_id];
    if (!current) {
      return { connectedNodes: [] as WorldNode[], adjacentOutlines: [] as RegionOutline[] };
    }

    // Resolve every connection id to a graph node (silently drop ids
    // that don't resolve — apply-world-bible already validates these).
    const connected: WorldNode[] = [];
    for (const id of current.connections) {
      const node = worldGraph.nodes[id];
      if (node) connected.push(node);
    }

    // Outline cards for adjacent undiscovered regions. Skip any outline
    // whose id collides with an already-resolved graph node so we never
    // double-render the same destination.
    const wb       = masterState?.metadata.world_bible;
    const known    = new Set(connected.map((n) => n.id));
    const outlines = (wb?.adjacent_regions ?? []).filter(
      (r) => !known.has(r.id)
    );

    return { connectedNodes: connected, adjacentOutlines: outlines };
  }, [worldGraph, masterState]);

  if (connectedNodes.length === 0 && adjacentOutlines.length === 0) {
    return null;
  }

  const visited = new Set(masterState?.world_state.visited_locations ?? []);

  return (
    <div
      className="shrink-0"
      role="navigation"
      aria-label="Connected locations"
      style={{
        borderTop:       "1px solid var(--color-border)",
        backgroundColor: "color-mix(in srgb, var(--color-bg) 92%, #000)",
      }}
    >
      <div
        className="flex gap-2 overflow-x-auto px-3 py-2"
        style={{
          // -webkit-overflow-scrolling for momentum scroll on iOS.
          WebkitOverflowScrolling: "touch",
          scrollbarWidth: "none",
        }}
      >
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
  kind:    "known" | "outline";
}

function NavigationCard({ label, icon, visited, primary, onClick, kind }: CardProps) {
  const isOutline = kind === "outline";
  return (
    <button
      onClick={onClick}
      title={label}
      className="flex shrink-0 items-center gap-2 rounded-md px-3 transition-colors hover:bg-white/5 active:bg-white/10"
      style={{
        minHeight:       52,                       // touch target floor
        minWidth:        140,
        maxWidth:        220,
        background:      "color-mix(in srgb, var(--color-bg) 80%, #000)",
        border:          isOutline
          ? `1px dashed color-mix(in srgb, ${primary} 50%, var(--color-border))`
          : "0.5px solid var(--color-border)",
        color:           "var(--color-text)",
        fontFamily:      "var(--font-mono)",
        fontSize:        13,
        cursor:          "pointer",
        opacity:         isOutline ? 0.85 : 1,
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
