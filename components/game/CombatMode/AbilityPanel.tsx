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
 * Click flow (HF-ability-panel-targeting):
 *   Damage / debuff (needsTarget=true):
 *     1 click → the card ARMS (highlighted border + "Choose Target →"
 *     replaces the charge line + the other cards dim). The panel stays
 *     open; CombatMode enters targeting mode with the enemy cards
 *     (visible above the panel) made tappable. Tapping the armed card
 *     again, or its "Cancel" control, disarms. Tapping an enemy fires
 *     the ability and closes the panel. The armed ability is lifted to
 *     CombatMode (pendingAbilityId) and threaded back in as
 *     `armedAbilityId` so this panel and the target picker agree on
 *     which slot is live.
 *
 *   Buff / heal (needsTarget=false):
 *     1 click → card highlights + "Use →" / "Cancel" appear.
 *     Click "Use →" → fires (solo party dispatches immediately;
 *     future party members will surface a party picker here).
 *
 * Card outer element is <div role="button"> so the Cancel / Use
 * <button> children inside the selected card don't violate the HTML
 * spec (<button> cannot descend from <button>).
 */
interface Props {
  player:                PlayerState;
  chargesUsed?:          Record<AbilityId, number>;
  disabled:              boolean;
  /** HF-ability-panel-targeting — the damage/debuff ability currently
   *  armed for targeting (lifted to CombatMode as pendingAbilityId).
   *  When set, that slot's card renders in the armed "Choose Target →"
   *  state and the other cards dim. Null/absent = normal panel. */
  armedAbilityId?:       AbilityId | null;
  onSelect:              (abilityId: AbilityId) => void;
  /** Clear the armed ability and return the panel to its normal state. */
  onCancelArmed?:        () => void;
  onBack:                () => void;
}

/** True when the ability either deals damage or applies a target status. */
export function abilityNeedsTarget(template: AbilityTemplate): boolean {
  const eff = template.effects;
  if (!eff) return false;
  if (eff.damage_die) return true;
  if (eff.target_status) return true;
  return false;
}

export function AbilityPanel({
  player, chargesUsed, disabled, armedAbilityId, onSelect, onCancelArmed, onBack,
}: Props) {
  const [flashSlot, setFlashSlot]       = useState<number | null>(null);
  // selectedSlot is only used for buff/heal abilities (needsTarget=false).
  // Damage/debuff abilities skip this state and dispatch immediately.
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);

  const slots = player.equipped_ability_slots ?? [null, null, null, null];

  const handleSlotTap = (slotIdx: 0 | 1 | 2 | 3) => {
    if (disabled) return;
    const ability_id = slots[slotIdx];
    if (!ability_id) return;
    const tmpl = ABILITY_LIBRARY[ability_id];
    if (!tmpl) return;
    if (!isSlotUnlocked((slotIdx + 1) as 1 | 2 | 3 | 4, player.level)) return;

    const used = chargesUsed?.[ability_id] ?? 0;
    const max  = computeMaxCharges(
      tmpl, player.level, player.attributes, player.perk_charge_bonus ?? 0,
    );
    if (used >= max) {
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
      <style>{`
        .ew-ability-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 6px;
        }
        @media (max-width: 480px) {
          .ew-ability-grid { grid-template-columns: repeat(2, 1fr); }
        }
        .ew-ability-card:focus-visible {
          outline: 2px solid var(--genre-accent);
          outline-offset: 2px;
        }
      `}</style>

      {/* Header */}
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
            background:    "transparent",
            border:        "1px solid var(--ui-border-default)",
            borderRadius:  4,
            color:         "var(--ui-text-1)",
            cursor:        "pointer",
            fontSize:      11,
            fontFamily:    "var(--ui-sans)",
            fontWeight:    600,
            padding:       "3px 10px",
            letterSpacing: "0.05em",
          }}
        >
          ← Back
        </button>
      </div>

      <div className="ew-ability-grid">
        {([0, 1, 2, 3] as const).map((slotIdx) => {
          const slotNum    = (slotIdx + 1) as 1 | 2 | 3 | 4;
          const ability_id = slots[slotIdx];
          const unlocked   = isSlotUnlocked(slotNum, player.level);
          const tmpl       = ability_id ? ABILITY_LIBRARY[ability_id] : null;
          const used       = ability_id ? (chargesUsed?.[ability_id] ?? 0) : 0;
          const max        = tmpl
            ? computeMaxCharges(
                tmpl, player.level, player.attributes, player.perk_charge_bonus ?? 0,
              )
            : 0;
          const remaining   = Math.max(0, max - used);
          const flashing    = flashSlot === slotIdx;
          const isSelected  = selectedSlot === slotIdx;
          const needsTarget = tmpl ? abilityNeedsTarget(tmpl) : false;
          // HF-ability-panel-targeting — this card is the live damage/debuff
          // ability awaiting a target pick. `anyArmed` dims the non-armed
          // cards so the armed one reads as the single active choice.
          const isArmed  = !!armedAbilityId && ability_id === armedAbilityId && needsTarget;
          const anyArmed = !!armedAbilityId;
          const dimmed   = anyArmed && !isArmed;

          const cardDisabled = disabled || !unlocked || !ability_id || remaining <= 0;

          let cardBackground: string;
          let cardBorder:     string;
          if (flashing) {
            cardBackground = "color-mix(in srgb, var(--hl-fail) 30%, var(--bg-2))";
            cardBorder     = "1px solid var(--hl-fail)";
          } else if (isArmed) {
            cardBackground = "color-mix(in srgb, var(--genre-accent) 18%, var(--bg-2))";
            cardBorder     = "2px solid var(--genre-accent)";
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

          const handleCardClick = () => {
            if (disabled) return;
            if (cardDisabled) {
              // No charges / locked / empty — flash and bail.
              handleSlotTap(slotIdx);
              return;
            }
            if (needsTarget) {
              // Damage / debuff: arm the card and keep the panel open so
              // the player can see what they armed while picking a target.
              // Clears any pending buff/heal selection.
              setSelectedSlot(null);
              if (isArmed) {
                // Tapping the armed card again disarms it.
                onCancelArmed?.();
                return;
              }
              handleSlotTap(slotIdx);
              return;
            }
            // Buff / heal: arm the card so "Use →" / "Cancel" appear.
            setSelectedSlot(isSelected ? null : slotIdx);
          };

          return (
            <div
              key={slotIdx}
              role="button"
              tabIndex={disabled ? -1 : 0}
              className="ew-ability-card"
              onClick={handleCardClick}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleCardClick();
                }
              }}
              aria-label={
                tmpl
                  ? `Slot ${slotNum}: ${tmpl.base_name} (${remaining} of ${max} charges)`
                  : unlocked
                    ? `Slot ${slotNum} empty`
                    : `Slot ${slotNum} locked`
              }
              aria-pressed={isSelected}
              style={{
                padding:       "10px 10px",
                background:    cardBackground,
                border:        cardBorder,
                borderRadius:  6,
                color:         "var(--ui-text-1)",
                opacity:       cardDisabled ? 0.45 : dimmed ? 0.5 : 1,
                cursor:        cardDisabled ? "not-allowed" : "pointer",
                display:       "flex",
                flexDirection: "column",
                alignItems:    "flex-start",
                gap:           4,
                textAlign:     "left",
                userSelect:    "none",
                transition:    "background 120ms, border-color 120ms, opacity 120ms",
              }}
            >
              {tmpl ? (
                <>
                  <span
                    style={{
                      fontSize:      9,
                      letterSpacing: "0.16em",
                      color:         "var(--ui-text-muted)",
                      textTransform: "uppercase",
                      fontFamily:    "var(--mono)",
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
                        color:           "var(--ui-text-2)",
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
                      fontSize:   10,
                      marginTop:  "auto",
                      fontWeight: isArmed ? 700 : 400,
                      color:      isArmed
                        ? "var(--genre-accent)"
                        : remaining > 0 ? "var(--genre-accent)" : "var(--hl-fail)",
                    }}
                  >
                    {isArmed
                      ? "Choose Target →"
                      : remaining > 0
                        ? `Ready · ${remaining} use${remaining === 1 ? "" : "s"} remaining`
                        : "Cooldown · no charges"}
                  </span>

                  {/* Cancel row — armed damage/debuff card. Disarms and
                      returns the panel to its normal state. */}
                  {isArmed && (
                    <div
                      style={{
                        display:    "flex",
                        marginTop:  6,
                        paddingTop: 6,
                        borderTop:  "1px solid rgba(var(--genre-accent-rgb), 0.20)",
                        width:      "100%",
                      }}
                    >
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onCancelArmed?.(); }}
                        style={{
                          flex:         1,
                          padding:      "4px 0",
                          background:   "transparent",
                          border:       "1px solid var(--ui-border-default)",
                          borderRadius: 4,
                          color:        "var(--ui-text-muted)",
                          fontFamily:   "var(--ui-sans)",
                          fontSize:     10,
                          cursor:       "pointer",
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  )}

                  {/* Confirmation row — only for buff/heal (needsTarget=false).
                      Damage/debuff skip straight to the target picker on click. */}
                  {isSelected && !cardDisabled && !needsTarget && (
                    <div
                      style={{
                        display:    "flex",
                        gap:        6,
                        marginTop:  6,
                        paddingTop: 6,
                        borderTop:  "1px solid rgba(var(--genre-accent-rgb), 0.20)",
                        width:      "100%",
                      }}
                    >
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setSelectedSlot(null); }}
                        style={{
                          flex:         1,
                          padding:      "4px 0",
                          background:   "transparent",
                          border:       "1px solid var(--ui-border-default)",
                          borderRadius: 4,
                          color:        "var(--ui-text-muted)",
                          fontFamily:   "var(--ui-sans)",
                          fontSize:     10,
                          cursor:       "pointer",
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedSlot(null);
                          handleSlotTap(slotIdx);
                        }}
                        style={{
                          flex:         2,
                          padding:      "4px 0",
                          background:   "var(--genre-accent)",
                          border:       "none",
                          borderRadius: 4,
                          color:        "#0a0a0a",
                          fontFamily:   "var(--ui-sans)",
                          fontSize:     10,
                          fontWeight:   700,
                          cursor:       "pointer",
                        }}
                      >
                        Use →
                      </button>
                    </div>
                  )}
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
            </div>
          );
        })}
      </div>
    </div>
  );
}
