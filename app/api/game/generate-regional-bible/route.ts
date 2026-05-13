import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Genre } from "@/types/game";
import type {
  RegionBible,
  RegionExit,
  RegionOutline,
  WorldConsistencyDocument,
} from "@/types/game";
import { formatWcdBlock } from "@/lib/game/prompt-builder";

// Audit Issue E fix: lift the function timeout to 5 minutes (Vercel
// caps at 300s for Pro). Default 10s/60s budgets weren't enough for
// the 3000-token sonnet response. Combined with the smaller skeleton
// below, this should land in <60s for most regions.
export const maxDuration = 300;
export const dynamic     = "force-dynamic";

/**
 * Day 19D — Generate a Regional Bible (Layer 2 of world generation).
 *
 * Fired when the player approaches a region the WorldBible only sketched.
 * Takes the original RegionOutline (from world_bible.adjacent_regions),
 * the WCD, and a list of already-existing region names; produces a full
 * RegionBible with named locations, real-name NPCs, Tier 1 objects, and
 * exits — ready to be applied via /api/game/apply-regional-bible.
 *
 * One retry on parse failure. Validation enforces minimum array sizes
 * and the presence of a settlement node.
 */

interface RequestBody {
  session_id?:            string;
  outline?:               RegionOutline;
  origin_region_name?:    string;
  direction_from_origin?: string;
  genre?:                 Genre;
  wcd?:                   WorldConsistencyDocument;
  existing_region_names?: string[];
  /** Day 23B — Active floating breadcrumb to seed in this region if a
   *  plausible anchor exists. Caller (useGameLoop) supplies the first
   *  unanchored act-2 / act-3 breadcrumb from quest_threads. When
   *  undefined, the ACTIVE QUEST CONTEXT block is omitted and the bible
   *  generates without quest seeding. */
  floating_breadcrumb?: {
    id:          string;
    act:         1 | 2 | 3 | "climax";
    content:     string;
    anchor_type: "fixed" | "floating";
  };
}

const SYSTEM_PROMPT =
  "You are a world-building engine for a procedurally generated RPG. " +
  "Expand the provided region outline into a full Regional Bible. All " +
  "content must be consistent with the World Consistency Document. " +
  "Respond ONLY with valid JSON. No markdown, no code fences, no " +
  "explanation.";

const OPPOSITE: Record<string, string> = {
  north:     "south",
  south:     "north",
  east:      "west",
  west:      "east",
  northeast: "southwest",
  southwest: "northeast",
  northwest: "southeast",
  southeast: "northwest",
};

function buildUserPrompt(
  genre:               Genre,
  outline:             RegionOutline,
  originRegionName:    string,
  directionFromOrigin: string,
  wcd:                 WorldConsistencyDocument,
  existingNames:       string[],
  floatingBreadcrumb?: NonNullable<RequestBody["floating_breadcrumb"]>,
): string {
  const wcdBlock = formatWcdBlock(wcd);
  const opposite = OPPOSITE[directionFromOrigin.toLowerCase()] ?? "the opposite direction";
  void existingNames;
  void genre;

  // Day 23B — Active quest context block. When the caller supplies a
  // floating breadcrumb that hasn't yet been anchored, the bible is
  // asked to embed it naturally (NPC dialogue, dungeon lore object, or
  // landmark atmosphere) and mark the carrier with quest_breadcrumb_id
  // so apply-regional-bible can stamp anchor_location_id afterward.
  // Omitted entirely when no floating breadcrumb is supplied — most
  // expansions land that way (Act 1 fixed at world gen, climax fixed at
  // 23C, and acts 2+3 only float ONCE each before they're anchored).
  const questContextBlock = floatingBreadcrumb
    ? [
        "═══════════════════════════════════════════════════════════════",
        "ACTIVE QUEST CONTEXT (Day 23B)",
        "═══════════════════════════════════════════════════════════════",
        "The world has an ongoing main quest. If this region contains a",
        "plausible anchor for the following breadcrumb (an NPC who would",
        "know, a dungeon with relevant history, a lore site), embed it",
        "naturally. If not eligible, do not force it.",
        "",
        `Floating breadcrumb to seed (id "${floatingBreadcrumb.id}", act ${floatingBreadcrumb.act}):`,
        `  "${floatingBreadcrumb.content}"`,
        "",
        "Guidelines:",
        "  - If seeding via NPC: give that NPC dialogue or knowledge that",
        "    hints at the breadcrumb content WITHOUT stating it explicitly.",
        `    Mark the NPC with: "quest_breadcrumb_id": "${floatingBreadcrumb.id}"`,
        "    in the RegionBible output.",
        "  - If seeding via dungeon lore: add (or repurpose) a LORE object",
        "    inside one of the dungeon rooms whose description reflects the",
        `    breadcrumb. Mark the object with "quest_breadcrumb_id": "${floatingBreadcrumb.id}".`,
        "  - If seeding via landmark: add it to the landmark's atmosphere or",
        "    a lore object there.",
        "  - Never seed more than 1 floating breadcrumb per region.",
        "  - If none of the region's content can plausibly carry the",
        "    breadcrumb, simply omit the quest_breadcrumb_id field — the",
        "    breadcrumb stays floating and the next region gets a chance.",
        "═══════════════════════════════════════════════════════════════",
      ].join("\n")
    : "";

  // Day 20.4.3 Region Expansion Hotfix — the LLM template previously
  // hardcoded `locations[0].id = outline.id`, which forced the bible
  // to collapse region.id and settlement.id into the same string.
  // apply-regional-bible then treated the collapsed node as if it
  // were a legacy single-tier "region == settlement" bible, producing
  // a single graph node with the SETTLEMENT's name being shown as
  // the region. This mirrors the V8.39 lesson (rule 65): prompt
  // template hardcoding forces a structural misalignment that
  // downstream "defensive" code accommodates instead of rejecting.
  //
  // Fix: generate a distinct settlement_slug so the bible carries
  // separate region_id (outline.id) and settlement_id. The
  // apply-regional-bible route also splits any legacy/cached bibles
  // that still arrive with the collapsed shape (in-place repair).
  const originRegionId = originRegionName.toLowerCase().replace(/[^a-z0-9]+/g, "_");
  const settlementSlug = `${outline.id}_settlement`;
  const subSlug        = `${settlementSlug}_inn`;
  const regionLocSlug  = `${outline.id}_point`;
  const npc1Slug       = `${outline.id}_npc1`;
  const npc2Slug       = `${outline.id}_npc2`;
  const npc3Slug       = `${outline.id}_npc3`;
  const obj1Slug       = `${outline.id}_obj1`;
  const obj2Slug       = `${outline.id}_obj2`;
  const obj3Slug       = `${outline.id}_obj3`;
  const obj4Slug       = `${outline.id}_obj4`;
  // V8.54 (Day 23A) — region_location objects[] is now empty (the dungeon
  // schema moved them into dungeon_rooms[]). obj5/obj6 slugs that previously
  // seeded those object ids are no longer referenced. Dropped to satisfy
  // no-unused-vars; if future region_locations regain objects, regenerate
  // these slugs alongside.

  return `${wcdBlock}${questContextBlock ? "\n\n" + questContextBlock : ""}

Expand this region outline into a RegionBible JSON.
Region: ${JSON.stringify(outline)}
Arriving from: ${originRegionName} to the ${directionFromOrigin}

CONTENT REQUIREMENT — EVERY LOCATION MUST HAVE PURPOSE:
Every location in this region must give the player a reason
to visit. Requirements:
- Settlement sub-location: must have 1-2 NPCs and 2 Tier 1 objects
- Standalone region location (dungeon/wilderness): must have
  AT LEAST 1 NPC and 2 Tier 1 interactable objects
- An empty location with no NPCs and no objects is NOT acceptable
- Objects must be genuinely interesting (not just 'a rock' or
  'some dirt') — give them lore relevance or mystery
- The NPC at a standalone location should have a reason for
  being there (explorer, guard, cultist, hermit, etc.)

REGION vs SETTLEMENT IDS — read carefully (Day 20.4.3):
- The "id" field is the GEOGRAPHIC REGION slug. It MUST equal "${outline.id}".
- The "settlement_id" field is the SETTLEMENT slug. It MUST equal
  "${settlementSlug}" and MUST be DIFFERENT from the region id.
- locations[0].id (the settlement location) MUST equal
  "${settlementSlug}", NOT "${outline.id}".
- The "name" field is the REGION's landscape name (already chosen — use
  "${outline.name}").
- locations[0].name is the SETTLEMENT/HUB display name (you
  choose this — a public gathering space inside the region).
- The region and the settlement are TWO DIFFERENT things in TWO
  DIFFERENT graph nodes. Do not collapse them.

Return EXACTLY this structure (fill with creative content
consistent with the WCD):
{
  "id": "${outline.id}",
  "name": "${outline.name}",
  "type": "${outline.type}",
  "settlement_id": "${settlementSlug}",
  "settlement_name": "[Hub Name — also the value of locations[0].name]",
  "grid_centre": ${JSON.stringify(outline.grid_centre)},
  "grid_radius": 3,
  "atmosphere": "[2 sentences, consistent with WCD]",
  "controlling_faction": ${outline.controlling_faction ? `"${outline.controlling_faction}"` : "null"},
  "locations": [
    {
      "id": "${settlementSlug}",
      "name": "[Hub Name — a public gathering space, NOT a building]",
      "type": "settlement",
      "is_settlement_node": true,
      "is_interior": false,
      "atmosphere": "[2 sentences]",
      "grid_position": ${JSON.stringify(outline.grid_centre)},
      "connections": ["${subSlug}"],
      "npc_ids": [],
      "objects": [
        {
          "id": "${obj1Slug}",
          "name": "[Exact Object Name with lore weight]",
          "description": "[1 sentence — hint at history or mystery]",
          "is_interactable": true
        },
        {
          "id": "${obj2Slug}",
          "name": "[Exact Object Name with lore weight]",
          "description": "[1 sentence — hint at history or mystery]",
          "is_interactable": true
        }
      ],
      "ambient_type": "town_square"
    },
    {
      "id": "${subSlug}",
      "name": "[Sub-location Name]",
      "type": "tavern",
      "is_settlement_node": false,
      "is_interior": true,
      "parent_location_id": "${settlementSlug}",
      "atmosphere": "[2 sentences]",
      "grid_position": {"x": ${outline.grid_centre.x - 1}, "y": ${outline.grid_centre.y}},
      "connections": ["${settlementSlug}"],
      "npc_ids": ["character_${npc1Slug}", "character_${npc2Slug}"],
      "objects": [
        {
          "id": "${obj3Slug}",
          "name": "[Exact Object Name with lore weight]",
          "description": "[1 sentence — hint at history or mystery]",
          "is_interactable": true
        },
        {
          "id": "${obj4Slug}",
          "name": "[Exact Object Name with lore weight]",
          "description": "[1 sentence — hint at history or mystery]",
          "is_interactable": true
        }
      ],
      "ambient_type": "tavern_common_room"
    }
  ],
  "npcs": [
    {
      "id": "character_${npc1Slug}",
      "name": "[Full Real Name]",
      "home_location_id": "${subSlug}",
      "role": "innkeeper",
      "personality": "[1 sentence]",
      "knowledge": [{"topic": "[3-5 word label]", "content": "[Full WCD-consistent sentence]"}],
      "default_trust": 50,
      "quest_hook": true,
      "quest_seed": "[1 sentence describing what this NPC needs or is waiting for — embed it in their situation. GOOD: 'She's been waiting three weeks for a shipment of medicines that never arrived from the eastern pass.' BAD: 'She wants the player to retrieve medicines.']"
    },
    {
      "id": "character_${npc2Slug}",
      "name": "[Full Real Name]",
      "home_location_id": "${subSlug}",
      "role": "patron",
      "personality": "[1 sentence]",
      "knowledge": [{"topic": "[3-5 word label]", "content": "[Full WCD-consistent sentence]"}],
      "default_trust": 50
    },
    {
      "id": "character_${npc3Slug}",
      "name": "[Full Real Name]",
      "home_location_id": "${regionLocSlug}",
      "role": "explorer",
      "personality": "[1 sentence — give them a reason to be at this remote spot]",
      "knowledge": [{"topic": "[3-5 word label]", "content": "[WCD-consistent fact specific to this site]"}],
      "default_trust": 50,
      "quest_hook": true,
      "quest_seed": "[1 sentence describing the situation that needs help — written as a problem in their world, not a quest. The remoteness of the location should inform what they need.]"
    }
  ],
  "region_locations": [
    {
      "id": "${regionLocSlug}",
      "name": "[Standalone dungeon name]",
      "type": "dungeon",
      "node_type": "dungeon",
      "is_settlement_node": false,
      "is_interior": false,
      "atmosphere": "[1 sentence — the dungeon's exterior and history]",
      "grid_position": {"x": ${outline.grid_centre.x + 1}, "y": ${outline.grid_centre.y}},
      "connections": ["${settlementSlug}"],
      "npc_ids": ["character_${npc3Slug}"],
      "objects": [],
      "ambient_type": "dungeon_corridor",
      "encounter_chance": 0.6,
      "encounter_roster": ["fantasy_skeleton", "${outline.id}_themed_enemy_id"],
      "is_boss_room": false,
      "dungeon_rooms": [
        {
          "id": "${regionLocSlug}_entrance",
          "name": "[Entrance Room Name]",
          "description": "[1-2 sentences. Establishes the dungeon identity.]",
          "room_type": "entrance",
          "connections": ["${regionLocSlug}_middle"],
          "encounter_chance": 0.5,
          "objects": [
            {"id": "${regionLocSlug}_entrance_chest", "name": "[Container Name]", "description": "[1 sentence]", "is_interactable": true, "type": "container"},
            {"id": "${regionLocSlug}_entrance_lore", "name": "[Lore Object Name]", "description": "[1 sentence — foreshadows the boss lock]", "is_interactable": true, "type": "lore"}
          ]
        },
        {
          "id": "${regionLocSlug}_middle",
          "name": "[Middle Chamber Name]",
          "description": "[1-2 sentences. The chamber that hides the key.]",
          "room_type": "middle",
          "connections": ["${regionLocSlug}_entrance", "${regionLocSlug}_boss"],
          "encounter_chance": 0.7,
          "objects": [
            {"id": "${regionLocSlug}_middle_chest", "name": "[Container Name]", "description": "[1 sentence]", "is_interactable": true, "type": "container"},
            {"id": "${regionLocSlug}_middle_key_object", "name": "[Story-Named Key Object Name]", "description": "[1 sentence — where the key item rests]", "is_interactable": true, "type": "container", "is_key_item": true, "unlocks_node": "${regionLocSlug}_boss"}
          ]
        },
        {
          "id": "${regionLocSlug}_boss",
          "name": "[Boss Chamber Name]",
          "description": "[1-2 sentences. The climactic chamber.]",
          "room_type": "boss",
          "connections": ["${regionLocSlug}_middle"],
          "encounter_chance": 1.0,
          "objects": [],
          "lock": {
            "type": "key",
            "hint": "[1-2 sentences describing the sealed door + the KIND of object that would open it (a seal, a key, a token, a glyph). NEVER name the key object directly — the player must discover its name by finding it. GOOD: 'A ceremonial lock shaped to receive an official seal of office.' BAD: 'Requires the Warden's Seal.']",
            "key_item_id": "${regionLocSlug}_middle_key_object",
            "key_item_name": "[Story-Named Key Object Name]",
            "unlocked": false
          }
        }
      ]
    },
    {
      "id": "${outline.id}_landmark",
      "name": "[Standalone landmark name — a ruin / shrine / overlook, NOT a dungeon]",
      "type": "wilderness",
      "node_type": "landmark",
      "is_settlement_node": false,
      "is_interior": false,
      "atmosphere": "[1-2 sentences describing this lore-rich site]",
      "grid_position": {"x": ${outline.grid_centre.x - 2}, "y": ${outline.grid_centre.y + 1}},
      "connections": ["${settlementSlug}"],
      "npc_ids": [],
      "objects": [
        {"id": "${outline.id}_landmark_lore", "name": "[Tier 1 Lore Object]", "description": "[1 sentence]", "is_interactable": true, "type": "lore"}
      ],
      "ambient_type": "open_ruins",
      "encounter_chance": 0.1
    }
  ],
  "exits": [
    {
      "direction": "${opposite}",
      "target_region_id": "${originRegionId}",
      "from_location_id": "${settlementSlug}",
      "description": "[1 sentence]"
    }
  ],
  "enemies": [
    {
      "id": "${outline.id}_themed_enemy_id",
      "name": "[Themed Enemy Name]",
      "hp_range": [9, 14],
      "agi_mod": 1,
      "str_mod": 1,
      "damage_die": "1d8",
      "armor_bonus": 1,
      "xp_value": 55,
      "loot_table_id": "${outline.id}_themed_enemy_id_loot",
      "is_boss": false,
      "behavior_flavor": "[1-3 word phrase]"
    }
  ],
  "region_loot_items": [
    {
      "id": "${outline.id}_item_slug",
      "name": "[Item Name]",
      "type": "CONSUMABLE|VALUABLE|LORE|WEAPON|ARMOR",
      "rarity": "COMMON|UNCOMMON",
      "description": "[1 sentence — item specific to this region].",
      "effect": {},
      "quantity": 1,
      "stackable": false,
      "value": 15
    }
  ],
  "boss_drop_item": {
    "id": "${outline.id}_boss_trophy",
    "name": "[Unique Boss Item Name]",
    "type": "WEAPON|ARMOR",
    "rarity": "RARE",
    "description": "[1 sentence — this item's significance in the region].",
    "effect": { "damage_die": "1d10" },
    "quantity": 1,
    "stackable": false,
    "value": 250
  }
}

Make everything original and consistent with the WCD.
Real names for all NPCs. No placeholders.

REGION_LOCATIONS COUNT GUIDANCE (V8.54 — match outline.region_type):
The region_locations array MUST hold 2-4 standalone nodes alongside
the settlement. Mix by region_type:
  settled  — 1 dungeon + 1-2 of {landmark, wilderness, outpost}  → 2-3 total
  frontier — 1-2 dungeons + 1-2 of {wilderness, landmark}        → 2-4 total
  hostile  — 2-3 dungeons + 1-2 of {landmark, abandoned}         → 3-4 total
            (hostile regions have NO settlement; locations[] is
            still required for navigation but settlement_id may
            point at a structural-only outpost entry.)
Each region_location is a STANDALONE node in the geographic area
(dungeon / landmark / wilderness / outpost / abandoned_settlement)
— NOT inside the settlement. Connect each to the settlement hub.
Dungeons MUST have an NPC with a believable reason to be there,
plus 2 evocative Tier 1 objects.

DUNGEON ROOMS — every node_type "dungeon" in region_locations MUST
include a 3-entry dungeon_rooms array (entrance → middle → boss)
following the skeleton above. A dungeon without dungeon_rooms is
incomplete and will be rejected client-side.

NPC KNOWLEDGE FORMAT (Architecture C): every NPC's "knowledge"
array must be objects of shape {topic, content}. The topic is a
3-5 word button label the player sees ("The cult below",
"Roads east"); content is the full WCD-consistent sentence the
NPC reveals on a passed stat check. Generate 1-2 entries per NPC.
Do NOT emit plain strings — always {topic, content}.

DAY 23D — SIDE QUEST HOOKS (V8.66):
Of the 3 NPCs you generate, 1-2 should carry quest_hook: true with
a quest_seed sentence. The skeleton shows npc1 (innkeeper, in the
settlement) and npc3 (explorer, at the standalone region location)
as the hook carriers — keep that pattern but write seeds that
fit each NPC's situation.

Seed rules (rule 116):
  - 1 sentence describing what they NEED or are WAITING for.
  - Written as a SITUATION embedded in their life, NOT a mission.
    GOOD: "He has been searching for his sister's grave for two
           seasons and is convinced it lies somewhere in the
           barrow north of here."
    BAD:  "He wants the player to find his sister's grave."
  - The seed must feel native to the region. A settlement
    innkeeper's seed differs from a remote-explorer's seed.
  - DO NOT mention "the player" or "you" in the seed.

The seed is the GENERATOR's input — a separate
/api/game/generate-side-quests call expands it into a full
SideQuest object with title, objective, completion_condition,
and reward_hint. Keep the seed tight and evocative; the
generator handles the rest.

Non-quest NPCs (npc2 in the skeleton): omit quest_hook and
quest_seed entirely. Do not include them as false / null.

DAY 20 COMBAT — REGION ENEMIES & ENCOUNTER TAGGING:

The "enemies" array must contain 3-5 region-themed enemies that
thematically fit the WCD flavor and the region's atmosphere.
Constraints:
- 3-5 entries with UNIQUE ids prefixed with the region id
  (e.g. "${outline.id}_husk_warden")
- hp_range: [min, max] — see ENEMY STAT BUDGET BY REGION TIER below
- agi_mod and str_mod: integers (range bounded by tier — see below)
- armor_bonus: integer between 0 and 3
- damage_die: one of "1d4", "1d6", "1d8", "1d10", "2d4", "2d6", "2d8"
- xp_value: integer between 25 and 1000 scaled to difficulty
- behavior_flavor: 1-3 word phrase
- is_boss: false unless this enemy IS a region-tied boss
- loot_table_id: stub of form "<enemy_id>_loot"

ENEMY STAT BUDGET BY REGION TIER (V8.51 — calibrated for the 2-10
player stat scale, NOT the D&D 1-20 scale):

Player modifier formula: floor((stat - 2) / 2). Stat 4 = +1 mod.
Target DC = 10 + enemy.agi_mod + enemy.armor_bonus.

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

Pick the tier that matches this region's position in the world.
A region adjacent to the starting hub uses the "first expansion"
budget; a region two hops out uses the "deep region" budget.
NEVER generate starting-tier enemies with:
  - agi_mod above 1
  - hp_range minimum above 8
  - damage_die larger than "1d6"

ENCOUNTER TAGGING for combat-eligible region_locations:
The standalone region_location IS combat-eligible. It MUST carry:
- encounter_chance: 0.4-0.7 for normal areas, 1.0 for boss rooms,
  0.0 for peaceful sites
- encounter_roster: 2-4 enemy ids drawn from this region's enemies
  array AND/OR the genre bestiary (e.g. "fantasy_skeleton",
  "fantasy_cultist"). Mix region-specific and bestiary entries.
- is_boss_room: true only for the climactic location of a boss

The settlement hub and tavern sub-location are NOT combat-eligible
— omit encounter_chance/encounter_roster on those (or set chance
to 0).

DAY 23A — LOCATION VARIETY & DUNGEON STRUCTURE (region_type "${outline.region_type ?? "settled"}")

Every node MUST carry a "node_type" from this fixed set:
  • settlement_hub | outpost | wilderness | dungeon | landmark
  • abandoned_settlement

NODE_TYPE ASSIGNMENT — CRITICAL:
  • ONLY the location where is_settlement_node: true receives
    node_type: "settlement_hub". Exactly one entry in locations[]
    carries both flags.
  • ALL sub-locations inside the settlement (tavern, inn, shop,
    smithy, shrine) MUST NOT have node_type set — OMIT the field.
    Their nav-card label derives from their "type" field instead.
  • EVERY entry in region_locations gets node_type set to one of
    {dungeon, landmark, wilderness, outpost, abandoned_settlement}
    matching the location's character.

Pre-fix bug: setting node_type: "settlement_hub" on sub-locations
collapses every sub-location's nav card label to "SETTLEMENT".

REGION TYPE GUIDANCE — match this region's mix:
  settled   — 1 settlement_hub + 1-2 dungeons + 1-2 landmark/wilderness
  frontier  — 0-1 outposts + 1-2 dungeons + 1-2 wilderness/landmarks
  hostile   — 0 settlements + 2-3 dungeons + 1-2 landmarks/abandoned
              All non-dungeon nodes encounter_chance ≥ 0.3

DUNGEON STRUCTURE (mandatory for every "node_type: dungeon" node):
The dungeon location MUST carry a "dungeon_rooms" array of EXACTLY
3 entries — entrance → middle → boss — following the skeleton shown
above. Required fields per room: id, name, description (1-2 sent),
room_type, connections (room ids), encounter_chance, objects[].

Room 1 entrance — encounter_chance 0.5; ≥1 object type "container";
optional 1 "lore" object foreshadowing the boss lock.
Room 2 middle  — encounter_chance 0.7; ≥1 "container" PLUS a named
story key-object with is_interactable: true, type: "container",
is_key_item: true, unlocks_node: "{dungeon_id}_boss". The key-object
name must be specific to the dungeon (e.g. "The Warden's Seal",
"The Cracked Signet Ring") — never a generic "iron key".
Room 3 boss    — encounter_chance 1.0; objects: []; lock object with
type "key", key_item_id matching the middle-room key object id,
key_item_name matching its name, unlocked: false. The lock's HINT
must describe the door + the KIND of object that opens it (a seal,
a key, a token, a glyph) WITHOUT naming the key object directly.
The player should discover the key item's name by finding it, not
by reading the lock hint. GOOD: "A ceremonial lock shaped to
receive an official seal of office." BAD: "Requires the Warden's
Seal."

DAY 23A — LOOT CONTEXT GUIDANCE
Dungeon / combat drop tables: weapons, armor, valuables, healing
consumables, rare RARE artifacts. NEVER generate food / ration
items in dungeon loot or enemy drops — food belongs in
settlement/outpost containers and merchant inventories only.

DAY 21 LOOT — REGION LOOT ITEMS:

Generate 3-5 region_loot_items specific to this region — items
found here and nowhere else. They should feel native to the
region's atmosphere (a salt-plains region drops salt-crusted
relics; a rust-peaks region drops corroded oddities).

Mix of rarities: mostly COMMON, some UNCOMMON. Vary types:
CONSUMABLE, VALUABLE, LORE — and optionally one WEAPON or one
ARMOR scoped to this region's theme. Item id format:
"${outline.id}_<item_slug>".

Stat fields by type:
- WEAPON: effect: { "damage_die": "1d4"|"1d6"|"1d8" }, value 25-100.
- ARMOR:  effect: { "armor_bonus": 1|2 }, value 15-80.
- CONSUMABLE: effect: { "heal": N } when it heals; {} for utility.
  Value 5-30. stackable: true.
- VALUABLE: effect: {}. Value 10-80. stackable: false.
- LORE:     effect: {}. Value 2-15. stackable: false.

Quantity: 1 for all template entries (resolver stamps per-drop).

DAY 21 LOOT — BOSS DROP:

Generate ONE boss_drop_item per RegionBible — the unique reward
for defeating the region's boss. Always:
- type: WEAPON or ARMOR (something the player wears or wields)
- rarity: "RARE"
- value: 200-500
- id format: "${outline.id}_boss_trophy" or similar
- description references the region / boss explicitly

OMIT boss_drop_item entirely if this region has no boss (no
enemy with is_boss=true). The field is optional.

DAY 21 LOOT — DUNGEON CONTAINER GUARANTEE:

Every region_location that's combat-eligible (dungeon /
encounter_chance > 0 / is_boss_room) MUST contain at least one
Tier 1 object with type "container" (chest, sarcophagus, offering
bowl, footlocker — pick something thematic). LocationObject gains
an optional "type" field:
- "container" — INTERACT rolls loot for the player.
- "fixture" — decorative; INTERACT returns a templated empty beat.
- "lore" — INTERACT delivers a tip; templated, no LLM call.
- "trigger" — drives a flag; reserved for future use.

Non-combat locations (settlement, tavern, market): tag
is_interactable objects as "fixture" or "lore" so INTERACT skips
the narrator and returns the templated response.

CRITICAL: Keep total response under 5500 tokens. Be concise.
Atmosphere: max 2 sentences. NPC fields: 1 sentence each.
Object descriptions: 1 short sentence. Enemy descriptions: 1
sentence. Do not elaborate beyond the template lengths shown
above.`;
}

/**
 * FIX 5 — minimal stub RegionBible returned when both Haiku attempts
 * produce unparseable JSON. The stub passes validateBible (2 locations,
 * 1 NPC, a settlement node) and includes a back-stitch exit so
 * apply-regional-bible can wire the nav bar return card. The player
 * can still enter the region; content is sparse but the game doesn't
 * hard-wall on a 500.
 */
function buildStubBible(
  outline:             RegionOutline,
  originRegionId:      string,
  originRegionName:    string,
  directionFromOrigin: string,
): RegionBible {
  const hubId  = outline.id;
  const subId  = `${outline.id}_inn`;
  const npcId  = `character_${outline.id}_npc1`;
  const opposite = OPPOSITE[directionFromOrigin.toLowerCase()] ?? "south";
  return {
    id:          outline.id,
    name:        outline.name,
    type:        outline.type,
    grid_centre: outline.grid_centre,
    grid_radius: 3,
    atmosphere:  outline.atmosphere_hint,
    locations: [
      {
        id:                 hubId,
        name:               `${outline.name} Approach`,
        type:               "settlement",
        grid_position:      outline.grid_centre,
        region_id:          outline.id,
        is_settlement_node: true,
        is_interior:        false,
        atmosphere:         outline.atmosphere_hint,
        connections:        [subId],
        npc_ids:            [],
        objects:            [],
        ambient_type:       "town_square",
      },
      {
        id:                 subId,
        name:               "Traveler's Rest",
        type:               "tavern",
        grid_position:      { x: outline.grid_centre.x - 1, y: outline.grid_centre.y },
        region_id:          outline.id,
        is_settlement_node: false,
        is_interior:        true,
        parent_location_id: hubId,
        atmosphere:         "A sparse waystation offering shelter to weary travelers.",
        connections:        [hubId],
        npc_ids:            [npcId],
        objects:            [],
        ambient_type:       "tavern_common_room",
      },
    ],
    npcs: [
      {
        id:               npcId,
        name:             "A Traveling Merchant",
        home_location_id: subId,
        role:             "traveler",
        archetype:        "wanderer",
        appearance:       "A road-worn figure with little to say.",
        personality:      "Guarded and brief.",
        speech_style:     "terse",
        knowledge: [
          { topic: "The road ahead", content: `The path from ${originRegionName} winds on through uncertain country.` },
        ],
        default_trust:    30,
      },
    ],
    region_locations: [],
    exits: [
      {
        direction:        opposite as RegionExit["direction"],
        target_region_id: originRegionId,
        from_location_id: hubId,
        description:      `The track leads back toward ${originRegionName}.`,
      },
    ],
    // Day 20 Combat — stub bible has no enemies. Encounter triggers
    // at combat-eligible nodes will fall through to the genre
    // bestiary. The region simply has no themed roster until it's
    // re-generated.
    enemies: [],
  };
}

function stripJsonFences(raw: string): string {
  return raw
    .trim()
    .replace(/^```(?:json)?\n?/i, "")
    .replace(/\n?```$/i, "")
    .trim();
}

/**
 * Day 21 — RegionBible normalization for loot + container fields.
 *
 * Runs BEFORE validateBible so the validator sees defaulted values.
 * Mutates in place (returns the same reference) for parity with how
 * the WorldBible normalization is wired.
 *
 * Adds:
 *   - region_loot_items: [] default when omitted/malformed.
 *   - boss_drop_item: left undefined when missing (optional schema).
 *   - LocationObject container promotion: same rule as
 *     normalizeLocationContainers in the WorldBible route — every
 *     combat-eligible region_location ends up with at least one
 *     type:"container" object; non-combat is_interactable objects
 *     default to "fixture".
 */
function normalizeBible(parsed: unknown): unknown {
  if (!parsed || typeof parsed !== "object") return parsed;
  const o = parsed as Record<string, unknown>;

  if (!Array.isArray(o.region_loot_items)) {
    o.region_loot_items = [];
  }

  // boss_drop_item stays as-is (optional). Drop empty-object placeholders
  // so the resolver's `if (params.boss_drop_item)` check works as expected.
  if (
    o.boss_drop_item &&
    typeof o.boss_drop_item === "object" &&
    !Array.isArray(o.boss_drop_item) &&
    Object.keys(o.boss_drop_item as Record<string, unknown>).length === 0
  ) {
    delete o.boss_drop_item;
  }

  normalizeRegionLocationContainers(o.locations);
  normalizeRegionLocationContainers(o.region_locations);

  return o;
}

/**
 * Day 21 — promote one is_interactable object to type:"container" on
 * every combat-eligible location, and stamp untagged is_interactable
 * objects as "fixture" on non-combat locations. Mirrors the
 * WorldBible route's helper.
 */
function normalizeRegionLocationContainers(locs: unknown): void {
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
    if (!isCombat) {
      for (const o of objs) {
        if (o && o.is_interactable === true && !o.type) {
          o.type = "fixture";
        }
      }
    }
  }
}

function validateBible(parsed: unknown): { ok: true; bible: RegionBible } | { ok: false; error: string } {
  if (!parsed || typeof parsed !== "object") {
    return { ok: false, error: "RegionBible is not an object" };
  }
  const o = parsed as Record<string, unknown>;

  if (typeof o.id !== "string" || !o.id.trim()) return { ok: false, error: "id missing" };
  if (typeof o.name !== "string" || !o.name.trim()) return { ok: false, error: "name missing" };
  if (!Array.isArray(o.locations) || o.locations.length < 2) {
    return {
      ok: false,
      error: `locations must have at least 2 entries (got ${Array.isArray(o.locations) ? o.locations.length : "non-array"})`,
    };
  }
  if (!Array.isArray(o.npcs) || o.npcs.length < 1) {
    return {
      ok: false,
      error: `npcs must have at least 1 entry (got ${Array.isArray(o.npcs) ? o.npcs.length : "non-array"})`,
    };
  }

  const hasSettlementNode = (o.locations as Array<Record<string, unknown>>).some(
    (l) => l && l.is_settlement_node === true
  );
  if (!hasSettlementNode) {
    return { ok: false, error: "RegionBible has no settlement_node in locations" };
  }

  return { ok: true, bible: parsed as RegionBible };
}

// V8.68 — OPT 3: max_tokens reduced 7000 → 1500 per the optimization
// audit. The stub fallback in the POST handler catches truncation;
// instrumentation surfaces output_tokens so we can see if regions
// regularly hit the cap.
const RB_MODEL      = "claude-haiku-4-5-20251001";
const RB_MAX_TOKENS = 1500;

async function callClaude(client: Anthropic, userPrompt: string): Promise<string> {
  // Architecture spec ("Model Selection"): RegionBible generation runs on
  // haiku because the outline already locks the region's identity. Quality
  // from a simpler prompt is acceptable; speed matters more here than for
  // WCD/WorldBible/narration.
  const promptTokens = Math.ceil((SYSTEM_PROMPT.length + userPrompt.length) / 4);
  console.log(
    `[GEN_TIMING] generate-regional-bible start — model: ${RB_MODEL}, prompt_tokens: ${promptTokens}`
  );
  const startedAt = Date.now();
  const message = await client.messages.create({
    model:      RB_MODEL,
    max_tokens: RB_MAX_TOKENS,
    system:     SYSTEM_PROMPT,
    messages:   [{ role: "user", content: userPrompt }],
  });
  const text = message.content[0]?.type === "text" ? message.content[0].text : "";
  const outputTokens = message.usage?.output_tokens ?? Math.ceil(text.length / 4);
  const elapsed = Date.now() - startedAt;
  console.log(
    `[GEN_TIMING] generate-regional-bible complete — elapsed: ${elapsed}ms, output_tokens: ${outputTokens}`
  );
  return text;
}

export async function POST(request: NextRequest) {
  console.log("[GEN_TIMING] generate-regional-bible called");
  console.log(`[GEN_TIMING] generate-regional-bible max_tokens reduced to ${RB_MAX_TOKENS}`);
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

  const {
    session_id,
    outline,
    origin_region_name,
    direction_from_origin,
    genre,
    wcd,
    existing_region_names,
    floating_breadcrumb,
  } = body;

  if (!session_id || !outline || !origin_region_name || !direction_from_origin || !genre || !wcd) {
    return NextResponse.json(
      { error: "Missing required fields: session_id, outline, origin_region_name, direction_from_origin, genre, wcd" },
      { status: 400 }
    );
  }
  if (!Object.values(Genre).includes(genre)) {
    return NextResponse.json({ error: "Invalid genre" }, { status: 400 });
  }

  const existing = Array.isArray(existing_region_names) ? existing_region_names : [];
  if (floating_breadcrumb) {
    console.log(
      `[RegionBible] Seeding floating breadcrumb ${floating_breadcrumb.id} (act ${floating_breadcrumb.act}) into ${outline.name}.`
    );
  }
  const userPrompt = buildUserPrompt(
    genre, outline, origin_region_name, direction_from_origin, wcd, existing, floating_breadcrumb,
  );

  // Per-request client so the API key is read fresh each call.
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  let parsed: unknown;
  let parseError = "";
  try {
    const rawText = await callClaude(anthropic, userPrompt);
    try {
      parsed = JSON.parse(stripJsonFences(rawText));
    } catch (err) {
      parseError = err instanceof Error ? err.message : "JSON parse failed";
      const retryPrompt = userPrompt + "\n\nReturn ONLY the JSON object, nothing else. No markdown.";
      const retryRaw = await callClaude(anthropic, retryPrompt);
      try {
        parsed = JSON.parse(stripJsonFences(retryRaw));
      } catch (retryErr) {
        const retryParseErr = retryErr instanceof Error ? retryErr.message : "JSON parse failed (retry)";
        // FIX 5 — surface parse errors in logs for diagnostics, then
        // return a minimal stub RegionBible (200) instead of 500. The
        // player can still enter the region; content is sparse but the
        // game doesn't hard-wall. A warning tag lets us grep for stub
        // incidents to investigate the truncation root cause later.
        console.error("[RegionBible] JSON parse failed after retry.", {
          first:        parseError,
          retry:        retryParseErr,
          regionId:     outline?.id,
          regionName:   outline?.name,
        });
        const originRegionId = (origin_region_name ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "_");
        const stubBible = buildStubBible(
          outline!,
          originRegionId,
          origin_region_name ?? "the origin region",
          direction_from_origin ?? "south"
        );
        console.warn(
          `[RegionBible] Returning stub fallback for ${outline?.name} (${outline?.id}). ` +
          "Full content will be unavailable until the region is re-generated."
        );
        return NextResponse.json({ bible: stubBible, stub: true });
      }
    }
  } catch (err) {
    // FIX 1 — same diagnostic for an Anthropic-level failure (network,
    // rate limit, etc.) so server logs show the actual exception instead
    // of just the swallowed message.
    console.error("[RegionBible] Anthropic call failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Anthropic call failed" },
      { status: 500 }
    );
  }

  // Day 21 — normalize loot defaults + container tags before validation.
  parsed = normalizeBible(parsed);

  const validated = validateBible(parsed);
  if (!validated.ok) {
    return NextResponse.json(
      { error: `RegionBible validation failed: ${validated.error}` },
      { status: 400 }
    );
  }

  const bible = validated.bible;

  console.log(
    `[RegionBible] Generated: ${bible.name}, ` +
    `${bible.locations.length} locations, ` +
    `${bible.npcs.length} NPCs.`
  );
  return NextResponse.json({ bible });
}
