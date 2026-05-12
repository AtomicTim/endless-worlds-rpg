import type {
  DungeonRoom,
  LocationNodeType,
  LocationObject,
  RegionType,
} from "@/types/game";

/**
 * Day 23A — shared dungeon + location-typology validators used by
 * apply-world-bible AND apply-regional-bible. Both routes parse the
 * same dungeon_rooms[] schema and derive the same node_type union, so
 * the logic lives here to keep them perfectly in sync. A drift between
 * the two would silently break Day 23B+ quest hooks that key off
 * node_type or dungeon room ids.
 *
 * Pattern: warn-don't-500 (rule 23). One malformed room is dropped
 * with a console.warn; the bible apply continues so the world is
 * still playable.
 */

// ── Constant sets used by validators + UI alike ──────────────────────────────

export const VALID_NODE_TYPES = new Set<LocationNodeType>([
  "settlement_hub",
  "outpost",
  "wilderness",
  "dungeon",
  "landmark",
  "abandoned_settlement",
]);

export const VALID_REGION_TYPES = new Set<RegionType>([
  "settled",
  "frontier",
  "hostile",
]);

export const VALID_ROOM_TYPES = new Set<DungeonRoom["room_type"]>([
  "entrance",
  "middle",
  "side",
  "boss",
]);

// ── Derivations ──────────────────────────────────────────────────────────────

/**
 * Derive the canonical LocationNodeType for a graph node.
 *
 * Priority:
 *   1. Explicit `node_type` from the AI (most accurate when emitted).
 *   2. Legacy category-mapping fallback. Honors is_settlement_node →
 *      settlement_hub, then maps the LocationDefinition.type slug
 *      to the closest LocationNodeType.
 *
 * Returns undefined when neither path resolves — caller writes nothing
 * to the graph node (legacy behaviour preserved for old bibles).
 */
export function deriveNodeType(
  loc: Record<string, unknown>
): LocationNodeType | undefined {
  const explicit = loc.node_type;
  if (typeof explicit === "string" && VALID_NODE_TYPES.has(explicit as LocationNodeType)) {
    return explicit as LocationNodeType;
  }
  if (loc.is_settlement_node === true) return "settlement_hub";
  const cat = typeof loc.type === "string" ? loc.type.toLowerCase() : "";
  if (cat === "dungeon" || cat === "stronghold") return "dungeon";
  if (cat === "ruin")        return "abandoned_settlement";
  if (cat === "wilderness")  return "wilderness";
  if (cat === "settlement")  return "settlement_hub";
  if (cat === "outpost")     return "outpost";
  if (cat === "landmark" || cat === "shrine") return "landmark";
  return undefined;
}

/**
 * Derive a region_type from a raw value. Falls back to "settled" on
 * any unrecognised input — matches the spec default for legacy bibles
 * generated before Day 23A.
 */
export function deriveRegionType(raw: unknown): RegionType {
  if (typeof raw === "string" && VALID_REGION_TYPES.has(raw as RegionType)) {
    return raw as RegionType;
  }
  return "settled";
}

// ── Dungeon room validation ──────────────────────────────────────────────────

/**
 * Validate + normalize a dungeon_rooms[] array as produced by the AI.
 *
 * Returns:
 *   - undefined when the input wasn't an array (no rooms supplied)
 *   - array of valid rooms (may be empty when everything was malformed)
 *
 * Each returned room has `discovered: false` so the runtime can flip
 * it on first entry without the AI dictating discovery state.
 *
 * Resilience pattern (rule 23): warn-don't-500. A dungeon with fewer
 * than 3 rooms is still navigable — the player just can't reach the
 * boss room if the boss room was dropped.
 */
export function validateDungeonRooms(
  raw:     unknown,
  context: string,
  logTag:  string = "[apply-bible]"
): DungeonRoom[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: DungeonRoom[] = [];
  for (let i = 0; i < raw.length; i += 1) {
    const r = raw[i];
    if (!r || typeof r !== "object") {
      console.warn(`${logTag} ${context}.dungeon_rooms[${i}] not an object — dropping.`);
      continue;
    }
    const o = r as Record<string, unknown>;
    const id   = typeof o.id   === "string" ? o.id.trim()   : "";
    const name = typeof o.name === "string" ? o.name.trim() : "";
    const rt   = typeof o.room_type === "string" ? o.room_type : "";
    if (!id || !name || !VALID_ROOM_TYPES.has(rt as DungeonRoom["room_type"])) {
      console.warn(
        `${logTag} ${context}.dungeon_rooms[${i}] missing id/name/room_type — dropping.`
      );
      continue;
    }
    const connections = Array.isArray(o.connections)
      ? (o.connections as unknown[]).filter((x): x is string => typeof x === "string")
      : [];
    const objects = Array.isArray(o.objects)
      ? (o.objects as LocationObject[])
      : [];
    const ec = typeof o.encounter_chance === "number" ? o.encounter_chance : 0;
    const description = typeof o.description === "string" ? o.description : "";
    const lock = (o.lock && typeof o.lock === "object")
      ? (o.lock as DungeonRoom["lock"])
      : undefined;
    out.push({
      id,
      name,
      description,
      room_type:        rt as DungeonRoom["room_type"],
      connections,
      objects,
      encounter_chance: ec,
      lock,
      discovered:       false,
    });
  }
  return out;
}
