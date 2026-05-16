"use client";

import React, { useEffect, useRef } from "react";
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
      <text x="14" y="26" fontFamily="var(--serif)" fontStyle="italic"
        fontSize="22" fill="#e8d8b0">
        {title}
      </text>
      <text x="14" y="44" fontFamily="var(--serif)" fontStyle="italic"
        fontSize="13" fill="#a08868" letterSpacing="1.5">
        {subtitle}
      </text>
    </>
  );
}

function CommonNodes({
  nodes, npcMode,
}: Pick<RendererProps, "nodes" | "npcMode">) {
  return (
    <>
      {nodes.map((n) => {
        const labelColor = n.isCurrent ? "#f59e0b"
                         : n.isDiscovered ? "#e8d8b0" : "#7a6850";
        return (
          <g key={n.id}>
            <title>{n.name}</title>
            {n.isDiscovered ? (
              <FantasyNodeGlyph
                x={n.x} y={n.y}
                category={n.category}
                current={n.isCurrent}
              />
            ) : (
              <g transform={`translate(${n.x} ${n.y})`}>
                <circle r="11" fill="none" stroke="#7a6850"
                  strokeWidth="0.8" strokeDasharray="2 2" />
                {/* FIX B2 — strip every flavor of underline that could be
                    inherited by an SVG <text>: SVG attribute, CSS prop,
                    and the explicit text-decoration-line override that
                    some browsers respect when the legacy attribute
                    fights the style block. Map glyphs must NEVER look
                    underlined — only in-prose location highlights do. */}
                <text y="4" textAnchor="middle"
                  fontFamily="var(--serif)" fontStyle="italic"
                  fontSize="14" fill="#7a6850"
                  textDecoration="none"
                  style={{ textDecoration: "none", textDecorationLine: "none" }}>?</text>
              </g>
            )}
            <text
              x={n.x}
              y={n.y + 22}
              textAnchor="middle"
              fontFamily="var(--serif)"
              fontStyle="italic"
              fontSize="18"
              fill={labelColor}
              fontWeight={n.isCurrent ? 600 : 400}
              textDecoration="none"
              style={{ textDecoration: "none", textDecorationLine: "none" }}
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
  exits,
}: Pick<RendererProps, "exits">) {
  if (!exits || exits.length === 0) return null;
  return (
    <>
      {exits.map((e, i) => (
        <g key={`${e.targetId}-${i}`}>
          <text
            x={e.fromX + 14}
            y={e.fromY + i * 16}
            fontFamily="var(--serif)"
            fontStyle="italic"
            fontSize="14"
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
        npcMode={props.npcMode}
      />
      <CommonExits exits={props.exits} />
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
        npcMode={props.npcMode}
      />
      <CommonExits exits={props.exits} />
      <PaperCompass x={290} y={50} r={12} />
    </PaperBacking>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Local tier — UI-fix-K rebuild.
//
// Replaces the SVG paper-script settlement (PaperBacking + DrawBuilding
// silhouettes + dashed perimeter + serif edge labels) with a Canvas
// bird's-eye view per docs/ui-design-reference.md §7 + ui-fix-brief
// Group K spec:
//   - 320×320 intrinsic canvas, CSS width 100% height auto, DPR-aware
//   - background:           #0f0d0a
//   - roads:                quadratic beziers between connections, two
//                           passes (#3d3220 base 5.5px, #4a3c28 stripe 1.5px)
//   - building footprint:   28×22 rect, dark fill #1a1410, border tone by
//                           state (current #c4943a, visited #6a5530,
//                           undiscovered dashed #2d2618), 2px corner radius,
//                           4×3 door mark at south edge
//   - current-loc glow:     radial gradient 32px, amber 0.18 → 0
//   - current-loc indicator: dashed amber ring at r=18 + ● 6px marker
//   - labels:               italic 10px Cormorant Garamond below building
//   - trees:                ~10 seeded marks ringing the canvas edges
//   - exits:                edge-anchored italic serif labels (preserves
//                           the data the old <LocalExits> rendered)
//   - npc dots:             small amber + halo when npcMode && npcCount>0
//   - title + subtitle:     top-left, matches the prior PaperHeader
//
// Display-only. No click handlers — per CLAUDE.md rule 2 nav lives in
// the nav bar; WorldMap.tsx (line 1020) already removed clickable
// SVG exits for the local tier. Keeping the canvas display-only
// preserves that contract.
// ───────────────────────────────────────────────────────────────────────────

/** Deterministic FNV-1a → linear-congruential RNG seeded by a string.
 *  Used so trees and road curve offsets stay stable across re-renders. */
function makeSeededRng(seed: string): () => number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  }
  return () => {
    h = (Math.imul(h, 1664525) + 1013904223) >>> 0;
    return (h >>> 0) / 0x100000000;
  };
}

/** Endpoint-order-independent key so connection rendering stays stable
 *  whether the data structure lists {from→to} or {to→from}. */
function connectionKey(c: { fromX: number; fromY: number; toX: number; toY: number }): string {
  const a = `${Math.round(c.fromX)},${Math.round(c.fromY)}`;
  const b = `${Math.round(c.toX)},${Math.round(c.toY)}`;
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/** Small rounded rectangle. Falls back to a plain rect on engines
 *  without CanvasRenderingContext2D.roundRect (older Safari). */
function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  if (typeof (ctx as unknown as { roundRect?: unknown }).roundRect === "function") {
    (ctx as CanvasRenderingContext2D & {
      roundRect: (x: number, y: number, w: number, h: number, r: number) => void;
    }).roundRect(x, y, w, h, rr);
    return;
  }
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

export function LocalMap(props: RendererProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Crisp rendering at high-DPR. Intrinsic 320×320 in CSS pixels;
    // the canvas backing store scales with devicePixelRatio.
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    canvas.width  = VIEW * dpr;
    canvas.height = VIEW * dpr;
    canvas.style.width  = "100%";
    canvas.style.height = "auto";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // ── Background ────────────────────────────────────────────────────────
    ctx.fillStyle = "#0f0d0a";
    ctx.fillRect(0, 0, VIEW, VIEW);

    // ── Peripheral texture: small tree marks ringing the canvas edges ────
    // Seeded by the zone title so the same settlement gets the same
    // tree distribution between re-renders.
    const treeRng = makeSeededRng(`trees:${props.title}`);
    ctx.fillStyle = "#2d3a1a";
    for (let i = 0; i < 11; i++) {
      const side  = Math.floor(treeRng() * 4);   // 0 top 1 right 2 bottom 3 left
      const along = 16 + treeRng() * (VIEW - 32);
      const inwd  = 4 + treeRng() * 16;
      let tx = 0, ty = 0;
      if      (side === 0) { tx = along;          ty = inwd; }
      else if (side === 1) { tx = VIEW - inwd;    ty = along; }
      else if (side === 2) { tx = along;          ty = VIEW - inwd; }
      else                 { tx = inwd;           ty = along; }
      // Skip the top-left corner — the title/subtitle live there.
      if (ty < 56 && tx < 220) continue;
      ctx.beginPath();
      ctx.arc(tx, ty, 1.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();                            // little spire above the dot
      ctx.moveTo(tx,     ty - 1);
      ctx.lineTo(tx - 2, ty + 2);
      ctx.lineTo(tx + 2, ty + 2);
      ctx.closePath();
      ctx.fill();
    }

    // ── Roads (drawn under buildings) ─────────────────────────────────────
    // Two passes per connection: a 5.5px warm-brown base then a 1.5px
    // lighter centre stripe. The stripe rides exactly on the same
    // quadratic-bezier path so it reads as a road centre line.
    const paths: Path2D[] = props.connections.map((c) => {
      const key   = connectionKey(c);
      const rng   = makeSeededRng(`road:${key}`);
      const dx    = c.toX - c.fromX;
      const dy    = c.toY - c.fromY;
      const len   = Math.max(1, Math.hypot(dx, dy));
      const mx    = (c.fromX + c.toX) / 2;
      const my    = (c.fromY + c.toY) / 2;
      // Perpendicular unit vector, sign seeded so the same road always
      // curves the same way.
      const sign  = rng() < 0.5 ? -1 : 1;
      const off   = (15 + rng() * 10) * sign;
      const cpx   = mx + (-dy / len) * off;
      const cpy   = my + ( dx / len) * off;
      const p     = new Path2D();
      p.moveTo(c.fromX, c.fromY);
      p.quadraticCurveTo(cpx, cpy, c.toX, c.toY);
      return p;
    });
    ctx.lineCap  = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#3d3220";
    ctx.lineWidth   = 5.5;
    paths.forEach((p) => ctx.stroke(p));
    ctx.strokeStyle = "#4a3c28";
    ctx.lineWidth   = 1.5;
    paths.forEach((p) => ctx.stroke(p));

    // ── Buildings + per-node decoration ───────────────────────────────────
    const BW = 28;
    const BH = 22;
    for (const n of props.nodes) {
      const cx = n.x;
      const cy = n.y;

      // Current-location amber radial glow — drawn UNDER the building
      // so the rect still reads as crisp on top.
      if (n.isCurrent && n.isDiscovered) {
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 32);
        grad.addColorStop(0, "rgba(196,148,58,0.18)");
        grad.addColorStop(1, "rgba(196,148,58,0)");
        ctx.fillStyle = grad;
        ctx.fillRect(cx - 32, cy - 32, 64, 64);
      }

      // Building footprint.
      if (!n.isDiscovered) {
        // Undiscovered: dashed outline, no label/door/glow.
        ctx.save();
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = "#2d2618";
        ctx.lineWidth   = 1;
        roundedRectPath(ctx, cx - BW / 2, cy - BH / 2, BW, BH, 2);
        ctx.stroke();
        ctx.restore();
        continue;
      }

      ctx.fillStyle = "#1a1410";
      roundedRectPath(ctx, cx - BW / 2, cy - BH / 2, BW, BH, 2);
      ctx.fill();

      const borderColor = n.isCurrent ? "#c4943a" : "#6a5530";
      ctx.strokeStyle = borderColor;
      ctx.lineWidth   = n.isCurrent ? 2 : 1.2;
      // Path already on the stack from the fill; restate so the stroke
      // sees the same geometry rather than relying on the last
      // beginPath state.
      roundedRectPath(ctx, cx - BW / 2, cy - BH / 2, BW, BH, 2);
      ctx.stroke();

      // Door — 4×3 fill mark centred on the south edge.
      ctx.fillStyle = borderColor;
      ctx.fillRect(cx - 2, cy + BH / 2 - 1, 4, 3);

      // Label.
      ctx.fillStyle    = n.isCurrent ? "#c4943a" : "#c8b890";
      ctx.font         = "italic 10px 'Cormorant Garamond', Georgia, serif";
      ctx.textAlign    = "center";
      ctx.textBaseline = "top";
      ctx.fillText(n.name, cx, cy + BH / 2 + 4);

      // Optional NPC dot — small amber pip with halo, like the prior SVG.
      if (props.npcMode && n.npcCount > 0) {
        const dx = cx + BW / 2 - 2;
        const dy = cy - BH / 2 + 2;
        ctx.fillStyle = "rgba(196,148,58,0.30)";
        ctx.beginPath();
        ctx.arc(dx, dy, 2.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#c4943a";
        ctx.beginPath();
        ctx.arc(dx, dy, 1.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // ── Current-location indicator (● + dashed ring) ─────────────────────
    const cur = props.nodes.find((n) => n.isCurrent && n.isDiscovered);
    if (cur) {
      ctx.save();
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = "#c4943a";
      ctx.lineWidth   = 1;
      ctx.beginPath();
      ctx.arc(cur.x, cur.y, 18, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      ctx.fillStyle = "#c4943a";
      ctx.beginPath();
      ctx.arc(cur.x, cur.y - BH / 2 - 6, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // ── Exit labels (edge-anchored italic serif, preserving the data
    //    the prior <LocalExits> rendered) ─────────────────────────────────
    if (props.exits && props.exits.length > 0) {
      const lefts:  typeof props.exits = [];
      const rights: typeof props.exits = [];
      for (const e of props.exits) {
        if (e.fromX < VIEW / 2) lefts.push(e); else rights.push(e);
      }
      ctx.fillStyle    = "#c4943a";
      ctx.font         = "italic 11px 'Cormorant Garamond', Georgia, serif";
      ctx.textBaseline = "alphabetic";
      ctx.textAlign    = "left";
      lefts.forEach((e, i) => {
        ctx.fillText(`← ${e.targetName}`, 12, 170 + i * 16);
      });
      ctx.textAlign = "right";
      rights.forEach((e, i) => {
        ctx.fillText(`${e.targetName} →`, VIEW - 12, 170 + i * 16);
      });
    }

    // ── Title + subtitle (top-left; preserves the prior PaperHeader) ─────
    ctx.fillStyle    = "#e8d8b0";
    ctx.font         = "italic 600 22px 'Cormorant Garamond', Georgia, serif";
    ctx.textAlign    = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(props.title, 14, 28);
    ctx.fillStyle = "#a08868";
    ctx.font      = "italic 13px 'Cormorant Garamond', Georgia, serif";
    ctx.fillText(props.subtitle, 14, 46);
  }, [
    props.title,
    props.subtitle,
    props.nodes,
    props.connections,
    props.exits,
    props.npcMode,
  ]);

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={`Settlement map of ${props.title}`}
      style={{ display: "block", width: "100%", height: "auto" }}
    />
  );
}
