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

/**
 * Maps an NPC trust score (0-100) to a human-readable disposition label.
 * Used by the dialogue UI badge and the narrator's ACTIVE NPC CONTEXT block.
 */
export function getNpcDisposition(trustScore: number): string {
  if (trustScore <= 20) return "hostile";
  if (trustScore <= 40) return "suspicious";
  if (trustScore <= 60) return "neutral";
  if (trustScore <= 80) return "friendly";
  return "allied";
}

/**
 * Append a CHARACTER asset_id to the current World Graph node's npc_ids
 * list. No-op if no graph exists, no current node, or the id is already
 * present. Used after every dynamically-introduced NPC (narrator new_npcs
 * or CHARACTER codex_entries) so future visits to the node see the NPC
 * via NPCS PRESENT and the location guard recognises them.
 */
export function addNpcToCurrentNode(state: MasterState, npcAssetId: string): MasterState {
  const graph = state.world_graph;
  if (!graph) return state;
  const nodeId = graph.current_node_id;
  const node   = graph.nodes[nodeId];
  if (!node) return state;
  if (node.npc_ids.includes(npcAssetId)) return state;
  return {
    ...state,
    world_graph: {
      ...graph,
      nodes: {
        ...graph.nodes,
        [nodeId]: {
          ...node,
          npc_ids: [...node.npc_ids, npcAssetId],
        },
      },
    },
  };
}

/**
 * Seed a missing npc_registry entry with neutral defaults so subsequent
 * lookups (trust changes, dialogue modal disposition, resolver difficulty)
 * always find a record. No-op if the key already exists — never overwrites.
 *
 * Used when an NPC exists in locationAssets / world_assets but was never
 * inserted into the registry (e.g. introduced through codex_entries only,
 * or saved via an older code path that pre-dated registry seeding).
 */
export function seedNpcRegistry(
  state: MasterState,
  key: string,
  fallbackName?: string,
  fallbackRole?: string
): MasterState {
  if (state.npc_registry[key]) return state;
  return {
    ...state,
    npc_registry: {
      ...state.npc_registry,
      [key]: {
        id:                  key,
        npc_key:             key,
        name:                fallbackName ?? key,
        role:                fallbackRole ?? "Unknown",
        relationship_status: "neutral",
        trust_score:         50,
        memory_snippets:     [],
        last_interaction:    new Date().toISOString(),
      },
    },
  };
}

/**
 * Robust NPC lookup against npc_registry. The registry has historically been
 * keyed three ways:
 *   - direct (whatever the narrator emitted, e.g. "old_hermit")
 *   - snake_case from a display name (e.g. "Old Hermit" → "old_hermit")
 *   - asset-id style (e.g. "character_old_hermit" — the Day-15.5 standard)
 * This helper checks all three plus a name-based scan, so callers don't need
 * to know which scheme produced the original entry.
 *
 * Returns { key, npc } when found, null otherwise.
 */
export function findNpcInRegistry(
  registry: Record<string, NPCMemory>,
  target: string | null | undefined
): { key: string; npc: NPCMemory } | null {
  if (!target) return null;

  // 0. Direct key match (target is already a registry key).
  if (registry[target]) {
    return { key: target, npc: registry[target] };
  }

  const normalized = target.toLowerCase().trim().replace(/\s+/g, "_");

  // 1. Legacy snake_case match.
  if (registry[normalized]) {
    return { key: normalized, npc: registry[normalized] };
  }

  // 2. Asset-id style: "character_<slug>".
  const assetKey = normalized.startsWith("character_") ? normalized : `character_${normalized}`;
  if (registry[assetKey]) {
    return { key: assetKey, npc: registry[assetKey] };
  }

  // 2b. Prefix-strip fallback — target was already "character_X", also try
  // the unprefixed form. Covers older saved sessions where the registry was
  // keyed without the "character_" prefix.
  if (target.startsWith("character_")) {
    const stripped = target.slice("character_".length);
    if (registry[stripped]) {
      return { key: stripped, npc: registry[stripped] };
    }
  }
  if (normalized.startsWith("character_")) {
    const stripped = normalized.slice("character_".length);
    if (registry[stripped]) {
      return { key: stripped, npc: registry[stripped] };
    }
  }

  // 3. Scan by display name (case-insensitive).
  const lowerTarget = target.toLowerCase();
  for (const [key, npc] of Object.entries(registry)) {
    if (npc.name.toLowerCase() === lowerTarget) {
      return { key, npc };
    }
  }

  return null;
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
