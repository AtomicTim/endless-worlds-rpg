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
    { label: "Take",    build: (l) => `take ${l}` },
    { label: "Ignore",  build: () => null },
  ],
  ITEM: [
    { label: "Pick up",   build: (l) => `take ${l}` },
    { label: "Examine",   build: (l) => `examine ${l}` },
    { label: "Leave it",  build: () => null },
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
  const actions = ACTIONS_BY_TYPE[point.type];

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
