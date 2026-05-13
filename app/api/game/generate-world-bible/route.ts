import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Genre } from "@/types/game";
import type { WorldBible, WorldConsistencyDocument } from "@/types/game";
import { formatWcdBlock } from "@/lib/game/prompt-builder";

interface RequestBody {
  genre?:           Genre;
  character_name?:  string;
  character_class?: string;
  wcd?:             WorldConsistencyDocument;
}

const SYSTEM_PROMPT =
  "You are a world-building engine for a procedurally generated RPG. " +
  "Generate a complete World Bible for the starting region. This document " +
  "defines every location, NPC, and object the player will encounter at " +
  "the start of their adventure. All content must be consistent with the " +
  "World Consistency Document provided. Respond ONLY with valid JSON. " +
  "No markdown, no code fences, no explanation.";

function buildUserPrompt(
  genre:    Genre,
  name:     string,
  klass:    string,
  wcd:      WorldConsistencyDocument
): string {
  const wcdBlock    = formatWcdBlock(wcd);
  const generatedAt = new Date().toISOString();

  // Day 23B — Main quest context block.
  // The WCD seed (archetype + threat + factions + finale_type) drives the
  // WorldBible's quest expansion: breadcrumbs, two resolutions, and the
  // 3-part world_intro_template. When the WCD lacks main_quest (legacy or
  // generator skipped it), fall back to "ancient_awakening / confrontation"
  // so the bible still emits a full quest scaffold.
  const wcdMq = wcd.main_quest ?? {
    archetype:          "ancient_awakening" as const,
    threat_description: "Something is happening in this world that demands attention.",
    factions:           [],
    finale_type:        "confrontation" as const,
  };
  const wcdMqBlock = [
    "═══════════════════════════════════════════════════════════════",
    "MAIN QUEST SEED (from the WCD — expand into the full quest schema below)",
    "═══════════════════════════════════════════════════════════════",
    `Archetype:    ${wcdMq.archetype}   (INTERNAL — never label it to the player)`,
    `Threat:       ${wcdMq.threat_description}`,
    `Finale type:  ${wcdMq.finale_type}`,
    "Factions:",
    ...((wcdMq.factions ?? []).map(
      (f) => `  - ${f.name} [${f.role}] — ${f.description}`
    )),
    "═══════════════════════════════════════════════════════════════",
  ].join("\n");

  // Day 23.5A — Species context block. Pulls the WCD's established
  // species[] (3-4 entries) into the WorldBible prompt so NPCs can
  // optionally carry species_id and disposition_modifiers.toward_species.
  // Intentionally minimal (3-5 lines per spec) — do NOT restructure
  // the rest of the WorldBible prompt.
  const wcdSpecies = wcd.species ?? [];
  const wcdSpeciesBlock = wcdSpecies.length > 0
    ? [
        "",
        "SPECIES (from WCD — established, do not regenerate):",
        ...wcdSpecies.map((s) => `  - ${s.name} (${s.id})`),
        "",
        "NPCs may optionally carry:",
        "  species_id: one of the above ids (or omit)",
        "  disposition_modifiers.toward_species: small integer",
        "    modifiers (±5 to ±15) where world history implies",
        "    species tension. Use sparingly.",
      ].join("\n")
    : "";
  // Skeleton-based prompt: showing the model the exact JSON shape (with
  // every required key) is the single most reliable way to keep it from
  // wandering into alias names / nested wrappers / missing fields.
  // Day 23.5B hotfix — character_name / character_class may be empty when
  // generate-world-bible is fired in the background right after WCD
  // completes (before the player has picked a name/class). The actual
  // {name}/{class} substitution into world_intro_template happens in
  // apply-world-bible using master_state.player_state.name + .background.
  // For the bible prompt itself, the Character line is only theming
  // context — omit it cleanly when both fields are blank so the model
  // doesn't see "Character: , a .".
  const hasName  = name.trim().length  > 0;
  const hasClass = klass.trim().length > 0;
  const characterLine =
    hasName && hasClass
      ? `Character: ${name}, a ${klass}.`
      : hasName
        ? `Character: ${name}.`
        : hasClass
          ? `Character class: ${klass}.`
          : "";
  return `${wcdBlock}
${wcdSpeciesBlock}

${wcdMqBlock}

Generate a WorldBible JSON for a ${genre} RPG.${characterLine ? `\n${characterLine}` : ""}

UNIQUENESS REQUIREMENT: Every element of this world — its names, themes, enemy
types, and location aesthetics — must emerge from the WCD above and feel wholly
distinct. Each generation should be unlike any other. The WCD's world_name and
atmosphere are the creative anchor for every naming and thematic decision.

CRITICAL ARCHITECTURAL RULE — read before generating:
The settlement node (is_settlement_node: true) MUST be a public
gathering space — a town square, crossroads, market plaza, central
courtyard, hub, or equivalent. It must NEVER be a specific building
such as a tavern, inn, smithy, shop, temple, or guild hall. Those
are sub-locations (is_interior: true) connected to the settlement
node. The settlement node is an exterior arrival point that the
player can leave by entering any of its sub-locations.

GEOGRAPHIC vs SETTLEMENT NAMING (Day 20):
The region 'name' MUST be a geographic area name (landscape,
district, territory) — NOT a town or building name.
The 'settlement_name' is the name of the town within that area.
Example: region name "The Ashwood Forest", settlement name
"Thornwick Crossing". NOT: region name "Thornwick Crossing".
Region names reflect the geography of this specific world —
its landforms, climate, phenomena, or character as described
in the WCD. Settlement names reflect the local history,
culture, or purpose of the town within this world's context.
All names must feel native to the WCD above.

REGION LOCATIONS (Day 20):
The geographic region also contains ONE standalone location
alongside the settlement — a dungeon entrance, wilderness point,
ancient shrine, or abandoned structure. It is NOT inside the
settlement (is_interior: false, no parent_location_id). It has its
own atmosphere, 0-1 NPCs, 1-2 Tier 1 objects.

COORDINATE SYSTEM — read carefully:
grid_position is in a shared world coordinate space using
integers. ONE coordinate space covers everything.
- The settlement hub is ALWAYS at {"x": 0, "y": 0}.
- Sub-locations cluster around the hub: use values in the
  range -5 to +5 on both axes. Spread them out — do NOT put
  two sub-locations at the same position.
- The standalone region_location sits 8-15 units from the hub,
  e.g. {10,-5}, {-12,4}, {7,11}.
- Adjacent regions sit 18-35 units away, e.g. {22,8}, {-25,12}.
- Every location MUST have a UNIQUE grid_position. No two
  locations may share the same x and y values.
- CRITICAL: Do NOT place sub-locations in a cardinal cross
  pattern (e.g. {-1,0}, {1,0}, {0,-1}, {0,1}). Use diagonal
  and varied offsets instead — for example: {-3,1}, {2,-2},
  {1,4}, {-4,-1}. The layout should look organic, not like
  a compass rose.

Return EXACTLY this JSON structure (fill in the values):
{
  "starting_region": {
    "id": "the_geographic_region_slug",
    "name": "The Geographic Region Name (landscape — NOT a town)",
    "settlement_id": "settlement_slug",
    "settlement_name": "Town Name",
    "type": "settlement_hub",
    "atmosphere": "2 sentence description of the geographic area",
    "locations": [
      {
        "id": "settlement_slug",
        "name": "Town Name (matches settlement_name above)",
        "type": "settlement",
        "is_settlement_node": true,
        "is_interior": false,
        "atmosphere": "Outdoor hub description — what the player sees and hears arriving at the town centre.",
        "grid_position": {"x": 0, "y": 0},
        "connections": ["tavern_slug", "shop_slug", "smithy_slug", "fourth_slug"],
        "npc_ids": [],
        "objects": [{"id": "well_slug", "name": "The Communal Well", "description": "1 sentence", "is_interactable": true}],
        "ambient_type": "town_square"
      },
      {
        "id": "tavern_slug",
        "name": "The Tavern Name",
        "type": "tavern",
        "is_settlement_node": false,
        "is_interior": true,
        "parent_location_id": "settlement_slug",
        "atmosphere": "Tavern interior description.",
        "grid_position": {"x": -2, "y": 1},
        "connections": ["settlement_slug"],
        "npc_ids": ["character_innkeeper_slug"],
        "objects": [{"id": "fireplace_slug", "name": "The Hearth", "description": "1 sentence", "is_interactable": true}],
        "ambient_type": "tavern_common_room"
      },
      {
        "id": "shop_slug",
        "name": "The Shop Name",
        "type": "market",
        "is_settlement_node": false,
        "is_interior": true,
        "parent_location_id": "settlement_slug",
        "atmosphere": "Shop interior description.",
        "grid_position": {"x": 3, "y": -1},
        "connections": ["settlement_slug"],
        "npc_ids": ["character_merchant_slug"],
        "objects": [{"id": "counter_slug", "name": "The Counter", "description": "1 sentence", "is_interactable": true}],
        "ambient_type": "market_stall"
      },
      {
        "id": "smithy_slug",
        "name": "The Smithy Name",
        "type": "smithy",
        "is_settlement_node": false,
        "is_interior": true,
        "parent_location_id": "settlement_slug",
        "atmosphere": "Smithy interior description.",
        "grid_position": {"x": -1, "y": 3},
        "connections": ["settlement_slug"],
        "npc_ids": [],
        "objects": [{"id": "anvil_slug", "name": "The Anvil", "description": "1 sentence", "is_interactable": true}],
        "ambient_type": "smithy"
      },
      {
        "id": "fourth_slug",
        "name": "The Fourth Sub-Location Name",
        "type": "shrine",
        "is_settlement_node": false,
        "is_interior": true,
        "parent_location_id": "settlement_slug",
        "atmosphere": "Fourth sub-location interior description.",
        "grid_position": {"x": 2, "y": 2},
        "connections": ["settlement_slug"],
        "npc_ids": [],
        "objects": [{"id": "altar_slug", "name": "The Altar", "description": "1 sentence", "is_interactable": true}],
        "ambient_type": "temple_shrine"
      }
    ],
    "region_locations": [
      {
        "id": "region_dungeon_slug",
        "name": "The Region Dungeon Name (NOT inside the town)",
        "type": "dungeon",
        "node_type": "dungeon",
        "is_settlement_node": false,
        "is_interior": false,
        "atmosphere": "1-2 sentences describing the dungeon's exterior + history.",
        "grid_position": {"x": 10, "y": -5},
        "connections": ["settlement_slug"],
        "npc_ids": [],
        "objects": [],
        "ambient_type": "dungeon_corridor",
        "encounter_chance": 0.6,
        "encounter_roster": ["<genre>_bestiary_enemy_1", "<genre>_bestiary_enemy_2", "<region_id>_themed_enemy_id"],
        "is_boss_room": false,
        "dungeon_rooms": [
          {
            "id": "region_dungeon_slug_entrance",
            "name": "The Entrance Hall Name",
            "description": "1-2 sentences. Establishes the dungeon's identity and history.",
            "room_type": "entrance",
            "connections": ["region_dungeon_slug_middle"],
            "encounter_chance": 0.5,
            "objects": [
              {"id": "entrance_chest_slug", "name": "Entrance Container Name", "description": "1 sentence", "is_interactable": true, "type": "container"},
              {"id": "entrance_lore_slug", "name": "Lore Item Name", "description": "1 sentence — hints at the boss room lock", "is_interactable": true, "type": "lore"}
            ]
          },
          {
            "id": "region_dungeon_slug_middle",
            "name": "The Middle Chamber Name",
            "description": "1-2 sentences. The room where the key item is hidden.",
            "room_type": "middle",
            "connections": ["region_dungeon_slug_entrance", "region_dungeon_slug_boss"],
            "encounter_chance": 0.7,
            "objects": [
              {"id": "middle_chest_slug", "name": "Middle Container Name", "description": "1 sentence", "is_interactable": true, "type": "container"},
              {"id": "middle_key_object_slug", "name": "The Story-Named Key Object (e.g. The Warden's Seal)", "description": "1 sentence. Where the key item rests.", "is_interactable": true, "type": "container", "is_key_item": true, "unlocks_node": "region_dungeon_slug_boss"}
            ]
          },
          {
            "id": "region_dungeon_slug_boss",
            "name": "The Boss Chamber Name",
            "description": "1-2 sentences. The climactic chamber sealed by the key.",
            "room_type": "boss",
            "connections": ["region_dungeon_slug_middle"],
            "encounter_chance": 1.0,
            "objects": [],
            "lock": {
              "type": "key",
              "hint": "1-2 sentences describing the sealed door and the SHAPE of what would open it (a seal, a key, a token, a glyph) WITHOUT naming the specific item. NEVER mention the key object's name.",
              "key_item_id": "middle_key_object_slug",
              "key_item_name": "The Story-Named Key Object",
              "unlocked": false
            }
          }
        ]
      },
      {
        "id": "region_landmark_slug",
        "name": "The Region Landmark Name (a ruin / shrine / overlook — NOT a dungeon)",
        "type": "wilderness",
        "node_type": "landmark",
        "is_settlement_node": false,
        "is_interior": false,
        "atmosphere": "1-2 sentences describing this standalone lore-rich site.",
        "grid_position": {"x": -8, "y": 6},
        "connections": ["settlement_slug"],
        "npc_ids": [],
        "objects": [
          {"id": "landmark_obj_slug", "name": "Tier 1 Lore Object Name", "description": "1 sentence", "is_interactable": true, "type": "lore"}
        ],
        "ambient_type": "open_ruins",
        "encounter_chance": 0.1
      }
    ],
    "npcs": [
      {
        "id": "<name_slug>",
        "name": "<NPC name derived from WCD cultural context>",
        "home_location_id": "tavern_slug",
        "role": "innkeeper",
        "personality": "1 sentence",
        "knowledge": [
          {"topic": "Local rumours (3-5 words)", "content": "Full WCD-consistent sentence the NPC knows."}
        ],
        "default_trust": 50
      },
      {
        "id": "<name_slug>",
        "name": "<NPC name derived from WCD cultural context>",
        "home_location_id": "shop_slug",
        "role": "merchant",
        "personality": "1 sentence",
        "knowledge": [
          {"topic": "Trade goods (3-5 words)", "content": "Full WCD-consistent sentence the NPC knows."}
        ],
        "default_trust": 50
      }
    ],
    "exits": [],
    "enemies": [
      {
        "id": "<region_id>_themed_enemy_id",
        "name": "Themed Enemy Name",
        "hp_range": [5, 8],
        "agi_mod": 1,
        "str_mod": 0,
        "damage_die": "1d6",
        "armor_bonus": 0,
        "xp_value": 25,
        "loot_table_id": "<region_id>_themed_enemy_id_loot",
        "is_boss": false,
        "behavior_flavor": "1-3 word phrase"
      }
    ]
  },
  "adjacent_regions": [
    {
      "id": "region_slug",
      "name": "Region Name",
      "type": "wilderness",
      "region_type": "settled|frontier|hostile",
      "grid_centre": {"x": 22, "y": 8},
      "direction_from_start": "north",
      "distance": "adjacent",
      "atmosphere_hint": "1 sentence",
      "key_npc_count": 2,
      "location_count": 3,
      "enemies": [
        {
          "id": "<region_slug>_outline_enemy_id",
          "name": "Outline Enemy Name",
          "hp_range": [8, 13],
          "agi_mod": 1,
          "str_mod": 1,
          "damage_die": "1d6",
          "armor_bonus": 1,
          "xp_value": 50,
          "loot_table_id": "<region_slug>_outline_enemy_id_loot",
          "is_boss": false,
          "behavior_flavor": "1-3 word phrase"
        }
      ]
    }
  ],
  "main_quest": {
    "title": "Quest Title — internal label, never shown to player",
    "archetype": "${wcdMq.archetype}",
    "threat_description": "${wcdMq.threat_description.replace(/"/g, '\\"')}",
    "factions": [
      ${(wcdMq.factions ?? []).map((f) => JSON.stringify({
        id:          f.id,
        name:        f.name,
        role:        f.role,
        description: f.description,
      })).join(",\n      ") || "{ \"id\": \"defenders_slug\", \"name\": \"...\", \"role\": \"defenders\", \"description\": \"1-2 sentences\" }"}
    ],
    "finale_type": "${wcdMq.finale_type}",
    "breadcrumbs": [
      {
        "id": "breadcrumb_act1",
        "act": 1,
        "content": "1-2 sentences. Act 1 reveal triggered by first major NPC conversation OR first dungeon completion (whichever happens first). FIXED — always in the starting region.",
        "anchor_type": "fixed"
      },
      {
        "id": "breadcrumb_act2",
        "act": 2,
        "content": "1-2 sentences. Act 2 reveal — escalates the threat with new context. FLOATING — RegionBible expansion will attach this to an eligible region (NPC dialogue, dungeon lore, or landmark).",
        "anchor_type": "floating"
      },
      {
        "id": "breadcrumb_act3",
        "act": 3,
        "content": "1-2 sentences. Act 3 reveal — names the climax stakes. FLOATING — RegionBible expansion will attach this later than act 2.",
        "anchor_type": "floating"
      },
      {
        "id": "breadcrumb_climax",
        "act": "climax",
        "content": "1-2 sentences. The confrontation / choice / discovery moment itself. FIXED — apply-world-bible will anchor this to the main dungeon's boss room.",
        "anchor_type": "fixed"
      }
    ],
    "resolutions": [
      {
        "id": "resolution_a",
        "summary": "1-2 sentences. One of two satisfying endings — favors the defenders or aligns with restoration. Tone typically hopeful or ambiguous.",
        "tone": "hopeful"
      },
      {
        "id": "resolution_b",
        "summary": "1-2 sentences. The darker / more complicated ending. Both endings are valid — neither is secretly 'wrong'. Tone typically dark or ambiguous.",
        "tone": "dark"
      }
    ],
    "world_intro_template": "WORLD INTRO TEMPLATE — second-person, ~6-7 sentences total. Three parts separated by blank lines:\\n\\n(1) WORLD RIGHT NOW (2-3 sentences, present tense — what is happening TODAY in {world_name}; mood and gravity; no history dump; no quest spoilers).\\n\\n(2) WHO YOU ARE IN IT (2-3 sentences — refer to {name} and {class}; why they came here; what they've noticed; what feels wrong).\\n\\n(3) OPENING MOMENT (1 sentence — drop in mid-scene at the starting settlement; specific and immediate)."
  },
  "world_loot_items": [
    {
      "id": "<world_slug>_item_slug",
      "name": "Item Name",
      "type": "WEAPON|ARMOR|CONSUMABLE|VALUABLE|LORE",
      "rarity": "COMMON|UNCOMMON|RARE",
      "effect": {},
      "quantity": 1,
      "stackable": false,
      "value": 20
    }
  ],
  "generated_at": "${generatedAt}"
}

Generate exactly:
- 1 settlement node + 4 sub-locations inside it (tavern + shop + smithy/guild + one more) + 4-5 NPCs.
- 1 standalone region_location alongside the settlement (dungeon / wilderness / shrine).

The settlement node is a town square / crossroads / hub — NEVER a
named building. Each sub-location is is_interior: true and references
the settlement node via parent_location_id. NPCs live in the
sub-locations (their home_location_id), not in the square itself.
The region_locations entry is is_interior: false with no
parent_location_id — it sits in the geographic area, NOT inside the
town. Connect it to the settlement node via connections.
'name' is the geographic region. 'settlement_name' is the town.
Make content original, specific to the WCD and genre.
REAL NAMES for all NPCs. No placeholders.

NPC names must be derived from the cultural, linguistic, and
geographic context established in the WCD above. A maritime
salvage world names people differently than a volcanic fortress
world. A corporate dystopia names people differently than a
haunted coastal village. Read the WCD. Let the world's identity
generate the names — do not draw from generic naming pools.

V8.53 — MINIMUM-VIABLE WORLDBIBLE
Generate ONLY what the player needs at game start. RegionBible
expansion adds richness when adjacent regions are entered. Skip
backstory, dialogue hints, relationship history, and any flavor
that can be deferred. Goal: smallest WorldBible response that still
boots a playable world.

NPC FIELDS (Architecture C): generate id, name, home_location_id,
role, a 1-sentence personality, knowledge[], default_trust. Skip
appearance and speech_style — they're filled in on demand by the
narrator. Generate 1-2 knowledge items per NPC (was 2-4 pre-V8.53)
in {topic, content} shape: topic is a 3-5 word button label, content
is the full WCD-consistent sentence the NPC reveals on a passed
stat check. Do NOT emit plain strings — always {topic, content}.

ENEMY FIELDS: generate stats only — id, name, hp_range, agi_mod,
str_mod, damage_die, armor_bonus, xp_value, loot_table_id, is_boss,
behavior_flavor. Skip description; the narrator and the genre
bestiary supply flavor at runtime.

WORLD LOOT ITEM FIELDS: generate id, name, type, rarity, effect,
quantity, stackable, value. Skip description; item descriptions
generate lazily at first interaction in a later phase.

DAY 20 COMBAT — REGION ENEMIES & ENCOUNTER TAGGING:

starting_region.enemies — generate 3-5 region-themed enemies that
thematically fit the WCD flavor and the region's atmosphere.
Constraints (every enemy must obey these):
- 3-5 entries, each with a UNIQUE id prefixed with the region id
  (e.g. "<region_id>_<creature_type>")
- hp_range: [min, max] — see ENEMY STAT BUDGET BY REGION TIER below
- agi_mod and str_mod: integers (range bounded by tier — see below)
- armor_bonus: integer between 0 and 3
- damage_die: one of "1d4", "1d6", "1d8", "1d10", "2d4", "2d6", "2d8"
- xp_value: integer between 25 and 1000 scaled to difficulty
- behavior_flavor: 1-3 word phrase (e.g. "ranged ambusher",
  "implacable melee", "defensive caster")
- is_boss: false unless this enemy IS the main quest antagonist
- loot_table_id: stub of form "<enemy_id>_loot" — Day 21 will wire
  the real loot tables to these ids without changing the bible.

ENEMY STAT BUDGET BY REGION TIER (V8.51 — calibrated for the 2-10
player stat scale, NOT the D&D 1-20 scale):

Player modifier formula: floor((stat - 2) / 2). Stat 4 = +1 mod.
Target DC = 10 + enemy.agi_mod + enemy.armor_bonus. A level-1 player
typically has +0 to +1 on attacks, so DC 11-12 yields ~50% hit rate.

Starting region / first dungeon enemies (level 1 appropriate):
  hp_range:    [4, 8]    agi_mod: 0–1    armor_bonus: 0
  str_mod:     0–1       damage_die:     "1d4" or "1d6"
  Design check: a level-1 player should kill these in 2-3 hits.

First expansion region enemies (levels 2-4):
  hp_range:    [7, 14]   agi_mod: 1–2    armor_bonus: 0–1
  str_mod:     1–2       damage_die:     "1d6" or "1d8"

Deep region enemies (levels 4+):
  hp_range:    [12, 22]  agi_mod: 2–3    armor_bonus: 1–2
  str_mod:     2–3       damage_die:     "1d8" or "2d4"

The starting_region this prompt generates is always the FIRST tier.
NEVER generate starting region enemies with:
  - agi_mod above 1
  - hp_range minimum above 8
  - damage_die larger than "1d6"
Violating these guarantees produces an unwinnable level-1 fight.

adjacent_regions[i].enemies — give 1-2 enemies per outline (less
detail, since the full roster is generated when the region is
expanded into a RegionBible). Same shape, same constraints. Outline
regions can use the "first expansion" tier budget above when the
WCD positions them as adjacent / mid-game regions.

ENCOUNTER TAGGING for combat-eligible locations:
For each location of type "dungeon", "wilderness", "ruin", "stronghold",
"port", or similar combat-eligible location, also produce:
- encounter_chance: float 0.0-1.0
  • 0.0 for peaceful story locations (taverns, shops, settlements)
  • 0.4-0.7 for normal combat zones (wilderness paths, dungeon halls)
  • 1.0 for boss rooms and obvious combat areas
- encounter_roster: 2-4 enemy ids drawn from this region's enemies
  array AND/OR the genre bestiary (e.g. "fantasy_goblin",
  "fantasy_skeleton" for fantasy; equivalent ids for other genres).
  Mix region-specific and bestiary entries so encounters feel both
  themed and varied.
- is_boss_room: true only for the climactic location of a boss.

The tavern, shop, smithy, shrine, and settlement hub are NOT
combat-eligible — leave their encounter_chance unset (or 0) and
omit encounter_roster. The standalone region_location IS combat-
eligible — it MUST carry encounter_chance and encounter_roster.

DAY 23A — LOCATION VARIETY & REGION TYPES

Every node has a "node_type" from this fixed set (case-sensitive):
  • settlement_hub      — Safe town with services (tavern + shop + etc.)
  • outpost             — 1-2 NPCs, limited supplies, no full services
  • wilderness          — Outdoor travel node; optional 0.1-0.2 encounter
  • dungeon             — Dangerous multi-room structure (see DUNGEON STRUCTURE)
  • landmark            — Ruin / monument / sacred site; lore-rich; light encounter
  • abandoned_settlement — Ruined former settlement; survivors or haunts

NODE_TYPE ASSIGNMENT — CRITICAL:
  • ONLY the location where is_settlement_node: true receives
    node_type: "settlement_hub". Exactly one entry in
    starting_region.locations carries both flags.
  • ALL sub-locations (tavern, inn, shop, smithy, shrine,
    market_stall, etc.) MUST NOT have node_type set — OMIT the
    field entirely on sub-locations. Their card label is derived
    from their "type" field instead (TAVERN / SHOP / SMITHY / etc.).
  • EVERY entry in starting_region.region_locations gets node_type
    set to one of {dungeon, landmark, wilderness, outpost,
    abandoned_settlement} matching the location's character.

Pre-fix bug: setting node_type: "settlement_hub" on sub-locations
made every sub-location's nav card render "SETTLEMENT" instead of
"TAVERN" / "SHOP" / etc. That's the symptom this rule prevents.

The starting region is ALWAYS region_type "settled". It MUST have
2-3 entries in starting_region.region_locations: at LEAST one
"dungeon" (with the full 3-room dungeon_rooms structure — see
DUNGEON STRUCTURE below + the JSON skeleton above), plus 1-2 of
{landmark, wilderness, abandoned_settlement, outpost}. Do NOT
generate only one region_location — the player needs variety
beyond the settlement on day 1.

REGION TYPE GUIDANCE for adjacent_regions (set "region_type" on each):
  settled   — 1 settlement_hub + 1-2 dungeons + 1-2 landmark/wilderness
  frontier  — 0-1 outposts + 1-2 dungeons + 1-2 wilderness/landmarks
  hostile   — 0 settlements + 2-3 dungeons + 1-2 landmarks/abandoned
              All non-dungeon nodes get encounter_chance ≥ 0.3 to
              match the threat; richer boss loot rewards the risk.
Mix the 3 (or more) adjacent_regions so the player sees variety —
generate at least one non-settled region whenever the WCD permits.

DAY 23A — DUNGEON STRUCTURE (mandatory for every node_type "dungeon")

Every dungeon node MUST carry a "dungeon_rooms" array of EXACTLY
3 entries in this fixed order: entrance → middle → boss. Ids
follow the pattern \`{dungeon_id}_entrance\` / \`_middle\` / \`_boss\`.

Room 1 — entrance (room_type "entrance", encounter_chance 0.5):
  • description: 1-2 sentences. Establishes the dungeon's identity.
  • objects: at least 1 with type "container". May add 1 "lore"
    object that foreshadows the boss-room lock.
  • connections: ["{dungeon_id}_middle"]

Room 2 — middle (room_type "middle", encounter_chance 0.7):
  • description: 1-2 sentences. Where the key is hidden.
  • objects: at least 1 type "container", PLUS the key-object:
    a named story object (e.g. "The Warden's Seal", "Aldric's
    Iron Key", "The Cracked Signet Ring") — never a generic
    "iron key". The key-object MUST have:
      "is_interactable": true
      "type": "container"
      "is_key_item": true
      "unlocks_node": "{dungeon_id}_boss"
  • connections: ["{dungeon_id}_entrance", "{dungeon_id}_boss"]

Room 3 — boss (room_type "boss", encounter_chance 1.0):
  • description: 1-2 sentences. The climactic chamber.
  • objects: [] (boss + drop carries the reward)
  • connections: ["{dungeon_id}_middle"]
  • lock: {
      "type": "key",
      "hint": "1-2 sentences describing the door + the KIND of object
              that would open it (a seal, a key, a token, a glyph).
              NEVER name the key object directly. The player should
              learn its name by finding the object, not by reading the
              lock hint. Example GOOD: 'A ceremonial lock, its socket
              shaped to receive an official seal of office. Whatever
              this chamber holds, it was not meant to be opened
              without authority.' Example BAD: 'This door requires
              the Warden's Seal to unlock.'",
      "key_item_id": "{middle-room key-object id}",
      "key_item_name": "{the key-object's display name}",
      "unlocked": false
    }
  • is_boss_room SHOULD also be true at the parent dungeon-node
    level (encounter_chance 1.0 + named boss enemy in the roster).

DAY 23B (V8.59) ENFORCEMENT REMINDER — MAIN QUEST FIELDS
The main_quest object MUST emit:
  • title, archetype (from the seed: "${wcdMq.archetype}"),
    threat_description, factions[], finale_type (from the seed:
    "${wcdMq.finale_type}").
  • breadcrumbs[]: EXACTLY 4 entries — one each for act 1, 2, 3, and
    "climax". Acts 1 and "climax" have anchor_type "fixed". Acts 2
    and 3 have anchor_type "floating". Use the ids exactly as shown
    in the skeleton: breadcrumb_act1 / breadcrumb_act2 /
    breadcrumb_act3 / breadcrumb_climax.
  • resolutions[]: EXACTLY 2 entries — resolution_a and resolution_b,
    each with a 1-2 sentence summary and a tone of "hopeful", "dark",
    or "ambiguous". Both must be satisfying — neither is secretly
    "wrong".
  • world_intro_template: the 3-part second-person intro described in
    the skeleton. Use the {name} and {class} placeholders literally
    — apply-world-bible swaps them in at game start. Do NOT embed
    the player's name directly. Do NOT spoil the main quest.
Skipping any of these fields or abbreviating breadcrumbs to fewer
than 4 entries causes apply-world-bible to reject the response.

V8.54 ENFORCEMENT REMINDER — Every location whose node_type is
"dungeon" MUST emit a "dungeon_rooms" array with all 3 entries
(entrance, middle, boss). This applies to:
  • starting_region.region_locations entries with node_type "dungeon"
  • adjacent_regions[i] outline previews are exempt (RegionBible
    fills in their dungeon_rooms when the region expands)
A dungeon WITHOUT dungeon_rooms is incomplete and will be rejected
client-side. The JSON skeleton above shows the exact shape — copy
it; do not abbreviate. The middle room MUST contain a key-object
with is_key_item: true; the boss room MUST contain a "lock" field
pointing at that key-object's id.

Example combat-tagged location (a dungeon entrance with mixed roster):
{
  "id": "<location_id_slug>",
  "type": "dungeon",
  "encounter_chance": 0.7,
  "encounter_roster": ["<genre>_bestiary_enemy", "<genre>_bestiary_enemy", "<region_id>_themed_enemy_id"],
  "is_boss_room": false
}

DAY 21 LOOT — WORLD LOOT ITEMS:

Generate 6-8 world_loot_items at the TOP LEVEL of the bible
(alongside starting_region / adjacent_regions / main_quest). These
items feel native to THIS specific world — items a player would
recognize as belonging to this world's themes, not a generic
fantasy / cyberpunk / horror setting.

Mix of rarities:
- Mostly COMMON (4-5 items)
- Some UNCOMMON (2-3 items)
- 1 RARE item

Each item must reflect the WCD's atmosphere and world_rules. Vary
types across the 6-8 entries: mix WEAPON, ARMOR, CONSUMABLE,
VALUABLE, LORE. Avoid duplicating the obvious "iron sword / health
potion" defaults — these are world-specific finds, not the genre
default. Example for a "salt-crusted desert" world: a "Salt-Brined
Saber" (WEAPON UNCOMMON), a "Sand-Glass Vial" (VALUABLE COMMON),
a "Salt-Pilgrim's Robe" (ARMOR COMMON), a "Map to the Buried
Wells" (LORE UNCOMMON), etc.

V8.53 — DO NOT include a "description" field on world_loot_items.
Names alone communicate the item's identity; descriptions generate
on demand at first interaction in a later phase.

V8.54 (Day 23A) — LOOT CONTEXT GUIDANCE
Dungeon / combat drop tables should produce: weapons, armor,
valuables, healing consumables (potions / stims / medkits), and
the rare RARE artifact. NEVER generate food / ration / bread /
trail-mix items in dungeon loot or in enemy drop tables — food
belongs in settlement and outpost containers + merchant
inventories only. Mismatched flavor (a goblin dropping "Dried
Provisions" mid-dungeon) was a recurring playtest complaint.

Item id format: "<world_slug>_<item_slug>". Stat fields by type:
- WEAPON: effect: { "damage_die": "1d6"|"1d8"|"1d10" } and a value
  in the 25-300 range scaled to rarity.
- ARMOR: effect: { "armor_bonus": 1|2|3 } and a value 15-200.
- CONSUMABLE: effect: { "heal": N } (when it heals) or {} for
  utility items. Value 5-50.
- VALUABLE: effect: {} (no mechanical effect). Value 15-150 — these
  sell for their value at merchants (Day 21 stub).
- LORE: effect: {}. Value 2-20.
- stackable: true for CONSUMABLE; false for everything else.
- quantity: 1 for all template entries (resolver stamps fresh
  per-drop).

DAY 21 LOOT — DUNGEON CONTAINER GUARANTEE:

Every location with type "dungeon" or is_boss_room=true MUST
contain at least one Tier 1 object with type "container" (e.g. a
chest, sarcophagus, ritual offering bowl, footlocker, crate of
supplies — pick something thematic for the room). LocationObject
shape gains an optional "type" field:
- "container" — INTERACT rolls loot for the player.
- "fixture" — decorative; INTERACT returns a templated empty beat.
- "lore" — INTERACT delivers a tip; templated, no LLM call.
- "trigger" — drives a flag; reserved for future use.

For non-dungeon locations (taverns, settlements, shops, shrines),
mark Tier 1 objects with "type": "fixture" or "lore" so INTERACT
returns the templated empty/informational response rather than
burning an LLM call. Containers can also appear in non-dungeon
locations — but the engine GUARANTEES at least one per dungeon /
boss room.`;
}

function stripJsonFences(raw: string): string {
  return raw
    .trim()
    .replace(/^```(?:json)?\n?/i, "")
    .replace(/\n?```$/i, "")
    .trim();
}

// ── Normalization helpers ────────────────────────────────────────────────────

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

/**
 * Architecture C — coerce a single NPC knowledge entry into the
 * canonical `{topic, content}` shape. Plain strings (legacy format)
 * derive a topic from the first ~5 words. Returns null when the
 * entry is unusable (empty, malformed) so callers can drop it.
 */
function normalizeKnowledgeItem(
  raw: unknown
): { topic: string; content: string } | null {
  if (typeof raw === "string") {
    const content = raw.trim();
    if (!content) return null;
    const words = content.split(/\s+/).slice(0, 5).join(" ");
    const topic = words.replace(/[.!?,;:]+$/, "").trim();
    return { topic: topic || content.slice(0, 40), content };
  }
  if (raw && typeof raw === "object") {
    const obj     = raw as Record<string, unknown>;
    const topic   = typeof obj.topic   === "string" ? obj.topic.trim()   : "";
    const content = typeof obj.content === "string" ? obj.content.trim() : "";
    if (!content) return null;
    return {
      topic:   topic || content.split(/\s+/).slice(0, 5).join(" "),
      content,
    };
  }
  return null;
}

/**
 * Pull the first array-shaped value found at one of the alternate keys.
 * Used by normalizeWorldBible so that AI variants (sub_locations, places,
 * characters, residents…) all collapse to the canonical field name without
 * losing the data.
 */
function pickArray(o: Record<string, unknown>, keys: string[]): unknown[] | null {
  for (const k of keys) {
    const v = o[k];
    if (Array.isArray(v)) return v;
  }
  return null;
}

/**
 * Pre-validation pass that maps common AI field-name variants to the
 * canonical schema and fills missing mechanical fields with safe defaults.
 * Creative content (names, descriptions) is preserved verbatim — we only
 * default fields the AI tends to skip when racing to fit the token budget.
 */
function normalizeWorldBible(parsed: unknown): unknown {
  if (!parsed || typeof parsed !== "object") return parsed;
  const o = parsed as Record<string, unknown>;

  // ── Root-level restructure ────────────────────────────────────────────────
  // Some AI responses skip the starting_region wrapper entirely and emit
  // locations / npcs / exits at the top level. Detect that and wrap them
  // up so the downstream normalization sees a canonical shape.
  if (!o.starting_region || typeof o.starting_region !== "object") {
    const rootLocations = pickArray(o, [
      "locations", "sub_locations", "sublocation", "sublocations",
      "areas", "places", "nodes", "buildings", "sites",
    ]);
    const rootNpcs = pickArray(o, [
      "npcs", "characters", "people", "inhabitants", "npc_list",
    ]);

    const pickString = (keys: string[]): string | null => {
      for (const k of keys) {
        const v = o[k];
        if (typeof v === "string" && v.trim()) return v;
      }
      return null;
    };

    if ((rootLocations?.length ?? 0) > 0 || (rootNpcs?.length ?? 0) > 0) {
      o.starting_region = {
        id:         pickString(["id", "region_id", "settlement_id"]) ?? "starting_region",
        name:       pickString(["name", "region_name", "settlement_name"]) ?? "Starting Settlement",
        type:       pickString(["type", "region_type"]) ?? "settlement_hub",
        atmosphere: pickString(["atmosphere", "description", "setting"]) ?? "",
        locations:  rootLocations ?? [],
        npcs:       rootNpcs ?? [],
        exits:      pickArray(o, ["exits", "connections", "routes"]) ?? [],
      };
      console.log("[WorldBible] Restructured flat response into starting_region");
    }

    // If still no starting_region, scan for region data nested under a
    // different key (region / settlement / world / area / hub / etc.).
    if (!o.starting_region || typeof o.starting_region !== "object") {
      for (const key of [
        "region", "settlement", "world", "area", "hub",
        "starting_area", "start", "beginning",
      ]) {
        const candidateRaw = o[key];
        if (
          candidateRaw &&
          typeof candidateRaw === "object" &&
          !Array.isArray(candidateRaw)
        ) {
          const candidate = candidateRaw as Record<string, unknown>;
          const candLocations = pickArray(candidate, [
            "locations", "sub_locations", "sublocation", "areas", "places",
          ]);
          if ((candLocations?.length ?? 0) > 0) {
            o.starting_region = { ...candidate };
            console.log(`[WorldBible] Found starting_region under key: ${key}`);
            break;
          }
        }
      }
    }
  }

  // ── starting_region ───────────────────────────────────────────────────────
  const sr = o.starting_region;
  if (sr && typeof sr === "object") {
    const region = sr as Record<string, unknown>;

    // locations: accept several alternate keys
    if (!Array.isArray(region.locations)) {
      const alt = pickArray(region, [
        "sub_locations", "sublocation", "sublocations",
        "areas", "places", "nodes", "buildings", "sites",
      ]);
      region.locations = alt ?? [];
    }

    // npcs: accept several alternate keys
    if (!Array.isArray(region.npcs)) {
      const alt = pickArray(region, [
        "characters", "people", "inhabitants", "residents", "npc_list",
      ]);
      region.npcs = alt ?? [];
    }

    // Object-shaped containers: AI sometimes emits keyed dictionaries
    // ({ "town_square": {...}, "inn": {...} }) instead of arrays. Flatten
    // to Object.values() and stamp the dict key as the entry id when the
    // entry doesn't carry one already.
    if (
      region.locations &&
      !Array.isArray(region.locations) &&
      typeof region.locations === "object"
    ) {
      const dict = region.locations as Record<string, unknown>;
      region.locations = Object.entries(dict).map(([k, v]) => {
        if (v && typeof v === "object" && !Array.isArray(v)) {
          const inner = v as Record<string, unknown>;
          if (!inner.id || typeof inner.id !== "string" || !(inner.id as string).trim()) {
            return { ...inner, id: k };
          }
          return inner;
        }
        return v;
      });
      console.log("[WorldBible] Converted locations object to array");
    }

    if (
      region.npcs &&
      !Array.isArray(region.npcs) &&
      typeof region.npcs === "object"
    ) {
      const dict = region.npcs as Record<string, unknown>;
      region.npcs = Object.entries(dict).map(([k, v]) => {
        if (v && typeof v === "object" && !Array.isArray(v)) {
          const inner = v as Record<string, unknown>;
          if (!inner.id || typeof inner.id !== "string" || !(inner.id as string).trim()) {
            return { ...inner, id: k };
          }
          return inner;
        }
        return v;
      });
      console.log("[WorldBible] Converted npcs object to array");
    }

    // exits: accept connections fallback
    if (!Array.isArray(region.exits)) {
      const alt = pickArray(region, ["exits", "connections"]);
      region.exits = alt ?? [];
    }

    // Day 20 — region_locations is the new "standalone locations in
    // the geographic region (NOT inside the settlement)" field.
    // Default to [] when absent so apply-world-bible can iterate
    // unconditionally. Accept a few aliases the model occasionally
    // emits in its place.
    if (!Array.isArray(region.region_locations)) {
      const alt = pickArray(region, [
        "region_locations", "regional_locations",
        "standalone_locations", "outdoor_locations",
        "wilderness_points", "landmarks",
      ]);
      region.region_locations = alt ?? [];
    }
    region.region_locations = (region.region_locations as unknown[]).map((loc, idx) => {
      if (!loc || typeof loc !== "object") return loc;
      const l = { ...(loc as Record<string, unknown>) };
      if (!l.name || typeof l.name !== "string" || !(l.name as string).trim()) {
        l.name = `Region Landmark ${idx + 1}`;
      }
      if (!l.id || typeof l.id !== "string" || !(l.id as string).trim()) {
        l.id = slugify(l.name as string);
      }
      if (!Array.isArray(l.connections)) l.connections = [];
      if (!Array.isArray(l.npc_ids))     l.npc_ids     = [];
      if (!Array.isArray(l.objects))     l.objects     = [];
      // Standalone region locations are NEVER settlement nodes and
      // NEVER interior — coerce in case the model got confused.
      l.is_settlement_node = false;
      l.is_interior        = false;
      return l;
    });

    // id / type / atmosphere defaults
    if (typeof region.name !== "string" || !(region.name as string).trim()) {
      region.name = "Starting Region";
    }
    if (!region.id || typeof region.id !== "string" || !(region.id as string).trim()) {
      region.id = slugify(region.name as string);
    }
    if (!region.type || typeof region.type !== "string" || !(region.type as string).trim()) {
      region.type = "settlement_hub";
    }
    if (typeof region.atmosphere !== "string") {
      region.atmosphere = "";
    }

    // Normalize each location
    if (Array.isArray(region.locations)) {
      region.locations = (region.locations as unknown[]).map((loc, idx) => {
        if (!loc || typeof loc !== "object") return loc;
        const l = { ...(loc as Record<string, unknown>) };

        if (!l.name || typeof l.name !== "string" || !(l.name as string).trim()) {
          l.name = `Unnamed Location ${idx + 1}`;
        }
        if (!l.id || typeof l.id !== "string" || !(l.id as string).trim()) {
          l.id = slugify(l.name as string);
        }
        if (!Array.isArray(l.connections)) l.connections = [];
        if (!Array.isArray(l.npc_ids))     l.npc_ids     = [];
        if (!Array.isArray(l.objects))     l.objects     = [];
        if (typeof l.is_settlement_node !== "boolean") l.is_settlement_node = false;
        if (typeof l.is_interior         !== "boolean") l.is_interior         = true;
        return l;
      });
    }

    // Normalize each NPC and capture the first location id for fallback home
    const firstLocId = (() => {
      const locs = region.locations;
      if (!Array.isArray(locs) || locs.length === 0) return "";
      const first = locs[0] as Record<string, unknown> | undefined;
      return typeof first?.id === "string" ? (first.id as string) : "";
    })();

    if (Array.isArray(region.npcs)) {
      region.npcs = (region.npcs as unknown[]).map((npc, idx) => {
        if (!npc || typeof npc !== "object") return npc;
        const n = { ...(npc as Record<string, unknown>) };

        if (!n.name || typeof n.name !== "string" || !(n.name as string).trim()) {
          n.name = `Unnamed Character ${idx + 1}`;
        }
        if (!n.id || typeof n.id !== "string" || !(n.id as string).trim()) {
          n.id = `character_${slugify(n.name as string)}`;
        }
        if (!Array.isArray(n.knowledge)) n.knowledge = [];
        // Architecture C — normalize knowledge entries to {topic,
        // content}. Plain strings (legacy AI output) become objects
        // with the first 5 words as the topic label so the dialogue
        // option builder can show a button without a separate parsing
        // step. Already-shaped objects pass through unchanged.
        n.knowledge = (n.knowledge as unknown[])
          .map((k) => normalizeKnowledgeItem(k))
          .filter((k): k is { topic: string; content: string } => k !== null);
        if (typeof n.default_trust !== "number") n.default_trust = 50;
        if (!n.home_location_id || typeof n.home_location_id !== "string") {
          n.home_location_id = firstLocId;
        }
        return n;
      });
    }
  } else {
    // No starting_region at all — seed an empty shell so validateBible
    // produces a clear "starting_region.name missing" rather than the
    // generic "starting_region missing".
    o.starting_region = {
      id:        "starting_region",
      name:      "Starting Region",
      type:      "settlement_hub",
      atmosphere: "",
      locations: [],
      npcs:      [],
      exits:     [],
    };
  }

  // ── adjacent_regions ──────────────────────────────────────────────────────
  // Same alias treatment as starting_region — AI sometimes emits these
  // under "regions", "nearby_regions", etc. Promote the first match.
  if (!o.adjacent_regions || !Array.isArray(o.adjacent_regions)) {
    const rootRegions = pickArray(o, [
      "adjacent_regions", "regions", "nearby_regions", "other_regions",
      "surrounding_regions", "connected_regions", "region_outlines",
    ]);
    if (rootRegions && rootRegions.length > 0) {
      o.adjacent_regions = rootRegions;
    }
  }
  if (!Array.isArray(o.adjacent_regions)) {
    o.adjacent_regions = [];
  }
  o.adjacent_regions = (o.adjacent_regions as unknown[]).map((r, idx) => {
    if (!r || typeof r !== "object") return r;
    const region = { ...(r as Record<string, unknown>) };
    if (!region.name || typeof region.name !== "string" || !(region.name as string).trim()) {
      region.name = `Adjacent Region ${idx + 1}`;
    }
    if (!region.id || typeof region.id !== "string" || !(region.id as string).trim()) {
      region.id = slugify(region.name as string);
    }
    if (typeof region.key_npc_count !== "number") region.key_npc_count = 2;
    if (typeof region.location_count !== "number") region.location_count = 3;
    return region;
  });

  // ── main_quest ────────────────────────────────────────────────────────────
  // First try to promote from common alias keys (quest / story / plot / …)
  // before falling through to the placeholder default.
  if (!o.main_quest || typeof o.main_quest !== "object") {
    for (const key of [
      "main_quest", "quest", "story", "plot",
      "narrative", "main_story", "campaign",
    ]) {
      const candidate = o[key];
      if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
        o.main_quest = candidate;
        break;
      }
    }
  }

  // Day 23B — main_quest normalization. Backfill any field the AI skipped
  // so the new schema (archetype + threat + factions + finale_type +
  // 4 breadcrumbs + 2 resolutions + world_intro_template) always
  // type-checks. The validator below still enforces that the 4
  // breadcrumbs and 2 resolutions are present; this just keeps the
  // shape stable so the validator's error messages are useful.
  const defaultBreadcrumbs = [
    { id: "breadcrumb_act1",    act: 1,         content: "A strange rumour circulates among the locals.",          anchor_type: "fixed"    },
    { id: "breadcrumb_act2",    act: 2,         content: "Travelers from the next region report something amiss.", anchor_type: "floating" },
    { id: "breadcrumb_act3",    act: 3,         content: "The pattern becomes clear — and dangerous.",             anchor_type: "floating" },
    { id: "breadcrumb_climax",  act: "climax",  content: "The source must be confronted directly.",                anchor_type: "fixed"    },
  ];
  const defaultResolutions = [
    { id: "resolution_a", summary: "The threat is contained without dismantling what holds the world together.",      tone: "hopeful" },
    { id: "resolution_b", summary: "The threat is ended at a cost that leaves the world quieter, and emptier, for it.", tone: "dark"    },
  ];
  const defaultIntro =
    "You arrive at {name}'s starting settlement under a sky that does not yet make sense.\n\n" +
    "As a {class}, you have learned to notice things others miss. Something is wrong here, " +
    "though no one will say so directly.\n\n" +
    "A figure looks up as you cross the threshold.";

  if (!o.main_quest || typeof o.main_quest !== "object") {
    o.main_quest = {
      title:                "The Unknown Threat",
      archetype:            "ancient_awakening",
      threat_description:   "Something is happening in this world that demands attention.",
      factions:             [],
      finale_type:          "confrontation",
      breadcrumbs:          defaultBreadcrumbs,
      resolutions:          defaultResolutions,
      world_intro_template: defaultIntro,
    };
  } else {
    const mq = o.main_quest as Record<string, unknown>;
    if (typeof mq.title              !== "string" || !(mq.title              as string).trim()) mq.title              = "The Unknown Threat";
    if (typeof mq.archetype          !== "string" || !(mq.archetype          as string).trim()) mq.archetype          = "ancient_awakening";
    if (typeof mq.threat_description !== "string" || !(mq.threat_description as string).trim()) mq.threat_description = "Something is happening in this world that demands attention.";
    if (typeof mq.finale_type        !== "string" || !(mq.finale_type        as string).trim()) mq.finale_type        = "confrontation";
    if (!Array.isArray(mq.factions))     mq.factions     = [];
    if (!Array.isArray(mq.breadcrumbs) || (mq.breadcrumbs as unknown[]).length === 0) {
      mq.breadcrumbs = defaultBreadcrumbs;
    }
    if (!Array.isArray(mq.resolutions) || (mq.resolutions as unknown[]).length < 2) {
      mq.resolutions = defaultResolutions;
    }
    if (typeof mq.world_intro_template !== "string" || !(mq.world_intro_template as string).trim()) {
      mq.world_intro_template = defaultIntro;
    }
  }

  // ── Day 21 — world_loot_items ────────────────────────────────────────────
  // Default to [] when the AI omitted the array. Validation accepts an
  // empty array — the resolver falls back to the static genre pool.
  if (!Array.isArray(o.world_loot_items)) {
    o.world_loot_items = [];
  }

  // ── Day 21 — container guarantee for dungeon locations ───────────────────
  // Every "dungeon" / is_boss_room location must surface at least one
  // is_interactable object with type:"container". If the AI didn't tag
  // any, promote the FIRST is_interactable object so the player always
  // has somewhere to find loot. Non-dungeon locations: stamp untagged
  // is_interactable objects as "fixture" so INTERACT routes to the
  // templated empty response instead of an LLM call.
  const sr2 = o.starting_region as Record<string, unknown> | undefined;
  if (sr2) {
    normalizeLocationContainers(sr2.locations);
    normalizeLocationContainers(sr2.region_locations);
  }

  return o;
}

/**
 * Day 21 — walk a list of LocationDefinitions and apply the
 * container-guarantee + fixture-tag rule to each one's objects[].
 *
 * Rules:
 *   - Dungeon / boss_room location: ≥ 1 object with type "container".
 *     Promote the first is_interactable object if none is tagged.
 *   - Non-combat / non-dungeon location: untagged is_interactable
 *     objects default to "fixture" so INTERACT skips the narrator.
 *   - Existing types are preserved.
 */
function normalizeLocationContainers(locs: unknown): void {
  if (!Array.isArray(locs)) return;
  for (const raw of locs) {
    if (!raw || typeof raw !== "object") continue;
    const loc      = raw as Record<string, unknown>;
    const isCombat =
      loc.type === "dungeon" || loc.is_boss_room === true ||
      (typeof loc.encounter_chance === "number" && (loc.encounter_chance as number) > 0);
    const objs = Array.isArray(loc.objects) ? (loc.objects as Array<Record<string, unknown>>) : [];
    if (objs.length === 0) continue;

    const hasContainer = objs.some((o) => o && o.type === "container");
    if (isCombat && !hasContainer) {
      const first = objs.find((o) => o && o.is_interactable === true);
      if (first) first.type = "container";
    }
    // Tag untagged is_interactable objects as fixtures (non-combat
    // floors). Skip combat floors — the first object there is already
    // a container per the rule above, and the rest can stay untyped
    // so the narrator still describes them on EXAMINE.
    if (!isCombat) {
      for (const o of objs) {
        if (o && o.is_interactable === true && !o.type) {
          o.type = "fixture";
        }
      }
    }
  }
}

function validateBible(parsed: unknown): { ok: true; bible: WorldBible } | { ok: false; error: string } {
  if (!parsed || typeof parsed !== "object") return { ok: false, error: "WorldBible is not an object" };
  const o = parsed as Record<string, unknown>;

  const sr = o.starting_region as Record<string, unknown> | undefined;
  if (!sr || typeof sr !== "object") return { ok: false, error: "starting_region missing" };
  if (typeof sr.name !== "string" || !sr.name.trim()) return { ok: false, error: "starting_region.name missing" };
  if (!Array.isArray(sr.locations) || sr.locations.length < 2) {
    return { ok: false, error: `starting_region.locations must have at least 2 entries (got ${Array.isArray(sr.locations) ? sr.locations.length : "non-array"})` };
  }
  if (!Array.isArray(sr.npcs) || sr.npcs.length < 3) {
    return { ok: false, error: `starting_region.npcs must have at least 3 entries (got ${Array.isArray(sr.npcs) ? sr.npcs.length : "non-array"})` };
  }

  if (!Array.isArray(o.adjacent_regions) || o.adjacent_regions.length < 1) {
    return { ok: false, error: `adjacent_regions must have at least 1 entry (got ${Array.isArray(o.adjacent_regions) ? o.adjacent_regions.length : "non-array"})` };
  }

  // Day 23B — main_quest is now optional on WorldBible (legacy bibles
  // without it are allowed through). When present, enforce the new
  // schema: 4 breadcrumbs, 2 resolutions, world_intro_template present.
  // The normalizer above backfills missing fields with safe defaults so
  // this validator's job is just to catch a fully-stripped main_quest.
  const mq = o.main_quest as Record<string, unknown> | undefined;
  if (mq && typeof mq === "object") {
    if (!Array.isArray(mq.breadcrumbs) || mq.breadcrumbs.length < 4) {
      return { ok: false, error: `main_quest.breadcrumbs must have at least 4 entries (got ${Array.isArray(mq.breadcrumbs) ? mq.breadcrumbs.length : "non-array"})` };
    }
    if (!Array.isArray(mq.resolutions) || mq.resolutions.length < 2) {
      return { ok: false, error: `main_quest.resolutions must have at least 2 entries (got ${Array.isArray(mq.resolutions) ? mq.resolutions.length : "non-array"})` };
    }
    if (typeof mq.world_intro_template !== "string" || !(mq.world_intro_template as string).trim()) {
      return { ok: false, error: "main_quest.world_intro_template missing or empty" };
    }
  }

  return { ok: true, bible: parsed as WorldBible };
}

// V8.69 — restore WorldBible max_tokens to a working ceiling.
// V8.68's OPT 2 reduced 10000 → 3000; instrumentation confirmed
// WB output truncates at exactly 3000 tokens, parse fails, the
// route retries once, fails again, returns 500 after ~105 seconds.
// The Day 20 comment was right — WorldBible runs near the 8K
// boundary on rich worlds.
//
// 10000 gives room for current output plus headroom for growth
// (e.g. Day 23.5 species generation). If logs ever show
// output_tokens approaching 10000 we raise again; for now the
// instrumentation will confirm it sits comfortably below.
const WB_MODEL      = "claude-sonnet-4-5";
const WB_MAX_TOKENS = 10000;

async function callClaude(client: Anthropic, userPrompt: string): Promise<string> {
  const promptTokens = Math.ceil((SYSTEM_PROMPT.length + userPrompt.length) / 4);
  console.log(
    `[GEN_TIMING] generate-world-bible start — model: ${WB_MODEL}, prompt_tokens: ${promptTokens}`
  );
  const startedAt = Date.now();
  const message = await client.messages.create({
    model:      WB_MODEL,
    max_tokens: WB_MAX_TOKENS,
    system:     SYSTEM_PROMPT,
    messages:   [{ role: "user", content: userPrompt }],
  });
  const text = message.content[0]?.type === "text" ? message.content[0].text : "";
  const outputTokens = message.usage?.output_tokens ?? Math.ceil(text.length / 4);
  const elapsed = Date.now() - startedAt;
  console.log(
    `[GEN_TIMING] generate-world-bible complete — elapsed: ${elapsed}ms, output_tokens: ${outputTokens}`
  );
  return text;
}

export async function POST(request: NextRequest) {
  console.log("[GEN_TIMING] generate-world-bible called");
  console.log(`[GEN_TIMING] generate-world-bible max_tokens: ${WB_MAX_TOKENS}`);
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { genre, character_name, character_class, wcd } = body;
  // Day 23.5C+1 (FIX 5) — character_name + character_class are fully
  // optional. The background fire from /game/new fires WB right after
  // WCD completes (before the player has chosen a name/class), so
  // it sends "" for both. The WB prompt builder omits the Character
  // line cleanly when both are blank; world_intro_template
  // {name}/{class} resolution lives in apply-world-bible reading
  // master_state.player_state.name / .background. Only genre + wcd
  // are required for a valid WB request.
  if (!genre || !wcd) {
    return NextResponse.json(
      { error: "Missing required fields: genre, wcd" },
      { status: 400 }
    );
  }
  if (!Object.values(Genre).includes(genre)) {
    return NextResponse.json({ error: "Invalid genre" }, { status: 400 });
  }

  const charName  = typeof character_name  === "string" ? character_name.trim()  : "";
  const charClass = typeof character_class === "string" ? character_class.trim() : "";
  console.log(
    charName || charClass
      ? "[WB] generating with character context"
      : "[WB_BACKGROUND] generating without character context",
  );

  const userPrompt = buildUserPrompt(genre, charName, charClass, wcd);

  // V8.68 — prompt audit data point. The WB prompt body is mostly the
  // JSON skeleton + load-bearing instruction blocks (Day 20 enemies,
  // Day 23A dungeons, Day 23B quest schema, V8.54 enforcement). Cutting
  // any of those breaks generation. Logged at original size so future
  // audits have a baseline; if a safe cut is identified the new size
  // appears here.
  const promptChars = SYSTEM_PROMPT.length + userPrompt.length;
  console.log(
    `[GEN_TIMING] generate-world-bible prompt audited — original ~${promptChars} chars, new ~${promptChars} chars (no cuts this pass — body is load-bearing)`
  );

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  let parsed: unknown;
  let parseError = "";
  try {
    const rawText = await callClaude(anthropic, userPrompt);
    // Debug: dump head + tail of the raw response so we can see exactly
    // what the AI emitted when normalization can't reach a valid shape.
    console.log(
      "[WorldBible] Raw response (first 2000 chars):",
      rawText.substring(0, 2000)
    );
    console.log(
      "[WorldBible] Raw response (last 500 chars):",
      rawText.substring(Math.max(0, rawText.length - 500))
    );
    try {
      parsed = JSON.parse(stripJsonFences(rawText));
    } catch (err) {
      parseError = err instanceof Error ? err.message : "JSON parse failed";
      const retryPrompt = userPrompt + "\n\nReturn ONLY the JSON object, nothing else. No markdown.";
      const retryRaw = await callClaude(anthropic, retryPrompt);
      console.log(
        "[WorldBible] Retry response (first 2000 chars):",
        retryRaw.substring(0, 2000)
      );
      try {
        parsed = JSON.parse(stripJsonFences(retryRaw));
      } catch (retryErr) {
        const retryParseErr = retryErr instanceof Error ? retryErr.message : "JSON parse failed (retry)";
        return NextResponse.json(
          { error: "Failed to parse WorldBible JSON after retry", first: parseError, retry: retryParseErr },
          { status: 500 }
        );
      }
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Anthropic call failed" },
      { status: 500 }
    );
  }

  // Capture the raw shape BEFORE normalize runs — normalizeWorldBible
  // mutates its argument in place, so we'd otherwise log post-normalize
  // values under the "Raw structure" header.
  const rawSnapshot = (() => {
    const r = (parsed ?? {}) as Record<string, unknown>;
    const sr = r.starting_region as Record<string, unknown> | undefined;
    const rootLocs = r.locations;
    return {
      topLevelKeys:        Object.keys(r),
      startingRegionType:  typeof sr,
      startingRegionKeys:  Object.keys(sr ?? {}),
      hasLocationsAtRoot:  Array.isArray(rootLocs),
      hasNpcsAtRoot:       Array.isArray(r.npcs),
      rootLocationsCount:  Array.isArray(rootLocs) ? rootLocs.length : 0,
    };
  })();
  console.log("[WorldBible] Raw structure:", JSON.stringify(rawSnapshot));

  // Normalize before validation — maps AI field-name variants to the
  // canonical schema and fills missing mechanical fields with defaults.
  const normalized       = normalizeWorldBible(parsed);
  const normalizedRecord = (normalized ?? {}) as Record<string, unknown>;
  const normalizedSr     = normalizedRecord.starting_region as Record<string, unknown> | undefined;
  const normalizedLocs   = Array.isArray(normalizedSr?.locations)
    ? (normalizedSr!.locations as unknown[])
    : null;

  // Debug: log the post-normalization shape so we can see whether the
  // various restructure paths actually landed locations / npcs in the
  // canonical place before validateBible runs.
  console.log("[WorldBible] After normalization:", JSON.stringify({
    hasStartingRegion: !!normalizedSr,
    locationsType:     typeof normalizedSr?.locations,
    locationsIsArray:  normalizedLocs !== null,
    locationsLength:   normalizedLocs !== null ? normalizedLocs.length : "N/A",
    startingRegionKeys: Object.keys(normalizedSr ?? {}),
  }));

  const validated = validateBible(normalized);
  if (!validated.ok) {
    const sr = normalizedSr;
    return NextResponse.json(
      {
        error: `WorldBible validation failed: ${validated.error}`,
        debug: {
          topLevelKeys:       Object.keys(normalizedRecord),
          startingRegionKeys: Object.keys(sr ?? {}),
          locationsType:      typeof sr?.locations,
          locationsValue:     JSON.stringify(sr?.locations)?.substring(0, 200),
        },
      },
      { status: 400 }
    );
  }

  const bible: WorldBible = {
    ...validated.bible,
    generated_at: validated.bible.generated_at || new Date().toISOString(),
  };

  console.log(
    `[WorldBible] Generated: ${bible.starting_region.name}, ` +
    `${bible.starting_region.locations.length} locations, ` +
    `${bible.starting_region.npcs.length} NPCs.`
  );
  return NextResponse.json({ bible });
}
