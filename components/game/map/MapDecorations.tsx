"use client";

import { Genre } from "@/types/game";

/**
 * Tier 3 — small SVG glyphs that fill the empty grid cells between
 * sub-location blocks. Replaces the old grey rectangle filler with
 * genre-flavoured texture (trees, circuits, eyes, stars, skulls).
 *
 * Decorations are drawn in `currentColor`, with the parent setting
 * the colour to a 15-20% opacity tint of the genre's primary accent.
 * Each glyph is intentionally simple — they should read as ambient
 * texture, not compete with real nodes for attention.
 */

interface DecorationProps {
  size: number;
}

// ── Fantasy ──────────────────────────────────────────────────────────────────

function TreeCluster({ size }: DecorationProps) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} fill="currentColor">
      <polygon points="3,12 5,5 7,12" />
      <polygon points="6,12 9,3 12,12" />
      <polygon points="11,12 13,7 15,12" />
    </svg>
  );
}

function WindGust({ size }: DecorationProps) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} fill="none"
      stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
      <path d="M2 6 Q 8 3 13 6" />
      <path d="M3 11 Q 9 8 14 11" />
    </svg>
  );
}

function CrossedSwords({ size }: DecorationProps) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} fill="none"
      stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
      <line x1="2"  y1="2"  x2="14" y2="14" />
      <line x1="14" y1="2"  x2="2"  y2="14" />
    </svg>
  );
}

function MountainPeak({ size }: DecorationProps) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} fill="currentColor">
      <polygon points="2,14 8,3 14,14" />
    </svg>
  );
}

function Footprints({ size }: DecorationProps) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} fill="currentColor">
      <ellipse cx="5"  cy="6"  rx="1.6" ry="2.4" />
      <ellipse cx="11" cy="11" rx="1.6" ry="2.4" />
    </svg>
  );
}

// ── Cyberpunk ────────────────────────────────────────────────────────────────

function CircuitNode({ size }: DecorationProps) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} fill="none"
      stroke="currentColor" strokeWidth="1.2">
      <circle cx="8" cy="8" r="2.2" fill="currentColor" />
      <line x1="8"  y1="2"  x2="8"  y2="5.8" />
      <line x1="8"  y1="10.2" x2="8" y2="14" />
      <line x1="2"  y1="8"  x2="5.8" y2="8" />
    </svg>
  );
}

function SignalWave({ size }: DecorationProps) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} fill="none"
      stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
      <path d="M2 6 Q 5 3 8 6 T 14 6" />
      <path d="M2 11 Q 5 8 8 11 T 14 11" />
    </svg>
  );
}

function GridDot({ size }: DecorationProps) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} fill="none"
      stroke="currentColor" strokeWidth="1.2">
      <circle cx="8" cy="8" r="1.5" fill="currentColor" />
      <line x1="8" y1="2"  x2="8"  y2="5" />
      <line x1="8" y1="11" x2="8"  y2="14" />
      <line x1="2" y1="8"  x2="5"  y2="8" />
      <line x1="11" y1="8" x2="14" y2="8" />
    </svg>
  );
}

// ── Horror / Lovecraftian ───────────────────────────────────────────────────

function Spiral({ size }: DecorationProps) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} fill="none"
      stroke="currentColor" strokeWidth="1.1" strokeLinecap="round">
      <path d="M8 8 m -4 0 a 4 4 0 1 1 8 0 a 3 3 0 1 1 -6 0 a 2 2 0 1 1 4 0" />
    </svg>
  );
}

function Handprint({ size }: DecorationProps) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} fill="currentColor">
      <ellipse cx="8" cy="11" rx="3" ry="2.6" />
      <ellipse cx="5"  cy="6" rx="0.9" ry="2.2" />
      <ellipse cx="7"  cy="4" rx="0.9" ry="2.6" />
      <ellipse cx="9"  cy="4" rx="0.9" ry="2.6" />
      <ellipse cx="11" cy="6" rx="0.9" ry="2.2" />
    </svg>
  );
}

function Eye({ size }: DecorationProps) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} fill="none"
      stroke="currentColor" strokeWidth="1.2">
      <ellipse cx="8" cy="8" rx="6" ry="3" />
      <circle cx="8" cy="8" r="1.6" fill="currentColor" />
    </svg>
  );
}

// ── Space Opera ─────────────────────────────────────────────────────────────

function StarCluster({ size }: DecorationProps) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} fill="currentColor">
      <circle cx="3"  cy="4"  r="1" />
      <circle cx="9"  cy="3"  r="0.8" />
      <circle cx="13" cy="6"  r="1.1" />
      <circle cx="6"  cy="9"  r="0.9" />
      <circle cx="11" cy="12" r="1" />
    </svg>
  );
}

function OrbitRing({ size }: DecorationProps) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} fill="none"
      stroke="currentColor" strokeWidth="1">
      <ellipse cx="8" cy="8" rx="6" ry="2.4" />
      <circle cx="14" cy="8" r="1.4" fill="currentColor" />
    </svg>
  );
}

function SignalBurst({ size }: DecorationProps) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} fill="none"
      stroke="currentColor" strokeWidth="1.1" strokeLinecap="round">
      <circle cx="8" cy="8" r="1.4" fill="currentColor" />
      <line x1="8" y1="2" x2="8"  y2="4" />
      <line x1="8" y1="12" x2="8" y2="14" />
      <line x1="2" y1="8" x2="4"  y2="8" />
      <line x1="12" y1="8" x2="14" y2="8" />
      <line x1="3.5" y1="3.5" x2="5"  y2="5"  />
      <line x1="11"  y1="11"  x2="12.5" y2="12.5" />
      <line x1="3.5" y1="12.5" x2="5"  y2="11"   />
      <line x1="11"  y1="5"    x2="12.5" y2="3.5" />
    </svg>
  );
}

// ── Post-Apocalyptic ────────────────────────────────────────────────────────

function Skull({ size }: DecorationProps) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} fill="currentColor">
      <path d="M4 6 a 4 4 0 0 1 8 0 v 3 h -1 v 2 h -1 v -1 h -1 v 1 h -2 v -1 h -1 v 1 h -1 v -2 h -1 z" />
    </svg>
  );
}

function Radiation({ size }: DecorationProps) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} fill="currentColor">
      <circle cx="8" cy="8" r="1.6" />
      <path d="M8 3 L 6 6 L 10 6 Z" />
      <path d="M3.5 11 L 6.5 9 L 5 12.5 Z" />
      <path d="M12.5 11 L 9.5 9 L 11 12.5 Z" />
    </svg>
  );
}

function CrackedGround({ size }: DecorationProps) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} fill="none"
      stroke="currentColor" strokeWidth="1.1" strokeLinecap="round">
      <path d="M2 8 L 5 6 L 7 9 L 11 7 L 14 10" />
      <path d="M5 6 L 6 3" />
      <path d="M11 7 L 12 13" />
    </svg>
  );
}

// ── Generic fallback ────────────────────────────────────────────────────────

function CompassRose({ size }: DecorationProps) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} fill="none"
      stroke="currentColor" strokeWidth="1.1">
      <circle cx="8" cy="8" r="6" />
      <line x1="8" y1="2" x2="8"  y2="14" />
      <line x1="2" y1="8" x2="14" y2="8" />
    </svg>
  );
}

// ── Genre lookup ────────────────────────────────────────────────────────────

type DecorComponent = (props: DecorationProps) => JSX.Element;

const GENRE_DECORATIONS: Record<Genre, DecorComponent[]> = {
  [Genre.FANTASY]:             [TreeCluster, WindGust, CrossedSwords, MountainPeak, Footprints],
  [Genre.CYBERPUNK]:           [CircuitNode, SignalWave, GridDot],
  [Genre.HORROR_LOVECRAFTIAN]: [Spiral, Handprint, Eye],
  [Genre.SPACE_OPERA]:         [StarCluster, OrbitRing, SignalBurst],
  [Genre.POST_APOCALYPTIC]:    [Skull, Radiation, CrackedGround],
};

export function getDecorationsForGenre(genre: Genre | undefined): DecorComponent[] {
  if (!genre) return [CompassRose];
  return GENRE_DECORATIONS[genre] ?? [CompassRose];
}

interface MapDecorationProps {
  /** Index into the genre's decoration list. Modulo'd against the array
   *  size so callers don't have to bounds-check. */
  typeIndex: number;
  genre:     Genre | undefined;
  size:      number;
}

/**
 * Render a single decoration by index. The choice of decoration is
 * deterministic given (genre, typeIndex), which lets callers seed the
 * placement with mulberry32 and trust the same cell gets the same glyph
 * across re-renders.
 */
export function MapDecoration({ typeIndex, genre, size }: MapDecorationProps) {
  const components = getDecorationsForGenre(genre);
  const Component  = components[Math.abs(typeIndex) % components.length];
  return <Component size={size} />;
}
