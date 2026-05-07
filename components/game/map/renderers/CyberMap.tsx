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
      <text x="14" y="22" fontFamily="var(--mono)" fontSize="11"
        fill="var(--accent)" letterSpacing="3" fontWeight="600">
        {title}
      </text>
      <text x="14" y="34" fontFamily="var(--mono)" fontSize="7"
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
  nodes, onSelectNode, npcMode,
}: Pick<RendererProps, "nodes" | "onSelectNode" | "npcMode">) {
  return (
    <>
      {nodes.map((n) => (
        <g
          key={n.id}
          transform={`translate(${n.x} ${n.y})`}
          onClick={onSelectNode ? () => onSelectNode(n.id) : undefined}
          style={onSelectNode ? { cursor: "pointer" } : undefined}
        >
          {n.isCurrent && (
            <>
              <rect x="-7" y="-7" width="14" height="14" fill="none"
                stroke="var(--accent)" strokeWidth="0.4" strokeDasharray="2 2" />
              <rect x="-5" y="-5" width="10" height="10" fill="none"
                stroke="var(--accent)" strokeWidth="1.1"
                className="ew-pulse" style={{ transformOrigin: "center", transformBox: "fill-box" }} />
            </>
          )}
          {n.isDiscovered ? (
            <>
              <rect x="-3" y="-3" width="6" height="6"
                fill={n.isCurrent ? "var(--accent)" : "var(--bg-0)"}
                stroke="var(--accent)" strokeWidth="0.8" />
              {!n.isCurrent && (
                <rect x="-1.5" y="-1.5" width="3" height="3" fill="var(--accent)" />
              )}
            </>
          ) : (
            <rect x="-3" y="-3" width="6" height="6" fill="none"
              stroke="var(--ink-4)" strokeWidth="0.6" strokeDasharray="1.5 1.5" />
          )}
          <text
            y="14"
            textAnchor="middle"
            fontFamily="var(--mono)"
            fontSize="7"
            fill={n.isCurrent ? "var(--accent)"
                 : n.isDiscovered ? "var(--ink-1)" : "var(--ink-4)"}
            letterSpacing="1.2"
            fontWeight={n.isCurrent ? 700 : 500}
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
            fontFamily="var(--mono)"
            fontSize="7"
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
        onSelectNode={props.onSelectNode}
        npcMode={props.npcMode}
      />
      <Exits exits={props.exits} onSelectExit={props.onSelectExit} />
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
        onSelectNode={props.onSelectNode}
        npcMode={props.npcMode}
      />
      <Exits exits={props.exits} onSelectExit={props.onSelectExit} />
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
        onSelectNode={props.onSelectNode}
        npcMode={props.npcMode}
      />
      <Exits exits={props.exits} onSelectExit={props.onSelectExit} />
    </InkBacking>
  );
}
