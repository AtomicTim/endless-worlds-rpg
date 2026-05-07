"use client";

import React, { useMemo } from "react";
import type {
  Genre,
  MasterState,
  RegionOutline,
  WorldGraph,
  WorldLandmark,
  WorldNode,
} from "@/types/game";

/**
 * Navigation Bar — mobile-only horizontal nav strip.
 *
 * Per the redesign: desktop uses the WorldMap sidebar's tier 3 view
 * for clickable navigation, so this bar returns null at ≥768px.
 * Mobile (<768px) gets a horizontally-scrollable row of nav cards
 * styled to match /design/ui-pieces.jsx → NavCard.
 *
 * Cards include:
 *   • Connected graph nodes from the player's current node.
 *   • A "← Return" card when the player is in a region_location and
 *     the parent settlement isn't already in the connection list.
 *   • WorldBible adjacent_region outlines and WCD-landmark outlines
 *     for undiscovered destinations.
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

// Type → SVG icon. Uses the design's small-stroke iconography rather
// than emoji so the cards read consistently across genres.
const TYPE_LABEL: Record<string, string> = {
  settlement:      "TOWN",
  settlement_hub:  "HUB",
  tavern:          "INN",
  inn:             "INN",
  bar:             "BAR",
  market:          "MARKET",
  shop:            "SHOP",
  smithy:          "FORGE",
  forge:           "FORGE",
  wilderness:      "WILDS",
  nature:          "WILDS",
  dungeon:         "RUIN",
  ruin:            "RUIN",
  stronghold:      "KEEP",
  garrison:        "KEEP",
  temple:          "SHRINE",
  shrine:          "SHRINE",
  guild:           "GUILD",
  port:            "PORT",
  docks:           "PORT",
  station:         "STATION",
  ship:            "SHIP",
  "data-hub":      "NODE",
  "corp-zone":     "CORP",
  other:           "PLACE",
};

function labelFor(node: WorldNode): string {
  const cat = node.category?.toLowerCase() ?? "";
  if (cat && TYPE_LABEL[cat]) return TYPE_LABEL[cat];
  const t = node.type?.toLowerCase() ?? "";
  if (t && TYPE_LABEL[t]) return TYPE_LABEL[t];
  return TYPE_LABEL.other;
}

// Small SVG icon picker — paper-style glyph by category.
function IconFor({ category }: { category: string }) {
  switch (category) {
    case "tavern":
    case "inn":
    case "bar":
      return (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M 3 16 L 3 8 L 10 3 L 17 8 L 17 16 Z" stroke="currentColor" strokeWidth="1.4" />
          <path d="M 8 16 L 8 11 L 12 11 L 12 16" stroke="currentColor" strokeWidth="1.4" />
        </svg>
      );
    case "settlement":
    case "settlement_hub":
    case "market":
      return (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M 3 17 L 3 9 L 8 9 L 8 5 L 14 5 L 14 9 L 17 9 L 17 17 Z" stroke="currentColor" strokeWidth="1.4" />
          <path d="M 6 17 L 6 13 M 11 17 L 11 13" stroke="currentColor" strokeWidth="1" />
        </svg>
      );
    case "ruin":
    case "dungeon":
      return (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M 2 17 L 2 11 L 6 11 L 6 6 L 9 11 L 13 7 L 13 11 L 18 11 L 18 17 Z"
            stroke="currentColor" strokeWidth="1.4" />
        </svg>
      );
    case "shrine":
    case "temple":
      return (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M 10 3 L 10 17 M 6 8 L 14 8" stroke="currentColor" strokeWidth="1.4" />
          <circle cx="10" cy="3" r="1.5" fill="currentColor" />
        </svg>
      );
    case "wilderness":
    case "nature":
      return (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M 3 17 Q 6 10 10 12 Q 14 14 17 4"
            stroke="currentColor" strokeWidth="1.4"
            strokeDasharray="2 2" strokeLinecap="round" />
        </svg>
      );
    case "fog":
    default:
      return (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="10" r="6"
            stroke="currentColor" strokeWidth="1.2" strokeDasharray="2 2" />
          <text x="10" y="13" fontSize="8" fontFamily="monospace" textAnchor="middle" fill="currentColor">?</text>
        </svg>
      );
  }
}

// ────────────────────────────────────────────────────────────────────────────

export function NavigationBar({ masterState, worldGraph, onNavigate }: Props) {
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

    // Outline fallback for unresolved connections — when current.connections
    // points at an id that isn't in the graph yet but DOES have a matching
    // adjacent_regions outline in the WorldBible, surface that as a card.
    const wbForOutlineFallback = masterState?.metadata.world_bible;
    const outlinesById: Map<string, RegionOutline> = new Map();
    for (const o of wbForOutlineFallback?.adjacent_regions ?? []) {
      outlinesById.set(o.id, o);
    }
    // FIX 6 — compute isAtRegionZone early so the connected loop can
    // exclude the settlement hub here (it becomes the ← Return card).
    const isAtRegionZone =
      current.type === "zone" &&
      current.is_expandable === true &&
      current.zone_id === current.id;

    const connected: WorldNode[] = [];
    const fallbackOutlines: RegionOutline[] = [];
    for (const id of current.connections) {
      const node = worldGraph.nodes[id];
      if (node) {
        // FIX 4 — when standing at the settlement hub, only surface its
        // own sub-locations. Region-level peers (other settlements,
        // region_locations, the geographic zone) belong on the WorldMap,
        // not in the mobile nav bar.
        if (current.is_settlement_node === true && node.zone_id !== current.id) {
          continue;
        }
        // FIX 6 — at the geographic region zone, skip the settlement hub
        // here so it appears as the dedicated ← Return card instead.
        if (isAtRegionZone && node.is_settlement_node === true && node.zone_id === current.id) {
          continue;
        }
        connected.push(node);
      } else {
        const outline = outlinesById.get(id);
        if (outline) fallbackOutlines.push(outline);
      }
    }

    // "← Return" card.
    //
    // FIX 6 — when standing on the geographic region zone itself,
    // find the settlement hub and show it as the ← Return card so
    // mobile users can step into the settlement from the open world.
    // Previously CHANGE 5 suppressed the return card here; this
    // reverses that for the mobile nav bar.
    let parentSettlement: WorldNode | null = null;
    if (isAtRegionZone) {
      parentSettlement =
        Object.values(worldGraph.nodes).find(
          (n) => n.zone_id === current.id && n.is_settlement_node === true
        ) ?? null;
    } else if (current.type === "zone" && current.is_settlement_node !== true) {
      // Sub-zone inside a region: walk up to the parent settlement hub.
      parentSettlement =
        Object.values(worldGraph.nodes).find(
          (n) =>
            n.id !== current.id &&
            n.zone_id === current.zone_id &&
            n.is_settlement_node === true
        ) ?? null;
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
      const alreadyConnected = parentSettlement
        ? connected.some((n) => n.id === parentSettlement!.id)
        : false;
      if (alreadyConnected) parentSettlement = null;
    }

    // Outline cards for unexplored adjacent regions.
    const wb       = masterState?.metadata.world_bible;
    const wcd      = masterState?.metadata.world_consistency;
    const knownIds = new Set([
      ...connected.map((n) => n.id),
      ...(parentSettlement ? [parentSettlement.id] : []),
    ]);

    // FIX 3 — walk up to the player's geographic region node and collect
    // its connections list. Only adjacent regions in that set get a ◆ card;
    // this prevents cross-world jumps from locations far from those regions.
    const currentRegionNode = (() => {
      if (isAtRegionZone) return current;
      const zoneNode = current.zone_id ? worldGraph.nodes[current.zone_id] : null;
      if (zoneNode?.is_expandable && zoneNode.zone_id === zoneNode.id) return zoneNode;
      if (zoneNode?.zone_id) {
        const grandparent = worldGraph.nodes[zoneNode.zone_id];
        if (grandparent?.is_expandable && grandparent.zone_id === grandparent.id) return grandparent;
      }
      return null;
    })();
    const adjRegionIds = new Set<string>(currentRegionNode?.connections ?? []);

    const outlinesSeen = new Set<string>();
    const outlines: RegionOutline[] = [];
    for (const o of fallbackOutlines) {
      if (knownIds.has(o.id) || outlinesSeen.has(o.id)) continue;
      outlinesSeen.add(o.id);
      outlines.push(o);
    }
    for (const r of wb?.adjacent_regions ?? []) {
      if (knownIds.has(r.id) || outlinesSeen.has(r.id)) continue;
      // FIX 3 — skip adjacent regions not directly connected to the
      // player's current geographic region.
      if (adjRegionIds.size > 0 && !adjRegionIds.has(r.id)) continue;
      outlinesSeen.add(r.id);
      outlines.push(r);
    }

    // Landmark outlines — WCD landmarks the player can sense from
    // anywhere in the world (e.g. "Bellhaven", "the Wound") that aren't
    // yet a discovered graph node but DO have a matching outline.
    const adjacentRegions = wb?.adjacent_regions ?? [];
    const everyoneLandmarks = (wcd?.landmarks ?? []).filter(
      (lm) => lm.known_by === "everyone"
    );
    const landmarkPairs: Array<{ landmark: WorldLandmark; outline: RegionOutline }> = [];
    for (const lm of everyoneLandmarks) {
      const existingNode = worldGraph.nodes[lm.id];
      if (existingNode && existingNode.discovered) continue;
      const lmNameLower = lm.name.toLowerCase();
      const match = adjacentRegions.find(
        (r) =>
          r.landmark_id === lm.id ||
          r.id === lm.id ||
          r.name.toLowerCase() === lmNameLower
      );
      if (!match) continue;
      if (knownIds.has(match.id)) continue;
      const idx = outlines.findIndex((o) => o.id === match.id);
      if (idx >= 0) outlines.splice(idx, 1);
      landmarkPairs.push({ landmark: lm, outline: match });
    }

    return {
      connectedNodes:   connected,
      returnNode:       parentSettlement,
      adjacentOutlines: outlines,
      landmarkOutlines: landmarkPairs,
    };
  }, [worldGraph, masterState]);

  if (
    connectedNodes.length === 0 &&
    adjacentOutlines.length === 0 &&
    landmarkOutlines.length === 0 &&
    !returnNode
  ) {
    return null;
  }

  const visited = new Set(masterState?.world_state.visited_locations ?? []);
  const currentId = worldGraph?.current_node_id;

  return (
    <div
      role="navigation"
      aria-label="Connected locations"
      // Mobile-only — desktop relies on the WorldMap sidebar for nav.
      className="md:hidden shrink-0"
      style={{
        borderTop:  "1px solid var(--line)",
        background: "var(--bg-1)",
      }}
    >
      <div
        className="ew-scroll"
        style={{
          display:                 "flex",
          gap:                     8,
          overflowX:               "auto",
          padding:                 "10px 16px",
          WebkitOverflowScrolling: "touch",
          scrollbarWidth:          "none",
        }}
      >
        {returnNode && (
          <NavCard
            key={`return-${returnNode.id}`}
            name={returnNode.name.toUpperCase()}
            type="RETURN"
            visited
            onClick={() => onNavigate(returnNode.id)}
            iconCategory={returnNode.category ?? returnNode.type}
            kind="return"
          />
        )}
        {connectedNodes.map((node) => (
          <NavCard
            key={node.id}
            name={node.name.toUpperCase()}
            type={labelFor(node)}
            visited={visited.has(node.id) || node.discovered}
            current={node.id === currentId}
            onClick={() => onNavigate(node.id)}
            iconCategory={node.category ?? node.type}
            kind="known"
          />
        ))}
        {landmarkOutlines.map(({ landmark, outline }) => (
          <NavCard
            key={`landmark-${landmark.id}`}
            name={landmark.name.toUpperCase()}
            type="LANDMARK"
            undiscovered
            onClick={() => onNavigate(outline.id)}
            iconCategory="other"
            kind="landmark"
          />
        ))}
        {adjacentOutlines.map((outline) => (
          <NavCard
            key={`outline-${outline.id}`}
            name={outline.name.toUpperCase()}
            type={(outline.type ?? "RUMORED").toUpperCase()}
            undiscovered
            onClick={() => onNavigate(outline.id)}
            iconCategory="fog"
            kind="outline"
          />
        ))}
      </div>
    </div>
  );
}

// ── Card ────────────────────────────────────────────────────────────────────

interface CardProps {
  name:          string;
  type:          string;
  visited?:      boolean;
  undiscovered?: boolean;
  current?:      boolean;
  onClick:       () => void;
  iconCategory:  string;
  kind:          "known" | "outline" | "return" | "landmark";
}

function NavCard({
  name, type, visited, undiscovered, current, onClick, iconCategory, kind,
}: CardProps) {
  const borderStyle = undiscovered ? "dashed" : "solid";
  const isLandmark  = kind === "landmark";
  return (
    <button
      onClick={onClick}
      title={name}
      style={{
        display:        "flex",
        alignItems:     "center",
        gap:            10,
        minHeight:      52,
        padding:        "8px 14px",
        background:     current ? "var(--accent-faint)" : "var(--bg-2)",
        border:         `1px ${borderStyle} ${current || isLandmark ? "var(--accent)" : "var(--line)"}`,
        borderRadius:   4,
        color:          "var(--ink-2)",
        fontFamily:     "var(--mono)",
        cursor:         "pointer",
        flexShrink:     0,
        textAlign:      "left",
        position:       "relative",
        transition:     "all 120ms",
      }}
    >
      <div
        style={{
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
          width:          28,
          height:         28,
          color:          undiscovered ? "var(--ink-4)"
                         : current ? "var(--accent)"
                         : "var(--ink-2)",
        }}
      >
        <IconFor category={iconCategory} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <div
          style={{
            fontSize:      11,
            letterSpacing: "0.16em",
            fontWeight:    600,
            color:         current ? "var(--accent)"
                          : undiscovered ? "var(--ink-4)"
                          : "var(--ink-1)",
          }}
        >
          {undiscovered ? "??? " : ""}{name}
        </div>
        <div
          style={{
            fontSize:      8,
            letterSpacing: "0.2em",
            color:         "var(--ink-4)",
            display:       "flex",
            alignItems:    "center",
            gap:           6,
          }}
        >
          <span>{type}</span>
          {visited && !current && (
            <>
              <span
                style={{
                  width:        3,
                  height:       3,
                  background:   "var(--ink-5)",
                  borderRadius: 2,
                }}
              />
              <span>VISITED</span>
            </>
          )}
          {current && (
            <>
              <span
                style={{
                  width:        3,
                  height:       3,
                  background:   "var(--accent)",
                  borderRadius: 2,
                }}
              />
              <span style={{ color: "var(--accent)" }}>HERE</span>
            </>
          )}
        </div>
      </div>
    </button>
  );
}
