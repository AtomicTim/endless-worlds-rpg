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
  MAP_CURRENT_GLOW,
  MAP_NPC_DOT,
} from "@/lib/game/map-colors";

/**
 * Day 19F — Tier 3: Local Map.
 *
 * Renders the layout of a single zone: its settlement node plus every
 * sub_location that calls the zone home. Ambient grey filler blocks pad
 * the layout out so a tiny settlement still feels like a real place.
 * Region exits sit as labelled arrows around the edges.
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

const NODE_PX        = 56;
const FILLER_PX      = 20;
const TARGET_FILLERS = 12;

export function WorldMapTier3({
  worldGraph,
  currentNodeId,
  onNavigateTo,
}: Props) {
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
    // Snapshot to an array first — older TS targets can't iterate Map values
    // directly without --downlevelIteration.
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
  const totalW = cols * (NODE_PX + 8);
  const totalH = rows * (NODE_PX + 8);

  const toPx = (gx: number, gy: number) => ({
    left: (gx - layout.bounds.minX) * (NODE_PX + 8),
    top:  (gy - layout.bounds.minY) * (NODE_PX + 8),
  });

  // ── Ambient filler blocks — count derived from notable count ───────────────
  const fillerCount = Math.max(0, TARGET_FILLERS - notableNodes.length);
  const fillerSeed  = hashString(zoneId);
  const fillers     = useMemo(() => {
    const out: Array<{ left: number; top: number; rot: number }> = [];
    const wPad = 12;
    const hPad = 12;
    for (let i = 0; i < fillerCount; i += 1) {
      const r1 = mulberry32(fillerSeed + i * 9301);
      const r2 = mulberry32(fillerSeed + i * 49297);
      const r3 = mulberry32(fillerSeed + i * 233280);
      out.push({
        left: wPad + r1() * Math.max(0, totalW - 2 * wPad - FILLER_PX),
        top:  hPad + r2() * Math.max(0, totalH - 2 * hPad - FILLER_PX),
        rot:  Math.floor(r3() * 30) - 15,
      });
    }
    return out;
  }, [fillerCount, fillerSeed, totalW, totalH]);

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

  return (
    <div
      className="scrollbar-thin h-full w-full overflow-auto p-3"
      style={{ background: "color-mix(in srgb, var(--color-bg) 95%, #000)" }}
    >
      <div
        className="relative mx-auto"
        style={{ width: totalW, height: totalH }}
      >
        {/* Filler ambient blocks — non-clickable, no tooltip */}
        {fillers.map((f, i) => (
          <div
            key={`filler-${i}`}
            aria-hidden
            className="pointer-events-none absolute"
            style={{
              left:            f.left,
              top:             f.top,
              width:           FILLER_PX,
              height:          FILLER_PX,
              backgroundColor: "#1f2937",
              opacity:         0.55,
              borderRadius:    2,
              transform:       `rotate(${f.rot}deg)`,
            }}
          />
        ))}

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
  onClick:   () => void;
}

function SubLocationCell({ node, isCurrent, position, onClick }: SubLocationCellProps) {
  const fill        = getNodeColor(node.category ?? node.type);
  const npcCount    = node.npc_ids.length;
  const visibleDots = Math.min(3, npcCount);
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
        padding:      4,
        lineHeight:   1.05,
        textAlign:    "center",
      }}
    >
      <span>{wrapTwoLines(node.name, 12)}</span>

      {visibleDots > 0 && (
        <span className="absolute -bottom-1 left-1 flex items-center gap-[2px]">
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
 * cut to "The R…" inside the 56px tile.
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
  // Truncate any over-long single token.
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

/** Tiny string hash → 32-bit int for seeded jitter / filler placement. */
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
