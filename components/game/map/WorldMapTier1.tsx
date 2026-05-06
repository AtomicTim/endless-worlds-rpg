"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { MasterState, WorldGraph, WorldLandmark, WorldNode } from "@/types/game";
import {
  getNodeColor,
  MAP_CURRENT_GLOW,
  MAP_LANDMARK,
  MAP_UNDISCOVERED,
} from "@/lib/game/map-colors";
import { getGenreColors } from "../genre-ui";

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
  const colors   = getGenreColors(masterState.metadata.genre);

  // FIX 8 — landmark tooltip state. Tracks which landmark (if any) the
  // player is currently hovering / touching, plus the screen-relative
  // position of its diamond so the tooltip can anchor above it.
  const [activeLandmark, setActiveLandmark] = useState<{
    landmark: WorldLandmark;
    left:     number;
    top:      number;
  } | null>(null);

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

        {/* WCD landmarks — diamonds visible from the start. FIX 8:
            hovering / touching opens a Direction-3 styled tooltip with
            the landmark's name + public_description above the marker. */}
        {(wcd?.landmarks ?? []).map((lm) => {
          const pos = toPx(lm.grid_position.x, lm.grid_position.y);
          return (
            <LandmarkMarker
              key={lm.id}
              landmark={lm}
              position={pos}
              onShow={() =>
                setActiveLandmark({
                  landmark: lm,
                  left:     pos.left + CELL_PX / 2,
                  top:      pos.top,
                })
              }
              onHide={() =>
                setActiveLandmark((cur) =>
                  cur && cur.landmark.id === lm.id ? null : cur
                )
              }
            />
          );
        })}

        {/* Tooltip layer — sits inside the scrollable grid so it tracks
            the diamond's position when the user pans. */}
        {activeLandmark && (
          <LandmarkTooltip
            landmark={activeLandmark.landmark}
            left={activeLandmark.left}
            top={activeLandmark.top}
            accent={colors.primary}
          />
        )}

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

interface LandmarkMarkerProps {
  landmark: WorldLandmark;
  position: { left: number; top: number };
  onShow:   () => void;
  onHide:   () => void;
}

function LandmarkMarker({ landmark, position, onShow, onHide }: LandmarkMarkerProps) {
  return (
    <div
      role="img"
      aria-label={landmark.name}
      onMouseEnter={onShow}
      onMouseLeave={onHide}
      onTouchStart={onShow}
      onTouchEnd={onHide}
      className="absolute flex items-center justify-center"
      style={{
        ...position,
        width:      CELL_PX,
        height:     CELL_PX,
        color:      MAP_LANDMARK,
        fontSize:   18,
        fontWeight: "bold",
        textShadow: `0 0 4px ${MAP_LANDMARK}`,
        cursor:     "help",
      }}
    >
      ◆
    </div>
  );
}

interface LandmarkTooltipProps {
  landmark: WorldLandmark;
  left:     number;
  top:      number;
  accent:   string;
}

function LandmarkTooltip({ landmark, left, top, accent }: LandmarkTooltipProps) {
  // Direction-3 aesthetic: dark backdrop, thin genre-primary border,
  // monospace text. Anchored above the diamond with a small triangular
  // arrow pointing down at the marker.
  return (
    <div
      role="tooltip"
      aria-live="polite"
      className="pointer-events-none absolute"
      style={{
        left:      left,
        top:       top - 8,
        transform: "translate(-50%, -100%)",
        zIndex:    50,
      }}
    >
      <div
        style={{
          minWidth:        160,
          maxWidth:        220,
          padding:         "6px 8px",
          backgroundColor: "color-mix(in srgb, var(--color-bg) 92%, #000)",
          border:          `1px solid color-mix(in srgb, ${accent} 60%, transparent)`,
          borderRadius:    4,
          fontFamily:      "var(--font-mono)",
          boxShadow:       "0 4px 12px rgba(0,0,0,0.6)",
        }}
      >
        <div
          style={{
            color:         accent,
            fontSize:      11,
            fontWeight:    700,
            letterSpacing: "0.04em",
            lineHeight:    1.2,
            marginBottom:  3,
          }}
        >
          {landmark.name}
        </div>
        <div
          style={{
            color:           "var(--color-muted)",
            fontSize:        10,
            lineHeight:      1.35,
            display:         "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow:        "hidden",
          }}
        >
          {landmark.public_description}
        </div>
      </div>
      {/* Down-pointing arrow */}
      <div
        aria-hidden
        style={{
          position:   "absolute",
          left:       "50%",
          bottom:     -5,
          transform:  "translateX(-50%) rotate(45deg)",
          width:      8,
          height:     8,
          backgroundColor: "color-mix(in srgb, var(--color-bg) 92%, #000)",
          borderRight: `1px solid color-mix(in srgb, ${accent} 60%, transparent)`,
          borderBottom: `1px solid color-mix(in srgb, ${accent} 60%, transparent)`,
        }}
      />
    </div>
  );
}
