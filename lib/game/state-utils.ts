import {
  Genre,
  ItemType,
  LogEntryType,
  type Attributes,
  type EquippedLoadout,
  type Item,
  type MasterState,
  type NPCMemory,
  type StateDelta,
} from "@/types/game";

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

export function applyStateDelta(state: MasterState, delta: StateDelta): MasterState {
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

// ── Equip / unequip ───────────────────────────────────────────────────────────

function applyBonus(attrs: Attributes, bonus: Partial<Attributes>, sign: 1 | -1): Attributes {
  const result = { ...attrs };
  for (const [stat, val] of Object.entries(bonus)) {
    if (typeof val === "number") {
      result[stat as keyof Attributes] = (result[stat as keyof Attributes] ?? 0) + sign * val;
    }
  }
  return result;
}

export function equipItem(state: MasterState, itemId: string): MasterState {
  const item = state.player_state.inventory.find((i) => i.id === itemId);
  if (!item) return state;
  if (item.type !== ItemType.WEAPON && item.type !== ItemType.ARMOR) return state;

  const slotType = item.type;

  // Find previously equipped item in the same slot (to revert its bonus)
  const prev = state.player_state.inventory.find(
    (i) => i.type === slotType && i.equipped && i.id !== itemId
  );

  const inventory = state.player_state.inventory.map((i) => {
    if (i.id === itemId)              return { ...i, equipped: true };
    if (i.type === slotType && i.equipped) return { ...i, equipped: false };
    return i;
  });

  let attributes = { ...state.player_state.attributes };
  if (prev?.stat_bonus) attributes = applyBonus(attributes, prev.stat_bonus, -1);
  if (item.stat_bonus)  attributes = applyBonus(attributes, item.stat_bonus,  1);

  return { ...state, player_state: { ...state.player_state, inventory, attributes } };
}

export function unequipItem(state: MasterState, itemId: string): MasterState {
  const item = state.player_state.inventory.find((i) => i.id === itemId);
  if (!item || !item.equipped) return state;

  const inventory  = state.player_state.inventory.map((i) =>
    i.id === itemId ? { ...i, equipped: false } : i
  );
  let attributes = { ...state.player_state.attributes };
  if (item.stat_bonus) attributes = applyBonus(attributes, item.stat_bonus, -1);

  return { ...state, player_state: { ...state.player_state, inventory, attributes } };
}

export function getEquippedLoadout(state: MasterState): EquippedLoadout {
  const loadout: EquippedLoadout = {};
  for (const item of state.player_state.inventory) {
    if (!item.equipped) continue;
    if      (item.type === ItemType.WEAPON) loadout.weapon    = item;
    else if (item.type === ItemType.ARMOR)  loadout.armor     = item;
    else                                    loadout.accessory = item;
  }
  return loadout;
}

export function getInventoryWeight(state: MasterState): number {
  return state.player_state.inventory.reduce(
    (sum, item) => sum + (item.weight ?? 0) * item.quantity,
    0
  );
}

// Re-export NPCMemory so callers can use it via state-utils if needed
export type { NPCMemory };
