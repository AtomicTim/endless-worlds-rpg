"use client";

import React from "react";

/**
 * Day 20 Combat — animated HP bar.
 *
 * 300ms ease-out width transition (fires automatically on prop
 * change via CSS). Color thresholds: ≥50% green, 20-50% yellow,
 * <20% red. Boss bars render slightly thicker.
 */
interface Props {
  current: number;
  max:     number;
  isBoss?: boolean;
}

export function HPBar({ current, max, isBoss }: Props) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0;
  const barColor =
    pct >= 50 ? "var(--hl-pass)"
    : pct >= 20 ? "var(--hl-item)"
    : "var(--hl-fail)";

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
          height:       isBoss ? 6 : 4,
          background:   "var(--bg-2)",
          border:       "1px solid var(--line)",
          borderRadius: 2,
          overflow:     "hidden",
        }}
      >
        <div
          style={{
            width:      `${pct}%`,
            height:     "100%",
            background: barColor,
            transition: "width 300ms ease-out, background 300ms ease-out",
          }}
        />
      </div>
    </div>
  );
}
