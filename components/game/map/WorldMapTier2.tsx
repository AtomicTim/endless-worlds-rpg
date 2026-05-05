"use client";

import { useMemo } from "react";
import type { MasterState, WorldGraph, WorldNode } from "@/types/game";
import {
  getNodeColor,
  MAP_CURRENT_GLOW,
  MAP_NPC_DOT,
  MAP_UNDISCOVERED,
} from "@/lib/game/map-colors";

/**
 * Day 19F — Tier 2: Regional Map.
 *
 * Renders every WorldNode that lives inside the selected region (i.e.
 * `zone_id === selectedRegionId` OR the region's own zone node) plus
 * directional exit arrows to adjacent regions. The current node gets an
 * amber glow; NPC dots stack on top of each node based on the live
 * `npc_ids` count.
 */

interface Props {
  masterState:      MasterState;
  worldGraph:       WorldGraph;
  selectedRegionId: string;
  onSelectNode:     (nodeId: string) => void;
  onSelectRegion:   (regionId: string) => void;
}

const NODE_PX = 48;
const GAP_PX  = 4;

export function WorldMapTier2({
  masterState,
  worldGraph,
  selectedRegionId,
  onSelectNode,
  onSelectRegion,
}: Props) {
  const currentNodeId = worldGraph.current_node_id;

  // Resolve the selected region's nodes plus the exit map (any connection
  // that crosses zones counts as an exit). We filter to just THIS region
  // so the player isn't seeing nodes from other regions bleed into the view.
  const { regionNodes, exits } = useMemo(() => {
    const nodes: WorldNode[] = Object.values(worldGraph.nodes).filter(
      (n) => n.zone_id === selectedRegionId || n.id === selectedRegionId
    );

    const exitsList: Array<{ from: WorldNode; targetRegionId: string; targetName: string }> = [];
    for (const node of nodes) {
      for (const c of node.connections) {
        const target = worldGraph.nodes[c];
        if (!target) continue;
        const targetRegion = target.type === "zone" ? target.id : target.zone_id;
        if (targetRegion !== selectedRegionId) {
          exitsList.push({
            from:           node,
            targetRegionId: targetRegion,
            targetName:     worldGraph.nodes[targetRegion]?.name ?? target.name,
          });
        }
      }
    }
    return { regionNodes: nodes, exits: exitsList };
  }, [worldGraph.nodes, selectedRegionId]);

  // Compute layout bounds from map_position so the panel auto-fits.
  const bounds = useMemo(() => {
    if (regionNodes.length === 0) {
      return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of regionNodes) {
      if (n.map_position.x < minX) minX = n.map_position.x;
      if (n.map_position.y < minY) minY = n.map_position.y;
      if (n.map_position.x > maxX) maxX = n.map_position.x;
      if (n.map_position.y > maxY) maxY = n.map_position.y;
    }
    // 1-cell padding so glow / NPC dots don't get clipped on edges.
    return { minX: minX - 1, minY: minY - 1, maxX: maxX + 1, maxY: maxY + 1 };
  }, [regionNodes]);

  const cols = Math.max(1, bounds.maxX - bounds.minX + 1);
  const rows = Math.max(1, bounds.maxY - bounds.minY + 1);
  const totalW = cols * (NODE_PX + GAP_PX);
  const totalH = rows * (NODE_PX + GAP_PX);

  const toPx = (x: number, y: number) => ({
    left: (x - bounds.minX) * (NODE_PX + GAP_PX),
    top:  (y - bounds.minY) * (NODE_PX + GAP_PX),
  });

  // Resolve NPC names so the count tooltip is informative.
  const wcdName = masterState.metadata.world_consistency?.world_name;
  void wcdName;

  return (
    <div
      className="scrollbar-thin h-full w-full overflow-auto p-3"
      style={{ background: "color-mix(in srgb, var(--color-bg) 95%, #000)" }}
    >
      <div
        className="relative mx-auto"
        style={{ width: totalW, height: totalH }}
      >
        {/* Connection lines — drawn BEHIND nodes via SVG so the dots layer cleanly. */}
        <svg
          aria-hidden
          width={totalW}
          height={totalH}
          className="pointer-events-none absolute inset-0"
        >
          {regionNodes.flatMap((node) => {
            const a = toPx(node.map_position.x, node.map_position.y);
            return node.connections
              .map((c) => worldGraph.nodes[c])
              .filter((target): target is WorldNode =>
                !!target && (target.zone_id === selectedRegionId || target.id === selectedRegionId)
              )
              .map((target) => {
                const b = toPx(target.map_position.x, target.map_position.y);
                return (
                  <line
                    key={`${node.id}-${target.id}`}
                    x1={a.left + NODE_PX / 2}
                    y1={a.top  + NODE_PX / 2}
                    x2={b.left + NODE_PX / 2}
                    y2={b.top  + NODE_PX / 2}
                    stroke="rgba(255,255,255,0.12)"
                    strokeWidth={1}
                  />
                );
              });
          })}
        </svg>

        {/* Discovered region nodes */}
        {regionNodes.filter((n) => n.discovered).map((node) => (
          <RegionNodeCell
            key={node.id}
            node={node}
            isCurrent={node.id === currentNodeId}
            position={toPx(node.map_position.x, node.map_position.y)}
            onClick={() => onSelectNode(node.id)}
          />
        ))}

        {/* Undiscovered nodes inside this region — outline only */}
        {regionNodes.filter((n) => !n.discovered).map((node) => (
          <UndiscoveredNodeCell
            key={node.id}
            node={node}
            position={toPx(node.map_position.x, node.map_position.y)}
          />
        ))}

        {/* Exit arrows clustered at the edge of the source node */}
        {exits.map((exit, i) => {
          const pos = toPx(exit.from.map_position.x, exit.from.map_position.y);
          return (
            <button
              key={`${exit.from.id}-${exit.targetRegionId}-${i}`}
              onClick={() => onSelectRegion(exit.targetRegionId)}
              title={`Exit to ${exit.targetName}`}
              className="absolute flex items-center gap-1 rounded-sm px-1 text-[10px] font-bold uppercase tracking-wider transition-opacity hover:opacity-80"
              style={{
                left:            pos.left + NODE_PX + 2,
                top:             pos.top + i * 12,
                color:           MAP_CURRENT_GLOW,
                backgroundColor: "color-mix(in srgb, var(--color-bg) 80%, transparent)",
                border:          `1px solid ${MAP_CURRENT_GLOW}`,
                fontFamily:      "var(--font-mono)",
                cursor:          "pointer",
                whiteSpace:      "nowrap",
                zIndex:          5,
              }}
            >
              → {truncate(exit.targetName, 14)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Cell components ──────────────────────────────────────────────────────────

interface NodeCellProps {
  node:      WorldNode;
  isCurrent: boolean;
  position:  { left: number; top: number };
  onClick:   () => void;
}

function RegionNodeCell({ node, isCurrent, position, onClick }: NodeCellProps) {
  const fill        = getNodeColor(node.category ?? node.type);
  const npcCount    = node.npc_ids.length;
  const visibleDots = Math.min(3, npcCount);

  return (
    <button
      onClick={onClick}
      title={`${node.name}${npcCount > 0 ? ` — ${npcCount} NPC${npcCount === 1 ? "" : "s"}` : ""}`}
      className="absolute flex flex-col items-center justify-center text-[9px] font-bold uppercase tracking-wider transition-transform hover:scale-105"
      style={{
        ...position,
        width:           NODE_PX,
        height:          NODE_PX,
        backgroundColor: fill,
        border:          isCurrent
          ? `2px solid ${MAP_CURRENT_GLOW}`
          : "1px solid rgba(255,255,255,0.18)",
        borderRadius: 4,
        color:        "rgba(255,255,255,0.9)",
        boxShadow:    isCurrent ? `0 0 10px ${MAP_CURRENT_GLOW}` : "none",
        cursor:       "pointer",
        fontFamily:   "var(--font-mono)",
        padding:      4,
      }}
    >
      <span style={{ textAlign: "center", lineHeight: 1.05 }}>
        {truncate(node.name, 12)}
      </span>

      {/* NPC dots — at most 3, then a "+N" badge */}
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

      {/* Player marker on current node */}
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

function UndiscoveredNodeCell({
  node,
  position,
}: {
  node:     WorldNode;
  position: { left: number; top: number };
}) {
  return (
    <div
      title={`${node.name} — undiscovered`}
      className="absolute pointer-events-none flex items-center justify-center"
      style={{
        ...position,
        width:        NODE_PX,
        height:       NODE_PX,
        border:       `1px dashed ${MAP_UNDISCOVERED}`,
        borderRadius: 4,
        color:        "color-mix(in srgb, var(--color-muted) 80%, transparent)",
        fontSize:     10,
        fontFamily:   "var(--font-mono)",
      }}
    >
      ???
    </div>
  );
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}
