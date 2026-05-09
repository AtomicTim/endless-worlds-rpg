"use client";

import { useCallback } from "react";
import { useGameStore } from "@/lib/stores/game-store";
import { LocationStatus } from "@/types/game";
import type { CombatState, MasterState, PlayerState } from "@/types/game";
import {
  executePlayerAction as engineExecute,
  PLAYER_ID,
  type CombatResolutionPayload,
  type PlayerActionInput,
} from "@/lib/game/combat-engine";

/**
 * Day 20 Combat — React hook layer.
 *
 * Wraps the pure combat-engine functions with game-store mutations.
 * The UI in Prompt 3 will call these hooks; for Prompt 2 they're
 * exercised by tests + the dev console.
 *
 * Also exposes `window.__forceEncounter(...ids)` in development mode
 * — sets a one-shot encounter override that the game loop's
 * encounter trigger reads on the next arrival. The helper registers
 * at module-load time (below) so it's available even before any
 * combat UI mounts; useGameLoop.ts imports `consumeForcedEncounter`
 * from this file, which triggers the module load on game start.
 */

// Module-level dev override slot. Read once and consumed by the
// encounter trigger in useGameLoop (or any other consumer).
let _forcedEncounterRoster: string[] | null = null;

/** Read + clear the dev-mode forced roster. Returns null when none queued. */
export function consumeForcedEncounter(): string[] | null {
  const v = _forcedEncounterRoster;
  _forcedEncounterRoster = null;
  return v;
}

/** Programmatic setter — mostly used by the window helper below. */
export function setForcedEncounter(ids: string[]): void {
  _forcedEncounterRoster = ids;
}

// ── Dev-only browser console helper ─────────────────────────────────────────
// Calling __forceEncounter from the browser console queues a roster;
// the next arrival's encounter trigger (useGameLoop step 7c-3) consumes
// it and starts combat with exactly those enemies, ignoring
// encounter_chance / weighted count. Gated on NODE_ENV="development"
// so production bundles never expose it.
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).__forceEncounter = (...enemyIds: string[]) => {
    _forcedEncounterRoster = enemyIds.length > 0 ? enemyIds : null;
    // eslint-disable-next-line no-console
    console.log(
      `[Combat] __forceEncounter armed: next arrival spawns [${enemyIds.join(", ")}].`
    );
  };
}

export function useCombat() {
  const masterState = useGameStore((s) => s.masterState);
  const setMasterState = useGameStore((s) => s.setMasterState);

  /**
   * Submit a player combat action. Resolves through the engine,
   * applies the resulting state + handles victory/defeat/flee
   * teleports.
   */
  const submitCombatAction = useCallback(
    (action: PlayerActionInput) => {
      const state = useGameStore.getState().masterState;
      if (!state || !state.combat?.active) {
        console.warn("[useCombat] submitCombatAction with no active combat — ignored.");
        return;
      }
      const result = engineExecute({
        action,
        state:                  state.combat,
        player:                 state.player_state,
        world_genre:            state.metadata.genre,
        last_settlement_hub_id: state.last_settlement_hub_id,
        navigation_trail:       state.navigation_trail,
      });

      const next = applyCombatResult(state, result.newState, result.newPlayer, result.resolution);
      setMasterState(next);
    },
    [setMasterState]
  );

  return {
    /** Active combat snapshot (undefined when not in combat). */
    combat: masterState?.combat,
    /** Convenience: is it the player's turn right now? UI gates on this. */
    isPlayerTurn:
      masterState?.combat?.active === true &&
      masterState.combat.turn_order[masterState.combat.current_turn_index] === PLAYER_ID,
    submitCombatAction,
  };
}

/**
 * Splice the engine's result into a fresh MasterState. Handles all
 * three resolution kinds (victory/defeat/flee) by clearing the
 * combat slice and applying the appropriate side-effects (teleport,
 * status change). Pure — caller commits via setMasterState.
 */
export function applyCombatResult(
  state:      MasterState,
  newCombat:  CombatState | undefined,
  newPlayer:  PlayerState,
  resolution: CombatResolutionPayload | undefined
): MasterState {
  // No resolution: combat continues, just splice in the new state.
  if (!resolution) {
    return { ...state, player_state: newPlayer, combat: newCombat };
  }

  switch (resolution.kind) {
    case "victory":
      // Combat dismissed; player remains at origin_node_id.
      return {
        ...state,
        player_state: newPlayer,
        combat:       undefined,
      };
    case "defeat": {
      // Teleport to the death-warp target. Mark ARRIVING so the normal
      // post-arrival pipeline (asset reload, codex first-visit) fires
      // for the settlement scene.
      const targetId = resolution.teleport_to_node_id;
      return {
        ...state,
        player_state: newPlayer,
        combat:       undefined,
        world_state: {
          ...state.world_state,
          current_location_id: targetId,
          current_node_id:     targetId,
          location_status:     LocationStatus.ARRIVING,
        },
        ...(state.world_graph
          ? {
              world_graph: {
                ...state.world_graph,
                current_node_id: targetId,
              },
            }
          : {}),
      };
    }
    case "flee_success": {
      const targetId = resolution.teleport_to_node_id;
      return {
        ...state,
        player_state: newPlayer,
        combat:       undefined,
        world_state: {
          ...state.world_state,
          current_location_id: targetId,
          current_node_id:     targetId,
          location_status:     LocationStatus.ARRIVING,
        },
        ...(state.world_graph
          ? {
              world_graph: {
                ...state.world_graph,
                current_node_id: targetId,
              },
            }
          : {}),
      };
    }
  }
}
