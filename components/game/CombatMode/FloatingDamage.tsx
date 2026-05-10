"use client";

import React from "react";

/**
 * Day 20.4 TASK 3 — floating damage / heal number that animates
 * up from the top edge of a combatant's portrait. Stateless: the
 * parent (CombatMode) owns the lifecycle and drops the component
 * after ~1100ms via the floatingByActor map.
 *
 * Sized 28px / 36px on crit. Heal variants prefix with "+" via CSS
 * pseudo-element. Color is injected per call (combat-player /
 * combat-enemy / hl-pass).
 */
interface Props {
  value: number;
  kind:  "hit" | "crit" | "heal";
  color: string;
}

export function FloatingDamage({ value, kind, color }: Props) {
  const cls =
    kind === "crit" ? "combat-float-damage combat-float-damage--crit"
    : kind === "heal" ? "combat-float-damage combat-float-damage--heal"
    : "combat-float-damage";
  return (
    <span
      className={cls}
      style={{ color }}
      aria-hidden
    >
      {value}
    </span>
  );
}
