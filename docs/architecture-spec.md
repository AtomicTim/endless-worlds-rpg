# Endless Worlds RPG — Architecture Specification

**Version:** 1.0  
**Status:** Active reference document. All implementation decisions must align with this spec.

---

## Vision

A text-based RPG that generates a new, complete, internally-consistent world for every playthrough. The player can explore freely, interact with NPCs, fight enemies, complete quests, and eventually finish a main storyline — in a world they have never seen before and will never see again. Genre-agnostic. Infinitely replayable.

The game must feel as open and explorable as a classic CRPG (Baldur's Gate, Fallout) while being text-based and AI-assisted. It must be stable, reliable, and fast.

---

## The Two Domains (Must Never Touch)

### Domain 1: The Game Engine
Pure deterministic code. No AI involvement after world generation is complete.

Contains:
- The world graph (all nodes, connections, NPC assignments)
- Player state (stats, inventory, HP, XP, level)
- Combat resolution
- Quest flags and tracking
- Map rendering and navigation
- All game state mutations
- Dialogue option generation
- Stat check resolution

Rule: If something changes game state, it is Domain 1. The AI cannot touch it.

### Domain 2: The Content Library
AI generates this once during world creation. After generation, it is frozen permanently.

Contains:
- World Consistency Document (WCD) — the world's laws
- Every location: name, atmosphere text, Tier 1 objects, connections
- Every NPC: name, role, personality, knowledge array, inventory if merchant
- Every item: name, stats, effects, description
- Main quest: antagonist, goal, 3-5 breadcrumb hints
- Adjacent region outlines: name, type, atmosphere hint

Rule: If something describes or names world content, it is Domain 2. Once frozen, it cannot be changed by any AI call.

---

## The AI's Role During Gameplay (Narration Only)

The AI writes prose. It does not make decisions, create content, or change state.

### What the AI does:
1. **Location arrival description** — First visit only. Receives frozen location data and writes atmospheric prose. Result cached permanently. No AI on subsequent visits.
2. **NPC dialogue responses** — Code determines the topic and check result. AI writes how this NPC expresses the outcome in their voice. Context is closed: only this NPC's frozen data, current location, WCD.
3. **Action narration** — Examine, interact, use item. Code resolves the outcome. AI writes 1-4 atmospheric sentences describing it. Cached after first examine of each object.
4. **Combat narration** — Code resolves the combat round. AI writes the beat. (Future system.)

### What the AI does NOT do:
- Decide movement or navigation
- Create NPCs not in the frozen content library
- Create items not defined in the content library
- Assign merchant status to NPCs
- Generate dialogue options (code does this)
- Introduce locations not in the world graph
- Change what exists in the world
- Receive movement intent in any prompt

---

## World Generation — The Horizon Model

The world is infinite in potential but only concrete where needed. Three zones exist at all times:

### Zone 1 — Fully Concrete (current region)
The region the player is in, plus all directly adjacent regions that have been entered. Fully generated:
- All locations with names, atmosphere, Tier 1 objects, connections
- All NPCs with full assets
- All items defined
- Cached arrival descriptions for visited locations

### Zone 2 — Outlined (1-2 regions away)
Visible on the map. Not yet enterable. Contains:
- Region name and type
- One-sentence atmosphere hint
- Faction affiliation if any
- WCD landmark positions if applicable
- No NPCs, no objects, no arrival text yet

Triggered to become Zone 1: when the player moves to within 1 hop (adjacent region border). Background pre-generation starts immediately.

### Zone 3 — Potential (3+ regions away, WCD landmarks)
Exists on the map as a name and position. The Grinding Maw. Bellhaven. The Vermillion Scar. The player can see them and aim for them. Nothing else is defined. Becomes Zone 2 when the player moves to within 2 hops.

### Generation Timing
- Zone 1 generation: triggered when player crosses a region border, should be complete before they arrive (background pre-generation)
- Zone 2 → Zone 1 upgrade: triggered when player is 1 hop away
- Zone 3 → Zone 2 upgrade: triggered when player is 2 hops away
- WCD landmarks: always visible on World Map as destinations to aim for, regardless of generation status

---

## Location and Sub-Location System

### Primary Locations
Defined in WorldBible or RegionBible. Have a specific node in the world graph. Named, typed, fully described.

### Sub-Locations (Building Exploration)
Generated on first visit from location type templates. The CODE defines what sub-areas are possible. The AI generates their content.

#### Location Type Templates
Each primary location type has a defined set of possible sub-areas:

```
Tavern/Inn:
  - Common room (primary — always exists)
  - Upper floor / guest rooms (always available to explore)
  - Kitchen / back area (always available)
  - Cellar (if horror or dungeon-adjacent genre)
  - Private dining room (optional, quest-relevant)

Merchant Shop:
  - Shop floor (primary)
  - Back storage room (always available)
  - Upstairs apartment (available if NPC lives there)

Smithery/Forge:
  - Forge floor (primary)
  - Back workshop (always available)
  - Outdoor materials yard (always available)

Temple/Shrine:
  - Main hall (primary)
  - Inner sanctum (gated — requires reputation or quest flag)
  - Catacombs / lower level (gated — requires quest progress)

Guild Hall:
  - Common area (primary)
  - Notice board room (always available)
  - Master's office (gated — requires rank or quest flag)
  - Training area (always available)

Dungeon (any type):
  - Entrance chamber (primary)
  - First depth level (always available)
  - Second depth level (requires: first level explored)
  - Boss chamber (requires: second level cleared)
  - Secret passage (discovered by exploration or NPC hint)

Wilderness / Road:
  - Main path (primary)
  - Off-path area (always available — may have encounters, items)
  - Hidden location (discovered by exploration roll)
```

#### Template Rule
If a location type's template does not include the requested sub-area, the response is a hardcoded string. No AI call. No phantom location created.

Example: Player in a smithy tries to go upstairs. Smithy template has no upstairs. Response: "There's nothing above the forge floor." Done.

Example: Player in a tavern tries to go to the kitchen. Tavern template includes kitchen. Node is created, AI generates it once, cached permanently.

---

## Navigation — Code Only

### How the Player Moves
1. Click a nav bar card (primary method)
2. Click a location block on the Local Map
3. Click a node on the Regional Map
4. Click a region block on the World Map (goes to Regional Map view, not direct travel)

That is the complete list. No other navigation method exists.

### When the Player Types Movement Text
If the intent parser classifies input as MOVE, the response is a hardcoded system message — no AI call:
> "Use the navigation bar below to travel to a nearby location."

The AI never receives movement intent. The AI never writes travel prose.

### The World Graph
- Every navigable location is a node with a unique canonical ID
- Connections are explicit bidirectional edges
- If a connection doesn't exist in the graph, travel is impossible — no exceptions
- Connection validation runs at apply time (WorldBible / RegionBible apply) — bad connections are fixed or dropped at generation, never at runtime
- Zone IDs are assigned at generation time and never change

### Zone Hierarchy in the Graph
```
Geographic Region (zone_id = its own id, type = zone)
  └── Settlement Node (zone_id = region id, type = zone, is_settlement_node = true)
      └── Sub-location (zone_id = settlement id, type = sub_location)
  └── Standalone Location (zone_id = region id, type = zone)
      └── Sub-location (zone_id = standalone location id, type = sub_location)
```

### Region Location Back-Connections
Every standalone location (dungeon, wilderness, road) ALWAYS has a connection to the settlement node of its geographic region. This is enforced at apply time, not patched at runtime.

---

## Dialogue System — Closed Context

### NPC Presence Validation
Before any dialogue starts, code validates: is the target NPC in `currentNode.npc_ids`? If no, hardcoded response: "[Name] isn't here." No AI call.

### Dialogue Options — Generated by Code
The code reads the NPC asset and generates options based on their frozen data:

```
For every NPC:
  - [Farewell] — always present
  - [Free type] — always present (with validation gate)

If NPC is a merchant (role contains: merchant/trader/vendor/shopkeeper):
  - [Browse wares] — opens trade panel directly, no AI call

For each topic in NPC.knowledge array:
  - [Ask about: {topic}] — generates a dialogue beat on click

If NPC is quest_relevance = 'key' and relevant quest flag is set:
  - [Quest-specific option] — generated from quest data

If NPC trust < 30:
  - Options are limited — hostile NPCs don't offer full dialogue trees
```

The AI does not generate or add options. It only writes the NPC's response text when an option is chosen.

### Free Text Validation Gate
Before free text reaches the AI, code runs these checks in order:

1. Is this movement intent? → Hardcoded: "Use the navigation bar to travel."
2. Does this name an NPC not at this location? → Hardcoded: "[Name] isn't here."
3. Does this reference something impossible in this world? → Hardcoded: "You don't know what that is."
4. Is this the player's second or third examine of the same object? → Hardcoded: "You find nothing new."

Only if all four checks pass does the AI receive the input.

### Closed Context for AI Dialogue Calls
When the AI writes a dialogue response, it receives exactly:
- WCD block (world laws)
- RESPONDING CHARACTER block (this NPC's frozen asset data only)
- TIER 1 OBJECTS at current location (exact names only)
- SCENE CONTEXT (current location atmosphere, time of day if relevant)
- The specific topic or player input
- The stat check result (pass/fail, not the numbers)

The AI does NOT receive:
- A list of all NPCs in the game
- Other locations the player has visited
- Movement context or destination hints
- Anything that could prompt it to invent new content

### Stat Check Difficulty
Determined entirely by code before AI sees anything:
- Base: difficultyForTrust(npc.trust_score)
- Modifier: stakesBonusForIntent(intent_category)
- Tone modifier: +2 for deceptive
- Clamp: [6, 18]

Intent categories:
- Public knowledge (directions, NPC name, basic services): -2
- General lore (local customs, recent events): 0
- Sensitive (locations of people, faction movements): +2
- Personal/intimate (backstory, relationships): +3
- Dangerous secrets (betrayal, illegal activity, conspiracies): +4

---

## Merchant System

### Merchant Status
Defined at WorldBible/RegionBible generation time in the NPC asset.
If NPC.constitution.role does not contain merchant/trader/vendor/shopkeeper: no trade button, ever.

### Inventory
Defined in the NPC asset at generation time. Items are real world_assets with names, stats, descriptions, and prices.
The AI does not generate items at runtime. It describes existing items atmospherically.

### Trade Button
Appears in DialogueModal footer only when:
1. Current NPC is a merchant by role (from asset)
2. Player is actively in dialogue with them

Clicking it opens the trade panel directly. No AI call. No stat check. No parseIntent.

### Haggling (Future)
A separate haggling mode triggered by player action. Stat check (STR or CHA) against the price. If successful: write price_override_[item_id] flag to session. TradeModal reads this flag. Single attempt per item. Floor price enforced by code.

---

## Map System

### Tier 1 — World Map
- Shows geographic regions as colored blocks
- WCD landmarks as ◆ diamonds with name/description tooltips
- Undiscovered Zone 2 regions as dim outlines with names
- Zone 3 regions not shown (player hasn't heard of them yet)
- Clicking a region → switches to Tier 2 for that region
- Never triggers navigation directly

### Tier 2 — Regional Map
- Shows all concrete nodes within the selected geographic region
- Settlement + standalone locations (dungeons, wilderness) side by side
- SVG connection lines between nodes
- Exit arrows only for cross-region connections
- NPC dots at home locations
- Clicking a settlement node → switches to Tier 3
- Clicking a standalone location → triggers navigation to it
- Undiscovered nodes shown as dim outlines

### Tier 3 — Local Map
- Shows sub-locations inside the current settlement
- 72px blocks, 3-letter type abbreviation, genre decorations
- Current node: pulsing amber border
- NPC dots at home sub-locations
- Clicking a sub-location → navigates player there
- Exit buttons at edges for outward connections

### Map Auto-Behavior
- On navigation to a new sub-location within current settlement: stays on Tier 3
- On navigation to a standalone region location: Tier 3 shows that location's sub-areas if any, else Tier 2
- On RegionBible expansion (entering new region): auto-switches to Tier 3 of new settlement
- Clicking Tier 1 region: goes to Tier 2, NOT Tier 3

---

## Combat System (Design Intent — Future Implementation)

### Principles
- Fully turn-based, structured UI (not free text)
- Code resolves all combat math
- AI writes narration for each round result
- Enemies defined in world_assets at generation time with stats, abilities, loot tables
- Combat initiated by: entering certain locations (dungeon rooms), explicit enemy encounter nodes, or player-initiated via examine/interact on a known enemy

### Structure
- Player turn: action buttons (Attack, Defend, Use Item, Flee, Special)
- Enemy turn: code resolves enemy action based on enemy type and health state
- Each round: code computes result → AI writes 1-2 sentences of narration → next round
- Victory: loot defined by enemy asset, XP defined by enemy difficulty
- Defeat: player returns to last settlement with reduced HP, some gold lost

---

## Leveling and Progression System (Design Intent)

### Stats
Strength, Perception, Charisma, Agility, Intelligence (starting values from character creation)

### XP Sources
- Defeating enemies (XP defined in enemy asset)
- Completing quests and quest steps
- Discovering new locations (first visit bonus)
- Successfully passing difficult stat checks (PER/CHA/STR ≥ 15 difficulty)

### Level Up
- At each level: +2 points to distribute across stats
- New dialogue options unlocked at certain stat thresholds
- New areas accessible at certain level thresholds (gated dungeon depths, inner sanctums)

### Equipment
- Weapons and armor add stat bonuses
- Defined in world_assets at generation time
- Found in dungeons, purchased from merchants, rewarded for quests

---

## Quest System (Design Intent)

### Main Quest
Defined in WorldBible. Has: antagonist, goal, 3-5 breadcrumbs, win condition.
Breadcrumbs delivered via NPC dialogue (when trust threshold met), discovered objects, or environmental clues.
Main quest completable — the game has a defined ending.

### Side Quests
Generated per NPC at WorldBible/RegionBible time. Simple structure:
- Quest giver NPC with quest_relevance = 'quest'
- Objective: fetch item / reach location / speak to NPC / defeat enemy
- Reward: gold, item, trust increase with faction
- Tracked as world_state flags

### Quest Tracking UI
Separate codex tab. Shows active quests, completed quests, and main quest progress. All data from world_state flags — no AI involvement.

---

## Codex System

### What Gets Added
- Locations: on first player interaction at that location (not on entry)
- NPCs: on first dialogue with that NPC
- Items: on first examine of that item
- Lore: on discovering specific objects or passing knowledge checks
- WCD landmarks: on first time NPC mentions them or player reaches them

### Updates
Future: when new information is learned about an existing entry, the entry updates. The original entry is preserved in history.

### Usage
Designer vision: codex entries become raw material for the player's own world-building outside the game (writing, other media). The codex is a living document of the world they experienced.

---

## Performance and Reliability

### AI Call Budget
- World generation: 2-3 AI calls (WCD + WorldBible + apply). One-time cost.
- RegionBible expansion: 1 AI call per new region. Pre-generated in background.
- Location arrival: 1 AI call per new location. Cached permanently after first visit.
- Dialogue beat: 1 AI call per player-initiated dialogue exchange.
- No AI calls for: movement, re-examining known objects, trade panel open, re-visiting locations.

### Caching Strategy
- Location arrival descriptions: cached in world_assets after first generation
- Examined object descriptions: cached in world_assets after first examine
- Items_for_sale: cached in session state for merchant NPC's current session
- RegionBible: module-level cache keyed by sessionId__regionId with in-flight dedup

### Model Selection
- World generation (WCD, WorldBible): claude-sonnet-4-5 — quality matters most here
- RegionBible: claude-haiku-4-5 — speed matters, quality acceptable from simpler prompt
- Live narration (dialogue, arrive, examine): claude-sonnet-4-5 — quality for immersion

### Route Timeouts
- generate-regional-bible: maxDuration = 300, switch to haiku for faster response
- generate-world-bible: maxDuration = 300, accepts up to 8000 tokens
- All narrate calls: maxDuration = 60 (should complete well within this)

---

## What Makes This Novel

This game sits at the intersection of two things that don't normally exist together:

1. **Procedural world generation** — Every playthrough is a new world with its own laws, factions, places, characters, and history. Completely different from Skyrim which you replay in the same world.

2. **CRPG depth** — Full stat system, leveling, combat, quests, exploration, merchants, dungeons. Not just a chatbot with an RPG skin.

The AI's role is specific and valuable: it makes every world feel alive, every NPC feel like a person, every location feel atmospheric. But it does this as a writer, not as an engineer. The world exists before the AI writes a single word of dialogue. The AI just makes it beautiful.

---

*This document is the reference for all implementation decisions. When a question arises about whether something should be code or AI, refer here first.*
