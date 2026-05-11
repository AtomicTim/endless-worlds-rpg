"use client";

import React from "react";

/**
 * Day 20.4 TASK 3 — floating damage / heal number that animates
 * up from the top edge of a combatant's portrait. Stateless: the
 * parent (useCombat hook + CombatMode) owns the lifecycle and drops
 * the component after ~(1100 + startDelay)ms via the floatingByActor
 * map.
 *
 * Sized 28px / 36px on crit. Heal variants prefix with "+" via CSS
 * pseudo-element. Color is injected per call (combat-player /
 * combat-enemy / hl-pass).
 *
 * Day 20.4.2 TASK 2 — `startDelay` (ms) is applied via inline
 * `animationDelay`. The CSS rule uses `animation-fill-mode: both` so
 * the keyframes' 0% state (opacity 0, off-screen scale) applies
 * during the delay window — preventing a default-styled flash of
 * the number before the animation starts.
 */
interface Props {
  value:      number;
  kind:       "hit" | "crit" | "heal";
  color:      string;
  /** ms to wait before starting the visible animation. Defaults to 0. */
  startDelay?: number;
}

export function FloatingDamage({ value, kind, color, startDelay }: Props) {
  const cls =
    kind === "crit" ? "combat-float-damage combat-float-damage--crit"
    : kind === "heal" ? "combat-float-damage combat-float-damage--heal"
    : "combat-float-damage";
  const style: React.CSSProperties = { color };
  if (typeof startDelay === "number" && startDelay > 0) {
    style.animationDelay = `${startDelay}ms`;
  }
  return (
    <span
      className={cls}
      style={style}
      aria-hidden
    >
      {value}
    </span>
  );
}
