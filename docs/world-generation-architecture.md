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
  type: RegionType
  grid_centre: { x: number, y: number }
  grid_radius: number             // How many cells this region spans (~3-5)
  atmosphere: string              // Region-specific atmosphere (must not contradict WCD)
  controlling_faction?: string    // Faction ID from WCD
  
  // All locations in this region — fully detailed
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
  
  // Constitution — locked on creation
  atmosphere: string              // 2-3 sentences of sensory description
  notable_features: string[]      // Named features: ["the iron-bound door", "Korven's bar"]
  connections: string[]           // IDs of connected locations
  
  // NPCs assigned here (IDs from this region's NPC list)
  npc_ids: string[]
  
  // Items/objects present (named, lockable)
  objects: LocationObject[]
  
  // Map display
  is_interior: boolean            // Interior locations cluster near their parent
  parent_location_id?: string     // e.g. porch belongs to the_inn
}

interface LocationObject {
  id: string
  name: string                    // Exact name narrator must use
  description: string             // What it looks like — 1 sentence
  is_interactable: boolean        // Can player examine/use it?
  contains_item?: string          // Optional item ID if it contains something
  is_locked?: boolean
}

interface NPCDefinition {
  id: string                      // character_[slug] — permanent
  name: string                    // REAL NAME — assigned at generation, permanent
  home_location_id: string        // Where they normally are
  role: NPCRole                   // innkeeper | merchant | guard | quest_giver | etc.
  archetype: string               // Brief archetype description
  
  // Constitution — locked on creation
  appearance: string              // 1-2 sentences
  personality: string             // 2-3 defining traits
  speech_style: string            // How they talk — e.g. "clipped and military"
  faction_id?: string             // Which faction they belong to
  
  // Relationship to main quest
  quest_relevance?: 'key' | 'supporting' | 'none'
  knows_breadcrumb?: number       // Which breadcrumb index they can hint at
  
  // Merchant data (if role === merchant)
  is_merchant?: boolean
  speciality?: string             // What they sell
  
  // Starting trust
  default_trust: number           // 0-100
}

interface RegionExit {
  direction: 'north' | 'south' | 'east' | 'west' | 'northeast' | 'northwest' | 'southeast' | 'southwest'
  target_region_id: string
  from_location_id: string        // Which location the exit is accessible from
  description: string             // What the player sees looking that way
}

interface RegionOutline {
  id: string
  name: string
  type: RegionType
  grid_centre: { x: number, y: number }
  direction_from_start: string
  distance: 'adjacent' | 'near' | 'far'
  controlling_faction?: string
  atmosphere_hint: string         // 1 sentence — enough for WCD landmarks to reference
  key_npc_count: number           // How many NPCs to generate when expanded
  location_count: number          // How many locations to generate when expanded
  landmark_id?: string            // If this region contains a WCD landmark
}

interface MainQuest {
  title: string                   // Internal only — player never sees this
  antagonist_name: string         // Real name
  antagonist_location: string     // Region/location ID
  antagonist_faction?: string
  goal: string                    // What completing the quest requires
  opening_hook: string            // The first hint planted in the starting scene
  breadcrumbs: QuestBreadcrumb[]  // Exactly 5
  win_condition: string
}

interface QuestBreadcrumb {
  index: number                   // 0-4
  content: string                 // The actual hint/discovery
  delivery_method: 'npc_dialogue' | 'discovered_object' | 'environmental' | 'overheard'
  suggested_location: string      // Where this breadcrumb naturally fits
  npc_id?: string                 // Which NPC delivers it (if npc_dialogue)
}
```

### Phase 1 Generation Prompt

```
[WCD INJECTED FIRST]

Using the World Consistency Document above, generate the World Bible
for the starting region and structural outlines for adjacent regions.

Character: [NAME], a [CLASS]
Genre: [GENRE]
Starting region type: [STARTING_REGION_TYPE]

Requirements:

STARTING REGION (fully detailed):
- 4-6 locations with real names, atmosphere, notable_features, and objects
- 3-5 NPCs with REAL NAMES from birth — no placeholders ever
- Every NPC has: appearance, personality, speech_style, role
- At least 1 merchant NPC
- At least 1 quest-relevant NPC who knows breadcrumb 0
- Location grid positions must be consistent with WCD landmarks
- All location connections must be bidirectional

ADJACENT REGIONS (outline only, 3-5 regions):
- Must be consistent with WCD landmarks
- Grid centres must not overlap with starting region
- At least 1 must contain or reference a WCD landmark

MAIN QUEST:
- Antagonist must be consistent with WCD factions
- Breadcrumb 0 must be deliverable in the starting region
- Each breadcrumb must feel like natural discovery, not exposition

Rules:
- Every name is permanent and must never change
- No placeholder names — ever
- Atmosphere must not contradict the WCD
- NPCs know about WCD landmarks appropriate to their knowledge level

Respond ONLY with valid JSON matching the WorldBible schema.
No markdown, no explanation.
```

---

## Layer 2: Regional Bible (Phase 2)

Fired when the player first approaches a region boundary. Expands a RegionOutline into a full RegionBible. Uses the WCD + the original outline as constraints.

### Phase 2 Generation Prompt

```
[WCD INJECTED FIRST]
[WORLD BIBLE SUMMARY: locations and NPCs already established]

Expand this region outline into a full Regional Bible:
[REGION_OUTLINE_JSON]

The player is approaching from [ORIGIN_REGION] to the [DIRECTION].

Requirements:
- [location_count] locations with real names and full constitutions
- [key_npc_count] NPCs with real names and full constitutions
- Must be consistent with the WCD atmosphere and faction territory
- If this region contains landmark [LANDMARK_NAME], place it prominently
- Connect back to [ORIGIN_REGION] via an exit to the [OPPOSITE_DIRECTION]
- Atmosphere and naming must feel like a natural extension of the world

Rules:
- Every name is permanent
- No placeholder names — ever
- NPC knowledge of WCD landmarks must match 'known_by' field
- If controlling faction is set, NPCs should reflect that faction's culture

Respond ONLY with valid JSON matching the RegionBible schema.
No markdown, no explanation.
```

---

## Layer 3: Narrator Constraints

The narrator receives:
1. WCD (always, injected first)
2. Current location's full LocationDefinition (name, atmosphere, notable_features, objects)
3. Current node's assigned NPCs (full NPCDefinition for the RESPONDING CHARACTER only)
4. Recent history and player state

### Hard Narrator Rules

```
YOU ARE A NARRATOR, NOT A WORLD BUILDER.

HARD RULES — violating these breaks the game:

1. NAMES: Always refer to locations, NPCs, and objects by their EXACT stored names.
   Never invent alternative names for established assets.
   Wrong: "the tavern" when the location is named "Korven's Inn"
   Right: "Korven's Inn"

2. OBJECTS: Only reference objects that exist in the current location's
   notable_features or objects list. You may describe ambient atmosphere
   (smells, sounds, general crowd) freely. You may NOT name specific
   interactable objects that aren't in the list.
   If a player interacts with something not in the list: describe a brief
   ambient response — "nothing of particular note" or similar.
   NEVER say an object disappears or didn't exist.

3. NPCs: The RESPONDING CHARACTER for this dialogue turn is provided to you.
   Write dialogue ONLY from that character. Do not switch characters.
   Do not bring in NPCs from other locations.

4. FAILED CHECKS: A failed stat check means the NPC is guarded, evasive,
   or unhelpful. It NEVER means the NPC is absent or the object doesn't exist.
   Wrong: describing an empty room after a failed check
   Right: describing the NPC's reluctance to share information

5. WORLD CONSISTENCY: The WCD is absolute truth. Every NPC knows about
   WCD landmarks appropriate to their 'known_by' level.
   A farmer knows about famous landmarks. Only scholars know obscure ones.

6. NPC NAMES: Every NPC has a real name. Use it from the first mention.
   You may describe their appearance before naming them, but name them
   within the same paragraph on first introduction.
   Wrong: referring to Korven as "the innkeeper" after introduction
   Right: "Korven sets down his glass"
```

---

## The Map Component

The world graph already stores map_position {x,y} on every node. The map renders from existing data.

### Map Display Rules

```typescript
interface MapNode {
  id: string
  name: string
  type: LocationType
  grid_position: { x: number, y: number }
  discovered: boolean
  is_current: boolean
  has_adjacent_undiscovered: boolean  // Shows exit indicator
}

// Color coding by location type (all genres):
const MAP_COLORS = {
  // Fantasy
  tavern: '#b45309',      // amber
  settlement: '#1d4ed8',  // blue
  wilderness: '#15803d',  // green
  dungeon: '#6b7280',     // grey
  stronghold: '#7c2d12',  // dark red
  market: '#a16207',      // yellow
  // Cyberpunk
  'data-hub': '#0e7490',  // cyan
  'corp-zone': '#1e1b4b', // dark blue
  slum: '#78350f',        // brown
  bar: '#831843',         // pink
  // Space Opera
  station: '#4c1d95',     // purple
  ship: '#1e3a5f',        // navy
  colony: '#14532d',      // dark green
  // Horror
  mansion: '#1f2937',     // near black
  street: '#374151',      // dark grey
  // Post-Apoc
  shelter: '#7f1d1d',     // dark red
  wasteland: '#92400e',   // rust
}
```

### Map Component Behaviour

- Renders as a fixed panel (sidebar or modal toggle)
- Grid cells are small — 16x16px or 20x20px each
- Discovered nodes: colored square with 1-2 word label on hover
- Current location: brighter/pulsing version of its color
- Undiscovered adjacent: dim grey outline square (hints at exits)
- WCD landmarks beyond explored area: named grey diamond markers at their grid position
- Click any discovered node: shows name + atmosphere in a tooltip
- Map updates in real time as nodes are discovered
- Interior locations (is_interior: true) cluster at fractional offsets near parent

---

## Highlight System

The current keyword-scanning approach is replaced with exact asset name matching.

### New Highlight Rules

1. When the narrator response arrives, extract all text
2. Build a list of EXACT highlightable strings from current location:
   - Current location's `notable_features` array entries
   - Current location's `objects[].name` entries  
   - Current node's `npc_ids` → resolved NPC names
   - Connected location names (from `connections`)
3. Search narrator text for EXACT matches (case-insensitive)
4. Highlight only exact matches — never partial/fuzzy matches
5. Each highlighted element shows its type on hover (NPC / Location / Object)
6. Clicking a highlight fires the appropriate action (DIALOGUE / MOVE / EXAMINE)

This means if the narrator writes "upstairs" and there's no asset named "upstairs",
no highlight appears. The player can still type "go upstairs" and get an
INTERNAL_DESCRIBE response.

---

## NPC Naming — Simplified

The unknown→known reveal pipeline is removed entirely.

### New NPC Rules

- Every NPC has a real name assigned at generation time
- The name is in the NPC's asset from the moment they're created
- The narrator introduces NPCs atmospherically first, then uses their name
  Example: "A scarred man emerges from behind the bar, ember-marked arms
  catching the firelight. Korven Thrike sets down his glass and meets your gaze."
- The dialogue modal shows the real name immediately on first interaction
- The codex entry writes immediately on first interaction with the real name
- No placeholder names, no reveal pipeline, no two-channel matching
- The old `name_known` field stays in the schema for backward compatibility
  but is always `true` for newly generated NPCs

---

## Implementation Plan

### Day 19A — World Consistency Document
- New `WorldConsistencyDocument` type
- New `/api/game/generate-wcd` route (fast, focused call)
- Inject WCD as first block in ALL generation and narration prompts
- Store in `game_sessions.world_consistency` (new column, migration 009)

### Day 19B — World Bible Redesign
- New `WorldBible`, `RegionBible`, `LocationDefinition`, `NPCDefinition` types
- Replace current `generateWorldSeed` with `generateWorldBible`
- All NPCs get real names at generation — remove placeholder system
- `applyWorldBible` writes all locations + NPCs as world_assets and graph nodes
- Progressive loading: WCD first, then WorldBible, then apply

### Day 19C — Regional Bible (Phase 2)
- New `generateRegionalBible` function
- Replaces current stub generator for WORLD_EXPLORE moves to new regions
- Shows loading indicator "Entering [region_name]..."
- WCD injected as context for regional generation
- Background pre-generation: when player discovers a region exit, start generating

### Day 19D — Narrator Constraints + Highlight Overhaul
- Hard narrator rules block added to ALL narrator system prompts
- Highlight system rebuilt: exact match only against current location assets
- Remove NPC reveal pipeline entirely
- Add ambient object interaction: "nothing of particular note" for unlisted objects

### Day 19E — Map Component
- New `/components/game/WorldMap.tsx`
- Reads from `masterState.world_graph.nodes`
- WCD landmarks shown as named markers even before discovery
- Toggle button in game header
- Real-time updates on node discovery

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
5. **Names are permanent from birth** — no reveal pipeline
6. **Highlights are exact matches** — no fuzzy keyword scanning
7. **Failed checks = evasion** — never absence or denial of existence
8. **Map reflects reality** — graph nodes render directly, no interpretation
