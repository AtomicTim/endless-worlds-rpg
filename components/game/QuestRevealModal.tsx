"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useGameStore } from "@/lib/stores/game-store";

/**
 * Day 23C — Act 1 quest-reveal cinematic.
 *
 * Subscribes to `pendingQuestReveal` in the game store. When non-null:
 *   1. Backdrop fades in (300ms)
 *   2. After 400ms, breadcrumb content + X button fade in
 *   3. HOLD indefinitely — player dismisses via X click, backdrop
 *      click, or Escape. There is no auto-dismiss timer.
 *   4. Fades out (300ms) on dismiss, clears pendingQuestReveal.
 *
 * The ✦ beat that lands in the story feed in parallel is the permanent
 * record; this overlay is the once-per-discovery dramatic moment.
 *
 * Acts 2/3/climax never set pendingQuestReveal (pipeline gates on
 * `act === 1`), so this component is silent for those discoveries —
 * they land in the feed only.
 *
 * Audio: emits a "QUEST_REVEAL" CustomEvent on window for future
 * Howler.js integration. Disabled until audio system is wired.
 */

const PHASE = {
  BACKDROP_FADE_IN: 300,
  TEXT_DELAY:       400, // after backdrop starts
  TEXT_FADE_IN:     600,
  FADE_OUT:         300,
} as const;

type Phase = "idle" | "fadeIn" | "textIn" | "hold" | "fadeOut";

export function QuestRevealModal() {
  const reveal      = useGameStore((s) => s.pendingQuestReveal);
  const clearReveal = useGameStore((s) => s.setPendingQuestReveal);
  const [phase, setPhase] = useState<Phase>("idle");

  // ── Animation timeline ─────────────────────────────────────────────────────
  //
  // V8.64 — the hold phase persists until the user dismisses, so we
  // only schedule the fade-in steps. The fadeOut → idle → clear path
  // is driven by the dismiss handler below.
  useEffect(() => {
    if (!reveal) {
      setPhase("idle");
      return;
    }
    setPhase("fadeIn");
    try {
      window.dispatchEvent(new CustomEvent("QUEST_REVEAL", {
        detail: { breadcrumb_id: reveal.breadcrumb_id, act: reveal.act },
      }));
    } catch {
      // SSR / older browsers — ignore.
    }

    const timeouts: number[] = [];
    timeouts.push(window.setTimeout(() => setPhase("textIn"), PHASE.TEXT_DELAY));
    timeouts.push(window.setTimeout(
      () => setPhase("hold"),
      PHASE.TEXT_DELAY + PHASE.TEXT_FADE_IN
    ));

    return () => {
      for (const id of timeouts) window.clearTimeout(id);
    };
  }, [reveal]);

  // ── Dismiss handler ────────────────────────────────────────────────────────
  //
  // Triggered by X click, backdrop click, or Escape. Runs the 300ms
  // fade-out then clears the reveal so the next discovery can re-trigger.
  function dismiss() {
    if (phase === "fadeOut" || phase === "idle") return;
    setPhase("fadeOut");
    window.setTimeout(() => {
      setPhase("idle");
      clearReveal(null);
    }, PHASE.FADE_OUT);
  }

  // Escape key closes only when we're past the fade-in (text visible).
  useEffect(() => {
    if (phase !== "textIn" && phase !== "hold") return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") dismiss();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  if (!reveal || phase === "idle") return null;

  const backdropOpacity =
    phase === "fadeIn"  ? 0.0 :
    phase === "fadeOut" ? 0.0 :
    0.78;

  const textVisible = phase === "textIn" || phase === "hold";
  const xVisible    = textVisible;

  return (
    <div
      role="dialog"
      aria-label="Quest reveal"
      aria-modal="true"
      className="fixed inset-0 z-[60] flex items-center justify-center"
      onClick={dismiss}
      style={{
        background: `rgba(0, 0, 0, ${backdropOpacity})`,
        transition: `background ${
          phase === "fadeIn" ? PHASE.BACKDROP_FADE_IN :
          phase === "fadeOut" ? PHASE.FADE_OUT :
          0
        }ms ease-in-out`,
      }}
    >
      {/* Close button — top-right, mirrors CodexModal chrome. */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); dismiss(); }}
        aria-label="Close reveal"
        className="absolute right-5 top-5 rounded-sm p-1 transition-opacity hover:opacity-80"
        style={{
          color:      "var(--ink-2)",
          opacity:    xVisible ? 0.85 : 0,
          transition: `opacity ${PHASE.TEXT_FADE_IN}ms ease-out`,
        }}
      >
        <X className="size-4" />
      </button>

      <div
        className="ew-serif px-6 text-center"
        // Text area is also clickable — stopPropagation so a click on
        // the content itself doesn't dismiss (only X / backdrop do).
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth:   "640px",
          fontSize:   22,
          lineHeight: 1.5,
          fontStyle:  "italic",
          color:      "var(--ink-1)",
          textShadow: "0 1px 18px rgba(0,0,0,0.5)",
          opacity:    textVisible ? 1 : 0,
          transform:  textVisible ? "translateY(0)" : "translateY(8px)",
          transition: `opacity ${PHASE.TEXT_FADE_IN}ms ease-out, transform ${PHASE.TEXT_FADE_IN}ms ease-out`,
          cursor:     "default",
        }}
      >
        <div
          style={{
            color:         "var(--accent)",
            fontFamily:    "var(--mono)",
            fontSize:      11,
            letterSpacing: "0.32em",
            marginBottom:  12,
            fontStyle:     "normal",
          }}
        >
          ✦ A REVELATION
        </div>
        {reveal.content}
      </div>
    </div>
  );
}
