"use client";

import React, { useMemo } from "react";
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
  key:      string;
  kind:     CardKind;
  /** Node id (or adjacent region outline id) handed to onNavigate. */
  targetId: string;
  /** Primary label — destination name, ALL CAPS. */
  name:     string;
  /** Secondary label — category / "EXIT TO REGION" / etc., ALL CAPS. */
  sublabel: string;
}

// ────────────────────────────────────────────────────────────────────────────

export function NavigationBar({ worldGraph, masterState, onNavigate }: Props) {
  const cards = useMemo<Card[]>(
    () => buildCards(worldGraph, masterState),
    [worldGraph, masterState]
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
          />
        ))}
      </div>
    </div>
  );
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
        key:      `back-${parent.id}`,
        kind:     "back",
        targetId: parent.id,
        name:     parent.name.toUpperCase(),
        sublabel: typeLabel(parent),
      });
    }
  } else if (isAtDungeon) {
    // For a standalone dungeon the parent zone is the geographic region.
    const parent = worldGraph.nodes[current.zone_id];
    if (parent && parent.id !== current.id) {
      backCards.push({
        key:      `back-${parent.id}`,
        kind:     "back",
        targetId: parent.id,
        name:     parent.name.toUpperCase(),
        sublabel: typeLabel(parent),
      });
    }
  } else if (isAtRegionZone && settlementHub) {
    backCards.push({
      key:      `back-${settlementHub.id}`,
      kind:     "back",
      targetId: settlementHub.id,
      name:     settlementHub.name.toUpperCase(),
      sublabel: typeLabel(settlementHub),
    });
  }

  // ── TYPE B — deeper ──────────────────────────────────────────────────────
  const deeperCards: Card[] = [];
  if (isAtSettlementHub) {
    // sub_locations connected to the hub (i.e. nodes whose zone_id === hub.id
    // and which are sub_locations).
    for (const id of current.connections) {
      const node = worldGraph.nodes[id];
      if (!node) continue;
      if (node.type !== "sub_location") continue;
      if (node.zone_id !== current.id) continue;
      deeperCards.push({
        key:      `deeper-${node.id}`,
        kind:     "deeper",
        targetId: node.id,
        name:     node.name.toUpperCase(),
        sublabel: typeLabel(node),
      });
    }
  } else if (isAtSubLocation) {
    // Siblings: sub_locations of the parent hub, excluding self and the
    // back target (which is the hub itself).
    const hubId = current.zone_id;
    const hub   = worldGraph.nodes[hubId];
    if (hub) {
      for (const id of hub.connections) {
        if (id === current.id) continue;
        const node = worldGraph.nodes[id];
        if (!node) continue;
        if (node.type !== "sub_location") continue;
        if (node.zone_id !== hubId) continue;
        deeperCards.push({
          key:      `deeper-${node.id}`,
          kind:     "deeper",
          targetId: node.id,
          name:     node.name.toUpperCase(),
          sublabel: typeLabel(node),
        });
      }
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
        key:      `deeper-${node.id}`,
        kind:     "deeper",
        targetId: node.id,
        name:     node.name.toUpperCase(),
        sublabel: typeLabel(node),
      });
    }
  }

  // ── TYPE C — exit ────────────────────────────────────────────────────────
  const exitCards: Card[] = [];
  if ((isAtSettlementHub || isAtSubLocation) && regionZone) {
    exitCards.push({
      key:      `exit-${regionZone.id}`,
      kind:     "exit",
      targetId: regionZone.id,
      name:     regionZone.name.toUpperCase(),
      sublabel: "EXIT TO REGION",
    });
  } else if (isAtDungeon && settlementHub) {
    exitCards.push({
      key:      `exit-${settlementHub.id}`,
      kind:     "exit",
      targetId: settlementHub.id,
      name:     settlementHub.name.toUpperCase(),
      sublabel: "EXIT DUNGEON",
    });
  }

  // ── TYPE D — peer (region_locations + adjacent undiscovered) ─────────────
  const peerCards: Card[] = [];
  if (isAtRegionZone) {
    // D1 — known region_locations under this region.
    for (const node of Object.values(worldGraph.nodes)) {
      if (node.id === current.id) continue;
      if (node.zone_id !== current.id) continue;
      if (node.is_settlement_node === true) continue;
      if (node.type !== "zone") continue;
      if (node.is_expandable === true) continue;
      peerCards.push({
        key:      `peer-known-${node.id}`,
        kind:     "peer-known",
        targetId: node.id,
        name:     node.name.toUpperCase(),
        sublabel: typeLabel(node),
      });
    }

    // D2 — adjacent undiscovered regions, filtered to direct connections
    // of this region zone. Pull from world_bible.adjacent_regions.
    const wb           = masterState?.metadata.world_bible;
    const adjRegionIds = new Set<string>(current.connections);
    const knownPeerIds = new Set(peerCards.map((c) => c.targetId));
    const seen         = new Set<string>();
    for (const r of wb?.adjacent_regions ?? []) {
      if (!adjRegionIds.has(r.id)) continue;
      if (knownPeerIds.has(r.id)) continue;
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      peerCards.push({
        key:      `peer-unknown-${r.id}`,
        kind:     "peer-unknown",
        targetId: r.id,
        name:     r.name.toUpperCase(),
        sublabel: "UNDISCOVERED REGION",
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

function NavCard({ card, onClick }: { card: Card; onClick: () => void }) {
  const isBack       = card.kind === "back";
  const isExit       = card.kind === "exit";
  const isUnknown    = card.kind === "peer-unknown";
  const arrow        = ARROW[card.kind];

  const arrowColor =
    isBack ? "var(--ink-3)" : isUnknown ? "var(--ink-4)" : "var(--accent)";
  const nameColor =
    isBack ? "var(--ink-3)" : isUnknown ? "var(--ink-4)" : "var(--ink-1)";
  const subColor   = "var(--ink-4)";
  const background = isExit ? "var(--bg-3)" : "var(--bg-2)";
  const borderColor =
    isUnknown ? "var(--line-2)"
    : isBack  ? "var(--line)"
    : "var(--accent)";
  const borderStyle = isUnknown ? "dashed" : "solid";

  return (
    <button
      onClick={onClick}
      title={card.name}
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
        cursor:         "pointer",
        flexShrink:     0,
        textAlign:      "left",
        whiteSpace:     "nowrap",
        transition:     "all 120ms",
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
            fontFamily:    "var(--mono)",
            fontSize:      9,
            letterSpacing: "0.18em",
            fontWeight:    600,
            color:         nameColor,
            overflow:      "hidden",
            textOverflow:  "ellipsis",
            whiteSpace:    "nowrap",
          }}
        >
          {card.name}
        </span>
        <span
          style={{
            fontFamily:    "var(--mono)",
            fontSize:      8,
            letterSpacing: "0.2em",
            color:         subColor,
            overflow:      "hidden",
            textOverflow:  "ellipsis",
            whiteSpace:    "nowrap",
          }}
        >
          {card.sublabel}
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
