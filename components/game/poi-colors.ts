import type { PointOfInterest } from "@/types/game";

/**
 * Color tokens for POI highlights and the interaction popover.
 *
 * FIX 2 — highlight types are now visually distinct and consistently
 * underlined so the player can spot interactable text at a glance:
 *   LOCATION  → bright blue (#60a5fa)  — clickable, fires navigateTo
 *   NPC       → genre primary          — clickable, opens dialogue
 *   ITEM      → amber (#fbbf24)        — clickable, fires EXAMINE
 *   LANDMARK  → violet (#a78bfa)       — info-only popover
 *   CONTAINER → orange  (legacy)
 *   HAZARD    → red     (legacy)
 *
 * Rendering of the underline + hover state lives in StoryFeed (the
 * highlight span itself) — this module is pure colour tokens.
 */
export const POI_COLORS: Record<PointOfInterest["type"], string> = {
  LOCATION:  "var(--poi-settlement)",
  NPC:       "var(--color-primary)",
  ITEM:      "var(--poi-landmark)",
  CONTAINER: "var(--poi-dungeon)",
  HAZARD:    "var(--poi-hostile)",
  LANDMARK:  "var(--poi-lore)",
};

/** Slightly brighter colour applied on hover so the player gets an
 *  affordance cue without changing the background. LANDMARK shares the
 *  base since it's info-only — no click feedback needed. */
export const POI_HOVER_COLORS: Record<PointOfInterest["type"], string> = {
  LOCATION:  "var(--poi-settlement-light)",
  NPC:       "var(--color-primary)",
  ITEM:      "var(--poi-landmark-light)",
  CONTAINER: "var(--poi-dungeon-light)",
  HAZARD:    "var(--poi-hostile-light)",
  LANDMARK:  "var(--hl-region)",
};
