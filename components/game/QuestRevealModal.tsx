"use client";

import { useEffect, useState } from "react";
import { useGameStore } from "@/lib/stores/game-store";

/**
 * Day 23C — Act 1 quest-reveal cinematic.
 *
 * Subscribes to `pendingQuestReveal` in the game store. When non-null:
 *   1. Backdrop fades in (300ms)
 *   2. After 400ms, breadcrumb content fades in (italic serif, larger)
 *   3. Holds for 2500ms after text is visible
 *   4. Fades out (400ms), clears pendingQuestReveal
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
  HOLD:             2500,
  FADE_OUT:         400,
} as const;

type Phase = "idle" | "fadeIn" | "textIn" | "hold" | "fadeOut";

export function QuestRevealModal() {
  const reveal     = useGameStore((s) => s.pendingQuestReveal);
  const clearReveal = useGameStore((s) => s.setPendingQuestReveal);
  const [phase, setPhase] = useState<Phase>("idle");

  // Drive the animation timeline whenever a new reveal arrives. Each
  // setTimeout call is tracked so cleanup cancels the in-flight cycle
  // if the player navigates away mid-animation.
  useEffect(() => {
    if (!reveal) {
      setPhase("idle");
      return;
    }
    setPhase("fadeIn");
    // Emit audio event for future Howler.js wiring. No-op until audio
    // system lands; safe to dispatch into the void.
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
    timeouts.push(window.setTimeout(
      () => setPhase("fadeOut"),
      PHASE.TEXT_DELAY + PHASE.TEXT_FADE_IN + PHASE.HOLD
    ));
    timeouts.push(window.setTimeout(
      () => {
        setPhase("idle");
        clearReveal(null);
      },
      PHASE.TEXT_DELAY + PHASE.TEXT_FADE_IN + PHASE.HOLD + PHASE.FADE_OUT
    ));

    return () => {
      for (const id of timeouts) window.clearTimeout(id);
    };
  }, [reveal, clearReveal]);

  if (!reveal || phase === "idle") return null;

  const backdropOpacity =
    phase === "fadeIn"  ? 0.0 :
    phase === "fadeOut" ? 0.0 :
    0.78;

  const textVisible = phase === "textIn" || phase === "hold";

  return (
    <div
      role="dialog"
      aria-label="Quest reveal"
      aria-modal="true"
      className="fixed inset-0 z-[60] flex items-center justify-center"
      style={{
        background: `rgba(0, 0, 0, ${backdropOpacity})`,
        transition: `background ${
          phase === "fadeIn" ? PHASE.BACKDROP_FADE_IN :
          phase === "fadeOut" ? PHASE.FADE_OUT :
          0
        }ms ease-in-out`,
        pointerEvents: "none", // cinematic only — no interaction
      }}
    >
      <div
        className="ew-serif px-6 text-center"
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
