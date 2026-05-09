"use client";

import { useCallback, useState } from "react";
import { useGameStore, makeMessage } from "@/lib/stores/game-store";
import { LocationStatus } from "@/types/game";
import type { CombatEvent, CombatState, MasterState, PlayerState } from "@/types/game";
import {
  executePlayerAction as engineExecute,
  PLAYER_ID,
  type CombatResolutionPayload,
  type PlayerActionInput,
} from "@/lib/game/combat-engine";
import { renderRoutineCombatEvent } from "@/lib/game/combat-narration/templates";

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

/**
 * Events whose outcomes get LLM-narrated prose. Everything else
 * uses the templated pool in lib/game/combat-narration/templates.
 * Spec §10 + Prompt 3 locked decision.
 */
function isDramaticEvent(ev: CombatEvent): boolean {
  if (ev.type === "combat_start")  return true;
  if (ev.type === "victory")       return true;
  if (ev.type === "defeat")        return true;
  if (ev.type === "flee_success")  return true;
  if (ev.outcome === "crit")       return true;
  if (ev.outcome === "kill")       return true;
  // round_start has no narration — silent.
  return false;
}

export function useCombat() {
  const masterState = useGameStore((s) => s.masterState);
  const setMasterState = useGameStore((s) => s.setMasterState);
  const addMessage = useGameStore((s) => s.addMessage);

  // True while we're awaiting the engine + LLM fetches for the
  // dramatic events. UI gates the action bar on this so the player
  // can't submit a second action mid-resolution.
  const [isResolving, setIsResolving] = useState(false);

  /**
   * Submit a player combat action. Resolves through the engine,
   * splices state, then walks the emitted events: routine events
   * get templated story-feed lines instantly, dramatic events
   * (combat_start/crit/kill/victory/defeat/flee_success) hit the
   * /api/game/narrate-combat endpoint for prose. The action bar
   * stays disabled until all narration has landed.
   */
  const submitCombatAction = useCallback(
    async (action: PlayerActionInput) => {
      const state = useGameStore.getState().masterState;
      if (!state || !state.combat?.active) {
        console.warn("[useCombat] submitCombatAction with no active combat — ignored.");
        return;
      }

      setIsResolving(true);
      try {
        const result = engineExecute({
          action,
          state:                  state.combat,
          player:                 state.player_state,
          world_genre:            state.metadata.genre,
          last_settlement_hub_id: state.last_settlement_hub_id,
          navigation_trail:       state.navigation_trail,
        });

        const next = applyCombatResult(
          state, result.newState, result.newPlayer, result.resolution
        );
        setMasterState(next);

        // Project events into the story feed.
        await projectCombatEventsToFeed({
          events:           result.events,
          combat:           result.newState ?? state.combat,
          player:           result.newPlayer,
          world_genre:      String(state.metadata.genre),
          regionAtmosphere: regionAtmosphereFor(state),
          addMessage,
        });
      } finally {
        setIsResolving(false);
      }
    },
    [setMasterState, addMessage]
  );

  return {
    /** Active combat snapshot (undefined when not in combat). */
    combat: masterState?.combat,
    /** Convenience: is it the player's turn right now? UI gates on this. */
    isPlayerTurn:
      masterState?.combat?.active === true &&
      masterState.combat.turn_order[masterState.combat.current_turn_index] === PLAYER_ID,
    /** Engine + narration in flight; action bar should disable. */
    isResolving,
    submitCombatAction,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Combat events -> story feed projection
// ─────────────────────────────────────────────────────────────────────────────

interface ProjectArgs {
  events:           CombatEvent[];
  combat:           CombatState;
  player:           PlayerState;
  world_genre:      string;
  regionAtmosphere: string;
  addMessage:       (m: ReturnType<typeof makeMessage>) => void;
}

async function projectCombatEventsToFeed(args: ProjectArgs): Promise<void> {
  const enemyNameByInstanceId = (id: string): string | undefined =>
    args.combat.enemies.find((e) => e.instance_id === id)?.name;

  for (const event of args.events) {
    // Round_start events are silent in the feed (header counter is enough).
    if (event.type === "round_start") continue;

    if (isDramaticEvent(event)) {
      // Dramatic — fetch LLM prose, then push.
      const text = await fetchCombatNarration(event, args);
      if (text) {
        args.addMessage(
          makeMessage("COMBAT", text, makeCombatMessageMetadata(event))
        );
      }
      continue;
    }

    // Routine — pull a templated line. Falls back to a minimal sentence
    // if the templates file returns null (defensive against future
    // event types we haven't added templates for).
    const itemForTemplate =
      event.type === "use_item" && event.weapon_or_item
        ? event.weapon_or_item
        : undefined;
    const templated = renderRoutineCombatEvent(event, {
      enemyName:  enemyNameByInstanceId,
      playerName: args.player.name,
      itemName:   itemForTemplate,
    });
    if (templated) {
      args.addMessage(
        makeMessage("COMBAT", templated, makeCombatMessageMetadata(event))
      );
    }
  }
}

async function fetchCombatNarration(
  event: CombatEvent,
  args:  ProjectArgs
): Promise<string> {
  try {
    const res = await fetch("/api/game/narrate-combat", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        event,
        combat_context: {
          player_name:       args.player.name,
          player_class:      args.player.background,
          enemies: args.combat.enemies.map((e) => ({
            name:            e.name,
            description:     e.description,
            behavior_flavor: e.behavior_flavor,
            alive:           e.alive,
          })),
          region_atmosphere: args.regionAtmosphere,
        },
        genre: args.world_genre,
      }),
    });
    if (!res.ok) {
      console.error("[useCombat] narrate-combat failed:", await res.text());
      return fallbackForDramaticEvent(event);
    }
    const data = await res.json() as { text?: string };
    return data.text?.trim() || fallbackForDramaticEvent(event);
  } catch (err) {
    console.error("[useCombat] narrate-combat threw:", err);
    return fallbackForDramaticEvent(event);
  }
}

function fallbackForDramaticEvent(event: CombatEvent): string {
  switch (event.type) {
    case "combat_start": return "Combat begins.";
    case "victory":      return "The last foe falls.";
    case "defeat":       return "Darkness closes in.";
    case "flee_success": return "You break free.";
    case "kill":         return "The enemy collapses.";
    default:
      if (event.outcome === "crit") return "A critical strike lands.";
      return "";
  }
}

/** StoryMessage metadata payload — StoryFeed reads this to apply
 *  combat-specific styling per locked decisions §10. */
function makeCombatMessageMetadata(event: CombatEvent): Record<string, unknown> {
  return {
    combat: true,
    event_type:   event.type,
    actor:        event.actor,
    target:       event.target,
    outcome:      event.outcome,
    damage_dealt: event.damage_dealt,
  };
}

function regionAtmosphereFor(state: MasterState): string {
  // Look at the current location asset's atmosphere if present;
  // safe to fall back to "" for the LLM (region context is just a
  // tonal hint, not a fact source).
  const wb = state.metadata.world_bible;
  if (!wb) return "";
  return wb.starting_region.atmosphere ?? "";
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
