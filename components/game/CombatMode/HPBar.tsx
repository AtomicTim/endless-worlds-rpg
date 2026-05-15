"use client";

import React from "react";

/**
 * Day 20 Combat — animated HP bar.
 *
 * UI-10 — HP threshold ladder per design ref §8:
 *   75–100% #4a8a4a
 *   50–75%  #5a9450
 *   25–50%  #a87830
 *   10–25%  #c84830
 *   ≤10%    #e03030 (slow pulse — `ew-hp-pulse` keyframes scoped on
 *                   the CombatMode root)
 *
 * 300ms ease-out width transition on prop change. Boss bars stay
 * slightly thicker (10px vs 8px).
 */
interface Props {
  current: number;
  max:     number;
  isBoss?: boolean;
}

/** UI-10 — exported so other surfaces can match the combat HP palette. */
export function combatHpThresholdColor(pct: number): string {
  if (pct >= 75) return "#4a8a4a";
  if (pct >= 50) return "#5a9450";
  if (pct >= 25) return "#a87830";
  if (pct >= 10) return "#c84830";
  return "#e03030";
}

export function HPBar({ current, max, isBoss }: Props) {
  const pct      = max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0;
  const barColor = combatHpThresholdColor(pct);
  const pulsing  = pct > 0 && pct <= 10;

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={current}
      style={{
        width:        "100%",
        marginTop:    4,
        marginBottom: 4,
        fontFamily:   "var(--mono)",
      }}
    >
      <div
        style={{
          fontSize:      9,
          letterSpacing: "0.18em",
          color:         "var(--ink-3)",
          marginBottom:  2,
        }}
      >
        HP {current} / {max}
      </div>
      <div
        style={{
          width:        "100%",
          height:       isBoss ? 10 : 8,
          background:   "#1c1a17",
          borderRadius: 4,
          overflow:     "hidden",
        }}
      >
        <div
          style={{
            width:      `${pct}%`,
            height:     "100%",
            background: barColor,
            transition: "width 300ms ease-out, background 300ms ease-out",
            animation:  pulsing ? "ew-hp-pulse 1200ms ease-in-out infinite" : undefined,
          }}
        />
      </div>
    </div>
  );
}
