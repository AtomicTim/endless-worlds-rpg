"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ItemType } from "@/types/game";
import type { CombatEvent, CombatState, PlayerState } from "@/types/game";
import type { PlayerActionInput } from "@/lib/game/combat-engine";
import { PLAYER_ID } from "@/lib/game/combat-engine";
import type { FloatingDamageEntry } from "./CombatantRow";
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
  /** Day 20.1 TASK 5 — UI-facing turn phase. Set by useCombat ahead
   *  of the feed during turn transitions so the header pill is the
   *  canonical turn indicator. Falls back to the engine's authoritative
   *  index when omitted (e.g. an old caller). */
  displayPhase?: "player" | "enemy";
  onAction:     (action: PlayerActionInput) => void;
}

export function CombatMode({ combat, player, isResolving, displayPhase, onAction }: Props) {
  const [attackTargeting, setAttackTargeting] = useState(false);
  const [showItemPicker,  setShowItemPicker]  = useState(false);

  // Track in-flight crit-shake animations keyed by target instance_id.
  // When a CombatEvent with outcome === "crit" appears in combat_log,
  // the targeted combatant flashes the .combat-portrait-shake class
  // for ~400ms. Trigger detection lives here in the parent so
  // CombatantRow stays a stateless renderer.
  const [shakeMap, setShakeMap] = useState<Record<string, number>>({});
  // Day 20.4 TASK 3 — floating damage / heal numbers, keyed by
  // combatant id ("PLAYER" for the player, instance_id for enemies).
  // Pushed when a damage event arrives, removed after 1100ms.
  const [floatingByActor, setFloatingByActor] =
    useState<Record<string, FloatingDamageEntry[]>>({});
  const [lastSeenLogLength, setLastSeenLogLength] = useState(0);

  useEffect(() => {
    if (combat.combat_log.length <= lastSeenLogLength) return;
    const newEvents = combat.combat_log.slice(lastSeenLogLength);

    // Crit shake.
    const shakeAdds: Record<string, number> = {};
    for (const ev of newEvents) {
      if (ev.outcome === "crit" && ev.target) {
        shakeAdds[ev.target] = Date.now();
      }
    }
    if (Object.keys(shakeAdds).length > 0) {
      setShakeMap((prev) => ({ ...prev, ...shakeAdds }));
      for (const id of Object.keys(shakeAdds)) {
        setTimeout(() => {
          setShakeMap((prev) => {
            const next = { ...prev };
            delete next[id];
            return next;
          });
        }, 400);
      }
    }

    // Day 20.4 TASK 3 — floating damage / heal numbers.
    const floatAdds: Record<string, FloatingDamageEntry[]> = {};
    for (const ev of newEvents) {
      const entry = makeFloatingEntry(ev);
      if (!entry) continue;
      const id = entry.targetId;
      if (!floatAdds[id]) floatAdds[id] = [];
      floatAdds[id].push(entry.payload);
    }
    if (Object.keys(floatAdds).length > 0) {
      setFloatingByActor((prev) => {
        const next = { ...prev };
        for (const [id, entries] of Object.entries(floatAdds)) {
          next[id] = [...(next[id] ?? []), ...entries];
        }
        return next;
      });
      // Schedule removal of each entry after 1100ms.
      for (const [id, entries] of Object.entries(floatAdds)) {
        for (const e of entries) {
          setTimeout(() => {
            setFloatingByActor((prev) => {
              const list = (prev[id] ?? []).filter((x) => x.key !== e.key);
              const next = { ...prev };
              if (list.length === 0) delete next[id]; else next[id] = list;
              return next;
            });
          }, 1100);
        }
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
      {/* Day 20.1 TASK 5 — turn pill is the canonical phase indicator.
          Reads displayPhase (lagged by useCombat across the drain
          delays) so it stays in sync with the feed pacing instead
          of jumping ahead to the engine's auto-resolved index. */}
      {(() => {
        const effectivePhase: "player" | "enemy" =
          displayPhase ?? (isPlayerTurn ? "player" : "enemy");
        const isPillPlayer = effectivePhase === "player";
        const pillBg = isPillPlayer
          ? "color-mix(in srgb, var(--combat-player) 28%, var(--bg-2))"
          : "color-mix(in srgb, var(--combat-enemy) 28%, var(--bg-2))";
        const pillBorder = isPillPlayer
          ? "var(--combat-player)"
          : "var(--combat-enemy)";
        const pillColor = isPillPlayer
          ? "var(--combat-player)"
          : "var(--combat-enemy)";
        const pillLabel = isPillPlayer ? "Your turn" : "Enemy turn";
        return (
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
              gap:            10,
            }}
          >
            <span>⚔ Combat — Round {combat.round_number}</span>
            <span
              role="status"
              aria-live="polite"
              style={{
                fontFamily:     "var(--mono)",
                fontSize:       11,
                letterSpacing:  "0.24em",
                fontWeight:     700,
                textTransform:  "uppercase",
                padding:        "4px 10px",
                borderRadius:   3,
                background:     pillBg,
                border:         `1px solid ${pillBorder}`,
                color:          pillColor,
                transition:     "background 200ms ease-out, border-color 200ms ease-out, color 200ms ease-out",
              }}
            >
              {pillLabel}
            </span>
          </div>
        );
      })()}

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
          <CombatantRow
            combatant={player}
            isPlayer
            floatingDamage={floatingByActor[PLAYER_ID]}
          />
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
              floatingDamage={floatingByActor[e.instance_id]}
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

// ─────────────────────────────────────────────────────────────────────────────
// Day 20.4 TASK 3 + Day 20.4.1 TASK 1 — translate a CombatEvent → floating-
// number entry. Returns null when the event has nothing to float.
//
// Routing rules (locked by Day 20.4.1):
//   player_attack hit/crit → host = event.target (the targeted ENEMY's
//     instance_id). Color = combat-player(-crit). Show damage_die_roll
//     on hit; TOTAL damage on crit.
//   enemy_attack hit/crit  → host = "PLAYER" (string sentinel). Color =
//     combat-enemy(-crit). Show damage_die_roll on hit; TOTAL damage on
//     crit.
//   use_item heal          → host = "PLAYER". Color = hl-pass. Show
//     damage_die_roll (the heal die roll, before the flat +4 bonus).
//   defend / miss / fumble / flee / phase events: null.
//
// Routing is explicit per event.type — no conditional fallback that could
// misroute when one of actor/target ever shows up empty.
// ─────────────────────────────────────────────────────────────────────────────

export function makeFloatingEntry(
  event: CombatEvent
): { targetId: string; payload: FloatingDamageEntry } | null {
  switch (event.type) {
    // ── Player struck an enemy → float over the ENEMY portrait ───────────
    case "player_attack": {
      if (event.outcome !== "hit" && event.outcome !== "crit") return null;
      const enemyId = typeof event.target === "string" && event.target.length > 0
        ? event.target
        : null;
      if (!enemyId || enemyId === PLAYER_ID) return null;
      const isCrit = event.outcome === "crit";
      const value  = isCrit
        ? (event.damage_dealt ?? 0)
        : (event.rolls?.damage_die_roll ?? event.damage_dealt ?? 0);
      if (value <= 0) return null;
      return {
        targetId: enemyId,
        payload: {
          key:   `${event.type}_${event.timestamp}_${enemyId}`,
          value,
          kind:  isCrit ? "crit" : "hit",
          color: isCrit ? "var(--combat-player-crit)" : "var(--combat-player)",
        },
      };
    }

    // ── Enemy struck the player → float over the PLAYER portrait ────────
    case "enemy_attack": {
      if (event.outcome !== "hit" && event.outcome !== "crit") return null;
      const isCrit = event.outcome === "crit";
      const value  = isCrit
        ? (event.damage_dealt ?? 0)
        : (event.rolls?.damage_die_roll ?? event.damage_dealt ?? 0);
      if (value <= 0) return null;
      return {
        targetId: PLAYER_ID,
        payload: {
          key:   `${event.type}_${event.timestamp}_${event.actor}`,
          value,
          kind:  isCrit ? "crit" : "hit",
          color: isCrit ? "var(--combat-enemy-crit)" : "var(--combat-enemy)",
        },
      };
    }

    // ── Player used a heal item → float over the PLAYER portrait ────────
    case "use_item": {
      // Heal events store healed amount as negative damage_dealt
      // (engine convention; see resolveUseItem in combat-engine).
      if (typeof event.damage_dealt !== "number" || event.damage_dealt >= 0) return null;
      const dieRoll = event.rolls?.damage_die_roll;
      if (typeof dieRoll !== "number" || dieRoll <= 0) return null;
      return {
        targetId: PLAYER_ID,
        payload: {
          key:   `heal_${event.timestamp}`,
          value: dieRoll,
          kind:  "heal",
          color: "var(--hl-pass)",
        },
      };
    }

    // Everything else (defend, kill, flee_attempt, victory, defeat,
    // round_start, player_turn_start, enemy_phase_start, combat_start):
    // no floating number.
    default:
      return null;
  }
}
