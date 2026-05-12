import type {
  LocationDefinition,
  NPCDefinition,
  QuestThreads,
  RegionBible,
  WorldBible,
} from "@/types/game";
import {
  applyBreadcrumbAnchors,
  initializeQuestThreads,
  resolveWorldIntro,
} from "@/lib/game/quest-threads";

/**
 * Day 23B — three behaviors per the prompt's verification checklist:
 *   1. QuestBreadcrumb anchor attachment (applyBreadcrumbAnchors)
 *   2. world_intro_template placeholder substitution (resolveWorldIntro)
 *   3. quest_threads initialization from WorldBible (initializeQuestThreads)
 */

const minimalBibleMainQuest: NonNullable<WorldBible["main_quest"]> = {
  title:              "The Ash Beneath",
  archetype:          "ancient_awakening",
  threat_description: "Something old is stirring in the salt flats.",
  factions: [
    { id: "wardens",   name: "The Wardens",   role: "defenders",  description: "Keepers of the old seals." },
    { id: "cinder_co", name: "Cinder Combine", role: "exploiters", description: "Mining the ash for profit." },
  ],
  finale_type: "confrontation",
  breadcrumbs: [
    { id: "breadcrumb_act1",   act: 1,        content: "Locals whisper of pillars that hum at dawn.", anchor_type: "fixed"    },
    { id: "breadcrumb_act2",   act: 2,        content: "A traveler claims the pattern repeats inland.", anchor_type: "floating" },
    { id: "breadcrumb_act3",   act: 3,        content: "Three sites, three keys, three voices.",       anchor_type: "floating" },
    { id: "breadcrumb_climax", act: "climax", content: "The chamber breathes.",                        anchor_type: "fixed"    },
  ],
  resolutions: [
    { id: "resolution_a", summary: "The pillars are silenced and the salt cools.", tone: "hopeful" },
    { id: "resolution_b", summary: "The pillars sing, and the world listens.",     tone: "dark"    },
  ],
  world_intro_template:
    "{name} arrives at the edge of a salt town that no map fully agrees on.\n\nAs a {class}, you have learned the smell of warning.\n\nA figure raises their head.",
};

const minimalBible: WorldBible = {
  starting_region: {
    id:          "salt_flats",
    name:        "The Salt Flats",
    type:        "settlement_hub",
    grid_centre: { x: 0, y: 0 },
    grid_radius: 3,
    atmosphere:  "Pale light. White ground. Birds that don't sing.",
    locations:   [],
    npcs:        [],
    exits:       [],
  },
  adjacent_regions: [],
  main_quest:       minimalBibleMainQuest,
  generated_at:     "2026-05-12T00:00:00.000Z",
};

describe("initializeQuestThreads", () => {
  test("builds a runtime quest_threads slice from a bible main_quest seed", () => {
    const qt = initializeQuestThreads(minimalBible);
    expect(qt).not.toBeNull();
    const mq = qt!.main_quest!;
    expect(mq.archetype).toBe("ancient_awakening");
    expect(mq.finale_type).toBe("confrontation");
    expect(mq.status).toBe("active");
    expect(mq.factions).toHaveLength(2);
    // Faction npc_ids start empty — apply time will populate them.
    expect(mq.factions[0].npc_ids).toEqual([]);
    // Breadcrumbs preserve the bible content and add runtime fields.
    expect(mq.breadcrumbs).toHaveLength(4);
    for (const b of mq.breadcrumbs) {
      expect(b.discovered).toBe(false);
      expect(b.anchor_location_id).toBeUndefined();
    }
    // resolutions becomes a 2-tuple.
    expect(mq.resolutions[0].id).toBe("resolution_a");
    expect(mq.resolutions[1].id).toBe("resolution_b");
    expect(mq.resolutions[0].tone).toBe("hopeful");
    expect(mq.resolutions[1].tone).toBe("dark");
    // faction_alignment seeded at 0 for every faction.
    expect(qt!.faction_alignment).toEqual({ wardens: 0, cinder_co: 0 });
    expect(qt!.side_quests).toEqual([]);
    expect(qt!.completed_quest_ids).toEqual([]);
    expect(qt!.failed_quest_ids).toEqual([]);
  });

  test("returns null when the bible has no main_quest field", () => {
    const bible: WorldBible = { ...minimalBible, main_quest: undefined };
    expect(initializeQuestThreads(bible)).toBeNull();
  });

  test("falls back to placeholder resolutions when the bible only emitted one", () => {
    const truncated: WorldBible = {
      ...minimalBible,
      main_quest: {
        ...minimalBibleMainQuest,
        // @ts-expect-error — modeling a malformed AI response on purpose.
        resolutions: [minimalBibleMainQuest.resolutions[0]],
      },
    };
    const qt = initializeQuestThreads(truncated);
    expect(qt!.main_quest!.resolutions).toHaveLength(2);
    expect(qt!.main_quest!.resolutions[1].id).toBe("resolution_b");
    expect(qt!.main_quest!.resolutions[1].tone).toBe("ambiguous"); // default
  });
});

describe("resolveWorldIntro", () => {
  test("substitutes both {name} and {class} placeholders", () => {
    const out = resolveWorldIntro(
      "Greetings, {name}. A {class} should know better than to arrive at dusk.",
      "Eira",
      "Ranger"
    );
    expect(out).toBe(
      "Greetings, Eira. A Ranger should know better than to arrive at dusk."
    );
  });

  test("handles multiple occurrences and preserves surrounding prose", () => {
    const out = resolveWorldIntro(
      "{name} stands at the gate.\n\nAs a {class}, {name} feels the shape of the wrongness here.\n\nA stranger raises their head.",
      "Velka",
      "Cultist"
    );
    expect(out).toContain("Velka stands at the gate");
    expect(out).toContain("As a Cultist, Velka feels");
    expect(out).not.toMatch(/\{name\}|\{class\}/);
  });

  test("returns empty string when the template is undefined or whitespace", () => {
    expect(resolveWorldIntro(undefined,    "Eira", "Ranger")).toBe("");
    expect(resolveWorldIntro("",           "Eira", "Ranger")).toBe("");
    expect(resolveWorldIntro("   \n  \t ", "Eira", "Ranger")).toBe("");
  });
});

describe("applyBreadcrumbAnchors", () => {
  function buildSeededThreads(): QuestThreads {
    return initializeQuestThreads(minimalBible)!;
  }

  test("anchors a floating breadcrumb when an NPC carries the matching quest_breadcrumb_id", () => {
    const qt = buildSeededThreads();
    const npc: NPCDefinition & { quest_breadcrumb_id?: string } = {
      id:               "character_traveler",
      name:             "The Wandering Cartographer",
      home_location_id: "northern_outpost_inn",
      role:             "traveler",
      archetype:        "scholar",
      appearance:       "Threadbare cloak, ink-stained hands.",
      personality:      "Curious to a fault.",
      speech_style:     "deliberate",
      knowledge:        [],
      default_trust:    50,
      quest_breadcrumb_id: "breadcrumb_act2",
    };
    const bible: RegionBible = {
      id: "northern_outpost", name: "Northern Outpost", type: "settlement_hub",
      grid_centre: { x: 8, y: 0 }, grid_radius: 3, atmosphere: "Wind.",
      locations: [],
      npcs: [npc],
      exits: [],
    };
    const result = applyBreadcrumbAnchors(qt, bible);
    expect(result.anchored).toEqual([
      { breadcrumbId: "breadcrumb_act2", locationId: "northern_outpost_inn" },
    ]);
    const stampedBc = result.threads!.main_quest!.breadcrumbs.find((b) => b.id === "breadcrumb_act2")!;
    expect(stampedBc.anchor_location_id).toBe("northern_outpost_inn");
    // Other breadcrumbs unchanged.
    const act3 = result.threads!.main_quest!.breadcrumbs.find((b) => b.id === "breadcrumb_act3")!;
    expect(act3.anchor_location_id).toBeUndefined();
  });

  test("anchors a floating breadcrumb to a dungeon ROOM id when carried by a room object", () => {
    const qt = buildSeededThreads();
    const dungeon = {
      id: "ash_barrow",
      name: "The Ash Barrow",
      type: "dungeon",
      atmosphere: "",
      grid_position: { x: 9, y: 1 },
      region_id: "northern_outpost",
      is_settlement_node: false,
      is_interior: false,
      connections: [],
      objects: [],
      npc_ids: [],
      ambient_type: "dungeon_corridor",
      dungeon_rooms: [
        {
          id: "ash_barrow_middle",
          name: "Middle Chamber",
          description: "",
          room_type: "middle" as const,
          connections: [],
          encounter_chance: 0.7,
          objects: [
            {
              id: "ash_barrow_middle_lore",
              name: "The Tracing-Slate",
              description: "Worn glyphs.",
              is_interactable: true,
              type: "lore" as const,
              quest_breadcrumb_id: "breadcrumb_act3",
            },
          ],
        },
      ],
    } as unknown as LocationDefinition;

    const bible: RegionBible = {
      id: "northern_outpost", name: "Northern Outpost", type: "settlement_hub",
      grid_centre: { x: 8, y: 0 }, grid_radius: 3, atmosphere: "",
      locations: [],
      region_locations: [dungeon],
      npcs: [],
      exits: [],
    };
    const result = applyBreadcrumbAnchors(qt, bible);
    expect(result.anchored).toEqual([
      { breadcrumbId: "breadcrumb_act3", locationId: "ash_barrow_middle" },
    ]);
    const stamped = result.threads!.main_quest!.breadcrumbs.find((b) => b.id === "breadcrumb_act3")!;
    expect(stamped.anchor_location_id).toBe("ash_barrow_middle");
  });

  test("does not overwrite an already-anchored breadcrumb", () => {
    const qt = buildSeededThreads();
    // Pre-anchor breadcrumb_act2.
    qt.main_quest!.breadcrumbs = qt.main_quest!.breadcrumbs.map((b) =>
      b.id === "breadcrumb_act2" ? { ...b, anchor_location_id: "old_location" } : b
    );
    const npc: NPCDefinition & { quest_breadcrumb_id?: string } = {
      id:               "character_other",
      name:             "Some Other NPC",
      home_location_id: "new_location",
      role:             "traveler",
      archetype:        "scholar",
      appearance:       "...",
      personality:      "...",
      speech_style:     "...",
      knowledge:        [],
      default_trust:    50,
      quest_breadcrumb_id: "breadcrumb_act2",
    };
    const bible: RegionBible = {
      id: "elsewhere", name: "Elsewhere", type: "settlement_hub",
      grid_centre: { x: 0, y: 0 }, grid_radius: 3, atmosphere: "",
      locations: [], npcs: [npc], exits: [],
    };
    const result = applyBreadcrumbAnchors(qt, bible);
    // No anchor stamped because the breadcrumb already had one.
    expect(result.anchored).toEqual([]);
    const stamped = result.threads!.main_quest!.breadcrumbs.find((b) => b.id === "breadcrumb_act2")!;
    expect(stamped.anchor_location_id).toBe("old_location");
  });

  test("returns input quest_threads unchanged when no markers are emitted", () => {
    const qt = buildSeededThreads();
    const bible: RegionBible = {
      id: "calm_region", name: "Calm Region", type: "settlement_hub",
      grid_centre: { x: 0, y: 0 }, grid_radius: 3, atmosphere: "",
      locations: [], npcs: [], exits: [],
    };
    const result = applyBreadcrumbAnchors(qt, bible);
    expect(result.anchored).toEqual([]);
    expect(result.threads).toBe(qt); // reference equality — no mutation
  });

  test("returns input unchanged when quest_threads is undefined (legacy save)", () => {
    const bible: RegionBible = {
      id: "anywhere", name: "Anywhere", type: "settlement_hub",
      grid_centre: { x: 0, y: 0 }, grid_radius: 3, atmosphere: "",
      locations: [], npcs: [], exits: [],
    };
    const result = applyBreadcrumbAnchors(undefined, bible);
    expect(result.threads).toBeUndefined();
    expect(result.anchored).toEqual([]);
  });
});
