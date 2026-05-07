"use client";

import React from "react";
import type { ExitEdge, RendererProps } from "./types";
import { VIEW } from "./types";

/**
 * DebugMap — diagnostic renderer that replaces the genre-themed
 * dispatcher while we sanity-check the WorldGraph layout pipeline.
 *
 * Renders a plain coordinate grid with node markers, names, raw
 * (x,y) coords, dashed connection lines, and exit labels distributed
 * around the four edges of the viewBox. The genre renderers
 * (FantasyMap / CyberMap / etc.) are untouched and ready to be
 * restored from index.tsx once map data is verified correct.
 *
 * Inputs are the same RendererProps shape every genre uses, so this
 * component is a drop-in for any of them.
 */

const PAD = 64;

const COLOR_CURRENT      = "#f59e0b";
const COLOR_DISCOVERED   = "#e8dfd1";
const COLOR_UNDISCOVERED = "#4a4339";
const COLOR_GRID         = "rgba(255,255,255,0.06)";
const COLOR_GRID_BOLD    = "rgba(255,255,255,0.12)";
const COLOR_BG           = "#0a0907";
const COLOR_INK          = "#a89e8c";
const COLOR_ACCENT       = "#f59e0b";

interface ExitWithEdge {
  targetId:   string;
  targetName: string;
  fromX:      number;
  fromY:      number;
  edge:       ExitEdge;
}

function classifyEdge(fromX: number, fromY: number): ExitEdge {
  if (fromX > VIEW * 0.6) return "right";
  if (fromX < VIEW * 0.4) return "left";
  if (fromY < VIEW * 0.4) return "top";
  if (fromY > VIEW * 0.6) return "bottom";
  return "right";
}

export function DebugMap({
  title, subtitle, nodes, connections, exits = [], onSelectNode, onSelectExit,
}: RendererProps) {
  // ── Grid lines ─────────────────────────────────────────────────────────────
  // Pull min/max of node screen-coords so the grid spans the same
  // region as the projected nodes. Falls back to the full viewBox
  // when there are no nodes (the empty-state placeholder still wants
  // a visible grid so the renderer doesn't read as a blank panel).
  const xs = nodes.map((n) => n.x);
  const ys = nodes.map((n) => n.y);
  const xMin = xs.length ? Math.min(...xs) : PAD;
  const xMax = xs.length ? Math.max(...xs) : VIEW - PAD;
  const yMin = ys.length ? Math.min(...ys) : PAD;
  const yMax = ys.length ? Math.max(...ys) : VIEW - PAD;

  const xStep = Math.max(8, (xMax - xMin) / 8);
  const yStep = Math.max(8, (yMax - yMin) / 8);
  const gridLines: React.ReactNode[] = [];
  for (let i = 0; i <= 8; i += 1) {
    const x = PAD + (i / 8) * (VIEW - PAD * 2);
    gridLines.push(
      <line key={`gx-${i}`}
        x1={x} y1={PAD} x2={x} y2={VIEW - PAD}
        stroke={i % 4 === 0 ? COLOR_GRID_BOLD : COLOR_GRID}
        strokeWidth={i % 4 === 0 ? 0.6 : 0.4} />
    );
  }
  for (let i = 0; i <= 8; i += 1) {
    const y = PAD + (i / 8) * (VIEW - PAD * 2);
    gridLines.push(
      <line key={`gy-${i}`}
        x1={PAD} y1={y} x2={VIEW - PAD} y2={y}
        stroke={i % 4 === 0 ? COLOR_GRID_BOLD : COLOR_GRID}
        strokeWidth={i % 4 === 0 ? 0.6 : 0.4} />
    );
  }
  void xStep; void yStep;

  // ── Connections ────────────────────────────────────────────────────────────
  // Drawn before nodes so circles overlap line endpoints cleanly.
  const connectionEls = connections.map((c, i) => (
    <line key={`c-${i}`}
      x1={c.fromX} y1={c.fromY} x2={c.toX} y2={c.toY}
      stroke={c.visited ? "rgba(232,223,209,0.5)" : "rgba(232,223,209,0.2)"}
      strokeWidth="0.8"
      strokeDasharray="3 3" />
  ));

  // ── Exits — distribute by edge ─────────────────────────────────────────────
  // Use the pre-computed edge from MapExit when present; classify on
  // the fly otherwise so an old caller without the edge field still
  // renders distributed labels.
  const exitsWithEdge: ExitWithEdge[] = exits.map((e) => ({
    targetId:   e.targetId,
    targetName: e.targetName,
    fromX:      e.fromX,
    fromY:      e.fromY,
    edge:       e.edge ?? classifyEdge(e.fromX, e.fromY),
  }));
  const byEdge: Record<ExitEdge, ExitWithEdge[]> = {
    left: [], right: [], top: [], bottom: [],
  };
  for (const e of exitsWithEdge) byEdge[e.edge].push(e);

  // Position labels along the edge they belong to, stacking siblings
  // on the perpendicular axis so they don't overlap.
  const exitEls: React.ReactNode[] = [];
  (Object.keys(byEdge) as ExitEdge[]).forEach((edge) => {
    const list = byEdge[edge];
    list.forEach((e, i) => {
      let x = 0, y = 0, anchor: "start" | "middle" | "end" = "start";
      const stride = 14;
      if (edge === "right") {
        x = VIEW - 6;
        y = PAD + 12 + i * stride;
        anchor = "end";
      } else if (edge === "left") {
        x = 6;
        y = PAD + 12 + i * stride;
        anchor = "start";
      } else if (edge === "top") {
        y = PAD - 8;
        x = PAD + 16 + i * (VIEW - PAD * 2 - 32) / Math.max(list.length, 1);
        anchor = "middle";
      } else {
        // bottom
        y = VIEW - 8;
        x = PAD + 16 + i * (VIEW - PAD * 2 - 32) / Math.max(list.length, 1);
        anchor = "middle";
      }
      const arrow = edge === "right" ? "→"
                  : edge === "left"  ? "←"
                  : edge === "top"   ? "↑"
                  : "↓";
      // The local-tier "Exit to Region" exit (Change 2) ships its
      // arrow inside targetName already; avoid double-prefixing.
      const hasArrow = /^[←→↑↓]/.test(e.targetName);
      const label = hasArrow
        ? e.targetName
        : edge === "right"
          ? `${e.targetName} ${arrow}`
          : edge === "left"
            ? `${arrow} ${e.targetName}`
            : `${arrow} ${e.targetName}`;
      exitEls.push(
        <text
          key={`exit-${edge}-${i}`}
          x={x}
          y={y}
          textAnchor={anchor}
          fontFamily="var(--mono)"
          fontSize="8"
          fill={COLOR_ACCENT}
          style={onSelectExit ? { cursor: "pointer" } : undefined}
          onClick={onSelectExit ? () => onSelectExit(e.targetId) : undefined}
        >
          {label}
        </text>
      );
    });
  });

  // ── Nodes ─────────────────────────────────────────────────────────────────
  const nodeEls = nodes.map((n) => {
    const fill = n.isCurrent ? COLOR_CURRENT
               : n.isDiscovered ? COLOR_DISCOVERED
               : COLOR_UNDISCOVERED;
    const labelFill = n.isCurrent ? COLOR_CURRENT
                    : n.isDiscovered ? COLOR_DISCOVERED
                    : COLOR_UNDISCOVERED;
    const coordFill = "rgba(168,158,140,0.7)";
    return (
      <g
        key={n.id}
        onClick={onSelectNode ? () => onSelectNode(n.id) : undefined}
        style={onSelectNode ? { cursor: "pointer" } : undefined}
      >
        {!n.isDiscovered && (
          <circle
            cx={n.x} cy={n.y} r="9"
            fill="none"
            stroke={COLOR_UNDISCOVERED}
            strokeWidth="0.8"
            strokeDasharray="2 2"
          />
        )}
        <circle
          cx={n.x} cy={n.y} r="6"
          fill={fill}
          stroke={n.isCurrent ? COLOR_CURRENT : "rgba(0,0,0,0.4)"}
          strokeWidth={n.isCurrent ? 1.5 : 0.6}
          opacity={n.isDiscovered ? 1 : 0.7}
        />
        <text
          x={n.x}
          y={n.y + 17}
          textAnchor="middle"
          fontFamily="var(--mono)"
          fontSize="8"
          fill={labelFill}
          opacity={n.isDiscovered ? 1 : 0.8}
        >
          {n.name}
        </text>
        <text
          x={n.x}
          y={n.y + 26}
          textAnchor="middle"
          fontFamily="var(--mono)"
          fontSize="6.5"
          fill={coordFill}
        >
          ({Math.round(n.x)}, {Math.round(n.y)})
        </text>
      </g>
    );
  });

  // ── Title bar ─────────────────────────────────────────────────────────────
  const titleEl = (
    <g>
      <text x={14} y={20}
        fontFamily="var(--mono)" fontSize="11"
        fill={COLOR_ACCENT} letterSpacing="2.5" fontWeight={600}>
        {title.toUpperCase()}
      </text>
      <text x={14} y={31}
        fontFamily="var(--mono)" fontSize="7"
        fill={COLOR_INK} letterSpacing="1.8">
        {subtitle} · {nodes.length} node{nodes.length === 1 ? "" : "s"}
      </text>
    </g>
  );

  // ── Legend ────────────────────────────────────────────────────────────────
  const legendEl = (
    <g>
      <text x={10} y={VIEW - 22}
        fontFamily="var(--mono)" fontSize="6.5"
        fill={COLOR_INK} letterSpacing="0.12em">
        <tspan fill={COLOR_CURRENT}>●</tspan>
        <tspan dx="3" fill={COLOR_INK}> current  </tspan>
        <tspan dx="2" fill={COLOR_DISCOVERED}>●</tspan>
        <tspan dx="3" fill={COLOR_INK}> known  </tspan>
        <tspan dx="2" fill={COLOR_UNDISCOVERED}>○</tspan>
        <tspan dx="3" fill={COLOR_INK}> unknown</tspan>
      </text>
    </g>
  );

  return (
    <svg
      viewBox={`0 0 ${VIEW} ${VIEW}`}
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid meet"
      style={{ display: "block", background: COLOR_BG }}
    >
      <rect x="0" y="0" width={VIEW} height={VIEW} fill={COLOR_BG} />
      {gridLines}
      <rect x={PAD} y={PAD}
        width={VIEW - PAD * 2} height={VIEW - PAD * 2}
        fill="none" stroke={COLOR_GRID_BOLD} strokeWidth="0.6" />
      {connectionEls}
      {nodeEls}
      {exitEls}
      {titleEl}
      {legendEl}
    </svg>
  );
}
