"use client";

import React from "react";

/**
 * Floating damage / heal number that arcs upward from the host
 * container's bottom edge. Stateless: the parent (useCombat hook
 * + CombatMode) owns the lifecycle and drops the component after
 * its animation completes via the floatingByActor map.
 *
 * PR-11v-b — five arc keyframes (left / right / left-wide /
 * right-wide / up) live in globals.css. The arc is chosen per
 * call by makeFloatingEntry — crits get the wide variants and
 * 3 particle dots scatter in their wake. The animation duration
 * varies by damage type so fire / lightning reads as fast and
 * frost / cold reads as slow.
 *
 * Day 20.4.2 — `startDelay` (ms) is applied via inline
 * `animationDelay`. The CSS rule uses `animation-fill-mode: both`
 * so the 0% keyframe (opacity 0, off-screen scale) applies during
 * the delay window — preventing a default-styled flash before the
 * animation starts.
 */
interface Props {
  value:      number;
  kind:       "hit" | "crit" | "heal";
  color:      string;
  /** ms to wait before starting the visible animation. Defaults to 0. */
  startDelay?: number;
  /** PR-11v-b — arc direction + width. Defaults to "left". */
  arc?: "left" | "right" | "left-wide" | "right-wide" | "up";
  /** PR-11v-b — animation duration in ms. Defaults to the CSS rule
   *  (1100ms). Provided per damage type by makeFloatingEntry. */
  animDuration?: number;
}

const ARC_TO_ANIMATION: Record<NonNullable<Props["arc"]>, string> = {
  "left":       "combat-float-left",
  "right":      "combat-float-right",
  "left-wide":  "combat-float-left-wide",
  "right-wide": "combat-float-right-wide",
  "up":         "combat-float-up",
};

export function FloatingDamage({
  value, kind, color, startDelay, arc, animDuration,
}: Props) {
  const cls =
    kind === "crit" ? "combat-float-damage combat-float-damage--crit"
    : kind === "heal" ? "combat-float-damage combat-float-damage--heal"
    : "combat-float-damage";

  const style: React.CSSProperties = {
    color,
    animationName: ARC_TO_ANIMATION[arc ?? "left"],
    animationTimingFunction: "ease-out",
    animationFillMode: "both",
  };
  if (typeof animDuration === "number" && animDuration > 0) {
    style.animationDuration = `${animDuration}ms`;
  }
  if (typeof startDelay === "number" && startDelay > 0) {
    style.animationDelay = `${startDelay}ms`;
  }

  // PR-11v-b — crit particles inherit the delay so they fire in
  // step with the main number (they have their own 600ms duration
  // and animation name set via the CSS class).
  const particleStyle: React.CSSProperties = { color };
  if (typeof startDelay === "number" && startDelay > 0) {
    particleStyle.animationDelay = `${startDelay}ms`;
  }

  return (
    <React.Fragment>
      <span className={cls} style={style} aria-hidden>
        {value}
      </span>
      {kind === "crit" && (
        <>
          <span
            className="combat-float-particle combat-float-particle--a"
            style={particleStyle}
            aria-hidden
          />
          <span
            className="combat-float-particle combat-float-particle--b"
            style={particleStyle}
            aria-hidden
          />
          <span
            className="combat-float-particle combat-float-particle--c"
            style={particleStyle}
            aria-hidden
          />
          {/* PR-11v-b HF2 — "CRIT" label rides the same arc as the
              number so the two stay locked together during the float.
              Anchored 16px below the number's baseline; inherits the
              crit colour so it reads as a continuation of the hit. */}
          <span
            style={{
              position:                "absolute",
              left:                    "50%",
              transform:               "translateX(-50%)",
              bottom:                  "-16px",
              fontSize:                "10px",
              fontFamily:              "var(--mono)",
              fontWeight:              700,
              letterSpacing:           "0.18em",
              color,
              opacity:                 0.9,
              pointerEvents:           "none",
              whiteSpace:              "nowrap",
              animationName:           style.animationName ?? "combat-float-left",
              animationDuration:       style.animationDuration ?? "1100ms",
              animationTimingFunction: "ease-out",
              animationFillMode:       "both",
              animationDelay:          style.animationDelay,
            }}
            aria-hidden
          >
            CRIT
          </span>
        </>
      )}
    </React.Fragment>
  );
}
