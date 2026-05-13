"use client";

import { useCallback, useEffect, useRef } from "react";
import { makeMessage, useGameStore } from "@/lib/stores/game-store";
import type { DungeonRoom, Item, MasterState, WorldNode } from "@/types/game";
import {
  advanceDungeonState,
  canEnterRoom,
  findEntranceRoom,
  findKeyForRoom,
  findRoom,
  getCurrentRoom,
  initialDungeonState,
  isAdjacentRoom,
  isAtDungeonEntrance,
  isDungeonNode,
  markRoomDiscovered,
  markRoomUnlocked,
  playerHasKeyFor,
} from "@/lib/game/dungeon-navigation";
import { rollEncounterWithPlayer } from "@/lib/game/combat-engine";
import {
  findActOneBreadcrumb,
  markActOneDiscovered,
  shouldTriggerBossClearDiscovery,
} from "@/lib/game/quest-discovery";
import { saveQuestThreadsAsync } from "@/hooks/useGameLoop";

/**
 * Day 23A part 2 — dungeon runtime hook.
 *
 * Owns the dungeon-side concerns useGameLoop intentionally doesn't:
 *   • Initial dungeon entry: when the player navigates to a dungeon
 *     node and `dungeon_state` isn't yet set for it, drop them in the
 *     entrance room, mark it discovered, and emit the room's
 *     description as a story-feed beat (no LLM call — the room.description
 *     is the cached arrival text per V8.53 cache-hit semantics).
 *   • Room-to-room navigation (navigateToRoom): walk a connected
 *     edge, fire an encounter check per the target room's
 *     encounter_chance (skipped on revisit, rule 86), apply the
 *     room description / "you return to…" beat.
 *   • Locked-room unlock flow: useKeyOnRoom consumes the key item;
 *     forceUnlockRoom is the STR-bypass path. Both flip lock.unlocked
 *     and emit a templated story-feed beat.
 *   • Dungeon-exit: walking BACK from the entrance is a normal nav
 *     to the parent region (useGameLoop.navigateTo handles it).
 *     We DO NOT clear dungeon_state on exit — it persists so re-entry
 *     resumes from the player's last room with rooms_visited intact.
 *
 * Pure logic lives in lib/game/dungeon-navigation. This hook is the
 * thin glue between those helpers and the game store; tests cover
 * the helpers (40 cases at last count) so we don't re-test that
 * surface here.
 */

/** Templated beats emitted on dungeon transitions — no LLM. */
function roomArrivalBeat(room: DungeonRoom, alreadyVisited: boolean): string {
  if (alreadyVisited) return `You return to ${room.name}.`;
  return room.description?.trim() || `You enter ${room.name}.`;
}

function useKeyBeat(keyItemName: string): string {
  // Key item names already carry their article ("The Warden's Seal",
  // "Aldric's Iron Key") so we don't prepend "the" — that produced
  // ugly "You use the The Warden's Seal." beats.
  return `You use ${keyItemName}. The door grinds open.`;
}

function forceUnlockBeat(): string {
  return "You force the door. The ancient mechanism gives way.";
}

function bossClearBeat(): string {
  return "The dungeon falls silent.";
}

/** Threshold for the STR-bypass action on locked rooms. Raw stat
 *  score (not modifier) per spec. */
const STR_BYPASS_THRESHOLD = 6;

/**
 * GUARD B (rule 100 corollary) — does the current MasterState block
 * dungeon auto-entry? Returns true when combat is active or the state
 * is null/undefined. The auto-entry useEffect reads this before
 * mutating world_graph + dungeon_state; mid-combat mutation collides
 * with useCombat's reactive subscription and freezes the UI.
 *
 * Pure + exported so the regression has a pinned test target.
 */
export function combatBlocksDungeonEntry(
  state: MasterState | null | undefined
): boolean {
  if (!state) return true;
  return state.combat?.active === true;
}

export function useDungeonRuntime() {
  const masterState    = useGameStore((s) => s.masterState);
  const setMasterState = useGameStore((s) => s.setMasterState);
  const addMessage     = useGameStore((s) => s.addMessage);

  // ── Auto-entry detection ───────────────────────────────────────────────────
  //
  // When the player arrives at a dungeon WorldNode and dungeon_state
  // isn't already populated for it, initialize the state slice + drop
  // them at the entrance room. Runs as a side-effect after the standard
  // useGameLoop arrival flow commits the new current_node_id — that
  // way the discovery + asset-refresh side effects fire first, then
  // we layer dungeon_state on top.
  //
  // The handled-ref guards against re-firing for the same arrival when
  // unrelated store updates re-trigger the effect.
  const handledEntryRef = useRef<string | null>(null);

  useEffect(() => {
    if (!masterState) return;
    // GUARD B — do not initialize dungeon_state while combat is active.
    // Combat takes precedence: mutating world_graph / dungeon_state here
    // mid-fight collides with useCombat's reactive subscription and
    // freezes the UI (displayPhase pill stuck on ENEMY TURN, buttons
    // unresponsive). The effect re-runs once combat resolves (master_state
    // changes), at which point this guard releases and entry proceeds.
    if (combatBlocksDungeonEntry(masterState)) return;
    const graph = masterState.world_graph;
    const currentNodeId = graph?.current_node_id ?? masterState.world_state.current_node_id;
    if (!graph || !currentNodeId) return;
    const node = graph.nodes[currentNodeId];
    if (!node || !isDungeonNode(node)) {
      handledEntryRef.current = null;
      return;
    }

    // Same node + an existing dungeon_state? No entry to init.
    const ds = masterState.dungeon_state;
    if (ds && ds.node_id === node.id) {
      handledEntryRef.current = node.id;
      return;
    }

    // Already processed this entry — avoid loops when something
    // re-renders the store without the dungeon_state change persisting.
    if (handledEntryRef.current === node.id) return;
    handledEntryRef.current = node.id;

    const entrance = findEntranceRoom(node);
    if (!entrance) return;

    const fresh = initialDungeonState(node);
    if (!fresh) return;

    const updatedNode = markRoomDiscovered(node, entrance.id);
    setMasterState({
      ...masterState,
      world_graph: {
        ...graph,
        nodes: { ...graph.nodes, [node.id]: updatedNode },
      },
      dungeon_state: fresh,
    });

    addMessage(
      makeMessage("NARRATIVE", roomArrivalBeat(entrance, false), {
        outcome_type:  "DUNGEON_ENTRY",
        response_tier: 2,
        locationName:  entrance.name,
        dungeon_room:  entrance.id,
      })
    );
  }, [masterState, setMasterState, addMessage]);

  // ── Room-to-room navigation ────────────────────────────────────────────────

  /**
   * Walk a connected edge inside the active dungeon. Validates
   * adjacency + lock state, advances dungeon_state, fires an
   * encounter check per the target room's chance (skipped on
   * revisit), and emits the templated story-feed beat.
   *
   * Locked rooms route through useKeyOnRoom or forceUnlockRoom
   * BEFORE calling this — navigateToRoom alone refuses to enter
   * an un-unlocked locked room.
   */
  const navigateToRoom = useCallback((targetRoomId: string): void => {
    const state = useGameStore.getState().masterState;
    if (!state) return;
    const ds = state.dungeon_state;
    if (!ds) return;
    const graph = state.world_graph;
    const node = graph?.nodes[ds.node_id];
    if (!graph || !node) return;

    // Validate the move.
    if (!isAdjacentRoom(node, ds.current_room_id, targetRoomId)) return;
    const target = findRoom(node, targetRoomId);
    if (!target) return;
    if (!canEnterRoom(target, state.player_state.inventory)) return;

    const alreadyVisited = ds.rooms_visited.includes(targetRoomId);
    const nextDs = advanceDungeonState(ds, targetRoomId);

    // Mark the target room discovered on first visit; mutation is
    // monotonic so it's a no-op if already discovered.
    const updatedNode = alreadyVisited ? node : markRoomDiscovered(node, target.id);

    let updatedState: MasterState = {
      ...state,
      world_graph: {
        ...graph,
        nodes: { ...graph.nodes, [node.id]: updatedNode },
      },
      dungeon_state: nextDs,
    };

    // Encounter check — fires only on FIRST entry per room. Revisits
    // suppress the roll so cleared rooms stay cleared. Reuses the
    // same combat-engine path as graph-node arrivals.
    if (!alreadyVisited && target.encounter_chance > 0) {
      const effectiveNode: WorldNode = {
        ...updatedNode,
        encounter_chance: target.encounter_chance,
      };
      const playerAgiMod = Math.floor(
        (state.player_state.attributes.agility - 2) / 2
      );
      const result = rollEncounterWithPlayer({
        node:           effectiveNode,
        world_bible:    state.metadata.world_bible,
        region_bibles:  state.metadata.region_bibles,
        genre:          state.metadata.genre,
        current_xp:     state.player_state.xp,
        player_agi_mod: playerAgiMod,
      });
      if (result.combatStarted && result.combat) {
        updatedState = { ...updatedState, combat: result.combat };
      }
    }

    setMasterState(updatedState);
    addMessage(
      makeMessage("NARRATIVE", roomArrivalBeat(target, alreadyVisited), {
        outcome_type:  alreadyVisited ? "DUNGEON_REVISIT" : "DUNGEON_ARRIVAL",
        response_tier: 2,
        locationName:  target.name,
        dungeon_room:  target.id,
      })
    );
  }, [setMasterState, addMessage]);

  // ── Locked-room actions ────────────────────────────────────────────────────

  /**
   * Consume a key item from inventory to unlock a room. Validates
   * that the player actually holds the key (defensive — UI also
   * gates the button visibility on `playerHasKeyFor`).
   */
  const useKeyOnRoom = useCallback((roomId: string): void => {
    const state = useGameStore.getState().masterState;
    if (!state) return;
    const ds = state.dungeon_state;
    if (!ds) return;
    const graph = state.world_graph;
    const node = graph?.nodes[ds.node_id];
    if (!graph || !node) return;
    const room = findRoom(node, roomId);
    if (!room || !room.lock || room.lock.unlocked) return;

    const key = findKeyForRoom(state.player_state.inventory, roomId);
    if (!key) return;

    // Consume one stack of the key. Drop the row when quantity hits 0.
    const remaining = (key.quantity ?? 1) - 1;
    const newInventory = remaining > 0
      ? state.player_state.inventory.map((i) =>
          i.id === key.id ? { ...i, quantity: remaining } : i
        )
      : state.player_state.inventory.filter((i) => i.id !== key.id);

    const updatedNode = markRoomUnlocked(node, roomId);
    setMasterState({
      ...state,
      player_state: { ...state.player_state, inventory: newInventory },
      world_graph: {
        ...graph,
        nodes: { ...graph.nodes, [node.id]: updatedNode },
      },
    });
    addMessage(
      makeMessage("NARRATIVE", useKeyBeat(room.lock.key_item_name), {
        outcome_type:  "DUNGEON_UNLOCK_KEY",
        response_tier: 1,
      })
    );
  }, [setMasterState, addMessage]);

  /**
   * STR-bypass unlock. Validates the player's raw STR score against
   * the threshold; emits a different beat than the key path.
   */
  const forceUnlockRoom = useCallback((roomId: string): void => {
    const state = useGameStore.getState().masterState;
    if (!state) return;
    if (state.player_state.attributes.strength < STR_BYPASS_THRESHOLD) return;
    const ds = state.dungeon_state;
    if (!ds) return;
    const graph = state.world_graph;
    const node = graph?.nodes[ds.node_id];
    if (!graph || !node) return;
    const room = findRoom(node, roomId);
    if (!room || !room.lock || room.lock.unlocked) return;

    const updatedNode = markRoomUnlocked(node, roomId);
    setMasterState({
      ...state,
      world_graph: {
        ...graph,
        nodes: { ...graph.nodes, [node.id]: updatedNode },
      },
    });
    addMessage(
      makeMessage("NARRATIVE", forceUnlockBeat(), {
        outcome_type:  "DUNGEON_UNLOCK_FORCE",
        response_tier: 1,
      })
    );
  }, [setMasterState, addMessage]);

  // ── Boss-victory observer ──────────────────────────────────────────────────
  //
  // When combat ends with the player victorious AND the player is
  // inside a dungeon boss room, emit the "The dungeon falls silent."
  // beat. Tracks last seen boss-room id so the beat fires exactly
  // once per defeated boss room (combat.active false transitions).

  const lastBossVictoryRef = useRef<string | null>(null);

  useEffect(() => {
    if (!masterState) return;
    const ds = masterState.dungeon_state;
    const combat = masterState.combat;
    if (!ds || combat?.active === true) return;
    // Combat just dismissed (or there is no combat). Was the previous
    // tick a boss-room fight, with the player winning?
    const graph = masterState.world_graph;
    const node = graph?.nodes[ds.node_id];
    const room = node ? findRoom(node, ds.current_room_id) : null;
    if (!room || room.room_type !== "boss") return;
    if (lastBossVictoryRef.current === room.id) return;

    // Defensive: only fire when the boss room is marked discovered
    // (means we navigated in successfully) AND the player has any
    // health left (not a defeat warp). The post-victory beat is
    // purely flavor; the existing victory banner already plays.
    if (!room.discovered) return;
    if (masterState.player_state.health <= 0) return;

    lastBossVictoryRef.current = room.id;
    addMessage(
      makeMessage("SYSTEM", bossClearBeat(), {
        boss_cleared:    true,
        dungeon_node_id: ds.node_id,
        room_id:         room.id,
      })
    );

    // Day 23B pt 2 — TRIGGER B: first dungeon boss clear discovers the
    // Act 1 breadcrumb. Fires after the templated "The dungeon falls
    // silent." beat so the discovery reveal lands second, framing the
    // breadcrumb as a realization. Idempotent — markActOneDiscovered
    // returns null if the breadcrumb is already discovered (which
    // happens when the player had an NPC conversation first via
    // TRIGGER A).
    if (shouldTriggerBossClearDiscovery(masterState)) {
      const updatedQt = markActOneDiscovered(masterState.quest_threads);
      const act1      = findActOneBreadcrumb(masterState.quest_threads);
      if (updatedQt && act1) {
        setMasterState({
          ...masterState,
          quest_threads: updatedQt,
        });
        addMessage(
          makeMessage("SYSTEM", act1.content, {
            quest_discovery: true,
            breadcrumb_id:   act1.id,
            act:             1,
            trigger:         "boss_clear",
          })
        );
        saveQuestThreadsAsync(masterState.metadata.session_id, updatedQt);
        console.log(
          `[DungeonRuntime/boss-clear] Act 1 breadcrumb discovered via boss clear (${room.id}).`
        );
      }
    }
  }, [masterState, addMessage, setMasterState]);

  // ── UI-facing helpers ──────────────────────────────────────────────────────

  /** True when the player meets the STR threshold for the bypass button. */
  const canForceUnlock = useCallback((): boolean => {
    const state = useGameStore.getState().masterState;
    if (!state) return false;
    return state.player_state.attributes.strength >= STR_BYPASS_THRESHOLD;
  }, []);

  /** Look up the key item in the player's inventory for a given
   *  room id. Returns null when the player doesn't hold it. */
  const keyItemForRoom = useCallback((roomId: string): Item | null => {
    const state = useGameStore.getState().masterState;
    if (!state) return null;
    return findKeyForRoom(state.player_state.inventory, roomId);
  }, []);

  return {
    /** Active dungeon room (null when outside a dungeon). */
    currentRoom: ((): DungeonRoom | null => {
      if (!masterState?.dungeon_state) return null;
      const node = masterState.world_graph?.nodes[masterState.dungeon_state.node_id];
      return getCurrentRoom(node, masterState.dungeon_state);
    })(),
    /** Active dungeon WorldNode. */
    dungeonNode: ((): WorldNode | null => {
      if (!masterState?.dungeon_state) return null;
      return masterState.world_graph?.nodes[masterState.dungeon_state.node_id] ?? null;
    })(),
    /** Convenience for nav-bar BACK semantics. */
    atDungeonEntrance: isAtDungeonEntrance(
      masterState?.dungeon_state
        ? masterState.world_graph?.nodes[masterState.dungeon_state.node_id]
        : undefined,
      masterState?.dungeon_state
    ),
    navigateToRoom,
    useKeyOnRoom,
    forceUnlockRoom,
    canForceUnlock,
    keyItemForRoom,
    playerHasKeyFor: (roomId: string) =>
      masterState ? playerHasKeyFor(masterState.player_state.inventory, roomId) : false,
    /** STR threshold exposed so the popover can render "STR 6 required". */
    strBypassThreshold: STR_BYPASS_THRESHOLD,
  };
}

// Pure helpers re-exported for testing.
export {
  roomArrivalBeat,
  useKeyBeat,
  forceUnlockBeat,
  bossClearBeat,
  STR_BYPASS_THRESHOLD,
};
