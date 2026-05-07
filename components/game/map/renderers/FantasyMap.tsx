"use client";

import React from "react";
import {
  PaperBacking,
  FantasyNodeGlyph,
  TownGlyph,
  TravelDots,
  PaperCompass,
} from "./primitives";
import type { RendererProps } from "./types";

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

      {/* Use TownGlyph for everything in a settlement plan since we're
          showing buildings, not landmarks. */}
      {props.nodes.map((n) => {
        const labelColor = n.isCurrent ? "#f59e0b"
                         : n.isDiscovered ? "#e8d8b0" : "#7a6850";
        return (
          <g
            key={n.id}
            onClick={props.onSelectNode ? () => props.onSelectNode!(n.id) : undefined}
            style={props.onSelectNode ? { cursor: "pointer" } : undefined}
          >
            {n.isDiscovered
              ? <TownGlyph x={n.x} y={n.y} current={n.isCurrent} />
              : (
                <g transform={`translate(${n.x} ${n.y})`}>
                  <rect x="-4" y="-3" width="8" height="6"
                    fill="none" stroke="#7a6850"
                    strokeWidth="0.6" strokeDasharray="1.5 1.5" />
                </g>
              )
            }
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
            {props.npcMode && n.npcCount > 0 && (
              <g transform={`translate(${n.x + 6} ${n.y - 5})`}>
                <circle r="1.4" fill="#f59e0b" />
                <circle r="2.8" fill="#f59e0b" opacity="0.3" />
              </g>
            )}
          </g>
        );
      })}

      <CommonExits exits={props.exits} onSelectExit={props.onSelectExit} />
    </PaperBacking>
  );
}
