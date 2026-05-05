"use client";

import { useEffect, useMemo, useRef } from "react";
import type { MasterState, WorldGraph, WorldLandmark, WorldNode } from "@/types/game";
import {
  getNodeColor,
  MAP_CURRENT_GLOW,
  MAP_LANDMARK,
  MAP_UNDISCOVERED,
} from "@/lib/game/map-colors";

/**
 * Day 19F — Tier 1: World Map.
 *
 * Renders the full WCD grid (default 40×40, recentred on the player's
 * current region). Discovered top-level zones get a colored square at
 * their map_position; WCD landmarks float above as gold diamonds; any
 * undiscovered node a discovered one connects to renders as a dim
 * outline placeholder ("???") so the player can see which exits lead
 * somewhere unexplored.
 */

interface Props {
  masterState:     MasterState;
  worldGraph:      WorldGraph;
  onSelectRegion:  (nodeId: string) => void;
}

const CELL_PX = 24;
const GAP_PX  = 1;

export function WorldMapTier1({ masterState, worldGraph, onSelectRegion }: Props) {
  const wcd      = masterState.metadata.world_consistency;
  const gridSize = wcd?.grid_size ?? 40;
  const half     = Math.floor(gridSize / 2);

  // ── Bucketise nodes ────────────────────────────────────────────────────────
  // - discoveredZones: top-level zones the player has visited or that
  //   apply-world-bible flagged as starting region.
  // - undiscoveredHints: zones that exist in the graph but haven't been
  //   discovered yet AND are reachable from at least one discovered node.
  const { discoveredZones, undiscoveredHints } = useMemo(() => {
    const allZones = Object.values(worldGraph.nodes).filter(
      (n) => n.type === "zone"
    );
    const discovered = allZones.filter((n) => n.discovered);
    const reachable  = new Set<string>();
    for (const node of discovered) {
      for (const c of node.connections) {
        const target = worldGraph.nodes[c];
        if (target && !target.discovered && target.type === "zone") {
          reachable.add(target.id);
        }
      }
    }
    const hints = allZones.filter((n) => !n.discovered && reachable.has(n.id));
    return { discoveredZones: discovered, undiscoveredHints: hints };
  }, [worldGraph.nodes]);

  // Center the scroll viewport on the player's current region on mount AND
  // whenever the player changes regions. The grid is rendered as one big
  // scrollable area; we just nudge scrollTop/scrollLeft to centre the cell.
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const playerNode  = worldGraph.nodes[worldGraph.current_node_id];
  const playerZone  =
    playerNode && playerNode.type === "zone"
      ? playerNode
      : (playerNode ? worldGraph.nodes[playerNode.zone_id] : null);
  const centreX = playerZone?.map_position.x ?? wcd?.world_origin.x ?? 0;
  const centreY = playerZone?.map_position.y ?? wcd?.world_origin.y ?? 0;

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const cellTotal = CELL_PX + GAP_PX;
    const targetX   = (centreX + half) * cellTotal;
    const targetY   = (centreY + half) * cellTotal;
    el.scrollTo({
      left:     Math.max(0, targetX - el.clientWidth  / 2),
      top:      Math.max(0, targetY - el.clientHeight / 2),
      behavior: "auto",
    });
  }, [centreX, centreY, half]);

  // World grid covers (-half..+half) on both axes. We render that as an
  // absolutely positioned div big enough to hold all cells; each marker
  // is positioned individually so we don't pay the cost of rendering
  // empty grid cells.
  const totalPx = (gridSize + 1) * (CELL_PX + GAP_PX);

  const toPx = (x: number, y: number) => ({
    left: (x + half) * (CELL_PX + GAP_PX),
    top:  (y + half) * (CELL_PX + GAP_PX),
  });

  return (
    <div
      ref={viewportRef}
      className="scrollbar-thin h-full w-full overflow-auto"
      style={{
        background: "color-mix(in srgb, var(--color-bg) 90%, #000)",
      }}
    >
      <div
        className="relative"
        style={{ width: totalPx, height: totalPx }}
      >
        {/* Subtle grid backdrop — every 5 cells gets a fainter gridline so the
            player can read distances at a glance without the overhead of
            rendering 1600 individual cells. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              `linear-gradient(to right, rgba(255,255,255,0.02) 1px, transparent 1px),` +
              `linear-gradient(to bottom, rgba(255,255,255,0.02) 1px, transparent 1px)`,
            backgroundSize: `${(CELL_PX + GAP_PX) * 5}px ${(CELL_PX + GAP_PX) * 5}px`,
          }}
        />

        {/* Discovered zones */}
        {discoveredZones.map((node) => (
          <DiscoveredCell
            key={node.id}
            node={node}
            isCurrent={node.id === playerZone?.id}
            position={toPx(node.map_position.x, node.map_position.y)}
            onClick={() => onSelectRegion(node.id)}
          />
        ))}

        {/* Undiscovered hints — outline only, "???" label */}
        {undiscoveredHints.map((node) => (
          <UndiscoveredCell
            key={node.id}
            node={node}
            position={toPx(node.map_position.x, node.map_position.y)}
          />
        ))}

        {/* WCD landmarks — diamonds visible from the start */}
        {(wcd?.landmarks ?? []).map((lm) => (
          <LandmarkMarker
            key={lm.id}
            landmark={lm}
            position={toPx(lm.grid_position.x, lm.grid_position.y)}
          />
        ))}

        {/* Player marker — pulsing crosshair on the current region */}
        {playerZone && (
          <div
            aria-hidden
            className="pointer-events-none absolute"
            style={{
              ...toPx(playerZone.map_position.x, playerZone.map_position.y),
              width:  CELL_PX,
              height: CELL_PX,
              border: `2px solid ${MAP_CURRENT_GLOW}`,
              borderRadius: 4,
              boxShadow:    `0 0 12px ${MAP_CURRENT_GLOW}`,
              animation:    "tier1-pulse 1.6s ease-in-out infinite",
            }}
          />
        )}

        <style jsx>{`
          @keyframes tier1-pulse {
            0%, 100% { opacity: 0.55; }
            50%      { opacity: 1; }
          }
        `}</style>
      </div>
    </div>
  );
}

// ── Cell components ──────────────────────────────────────────────────────────

interface CellProps {
  node:      WorldNode;
  isCurrent: boolean;
  position:  { left: number; top: number };
  onClick:   () => void;
}

function DiscoveredCell({ node, isCurrent, position, onClick }: CellProps) {
  const fill = getNodeColor(node.category ?? node.type);
  return (
    <button
      onClick={onClick}
      title={node.name}
      className="absolute transition-transform hover:scale-110"
      style={{
        ...position,
        width:           CELL_PX,
        height:          CELL_PX,
        backgroundColor: fill,
        border:          isCurrent
          ? `2px solid ${MAP_CURRENT_GLOW}`
          : "1px solid rgba(255,255,255,0.15)",
        borderRadius: 3,
        cursor:       "pointer",
      }}
    />
  );
}

function UndiscoveredCell({
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
        width:        CELL_PX,
        height:       CELL_PX,
        border:       `1px dashed ${MAP_UNDISCOVERED}`,
        borderRadius: 3,
        color:        "color-mix(in srgb, var(--color-muted) 80%, transparent)",
        fontSize:     9,
        fontFamily:   "var(--font-mono)",
      }}
    >
      ???
    </div>
  );
}

function LandmarkMarker({
  landmark,
  position,
}: {
  landmark: WorldLandmark;
  position: { left: number; top: number };
}) {
  return (
    <div
      title={`${landmark.name} — ${landmark.public_description}`}
      className="absolute pointer-events-none flex items-center justify-center"
      style={{
        ...position,
        width:      CELL_PX,
        height:     CELL_PX,
        color:      MAP_LANDMARK,
        fontSize:   18,
        fontWeight: "bold",
        textShadow: `0 0 4px ${MAP_LANDMARK}`,
      }}
    >
      ◆
    </div>
  );
}
