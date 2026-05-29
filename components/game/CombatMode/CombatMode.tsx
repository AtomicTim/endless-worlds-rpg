"use client";

/**
 * CombatMode — combat panel + floating-number host.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Day 20.4.2 field-name reference (CombatEvent — see types/game.ts:763)
 * ─────────────────────────────────────────────────────────────────────────────
 *   actor:       "PLAYER" | enemy.instance_id   — who acted
 *   target:      "PLAYER" | enemy.instance_id | null — who got acted upon
 *
 * The float-host lookup uses `event.target` for attacks (which enemy got
 * hit) and forces "PLAYER" for use_item heals. There is no `target_id`
 * or `targetId` field — `target` is the canonical name.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Day 20.4.2 CSS containing-block reference for floats
 * ─────────────────────────────────────────────────────────────────────────────
 * FloatingDamage is `position: absolute; bottom: 100%` — anchored to the
 * top edge of CombatantRow's portrait wrapper, animating upward ~56px.
 * The wrapper has `position: relative` (containing block) but inherits
 * overflow: visible. Floats extending above it must NOT pass through any
 * ancestor with overflow != visible.
 *
 * CSS spec: when overflow-x or overflow-y is auto/scroll/hidden and the
 * other is `visible`, the visible axis is promoted to `auto`. So setting
 * `overflow-x: auto` on a parent container ALSO clips overflow-y. The
 * V8.38 enemy-side container set overflow-x: auto for 5+ enemy support
 * we don't actually have — and that silently clipped every player-attack
 * float. Keep overflow: visible (or omit it) on all float ancestors.
 */

import React, { useEffect, useMemo, useState } from "react";
import { ItemType } from "@/types/game";
import type { CombatEvent, CombatState, PlayerState } from "@/types/game";
import type { PlayerActionInput } from "@/lib/game/combat-engine";
import { PLAYER_ID } from "@/lib/game/combat-engine";
import type { WcdStatusAliasSource } from "@/lib/game/combat-narration/status-display";
import type { FloatingDamageEntry } from "./CombatantRow";
import { CombatantRow } from "./CombatantRow";
import { ActionBar } from "./ActionBar";
import { AbilityPanel, abilityNeedsTarget } from "./AbilityPanel";
import { ABILITY_LIBRARY } from "@/lib/game/abilities";
import {
  DAMAGE_TYPE_COLOR,
  DAMAGE_TYPE_DURATION,
} from "@/lib/game/damage-types";
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
  /** Day 20.4.2 TASK 3 — floating damage / heal numbers keyed by host
   *  id ("PLAYER" or enemy.instance_id). Owned by useCombat (which
   *  emits them inside the projection pipeline so they pop in sync
   *  with the matching story-feed line). CombatMode is now a pure
   *  renderer for this map. */
  floatingByActor?: Record<string, FloatingDamageEntry[]>;
  /** Prompt 5 — WCD for status-effect alias lookup. Threaded down to
   *  the player's CombatantRow so the status pills can show world-
   *  native names. Optional — pills fall back to the canonical id. */
  wcd?:         WcdStatusAliasSource;
  onAction:     (action: PlayerActionInput) => void;
}

export function CombatMode({
  combat, player, isResolving, displayPhase, floatingByActor, wcd, onAction,
}: Props) {
  const [attackTargeting, setAttackTargeting] = useState(false);
  const [showItemPicker,  setShowItemPicker]  = useState(false);
  // P7 — ability panel + ability-target picker. When `abilityPanelOpen`
  // is true the bottom strip swaps from ActionBar → AbilityPanel. When
  // the player picks a damage / debuff ability, `pendingAbilityId` is
  // set + the target picker activates; tapping an enemy submits the
  // ability action with the resolved target. Self-only abilities skip
  // the picker entirely and dispatch immediately.
  const [abilityPanelOpen, setAbilityPanelOpen] = useState(false);
  const [pendingAbilityId, setPendingAbilityId] = useState<string | null>(null);

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

    // Crit shake. (Floating damage emission was moved into
    // useCombat's projection pipeline in Day 20.4.2 TASK 3 — see
    // hooks/useCombat.ts emitFloat. CombatMode now only owns the
    // crit-shake side effect, which is fine to fire on store commit
    // because the shake is just a portrait jitter, not a number that
    // needs to land in sync with the story-feed line.)
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

    setLastSeenLogLength(combat.combat_log.length);
  }, [combat.combat_log, lastSeenLogLength]);

  // Cancel any open picker if it's no longer the player's turn (e.g.
  // after an enemy turn auto-resolved into the player's HP).
  const isPlayerTurn = combat.turn_order[combat.current_turn_index] === PLAYER_ID;
  useEffect(() => {
    if (!isPlayerTurn) {
      if (attackTargeting)   setAttackTargeting(false);
      if (showItemPicker)    setShowItemPicker(false);
      if (abilityPanelOpen)  setAbilityPanelOpen(false);
      if (pendingAbilityId)  setPendingAbilityId(null);
    }
  }, [isPlayerTurn, attackTargeting, showItemPicker, abilityPanelOpen, pendingAbilityId]);

  const hasConsumables = useMemo(
    () => player.inventory.some((i) => i.type === ItemType.CONSUMABLE),
    [player.inventory]
  );

  // P7 — at least one equipped slot ability for the Abilities button to
  // be enabled. The Abilities branch is reachable even at level 1 (slot
  // 1 is seeded on class assignment in /api/game/new).
  const hasAbilities = useMemo(
    () => (player.equipped_ability_slots ?? []).some((id) => !!id),
    [player.equipped_ability_slots]
  );

  const actionsDisabled = !isPlayerTurn || isResolving === true;

  const handleAttackClick = () => {
    if (actionsDisabled) return;
    setAttackTargeting(true);
  };
  const handleTargetSelected = (instanceId: string) => {
    // P7 — a target click resolves either a pending ability or a regular
    // attack, depending on which branch armed the picker.
    if (pendingAbilityId) {
      const ability_id = pendingAbilityId;
      setPendingAbilityId(null);
      setAttackTargeting(false);
      onAction({ action: "ability", ability_id, target_instance_id: instanceId });
      return;
    }
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

  // P7 — Abilities branch entry / dispatch / cancel handlers.
  const handleAbilitiesClick = () => {
    if (actionsDisabled) return;
    setAbilityPanelOpen(true);
  };
  const handleAbilitySelected = (ability_id: string) => {
    const tmpl = ABILITY_LIBRARY[ability_id];
    if (!tmpl) return;
    if (abilityNeedsTarget(tmpl)) {
      // Damage / debuff abilities need an enemy. Arm the target picker.
      setPendingAbilityId(ability_id);
      setAbilityPanelOpen(false);
      setAttackTargeting(true);
      return;
    }
    // Self-only ability (heal / buff / status clear) — dispatch directly.
    setAbilityPanelOpen(false);
    onAction({ action: "ability", ability_id });
  };
  const handleAbilityPanelBack = () => {
    setAbilityPanelOpen(false);
  };

  // UI-10 CHANGE 4 — surface the most-recent dice roll for the current
  // turn. Reads the last combat_log event that carries a populated
  // `rolls.d20`. Resets at each phase boundary inside computeDiceDisplay.
  const diceDisplay = useMemo<DiceDisplay | null>(() => {
    return computeDiceDisplay(combat.combat_log);
  }, [combat.combat_log]);

  return (
    <div
      role="region"
      aria-label="Combat panel"
      className="ew-combat-panel-enter"
      style={{
        position:       "relative",
        display:        "flex",
        flexDirection:  "column",
        // UI-10 CHANGE 1 — 188px floor as the panel rises into the flex
        // column. Keep the prior min(33vh, 360px) cap as a comfortable
        // ceiling on taller viewports.
        minHeight:      "max(188px, min(33vh, 360px))",
        background:     "var(--bg-1)",
        borderTop:      "1px solid var(--card-border)",
      }}
    >
      {/* UI-10 — entry animation + HP pulse + dice fade-in. Scoped. */}
      <style>{`
        @keyframes ew-combat-panel-rise {
          0%   { max-height: 0;     opacity: 0; }
          100% { max-height: 600px; opacity: 1; }
        }
        .ew-combat-panel-enter {
          animation: ew-combat-panel-rise 380ms cubic-bezier(0.22, 1, 0.36, 1) both;
          overflow: hidden;
        }
        @keyframes ew-hp-pulse {
          0%, 100% { opacity: 1; }
          50%      { opacity: 0.55; }
        }
        @keyframes ew-combat-dice-in {
          0%   { opacity: 0; transform: translateY(2px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .ew-combat-dice {
          animation: ew-combat-dice-in 80ms ease-out 220ms both;
        }
      `}</style>
      {/* ── Header ───────────────────────────────────────────────────── */}
      {/* Day 20.1 TASK 5 — turn pill is the canonical phase indicator.
          Reads displayPhase (lagged by useCombat across the drain
          delays) so it stays in sync with the feed pacing instead
          of jumping ahead to the engine's auto-resolved index. */}
      {(() => {
        // UI-10 CHANGE 5 — turn badge per §8.
        //   Player: genre accent tint + accent text, Inter Tight 7px
        //   Enemy : #9a4040 tint + #c84830 text
        // 100ms fade on background/border/color.
        const effectivePhase: "player" | "enemy" =
          displayPhase ?? (isPlayerTurn ? "player" : "enemy");
        const isPillPlayer = effectivePhase === "player";
        const pillBg = isPillPlayer
          ? "rgba(var(--genre-accent-rgb), 0.14)"
          : "rgba(154, 64, 64, 0.18)";
        const pillBorder = isPillPlayer
          ? "rgba(var(--genre-accent-rgb), 0.45)"
          : "rgba(200, 72, 48, 0.55)";
        const pillColor = isPillPlayer
          ? "var(--genre-accent)"
          : "#c84830";
        const pillLabel = isPillPlayer ? "Your Turn" : "Enemy Turn";
        return (
          <div
            className="ew-mono"
            style={{
              padding:        "8px 14px",
              borderBottom:   "1px solid var(--card-border)",
              fontSize:       9,
              letterSpacing:  "0.30em",
              color:          "#6a5530",
              fontWeight:     700,
              textTransform:  "uppercase",
              display:        "flex",
              justifyContent: "space-between",
              alignItems:     "center",
              gap:            10,
            }}
          >
            <span>⚔ Round {combat.round_number}</span>
            <span
              role="status"
              aria-live="polite"
              className="ew-sans uppercase"
              style={{
                fontFamily:    "var(--ui-sans, var(--mono))",
                fontSize:      7,
                letterSpacing: "0.26em",
                fontWeight:    700,
                padding:       "3px 10px",
                borderRadius:  20,
                background:    pillBg,
                border:        `1px solid ${pillBorder}`,
                color:         pillColor,
                transition:    "background 100ms ease, border-color 100ms ease, color 100ms ease",
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
        {/* Player side (left half) — PR-11v-a: shrink to the player
            card's own width (120–180px). Enemies get the rest of the
            row so 1-4 enemy cards still tile cleanly without
            squeezing the player card. */}
        <div
          style={{
            flex:           "0 0 auto",
            display:        "flex",
            justifyContent: "center",
            alignItems:     "stretch",
            paddingRight:   8,
          }}
        >
          <CombatantRow
            combatant={player}
            isPlayer
            floatingDamage={floatingByActor?.[PLAYER_ID]}
            statusEffects={combat.player_status_effects}
            wcd={wcd}
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

        {/* Enemy side (right half) — tiles 1-4 horizontally.
            Day 20.4.2 TASK 1 — overflow MUST stay visible. The V8.38
            `overflowX: "auto"` here was the root cause of player-attack
            floats never appearing: per CSS spec it promoted overflow-y
            to auto, which clipped the floats anchored ABOVE the enemy
            portraits. We don't actually need horizontal scrolling
            (max 4 enemies per encounter), so visible is correct. */}
        <div
          style={{
            flex:           1,
            display:        "flex",
            gap:            10,
            justifyContent: "center",
            alignItems:     "stretch",
            paddingLeft:    8,
            overflow:       "visible",
          }}
        >
          {combat.enemies.map((e) => (
            <CombatantRow
              key={e.instance_id}
              combatant={e}
              isPlayer={false}
              floatingDamage={floatingByActor?.[e.instance_id]}
              isTargetable={attackTargeting}
              onTargetClick={() => handleTargetSelected(e.instance_id)}
              shake={!!shakeMap[e.instance_id]}
              enemyCount={combat.enemies.length}
              wcd={wcd}
            />
          ))}
        </div>
      </div>

      {/* UI-10 CHANGE 4 — Dice display. "16 vs 12 · hit" colour-coded.
          Re-mounts via key on every event change so the 80ms fade-in
          fires for each new roll. Hidden when there's no roll yet. */}
      {diceDisplay && (
        <div
          key={diceDisplay.key}
          className="ew-combat-dice"
          aria-live="polite"
          style={{
            display:        "flex",
            justifyContent: "center",
            alignItems:     "center",
            gap:            8,
            padding:        "4px 12px 8px",
            fontFamily:     "var(--mono)",
            fontSize:       14,
            lineHeight:     1,
          }}
        >
          <span style={{ color: "#e2cda0", fontWeight: 600 }}>
            {diceDisplay.total}
          </span>
          <span style={{ color: "#4a3818" }}>vs</span>
          <span style={{ color: "#6a5530" }}>
            {diceDisplay.dc ?? "—"}
          </span>
          <span style={{ color: "#3a3020" }}>·</span>
          <span style={{ color: diceDisplay.color, fontWeight: 600 }}>
            {diceDisplay.label}
          </span>
        </div>
      )}

      {/* ── Targeting hint banner ────────────────────────────────────── */}
      {attackTargeting && (
        <TargetPicker onCancel={() => setAttackTargeting(false)} />
      )}

      {/* ── Bottom strip: AbilityPanel when opened, else ActionBar ── */}
      {abilityPanelOpen ? (
        <AbilityPanel
          player={player}
          chargesUsed={combat.ability_charges_used}
          disabled={actionsDisabled}
          onSelect={handleAbilitySelected}
          onBack={handleAbilityPanelBack}
        />
      ) : (
        <ActionBar
          disabled={actionsDisabled}
          hasConsumables={hasConsumables}
          hasAbilities={hasAbilities}
          attackTargeting={attackTargeting}
          abilitiesActive={abilityPanelOpen}
          player={player}
          fleeDc={12}
          onAttack={handleAttackClick}
          onDefend={handleDefend}
          onUseItem={handleUseItemClick}
          onAbilities={handleAbilitiesClick}
          onFlee={handleFlee}
        />
      )}

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
// UI-10 CHANGE 4 — Dice display helper. Surfaces the most-recent roll
// for the current turn in "16 vs 12 · hit" format. Walks combat_log
// backwards, stops at the earliest of:
//   • a phase boundary (no roll yet this turn)
//   • a roll-bearing event (rolls.d20 populated)
// Colour-coded per outcome (design ref §8):
//   hit #7abb7a · miss #9a7060 · crit #e8d070 · fumble #c84830.
// ─────────────────────────────────────────────────────────────────────────────

interface DiceDisplay {
  key:   string;
  total: number;
  dc:    number | null;
  label: string;
  color: string;
}

const OUTCOME_LABEL: Record<string, string> = {
  hit:         "hit",
  miss:        "miss",
  crit:        "crit",
  fumble:      "fumble",
  fled:        "fled",
  fled_failed: "missed",
  kill:        "kill",
  defended:    "defend",
  item_used:   "used",
};

const OUTCOME_COLOR: Record<string, string> = {
  hit:         "#7abb7a",
  miss:        "#9a7060",
  crit:        "#e8d070",
  fumble:      "#c84830",
  fled:        "#7abb7a",
  fled_failed: "#9a7060",
  kill:        "#e8d070",
  defended:    "#a08870",
  item_used:   "#7abb7a",
};

function computeDiceDisplay(log: CombatEvent[]): DiceDisplay | null {
  for (let i = log.length - 1; i >= 0; i -= 1) {
    const ev = log[i];
    if (
      ev.type === "player_turn_start" ||
      ev.type === "enemy_phase_start" ||
      ev.type === "round_start" ||
      ev.type === "combat_start"
    ) {
      return null;
    }
    const r = ev.rolls;
    if (!r || typeof r.d20 !== "number") continue;
    const mod   = typeof r.d20_modifier === "number" ? r.d20_modifier : 0;
    const total = r.d20 + mod;
    const dc    = typeof r.target_dc === "number" ? Math.round(r.target_dc) : null;
    const oc    = typeof ev.outcome === "string" ? ev.outcome : "";
    return {
      key:   `${ev.timestamp}_${i}`,
      total,
      dc,
      label: OUTCOME_LABEL[oc] ?? oc ?? "—",
      color: OUTCOME_COLOR[oc] ?? "#a08870",
    };
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Day 20.4 TASK 3 + Day 20.4.1 TASK 1 — translate a CombatEvent → floating-
// number entry. Returns null when the event has nothing to float.
//
// Routing rules (locked by Day 20.4.1):
//   player_attack hit/crit → host = event.target (the targeted ENEMY's
//     instance_id). Color = DAMAGE_TYPE_COLOR[event.damage_type]. Show
//     damage_die_roll on hit; TOTAL damage on crit. Arcs right.
//   enemy_attack hit/crit  → host = "PLAYER". Color =
//     DAMAGE_TYPE_COLOR[event.damage_type]. Show damage_die_roll on hit;
//     TOTAL damage on crit. Arcs left.
//   use_item heal          → host = "PLAYER". Color = #7abb7a. Arc up.
//   defend / miss / fumble / flee / phase events: null.
//
// PR-11v-b — color + duration now come from the canonical DamageType
// the engine populates on each event. Arc direction picks a primary
// side (player → right, enemy → left) and rolls 20% for a slight
// opposite for visual variety.
// ─────────────────────────────────────────────────────────────────────────────

// PR-11v-d — colour + duration tables moved to lib/game/damage-types.ts
// so the float layer and the enemy-card subtitle consume the same
// canonical map. Duration defaults + the heal-specific 1300ms stay
// local — they're consumed only here.
const DEFAULT_DURATION = 1100;
const HEAL_DURATION    = 1300;

// PR-11v-b — pick the float arc with 80/20 variety. Crits always use
// the wide variants for impact; regular hits mostly follow the
// attacker's side but flip occasionally so back-to-back hits don't
// look identical.
function pickArc(
  side: "left" | "right",
  isCrit: boolean,
  rng: () => number = Math.random,
): FloatingDamageEntry["arc"] {
  if (isCrit) return side === "left" ? "left-wide" : "right-wide";
  if (rng() < 0.8) return side;
  return side === "left" ? "right" : "left";
}

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
      const dmgType = event.damage_type ?? "physical";
      // PR-11v-b HF3 — all crits (player and enemy) paint the same
      // red (#c84830). One colour reads as the universal "this is a
      // crit" signal regardless of who landed it.
      const color   = isCrit
        ? "#c84830"
        : (DAMAGE_TYPE_COLOR[dmgType] ?? "#e0d8c0");
      return {
        targetId: enemyId,
        payload: {
          key:   `${event.type}_${event.timestamp}_${enemyId}`,
          value,
          kind:  isCrit ? "crit" : "hit",
          color,
          arc:   pickArc("right", isCrit),
          animDuration: DAMAGE_TYPE_DURATION[dmgType] ?? DEFAULT_DURATION,
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
      const dmgType = event.damage_type ?? "physical";
      // PR-11v-b HF2 — enemy crits paint #c84830 (combat-enemy-crit
      // red) regardless of damage type. Mirror of the player-side
      // crit override above.
      const color   = isCrit
        ? "#c84830"
        : (DAMAGE_TYPE_COLOR[dmgType] ?? "#e0d8c0");
      return {
        targetId: PLAYER_ID,
        payload: {
          key:   `${event.type}_${event.timestamp}_${event.actor}`,
          value,
          kind:  isCrit ? "crit" : "hit",
          color,
          arc:   pickArc("left", isCrit),
          animDuration: DAMAGE_TYPE_DURATION[dmgType] ?? DEFAULT_DURATION,
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
          color: "#7abb7a",
          arc:   "up",
          animDuration: HEAL_DURATION,
        },
      };
    }

    // ── Ability dispatch → damage float on enemy / heal float on player ─
    // PR-11v-b HF1 — ability_used was the missing branch in v1; abilities
    // dealt damage and healed but emitted no float. Mirrors player_attack
    // for damage (arc right) and use_item for heal (arc up). Buff /
    // debuff / utility abilities emit damage_dealt === null and short-
    // circuit. Ability crits are not a thing today (abilities auto-hit),
    // so kind is always "hit" on the damage branch.
    case "ability_used": {
      if (typeof event.damage_dealt !== "number" || event.damage_dealt === null) {
        return null;
      }
      // Negative damage_dealt = heal (same convention as use_item).
      if (event.damage_dealt < 0) {
        const dieRoll = event.rolls?.damage_die_roll;
        if (typeof dieRoll !== "number" || dieRoll <= 0) return null;
        return {
          targetId: PLAYER_ID,
          payload: {
            key:          `ability_heal_${event.timestamp}`,
            value:        dieRoll,
            kind:         "heal",
            color:        "#7abb7a",
            arc:          "up",
            animDuration: HEAL_DURATION,
          },
        };
      }
      // Positive damage_dealt = ability damage on an enemy target.
      if (event.damage_dealt <= 0) return null;
      const enemyId = typeof event.target === "string" && event.target.length > 0
        ? event.target
        : null;
      if (!enemyId || enemyId === PLAYER_ID) return null;
      const dmgType = event.damage_type ?? "physical";
      const color   = DAMAGE_TYPE_COLOR[dmgType] ?? "#e0d8c0";
      return {
        targetId: enemyId,
        payload: {
          key:          `ability_dmg_${event.timestamp}_${enemyId}`,
          value:        event.damage_dealt,
          kind:         "hit",
          color,
          arc:          pickArc("right", false),
          animDuration: DAMAGE_TYPE_DURATION[dmgType] ?? DEFAULT_DURATION,
        },
      };
    }

    // ── Status DoT tick → muted-orange float over the affected portrait ─
    // Prompt 5 — poisoned/burning ticks emit a float too. The engine
    // applies status to the player only today, but route by event.target
    // defensively so a future enemy-side DoT lands on the right portrait.
    case "status_tick": {
      const dmg = event.damage_dealt ?? 0;
      if (dmg <= 0) return null;
      const hostId =
        typeof event.target === "string" && event.target.length > 0
          ? event.target
          : PLAYER_ID;
      return {
        targetId: hostId,
        payload: {
          key:   `status_tick_${event.timestamp}_${hostId}`,
          value: dmg,
          // "hit" kind keeps the 28px base size (no crit upgrade). The
          // muted acid-orange reads as residual DoT, not a fresh hit.
          kind:  "hit",
          color: "#fb923c",
          arc:   pickArc("left", false),
          animDuration: DEFAULT_DURATION,
        },
      };
    }

    // Everything else (defend, kill, flee_attempt, victory, defeat,
    // round_start, player_turn_start, enemy_phase_start, combat_start,
    // status_applied, status_saved, status_expired): no floating number.
    default:
      return null;
  }
}
