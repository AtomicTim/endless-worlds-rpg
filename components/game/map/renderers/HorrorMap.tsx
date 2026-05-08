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
      <text x="14" y="26" fontFamily="var(--serif)" fontStyle="italic"
        fontSize="20" fill="var(--accent)" letterSpacing="2">
        {title}
      </text>
      <text x="14" y="44" fontFamily="var(--mono)" fontSize="13"
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
  nodes, npcMode,
}: Pick<RendererProps, "nodes" | "npcMode">) {
  return (
    <>
      {nodes.map((n) => {
        const stroke = !n.isDiscovered ? "var(--ink-4)" : "var(--accent)";
        return (
          <g
            key={n.id}
            transform={`translate(${n.x} ${n.y})`}
          >
            <title>{n.name}</title>
            {n.isCurrent ? (
              <>
                <circle r="28" fill="none" stroke="var(--accent)"
                  strokeWidth="0.5" strokeDasharray="1.5 2.5" />
                <circle r="18" fill="none" stroke="var(--accent)" strokeWidth="0.5" />
                <path d="M 0 -13 L 12 9 L -12 9 Z" fill="none"
                  stroke="var(--accent)" strokeWidth="0.9" />
                <ellipse rx="6.5" ry="3" fill="none"
                  stroke="var(--accent)" strokeWidth="0.9" />
                <circle r="1.6" fill="var(--accent)" />
                <circle r="8" fill="none" stroke="var(--accent)"
                  strokeWidth="0.8"
                  className="ew-pulse" style={{ transformOrigin: "center", transformBox: "fill-box" }} />
                <text y="-38" textAnchor="middle" fontFamily="var(--serif)"
                  fontStyle="italic" fontSize="14" fill="var(--accent)"
                  letterSpacing="2">
                  — here —
                </text>
              </>
            ) : (
              <path d="M 0 -10 L 0 8 M -4 -6 L 4 -6"
                stroke={stroke}
                strokeWidth={n.isDiscovered ? 1.6 : 1.1}
                strokeLinecap="round"
                strokeDasharray={n.isDiscovered ? undefined : "1.6 1.6"} />
            )}
            <text y={n.isCurrent ? 42 : 24} textAnchor="middle"
              fontFamily="var(--serif)" fontStyle="italic"
              fontSize={n.isCurrent ? 18 : 16}
              fill={n.isCurrent ? "var(--accent)"
                   : n.isDiscovered ? "var(--ink-1)" : "var(--ink-4)"}
              letterSpacing="0.8"
              fontWeight={n.isCurrent ? 500 : 400}
              textDecoration="none"
              style={{ textDecoration: "none", textDecorationLine: "none" }}>
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
  exits,
}: Pick<RendererProps, "exits">) {
  if (!exits || exits.length === 0) return null;
  return (
    <>
      {exits.map((e, i) => (
        <g key={`${e.targetId}-${i}`}>
          <text
            x={e.fromX + 14}
            y={e.fromY + i * 18}
            fontFamily="var(--serif)"
            fontStyle="italic"
            fontSize="14"
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
        npcMode={props.npcMode}
      />
      <Exits exits={props.exits} />
      <text x="14" y="300" fontFamily="var(--serif)" fontStyle="italic"
        fontSize="14" fill="var(--ink-4)" opacity="0.75" letterSpacing="0.4">
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
        npcMode={props.npcMode}
      />
      <Exits exits={props.exits} />
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
        npcMode={props.npcMode}
      />
      <Exits exits={props.exits} />
    </BlackInkBacking>
  );
}
