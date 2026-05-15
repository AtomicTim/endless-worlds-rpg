"use client";

import React, { useState } from "react";
import type {
  AbilityId, AbilityTemplate, PlayerState,
} from "@/types/game";
import {
  ABILITY_LIBRARY,
  computeMaxCharges,
  isSlotUnlocked,
} from "@/lib/game/abilities";

/**
 * P7 — inline ability panel. Replaces the ActionBar button row when
 * the player taps "Abilities". Shows the 4 equipped slot cards:
 *
 *   • Ability name (Cormorant Garamond italic, 12px)
 *   • Charges remaining: "N / M" (JetBrains Mono)
 *   • Locked slot (level gated) shows "— locked"
 *   • Empty slot (unlocked but null) shows "— empty"
 *   • Tap with charges > 0 → onSelect(ability_id)
 *   • Tap with 0 charges → onNoCharges() flash (no submit)
 *
 * "← Back" link at the top returns to the normal action bar without
 * submitting anything.
 *
 * Per the prompt, damage / debuff abilities (those whose effects carry
 * `damage_die` or `target_status`) need a target enemy chosen before
 * dispatch. The panel hands the resolved ability id back to CombatMode,
 * which then opens its existing target picker for those abilities and
 * dispatches directly for self-only abilities.
 */
interface Props {
  player:                PlayerState;
  /** Per-id charge usage from CombatState.ability_charges_used. */
  chargesUsed?:          Record<AbilityId, number>;
  /** Engine is mid-resolution / enemy turn — dim and disable. */
  disabled:              boolean;
  onSelect:              (abilityId: AbilityId) => void;
  onBack:                () => void;
}

/** True when the ability either deals damage or applies a target status —
 *  i.e. it needs an enemy to dispatch against. */
export function abilityNeedsTarget(template: AbilityTemplate): boolean {
  const eff = template.effects;
  if (!eff) return false;
  if (eff.damage_die) return true;
  if (eff.target_status) return true;
  return false;
}

export function AbilityPanel({
  player, chargesUsed, disabled, onSelect, onBack,
}: Props) {
  const [flashSlot, setFlashSlot] = useState<number | null>(null);

  const slots = player.equipped_ability_slots ?? [null, null, null, null];

  const handleSlotTap = (slotIdx: 0 | 1 | 2 | 3) => {
    if (disabled) return;
    const ability_id = slots[slotIdx];
    if (!ability_id) return;                       // empty / not slotted
    const tmpl = ABILITY_LIBRARY[ability_id];
    if (!tmpl) return;
    if (!isSlotUnlocked((slotIdx + 1) as 1 | 2 | 3 | 4, player.level)) return;

    const used = chargesUsed?.[ability_id] ?? 0;
    const max  = computeMaxCharges(
      tmpl, player.level, player.attributes, player.perk_charge_bonus ?? 0,
    );
    if (used >= max) {
      // No charges — brief flash, no submit.
      setFlashSlot(slotIdx);
      setTimeout(() => setFlashSlot((v) => (v === slotIdx ? null : v)), 600);
      return;
    }
    onSelect(ability_id);
  };

  return (
    <div
      role="region"
      aria-label="Abilities"
      style={{
        display:       "flex",
        flexDirection: "column",
        gap:           6,
        padding:       "8px 12px",
        borderTop:     "1px solid var(--line)",
        background:    "var(--bg-1)",
        opacity:       disabled ? 0.3 : 1,
        transition:    "opacity 120ms",
      }}
    >
      <button
        type="button"
        onClick={onBack}
        className="ew-mono"
        style={{
          alignSelf:     "flex-start",
          background:    "transparent",
          border:        "none",
          color:         "var(--ink-3)",
          cursor:        "pointer",
          fontSize:      10,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          padding:       "2px 4px",
        }}
      >
        ← Back
      </button>

      <div
        style={{
          display: "flex",
          gap:     6,
        }}
      >
        {([0, 1, 2, 3] as const).map((slotIdx) => {
          const slotNum   = (slotIdx + 1) as 1 | 2 | 3 | 4;
          const ability_id = slots[slotIdx];
          const unlocked  = isSlotUnlocked(slotNum, player.level);
          const tmpl      = ability_id ? ABILITY_LIBRARY[ability_id] : null;
          const used      = ability_id ? (chargesUsed?.[ability_id] ?? 0) : 0;
          const max       = tmpl
            ? computeMaxCharges(
                tmpl, player.level, player.attributes, player.perk_charge_bonus ?? 0,
              )
            : 0;
          const remaining = Math.max(0, max - used);
          const flashing  = flashSlot === slotIdx;

          const cardDisabled = disabled || !unlocked || !ability_id || remaining <= 0;

          return (
            <button
              key={slotIdx}
              type="button"
              onClick={() => handleSlotTap(slotIdx)}
              disabled={disabled}
              style={{
                flex:           1,
                minWidth:       0,
                padding:        "10px 8px",
                background:     flashing
                  ? "color-mix(in srgb, var(--hl-fail) 30%, var(--bg-2))"
                  : "var(--bg-2)",
                border:         flashing
                  ? "1px solid var(--hl-fail)"
                  : (unlocked && tmpl && remaining > 0
                      ? "1px solid var(--accent)"
                      : "1px solid var(--line-2)"),
                borderRadius:   3,
                color:          cardDisabled ? "var(--ink-4)" : "var(--ink-1)",
                opacity:        cardDisabled ? 0.5 : 1,
                cursor:         cardDisabled ? "not-allowed" : "pointer",
                display:        "flex",
                flexDirection:  "column",
                alignItems:     "center",
                justifyContent: "center",
                gap:            4,
                transition:     "background 120ms, border-color 120ms, opacity 120ms",
              }}
              aria-label={
                tmpl
                  ? `Slot ${slotNum}: ${tmpl.base_name} (${remaining} of ${max} charges)`
                  : unlocked
                    ? `Slot ${slotNum} empty`
                    : `Slot ${slotNum} locked`
              }
            >
              <span
                className="ew-mono"
                style={{
                  fontSize:      9,
                  letterSpacing: "0.18em",
                  color:         "var(--ink-3)",
                  textTransform: "uppercase",
                }}
              >
                Slot {slotNum}
              </span>
              {tmpl ? (
                <>
                  <span
                    className="ew-serif"
                    style={{
                      fontSize:   12,
                      fontStyle:  "italic",
                      lineHeight: 1.2,
                      textAlign:  "center",
                    }}
                  >
                    {tmpl.base_name}
                  </span>
                  <span
                    className="ew-mono"
                    style={{
                      fontSize: 10,
                      color:    remaining > 0 ? "var(--accent)" : "var(--hl-fail)",
                    }}
                  >
                    {remaining} / {max}
                  </span>
                </>
              ) : (
                <span
                  className="ew-mono"
                  style={{
                    fontSize:  10,
                    color:     "var(--ink-4)",
                    fontStyle: "italic",
                  }}
                >
                  — {unlocked ? "empty" : "locked"}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
