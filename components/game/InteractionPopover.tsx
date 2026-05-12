"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { PointOfInterest } from "@/types/game";
import { POI_COLORS } from "./poi-colors";

interface InteractionPopoverProps {
  point:    PointOfInterest;
  position: { x: number; y: number };
  onAction: (input: string) => void;
  onClose:  () => void;
}

interface ActionDef {
  label: string;
  build: (poiLabel: string) => string | null; // null = close only
}

// UX (V8.47+) — Action sets per POI type.
//
// Architecture note on ITEM (V8.47 rule 83): real pickup items live in
// the FloorLootStrip, NOT as story-feed highlights. Anything classified
// ITEM in the feed is therefore an environmental object/fixture the
// narrator surfaced — never something the player can literally pocket.
// "Pick up" was removed from this set: it suggested an action the
// architecture no longer supports for feed highlights and was wrong for
// environmental features like bridges, stones, or carvings that get
// classified ITEM by the narrator.
//
// CONTAINER keeps SEARCH primary — the natural action for V8.47
// containers — and the action routes through resolveInteract's
// container-search path (rule 84: engine-resolved, zero LLM).
const ACTIONS_BY_TYPE: Record<PointOfInterest["type"], ActionDef[]> = {
  LOCATION: [
    { label: "Go there",         build: (l) => `go to ${l}` },
    { label: "Examine from here",build: (l) => `examine ${l}` },
    { label: "Ignore",           build: () => null },
  ],
  NPC: [
    { label: "Talk to", build: (l) => `talk to ${l}` },
    { label: "Examine", build: (l) => `examine ${l}` },
    { label: "Attack",  build: (l) => `attack ${l}` },
    { label: "Follow",  build: (l) => `follow ${l}` },
  ],
  CONTAINER: [
    { label: "Search",  build: (l) => `search ${l}` },
    { label: "Examine", build: (l) => `examine ${l}` },
    { label: "Leave",   build: () => null },
  ],
  // ITEM no longer offers Pick up — feed highlights are fixtures, not
  // pocketable items (real loot lives in FloorLootStrip per rule 83).
  // EXAMINE is the only meaningful interaction; Close lets the player
  // dismiss without triggering anything.
  ITEM: [
    { label: "Examine",   build: (l) => `examine ${l}` },
    { label: "Close",     build: () => null },
  ],
  HAZARD: [
    { label: "Avoid",    build: (l) => `avoid ${l}` },
    { label: "Examine",  build: (l) => `examine ${l}` },
    { label: "Interact", build: (l) => `interact with ${l}` },
  ],
  // Day 19E — WCD landmark: informational only. The popover header shows
  // the public_description; no buttons because the player can't navigate
  // to a landmark (they have to discover the region it sits in).
  LANDMARK: [
    { label: "Close", build: () => null },
  ],
};

// UX (V8.47+) — Navigation-suggesting labels skip the action grid.
// Words like "bridge", "gate", "passage" describe physical features the
// player would traverse, not interact with through a popup. For these
// the popover renders header + Close only — the player can still type
// "cross the bridge" in the input bar if they want a custom action.
const NAVIGATION_NAME_PATTERNS = [
  /\bbridge\b/i,
  /\bgate\b/i,
  /\bpassage\b/i,
  /\bstairs?\b/i,
  /\bstairwell\b/i,
  /\bpath(way)?\b/i,
  /\btrail\b/i,
  /\bdoorway\b/i,
  /\barchway\b/i,
  /\bcorridor\b/i,
];
function isNavigationLikeLabel(label: string): boolean {
  return NAVIGATION_NAME_PATTERNS.some((re) => re.test(label));
}

const POPOVER_WIDTH  = 280;
const POPOVER_MARGIN = 12;

export function InteractionPopover({ point, position, onAction, onClose }: InteractionPopoverProps) {
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" && window.innerWidth < 768
  );

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // ESC closes the popover.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const accent = POI_COLORS[point.type];
  // UX (V8.47+) — Navigation-like labels (bridge, gate, passage…) get
  // a header + Close popover only. The action grid is suppressed
  // because these objects describe traversal features, not popup-
  // actionable items. Player can still type a custom verb.
  const isNavLike = isNavigationLikeLabel(point.label);
  const actions: ActionDef[] = isNavLike
    ? [{ label: "Close", build: () => null }]
    : ACTIONS_BY_TYPE[point.type];

  const handleAction = (build: (l: string) => string | null) => {
    const cmd = build(point.label);
    if (cmd) onAction(cmd);
    onClose();
  };

  // Desktop: clamp position so the popover stays in viewport.
  const desktopStyle = (() => {
    if (typeof window === "undefined") return { left: position.x, top: position.y };
    const maxLeft = window.innerWidth  - POPOVER_WIDTH - POPOVER_MARGIN;
    const left    = Math.min(Math.max(POPOVER_MARGIN, position.x), maxLeft);
    const top     = Math.min(position.y + 12, window.innerHeight - 280);
    return { left, top };
  })();

  return (
    <>
      {/* Backdrop — clicking outside closes the popover */}
      <div
        className="fixed inset-0 z-40"
        style={{ background: isMobile ? "rgba(0,0,0,0.45)" : "transparent" }}
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-label={`${point.type} interaction: ${point.label}`}
        className={
          isMobile
            ? "fixed inset-x-0 bottom-0 z-50 rounded-t-lg border-t p-4 shadow-2xl"
            : "fixed z-50 w-[280px] rounded-md border p-3 shadow-xl"
        }
        style={{
          backgroundColor: "var(--color-bg)",
          borderColor:     `color-mix(in srgb, ${accent} 55%, var(--color-border))`,
          ...(isMobile ? {} : desktopStyle),
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          aria-label="Close"
          onClick={onClose}
          className="absolute right-2 top-2 rounded-sm p-1 transition-colors hover:bg-white/10"
          style={{ color: "var(--color-muted)" }}
        >
          <X className="size-3" />
        </button>

        {/* Header */}
        <div className="pr-5">
          <div
            className="mb-0.5 text-[9px] font-bold uppercase tracking-widest"
            style={{ color: accent }}
          >
            {point.type}
          </div>
          <div
            className="text-sm font-bold"
            style={{ color: accent }}
          >
            {point.label}
          </div>
          {point.description && (
            <p
              className="mt-1 text-[11px] italic leading-snug"
              style={{ color: "var(--color-muted)" }}
            >
              {point.description}
            </p>
          )}
        </div>

        {/* Action buttons */}
        <div className="mt-3 grid grid-cols-2 gap-1.5">
          {actions.map((a) => (
            <button
              key={a.label}
              onClick={() => handleAction(a.build)}
              className="rounded-sm px-2 py-1.5 text-[11px] font-bold uppercase tracking-wide transition-opacity hover:opacity-80"
              style={{
                backgroundColor: "color-mix(in srgb, " + accent + " 18%, transparent)",
                border:          `1px solid ${accent}`,
                color:           accent,
              }}
            >
              {a.label}
            </button>
          ))}
        </div>

        {/* Divider + freeform hint */}
        <div
          className="mt-3 border-t pt-2 text-center text-[10px] italic"
          style={{ borderColor: "var(--color-border)", color: "var(--color-muted)" }}
        >
          Or type your own action below
        </div>
      </div>
    </>
  );
}
