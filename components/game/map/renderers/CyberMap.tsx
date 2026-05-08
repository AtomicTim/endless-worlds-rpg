"use client";

import React from "react";
import { InkBacking } from "./primitives";
import type { RendererProps } from "./types";

/**
 * Cyberpunk genre map — circuit/grid aesthetic ported from
 * /design/map-v2.jsx → CyberWorld / CyberRegion / CyberLocal.
 *
 * Each WorldNode renders as a fillable cyan square with the name
 * stamped underneath in monospace small-caps. Connections render as
 * solid neon lines (visited) or dashed lines (uncharted).
 */

function InkHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <>
      <text x="14" y="26" fontFamily="var(--mono)" fontSize="16"
        fill="var(--accent)" letterSpacing="3" fontWeight="600">
        {title}
      </text>
      <text x="14" y="44" fontFamily="var(--mono)" fontSize="13"
        fill="var(--ink-4)" letterSpacing="2.5">
        {subtitle}
      </text>
      {/* Corner brackets — the design's screen-frame motif. */}
      <g stroke="var(--accent)" strokeWidth="0.6" fill="none" opacity="0.5">
        <path d="M 8 50 L 8 60 L 18 60" />
        <path d="M 312 50 L 312 60 L 302 60" />
        <path d="M 8 310 L 8 300 L 18 300" />
        <path d="M 312 310 L 312 300 L 302 300" />
      </g>
    </>
  );
}

function Connections({ connections }: Pick<RendererProps, "connections">) {
  return (
    <>
      <g stroke="var(--accent)" strokeWidth="0.8" fill="none" opacity="0.85">
        {connections.filter((c) => c.visited).map((c, i) => (
          <path key={`v-${i}`} d={`M ${c.fromX} ${c.fromY} L ${c.toX} ${c.toY}`} />
        ))}
      </g>
      <g stroke="var(--ink-4)" strokeWidth="0.6" fill="none"
        strokeDasharray="2 2" opacity="0.6">
        {connections.filter((c) => !c.visited).map((c, i) => (
          <path key={`u-${i}`} d={`M ${c.fromX} ${c.fromY} L ${c.toX} ${c.toY}`} />
        ))}
      </g>
    </>
  );
}

function Nodes({
  nodes, npcMode,
}: Pick<RendererProps, "nodes" | "npcMode">) {
  return (
    <>
      {nodes.map((n) => (
        <g
          key={n.id}
          transform={`translate(${n.x} ${n.y})`}
        >
          <title>{n.name}</title>
          {n.isCurrent && (
            <>
              <rect x="-13" y="-13" width="26" height="26" fill="none"
                stroke="var(--accent)" strokeWidth="0.5" strokeDasharray="2 2" />
              <rect x="-10" y="-10" width="20" height="20" fill="none"
                stroke="var(--accent)" strokeWidth="1.4"
                className="ew-pulse" style={{ transformOrigin: "center", transformBox: "fill-box" }} />
            </>
          )}
          {n.isDiscovered ? (
            <>
              <rect x="-7" y="-7" width="14" height="14"
                fill={n.isCurrent ? "var(--accent)" : "var(--bg-0)"}
                stroke="var(--accent)" strokeWidth="1.0" />
              {!n.isCurrent && (
                <rect x="-3" y="-3" width="6" height="6" fill="var(--accent)" />
              )}
            </>
          ) : (
            <rect x="-6" y="-6" width="12" height="12" fill="none"
              stroke="var(--ink-4)" strokeWidth="0.8" strokeDasharray="2 2" />
          )}
          <text
            y="26"
            textAnchor="middle"
            fontFamily="var(--mono)"
            fontSize="16"
            fill={n.isCurrent ? "var(--accent)"
                 : n.isDiscovered ? "var(--ink-1)" : "var(--ink-4)"}
            letterSpacing="1.2"
            fontWeight={n.isCurrent ? 700 : 500}
            textDecoration="none"
            style={{ textDecoration: "none", textDecorationLine: "none" }}
          >
            {n.isDiscovered ? n.name.toUpperCase() : "[NO_DATA]"}
          </text>
          {npcMode && n.npcCount > 0 && (
            <>
              <circle cx="6" cy="-4" r="1.4" fill="var(--accent)" />
              <circle cx="6" cy="-4" r="3" fill="var(--accent)" opacity="0.3" />
            </>
          )}
        </g>
      ))}
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
            fontFamily="var(--mono)"
            fontSize="14"
            fill="var(--accent)"
            letterSpacing="1"
          >
            → {e.targetName.toUpperCase()}
          </text>
        </g>
      ))}
    </>
  );
}

// ───────────────────────────────────────────────────────────────────────────

export function WorldMap(props: RendererProps) {
  // Find the current node so the central glow anchors to it.
  const cur = props.nodes.find((n) => n.isCurrent);
  return (
    <InkBacking>
      <InkHeader title={props.title} subtitle={props.subtitle} />
      {cur && (
        <circle cx={cur.x} cy={cur.y} r="40" fill="url(#cy-cyber-glow)" />
      )}
      <Connections connections={props.connections} />
      <Nodes
        nodes={props.nodes}
        npcMode={props.npcMode}
      />
      <Exits exits={props.exits} />
    </InkBacking>
  );
}

export function RegionMap(props: RendererProps) {
  const cur = props.nodes.find((n) => n.isCurrent);
  return (
    <InkBacking>
      <InkHeader title={props.title} subtitle={props.subtitle} />
      {cur && (
        <circle cx={cur.x} cy={cur.y} r="40" fill="url(#cy-cyber-glow)" />
      )}
      <Connections connections={props.connections} />
      <Nodes
        nodes={props.nodes}
        npcMode={props.npcMode}
      />
      <Exits exits={props.exits} />
    </InkBacking>
  );
}

export function LocalMap(props: RendererProps) {
  const cur = props.nodes.find((n) => n.isCurrent);
  return (
    <InkBacking>
      <InkHeader title={props.title} subtitle={props.subtitle} />
      <rect x="38" y="60" width="252" height="225" fill="none"
        stroke="var(--ink-4)" strokeWidth="0.5" strokeDasharray="3 3" opacity="0.6" />
      {cur && (
        <circle cx={cur.x} cy={cur.y} r="22" fill="url(#cy-cyber-glow)" />
      )}
      <Connections connections={props.connections} />
      <Nodes
        nodes={props.nodes}
        npcMode={props.npcMode}
      />
      <Exits exits={props.exits} />
    </InkBacking>
  );
}
