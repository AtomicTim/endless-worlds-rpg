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
 * the player taps "Abilities". Shows the 4 equipped slot cards.
 *
 * PR-11v-c — 2-click flow. Tapping a card no longer dispatches
 * immediately; instead it selects the card and surfaces a
 * confirmation strip with "Use →" / "Choose Target →" / "Cancel".
 * Layout went from a single horizontal flex row to a desktop-4 /
 * mobile-2 grid so each card has room for type badge, name,
 * description, and the explicit charge/cooldown status line.
 *
 * The selection-vs-dispatch split is purely UI — handleSlotTap
 * still owns charge validation + the empty-slot flash, and still
 * calls onSelect under the same conditions as before.
 *
 * Per the prompt, damage / debuff abilities (those whose effects
 * carry damage_die or target_status) need a target enemy chosen
 * before dispatch. The panel hands the resolved ability id back to
 * CombatMode, which then opens its existing target picker for
 * those abilities and dispatches directly for self-only abilities.
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
  const [flashSlot, setFlashSlot]       = useState<number | null>(null);
  // PR-11v-c — 2-click selection. null = no card armed; tapping the
  // armed card again toggles it back off. Confirmation strip below
  // the grid materialises only when a valid ability is armed.
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);

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
      {/* PR-11v-c — desktop 4-column / mobile 2-column grid. Scoped so
          the desktop flex/grid doesn't need its own breakpoint
          machinery elsewhere. */}
      <style>{`
        .ew-ability-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 6px;
        }
        @media (max-width: 480px) {
          .ew-ability-grid { grid-template-columns: repeat(2, 1fr); }
        }
      `}</style>

      {/* Header — class/name tag on the left, close glyph on the right. */}
      <div
        style={{
          display:        "flex",
          justifyContent: "space-between",
          alignItems:     "center",
          padding:        "6px 0",
          marginBottom:   6,
          borderBottom:   "1px solid var(--ui-border-default)",
        }}
      >
        <span
          style={{
            fontFamily:    "var(--ui-sans)",
            fontSize:      11,
            fontWeight:    700,
            letterSpacing: "0.18em",
            color:         "var(--genre-accent)",
            display:       "flex",
            alignItems:    "center",
            gap:           6,
          }}
        >
          ✦ ABILITIES — {player.name.toUpperCase()} ·{" "}
          {player.background.replace(/_/g, " ").toUpperCase()}
        </span>
        <button
          type="button"
          onClick={onBack}
          style={{
            background: "transparent",
            border:     "none",
            color:      "var(--ui-text-muted)",
            cursor:     "pointer",
            fontSize:   16,
            lineHeight: 1,
            padding:    "2px 4px",
          }}
          aria-label="Close abilities"
        >
          ∨
        </button>
      </div>

      <div className="ew-ability-grid">
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
          const isSelected = selectedSlot === slotIdx;

          const cardDisabled = disabled || !unlocked || !ability_id || remaining <= 0;

          // PR-11v-c — card surface state. Selected wins over available.
          // Disabled cards (empty / locked / no charges / enemy turn)
          // share the muted look; the flash override fires on a 0-charge
          // tap so the player gets immediate "you tried but can't" feedback.
          let cardBackground: string;
          let cardBorder:     string;
          if (flashing) {
            cardBackground = "color-mix(in srgb, var(--hl-fail) 30%, var(--bg-2))";
            cardBorder     = "1px solid var(--hl-fail)";
          } else if (isSelected) {
            cardBackground = "color-mix(in srgb, var(--genre-accent) 12%, var(--bg-2))";
            cardBorder     = "1px solid var(--genre-accent)";
          } else if (cardDisabled) {
            cardBackground = "var(--bg-2)";
            cardBorder     = "1px solid var(--ui-border-default)";
          } else {
            cardBackground = "var(--bg-2)";
            cardBorder     = "1px solid rgba(var(--genre-accent-rgb), 0.35)";
          }

          return (
            <button
              key={slotIdx}
              type="button"
              onClick={() => {
                // PR-11v-c — clicking an unavailable card (locked /
                // empty / no charges) still routes through handleSlotTap
                // so the 0-charge flash + the no-op locked/empty
                // branches behave exactly as before. Clicking an
                // available card toggles the selection; the actual
                // dispatch fires from the confirm strip below.
                if (cardDisabled) {
                  handleSlotTap(slotIdx);
                  return;
                }
                setSelectedSlot(isSelected ? null : slotIdx);
              }}
              disabled={disabled}
              style={{
                padding:        "10px 10px",
                background:     cardBackground,
                border:         cardBorder,
                borderRadius:   6,
                color:          "var(--ui-text-1)",
                opacity:        cardDisabled ? 0.45 : 1,
                cursor:         cardDisabled ? "not-allowed" : "pointer",
                display:        "flex",
                flexDirection:  "column",
                alignItems:     "flex-start",
                gap:            4,
                textAlign:      "left",
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
              {tmpl ? (
                <>
                  <span
                    style={{
                      fontSize:       9,
                      letterSpacing:  "0.16em",
                      color:          "var(--ui-text-muted)",
                      textTransform:  "uppercase",
                      fontFamily:     "var(--mono)",
                    }}
                  >
                    {tmpl.category.toUpperCase()} · ACTIVE
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--ui-sans)",
                      fontSize:   12,
                      fontWeight: 700,
                      color:      cardDisabled ? "var(--ui-text-muted)" : "var(--ui-text-1)",
                      lineHeight: 1.2,
                    }}
                  >
                    {tmpl.base_name}
                  </span>
                  {tmpl.description && (
                    <span
                      className="ew-serif"
                      style={{
                        fontSize:        10,
                        fontStyle:       "italic",
                        lineHeight:      1.4,
                        color:           "var(--ui-text-muted)",
                        display:         "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow:        "hidden",
                      }}
                    >
                      {tmpl.description}
                    </span>
                  )}
                  <span
                    className="ew-mono"
                    style={{
                      fontSize:  10,
                      marginTop: "auto",
                      color:     remaining > 0
                        ? "var(--genre-accent)"
                        : "var(--hl-fail)",
                    }}
                  >
                    {remaining > 0
                      ? `Ready · ${remaining} use${remaining === 1 ? "" : "s"} remaining`
                      : "Cooldown · no charges"}
                  </span>
                </>
              ) : (
                <span
                  className="ew-mono"
                  style={{
                    fontSize:  10,
                    color:     "var(--ui-text-muted)",
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

      {/* PR-11v-c — confirmation strip. Materialises only when a
          slot is selected AND that slot holds a valid template.
          The "Use" button routes through handleSlotTap so the
          existing charge/lock/empty gates stay authoritative. */}
      {selectedSlot !== null && (() => {
        const ability_id = slots[selectedSlot];
        const tmpl = ability_id ? ABILITY_LIBRARY[ability_id] : null;
        if (!tmpl) return null;
        const needsTarget = abilityNeedsTarget(tmpl);
        return (
          <div
            style={{
              display:        "flex",
              alignItems:     "center",
              justifyContent: "space-between",
              gap:            8,
              marginTop:      6,
              padding:        "8px 10px",
              background:     "rgba(var(--genre-accent-rgb), 0.08)",
              border:         "1px solid rgba(var(--genre-accent-rgb), 0.30)",
              borderRadius:   6,
            }}
          >
            <span
              style={{
                fontFamily: "var(--ui-sans)",
                fontSize:   12,
                fontWeight: 600,
                color:      "var(--ui-text-1)",
              }}
            >
              {tmpl.base_name}
            </span>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button
                type="button"
                onClick={() => setSelectedSlot(null)}
                style={{
                  background: "transparent",
                  border:     "none",
                  color:      "var(--ui-text-muted)",
                  cursor:     "pointer",
                  fontSize:   11,
                  fontFamily: "var(--ui-sans)",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const slot = selectedSlot;
                  setSelectedSlot(null);
                  if (slot !== null) {
                    handleSlotTap(slot as 0 | 1 | 2 | 3);
                  }
                }}
                style={{
                  padding:    "6px 14px",
                  background: "var(--genre-accent)",
                  border:     "none",
                  borderRadius: 6,
                  color:      "#0a0a0a",
                  fontFamily: "var(--ui-sans)",
                  fontSize:   12,
                  fontWeight: 700,
                  cursor:     "pointer",
                }}
              >
                {needsTarget ? "Choose Target →" : "Use →"}
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
