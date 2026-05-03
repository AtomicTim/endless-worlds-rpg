import type { PointOfInterest } from "@/types/game";

/**
 * Color tokens for POI highlights and the interaction popover. LOCATION/NPC
 * use CSS variables so they track the active genre theme; the others are
 * fixed semantic colors (item gold, container orange, hazard red).
 */
export const POI_COLORS: Record<PointOfInterest["type"], string> = {
  LOCATION:  "var(--color-primary)",
  NPC:       "var(--color-accent)",
  ITEM:      "#eab308",
  CONTAINER: "#f97316",
  HAZARD:    "#ef4444",
};
