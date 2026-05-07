"use client";

import React from "react";
import { SalvageBacking } from "./primitives";
import type { RendererProps } from "./types";

/**
 * Post-Apocalyptic genre map — salvage-paper aesthetic ported from
 * /design/map-genres.jsx → ApocWorld / ApocRegion / ApocLocal.
 *
 * Nodes render as charcoal X marks on a stained-paper backing.
 * Dangerous categories (ruin, dungeon) get the failure color so the
 * player can spot them at a glance. Local tier draws building tents.
 */

function ApocHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <>
      <text x="14" y="22" fontFamily="var(--mono)" fontSize="11"
        fill="var(--accent)" letterSpacing="3" fontWeight="700">
        {title}
      </text>
      <text x="14" y="34" fontFamily="var(--mono)" fontSize="7"
        fill="var(--ink-4)" letterSpacing="2.5">
        {subtitle}
      </text>
    </>
  );
}

function isDanger(category?: string): boolean {
  return category === "ruin" || category === "dungeon";
}

function Connections({ connections }: Pick<RendererProps, "connections">) {
  return (
    <g stroke="var(--accent)" strokeWidth="1.0" fill="none"
      strokeDasharray="0.6 3" strokeLinecap="round" opacity="0.85">
      {connections.map((c, i) => (
        <path key={i} d={`M ${c.fromX} ${c.fromY} Q ${(c.fromX + c.toX) / 2} ${(c.fromY + c.toY) / 2 - 10} ${c.toX} ${c.toY}`}
          opacity={c.visited ? 0.85 : 0.4} />
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
        const danger = isDanger(n.category);
        const stroke = !n.isDiscovered ? "var(--ink-4)"
                     : danger ? "var(--hl-fail)" : "var(--accent)";
        return (
          <g
            key={n.id}
            transform={`translate(${n.x} ${n.y})`}
            onClick={onSelectNode ? () => onSelectNode(n.id) : undefined}
            style={onSelectNode ? { cursor: "pointer" } : undefined}
          >
            {n.isCurrent && (
              <circle r="8" fill="none" stroke="var(--accent)"
                strokeWidth="0.8"
                className="ew-pulse" style={{ transformOrigin: "center", transformBox: "fill-box" }} />
            )}
            <path d="M -3.5 -3.5 L 3.5 3.5 M -3.5 3.5 L 3.5 -3.5"
              stroke={stroke} strokeWidth={n.isCurrent ? 1.6 : 1.2}
              strokeLinecap="round" />
            {!n.isCurrent && (
              <circle r="5" fill="none" stroke={stroke}
                strokeWidth="0.6" opacity="0.7" />
            )}
            {n.isCurrent && (
              <text y="-12" textAnchor="middle" fontFamily="var(--mono)"
                fontSize="7" fill="var(--accent)" letterSpacing="2.5"
                fontWeight="700">
                ★ HERE ★
              </text>
            )}
            <text y="14" textAnchor="middle" fontFamily="var(--mono)"
              fontSize="7.5"
              fill={!n.isDiscovered ? "var(--ink-4)"
                   : n.isCurrent ? "var(--accent)"
                   : danger ? "var(--hl-fail)" : "var(--ink-1)"}
              letterSpacing="1"
              fontWeight={n.isCurrent ? 700 : 600}>
              {n.isDiscovered ? n.name.toUpperCase() : "▓▓▓▓▓▓"}
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
            fontFamily="var(--mono)"
            fontSize="7"
            fill="var(--accent)"
            letterSpacing="1.5"
            fontWeight="700"
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
    <SalvageBacking>
      <ApocHeader title={props.title} subtitle={props.subtitle} />
      <Connections connections={props.connections} />
      {cur && (
        <circle cx={cur.x} cy={cur.y} r="32" fill="url(#ap-glow)" />
      )}
      <Nodes
        nodes={props.nodes}
        onSelectNode={props.onSelectNode}
        npcMode={props.npcMode}
      />
      <Exits exits={props.exits} onSelectExit={props.onSelectExit} />
      <text x="14" y="298" fontFamily="var(--mono)" fontSize="6.5"
        fill="var(--ink-4)" letterSpacing="1.5" fontStyle="italic"
        opacity="0.75">
        ✱ don&apos;t take the river road past sundown
      </text>
    </SalvageBacking>
  );
}

export function RegionMap(props: RendererProps) {
  const cur = props.nodes.find((n) => n.isCurrent);
  return (
    <SalvageBacking>
      <ApocHeader title={props.title} subtitle={props.subtitle} />
      <Connections connections={props.connections} />
      {cur && (
        <circle cx={cur.x} cy={cur.y} r="26" fill="url(#ap-glow)" />
      )}
      <Nodes
        nodes={props.nodes}
        onSelectNode={props.onSelectNode}
        npcMode={props.npcMode}
      />
      <Exits exits={props.exits} onSelectExit={props.onSelectExit} />
    </SalvageBacking>
  );
}

export function LocalMap(props: RendererProps) {
  const cur = props.nodes.find((n) => n.isCurrent);
  return (
    <SalvageBacking>
      <ApocHeader title={props.title} subtitle={props.subtitle} />
      <path d="M 38 60 L 290 62 L 292 286 L 36 284 Z" fill="none"
        stroke="var(--accent)" strokeWidth="1.0" strokeDasharray="6 2"
        opacity="0.7" />
      <g stroke="var(--accent)" strokeWidth="0.7" fill="none"
        strokeDasharray="0.4 2.5" strokeLinecap="round" opacity="0.7">
        {props.connections.map((c, i) => (
          <path key={i} d={`M ${c.fromX} ${c.fromY} L ${c.toX} ${c.toY}`}
            opacity={c.visited ? 0.85 : 0.4} />
        ))}
      </g>
      {cur && (
        <circle cx={cur.x} cy={cur.y} r="22" fill="url(#ap-glow)" />
      )}

      {/* Local tier — building tents. */}
      {props.nodes.map((n) => (
        <g
          key={n.id}
          transform={`translate(${n.x} ${n.y})`}
          onClick={props.onSelectNode ? () => props.onSelectNode!(n.id) : undefined}
          style={props.onSelectNode ? { cursor: "pointer" } : undefined}
        >
          {n.isCurrent && (
            <circle r="11" fill="none" stroke="var(--accent)"
              strokeWidth="0.5" strokeDasharray="2 2"
              className="ew-pulse" style={{ transformOrigin: "center", transformBox: "fill-box" }} />
          )}
          <path d="M -5 4 L -5 -2 L -2 -5 L 5 -2 L 5 4 Z"
            fill={n.isCurrent ? "rgba(234,88,12,0.20)" : "rgba(15,12,8,0.85)"}
            stroke={n.isCurrent ? "var(--accent)"
                   : n.isDiscovered ? "var(--accent)" : "var(--ink-4)"}
            strokeWidth={n.isCurrent ? 1.2 : 0.7}
            strokeDasharray={n.isDiscovered || n.isCurrent ? undefined : "1.5 1.5"} />
          <text y="16" textAnchor="middle" fontFamily="var(--mono)"
            fontSize="7"
            fill={n.isCurrent ? "var(--accent)"
                 : n.isDiscovered ? "var(--ink-1)" : "var(--ink-4)"}
            letterSpacing="1"
            fontWeight={n.isCurrent ? 700 : 500}>
            {n.isDiscovered ? n.name.toUpperCase() : "▓▓▓▓"}
          </text>
          {props.npcMode && n.npcCount > 0 && (
            <>
              <circle cx="6" cy="-4" r="1.5" fill="var(--accent)" />
              <circle cx="6" cy="-4" r="3" fill="var(--accent)" opacity="0.3" />
            </>
          )}
        </g>
      ))}

      <Exits exits={props.exits} onSelectExit={props.onSelectExit} />
      {cur && (
        <text x={cur.x} y={cur.y - 22} textAnchor="middle"
          fontFamily="var(--mono)" fontSize="6.5" fill="var(--accent)"
          letterSpacing="2" fontWeight="700">
          ★ HERE ★
        </text>
      )}
    </SalvageBacking>
  );
}
