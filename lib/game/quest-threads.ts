import type {
  LocationDefinition,
  MainQuest,
  NPCDefinition,
  QuestBreadcrumb,
  QuestFaction,
  QuestThreads,
  RegionBible,
  WorldBible,
} from "@/types/game";

/**
 * Day 23B — pure helpers that build / maintain the runtime quest_threads
 * slice. Extracted from apply-world-bible / apply-regional-bible so both
 * the route handlers and the unit tests can share the same code.
 *
 * No I/O, no Supabase, no Anthropic. Everything in this file is a pure
 * function over MasterState-adjacent shapes.
 */

/**
 * Build the runtime QuestThreads slice from a WorldBible's main_quest seed.
 *
 *   • factions get an empty npc_ids[] (faction alignment wired in 23C/23D)
 *   • breadcrumbs start `discovered: false` with no anchor_location_id;
 *     RegionBible expansion seeds the floating ones (act 2/3) and 23C
 *     wires the climax breadcrumb to the boss room
 *   • climax_location_id stays undefined until 23C
 *   • faction_alignment starts at 0 for every faction
 *
 * Returns null when the bible has no main_quest field (legacy bibles —
 * the caller leaves quest_threads undefined so old saves load cleanly).
 */
export function initializeQuestThreads(bible: WorldBible): QuestThreads | null {
  const bmq = bible.main_quest;
  if (!bmq) return null;

  const factions: QuestFaction[] = (bmq.factions ?? []).map((f) => ({
    id:          f.id,
    name:        f.name,
    role:        f.role,
    description: f.description,
    npc_ids:     [],
  }));

  const breadcrumbs: QuestBreadcrumb[] = (bmq.breadcrumbs ?? []).map((b) => ({
    id:          b.id,
    act:         b.act,
    content:     b.content,
    anchor_type: b.anchor_type,
    discovered:  false,
  }));

  // resolutions is a 2-tuple in the runtime type — coerce from the bible's
  // array, accepting that a malformed bible could leave only one entry.
  const resolutionsRaw = bmq.resolutions ?? [];
  const resolutions: MainQuest["resolutions"] = [
    {
      id:      "resolution_a",
      summary: resolutionsRaw[0]?.summary ?? "Resolution A — undefined.",
      tone:    (resolutionsRaw[0]?.tone as "hopeful" | "dark" | "ambiguous") ?? "ambiguous",
    },
    {
      id:      "resolution_b",
      summary: resolutionsRaw[1]?.summary ?? "Resolution B — undefined.",
      tone:    (resolutionsRaw[1]?.tone as "hopeful" | "dark" | "ambiguous") ?? "ambiguous",
    },
  ];

  const titleSlug = (bmq.title ?? "main_quest")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 60);

  const mainQuest: MainQuest = {
    id:                 titleSlug || "main_quest",
    title:              bmq.title,
    archetype:          bmq.archetype,
    threat_description: bmq.threat_description,
    factions,
    finale_type:        bmq.finale_type,
    breadcrumbs,
    resolutions,
    status:             "active",
  };

  return {
    main_quest:          mainQuest,
    side_quests:         [],
    faction_alignment:   Object.fromEntries(factions.map((f) => [f.id, 0])),
    completed_quest_ids: [],
    failed_quest_ids:    [],
  };
}

/**
 * Substitute the `{name}` and `{class}` placeholders in the WorldBible's
 * world_intro_template with the player's actual character. Returns "" when
 * the template is missing/empty; callers fall back to the legacy "Your
 * adventure begins..." preamble (rule 42).
 *
 * Future placeholders ({backstory}, {motivation}) land in Day 23.5 when
 * character creation rework adds those fields.
 */
export function resolveWorldIntro(
  template:    string | undefined,
  playerName:  string,
  playerClass: string
): string {
  if (typeof template !== "string" || !template.trim()) return "";
  return template
    .replace(/\{name\}/g, playerName)
    .replace(/\{class\}/g, playerClass);
}

/**
 * Scan a RegionBible's NPCs, settlement-location objects, and dungeon-room
 * objects for `quest_breadcrumb_id` markers (set by the RegionBible prompt
 * when it seeded a floating breadcrumb). Return updated QuestThreads with
 * `anchor_location_id` stamped on matching breadcrumbs.
 *
 * Pure — never mutates the input quest_threads. When no markers are found,
 * the original quest_threads is returned unchanged (object equality).
 *
 * Anchor priority:
 *   • NPCs anchor to `npc.home_location_id`
 *   • Settlement-location objects anchor to the parent location id
 *   • Dungeon-room objects anchor to the room id (NOT the parent dungeon)
 *
 * Already-anchored breadcrumbs are never overwritten — first seed wins.
 */
export function applyBreadcrumbAnchors(
  qt:    QuestThreads | undefined,
  bible: RegionBible
): {
  threads:  QuestThreads | undefined;
  anchored: Array<{ breadcrumbId: string; locationId: string }>;
} {
  if (!qt || !qt.main_quest) return { threads: qt, anchored: [] };
  const bcs = qt.main_quest.breadcrumbs;
  if (!Array.isArray(bcs) || bcs.length === 0) return { threads: qt, anchored: [] };

  // breadcrumb_id → location_id
  const anchors = new Map<string, string>();

  for (const npc of bible.npcs ?? []) {
    const bid = (npc as NPCDefinition & { quest_breadcrumb_id?: string }).quest_breadcrumb_id;
    if (typeof bid === "string" && bid.trim() && npc.home_location_id) {
      anchors.set(bid, npc.home_location_id);
    }
  }
  const scanLocations = (locs: LocationDefinition[] | undefined) => {
    for (const loc of locs ?? []) {
      for (const obj of loc.objects ?? []) {
        const bid = obj.quest_breadcrumb_id;
        if (typeof bid === "string" && bid.trim()) {
          anchors.set(bid, loc.id);
        }
      }
      const dungeonRooms = (loc as LocationDefinition & {
        dungeon_rooms?: Array<{ id: string; objects?: Array<{ quest_breadcrumb_id?: string }> }>;
      }).dungeon_rooms;
      for (const room of dungeonRooms ?? []) {
        for (const obj of room.objects ?? []) {
          const bid = obj.quest_breadcrumb_id;
          if (typeof bid === "string" && bid.trim()) {
            anchors.set(bid, room.id);
          }
        }
      }
    }
  };
  scanLocations(bible.locations);
  scanLocations(bible.region_locations);

  if (anchors.size === 0) return { threads: qt, anchored: [] };

  const stamped: Array<{ breadcrumbId: string; locationId: string }> = [];
  const updatedBcs = bcs.map((b) => {
    const newAnchor = anchors.get(b.id);
    if (!newAnchor) return b;
    if (b.anchor_location_id) return b; // already anchored — never overwrite
    stamped.push({ breadcrumbId: b.id, locationId: newAnchor });
    return { ...b, anchor_location_id: newAnchor };
  });

  if (stamped.length === 0) return { threads: qt, anchored: [] };

  return {
    threads: {
      ...qt,
      main_quest: {
        ...qt.main_quest,
        breadcrumbs: updatedBcs,
      },
    },
    anchored: stamped,
  };
}
