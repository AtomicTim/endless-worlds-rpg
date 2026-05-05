import type { PointOfInterest } from "@/types/game";

/**
 * Color tokens for POI highlights and the interaction popover. LOCATION/NPC
 * use CSS variables so they track the active genre theme; the others are
 * fixed semantic colors (item gold, container orange, hazard red).
 */
export const POI_COLORS: Record<PointOfInterest["type"], string> = {
  LOCATION:  "#94a3b8",         // blue-grey — connected nodes the player can move to
  NPC:       "var(--color-accent)",
  ITEM:      "#eab308",         // amber — Tier 1 objects (Day 19E)
  CONTAINER: "#f97316",
  HAZARD:    "#ef4444",
  LANDMARK:  "#a16207",         // muted gold — WCD landmarks (info only)
};
