"use client";

import React from "react";

/**
 * Day 20 Combat — bottom action button strip.
 *
 * P7 — five buttons: Attack / Defend / Use Item / Abilities / Flee.
 * Plain text labels (no icons per locked design). Disabled when it
 * isn't the player's turn or while the engine is mid-resolution. Use
 * Item also disables when the player has no consumables. Abilities
 * disables when the player has no equipped slot abilities.
 *
 * UI-design-reference §8: "Desktop: 5 buttons horizontal · Mobile: 2×2
 * grid (existing 4) + one full-width 'Abilities' button below". This
 * v1 keeps the existing horizontal flex layout; UI-10 (Combat UI
 * Overhaul) will split desktop / mobile presentation.
 */
interface Props {
  disabled:           boolean;
  hasConsumables:     boolean;
  /** P7 — true when the player has at least one equipped ability id. */
  hasAbilities:       boolean;
  onAttack:           () => void;
  onDefend:           () => void;
  onUseItem:          () => void;
  onAbilities:        () => void;
  onFlee:             () => void;
  /** Set when target picker is active so Attack stays highlighted. */
  attackTargeting?:   boolean;
  /** P7 — set when the ability panel is open so the Abilities button
   *  reads as the active branch. */
  abilitiesActive?:   boolean;
}

interface BtnProps {
  label:    string;
  disabled: boolean;
  active?:  boolean;
  onClick:  () => void;
}
function ActionBtn({ label, disabled, active, onClick }: BtnProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        flex:           1,
        padding:        "14px 12px",
        background:     active ? "var(--accent-faint)" : "var(--bg-2)",
        border:         active ? "1px solid var(--accent)" : "1px solid var(--line-2)",
        borderRadius:   3,
        fontFamily:     "var(--mono)",
        fontSize:       11,
        letterSpacing:  "0.18em",
        textTransform:  "uppercase",
        color:          disabled ? "var(--ink-4)" : (active ? "var(--accent)" : "var(--ink-1)"),
        cursor:         disabled ? "not-allowed" : "pointer",
        opacity:        disabled ? 0.4 : 1,
        transition:     "background 120ms, border-color 120ms",
      }}
    >
      {label}
    </button>
  );
}

export function ActionBar({
  disabled, hasConsumables, hasAbilities, onAttack, onDefend, onUseItem,
  onAbilities, onFlee, attackTargeting, abilitiesActive,
}: Props) {
  return (
    <div
      role="toolbar"
      aria-label="Combat actions"
      style={{
        display:    "flex",
        gap:        6,
        padding:    "8px 12px",
        borderTop:  "1px solid var(--line)",
        background: "var(--bg-1)",
      }}
    >
      <ActionBtn label="Attack"    disabled={disabled} active={attackTargeting} onClick={onAttack} />
      <ActionBtn label="Defend"    disabled={disabled}                    onClick={onDefend} />
      <ActionBtn label="Use Item"  disabled={disabled || !hasConsumables} onClick={onUseItem} />
      <ActionBtn label="Abilities" disabled={disabled || !hasAbilities} active={abilitiesActive} onClick={onAbilities} />
      <ActionBtn label="Flee"      disabled={disabled}                    onClick={onFlee} />
    </div>
  );
}
