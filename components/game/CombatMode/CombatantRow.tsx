"use client";

import React from "react";
import type {
  ActiveStatusEffect, CombatEnemyInstance, PlayerState,
} from "@/types/game";
import type { WcdStatusAliasSource } from "@/lib/game/combat-narration/status-display";
import { PortraitSlot } from "./PortraitSlot";
import { HPBar } from "./HPBar";
import { StatusEffectPills } from "./StatusEffectPills";
import { FloatingDamage } from "./FloatingDamage";

/**
 * Day 20.4 TASK 3 — one floating-number entry pushed into the
 * portrait wrapper from the CombatMode parent. Each entry has a
 * unique key so React can track multiple in flight at once. Parent
 * removes entries after the 1100ms animation completes.
 *
 * Day 20.4.2 TASK 2 — `start_delay` (ms) lets the emitter stagger
 * back-to-back floats on the same host so they don't stack pixel-
 * on-pixel. The hook layer sets it; the FloatingDamage component
 * forwards it to the CSS `animation-delay` so the keyframes idle
 * (invisible) for that many ms before running. 0 means "fire now",
 * which is the common case.
 */
export interface FloatingDamageEntry {
  key:         string;
  value:       number;
  kind:        "hit" | "crit" | "heal";
  color:       string;
  start_delay?: number;
}

/**
 * Day 20 Combat — one combatant column.
 *
 * Top: portrait (large, ~128px target). Below: name (with crown ♛
 * prefix and bold weight when isBoss), HP bar, and — for enemies —
 * the weapon damage_die as a mono subtitle. PR-11v-a swapped the
 * old behavior_flavor description out for damage_die so the player
 * sees the immediate combat-relevant tell ("1d6+1") instead of the
 * narrative tag. When isTargetable: cursor pointer + glow. When
 * shake: applies the 400ms shake to the portrait.
 *
 * PR-11v-a — the outer div now renders as a visible card (rounded
 * border, padding, gap) so each combatant reads as its own panel.
 * Enemy cards flip border + box-shadow to a critical red and pin
 * a "CRIT" badge in the top-right corner when HP drops to ≤10% of
 * max — a fast visual tell for the player without touching combat
 * resolution. The card outer div is also the position:relative
 * anchor for that badge.
 */

interface PlayerProps {
  combatant:       PlayerState;
  isPlayer:        true;
  isTargetable?:   false;
  onTargetClick?:  never;
  shake?:          boolean;
  /** Day 20.4 TASK 3 — currently-animating floating numbers. */
  floatingDamage?: FloatingDamageEntry[];
  /** Prompt 5 — active status effects on the player. Rendered as a
   *  pill row below the HP bar; omitted/empty hides the row. */
  statusEffects?:  ActiveStatusEffect[];
  /** Prompt 5 — WCD for status-effect alias lookup (world-native pill
   *  names). Optional — pills fall back to the capitalized id. */
  wcd?:            WcdStatusAliasSource;
}
interface EnemyProps {
  combatant:       CombatEnemyInstance;
  isPlayer:        false;
  isTargetable?:   boolean;
  onTargetClick?:  () => void;
  shake?:          boolean;
  /** Day 20.4 TASK 3 — currently-animating floating numbers. */
  floatingDamage?: FloatingDamageEntry[];
}
type Props = PlayerProps | EnemyProps;

export function CombatantRow(props: Props) {
  const { isPlayer, shake, floatingDamage } = props;

  // Field extraction differs by role; PlayerState uses health/max_health,
  // CombatEnemyInstance uses current_hp/max_hp.
  const name = isPlayer ? props.combatant.name : props.combatant.name;
  const current = isPlayer ? props.combatant.health     : props.combatant.current_hp;
  const max     = isPlayer ? props.combatant.max_health : props.combatant.max_hp;
  const isBoss  = isPlayer ? false : props.combatant.is_boss;
  // PR-11v-a — enemy subtitle now surfaces the weapon damage_die in
  // upper-case ("1D6+1"). Player card renders nothing for this line.
  const subtitle = isPlayer ? "" : (props.combatant.damage_die ?? "").toUpperCase();
  const isAlive = isPlayer
    ? props.combatant.health > 0
    : props.combatant.alive;

  // PR-11v-a — critical HP threshold for enemies. Drives the red border
  // glow + CRIT badge. Boss enemies follow the same 10% rule today.
  const hpRatio = max > 0 ? current / max : 0;
  const isCritical = !isPlayer && isAlive && hpRatio <= 0.10;

  const isTargetable = !isPlayer && (props.isTargetable === true) && isAlive;
  const onTargetClick = !isPlayer ? props.onTargetClick : undefined;

  const handleClick = () => {
    if (isTargetable && onTargetClick) onTargetClick();
  };
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isTargetable || !onTargetClick) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onTargetClick();
    }
  };

  // PR-11v-a — card border colour. Player gets a subtle gold genre
  // accent; enemies default to the neutral UI border and flip to a
  // muted red when critical. The colour transitions cleanly (300ms)
  // so the player sees the border shift as HP drops past 10%.
  const cardBorder = isPlayer
    ? "1px solid rgba(var(--genre-accent-rgb), 0.55)"
    : isCritical
      ? "1px solid rgba(200, 72, 48, 0.70)"
      : "1px solid var(--ui-border-default)";
  const cardBoxShadow = !isPlayer && isCritical
    ? "0 0 10px rgba(200, 72, 48, 0.20)"
    : undefined;

  return (
    <div
      role={isTargetable ? "button" : undefined}
      tabIndex={isTargetable ? 0 : -1}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      style={{
        position:       "relative",
        display:        "flex",
        flexDirection:  "column",
        alignItems:     "center",
        gap:            6,
        padding:        "12px 8px",
        background:     "var(--card-bg)",
        border:         cardBorder,
        boxShadow:      cardBoxShadow,
        borderRadius:   12,
        cursor:         isTargetable ? "pointer" : "default",
        // UI-10 CHANGE 2 — kill-shot animation. On death, greyscale
        // (400ms) then compress (300ms via transition-delay). CSS-only;
        // no engine state changes.
        opacity:        isAlive ? 1 : 0.45,
        filter:         isAlive ? "none" : "grayscale(1)",
        transform:      isAlive ? "scale(1)" : "scale(0.85)",
        // PR-11v-a — player card holds a fixed width; enemy cards
        // flex and shrink equally to share the right half.
        flex:           isPlayer ? "0 0 auto" : 1,
        minWidth:       isPlayer ? 120 : 0,
        maxWidth:       isPlayer ? 180 : 160,
        transition:     "opacity 400ms ease, filter 400ms ease, transform 300ms ease 400ms, border-color 300ms ease, box-shadow 300ms ease",
      }}
    >
      {/* PR-11v-a — CRIT badge. Enemies only, at ≤10% HP. Anchored to
          the card's top-right corner; aria-hidden because the badge
          is a visual amplification of the same red border, not new
          information. */}
      {!isPlayer && isCritical && (
        <div
          aria-hidden="true"
          style={{
            position:      "absolute",
            top:           8,
            right:         8,
            fontSize:      8,
            letterSpacing: "0.18em",
            fontWeight:    700,
            color:         "#c84830",
            background:    "rgba(200, 72, 48, 0.18)",
            border:        "1px solid rgba(200, 72, 48, 0.50)",
            borderRadius:  4,
            padding:       "2px 5px",
            fontFamily:    "var(--mono)",
            pointerEvents: "none",
          }}
        >
          CRIT
        </div>
      )}
      {/* Day 20.4 TASK 3 — portrait wrapper with position:relative (no
          overflow clip) so floating-damage numbers can extend ABOVE
          the portrait. PortraitSlot keeps its own overflow:hidden
          for the inner img clipping. */}
      <div style={{ position: "relative", width: "100%", maxWidth: 128 }}>
        <PortraitSlot
          name={name}
          isPlayer={isPlayer}
          isBoss={isBoss}
          isTargetable={isTargetable}
          shake={shake}
        />
        {(floatingDamage ?? []).map((f) => (
          <FloatingDamage
            key={f.key}
            value={f.value}
            kind={f.kind}
            color={f.color}
            startDelay={f.start_delay}
          />
        ))}
      </div>

      <div
        style={{
          width:         "100%",
          textAlign:     "center",
          fontFamily:    "var(--mono)",
          fontSize:      11,
          letterSpacing: "0.12em",
          fontWeight:    isBoss ? 700 : 500,
          color:         "var(--ink-1)",
          overflow:      "hidden",
          textOverflow:  "ellipsis",
          whiteSpace:    "nowrap",
        }}
      >
        {isBoss && (
          <span style={{ marginRight: 4, color: "var(--accent)" }}>♛</span>
        )}
        {name}
      </div>

      <HPBar current={current} max={max} isBoss={isBoss} />

      {/* Prompt 5 — active status effect pills, directly below the
          player HP bar. Player-only; renders nothing when empty. */}
      {props.isPlayer && (props.statusEffects?.length ?? 0) > 0 && (
        <StatusEffectPills
          effects={props.statusEffects ?? []}
          wcd={props.wcd}
        />
      )}

      {/* PR-11v-a — enemy damage_die subtitle. Renders nothing for the
          player card (subtitle === ""). */}
      {!isPlayer && subtitle && (
        <div
          style={{
            width:         "100%",
            textAlign:     "center",
            fontSize:      10,
            color:         "var(--ui-text-muted)",
            fontFamily:    "var(--mono)",
            letterSpacing: "0.12em",
            overflow:      "hidden",
            textOverflow:  "ellipsis",
            whiteSpace:    "nowrap",
          }}
        >
          {subtitle}
        </div>
      )}
    </div>
  );
}
