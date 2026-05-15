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
 * prefix and bold weight when isBoss), HP bar, description (italic
 * low-opacity small text — behavior_flavor for enemies, empty for
 * the Day 20 player). When isTargetable: cursor pointer + glow. When
 * shake: applies the 400ms shake to the portrait.
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
  const description = isPlayer
    ? ""                                  // Day 20: empty (future: class/role)
    : props.combatant.behavior_flavor;
  const isAlive = isPlayer
    ? props.combatant.health > 0
    : props.combatant.alive;

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

  return (
    <div
      role={isTargetable ? "button" : undefined}
      tabIndex={isTargetable ? 0 : -1}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      style={{
        display:        "flex",
        flexDirection:  "column",
        alignItems:     "center",
        gap:            6,
        padding:        "8px 6px",
        cursor:         isTargetable ? "pointer" : "default",
        // UI-10 CHANGE 2 — kill-shot animation. On death, greyscale
        // (400ms) then compress (300ms via transition-delay). CSS-only;
        // no engine state changes.
        opacity:        isAlive ? 1 : 0.45,
        filter:         isAlive ? "none" : "grayscale(1)",
        transform:      isAlive ? "scale(1)" : "scale(0.85)",
        flex:           1,
        minWidth:       0,
        maxWidth:       180,
        transition:     "opacity 400ms ease, filter 400ms ease, transform 300ms ease 400ms",
      }}
    >
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

      {description && (
        <div
          className="ew-serif"
          style={{
            width:        "100%",
            textAlign:    "center",
            fontSize:     10,
            fontStyle:    "italic",
            color:        "var(--ink-4)",
            opacity:      0.85,
            overflow:     "hidden",
            textOverflow: "ellipsis",
            whiteSpace:   "nowrap",
          }}
        >
          {description}
        </div>
      )}
    </div>
  );
}
