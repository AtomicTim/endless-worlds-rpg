"use client";

import { useCallback } from "react";
import { useGameStore, makeMessage } from "@/lib/stores/game-store";
import {
  applySearchRemains,
  applyTake,
  applyTakeAll,
  applyTakeGold,
  pickBossDropItemForNode,
  pickRegionLootItemsForNode,
} from "@/lib/game/floor-loot";
import { persistState } from "./useGameLoop";

/**
 * Day 21 — TAKE / SEARCH REMAINS handlers (TASK 9 + TASK 11 spec).
 *
 * Thin React wrapper around the pure transitions in lib/game/floor-
 * loot.ts. Each callback:
 *   1. Reads the latest MasterState from the zustand store.
 *   2. Calls the matching pure transition (null = no-op, bail).
 *   3. Commits via store.setMasterState.
 *   4. Persists via the shared persistState helper from useGameLoop.
 *   5. Dispatches a templated story-feed beat where appropriate (no
 *      LLM calls).
 *
 * Pure logic lives in floor-loot.ts so jest can pin every state
 * transition without a React renderer.
 */

export interface FloorLootHandlers {
  onSearchRemains: (entry_id: string) => void;
  onTake:          (entry_id: string, item_id: string) => void;
  onTakeGold:      (entry_id: string) => void;
  onTakeAll:       (entry_id: string) => void;
}

export function useFloorLoot(): FloorLootHandlers {
  const setMasterState = useGameStore((s) => s.setMasterState);
  const addMessage     = useGameStore((s) => s.addMessage);

  const onSearchRemains = useCallback((entry_id: string) => {
    const state = useGameStore.getState().masterState;
    if (!state) return;
    const entry = (state.floor_loot ?? []).find((e) => e.id === entry_id);
    if (!entry) return;

    const result = applySearchRemains(state, entry_id, {
      world_loot_items:  state.metadata.world_bible?.world_loot_items,
      region_loot_items: pickRegionLootItemsForNode(state, entry.node_id),
      boss_drop_item:    pickBossDropItemForNode(state, entry.node_id),
    });
    if (!result) return;

    addMessage(makeMessage("NARRATIVE", result.beat));
    setMasterState(result.state);
    void persistState(result.state, addMessage);
  }, [setMasterState, addMessage]);

  const onTake = useCallback((entry_id: string, item_id: string) => {
    const state = useGameStore.getState().masterState;
    if (!state) return;
    const next = applyTake(state, entry_id, item_id);
    if (!next) return;
    setMasterState(next);
    void persistState(next, addMessage);
  }, [setMasterState, addMessage]);

  const onTakeGold = useCallback((entry_id: string) => {
    const state = useGameStore.getState().masterState;
    if (!state) return;
    const next = applyTakeGold(state, entry_id);
    if (!next) return;
    setMasterState(next);
    void persistState(next, addMessage);
  }, [setMasterState, addMessage]);

  const onTakeAll = useCallback((entry_id: string) => {
    const state = useGameStore.getState().masterState;
    if (!state) return;
    const next = applyTakeAll(state, entry_id);
    if (!next) return;
    setMasterState(next);
    void persistState(next, addMessage);
  }, [setMasterState, addMessage]);

  return { onSearchRemains, onTake, onTakeGold, onTakeAll };
}
