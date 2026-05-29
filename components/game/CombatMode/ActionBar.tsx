"use client";

import React from "react";
import { ItemType } from "@/types/game";
import type { PlayerState } from "@/types/game";

/**
 * Day 20 Combat — bottom action button strip.
 *
 * P7 — five buttons: Attack / Defend / Use Item / Abilities / Flee.
 * Disabled when it isn't the player's turn or while the engine is
 * mid-resolution. Use Item also disables when the player has no
 * consumables. Abilities disables when the player has no equipped
 * slot abilities.
 *
 * PR-11v-a — each button now renders icon + label + subtitle. The
 * subtitle is a short context line (weapon + die, evasion bonus,
 * consumable count, AGI vs flee DC, available ability count) so the
 * player can read the tactical state without opening a sub-menu.
 * Icons are inline SVGs wrapped in a CombatIcon component so a
 * future swap to a real icon library is a one-file change.
 *
 * UI-design-reference §8: "Desktop: 5 buttons horizontal · Mobile:
 * 2×2 grid (existing 4) + one full-width 'Abilities' button below".
 * Implemented via a scoped className + @media block at ≤480px.
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
  /** PR-11v-a — full player snapshot drives the action subtitles
   *  (weapon name + die, consumable count, equipped ability count). */
  player?:            PlayerState;
  /** PR-11v-a — AGI check DC surfaced under the Flee button. */
  fleeDc?:            number;
}

// ── PR-11v-a — icons ─────────────────────────────────────────────────────
// Inline SVGs sized to 20×20. fill="none", stroke={color}, strokeWidth=1.5,
// rounded caps + joins. Wrapped in CombatIcon so a future swap to a real
// icon library (lucide / heroicons / custom set) is a one-file change.

interface CombatIconProps {
  name:  "attack" | "defend" | "use_item" | "flee" | "abilities";
  color: string;
}

function CombatIcon({ name, color }: CombatIconProps) {
  // PR-11v-a HF2 — render size lifted to 24px so icons read more
  // confidently in the action bar; viewBox stays "0 0 20 20" so the
  // paths don't need redrawing.
  const common = {
    width:           24,
    height:          24,
    viewBox:         "0 0 20 20",
    fill:            "none",
    stroke:          color,
    strokeWidth:     1.5,
    strokeLinecap:   "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden":   true,
  };

  switch (name) {
    case "attack":
      // Simple diagonal sword: blade + crossguard + grip.
      return (
        <svg {...common}>
          <path d="M3.5 16.5 L13 7" />
          <path d="M13 7 L16.5 3.5 L14.5 6 L11 9.5" />
          <path d="M11.5 12 L8 8.5" />
          <path d="M5.5 14.5 L3.5 16.5 L5 18" />
        </svg>
      );
    case "defend":
      // Classic shield outline with a single mid-rib.
      return (
        <svg {...common}>
          <path d="M10 2.5 L16 4.5 V10 C16 13.5 13.5 16.5 10 17.5 C6.5 16.5 4 13.5 4 10 V4.5 Z" />
          <path d="M10 6 V14" />
        </svg>
      );
    case "use_item":
      // Backpack: rounded body + top flap + strap arc.
      return (
        <svg {...common}>
          <path d="M5 7 V16 A1 1 0 0 0 6 17 H14 A1 1 0 0 0 15 16 V7" />
          <path d="M5 7 H15" />
          <path d="M8 4.5 A2 2 0 0 1 12 4.5 V7" />
          <path d="M7.5 11 H12.5" />
        </svg>
      );
    case "flee":
      // PR-11v-b — running figure facing right. Head + torso + two
      // arms (leading swings back, trailing swings forward) + two
      // legs (leading forward, trailing back) so the silhouette
      // reads as mid-sprint at a glance.
      return (
        <svg {...common}>
          <circle cx="13.5" cy="3.5" r="2" />
          <line x1="13" y1="5.5" x2="10" y2="11" />
          <line x1="11.5" y1="7.5" x2="15" y2="10.5" />
          <line x1="11.5" y1="7.5" x2="8" y2="6" />
          <path d="M10 11 L13 14.5 L15.5 18" />
          <path d="M10 11 L8.5 14.5 L6 18" />
        </svg>
      );
    case "abilities":
      // Three sparkle stars (✦ cluster).
      return (
        <svg {...common}>
          <path d="M10 3 L11 6 L14 7 L11 8 L10 11 L9 8 L6 7 L9 6 Z" />
          <path d="M5 13 L5.6 14.5 L7 15 L5.6 15.5 L5 17 L4.4 15.5 L3 15 L4.4 14.5 Z" />
          <path d="M15 13 L15.6 14.5 L17 15 L15.6 15.5 L15 17 L14.4 15.5 L13 15 L14.4 14.5 Z" />
        </svg>
      );
  }
}

const ICON_COLORS = {
  attack:    "#c8922a",
  defend:    "#4a7cc8",
  use_item:  "#4a9a8a",
  flee:      "#c87060",
  abilities: "#9a6ac8",
} as const;

// ── PR-11v-a — button ────────────────────────────────────────────────────

interface BtnProps {
  iconName:  CombatIconProps["name"];
  iconColor: string;
  label:     string;
  subtitle:  string;
  disabled:  boolean;
  active?:   boolean;
  className?: string;
  onClick:   () => void;
}
function ActionBtn({
  iconName, iconColor, label, subtitle, disabled, active, className, onClick,
}: BtnProps) {
  // UI-10 CHANGE 3 — genre token shell, hover border brightens to
  // var(--genre-accent). Enemy-turn (disabled) drops opacity to 0.3.
  // PR-11v-a — taller content (icon + label + subtitle), padding lifted.
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={className}
      onMouseEnter={(e) => {
        if (disabled) return;
        (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--genre-accent)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.borderColor = active
          ? "var(--genre-accent)"
          : "var(--card-border)";
      }}
      style={{
        flex:            1,
        padding:         "14px 8px",
        background:      active
          ? "rgba(var(--genre-accent-rgb), 0.10)"
          : "var(--card-bg)",
        border:          active
          ? "1px solid var(--genre-accent)"
          : "1px solid var(--card-border)",
        // PR-11v-a HF2 — rounder corners, brighter label colour.
        borderRadius:    10,
        fontFamily:      "var(--ui-sans)",
        color:           disabled
          ? "#4a3818"
          : active
            ? "var(--genre-accent)"
            : "#d4c4a0",
        cursor:          disabled ? "not-allowed" : "pointer",
        opacity:         disabled ? 0.3 : 1,
        transition:      "background 120ms, border-color 120ms, color 120ms, opacity 120ms",
        display:         "flex",
        flexDirection:   "column",
        alignItems:      "center",
        gap:             4,
      }}
    >
      <CombatIcon name={iconName} color={disabled ? "#4a3818" : iconColor} />
      {/* PR-11v-a HF2 — title-case label in ui-sans, 13/700/0.05em.
          textTransform: uppercase removed so labels render as
          authored ("Use Item" instead of "USE ITEM"). */}
      <span
        style={{
          fontSize:      13,
          letterSpacing: "0.05em",
          fontWeight:    700,
          lineHeight:    1,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize:   11,
          color:      "var(--ui-text-muted)",
          fontFamily: "var(--mono)",
          lineHeight: 1.1,
          textAlign:  "center",
          maxWidth:   "100%",
          overflow:   "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {subtitle}
      </span>
    </button>
  );
}

// ── Subtitle helpers ─────────────────────────────────────────────────────

function attackSubtitle(player?: PlayerState): string {
  if (!player) return "Unarmed · 1d4";
  // Item.damage_die lives in the polymorphic `effect` record — see
  // combat-engine resolveAttack (weapon?.effect?.damage_die).
  const weapon = player.inventory.find(
    (i) => i.equipped && typeof i.effect?.damage_die === "string",
  );
  if (!weapon) return "Unarmed · 1d4";
  const die = String(weapon.effect?.damage_die ?? "1d4");
  return `${weapon.name} · ${die}`;
}

function useItemSubtitle(player?: PlayerState, hasConsumables?: boolean): string {
  if (!player || !hasConsumables) return "none";
  const count = player.inventory.filter((i) => i.type === ItemType.CONSUMABLE).length;
  return count > 0 ? `${count} in pack` : "none";
}

function fleeSubtitle(fleeDc?: number): string {
  return typeof fleeDc === "number" ? `AGI vs ${fleeDc}` : "AGI check";
}

function abilitiesSubtitle(player?: PlayerState): string {
  const count = (player?.equipped_ability_slots ?? []).filter(Boolean).length;
  return `${count} available`;
}

export function ActionBar({
  disabled, hasConsumables, hasAbilities, onAttack, onDefend, onUseItem,
  onAbilities, onFlee, attackTargeting, abilitiesActive, player, fleeDc,
}: Props) {
  return (
    <>
      {/* PR-11v-a — mobile 2×2 + full-width Abilities. Scoped so the
          desktop flex layout is unchanged. */}
      <style>{`
        .ew-combat-actionbar {
          display: flex;
          gap: 6px;
        }
        @media (max-width: 480px) {
          .ew-combat-actionbar {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 6px;
          }
          .ew-combat-actionbar .ew-combat-btn-abilities {
            grid-column: 1 / -1;
          }
        }
      `}</style>
      <div
        role="toolbar"
        aria-label="Combat actions"
        className="ew-combat-actionbar"
        style={{
          padding:    "8px 12px",
          borderTop:  "1px solid var(--line)",
          background: "var(--bg-1)",
        }}
      >
        <ActionBtn
          iconName="attack"
          iconColor={ICON_COLORS.attack}
          label="Attack"
          subtitle={attackSubtitle(player)}
          disabled={disabled}
          active={attackTargeting}
          onClick={onAttack}
        />
        <ActionBtn
          iconName="defend"
          iconColor={ICON_COLORS.defend}
          label="Defend"
          subtitle="+2 evasion"
          disabled={disabled}
          onClick={onDefend}
        />
        <ActionBtn
          iconName="use_item"
          iconColor={ICON_COLORS.use_item}
          label="Use Item"
          subtitle={useItemSubtitle(player, hasConsumables)}
          disabled={disabled || !hasConsumables}
          onClick={onUseItem}
        />
        <ActionBtn
          iconName="flee"
          iconColor={ICON_COLORS.flee}
          label="Flee"
          subtitle={fleeSubtitle(fleeDc)}
          disabled={disabled}
          onClick={onFlee}
        />
        <ActionBtn
          iconName="abilities"
          iconColor={ICON_COLORS.abilities}
          label="Abilities"
          subtitle={abilitiesSubtitle(player)}
          disabled={disabled || !hasAbilities}
          active={abilitiesActive}
          className="ew-combat-btn-abilities"
          onClick={onAbilities}
        />
      </div>
    </>
  );
}
