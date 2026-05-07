"use client";

import React from "react";
import {
  PaperBacking,
  FantasyNodeGlyph,
  TravelDots,
  PaperCompass,
} from "./primitives";
import type { RendererProps } from "./types";
import { VIEW } from "./types";

/**
 * Fantasy genre map — drawn paper aesthetic ported from
 * /design/map-v2.jsx → FantasyWorld / FantasyRegion / FantasyLocal.
 *
 * The design's static demo positions are replaced by data: the parent
 * (WorldMap.tsx) projects each WorldNode.map_position into the 320x320
 * viewBox and passes us the result via the `nodes` array. We render
 * each node with a paper-style glyph, plus dotted travel lines for
 * known connections, and italic place labels below.
 */

// Common header — title + subtitle in italic serif paper script.
function PaperHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <>
      <text x="14" y="22" fontFamily="var(--serif)" fontStyle="italic"
        fontSize="15" fill="#e8d8b0">
        {title}
      </text>
      <text x="14" y="34" fontFamily="var(--serif)" fontStyle="italic"
        fontSize="8" fill="#a08868" letterSpacing="1.5">
        {subtitle}
      </text>
    </>
  );
}

function CommonNodes({
  nodes, onSelectNode, npcMode,
}: Pick<RendererProps, "nodes" | "onSelectNode" | "npcMode">) {
  return (
    <>
      {nodes.map((n) => {
        const labelColor = n.isCurrent ? "#f59e0b"
                         : n.isDiscovered ? "#e8d8b0" : "#7a6850";
        return (
          <g
            key={n.id}
            onClick={onSelectNode ? () => onSelectNode(n.id) : undefined}
            style={onSelectNode ? { cursor: "pointer" } : undefined}
          >
            {n.isDiscovered ? (
              <FantasyNodeGlyph
                x={n.x} y={n.y}
                category={n.category}
                current={n.isCurrent}
              />
            ) : (
              <g transform={`translate(${n.x} ${n.y})`}>
                <circle r="4" fill="none" stroke="#7a6850"
                  strokeWidth="0.6" strokeDasharray="1.5 1.5" />
                <text y="2.5" textAnchor="middle"
                  fontFamily="var(--serif)" fontStyle="italic"
                  fontSize="6" fill="#7a6850">?</text>
              </g>
            )}
            <text
              x={n.x}
              y={n.y + 14}
              textAnchor="middle"
              fontFamily="var(--serif)"
              fontStyle="italic"
              fontSize="9"
              fill={labelColor}
              fontWeight={n.isCurrent ? 600 : 400}
            >
              {n.isDiscovered ? n.name : "—"}
            </text>
            {npcMode && n.npcCount > 0 && (
              <g transform={`translate(${n.x + 6} ${n.y - 5})`}>
                <circle r="1.4" fill="#f59e0b" />
                <circle r="2.8" fill="#f59e0b" opacity="0.3" />
              </g>
            )}
          </g>
        );
      })}
    </>
  );
}

function CommonConnections({
  connections,
}: Pick<RendererProps, "connections">) {
  return (
    <>
      {connections.map((c, i) => (
        <TravelDots
          key={i}
          d={`M ${c.fromX} ${c.fromY} L ${c.toX} ${c.toY}`}
          color={c.visited ? "#a08868" : "#5a4a38"}
        />
      ))}
    </>
  );
}

function CommonExits({
  exits, onSelectExit,
}: Pick<RendererProps, "exits" | "onSelectExit">) {
  if (!exits || exits.length === 0) return null;
  return (
    <>
      {exits.map((e, i) => (
        <g
          key={`${e.targetId}-${i}`}
          onClick={onSelectExit ? () => onSelectExit(e.targetId) : undefined}
          style={onSelectExit ? { cursor: "pointer" } : undefined}
        >
          <text
            x={e.fromX + 14}
            y={e.fromY + i * 10}
            fontFamily="var(--serif)"
            fontStyle="italic"
            fontSize="8"
            fill="#f59e0b"
          >
            → {e.targetName}
          </text>
        </g>
      ))}
    </>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// World tier — full continent with compass, ambient forest/mountains.
// ───────────────────────────────────────────────────────────────────────────

export function WorldMap(props: RendererProps) {
  return (
    <PaperBacking>
      <PaperHeader title={props.title} subtitle={props.subtitle} />
      <CommonConnections connections={props.connections} />
      <CommonNodes
        nodes={props.nodes}
        onSelectNode={props.onSelectNode}
        npcMode={props.npcMode}
      />
      <CommonExits exits={props.exits} onSelectExit={props.onSelectExit} />
      <PaperCompass x={290} y={290} r={14} />
    </PaperBacking>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Region tier — looser zoom over the geographic area.
// ───────────────────────────────────────────────────────────────────────────

export function RegionMap(props: RendererProps) {
  return (
    <PaperBacking>
      <PaperHeader title={props.title} subtitle={props.subtitle} />
      <CommonConnections connections={props.connections} />
      <CommonNodes
        nodes={props.nodes}
        onSelectNode={props.onSelectNode}
        npcMode={props.npcMode}
      />
      <CommonExits exits={props.exits} onSelectExit={props.onSelectExit} />
      <PaperCompass x={290} y={50} r={12} />
    </PaperBacking>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// DrawBuilding — building-type-specific glyph picker for the Local tier.
//
// Maps a node's `category` (a substring match against ambient_type
// keywords from lib/game/ambient-objects.ts) to a distinct paper-style
// SVG silhouette. Falls back to the generic two-house settlement shape
// when nothing matches.
// ───────────────────────────────────────────────────────────────────────────

function DrawBuilding({
  x, y, category, current, visited,
}: {
  x:        number;
  y:        number;
  category?: string;
  current:  boolean;
  visited:  boolean;
}) {
  const stroke = current ? "#f59e0b" : visited ? "#e8d8b0" : "#7a6850";
  const fill   = "#14110c";
  const cat    = (category ?? "").toLowerCase();

  const isInn     = cat.includes("tavern")  || cat.includes("inn") ||
                    cat.includes("rest")    || cat.includes("alehouse");
  const isForge   = cat.includes("smithy")  || cat.includes("forge") ||
                    cat.includes("smith");
  const isMarket  = cat.includes("market")  || cat.includes("merchant") ||
                    cat.includes("trade")   || cat.includes("provision") ||
                    cat.includes("shop")    || cat.includes("stall") ||
                    cat.includes("ledger");
  const isShrine  = cat.includes("temple")  || cat.includes("shrine") ||
                    cat.includes("chapel")  || cat.includes("altar") ||
                    cat.includes("church")  || cat.includes("holy");
  const isGuild   = cat.includes("guild")   || cat.includes("hall") ||
                    cat.includes("garrison")|| cat.includes("barracks") ||
                    cat.includes("keep")    || cat.includes("warden");
  const isWell    = cat.includes("well")    || cat.includes("fountain") ||
                    cat.includes("water")   || cat.includes("pump");
  const isStable  = cat.includes("stable")  || cat.includes("stables");
  const isDungeon = cat.includes("dungeon") || cat.includes("ruin") ||
                    cat.includes("vault")   || cat.includes("barrow") ||
                    cat.includes("corridor")|| cat.includes("chamber") ||
                    cat.includes("crypt")   || cat.includes("tomb");

  const glyph = isInn ? (
    <g stroke={stroke} strokeWidth="1" fill={fill} strokeLinejoin="round">
      <rect x="-9" y="-3" width="18" height="9" />
      <path d="M -10 -3 L 0 -10 L 10 -3" />
      <path d="M -4 6 L -4 0 L -1 0 L -1 6"
        stroke={stroke} strokeWidth="0.5" fill="none" />
    </g>
  ) : isForge ? (
    <g stroke={stroke} strokeWidth="1" fill={fill} strokeLinejoin="round">
      <rect x="-7" y="-2" width="14" height="8" />
      <path d="M -8 -2 L 0 -8 L 8 -2" />
      <path d="M 3 -8 L 3 -11 M 5 -8 L 5 -11"
        stroke={stroke} strokeWidth="0.5" />
      <path d="M 4 -11 q -2 -2 0 -4 q 2 -2 0 -4"
        stroke={stroke} strokeWidth="0.4" fill="none" opacity="0.6" />
    </g>
  ) : isMarket ? (
    <g stroke={stroke} strokeWidth="1" fill={fill} strokeLinejoin="round">
      <path d="M -10 -2 L 10 -2 L 10 5 L -10 5 Z" />
      <path d="M -11 -2 L -8 -6 L 8 -6 L 11 -2" />
      <path d="M -5 5 L -5 -2 M 0 5 L 0 -2 M 5 5 L 5 -2"
        stroke={stroke} strokeWidth="0.5" />
    </g>
  ) : isShrine ? (
    <g stroke={stroke} strokeWidth="1" fill={fill} strokeLinejoin="round">
      <path d="M -6 6 L -6 -2 Q -6 -8 0 -8 Q 6 -8 6 -2 L 6 6" />
      <path d="M -2 6 L -2 -2 L 2 -2 L 2 6" />
    </g>
  ) : isGuild ? (
    <g stroke={stroke} strokeWidth="1" fill={fill} strokeLinejoin="round">
      <path d="M -8 6 L -8 -2 L -6 -2 L -6 -4 L -3 -4 L -3 -2 L 3 -2 L 3 -4 L 6 -4 L 6 -2 L 8 -2 L 8 6 Z" />
      <path d="M -2 6 L -2 0 L 2 0 L 2 6"
        stroke={stroke} strokeWidth="0.5" fill="none" />
    </g>
  ) : isWell ? (
    <g stroke={stroke} strokeWidth="1" fill={fill}>
      <ellipse cx="0" cy="2" rx="4" ry="1.5" />
      <path d="M -4 2 L -4 -1 L 4 -1 L 4 2" />
      <path d="M -5 -1 L -3 -5 L 3 -5 L 5 -1" />
    </g>
  ) : isStable ? (
    <g stroke={stroke} strokeWidth="1" fill={fill} strokeLinejoin="round">
      <rect x="-8" y="-2" width="16" height="7" />
      <path d="M -9 -2 L 0 -7 L 9 -2" />
      <path d="M -3 5 L -3 -2 M 3 5 L 3 -2"
        stroke={stroke} strokeWidth="0.5" />
    </g>
  ) : isDungeon ? (
    <g stroke={stroke} strokeWidth="0.8" fill={fill} strokeLinejoin="round">
      <path d="M -4 3 L -3 -3 L -1 -4 L 0 -1 L 2 -5 L 3 1 L 4 3 Z" />
    </g>
  ) : (
    // Default: generic two-house settlement glyph.
    <g stroke={stroke} strokeWidth="0.9" fill={fill} strokeLinejoin="round">
      <path d="M -4 1 L -4 -2 L -2 -4 L 0 -2 L 0 1 Z" />
      <path d="M 0 1 L 0 -1 L 2 -3 L 4 -1 L 4 1 Z" />
    </g>
  );

  return (
    <g transform={`translate(${x} ${y})`}>
      {current && (
        <>
          <circle r="18" fill="rgba(245,158,11,0.10)" />
          <circle r="14" fill="none" stroke="#f59e0b" strokeWidth="0.5"
            strokeDasharray="2 2"
            className="ew-pulse"
            style={{ transformOrigin: "center", transformBox: "fill-box" }}
          />
        </>
      )}
      {glyph}
    </g>
  );
}

// Edge-anchored exit labels — rendered for the Local tier so the
// player can see which way the gates open without crowding the
// settlement glyphs themselves.
function LocalExits({
  exits, onSelectExit,
}: Pick<RendererProps, "exits" | "onSelectExit">) {
  if (!exits || exits.length === 0) return null;
  // Bucket exits by direction (left = source on the left half of the
  // viewBox). When two exits share a side, stagger them vertically so
  // labels don't overlap.
  const lefts:  Array<NonNullable<RendererProps["exits"]>[number]> = [];
  const rights: Array<NonNullable<RendererProps["exits"]>[number]> = [];
  for (const e of exits) {
    if (e.fromX < VIEW / 2) lefts.push(e); else rights.push(e);
  }
  return (
    <>
      {lefts.map((e, i) => (
        <g
          key={`exL-${e.targetId}-${i}`}
          onClick={onSelectExit ? () => onSelectExit(e.targetId) : undefined}
          style={onSelectExit ? { cursor: "pointer" } : undefined}
        >
          <text
            x={14}
            y={170 + i * 12}
            textAnchor="start"
            fontFamily="var(--serif)"
            fontStyle="italic"
            fontSize="9"
            fill="#f59e0b"
          >
            ← {e.targetName}
          </text>
        </g>
      ))}
      {rights.map((e, i) => (
        <g
          key={`exR-${e.targetId}-${i}`}
          onClick={onSelectExit ? () => onSelectExit(e.targetId) : undefined}
          style={onSelectExit ? { cursor: "pointer" } : undefined}
        >
          <text
            x={VIEW - 14}
            y={170 + i * 12}
            textAnchor="end"
            fontFamily="var(--serif)"
            fontStyle="italic"
            fontSize="9"
            fill="#f59e0b"
          >
            {e.targetName} →
          </text>
        </g>
      ))}
    </>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Local tier — settlement layout with road dashes between buildings.
// ───────────────────────────────────────────────────────────────────────────

export function LocalMap(props: RendererProps) {
  return (
    <PaperBacking>
      <PaperHeader title={props.title} subtitle={props.subtitle} />
      <path
        d="M 38 70 Q 40 58 80 56 Q 160 50 240 58 Q 285 64 290 110 Q 295 200 285 255 Q 270 285 200 285 Q 100 290 50 280 Q 25 250 30 180 Q 30 90 38 70 Z"
        fill="none"
        stroke="#a08868"
        strokeWidth="0.8"
        strokeDasharray="4 2 1 2"
        opacity="0.7"
      />
      {/* Roads under the dotted travel lines for visual depth. */}
      <g stroke="#3d3528" strokeWidth="6" fill="none" opacity="0.6"
        strokeLinecap="round">
        {props.connections.map((c, i) => (
          <path key={i} d={`M ${c.fromX} ${c.fromY} L ${c.toX} ${c.toY}`} />
        ))}
      </g>
      <CommonConnections connections={props.connections} />

      {/* Building-type-specific glyph per node. */}
      {props.nodes.map((n) => {
        const labelColor = n.isCurrent ? "#f59e0b"
                         : n.isDiscovered ? "#e8d8b0" : "#7a6850";
        return (
          <g
            key={n.id}
            onClick={props.onSelectNode ? () => props.onSelectNode!(n.id) : undefined}
            style={props.onSelectNode ? { cursor: "pointer" } : undefined}
          >
            {n.isDiscovered ? (
              <DrawBuilding
                x={n.x}
                y={n.y}
                category={n.category}
                current={n.isCurrent}
                visited={n.isDiscovered}
              />
            ) : (
              <g transform={`translate(${n.x} ${n.y})`}>
                <rect x="-4" y="-3" width="8" height="6"
                  fill="none" stroke="#7a6850"
                  strokeWidth="0.6" strokeDasharray="1.5 1.5" />
              </g>
            )}
            <text
              x={n.x}
              y={n.y + 16}
              textAnchor="middle"
              fontFamily="var(--serif)"
              fontStyle="italic"
              fontSize="9"
              fill={labelColor}
              fontWeight={n.isCurrent ? 600 : 400}
            >
              {n.isDiscovered ? n.name : "—"}
            </text>
            {props.npcMode && n.npcCount > 0 && (
              <g transform={`translate(${n.x + 7} ${n.y - 6})`}>
                <circle r="1.4" fill="#f59e0b" />
                <circle r="2.8" fill="#f59e0b" opacity="0.3" />
              </g>
            )}
          </g>
        );
      })}

      <LocalExits exits={props.exits} onSelectExit={props.onSelectExit} />
    </PaperBacking>
  );
}
