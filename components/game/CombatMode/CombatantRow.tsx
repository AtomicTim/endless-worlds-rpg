"use client";

import React from "react";
import type { CombatEnemyInstance, PlayerState } from "@/types/game";
import { PortraitSlot } from "./PortraitSlot";
import { HPBar } from "./HPBar";

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
  combatant:    PlayerState;
  isPlayer:     true;
  isTargetable?: false;
  onTargetClick?: never;
  shake?:        boolean;
}
interface EnemyProps {
  combatant:    CombatEnemyInstance;
  isPlayer:     false;
  isTargetable?: boolean;
  onTargetClick?: () => void;
  shake?:        boolean;
}
type Props = PlayerProps | EnemyProps;

export function CombatantRow(props: Props) {
  const { isPlayer, shake } = props;

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
        opacity:        isAlive ? 1 : 0.4,
        flex:           1,
        minWidth:       0,
        maxWidth:       180,
        transition:     "opacity 200ms",
      }}
    >
      <PortraitSlot
        name={name}
        isPlayer={isPlayer}
        isBoss={isBoss}
        isTargetable={isTargetable}
        shake={shake}
      />

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
