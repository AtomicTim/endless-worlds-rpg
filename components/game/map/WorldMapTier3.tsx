"use client";

import { useMemo } from "react";
import type {
  MasterState,
  WorldAsset,
  WorldGraph,
  WorldNode,
} from "@/types/game";
import {
  getNodeColor,
  getNodeTypeAbbr,
  MAP_CURRENT_GLOW,
  MAP_NPC_DOT,
} from "@/lib/game/map-colors";
import { getGenreColors } from "../genre-ui";
import { MapDecoration, getDecorationsForGenre } from "./MapDecorations";

/**
 * Day 19F — Tier 3: Local Map.
 *
 * Renders the layout of a single zone: its settlement node plus every
 * sub_location that calls the zone home. Empty grid cells are dressed
 * with a small constellation of genre-themed SVG decorations (replacing
 * the previous grey filler blocks). Region exits sit as labelled arrows
 * around the edges.
 *
 * Clicking a notable sub-location fires onNavigateTo(nodeId) — the
 * caller (WorldMap → GameLayout → page) submits a "go to <name>" action
 * via useGameLoop.
 */

interface Props {
  masterState:     MasterState;
  worldGraph:      WorldGraph;
  /** The node whose zone we're rendering. Falls back to its zone_id if
   *  the player is currently in a sub_location. */
  currentNodeId:   string;
  locationAssets:  WorldAsset[];
  onNavigateTo:    (nodeId: string) => void;
}

const NODE_PX     = 72;
const CELL_PAD_PX = 8;
const CELL_PX     = NODE_PX + CELL_PAD_PX;

export function WorldMapTier3({
  masterState,
  worldGraph,
  currentNodeId,
  onNavigateTo,
}: Props) {
  const genre  = masterState.metadata.genre;
  const colors = getGenreColors(genre);

  const currentNode = worldGraph.nodes[currentNodeId];
  const zoneId =
    currentNode && currentNode.type === "sub_location"
      ? currentNode.zone_id
      : currentNodeId;

  // ── Notable sub-locations + the settlement node itself ─────────────────────
  const notableNodes: WorldNode[] = useMemo(() => {
    return Object.values(worldGraph.nodes).filter(
      (n) => n.zone_id === zoneId || n.id === zoneId
    );
  }, [worldGraph.nodes, zoneId]);

  // ── Layout: place each notable node by its map_position, jittering on collision
  const layout = useMemo(() => {
    if (notableNodes.length === 0) {
      return { positions: new Map<string, { x: number; y: number }>(), bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0 } };
    }
    const positions = new Map<string, { x: number; y: number }>();
    const taken     = new Set<string>();
    for (const node of notableNodes) {
      let { x, y } = node.map_position;
      let attempts = 0;
      // Seeded jitter — when two sub-locations sit at the same grid cell,
      // nudge one of them deterministically so they don't overlap.
      const seed = hashString(node.id);
      while (taken.has(`${x},${y}`) && attempts < 8) {
        const dx = ((seed >> (attempts * 2)) & 0b1) === 0 ? -1 : 1;
        const dy = ((seed >> (attempts * 2 + 1)) & 0b1) === 0 ? -1 : 1;
        x += dx;
        y += dy;
        attempts += 1;
      }
      taken.add(`${x},${y}`);
      positions.set(node.id, { x, y });
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const allPositions = Array.from(positions.values());
    for (const p of allPositions) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    return {
      positions,
      bounds: { minX: minX - 1, minY: minY - 1, maxX: maxX + 1, maxY: maxY + 1 },
    };
  }, [notableNodes]);

  const cols   = Math.max(1, layout.bounds.maxX - layout.bounds.minX + 1);
  const rows   = Math.max(1, layout.bounds.maxY - layout.bounds.minY + 1);
  const totalW = cols * CELL_PX;
  const totalH = rows * CELL_PX;

  const toPx = (gx: number, gy: number) => ({
    left: (gx - layout.bounds.minX) * CELL_PX,
    top:  (gy - layout.bounds.minY) * CELL_PX,
  });

  // ── Decorations — fill every empty grid cell with 3-5 small SVG glyphs ────
  // Each cell's decorations are seeded by `${zoneId}:${gx}:${gy}` so the
  // texture is stable across renders and across save/load cycles.
  const decorations = useMemo(() => {
    const occupied = new Set<string>();
    Array.from(layout.positions.values()).forEach((p) => {
      occupied.add(`${p.x},${p.y}`);
    });
    const decorCount = getDecorationsForGenre(genre).length;

    const out: Array<{
      key:   string;
      left:  number;
      top:   number;
      size:  number;
      rot:   number;
      type:  number;
    }> = [];

    for (let gy = layout.bounds.minY; gy <= layout.bounds.maxY; gy += 1) {
      for (let gx = layout.bounds.minX; gx <= layout.bounds.maxX; gx += 1) {
        if (occupied.has(`${gx},${gy}`)) continue;

        const seed = hashString(`${zoneId}:${gx}:${gy}`);
        const rng  = mulberry32(seed);
        const count = 3 + Math.floor(rng() * 3); // 3, 4 or 5
        const cellLeft = (gx - layout.bounds.minX) * CELL_PX;
        const cellTop  = (gy - layout.bounds.minY) * CELL_PX;

        for (let i = 0; i < count; i += 1) {
          const size = 14 + Math.floor(rng() * 10); // 14-23px
          const dx   = rng() * Math.max(0, NODE_PX - size);
          const dy   = rng() * Math.max(0, NODE_PX - size);
          out.push({
            key:  `${gx},${gy}:${i}`,
            left: cellLeft + dx,
            top:  cellTop  + dy,
            size,
            rot:  Math.floor(rng() * 360),
            type: Math.floor(rng() * decorCount),
          });
        }
      }
    }
    return out;
  }, [layout, zoneId, genre]);

  // ── Region exits — connections that point outside this zone ────────────────
  const regionExits = useMemo(() => {
    const settlement = notableNodes.find((n) => !n.zone_id || n.zone_id === n.id);
    if (!settlement) return [] as Array<{ targetId: string; label: string }>;
    return settlement.connections
      .map((c) => worldGraph.nodes[c])
      .filter((target): target is WorldNode =>
        !!target && target.zone_id !== zoneId && target.id !== zoneId
      )
      .map((target) => ({
        targetId: target.id,
        label:    target.name,
      }));
  }, [notableNodes, worldGraph.nodes, zoneId]);

  if (notableNodes.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-xs italic"
        style={{ color: "var(--color-muted)" }}
      >
        No local layout available for this region yet.
      </div>
    );
  }

  // Decoration ink — heavily muted tint of the genre's primary accent.
  const decorColor = `color-mix(in srgb, ${colors.primary} 18%, transparent)`;

  return (
    <div
      className="scrollbar-thin h-full w-full overflow-auto p-3"
      style={{ background: "color-mix(in srgb, var(--color-bg) 95%, #000)" }}
    >
      <div
        className="relative mx-auto"
        style={{ width: totalW, height: totalH }}
      >
        {/* Genre-flavoured ambient decorations — non-clickable, non-tooltip. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ color: decorColor }}
        >
          {decorations.map((d) => (
            <span
              key={d.key}
              className="absolute"
              style={{
                left:      d.left,
                top:       d.top,
                width:     d.size,
                height:    d.size,
                transform: `rotate(${d.rot}deg)`,
                lineHeight: 0,
              }}
            >
              <MapDecoration typeIndex={d.type} genre={genre} size={d.size} />
            </span>
          ))}
        </div>

        {/* Notable sub-locations */}
        {notableNodes.map((node) => {
          const pos = layout.positions.get(node.id);
          if (!pos) return null;
          return (
            <SubLocationCell
              key={node.id}
              node={node}
              isCurrent={node.id === currentNodeId}
              position={toPx(pos.x, pos.y)}
              accent={colors.primary}
              onClick={() => onNavigateTo(node.id)}
            />
          );
        })}

        {/* Region exits — dock to the top-right of the panel since orientation
            comes from the bible's RegionExit.direction (not always available).
            Players still get a clickable list so they can preview the path. */}
        {regionExits.length > 0 && (
          <div
            className="pointer-events-auto absolute right-1 top-1 flex flex-col items-end gap-1"
            style={{ zIndex: 5 }}
          >
            {regionExits.map((exit) => (
              <button
                key={exit.targetId}
                onClick={() => onNavigateTo(exit.targetId)}
                title={`Travel to ${exit.label}`}
                className="rounded-md px-3 text-[11px] font-bold uppercase tracking-wider transition-opacity hover:opacity-80"
                style={{
                  // Navigation redesign — mobile-friendly tap target.
                  minHeight:       44,
                  minWidth:        160,
                  border:          `1px solid ${MAP_CURRENT_GLOW}`,
                  color:           MAP_CURRENT_GLOW,
                  backgroundColor: "color-mix(in srgb, var(--color-bg) 80%, transparent)",
                  fontFamily:      "var(--font-mono)",
                  cursor:          "pointer",
                }}
              >
                → {truncate(exit.label, 18)}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Cell components ──────────────────────────────────────────────────────────

interface SubLocationCellProps {
  node:      WorldNode;
  isCurrent: boolean;
  position:  { left: number; top: number };
  accent:    string;
  onClick:   () => void;
}

function SubLocationCell({ node, isCurrent, position, accent, onClick }: SubLocationCellProps) {
  const fill        = getNodeColor(node.category ?? node.type);
  const npcCount    = node.npc_ids.length;
  const visibleDots = Math.min(3, npcCount);
  const typeAbbr    = getNodeTypeAbbr(node.category ?? node.type);
  const displayName = truncate(node.name, 14);
  return (
    <button
      onClick={onClick}
      title={`${node.name}${npcCount > 0 ? ` — ${npcCount} NPC${npcCount === 1 ? "" : "s"}` : ""}`}
      className="absolute flex flex-col items-center justify-center text-[10px] font-bold uppercase tracking-wider transition-transform hover:scale-105"
      style={{
        ...position,
        width:           NODE_PX,
        height:          NODE_PX,
        backgroundColor: fill,
        border:          isCurrent
          ? `2px solid ${MAP_CURRENT_GLOW}`
          : "1px solid rgba(255,255,255,0.2)",
        borderRadius: 4,
        color:        "rgba(255,255,255,0.92)",
        boxShadow:    isCurrent ? `0 0 10px ${MAP_CURRENT_GLOW}` : "none",
        cursor:       "pointer",
        fontFamily:   "var(--font-mono)",
        padding:      6,
        lineHeight:   1.1,
        textAlign:    "center",
      }}
    >
      <span>{wrapTwoLines(displayName, 12)}</span>

      {/* Type abbreviation in the bottom-left corner — replaces the old
          emoji icon. Slightly muted tint of the genre primary so it
          reads as a chip without competing with the location name. */}
      <span
        aria-hidden
        className="absolute"
        style={{
          left:      4,
          bottom:    3,
          fontSize:  9,
          fontFamily: "var(--font-mono)",
          fontWeight: 700,
          letterSpacing: "0.06em",
          color:     `color-mix(in srgb, ${accent} 60%, transparent)`,
        }}
      >
        {typeAbbr}
      </span>

      {visibleDots > 0 && (
        <span className="absolute -bottom-1 right-1 flex items-center gap-[2px]">
          {Array.from({ length: visibleDots }).map((_, i) => (
            <span
              key={i}
              style={{
                width:           6,
                height:          6,
                backgroundColor: MAP_NPC_DOT,
                borderRadius:    "50%",
                boxShadow:       `0 0 4px ${MAP_NPC_DOT}`,
              }}
            />
          ))}
          {npcCount > 3 && (
            <span style={{ color: MAP_NPC_DOT, fontSize: 9, fontWeight: "bold" }}>
              +{npcCount - 3}
            </span>
          )}
        </span>
      )}

      {isCurrent && (
        <span
          aria-hidden
          className="absolute -top-1 -right-1"
          style={{ color: MAP_CURRENT_GLOW, fontSize: 14, lineHeight: 1 }}
        >
          ●
        </span>
      )}
    </button>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

/**
 * Wraps a label into at most two lines with naive word-boundary splits.
 * Used so longer sub-location names like "The Rusted Anchor" don't get
 * cut to "The R…" inside the 72px tile.
 */
function wrapTwoLines(s: string, maxPerLine: number): React.ReactNode {
  if (s.length <= maxPerLine) return s;
  const words = s.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length <= maxPerLine) {
      cur = (cur ? cur + " " : "") + w;
    } else {
      if (cur) lines.push(cur);
      cur = w;
      if (lines.length === 1) break;
    }
  }
  if (cur && lines.length < 2) lines.push(cur);
  return (
    <>
      {lines.map((l, i) => (
        <span key={i} style={{ display: "block" }}>
          {truncate(l, maxPerLine)}
        </span>
      ))}
    </>
  );
}

/** Tiny string hash → 32-bit int for seeded jitter / decoration placement. */
function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return h >>> 0;
}

/** Mulberry32 PRNG — small, deterministic, seeded by an integer. */
function mulberry32(a: number): () => number {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
