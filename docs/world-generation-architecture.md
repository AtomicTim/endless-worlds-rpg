# World Generation Architecture

## Overview

The world generation system uses a two-phase AI generation approach that separates creative world-building (AI-heavy, happens once) from live narration (AI as pure storyteller). This ensures each playthrough is genuinely unique while maintaining full consistency within each world.

---

## The Four Layers

### Layer 0 — World Consistency Document (WCD)
Generated once at game start. Never modified. Injected into every AI call that touches world generation or narration. This is the constitution of the world — the laws that govern everything.

### Layer 1 — World Bible (Phase 1)
Generated at game start before the player's first action. Covers the starting region in full detail plus structural outlines of adjacent regions.

### Layer 2 — Regional Bible (Phase 2)
Generated on first approach to a new region. Expands the Layer 1 outline into full detail. Constrained by the WCD.

### Layer 3 — Narrator
Receives WCD + relevant bible sections as locked facts. Describes only. Never generates assets. Never names things. Never invents interactable objects.

---

## Layer 0: World Consistency Document (WCD)

The WCD is a compact JSON object stored in `game_sessions.world_consistency`. It is injected as the FIRST block in every generation and narration prompt under the header:

```
═══ WORLD CONSISTENCY DOCUMENT — THESE ARE ABSOLUTE FACTS ═══
You must never contradict anything in this document.
All NPCs, narrators, and generators must treat these as ground truth.
═══════════════════════════════════════════════════════════════
```

### WCD Structure

```typescript
interface WorldConsistencyDocument {
  // Core identity
  world_name: string              // e.g. "The Ashfall Reaches"
  world_tagline: string           // e.g. "Where empires die and the desperate survive"
  atmosphere: string              // 1-2 sentences of tonal/atmospheric truth

  // Geography — the landmarks every inhabitant knows
  landmarks: WorldLandmark[]

  // Factions — organisations every inhabitant has heard of
  factions: WorldFaction[]

  // World rules — universal truths of this world
  world_rules: string[]           // e.g. "Iron is scarce — most weapons are glass or bone"

  // Grid bounds
  grid_size: number               // Total grid width/height (e.g. 40 = 40x40 grid)
  world_origin: { x: number, y: number }  // Starting region centre (typically {x:0,y:0})
}

interface WorldLandmark {
  id: string                      // Normalized slug
  name: string                    // Real name — e.g. "The Obsidian Throne"
  type: 'settlement' | 'stronghold' | 'wilderness' | 'dungeon' | 'ruin' | 'geographic'
  grid_position: { x: number, y: number }  // Approximate grid position
  known_by: 'everyone' | 'locals' | 'scholars'  // How widely known
  public_description: string      // What common folk know/say about it — 1-2 sentences
  is_region_origin: boolean       // True if this is where a region is centred
  region_id?: string              // Which region this belongs to
}

interface WorldFaction {
  id: string
  name: string
  territory: string               // e.g. "controls the northern forests"
  public_reputation: string       // What most people think of them — 1 sentence
  disposition_to_player: 'allied' | 'neutral' | 'hostile' | 'unknown'
}
```

### WCD Generation Prompt

The WCD is generated first, separately from the world bible, in a fast focused call. Prompt:

```
You are generating the world constitution for a [GENRE] RPG.
Character: [NAME], a [CLASS].
Additional context: [CREATION_CHOICES]

Generate a World Consistency Document. This document defines the
absolute facts of this world that will never change. Every NPC,
location, and narrator must be consistent with these facts.

Requirements:
- 1 atmospheric world name and tagline
- 4-6 major landmarks (things every inhabitant has heard of)
  including: 1 distant evil/danger to the north or northeast,
  1 natural geographic feature, 1 major settlement or trade hub,
  1 mysterious or legendary place
- 3-4 factions with clear territories and public reputations
- 5-8 world rules (universal truths — scarcity, weather, magic rules,
  cultural norms, dangers)
- Grid size: 40 (world spans -20 to +20 on both axes)
- Place landmarks at logical grid positions:
  Starting region at (0,0). Nearby landmarks 5-10 units away.
  Distant landmarks 15-20 units away.

Respond ONLY with valid JSON. No markdown, no explanation.
```

---

## Layer 1: World Bible (Phase 1)

Generated after the WCD, using the WCD as context. Covers the starting region in full + structural outlines of 3-5 adjacent regions.

### Location Hierarchy

A region contains **settlements** and **zones**. A settlement is a town, village, or other inhabited place. A zone is a wilderness, dungeon, or other non-settlement area.

**Within a settlement**, the game generates:
- The **settlement node** itself (the town square, main street, or entry point) — this is where the player arrives
- 3-6 **notable sub-locations** (individual buildings or areas worth entering)
- Not every building in the settlement is generated. Only places where things happen.

**Typical settlement structure (Fantasy town example):**
```
Thornwick Crossing (settlement node — arrival point)
├── Korven's Inn (tavern — social hub, 2 NPCs, 4 objects)
├── Sylanna's Glass Emporium (market — merchant, 1 NPC, 3 objects)
├── The Ashflow Forge (stronghold — blacksmith, 1 NPC, 3 objects)
├── The Warden's Post (civic — quest hook, 2 NPCs, 2 objects)
└── The Old Stone Bridge (geographic — ambient, 0 NPCs, 2 objects)
```

Non-notable buildings (baker, cobbler, residences) exist in ambient atmosphere but are not graph nodes. If the player tries to enter them the narrator gives a brief ambient response.

**Each notable sub-location has:**
- 1-3 NPCs (usually 1-2 is ideal)
- 3-6 Tier 1 landmark objects (the meaningful interactable things)
- Ambient atmosphere description

### World Bible Structure

```typescript
interface WorldBible {
  // The starting region — fully detailed
  starting_region: RegionBible

  // Adjacent regions — structural outlines only
  adjacent_regions: RegionOutline[]

  // Main quest
  main_quest: MainQuest

  // Pre-generation timestamp
  generated_at: string
}

interface RegionBible {
  id: string                      // Normalized slug
  name: string                    // Display name
  type: 'settlement_hub' | 'wilderness' | 'dungeon' | 'port' | 'ruin' | 'stronghold'
  grid_centre: { x: number, y: number }
  grid_radius: number             // How many cells this region spans (~3-5)
  atmosphere: string              // Region-specific atmosphere (must not contradict WCD)
  controlling_faction?: string    // Faction ID from WCD

  // All locations in this region — fully detailed
  // Includes the main settlement node + all notable sub-locations
  locations: LocationDefinition[]

  // All NPCs in this region — fully detailed, real names from birth
  npcs: NPCDefinition[]

  // Region-level connections to other regions
  exits: RegionExit[]
}

interface LocationDefinition {
  id: string                      // Normalized slug — permanent
  name: string                    // Display name — permanent
  type: LocationType
  grid_position: { x: number, y: number }
  region_id: string

  // Hierarchy
  is_settlement_node: boolean     // True for the main arrival point
  is_interior: boolean            // True for sub-locations within a settlement
  parent_location_id?: string     // e.g. "korven's upper room" → parent: "korvens_inn"

  // Constitution — locked on creation
  atmosphere: string              // 2-3 sentences of sensory description
  connections: string[]           // IDs of connected locations (bidirectional)

  // NPCs assigned here (IDs from this region's NPC list)
  npc_ids: string[]

  // Tier 1 objects — named, tracked, highlightable
  objects: LocationObject[]

  // Tier 2 ambient object types — code-generated from templates, not AI
  // The engine reads this list and injects standard ambient objects at runtime
  ambient_type: AmbientLocationType  // e.g. 'tavern_common_room', 'smithy', 'market_stall'
}

interface LocationObject {
  id: string
  name: string                    // EXACT name narrator must use — permanent
  description: string             // What it looks like — 1 sentence
  is_interactable: boolean        // Highlighted in feed if true
  contains_item_id?: string       // Optional item ID if it contains something
  contains_lore?: string          // Optional lore text revealed on examine
  is_locked?: boolean
  unlock_requires?: string        // Item ID needed to unlock
  quest_relevance?: boolean       // True if examining this is a quest breadcrumb
}

interface NPCDefinition {
  id: string                      // character_[slug] — permanent
  name: string                    // REAL NAME — assigned at generation, permanent
  home_location_id: string        // Where they normally are
  role: NPCRole
  archetype: string               // Brief archetype description

  // Constitution — locked on creation
  appearance: string              // 1-2 sentences
  personality: string             // 2-3 defining traits
  speech_style: string            // How they talk — e.g. "clipped and military"
  faction_id?: string             // Which faction they belong to
  knowledge: string[]             // What they know about the world (WCD-consistent)

  // Relationship to main quest
  quest_relevance?: 'key' | 'supporting' | 'none'
  knows_breadcrumb?: number       // Which breadcrumb index they can hint at

  // Merchant data (if role === merchant)
  is_merchant?: boolean
  speciality?: string             // What they sell

  // Starting trust
  default_trust: number           // 0-100

  // Map display
  map_position_offset?: { x: number, y: number }  // Small offset within their home node
}

interface RegionExit {
  direction: 'north' | 'south' | 'east' | 'west' | 'northeast' | 'northwest' | 'southeast' | 'southwest'
  target_region_id: string
  from_location_id: string        // Which location the exit is accessible from
  description: string             // What the player sees looking that way — 1 sentence
}

interface RegionOutline {
  id: string
  name: string
  type: string
  grid_centre: { x: number, y: number }
  direction_from_start: string
  distance: 'adjacent' | 'near' | 'far'
  controlling_faction?: string
  atmosphere_hint: string         // 1 sentence
  key_npc_count: number
  location_count: number          // Notable sub-locations to generate
  landmark_id?: string            // If this region contains a WCD landmark
}

interface MainQuest {
  title: string                   // Internal only
  antagonist_name: string
  antagonist_location: string     // Region/location ID
  antagonist_faction?: string
  goal: string
  opening_hook: string            // The first hint planted in the starting scene
  breadcrumbs: QuestBreadcrumb[]  // Exactly 5
  win_condition: string
}

interface QuestBreadcrumb {
  index: number                   // 0-4
  content: string                 // The actual hint/discovery
  delivery_method: 'npc_dialogue' | 'discovered_object' | 'environmental' | 'overheard'
  suggested_location: string
  npc_id?: string
  object_id?: string              // If delivery_method is discovered_object
}
```

### Phase 1 Generation Prompt

```
[WCD INJECTED FIRST]

Using the World Consistency Document above, generate the World Bible
for the starting region and structural outlines for adjacent regions.

Character: [NAME], a [CLASS]
Genre: [GENRE]
Starting region type: settlement_hub (a small-to-medium inhabited settlement)

STARTING REGION requirements:
- 1 settlement node (the main arrival point — town square, crossroads, etc.)
- 3-5 notable sub-locations within the settlement:
  * Always include: 1 inn/tavern, 1 merchant/shop
  * Include 1-3 of: smithy, temple/shrine, guild hall, garrison, dock,
    back alley, market square, or genre equivalent
  * Do NOT generate: private homes, non-notable buildings
- Each sub-location has: atmosphere, 3-5 Tier 1 objects, 1-2 NPCs
- Total NPCs for starting region: 4-7, each with REAL NAMES
- At least 1 merchant NPC, at least 1 quest-relevant NPC
- All location connections must be bidirectional
- Grid positions must be consistent with WCD (settlement near 0,0)
- Sub-locations cluster within 1-2 grid cells of their settlement node

ADJACENT REGIONS (outline only, 3-5 regions):
- Must be consistent with WCD landmarks and faction territories
- At least 1 must contain or border a WCD landmark
- Include variety: at least 1 wilderness, 1 settlement, 1 dungeon/ruin

MAIN QUEST:
- Antagonist consistent with WCD factions
- Breadcrumb 0 deliverable in the starting region
- Breadcrumbs escalate in danger/revelation
- Each breadcrumb feels like natural discovery

Rules:
- REAL NAMES for every NPC — no placeholders ever
- Every name is permanent
- Atmosphere must not contradict the WCD
- NPCs' knowledge array must contain WCD-consistent facts they'd plausibly know

Respond ONLY with valid JSON matching the WorldBible schema.
No markdown, no explanation.
```

---

## Layer 2: Regional Bible (Phase 2)

Fired when the player first approaches a region boundary. Background pre-generation starts when an exit is discovered — by the time the player crosses the boundary, the region is ready.

### Phase 2 Generation Prompt

```
[WCD INJECTED FIRST]
[SUMMARY OF EXISTING REGIONS: names, NPCs, and key facts already established]

Expand this region outline into a full Regional Bible:
[REGION_OUTLINE_JSON]

The player is approaching from [ORIGIN_REGION] to the [DIRECTION].

Requirements:
- [location_count] notable locations with real names and full constitutions
- [key_npc_count] NPCs with real names and full constitutions
- Must be consistent with WCD atmosphere and faction territory
- If this region contains landmark [LANDMARK_NAME], it must be present
  and match its WCD public_description
- Connect back to [ORIGIN_REGION] via an exit to the [OPPOSITE_DIRECTION]
- Atmosphere must feel like a natural extension of the established world

Rules:
- REAL NAMES for every NPC — no placeholders ever
- Every name is permanent
- NPC knowledge must match WCD 'known_by' fields
- If faction controls this region, NPCs reflect that faction's culture

Respond ONLY with valid JSON matching the RegionBible schema.
No markdown, no explanation.
```

---

## Object System — Three Tiers

Every location has three types of objects. Only Tier 1 objects are AI-generated.

### Tier 1 — Landmark Objects (AI-generated, tracked assets)
3-5 per location. Named, described, stored in LocationDefinition.objects.
These are the meaningful interactable things. Highlighted in the story feed.
Examining them produces AI-narrated rich responses.
Some contain items. Some are quest-relevant. Some unlock information.

Examples:
- The Ashflow Forge: "Korven's Weapon Rack", "The Master Ledger", "The Sealed Furnace Door"
- The inn: "The Notice Board", "The Guest Register", "The Locked Strongbox Under the Bar"

### Tier 2 — Ambient Objects (code-generated from templates)
Every location type has a built-in library of ambient objects in the game code.
These are never highlighted and have no mechanical significance.
When the player interacts with one, the game returns a template response instantly.
No AI call. No game state change.

```typescript
const AMBIENT_OBJECTS: Record<AmbientLocationType, AmbientObject[]> = {
  tavern_common_room: [
    { name: 'fireplace', response: 'The fireplace crackles steadily, radiating warmth.' },
    { name: 'bar stools', response: 'Worn smooth by countless travelers.' },
    { name: 'notice board', response: 'A few flyers and wanted posters, nothing catches your eye.' },
    { name: 'ale casks', response: 'Large barrels stacked behind the bar, smelling of fermentation.' },
    { name: 'scattered tables', response: 'Rough-hewn wood, scarred by years of use.' },
  ],
  smithy: [
    { name: 'anvil', response: 'Heavy iron, pitted with years of work.' },
    { name: 'forge', response: 'Banked coals glow orange, ready for work.' },
    { name: 'weapon rack', response: 'Various tools and blades in progress.' },
    { name: 'workbench', response: 'Covered in metal filings and half-finished projects.' },
  ],
  market_stall: [
    { name: 'display cases', response: 'Goods arranged to catch the eye.' },
    { name: 'shelves', response: 'Stacked with wares of various quality.' },
    { name: 'counter', response: 'A worn trading surface between you and the merchant.' },
  ],
  // ... etc for all location types across all genres
}
```

### Tier 3 — Free Interaction (narrator handles it)
Anything the player tries that isn't Tier 1 or Tier 2 routes to the narrator with:

```
AMBIENT INTERACTION: The player tried to interact with "[THING]".
This is not a tracked game asset. Provide a brief, atmospheric response
of 1-2 sentences. Do not make this a game asset. Do not say it disappears
or didn't exist. Describe it as a mundane part of the environment.
```

This is the DnD freedom layer — the player can try literally anything and the world responds plausibly.

---

## Layer 3: Narrator Constraints

The narrator receives:
1. WCD (always, injected first)
2. Current LocationDefinition (name, atmosphere, objects list)
3. RESPONDING CHARACTER only (for DIALOGUE actions)
4. Player state and recent history

### Hard Narrator Rules

```
YOU ARE A NARRATOR, NOT A WORLD BUILDER.

HARD RULES — violating these breaks the game:

1. NAMES: Always refer to locations, NPCs, and objects by their EXACT stored names.
   Never invent alternative names for established assets.
   Wrong: "the tavern" when the location is named "Korven's Inn"
   Right: "Korven's Inn"

2. OBJECTS: Only name specific interactable objects from the current
   location's objects list. Ambient atmosphere is fine. Inventing named
   objects that aren't in the list is not.
   If a player interacts with something not in the list: brief ambient
   response only — "nothing of particular note" or similar.
   NEVER say an object disappears or didn't exist. NEVER say a person left.

3. NPCs: Write ONLY from the RESPONDING CHARACTER provided.
   Do not switch characters. Do not bring in NPCs from other locations.

4. FAILED CHECKS: A failed stat check means the NPC is guarded, evasive,
   or unhelpful. It NEVER means the NPC is absent or left.
   Wrong: empty room after a failed check
   Right: NPC's reluctance or deflection

5. WORLD CONSISTENCY: WCD is absolute truth. Every NPC knows WCD landmarks
   appropriate to their knowledge level.

6. NPC NAMES: Every NPC has a real name. Introduce them atmospherically
   then name them within the same paragraph.
   Wrong: still calling Korven "the innkeeper" after introduction
   Right: "Korven sets down his glass"
```

---

## Three-Tier Map System

The map is a toggleable sidebar panel with three zoom levels. The player switches between tiers via zoom controls or breadcrumb navigation.

### Tier 1 — World Map (zoomed out)

Shows the entire known world. Bounded by the WCD grid_size (40x40).
Viewport is 20x20 cells centered on the player's current region.
Scrollable — the player can pan to see the whole discovered world.

**What renders:**
- Discovered regions: colored blocks sized by their grid_radius
- Current region: bright highlight/pulse
- WCD landmarks: named diamond (◆) icons at their grid positions, visible before discovery
- Undiscovered adjacent regions: dim grey outline blocks with "???" label
- Region names on hover
- Main quest destination: subtle amber glow once enough breadcrumbs are found

**Color by region type:**
```
settlement_hub: #1d4ed8 (blue)
wilderness:     #15803d (green)
dungeon:        #6b7280 (grey)
stronghold:     #7c2d12 (dark red)
port:           #0e7490 (teal)
ruin:           #78716c (stone)
```

**Interaction:** Click a discovered region → zoom to Tier 2 for that region.

---

### Tier 2 — Regional Map (zoomed in)

Shows the current region and adjacent region borders. Each cell represents one graph node.

**What renders:**
- All discovered nodes in the region: colored squares with short name labels
- Current location: bright highlight with player dot
- Undiscovered exits: dim directional arrows at region edges with adjacent region name
- NPC home locations: tiny genre-colored dots on their home node
- Locked/inaccessible locations: muted with lock icon
- Adjacent region borders: labeled colored strips at the edges

**Interaction:**
- Click discovered node → moves player there (fires GRAPH_NAVIGATE)
- Click undiscovered exit → narrator describes the approach, player must physically travel there
- Zoom out → returns to Tier 1

---

### Tier 3 — Local Map (settlement/dungeon layout)

Shows the internal layout of the current settlement or dungeon. This is the most immediately useful for gameplay.

**Layout generation (code, not AI):**
The engine places notable sub-locations at logical positions within a small local grid (e.g. 10x10 cells). Layout rules by settlement type:

```
settlement: inn near center, smithy near edge, market near main road,
            temple on elevated spot, garrison near gate
dungeon: entrance at one end, boss room at the other,
         side rooms branching off the main corridor
ship/station: bridge at front, engine room at back, quarters along sides
```

Non-notable buildings fill remaining space as small unlabeled grey blocks. This gives the settlement a sense of scale and reality without generating anything for them.

**What renders:**
- Notable sub-locations: colored labeled blocks (same colors as Tier 2)
- Non-notable ambient areas: small dark grey blocks (no label, not clickable)
- Current sub-location: highlighted block with player dot
- NPCs shown as colored dots on their current location
- Exits to the regional map: arrows at the settlement edges
- Interior connections: dotted lines between connected sub-locations

**Interaction:**
- Click a notable sub-location → moves player there (GRAPH_NAVIGATE)
- Hover a block → shows location name and 1-line atmosphere
- Zoom out → returns to Tier 2

---

### Map Navigation UX

```
[World Map] ──zoom in──> [Regional Map] ──zoom in──> [Local Map]
                                                          ↑
                                                   (default view
                                                    when in a
                                                    settlement)
```

Breadcrumb at top of map panel: `The Ashfall Reaches > Thornwick Crossing > Korven's Inn`
Each breadcrumb is clickable — click the region name to zoom to Tier 2, click world to zoom to Tier 1.

Default tier shown when opening the map:
- Inside a settlement or dungeon → Tier 3 (Local)
- Traveling between settlements → Tier 2 (Regional)
- Player prompt specifies world-level → Tier 1 (World)

---

## Highlight System (Rebuilt)

The current keyword-scanning approach is replaced with exact asset name matching.

### New Highlight Rules

1. When narrator response arrives, build exact match list from current node:
   - `location.objects[].name` — Tier 1 objects (highlight as OBJECT)
   - `location.npc_ids` → resolved NPC names (highlight as NPC)
   - `location.connections` → resolved location names (highlight as LOCATION)
   - WCD landmark names if mentioned in narrator text (highlight as LANDMARK)

2. Scan narrator text for EXACT case-insensitive matches only
3. Never partial or fuzzy match
4. Highlight type determines click behavior:
   - OBJECT → fires EXAMINE action for that object
   - NPC → fires DIALOGUE action for that NPC
   - LOCATION → fires MOVE action to that location
   - LANDMARK → shows WCD landmark info panel (informational only if not yet discovered)

5. Tier 2 ambient objects are NEVER highlighted (no mechanical significance)
6. Tier 3 free interactions produce no highlights

---

## NPC Naming — Simplified

The unknown→known reveal pipeline is removed entirely.

### New NPC Rules

- Every NPC has a real name assigned at generation time — permanent
- name_known is always true for newly generated NPCs
- The narrator introduces them atmospherically then names them immediately:
  "A scarred man emerges from behind the bar. Korven Thrike sets down his glass."
- Dialogue modal shows real name immediately on first interaction
- Codex entry writes immediately on first interaction
- No reveal pipeline, no placeholder names, no two-channel matching
- The old `name_known` field stays in the schema for backward compatibility

---

## Implementation Plan

### Day 19A — World Consistency Document
- New `WorldConsistencyDocument` type
- New `/api/game/generate-wcd` route
- Inject WCD as first block in ALL generation and narration prompts
- Store in `game_sessions.world_consistency` (migration 009)

### Day 19B — World Bible Redesign
- New type hierarchy: `WorldBible`, `RegionBible`, `LocationDefinition`, `NPCDefinition`
- Location hierarchy: settlement node + notable sub-locations
- Replace `generateWorldSeed` with `generateWorldBible`
- All NPCs real names at generation — remove placeholder system entirely
- `applyWorldBible` writes all locations + NPCs as world_assets and graph nodes
- Progressive loading: WCD → WorldBible → apply → start game

### Day 19C — Ambient Object System
- `AMBIENT_OBJECTS` library in `/lib/game/ambient-objects.ts`
- Covers all location types across all 5 genres
- Tier 2 interaction: instant template response, no AI call
- Tier 3 interaction: short narrator call with ambient instruction

### Day 19D — Regional Bible (Phase 2)
- New `generateRegionalBible` function replaces stub generator
- Background pre-generation on exit discovery
- Shows "Entering [region_name]..." loading indicator if needed

### Day 19E — Narrator Constraints + Highlight Overhaul
- Hard narrator rules block in ALL narrator system prompts
- Highlight rebuilt: exact match only against Tier 1 objects + NPC names + location names
- Remove NPC reveal pipeline entirely
- Ambient object interaction routes to template (Tier 2) or short narrator call (Tier 3)

### Day 19F — Three-Tier Map Component
- `/components/game/WorldMap.tsx` with three zoom tiers
- Tier 1: WCD grid rendering with landmark markers
- Tier 2: Region node rendering with NPC dots
- Tier 3: Local layout code-generation with ambient grey blocks
- Breadcrumb navigation between tiers
- Toggleable sidebar panel
- Real-time updates as nodes are discovered

---

## Supabase Migration 009

```sql
ALTER TABLE public.game_sessions
ADD COLUMN IF NOT EXISTS world_consistency jsonb;

ALTER TABLE public.game_sessions
ADD COLUMN IF NOT EXISTS world_bible jsonb;
```

---

## Key Principles

1. **AI generates content once** — creative, unique, unconstrained by templates
2. **Engine owns all assets** — permanent, consistent, deterministic
3. **WCD is the constitution** — injected everywhere, never contradicted
4. **Narrator describes, never generates** — strict rules enforced in prompt
5. **Three object tiers** — Tier 1 (AI, tracked), Tier 2 (code templates), Tier 3 (narrator ambient)
6. **Names are permanent from birth** — no reveal pipeline
7. **Highlights are exact Tier 1 matches only** — no fuzzy keyword scanning
8. **Failed checks = evasion** — never absence or denial of existence
9. **Three-tier map** — World / Regional / Local, all reading from world graph data
10. **DnD freedom** — player can try anything; engine routes appropriately
