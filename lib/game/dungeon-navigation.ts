import type { DungeonRoom, Item, MasterState, WorldNode } from "@/types/game";

/**
 * Day 23A — pure helpers for the dungeon-room navigation runtime.
 *
 * Rooms live as a sub-array on a dungeon WorldNode (node.dungeon_rooms)
 * rather than as graph nodes — they're nav children of the dungeon, never
 * visible on the world map. This module owns the logic that:
 *   • answers "is this node a dungeon?" / "which room is the player in?"
 *   • validates room-to-room moves (must be a connected neighbour)
 *   • computes the room cards the NavigationBar should render
 *   • detects when the player is exiting a dungeon (current room = entrance,
 *     target = a graph node outside the dungeon)
 *   • checks whether the player has the key to unlock a locked room
 *
 * Everything here is pure / synchronous — no React, no game store imports
 * — so the hook layer and the UI both consume the same logic and tests
 * cover it in isolation.
 */

// ── Predicates ───────────────────────────────────────────────────────────────

/** True when the node has the dungeon node_type AND a non-empty room array. */
export function isDungeonNode(node: WorldNode | undefined): boolean {
  if (!node) return false;
  if (node.node_type !== "dungeon") return false;
  return Array.isArray(node.dungeon_rooms) && node.dungeon_rooms.length > 0;
}

/** Look up a room by id inside a dungeon node's rooms array. */
export function findRoom(
  node:   WorldNode | undefined,
  roomId: string | undefined
): DungeonRoom | null {
  if (!node || !roomId) return null;
  if (!Array.isArray(node.dungeon_rooms)) return null;
  return node.dungeon_rooms.find((r) => r.id === roomId) ?? null;
}

/** The entrance room of a dungeon, or null if the dungeon has none. */
export function findEntranceRoom(node: WorldNode | undefined): DungeonRoom | null {
  if (!node || !Array.isArray(node.dungeon_rooms)) return null;
  return node.dungeon_rooms.find((r) => r.room_type === "entrance") ?? null;
}

/**
 * Get the room the player is currently in, given the dungeon node + the
 * MasterState.dungeon_state slice. Returns null if either is missing or
 * the slice points at a room that no longer exists (defensive).
 */
export function getCurrentRoom(
  node:          WorldNode | undefined,
  dungeon_state: MasterState["dungeon_state"]
): DungeonRoom | null {
  if (!node || !dungeon_state) return null;
  if (dungeon_state.node_id !== node.id) return null;
  return findRoom(node, dungeon_state.current_room_id);
}

// ── Room-to-room move validation ─────────────────────────────────────────────

/** True when `toRoomId` is in the current room's connections array. */
export function isAdjacentRoom(
  node:         WorldNode | undefined,
  fromRoomId:   string,
  toRoomId:     string
): boolean {
  const from = findRoom(node, fromRoomId);
  if (!from) return false;
  return from.connections.includes(toRoomId);
}

/**
 * Returns true when the player is allowed to walk INTO `room` given the
 * current dungeon + their inventory. A locked room blocks entry until the
 * player has consumed the matching key. Day 23A only supports key locks;
 * future lock types (code, riddle, fragments, lore) wire in here too.
 */
export function canEnterRoom(
  room:      DungeonRoom,
  inventory: Item[]
): boolean {
  if (!room.lock || room.lock.unlocked) return true;
  if (room.lock.type === "key") {
    return playerHasKeyFor(inventory, room.id);
  }
  return false;
}

/** Find a key item in the player's inventory that unlocks the target room. */
export function playerHasKeyFor(
  inventory: Item[],
  roomId:    string
): boolean {
  return inventory.some(
    (item) => item.is_key_item === true && item.unlocks_node === roomId
  );
}

/** Returns the key item (if any) that unlocks the given room. */
export function findKeyForRoom(
  inventory: Item[],
  roomId:    string
): Item | null {
  return inventory.find(
    (item) => item.is_key_item === true && item.unlocks_node === roomId
  ) ?? null;
}

// ── Dungeon entry / exit ─────────────────────────────────────────────────────

/**
 * Compute the initial dungeon_state slice for a freshly-entered dungeon.
 * Lands the player in the entrance room with the entrance marked as the
 * first room visited.
 */
export function initialDungeonState(node: WorldNode): MasterState["dungeon_state"] | null {
  const entrance = findEntranceRoom(node);
  if (!entrance) return null;
  return {
    node_id:         node.id,
    current_room_id: entrance.id,
    rooms_visited:   [entrance.id],
  };
}

/**
 * Returns the updated dungeon_state after moving from the current room
 * into `nextRoomId`. The caller is responsible for verifying the move is
 * valid via `isAdjacentRoom` + `canEnterRoom` before calling this.
 */
export function advanceDungeonState(
  current:     NonNullable<MasterState["dungeon_state"]>,
  nextRoomId:  string
): NonNullable<MasterState["dungeon_state"]> {
  const alreadyVisited = current.rooms_visited.includes(nextRoomId);
  return {
    ...current,
    current_room_id: nextRoomId,
    rooms_visited:   alreadyVisited
                       ? current.rooms_visited
                       : [...current.rooms_visited, nextRoomId],
  };
}

/**
 * Stamp a room's `discovered` flag to true on the parent dungeon node.
 * Pure — returns a new WorldNode with the updated rooms array; caller
 * splices it into world_graph.nodes. Used after the player enters a
 * room for the first time so the revisit-suppression beat (rule 86)
 * fires on subsequent entries.
 */
export function markRoomDiscovered(
  node:   WorldNode,
  roomId: string
): WorldNode {
  if (!Array.isArray(node.dungeon_rooms)) return node;
  const idx = node.dungeon_rooms.findIndex((r) => r.id === roomId);
  if (idx === -1) return node;
  if (node.dungeon_rooms[idx].discovered) return node;
  const updated = node.dungeon_rooms.slice();
  updated[idx] = { ...updated[idx], discovered: true };
  return { ...node, dungeon_rooms: updated };
}

/**
 * Mark a room's lock as unlocked. Mirrors markRoomDiscovered for the
 * boss-door unlock flow (USE key → lock.unlocked: true). Idempotent.
 */
export function markRoomUnlocked(
  node:   WorldNode,
  roomId: string
): WorldNode {
  if (!Array.isArray(node.dungeon_rooms)) return node;
  const idx = node.dungeon_rooms.findIndex((r) => r.id === roomId);
  if (idx === -1) return node;
  const room = node.dungeon_rooms[idx];
  if (!room.lock || room.lock.unlocked) return node;
  const updated = node.dungeon_rooms.slice();
  updated[idx] = {
    ...room,
    lock: { ...room.lock, unlocked: true },
  };
  return { ...node, dungeon_rooms: updated };
}

// ── Nav-card construction ────────────────────────────────────────────────────

/**
 * Day 23A — room nav card shape. Smaller than the full nav-cards Card
 * type because room nav doesn't need direction grouping or tier — every
 * room card uses the dungeon burnt-copper color (rule 73) and lives in
 * a single row.
 */
export interface RoomCard {
  /** Room id — passed to navigateToRoom on click. */
  room_id:     string;
  /** Display name (room.name). */
  name:        string;
  /** Type label shown beneath the name ("ENTRANCE" / "CHAMBER" / "BOSS"). */
  type_label:  string;
  /** True when the room is locked + the player lacks the key. */
  locked:      boolean;
  /** True when the player has already visited this room. Drives a
   *  subtle "Revisit" hint in the UI. */
  visited:     boolean;
  /** When `locked` is true, the lock's hint text shown on click. */
  lock_hint?:  string;
  /** When locked + the player has the key, the display name shown on
   *  the USE-key button. */
  key_item_name?: string;
}

/** Render a room_type value as the small uppercase label under the
 *  room name on its nav card. */
export function roomTypeLabel(roomType: DungeonRoom["room_type"]): string {
  switch (roomType) {
    case "entrance": return "ENTRANCE";
    case "middle":   return "CHAMBER";
    case "side":     return "SIDE ROOM";
    case "boss":     return "BOSS";
  }
}

/**
 * Build the room cards the NavigationBar should render. Returns the
 * connected-rooms of the player's current room — same UX as the
 * existing nav cards (only show adjacent destinations).
 */
export function buildRoomCards(
  node:          WorldNode | undefined,
  dungeon_state: MasterState["dungeon_state"],
  inventory:     Item[]
): RoomCard[] {
  if (!node || !dungeon_state) return [];
  // Use getCurrentRoom (not findRoom directly) so a mismatched node_id
  // returns [] cleanly — protects the NavigationBar from rendering
  // dungeon room cards when the player is at a different dungeon
  // whose room ids happen to collide.
  const current = getCurrentRoom(node, dungeon_state);
  if (!current) return [];
  const cards: RoomCard[] = [];
  for (const id of current.connections) {
    const room = findRoom(node, id);
    if (!room) continue;
    const locked = !!room.lock && !room.lock.unlocked;
    const haveKey = locked && room.lock && room.lock.type === "key"
      && playerHasKeyFor(inventory, room.id);
    cards.push({
      room_id:    room.id,
      name:       room.name,
      type_label: roomTypeLabel(room.room_type),
      locked:     locked && !haveKey,
      visited:    dungeon_state.rooms_visited.includes(room.id),
      ...(locked && room.lock ? { lock_hint: room.lock.hint } : {}),
      ...(haveKey && room.lock ? { key_item_name: room.lock.key_item_name } : {}),
    });
  }
  return cards;
}

/**
 * True when the player's current room is the entrance — i.e. the only
 * room from which a BACK card should exit the dungeon entirely. From
 * other rooms BACK just goes one room closer to the entrance.
 */
export function isAtDungeonEntrance(
  node:          WorldNode | undefined,
  dungeon_state: MasterState["dungeon_state"]
): boolean {
  const current = getCurrentRoom(node, dungeon_state);
  return current?.room_type === "entrance";
}
