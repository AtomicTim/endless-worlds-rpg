"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ItemType } from "@/types/game";
import type { CombatState, PlayerState } from "@/types/game";
import type { PlayerActionInput } from "@/lib/game/combat-engine";
import { PLAYER_ID } from "@/lib/game/combat-engine";
import { CombatantRow } from "./CombatantRow";
import { ActionBar } from "./ActionBar";
import { TargetPicker } from "./TargetPicker";
import { UseItemPicker } from "./UseItemPicker";

/**
 * Day 20 Combat — top-level mode panel (combat-spec §4).
 *
 * Side-by-side layout: player on the left half, vertical divider,
 * enemies tiled on the right half. Action buttons span the bottom.
 * Target picker activates inline (CombatantRow gets isTargetable).
 *
 * Stateless w.r.t. combat state — owners (page.tsx + useCombat)
 * commit moves; this panel just renders the snapshot and dispatches
 * action callbacks.
 */
interface Props {
  combat:       CombatState;
  player:       PlayerState;
  /** True while the engine is mid-resolution; disables the action bar. */
  isResolving?: boolean;
  onAction:     (action: PlayerActionInput) => void;
}

export function CombatMode({ combat, player, isResolving, onAction }: Props) {
  const [attackTargeting, setAttackTargeting] = useState(false);
  const [showItemPicker,  setShowItemPicker]  = useState(false);

  // Track in-flight crit-shake animations keyed by target instance_id.
  // When a CombatEvent with outcome === "crit" appears in combat_log,
  // the targeted combatant flashes the .combat-portrait-shake class
  // for ~400ms. Trigger detection lives here in the parent so
  // CombatantRow stays a stateless renderer.
  const [shakeMap, setShakeMap] = useState<Record<string, number>>({});
  const [lastSeenLogLength, setLastSeenLogLength] = useState(0);

  useEffect(() => {
    if (combat.combat_log.length <= lastSeenLogLength) return;
    const newEvents = combat.combat_log.slice(lastSeenLogLength);
    const additions: Record<string, number> = {};
    for (const ev of newEvents) {
      if (ev.outcome === "crit" && ev.target) {
        additions[ev.target] = Date.now();
      }
    }
    if (Object.keys(additions).length > 0) {
      setShakeMap((prev) => ({ ...prev, ...additions }));
      // Clear each shake after 400ms.
      for (const id of Object.keys(additions)) {
        setTimeout(() => {
          setShakeMap((prev) => {
            const next = { ...prev };
            delete next[id];
            return next;
          });
        }, 400);
      }
    }
    setLastSeenLogLength(combat.combat_log.length);
  }, [combat.combat_log, lastSeenLogLength]);

  // Cancel any open picker if it's no longer the player's turn (e.g.
  // after an enemy turn auto-resolved into the player's HP).
  const isPlayerTurn = combat.turn_order[combat.current_turn_index] === PLAYER_ID;
  useEffect(() => {
    if (!isPlayerTurn) {
      if (attackTargeting) setAttackTargeting(false);
      if (showItemPicker)  setShowItemPicker(false);
    }
  }, [isPlayerTurn, attackTargeting, showItemPicker]);

  const hasConsumables = useMemo(
    () => player.inventory.some((i) => i.type === ItemType.CONSUMABLE),
    [player.inventory]
  );

  const actionsDisabled = !isPlayerTurn || isResolving === true;

  const handleAttackClick = () => {
    if (actionsDisabled) return;
    setAttackTargeting(true);
  };
  const handleTargetSelected = (instanceId: string) => {
    setAttackTargeting(false);
    onAction({ action: "attack", target_instance_id: instanceId });
  };
  const handleDefend = () => {
    if (actionsDisabled) return;
    onAction({ action: "defend" });
  };
  const handleUseItemClick = () => {
    if (actionsDisabled) return;
    setShowItemPicker(true);
  };
  const handleItemSelected = (itemId: string) => {
    setShowItemPicker(false);
    onAction({ action: "use_item", item_id: itemId });
  };
  const handleFlee = () => {
    if (actionsDisabled) return;
    onAction({ action: "flee" });
  };

  return (
    <div
      role="region"
      aria-label="Combat panel"
      style={{
        position:       "relative",
        display:        "flex",
        flexDirection:  "column",
        minHeight:      "min(33vh, 360px)",
        background:     "var(--bg-1)",
        borderTop:      "2px solid var(--combat-enemy)",
      }}
    >
      {/* ── Header ───────────────────────────────────────────────────── */}
      <div
        className="ew-mono"
        style={{
          padding:        "8px 14px",
          borderBottom:   "1px solid var(--line)",
          fontSize:       10,
          letterSpacing:  "0.32em",
          color:          "var(--combat-enemy-crit)",
          fontWeight:     700,
          textTransform:  "uppercase",
          display:        "flex",
          justifyContent: "space-between",
          alignItems:     "center",
        }}
      >
        <span>⚔ Combat — Round {combat.round_number}</span>
        <span style={{ color: "var(--ink-4)", fontSize: 9, fontWeight: 400 }}>
          {isPlayerTurn ? "Your turn" : "Enemy turn..."}
        </span>
      </div>

      {/* ── Roster (player | divider | enemies) ───────────────────── */}
      <div
        style={{
          flex:    1,
          display: "flex",
          gap:     0,
          padding: "8px 12px",
          minHeight: 0,
        }}
      >
        {/* Player side (left half) */}
        <div
          style={{
            flex:           1,
            display:        "flex",
            justifyContent: "center",
            alignItems:     "stretch",
            paddingRight:   8,
          }}
        >
          <CombatantRow combatant={player} isPlayer />
        </div>

        {/* Divider */}
        <div
          aria-hidden
          style={{
            width:        1,
            background:   "var(--line-2)",
            alignSelf:    "stretch",
            margin:       "0 4px",
          }}
        />

        {/* Enemy side (right half) — tiles 1-4 horizontally */}
        <div
          style={{
            flex:           1,
            display:        "flex",
            gap:            8,
            justifyContent: combat.enemies.length <= 2 ? "center" : "space-between",
            alignItems:     "stretch",
            paddingLeft:    8,
            overflowX:      "auto",
          }}
        >
          {combat.enemies.map((e) => (
            <CombatantRow
              key={e.instance_id}
              combatant={e}
              isPlayer={false}
              isTargetable={attackTargeting}
              onTargetClick={() => handleTargetSelected(e.instance_id)}
              shake={!!shakeMap[e.instance_id]}
            />
          ))}
        </div>
      </div>

      {/* ── Targeting hint banner ────────────────────────────────────── */}
      {attackTargeting && (
        <TargetPicker onCancel={() => setAttackTargeting(false)} />
      )}

      {/* ── Action bar (bottom) ──────────────────────────────────────── */}
      <ActionBar
        disabled={actionsDisabled}
        hasConsumables={hasConsumables}
        attackTargeting={attackTargeting}
        onAttack={handleAttackClick}
        onDefend={handleDefend}
        onUseItem={handleUseItemClick}
        onFlee={handleFlee}
      />

      {/* ── Use item modal overlay ───────────────────────────────────── */}
      {showItemPicker && (
        <UseItemPicker
          inventory={player.inventory}
          onSelect={handleItemSelected}
          onCancel={() => setShowItemPicker(false)}
        />
      )}
    </div>
  );
}
