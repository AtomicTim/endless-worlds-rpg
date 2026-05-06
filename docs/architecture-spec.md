# Endless Worlds RPG — Architecture Specification

**Version:** 1.1  
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
- Container registry and loot resolution

Rule: If something changes game state, it is Domain 1. The AI cannot touch it.

### Domain 2: The Content Library
AI generates this once during world creation. After generation, it is frozen permanently.

Contains:
- World Consistency Document (WCD) — the world's laws
- Every location: name, atmosphere text, Tier 1 objects, connections
- Every NPC: name, role, personality, knowledge array, inventory if merchant
- Every item: name, stats, effects, description
- Regional loot tables: 20-30 items per region across quality tiers
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
4. **Container search narration** — Code resolves what was found (or not). AI writes one sentence describing the discovery. The item was determined by code before the AI sees anything.
5. **Combat narration** — Code resolves the combat round. AI writes the beat. (Future system.)

### What the AI does NOT do:
- Decide movement or navigation
- Create NPCs not in the frozen content library
- Create items not defined in the content library
- Assign merchant status to NPCs
- Generate dialogue options (code does this)
- Introduce locations not in the world graph
- Introduce containers not in the container registry
- Change what exists in the world
- Receive movement intent in any prompt
- Decide what is found in a container

---

## World Generation — The Horizon Model

The world is infinite in potential but only concrete where needed. Three zones exist at all times:

### Zone 1 — Fully Concrete (current region)
The region the player is in, plus all directly adjacent regions that have been entered. Fully generated:
- All locations with names, atmosphere, Tier 1 objects, connections
- All NPCs with full assets
- All items and loot tables defined
- Container registries populated for all locations
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

---

## Container and Loot System

### The Container Registry
Every location has a fixed, frozen list of searchable containers. This is the ONLY source of truth for what can be searched. If a container is not in the registry, it does not exist.

**Two sources populate the registry:**

**Source 1 — Tier 1 named containers** (from WorldBible/RegionBible)
Specific named objects defined at generation time: "The Merchant's Strongbox", "Verity's Locked Desk". These are in the location's `objects` array with `type: container`. They exist definitionally.

**Source 2 — Template containers** (hardcoded by location type)
Every location type has ambient containers that always exist:
```
Tavern common room:    1 barrel near bar, 1 storage crate
Tavern kitchen:        2 supply barrels, 1 larder chest
Tavern upper floor:    1 travel pack per room (1-3 rooms)
Dungeon entrance:      1-2 debris piles, 0-1 chest (spawn roll)
Dungeon depth level:   1-3 chests, 1-2 debris piles
Merchant back room:    1 crate, 1 locked strongbox
Merchant shop floor:   display cases (examine only, not searchable)
Wilderness off-path:   1 abandoned pack, 0-1 buried cache
Smithy back workshop:  1 scrap bin, 1 tool chest
```

These are created when the sub-location node is first visited and added permanently to the location's `searchable_containers` list.

### The Free Text Container Gate
When the player types "I look for a chest" or "I search for a barrel":

1. Parse intent → EXAMINE or INTERACT, extract container type keyword
2. Look up current location's `searchable_containers`
3. If named container: does it exist in the list?
   - Yes → proceed to search flow
   - No → hardcoded: "There's no [chest] here." Zero AI call.
4. If no specific target ("I look for something to search"):
   - Return hardcoded list: "You notice: a supply barrel, a storage crate." Player then targets one.

**The AI never decides what containers exist. Never.**

### The Search Flow
Once code confirms the container exists:

1. **Already searched?** Check `searched` flag. If true: "You've already been through this." Done.
2. **Spawn roll** — Does this container have anything? Probability by type:
   - Dungeon chest: 75%
   - Tavern barrel: 25%
   - Merchant strongbox: 85%
   - Debris pile: 40%
   - Wilderness cache: 60%
3. **If nothing:** "Empty." One hardcoded sentence. Container flagged searched. Done.
4. **Quality roll** — Stat check (Perception or Strength by container type):
   - Critical success (total ≥ difficulty + 6): Rare item from loot table
   - Success (total ≥ difficulty): Common item from loot table
   - Partial (total ≥ difficulty - 3): Low-quality item or lesser version
   - Fail: Junk — broken pieces, worthless debris, or nothing useful
5. **Item selection** — Code picks from the frozen regional loot table at the determined quality tier
6. **State update** — Item added to inventory, container flagged as searched permanently
7. **Narration** — AI writes one sentence. It receives: container name, item found (or junk description), quality tier, location atmosphere. It writes color. It did not decide what was there.

### Regional Loot Tables
Generated as part of WorldBible/RegionBible. Frozen at generation time. 20-30 items per region across three tiers:

- **Rare (5-8 items):** Unique weapons, named armor pieces, significant quest-adjacent items, rare consumables
- **Common (10-15 items):** Standard weapons, armor, consumables, crafting materials, currency bundles
- **Junk (5-8 items):** Broken tools, worthless trinkets, scraps, spoiled food

All items in the loot table are real world_assets with names, stats, effects, and prices. The AI generates the loot table at WorldBible time alongside NPCs and locations. After that, loot table items are as frozen as any other asset.

### Container Rules
- One search per container, ever. The `searched` flag is permanent.
- Container list for a location is finalized on first visit. Never changes after that.
- Free text cannot create containers. Code cannot create containers after location generation.
- AI cannot name or reference containers that aren't in the registry.

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
3. Does this reference a container not in the container registry? → Hardcoded: "There's no [thing] here."
4. Does this reference something impossible in this world? → Hardcoded: "You don't know what that is."
5. Is this the player's second or third examine of the same object? → Hardcoded: "You find nothing new."

Only if all checks pass does the AI receive the input.

### Closed Context for AI Dialogue Calls
When the AI writes a dialogue response, it receives exactly:
- WCD block (world laws)
- RESPONDING CHARACTER block (this NPC's frozen asset data only)
- TIER 1 OBJECTS at current location (exact names only)
- SCENE CONTEXT (current location atmosphere)
- The specific topic or player input
- The stat check result (pass/fail, not the numbers)

The AI does NOT receive movement context, destination hints, or anything that could prompt invention.

### Stat Check Difficulty
Determined entirely by code before AI sees anything:
- Base: difficultyForTrust(npc.trust_score)
- Modifier: stakesBonusForIntent(intent_category)
- Tone modifier: +2 for deceptive
- Clamp: [6, 18]

Intent categories:
- Public knowledge: -2 | General lore: 0 | Sensitive: +2 | Personal: +3 | Dangerous: +4

---

## Merchant System

### Merchant Status
Defined at WorldBible/RegionBible generation time in the NPC asset.
If NPC.constitution.role does not contain merchant/trader/vendor/shopkeeper: no trade button, ever.

### Inventory
Defined in the NPC asset at generation time. Items are real world_assets.
The AI does not generate items at runtime.

### Trade Button
Opens trade panel directly. No AI call. No stat check.

### Haggling (Future)
Stat check (STR or CHA). price_override_[item_id] flag. Single attempt. Floor price enforced by code.

---

## Map System

### Tier 1 — World Map
- Geographic regions as colored blocks
- WCD landmarks as ◆ with tooltips
- Zone 2 regions as dim outlines with names
- Zone 3 not shown
- Click region → Tier 2

### Tier 2 — Regional Map
- Settlement + standalone locations side by side
- Exit arrows only for cross-region connections
- Click settlement → Tier 3

### Tier 3 — Local Map
- Sub-locations, 72px blocks, type abbreviations, genre decorations
- Current node: pulsing amber border
- Click sub-location → navigate

---

## Combat System (Future)

- Turn-based, structured UI (not free text)
- Code resolves all combat math
- AI writes narration for each round result
- Enemies defined in world_assets at generation time
- Victory: loot from enemy's defined loot table, XP from enemy difficulty
- Defeat: return to last settlement, reduced HP, some gold lost

---

## Leveling and Progression System (Future)

### Stats
Strength, Perception, Charisma, Agility, Intelligence

### XP Sources
- Defeating enemies | Completing quests | Discovering locations (first visit) | Difficult stat check successes

### Level Up
- +2 stat points per level
- New areas gated by level thresholds
- New dialogue options at stat thresholds

---

## Quest System (Future)

### Main Quest
Defined in WorldBible. Antagonist, goal, 3-5 breadcrumbs, win condition. Completable.

### Side Quests
Generated per NPC. Objective + reward + world_state flag tracking.

---

## Codex System

### What Gets Added
- Locations: on first player interaction (not on entry)
- NPCs: on first dialogue
- Items: on first examine or first find in container
- Lore: on discovering objects or passing knowledge checks

---

## Performance and Reliability

### AI Call Budget
- World generation: 2-3 calls. One-time cost.
- RegionBible: 1 call per region. Pre-generated in background.
- Location arrival: 1 call per new location. Cached permanently.
- Dialogue beat: 1 call per exchange.
- Container search narration: 1 call only when item found (not on empty).
- No AI for: movement, re-examine, trade open, re-visit, empty container.

### Model Selection
- World generation (WCD, WorldBible): claude-sonnet-4-5
- RegionBible: claude-haiku-4-5 (speed over quality — outline already defines the region)
- Live narration: claude-sonnet-4-5

---

## What Makes This Novel

1. **Procedural world generation** — Every playthrough is a new world. Not a replay.
2. **CRPG depth** — Full stats, leveling, combat, quests, exploration, dungeons, loot.

The AI is a writer hired to describe a world the code already built. It makes things beautiful. It does not make things exist.

---

*This document is the reference for all implementation decisions. When a question arises about whether something should be code or AI, refer here first.*
