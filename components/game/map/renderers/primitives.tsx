"use client";

import React from "react";

/**
 * Shared SVG primitives ported from /design/map-v2.jsx and
 * /design/map-genres.jsx. The design defined these as JSX with global
 * React; here they're plain TSX components with named exports.
 *
 * Backing components own their genre-prefixed gradient / pattern IDs
 * (pf-, cy-, sp-, ap-, ho-) so two maps with different genres can sit
 * on the same page without collisions.
 */

interface ChildProps { children?: React.ReactNode; }

// ── Backings ────────────────────────────────────────────────────────────────

export function PaperBacking({ children }: ChildProps) {
  return (
    <svg
      viewBox="0 0 320 320"
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid meet"
      style={{ display: "block" }}
    >
      <defs>
        <radialGradient id="pf-paper-warm" cx="50%" cy="45%" r="60%">
          <stop offset="0%" stopColor="#1a1611" stopOpacity="1" />
          <stop offset="100%" stopColor="#0e0c09" stopOpacity="1" />
        </radialGradient>
        <pattern id="pf-paper-fiber" width="80" height="80" patternUnits="userSpaceOnUse">
          <rect width="80" height="80" fill="transparent" />
          <path
            d="M 0 20 Q 40 18 80 22 M 0 50 Q 40 52 80 48 M 0 70 Q 40 68 80 72"
            stroke="rgba(180,160,130,0.04)"
            strokeWidth="0.4"
            fill="none"
          />
        </pattern>
        <radialGradient id="pf-paper-vig" cx="50%" cy="50%" r="70%">
          <stop offset="50%" stopColor="rgba(0,0,0,0)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.6)" />
        </radialGradient>
      </defs>
      <rect x="0" y="0" width="320" height="320" fill="url(#pf-paper-warm)" />
      <rect x="0" y="0" width="320" height="320" fill="url(#pf-paper-fiber)" />
      {children}
      <rect x="0" y="0" width="320" height="320" fill="url(#pf-paper-vig)" pointerEvents="none" />
    </svg>
  );
}

export function InkBacking({ children }: ChildProps) {
  return (
    <svg
      viewBox="0 0 320 320"
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid meet"
      style={{ display: "block" }}
    >
      <defs>
        <pattern id="cy-circuit-grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 L 0 20" stroke="rgba(34,211,238,0.06)" strokeWidth="0.4" fill="none" />
        </pattern>
        <radialGradient id="cy-cyber-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.18" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect x="0" y="0" width="320" height="320" fill="#070a0c" />
      <rect x="0" y="0" width="320" height="320" fill="url(#cy-circuit-grid)" />
      {children}
    </svg>
  );
}

export function StarBacking({ children }: ChildProps) {
  return (
    <svg
      viewBox="0 0 320 320"
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid meet"
      style={{ display: "block" }}
    >
      <defs>
        <radialGradient id="sp-space-bg" cx="50%" cy="45%" r="70%">
          <stop offset="0%" stopColor="#0d0a1f" />
          <stop offset="100%" stopColor="#04030c" />
        </radialGradient>
        <radialGradient id="sp-nebula" cx="35%" cy="65%" r="55%">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.18" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="sp-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.32" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect x="0" y="0" width="320" height="320" fill="url(#sp-space-bg)" />
      <rect x="0" y="0" width="320" height="320" fill="url(#sp-nebula)" />
      {STAR_FIELD.map(([x, y], i) => (
        <circle
          key={`s-${i}`}
          cx={x}
          cy={y}
          r={0.5 + (i % 3) * 0.25}
          fill="#cfd8ff"
          opacity={0.45 + (i % 4) * 0.12}
        />
      ))}
      {STAR_BRIGHT.map(([x, y], i) => (
        <g key={`b-${i}`}>
          <circle cx={x} cy={y} r="1.2" fill="var(--accent)" opacity="0.9" />
          <circle cx={x} cy={y} r="3" fill="var(--accent)" opacity="0.18" />
        </g>
      ))}
      {children}
    </svg>
  );
}

const STAR_FIELD: Array<[number, number]> = [
  [22, 38],  [55, 14],   [98, 60],   [144, 22],  [188, 48],  [220, 14],
  [266, 36], [296, 70],  [12, 110],  [62, 142],  [108, 130], [156, 180],
  [202,162], [248, 200], [288, 138], [40, 220],  [82, 260],  [128, 280],
  [174,230], [216, 286], [256, 248], [296, 268], [70, 190],  [240, 100],
  [180, 90], [22, 178],  [134, 244], [304, 220],
];
const STAR_BRIGHT: Array<[number, number]> = [
  [68, 70], [212, 110], [98, 220], [248, 260],
];

export function SalvageBacking({ children }: ChildProps) {
  return (
    <svg
      viewBox="0 0 320 320"
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid meet"
      style={{ display: "block" }}
    >
      <defs>
        <linearGradient id="ap-paper" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1a1108" />
          <stop offset="100%" stopColor="#0d0805" />
        </linearGradient>
        <pattern id="ap-stains" width="60" height="60" patternUnits="userSpaceOnUse">
          <circle cx="14" cy="22" r="9" fill="rgba(120,60,20,0.10)" />
          <circle cx="42" cy="46" r="6" fill="rgba(120,60,20,0.08)" />
          <circle cx="34" cy="10" r="3" fill="rgba(120,60,20,0.07)" />
        </pattern>
        <radialGradient id="ap-vig" cx="50%" cy="50%" r="70%">
          <stop offset="55%" stopColor="rgba(0,0,0,0)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.7)" />
        </radialGradient>
        <radialGradient id="ap-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.22" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect x="0" y="0" width="320" height="320" fill="url(#ap-paper)" />
      <rect x="0" y="0" width="320" height="320" fill="url(#ap-stains)" />
      <g opacity="0.55">
        <rect x="-6" y="14" width="44" height="10"
          fill="rgba(220,200,160,0.18)" transform="rotate(-22 16 19)" />
        <rect x="282" y="298" width="44" height="10"
          fill="rgba(220,200,160,0.18)" transform="rotate(18 304 303)" />
      </g>
      {children}
      <rect x="0" y="0" width="320" height="320" fill="url(#ap-vig)" pointerEvents="none" />
    </svg>
  );
}

export function BlackInkBacking({ children }: ChildProps) {
  return (
    <svg
      viewBox="0 0 320 320"
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid meet"
      style={{ display: "block" }}
    >
      <defs>
        <radialGradient id="ho-bg" cx="50%" cy="50%" r="70%">
          <stop offset="0%" stopColor="#0a0f08" />
          <stop offset="100%" stopColor="#040603" />
        </radialGradient>
        <radialGradient id="ho-smoke" cx="50%" cy="60%" r="55%">
          <stop offset="0%" stopColor="rgba(132,204,22,0.10)" />
          <stop offset="100%" stopColor="rgba(132,204,22,0)" />
        </radialGradient>
        <radialGradient id="ho-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.30" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect x="0" y="0" width="320" height="320" fill="url(#ho-bg)" />
      <rect x="0" y="0" width="320" height="320" fill="url(#ho-smoke)" />
      {children}
    </svg>
  );
}

// ── Fantasy / shared paper-style primitives ─────────────────────────────────

interface XYProps { x: number; y: number; }

export function DrawnTree({ x, y, s = 1 }: XYProps & { s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M 0 2 L 0 4" stroke="#8a6f4a" strokeWidth="0.6" />
      <path
        d="M -2.4 1 Q -2.6 -2 0 -3.5 Q 2.6 -2 2.4 1 Q 1 2 0 1.6 Q -1 2 -2.4 1 Z"
        fill="#3a2f20"
        stroke="#6b5638"
        strokeWidth="0.4"
      />
    </g>
  );
}

export function DrawnPeak({
  x, y, w = 12, h = 10,
}: XYProps & { w?: number; h?: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d={`M ${-w / 2} 0 L 0 ${-h} L ${w / 2} 0 Z`}
        fill="#1f1813" stroke="#a08868" strokeWidth="0.7" strokeLinejoin="round" />
      <path d={`M ${-w / 4} ${-h / 3} L 0 ${-h * 0.85}`} stroke="#a08868" strokeWidth="0.4" />
      <path d={`M ${-1.5} ${-h * 0.7} L 0 ${-h} L ${1.5} ${-h * 0.7}`}
        fill="#d8c8a8" opacity="0.85" />
    </g>
  );
}

export function Coastline({ d }: { d: string }) {
  return (
    <g>
      <path d={d} fill="none" stroke="#7a5e38" strokeWidth="3.2" opacity="0.18" />
      <path d={d} fill="none" stroke="#7a5e38" strokeWidth="2.0" opacity="0.22" />
      <path d={d} fill="none" stroke="#c9a872" strokeWidth="0.8" />
    </g>
  );
}

export function Wavelet({ x, y, s = 1 }: XYProps & { s?: number }) {
  return (
    <path
      d={`M ${x} ${y} q ${2 * s} ${-1.5 * s} ${4 * s} 0 t ${4 * s} 0`}
      fill="none"
      stroke="#7a92a8"
      strokeWidth="0.5"
      opacity="0.55"
    />
  );
}

export function TravelDots({
  d, color = "#a08868",
}: { d: string; color?: string }) {
  return (
    <path d={d} fill="none" stroke={color} strokeWidth="1"
      strokeDasharray="0.5 3.2" strokeLinecap="round" opacity="0.85" />
  );
}

export function Forest({
  cx, cy, w = 40, h = 24, density = 14, label,
}: {
  cx: number; cy: number; w?: number; h?: number;
  density?: number; label?: string;
}) {
  const trees = React.useMemo(() => {
    const arr: Array<{ x: number; y: number; s: number }> = [];
    let seed = (cx * 1000 + cy) | 0;
    const rand = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    for (let i = 0; i < density; i += 1) {
      arr.push({
        x: cx + (rand() - 0.5) * w,
        y: cy + (rand() - 0.5) * h,
        s: 0.85 + rand() * 0.5,
      });
    }
    return arr;
  }, [cx, cy, w, h, density]);
  return (
    <g>
      {trees.map((t, i) => <DrawnTree key={i} x={t.x} y={t.y} s={t.s} />)}
      {label && (
        <text x={cx} y={cy + h / 2 + 10} textAnchor="middle"
          fontFamily="var(--serif)" fontStyle="italic" fontSize="9"
          fill="#c9a872" opacity="0.9">{label}</text>
      )}
    </g>
  );
}

export function MountainRange({
  points, label,
}: {
  points: Array<[number, number, number?, number?]>;
  label?: string;
}) {
  return (
    <g>
      {points.map((p, i) => (
        <DrawnPeak key={i} x={p[0]} y={p[1]} w={p[2] ?? 12} h={p[3] ?? 10} />
      ))}
      {label && (
        <text
          x={points[Math.floor(points.length / 2)][0]}
          y={points[Math.floor(points.length / 2)][1] + 10}
          textAnchor="middle"
          fontFamily="var(--serif)"
          fontStyle="italic"
          fontSize="9"
          fill="#c9a872"
          opacity="0.9"
        >
          {label}
        </text>
      )}
    </g>
  );
}

export function PlaceLabel({
  x, y, primary, secondary, anchor = "middle", color = "#e8d8b0",
}: {
  x: number; y: number;
  primary: string;
  secondary?: string;
  anchor?: "start" | "middle" | "end";
  color?: string;
}) {
  return (
    <g>
      <text x={x} y={y} textAnchor={anchor}
        fontFamily="var(--serif)" fontStyle="italic" fontSize="11"
        fill={color} fontWeight="500" style={{ letterSpacing: 1.2 }}>
        {primary}
      </text>
      {secondary && (
        <text x={x} y={y + 11} textAnchor={anchor}
          fontFamily="var(--serif)" fontStyle="italic" fontSize="8"
          fill="#a08868" opacity="0.85" style={{ letterSpacing: 0.8 }}>
          {secondary}
        </text>
      )}
    </g>
  );
}

export function TownGlyph({ x, y, current = false }: XYProps & { current?: boolean }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      {current && (
        <>
          <circle r="14" fill="rgba(245,158,11,0.10)" />
          {/* canonical --g-fantasy resolved literal — SVG stroke attribute */}
          <circle r="9" fill="none" stroke="#c4943a" strokeWidth="0.5"
            strokeDasharray="2 2" className="ew-pulse"
            style={{ transformOrigin: "center", transformBox: "fill-box" }} />
        </>
      )}
      {/* canonical --g-fantasy resolved literal — SVG stroke attribute */}
      <g stroke={current ? "#c4943a" : "#e8d8b0"} strokeWidth="0.9"
        fill="#14110c" strokeLinejoin="round">
        <path d="M -4 1 L -4 -2 L -2 -4 L 0 -2 L 0 1 Z" />
        <path d="M 0 1 L 0 -1 L 2 -3 L 4 -1 L 4 1 Z" />
      </g>
    </g>
  );
}

export function CityGlyph({ x, y }: XYProps) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <g stroke="#e8d8b0" strokeWidth="0.9" fill="#14110c" strokeLinejoin="round">
        <path d="M -5 2 L -5 -2 L -3 -4 L -1 -2 L 1 -4 L 3 -2 L 5 -4 L 5 2 Z" />
        <path d="M -2 2 L -2 -1 L 2 -1 L 2 2" />
      </g>
      <path d="M 5 -4 L 5 -8" stroke="#e8d8b0" strokeWidth="0.6" />
      <path d="M 5 -8 L 9 -7 L 5 -6 Z" fill="#c4302b" stroke="#e8d8b0" strokeWidth="0.4" />
    </g>
  );
}

export function RuinGlyph({ x, y }: XYProps) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d="M -4 3 L -3 -3 L -1 -4 L 0 -1 L 2 -5 L 3 1 L 4 3 Z"
        fill="#14110c" stroke="#a08868" strokeWidth="0.8" strokeLinejoin="round" />
    </g>
  );
}

export function StoneGlyph({ x, y }: XYProps) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d="M -2 3 L -2.5 -3 L 0 -5 L 2.5 -3 L 2 3 Z"
        fill="#1a1611" stroke="#c9a872" strokeWidth="0.8" />
      <path d="M -1 -1 L 1 -1" stroke="#c9a872" strokeWidth="0.5" />
    </g>
  );
}

export function PaperCompass({ x, y, r = 16 }: XYProps & { r?: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r={r} fill="rgba(20,17,12,0.55)" stroke="#a08868" strokeWidth="0.5" />
      <path d={`M 0 ${-r + 3} L 1.5 0 L 0 ${r - 3} L -1.5 0 Z`} fill="#e8d8b0" />
      <path d={`M ${-r + 3} 0 L 0 -1.5 L ${r - 3} 0 L 0 1.5 Z`}
        fill="#a08868" opacity="0.75" />
      <text y={-r - 2} textAnchor="middle"
        fontFamily="var(--serif)" fontStyle="italic" fontSize="8" fill="#e8d8b0">
        N
      </text>
    </g>
  );
}

// ── Fantasy glyph picker (data-driven) ─────────────────────────────────────
// Picks a primitive glyph for a node based on its category. Falls back to
// TownGlyph when the category isn't recognised.

export function FantasyNodeGlyph({
  x, y, category, current,
}: {
  x: number; y: number;
  category?: string;
  current: boolean;
}) {
  switch (category) {
    case "ruin":
    case "dungeon":
      return <RuinGlyph x={x} y={y} />;
    case "stronghold":
    case "settlement":
      return current
        ? <TownGlyph x={x} y={y} current />
        : <CityGlyph x={x} y={y} />;
    case "wilderness":
      return <StoneGlyph x={x} y={y} />;
    case "tavern":
    case "market":
    case "port":
    default:
      return <TownGlyph x={x} y={y} current={current} />;
  }
}
