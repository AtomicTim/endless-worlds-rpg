"use client";

import React from "react";

/**
 * Day 20 Combat — bottom action button strip.
 *
 * Four buttons: Attack / Defend / Use Item / Flee. Plain text
 * labels (no icons per locked design). Disabled when it isn't the
 * player's turn or while the engine is mid-resolution. Use Item
 * also disables when the player has no consumables.
 */
interface Props {
  disabled:           boolean;
  hasConsumables:     boolean;
  onAttack:           () => void;
  onDefend:           () => void;
  onUseItem:          () => void;
  onFlee:             () => void;
  /** Set when target picker is active so Attack stays highlighted. */
  attackTargeting?:   boolean;
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
        padding:        "10px 12px",
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
  disabled, hasConsumables, onAttack, onDefend, onUseItem, onFlee, attackTargeting,
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
      <ActionBtn label="Attack"   disabled={disabled} active={attackTargeting} onClick={onAttack} />
      <ActionBtn label="Defend"   disabled={disabled}                    onClick={onDefend} />
      <ActionBtn label="Use Item" disabled={disabled || !hasConsumables} onClick={onUseItem} />
      <ActionBtn label="Flee"     disabled={disabled}                    onClick={onFlee} />
    </div>
  );
}
