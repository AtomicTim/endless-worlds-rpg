"use client";

import React, { useEffect } from "react";

/**
 * Day 20 Combat — target picker affordance.
 *
 * Per locked design: the picker is INLINE — enemy CombatantRows get
 * isTargetable=true while picker is active and clicking one resolves
 * the attack. This component renders only the supporting hint banner
 * + Cancel control + Escape key handler. Keeps CombatantRow simple
 * (no overlay nesting) while still matching the spec.
 */
interface Props {
  onCancel: () => void;
}

export function TargetPicker({ onCancel }: Props) {
  // Escape key cancels.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display:        "flex",
        alignItems:     "center",
        justifyContent: "space-between",
        gap:            10,
        padding:        "6px 14px",
        borderTop:      "1px solid var(--line)",
        background:     "color-mix(in srgb, var(--combat-enemy) 12%, var(--bg-1))",
        fontFamily:     "var(--mono)",
        fontSize:       10,
        letterSpacing:  "0.18em",
        color:          "var(--combat-enemy)",
        textTransform:  "uppercase",
      }}
    >
      <span>► Select a target</span>
      <button
        type="button"
        onClick={onCancel}
        style={{
          background:     "transparent",
          border:         "1px solid var(--line-2)",
          borderRadius:   3,
          padding:        "4px 10px",
          fontFamily:     "var(--mono)",
          fontSize:       9,
          letterSpacing:  "0.18em",
          color:          "var(--ink-3)",
          cursor:         "pointer",
        }}
      >
        Cancel (Esc)
      </button>
    </div>
  );
}
