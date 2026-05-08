"use client";

import React from "react";
import { StarBacking } from "./primitives";
import type { RendererProps } from "./types";

/**
 * Space Opera genre map — starfield aesthetic ported from
 * /design/map-genres.jsx → SpaceWorld / SpaceRegion / SpaceLocal.
 *
 * Nodes render as ringed planet markers (World/Region) or rounded
 * deck-plan rectangles (Local). The current node carries the
 * accent-gradient glow.
 */

function SpaceHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <>
      <text x="14" y="22" fontFamily="var(--mono)" fontSize="11"
        fill="var(--accent)" letterSpacing="3" fontWeight="600">
        {title}
      </text>
      <text x="14" y="34" fontFamily="var(--mono)" fontSize="10"
        fill="var(--ink-4)" letterSpacing="2.5">
        {subtitle}
      </text>
    </>
  );
}

function Connections({ connections }: Pick<RendererProps, "connections">) {
  return (
    <g stroke="var(--accent)" strokeWidth="0.7" fill="none">
      {connections.map((c, i) => (
        <path
          key={i}
          d={`M ${c.fromX} ${c.fromY} Q ${(c.fromX + c.toX) / 2} ${(c.fromY + c.toY) / 2 - 12} ${c.toX} ${c.toY}`}
          opacity={c.visited ? 0.85 : 0.5}
          strokeDasharray={c.visited ? undefined : "2 3"}
        />
      ))}
    </g>
  );
}

function PlanetMarker({
  isCurrent, isDiscovered,
}: { isCurrent: boolean; isDiscovered: boolean }) {
  if (isCurrent) {
    return (
      <>
        <circle r="11" fill="none" stroke="var(--accent)"
          strokeWidth="0.5" strokeDasharray="2 2" />
        <circle r="9" fill="none" stroke="var(--accent)"
          strokeWidth="1.0"
          className="ew-pulse" style={{ transformOrigin: "center", transformBox: "fill-box" }} />
        <path d="M 0 -5 L 4 4 L 0 2 L -4 4 Z" fill="var(--accent)" />
      </>
    );
  }
  if (isDiscovered) {
    return (
      <>
        <ellipse cx="0" cy="0" rx="8" ry="2.5" fill="none"
          stroke="var(--accent)" strokeWidth="0.5" opacity="0.55"
          transform="rotate(-18)" />
        <circle r="3.5" fill="var(--accent)" />
      </>
    );
  }
  return (
    <>
      <circle r="3" fill="none" stroke="var(--ink-4)"
        strokeWidth="0.5" strokeDasharray="1.2 1.2" />
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
          <PlanetMarker isCurrent={n.isCurrent} isDiscovered={n.isDiscovered} />
          {n.isCurrent && (
            <text y="-15" textAnchor="middle" fontFamily="var(--mono)"
              fontSize="9" fill="var(--accent)" letterSpacing="2"
              fontWeight="600">
              ◇ YOU ARE HERE
            </text>
          )}
          <text y="18" textAnchor="middle" fontFamily="var(--mono)"
            fontSize="11"
            fill={n.isCurrent ? "var(--accent)"
                 : n.isDiscovered ? "var(--ink-1)" : "var(--ink-4)"}
            letterSpacing="1.2"
            fontWeight={n.isCurrent ? 700 : 500}>
            {n.isDiscovered ? n.name.toUpperCase() : "[UNCHARTED]"}
          </text>
          {npcMode && n.npcCount > 0 && (
            <>
              <circle cx="8" cy="-4" r="1.4" fill="var(--accent)" />
              <circle cx="8" cy="-4" r="3" fill="var(--accent)" opacity="0.3" />
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
            x={e.fromX + 12}
            y={e.fromY + i * 12}
            fontFamily="var(--mono)"
            fontSize="10"
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
  const cur = props.nodes.find((n) => n.isCurrent);
  return (
    <StarBacking>
      <SpaceHeader title={props.title} subtitle={props.subtitle} />
      {cur && (
        <circle cx={cur.x} cy={cur.y} r="34" fill="url(#sp-glow)" />
      )}
      <Connections connections={props.connections} />
      <Nodes
        nodes={props.nodes}
        npcMode={props.npcMode}
      />
      <Exits exits={props.exits} />
    </StarBacking>
  );
}

export function RegionMap(props: RendererProps) {
  const cur = props.nodes.find((n) => n.isCurrent);
  return (
    <StarBacking>
      <SpaceHeader title={props.title} subtitle={props.subtitle} />
      {cur && (
        <circle cx={cur.x} cy={cur.y} r="22" fill="url(#sp-glow)" />
      )}
      <ellipse cx="160" cy="350" rx="220" ry="180" fill="none"
        stroke="var(--accent)" strokeWidth="0.5" opacity="0.4" />
      <Connections connections={props.connections} />
      <Nodes
        nodes={props.nodes}
        npcMode={props.npcMode}
      />
      <Exits exits={props.exits} />
    </StarBacking>
  );
}

export function LocalMap(props: RendererProps) {
  const cur = props.nodes.find((n) => n.isCurrent);
  return (
    <StarBacking>
      <SpaceHeader title={props.title} subtitle={props.subtitle} />
      <rect x="42" y="62" width="246" height="220" rx="14" fill="none"
        stroke="var(--accent)" strokeWidth="0.5" opacity="0.5"
        strokeDasharray="3 3" />
      {cur && (
        <ellipse cx={cur.x} cy={cur.y} rx="30" ry="20" fill="url(#sp-glow)" />
      )}
      <Connections connections={props.connections} />

      {/* Local rooms render as rounded rectangles. */}
      {props.nodes.map((n) => {
        const w = 50, h = 28;
        return (
          <g
            key={n.id}
            transform={`translate(${n.x} ${n.y})`}
          >
            <title>{n.name}</title>
            {n.isCurrent && (
              <rect x={-w / 2 - 4} y={-h / 2 - 4} width={w + 8} height={h + 8}
                rx="3" fill="none" stroke="var(--accent)"
                strokeWidth="0.4" strokeDasharray="2 2"
                className="ew-pulse" style={{ transformOrigin: "center", transformBox: "fill-box" }} />
            )}
            <rect x={-w / 2} y={-h / 2} width={w} height={h} rx="3"
              fill={n.isCurrent ? "rgba(168,85,247,0.18)" : "rgba(20,15,30,0.7)"}
              stroke={n.isCurrent ? "var(--accent)"
                     : n.isDiscovered ? "var(--accent)" : "var(--ink-4)"}
              strokeWidth={n.isCurrent ? 1.1 : 0.7}
              strokeDasharray={n.isDiscovered || n.isCurrent ? undefined : "1.5 1.5"} />
            <text y="2" textAnchor="middle" fontFamily="var(--mono)"
              fontSize="11"
              fill={n.isCurrent ? "var(--accent)"
                   : n.isDiscovered ? "var(--ink-1)" : "var(--ink-4)"}
              letterSpacing="1"
              fontWeight={n.isCurrent ? 700 : 500}>
              {n.isDiscovered ? n.name.toUpperCase() : "[SEALED]"}
            </text>
            {props.npcMode && n.npcCount > 0 && (
              <>
                <circle cx={w / 2 - 4} cy={-h / 2 + 4} r="1.5" fill="var(--accent)" />
                <circle cx={w / 2 - 4} cy={-h / 2 + 4} r="3" fill="var(--accent)" opacity="0.3" />
              </>
            )}
          </g>
        );
      })}

      <Exits exits={props.exits} />
    </StarBacking>
  );
}
