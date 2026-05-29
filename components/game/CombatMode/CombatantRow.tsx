"use client";

import React from "react";
import type {
  ActiveStatusEffect, CombatEnemyInstance, PlayerState,
} from "@/types/game";
import type { WcdStatusAliasSource } from "@/lib/game/combat-narration/status-display";
import {
  DAMAGE_TYPE_LABEL,
  getDamageTypeColor,
} from "@/lib/game/damage-types";
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
  /** PR-11v-b — arc direction + width. Determines which keyframe to use. */
  arc?:        "left" | "right" | "left-wide" | "right-wide" | "up";
  /** PR-11v-b — animation duration ms. Varies by damage type (fire=900,
   *  lightning=750, frost=1400, heal=1300, default=1100). */
  animDuration?: number;
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
  /** PR-11v-a HF1 — unused for the player card; kept on the union so
   *  CombatMode can pass it uniformly without a branch. */
  enemyCount?:     number;
}
interface EnemyProps {
  combatant:       CombatEnemyInstance;
  isPlayer:        false;
  isTargetable?:   boolean;
  onTargetClick?:  () => void;
  shake?:          boolean;
  /** Day 20.4 TASK 3 — currently-animating floating numbers. */
  floatingDamage?: FloatingDamageEntry[];
  /** PR-11v-a HF1 — total enemies in the roster (1–4). Drives the
   *  card width caps so 1 enemy renders as a generous portrait and
   *  4 enemies still fit side-by-side without horizontal overflow. */
  enemyCount?:     number;
  /** HF-enemy-status-pills — WCD for status-effect alias lookup so
   *  the enemy pills can show world-native names (rootblight, etc.)
   *  the same way the player pills already do. Optional — pills fall
   *  back to the canonical id when omitted. */
  wcd?:            WcdStatusAliasSource;
}
type Props = PlayerProps | EnemyProps;

// PR-11v-a HF1 — enemy card width caps per roster size. Index = count.
// flex defaults to 1 so cards share the available row; the 1-enemy case
// switches to "0 0 auto" so a lone enemy renders at its natural width.
const ENEMY_CARD_SIZING: Record<number, {
  minWidth: number;
  maxWidth: number;
  flex:     number | string;
}> = {
  1: { minWidth: 200, maxWidth: 280, flex: "0 0 auto" },
  2: { minWidth: 140, maxWidth: 200, flex: 1 },
  3: { minWidth: 100, maxWidth: 160, flex: 1 },
  4: { minWidth:  80, maxWidth: 130, flex: 1 },
};

export function CombatantRow(props: Props) {
  const { isPlayer, shake, floatingDamage } = props;

  // Field extraction differs by role; PlayerState uses health/max_health,
  // CombatEnemyInstance uses current_hp/max_hp.
  const name = isPlayer ? props.combatant.name : props.combatant.name;
  const current = isPlayer ? props.combatant.health     : props.combatant.current_hp;
  const max     = isPlayer ? props.combatant.max_health : props.combatant.max_hp;
  const isBoss  = isPlayer ? false : props.combatant.is_boss;
  // PR-11v-a — enemy subtitle surfaces the weapon damage_die. HF1
  // forces lowercase ("1d6+1") because the engine emits uppercase
  // and the design ref wants the d-notation lower-case.
  const subtitle = isPlayer ? "" : (props.combatant.damage_die ?? "").toLowerCase();
  // PR-11v-d — surface the enemy's primary_damage_type on the card.
  // Physical (or undefined) renders the muted neutral subtitle; non-
  // physical types colour the line and append an uppercase label so
  // the player can read tactical pressure ("1d6 · FIRE") at a glance.
  const dmgType  = (!isPlayer && props.combatant.primary_damage_type)
    ? props.combatant.primary_damage_type
    : "physical";
  const dmgColor = getDamageTypeColor(dmgType);
  const dmgLabel = DAMAGE_TYPE_LABEL[dmgType] ?? "";
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

  // PR-11v-a HF1 — card sizing. Player card grew (160–220); enemy
  // cards scale by roster size so 1 enemy is generous and 4 enemies
  // still tile cleanly. Clamp `count` into the supported 1–4 range
  // so an unexpected value (defensive) falls back to the 1-enemy
  // generous-card preset.
  const enemyCount = Math.max(1, Math.min(4, props.enemyCount ?? 1));
  const enemySizing = ENEMY_CARD_SIZING[enemyCount] ?? ENEMY_CARD_SIZING[1];
  const cardFlex     = isPlayer ? "0 0 auto" : enemySizing.flex;
  // PR-11v-a HF2 — player card widened (200–260) so the larger
  // portrait + HP bar read with more presence.
  const cardMinWidth = isPlayer ? 200 : enemySizing.minWidth;
  const cardMaxWidth = isPlayer ? 260 : enemySizing.maxWidth;

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
        // PR-11v-a HF1 — player width 160–220; enemy width caps
        // scale by roster size (see ENEMY_CARD_SIZING table).
        flex:           cardFlex,
        minWidth:       cardMinWidth,
        maxWidth:       cardMaxWidth,
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
          CRITICAL
        </div>
      )}
      {/* Portrait wrapper. position:relative is retained so PortraitSlot's
          targetable glow ring still anchors correctly. PR-11v-b moved
          FloatingDamage out of this wrapper down to the HP bar host so
          the numbers launch from the HP bar level per the float-arc spec. */}
      <div style={{ position: "relative", width: "100%", maxWidth: 128 }}>
        <PortraitSlot
          name={name}
          isPlayer={isPlayer}
          isBoss={isBoss}
          isTargetable={isTargetable}
          shake={shake}
        />
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

      {/* PR-11v-b — float host. Numbers launch from the HP bar level,
          arc upward (left/right/up keyframes), and self-clear after
          animDuration. Wrapper is position:relative; the floats are
          absolutely positioned at bottom:0 and arc upward into open
          space above the bar. */}
      <div style={{ position: "relative", width: "100%" }}>
        <HPBar current={current} max={max} isBoss={isBoss} />
        {(floatingDamage ?? []).map((f) => (
          <FloatingDamage
            key={f.key}
            value={f.value}
            kind={f.kind}
            color={f.color}
            arc={f.arc}
            animDuration={f.animDuration}
            startDelay={f.start_delay}
          />
        ))}
      </div>

      {/* Prompt 5 — active status effect pills, directly below the
          player HP bar. Player-only; renders nothing when empty. */}
      {props.isPlayer && (props.statusEffects?.length ?? 0) > 0 && (
        <StatusEffectPills
          effects={props.statusEffects ?? []}
          wcd={props.wcd}
        />
      )}

      {/* HF-enemy-status-pills — mirror the player block for enemies.
          status_effects is mirrored onto CombatEnemyInstance at apply
          time; the pills just weren't being surfaced. Same styling,
          same WCD alias path. */}
      {!isPlayer && (props.combatant.status_effects?.length ?? 0) > 0 && (
        <StatusEffectPills
          effects={props.combatant.status_effects ?? []}
          wcd={props.wcd}
        />
      )}

      {/* PR-11v-d — enemy damage_die subtitle. Physical stays muted;
          non-physical types take the damage-type colour and append a
          short uppercase label. Player card renders nothing
          (subtitle === ""). */}
      {!isPlayer && subtitle && (
        <div
          style={{
            width:         "100%",
            textAlign:     "center",
            fontFamily:    "var(--mono)",
            fontSize:      10,
            letterSpacing: "0.12em",
            overflow:      "hidden",
            textOverflow:  "ellipsis",
            whiteSpace:    "nowrap",
            color:         dmgLabel ? dmgColor : "var(--ui-text-muted)",
          }}
        >
          {subtitle}
          {dmgLabel && (
            <span
              style={{
                marginLeft:    6,
                fontSize:      8,
                letterSpacing: "0.18em",
                opacity:       0.80,
              }}
            >
              · {dmgLabel}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
