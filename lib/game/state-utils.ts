import { Genre, LogEntryType, type Item, type MasterState, type NPCMemory } from "@/types/game";

export function updateHealth(state: MasterState, delta: number): MasterState {
  const health = Math.max(0, Math.min(state.player_state.max_health, state.player_state.health + delta));
  return {
    ...state,
    player_state: { ...state.player_state, health },
  };
}

export function updateSanity(state: MasterState, delta: number): MasterState | null {
  if (state.metadata.genre !== Genre.HORROR_LOVECRAFTIAN) return null;
  const sanity = Math.max(0, Math.min(state.player_state.max_sanity ?? 100, (state.player_state.sanity ?? 100) + delta));
  return {
    ...state,
    player_state: { ...state.player_state, sanity },
  };
}

export function addToInventory(state: MasterState, item: Item): MasterState {
  const existing = state.player_state.inventory.find((i) => i.id === item.id);
  const inventory = existing
    ? state.player_state.inventory.map((i) =>
        i.id === item.id ? { ...i, quantity: i.quantity + item.quantity } : i
      )
    : [...state.player_state.inventory, item];
  return {
    ...state,
    player_state: { ...state.player_state, inventory },
  };
}

export function removeFromInventory(state: MasterState, itemId: string, quantity: number): MasterState {
  const inventory = state.player_state.inventory
    .map((i) => (i.id === itemId ? { ...i, quantity: i.quantity - quantity } : i))
    .filter((i) => i.quantity > 0);
  return {
    ...state,
    player_state: { ...state.player_state, inventory },
  };
}

export function setWorldFlag(
  state: MasterState,
  flagId: string,
  value: boolean | number | string
): MasterState {
  return {
    ...state,
    world_state: {
      ...state.world_state,
      flags: { ...state.world_state.flags, [flagId]: value },
    },
  };
}

export function hasWorldFlag(state: MasterState, flagId: string): boolean | number | string {
  return state.world_state.flags[flagId] ?? false;
}

export function addLogEntry(state: MasterState, type: LogEntryType, content: string): MasterState {
  const entry = {
    id:        crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    type,
    content,
  };
  const entries = [entry, ...state.log_book.entries].slice(0, 100);
  return {
    ...state,
    log_book: { ...state.log_book, entries },
  };
}

export function updateNPCTrust(state: MasterState, npcKey: string, delta: number): MasterState {
  const npc = state.npc_registry[npcKey];
  if (!npc) return state;
  const trust_score = Math.max(0, Math.min(100, npc.trust_score + delta));
  return {
    ...state,
    npc_registry: {
      ...state.npc_registry,
      [npcKey]: { ...npc, trust_score },
    },
  };
}

export function addNPCMemory(state: MasterState, npcKey: string, memory: string): MasterState {
  const npc = state.npc_registry[npcKey];
  if (!npc) return state;
  const memory_snippets = [...npc.memory_snippets, memory].slice(-10);
  return {
    ...state,
    npc_registry: {
      ...state.npc_registry,
      [npcKey]: { ...npc, memory_snippets },
    },
  };
}

export function applyStateDelta(state: MasterState, delta: Partial<MasterState>): MasterState {
  return {
    ...state,
    ...delta,
    metadata:     delta.metadata     ? { ...state.metadata,     ...delta.metadata }     : state.metadata,
    player_state: delta.player_state ? { ...state.player_state, ...delta.player_state } : state.player_state,
    world_state:  delta.world_state  ? { ...state.world_state,  ...delta.world_state }  : state.world_state,
    log_book:     delta.log_book     ? { ...state.log_book,     ...delta.log_book }     : state.log_book,
    npc_registry: delta.npc_registry ? { ...state.npc_registry, ...delta.npc_registry } : state.npc_registry,
  };
}

// Re-export NPCMemory so callers can use it via state-utils if needed
export type { NPCMemory };
