/**
 * Shared types for the genre-themed map renderers (FantasyMap,
 * CyberMap, SpaceMap, ApocMap, HorrorMap). Each genre takes the same
 * inputs — a flat list of nodes with pre-projected 0..320 coordinates,
 * connections drawn between them, and an optional exits list — so
 * `index.tsx` can route to a genre renderer without changing prop
 * shapes.
 */

export interface MapNode {
  id:           string;
  name:         string;
  /** "zone" | "sub_location" — drives glyph selection. */
  type:         "zone" | "sub_location";
  /** Optional WorldNode.category — refines glyph picker (tavern → inn,
   *  market, settlement, dungeon, etc.). Falls back to type. */
  category?:    string;
  /** Projected position in the 320x320 viewBox. */
  x:            number;
  y:            number;
  isCurrent:    boolean;
  isDiscovered: boolean;
  /** Mirrors WorldNode.is_expandable. Geographic-region zones (and the
   *  abstract container zones the bible builds) carry this true; clicking
   *  them is informational only — they're not directly navigable. */
  isExpandable?: boolean;
  /** Count of NPCs at this node (drives the optional npc dot). */
  npcCount:     number;
}

export interface MapConnection {
  /** Both endpoints already projected to viewBox space. */
  fromX: number;
  fromY: number;
  toX:   number;
  toY:   number;
  /** False = dashed, "unknown / unwalked" connection. */
  visited: boolean;
}

export type ExitEdge = "left" | "right" | "top" | "bottom";

export interface MapExit {
  targetId:   string;
  targetName: string;
  /** Projected position of the source node the arrow leaves from. */
  fromX:      number;
  fromY:      number;
  /** Pre-computed edge classification for label distribution. The
   *  builder in WorldMap.tsx assigns this based on the source node's
   *  relative position so renderers can stack labels per edge instead
   *  of pile them in one corner. */
  edge?:      ExitEdge;
}

/** Shared props each genre's WorldMap / RegionMap / LocalMap accepts. */
export interface RendererProps {
  /** Top-line title rendered in the body of the SVG. */
  title:    string;
  /** Subtitle line below the title (e.g. "4 known · 1 rumored"). */
  subtitle: string;
  nodes:        MapNode[];
  connections:  MapConnection[];
  exits?:       MapExit[];
  onSelectNode?: (id: string) => void;
  onSelectExit?: (id: string) => void;
  /** When true, places small NPC dots near nodes that have npcCount>0. */
  npcMode?: boolean;
}

/** Map an input grid coordinate to the 0..VIEW viewBox using the bounds
 *  of the data being rendered. The genre renderers all use a 320x320
 *  viewBox with a small padding so glyphs near the edge don't clip. */
export interface BoundsLike {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export const VIEW = 320;
export const PAD  = 30;

/** Project a grid coordinate into the 320x320 viewBox space. When the
 *  bounds collapse to a single point we centre the marker. */
export function project(
  gx:     number,
  gy:     number,
  bounds: BoundsLike
): { x: number; y: number } {
  const dx = bounds.maxX - bounds.minX;
  const dy = bounds.maxY - bounds.minY;
  if (dx === 0 && dy === 0) {
    return { x: VIEW / 2, y: VIEW / 2 };
  }
  const sx = dx === 0 ? 0 : (gx - bounds.minX) / dx;
  const sy = dy === 0 ? 0 : (gy - bounds.minY) / dy;
  return {
    x: PAD + sx * (VIEW - PAD * 2),
    y: PAD + sy * (VIEW - PAD * 2),
  };
}
