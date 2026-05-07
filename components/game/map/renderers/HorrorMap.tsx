"use client";

import React from "react";
import { BlackInkBacking } from "./primitives";
import type { RendererProps } from "./types";

/**
 * Horror genre map — black ink aesthetic ported from
 * /design/map-genres.jsx → HorrorWorld / HorrorRegion / HorrorLocal.
 *
 * Sparse t-shaped daggers replace cleanly-drawn glyphs; the current
 * node carries the design's unsettling concentric-ring "eye" motif.
 * Italic serif labels read like passages from a parish chronicle.
 */

function HorrorHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <>
      <text x="14" y="22" fontFamily="var(--serif)" fontStyle="italic"
        fontSize="14" fill="var(--accent)" letterSpacing="2">
        {title}
      </text>
      <text x="14" y="34" fontFamily="var(--mono)" fontSize="7"
        fill="var(--ink-4)" letterSpacing="2.5">
        {subtitle}
      </text>
    </>
  );
}

function Connections({ connections }: Pick<RendererProps, "connections">) {
  return (
    <g stroke="var(--accent)" strokeWidth="0.6" fill="none" opacity="0.55">
      {connections.map((c, i) => (
        <path
          key={i}
          d={`M ${c.fromX} ${c.fromY} C ${(c.fromX + c.toX) / 2} ${c.fromY + 8} ${(c.fromX + c.toX) / 2} ${c.toY - 8} ${c.toX} ${c.toY}`}
          strokeDasharray={c.visited ? "3 1.5" : "2 2"}
          opacity={c.visited ? 0.85 : 0.4}
        />
      ))}
    </g>
  );
}

function Nodes({
  nodes, onSelectNode, npcMode,
}: Pick<RendererProps, "nodes" | "onSelectNode" | "npcMode">) {
  return (
    <>
      {nodes.map((n) => {
        const stroke = !n.isDiscovered ? "var(--ink-4)" : "var(--accent)";
        return (
          <g
            key={n.id}
            transform={`translate(${n.x} ${n.y})`}
            onClick={onSelectNode ? () => onSelectNode(n.id) : undefined}
            style={onSelectNode ? { cursor: "pointer" } : undefined}
          >
            {n.isCurrent ? (
              <>
                <circle r="22" fill="none" stroke="var(--accent)"
                  strokeWidth="0.4" strokeDasharray="1 2" />
                <circle r="14" fill="none" stroke="var(--accent)" strokeWidth="0.4" />
                <path d="M 0 -10 L 9 7 L -9 7 Z" fill="none"
                  stroke="var(--accent)" strokeWidth="0.7" />
                <ellipse rx="5" ry="2.4" fill="none"
                  stroke="var(--accent)" strokeWidth="0.7" />
                <circle r="1.2" fill="var(--accent)" />
                <circle r="6" fill="none" stroke="var(--accent)"
                  strokeWidth="0.6"
                  className="ew-pulse" style={{ transformOrigin: "center", transformBox: "fill-box" }} />
                <text y="-30" textAnchor="middle" fontFamily="var(--serif)"
                  fontStyle="italic" fontSize="11" fill="var(--accent)"
                  letterSpacing="2">
                  — here —
                </text>
              </>
            ) : (
              <path d="M 0 -5 L 0 4 M -2 -3 L 2 -3"
                stroke={stroke}
                strokeWidth={n.isDiscovered ? 1.0 : 0.7}
                strokeLinecap="round"
                strokeDasharray={n.isDiscovered ? undefined : "1.2 1.2"} />
            )}
            <text y={n.isCurrent ? 30 : 14} textAnchor="middle"
              fontFamily="var(--serif)" fontStyle="italic"
              fontSize={n.isCurrent ? 13 : 10.5}
              fill={n.isCurrent ? "var(--accent)"
                   : n.isDiscovered ? "var(--ink-1)" : "var(--ink-4)"}
              letterSpacing="0.8"
              fontWeight={n.isCurrent ? 500 : 400}>
              {n.isDiscovered ? n.name : "—"}
            </text>
            {npcMode && n.npcCount > 0 && (
              <>
                <circle cx="6" cy="-4" r="1.4" fill="var(--accent)" />
                <circle cx="6" cy="-4" r="3" fill="var(--accent)" opacity="0.3" />
              </>
            )}
          </g>
        );
      })}
    </>
  );
}

function Exits({
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
            x={e.fromX + 12}
            y={e.fromY + i * 10}
            fontFamily="var(--serif)"
            fontStyle="italic"
            fontSize="10"
            fill="var(--accent)"
          >
            → {e.targetName}
          </text>
        </g>
      ))}
    </>
  );
}

// ───────────────────────────────────────────────────────────────────────────

export function WorldMap(props: RendererProps) {
  const cur = props.nodes.find((n) => n.isCurrent);
  return (
    <BlackInkBacking>
      <HorrorHeader title={props.title} subtitle={props.subtitle} />
      <Connections connections={props.connections} />
      {cur && (
        <circle cx={cur.x} cy={cur.y} r="30" fill="url(#ho-glow)" />
      )}
      <Nodes
        nodes={props.nodes}
        onSelectNode={props.onSelectNode}
        npcMode={props.npcMode}
      />
      <Exits exits={props.exits} onSelectExit={props.onSelectExit} />
      <text x="14" y="300" fontFamily="var(--serif)" fontStyle="italic"
        fontSize="9.5" fill="var(--ink-4)" opacity="0.75" letterSpacing="0.4">
        the eye opens at the dark of the moon
      </text>
    </BlackInkBacking>
  );
}

export function RegionMap(props: RendererProps) {
  const cur = props.nodes.find((n) => n.isCurrent);
  return (
    <BlackInkBacking>
      <HorrorHeader title={props.title} subtitle={props.subtitle} />
      <Connections connections={props.connections} />
      {cur && (
        <circle cx={cur.x} cy={cur.y} r="26" fill="url(#ho-glow)" />
      )}
      <Nodes
        nodes={props.nodes}
        onSelectNode={props.onSelectNode}
        npcMode={props.npcMode}
      />
      <Exits exits={props.exits} onSelectExit={props.onSelectExit} />
    </BlackInkBacking>
  );
}

export function LocalMap(props: RendererProps) {
  const cur = props.nodes.find((n) => n.isCurrent);
  return (
    <BlackInkBacking>
      <HorrorHeader title={props.title} subtitle={props.subtitle} />
      <path d="M 40 62 L 288 60 L 292 286 L 38 284 Z" fill="none"
        stroke="var(--accent)" strokeWidth="0.7" strokeDasharray="2 3" opacity="0.55" />
      <Connections connections={props.connections} />
      {cur && (
        <circle cx={cur.x} cy={cur.y} r="22" fill="url(#ho-glow)" />
      )}
      <Nodes
        nodes={props.nodes}
        onSelectNode={props.onSelectNode}
        npcMode={props.npcMode}
      />
      <Exits exits={props.exits} onSelectExit={props.onSelectExit} />
    </BlackInkBacking>
  );
}
