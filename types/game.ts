// Core game state and AI loop types for Endless Worlds RPG

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export enum Genre {
  FANTASY             = "fantasy",
  CYBERPUNK           = "cyberpunk",
  HORROR_LOVECRAFTIAN = "horror_lovecraftian",
  SPACE_OPERA         = "space_opera",
  POST_APOCALYPTIC    = "post_apocalyptic",
}

export enum ActionType {
  MOVE     = "MOVE",
  ATTACK   = "ATTACK",
  INTERACT = "INTERACT",
  EXAMINE  = "EXAMINE",
  USE_ITEM = "USE_ITEM",
  DIALOGUE = "DIALOGUE",
  CUSTOM   = "CUSTOM",
}

export enum SubscriptionTier {
  FREE       = "free",
  ADVENTURER = "adventurer",
  LEGEND     = "legend",
}

export enum ItemType {
  WEAPON     = "WEAPON",
  ARMOR      = "ARMOR",
  CONSUMABLE = "CONSUMABLE",
  KEY        = "KEY",
  LORE       = "LORE",
  CONTAINER  = "CONTAINER",
}

export enum ItemRarity {
  COMMON    = "COMMON",
  UNCOMMON  = "UNCOMMON",
  RARE      = "RARE",
  LEGENDARY = "LEGENDARY",
}

export enum LocationStatus {
  PRESENT  = "PRESENT",   // player is here, acting within this location
  ARRIVING = "ARRIVING",  // player just moved here this turn
}

export enum Difficulty {
  EASY      = "easy",
  NORMAL    = "normal",
  HARD      = "hard",
  NIGHTMARE = "nightmare",
}

export enum LogEntryType {
  STORY     = "STORY",
  COMBAT    = "COMBAT",
  DISCOVERY = "DISCOVERY",
  DIALOGUE  = "DIALOGUE",
  SYSTEM    = "SYSTEM",
}

// ---------------------------------------------------------------------------
// Item
// ---------------------------------------------------------------------------

export interface Item {
  id:          string;
  name:        string;
  type:        ItemType;
  rarity:      ItemRarity;
  description: string;
  effect?:     Record<string, number | string>;
  quantity:    number;
  genre_skin?: string;
  weight?:     number;
  stackable:   boolean;
  max_stack?:  number;
  equipped?:   boolean;
  stat_bonus?: Partial<Attributes>;
  searched?:   boolean;
  contains?:   Item[];
  /** Sell value in genre currency. Common 5-15, Uncommon 20-50,
   *  Rare 100-300, Legendary 500+. */
  value?:      number;
}

export interface EquippedLoadout {
  weapon?:    Item;
  armor?:     Item;
  accessory?: Item;
}

export interface ActiveBuff {
  id:         string;
  stat:       keyof Attributes;
  amount:     number;
  source:     string;
  expires_at: string | null;
}

// ---------------------------------------------------------------------------
// Player
// ---------------------------------------------------------------------------

export interface Attributes {
  strength:     number;
  agility:      number;
  charisma:     number;
  intelligence: number;
  perception:   number;
}

export interface PlayerState {
  name:        string;
  background:  string;
  health:      number;
  max_health:  number;
  sanity?:     number;
  max_sanity?: number;
  resources:   Record<string, number>;
  attributes:  Attributes;
  inventory:   Item[];
  level:       number;
  xp:          number;
  buffs?:      ActiveBuff[];
}

// ---------------------------------------------------------------------------
// World
// ---------------------------------------------------------------------------

export interface WorldState {
  current_location_id: string;
  visited_locations:   string[];
  flags:               Record<string, boolean | number | string>;
  location_status:     LocationStatus;
  /** Day 18 — World Graph node id (kept in sync with current_location_id when
   *  a world_graph exists). Optional for backward compat with old saves. */
  current_node_id?:    string;
}

// ---------------------------------------------------------------------------
// Day 18 — World Graph (persistent connected location graph)
// ---------------------------------------------------------------------------

export interface WorldNode {
  /** Permanent normalized slug — matches the location's bare id (NOT prefixed). */
  id:             string;
  /** Display name — permanent. */
  name:           string;
  /** Major area (zone) vs interior sub-area (sub_location). */
  type:           "zone" | "sub_location";
  /** SeedLocation.type carried over (tavern/market/dungeon/etc.). Used by
   *  the move classifier's type-keyword channel so "the inn" routes to a
   *  connected tavern. Optional: legacy nodes / sub_locations may omit it. */
  category?:      string;
  /** Which zone this node belongs to. Self-id when type="zone". */
  zone_id:        string;
  /** May the narrator add new sub_locations under this zone via exploration? */
  is_expandable:  boolean;
  /** Ids of nodes directly reachable from this one. */
  connections:    string[];
  /** world_asset ids of NPCs assigned here ("character_<slug>"). */
  npc_ids:        string[];
  /** world_asset ids of items / objects placed here ("item_<slug>"). */
  item_ids:       string[];
  /** Matching world_asset id ("location_<slug>"). */
  asset_id:       string;
  /** Has the player visited this node? */
  discovered:     boolean;
  /** Relative position for map rendering. */
  map_position:   { x: number; y: number };
  /** True for the geographic region's main settlement hub. Used by the
   *  NavigationBar return-card logic to find the parent settlement of a
   *  region_location even when graph back-connections are missing.
   *  Mirrored from LocationDefinition.is_settlement_node at apply time. */
  is_settlement_node?: boolean;
  // ── Day 20 Combat — encounter tagging mirrored onto the graph node ────────
  /** Mirrored from LocationDefinition.encounter_chance. Read at arrival
   *  time by the encounter trigger (Prompt 2) so combat resolution
   *  doesn't need to re-fetch the bible blob. */
  encounter_chance?:   number;
  /** Mirrored from LocationDefinition.encounter_roster. */
  encounter_roster?:   string[];
  /** Mirrored from LocationDefinition.is_boss_room. */
  is_boss_room?:       boolean;
}

export interface WorldGraph {
  /** All nodes keyed by their bare id. */
  nodes:             Record<string, WorldNode>;
  /** Where the player is right now. */
  current_node_id:   string;
  /** Pinned reference for the campaign's starting node. */
  starting_node_id:  string;
}

/** Classification produced by classifyMove() inside resolveMove. */
export type MoveType =
  | "GRAPH_NAVIGATE"      // known direct connection in the graph
  | "ZONE_EXPAND"         // new sub_location within the current zone
  | "WORLD_EXPLORE"       // genuinely new external destination
  | "INTERNAL_DESCRIBE";  // sub-area language, no actual move

// ---------------------------------------------------------------------------
// Log Book
// ---------------------------------------------------------------------------

export interface LogEntry {
  id:        string;
  timestamp: string;
  type:      LogEntryType;
  content:   string;
}

/** Minimal snapshot of a narrative/dialogue feed message stored in the session for restoration. */
export interface StoredMessage {
  id:        string;
  type:      "NARRATIVE" | "DIALOGUE";
  content:   string;
  timestamp: string; // ISO string — survives JSON round-trip
  metadata?: Record<string, unknown>;
}

export interface LogBook {
  entries:          LogEntry[];
  session_summary:  string | null;
  /** Last 8 NARRATIVE/DIALOGUE messages — restored to the StoryFeed on session reload. */
  recent_messages?: StoredMessage[];
}

// ---------------------------------------------------------------------------
// NPC Registry
// ---------------------------------------------------------------------------

export interface NPCMemory {
  id:                  string;
  npc_key:             string;
  name:                string;
  role:                string;
  relationship_status: string;
  trust_score:         number;
  memory_snippets:     string[];
  faction_id?:         string;
  last_interaction?:   string;
}

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Day 19A — World Consistency Document (WCD)
// Layer 0: Generated once, injected everywhere, never modified.
// The constitution of the world — absolute facts every AI call must obey.
// ---------------------------------------------------------------------------

export interface WorldLandmark {
  id:                 string;
  name:               string;
  type:               "settlement" | "stronghold" | "wilderness" | "dungeon" | "ruin" | "geographic";
  grid_position:      { x: number; y: number };
  /** How widely known the landmark is — drives which NPCs may reference it. */
  known_by:           "everyone" | "locals" | "scholars";
  /** What common folk know — 1-2 sentences. */
  public_description: string;
  is_region_origin:   boolean;
  region_id?:         string;
}

export interface WorldFaction {
  id:                    string;
  name:                  string;
  /** Free text — e.g. "controls the northern forests". */
  territory:             string;
  /** Public reputation — 1 sentence. */
  public_reputation:     string;
  disposition_to_player: "allied" | "neutral" | "hostile" | "unknown";
}

export interface WorldConsistencyDocument {
  world_name:    string;
  world_tagline: string;
  /** 1-2 sentences of tonal truth. */
  atmosphere:    string;
  /** 2-3 sentences describing the world as a whole — its premise,
   *  what makes it unique. Distinct from `atmosphere` (per-place
   *  sensory prose) and the WorldBible's per-region atmospheres.
   *  Rendered in the World tier description panel. Optional so
   *  legacy saves without this field still load (callers fall back
   *  to `atmosphere`). */
  world_description?: string;
  landmarks:     WorldLandmark[];
  factions:      WorldFaction[];
  /** Universal truths — plain sentences. */
  world_rules:   string[];
  /** Total grid width/height (40 means 40x40). */
  grid_size:     number;
  /** Starting region centre (typically {x:0, y:0}). */
  world_origin:  { x: number; y: number };
}

// ---------------------------------------------------------------------------
// Day 19B — World Bible (Layer 1 of the world generation architecture)
// Replaces WorldSeed for new games. Generated once after the WCD, contains
// fully-detailed starting region with named locations, real-name NPCs,
// Tier 1 objects, adjacent region outlines, and the main quest.
// Old WorldSeed remains for backward compatibility with legacy saves.
// ---------------------------------------------------------------------------

export interface LocationObject {
  /** Normalized slug — permanent. */
  id:                string;
  /** Exact name the narrator must use — permanent. */
  name:              string;
  /** What it looks like — 1 sentence. */
  description:       string;
  /** When true, this object is highlighted in the story feed and
   *  examining it produces a rich AI-narrated response. */
  is_interactable:   boolean;
  /** Optional item ID if the object contains something. */
  contains_item_id?: string;
  /** Optional lore text revealed when the player examines it. */
  contains_lore?:    string;
  is_locked?:        boolean;
  /** Item ID required to unlock when is_locked is true. */
  unlock_requires?:  string;
  /** When true, examining this object delivers a quest breadcrumb. */
  quest_relevance?:  boolean;
}

export interface LocationDefinition {
  /** Normalized slug — permanent. */
  id:                  string;
  /** Display name — permanent. */
  name:                string;
  /** Same union as SeedLocation.type for backward compat with the
   *  WorldGraph node category channel. */
  type:                "tavern" | "settlement" | "wilderness" | "dungeon"
                     | "market" | "stronghold" | "ruin" | "port" | "other";
  grid_position:       { x: number; y: number };
  region_id:           string;
  /** True for the main arrival point of a settlement (one per region). */
  is_settlement_node:  boolean;
  /** True for sub-locations within a settlement (e.g. interior rooms). */
  is_interior:         boolean;
  /** Set on interior sub-locations to point at their containing place. */
  parent_location_id?: string;
  /** 2-3 sentences of sensory description — never contradicts the WCD. */
  atmosphere:          string;
  /** Bidirectional graph connections — IDs of other LocationDefinitions. */
  connections:         string[];
  // ── Day 20 Combat — encounter tagging (combat-spec §3, §6.7) ──────────────
  /** Probability of triggering a combat encounter on arrival. 0.0-1.0.
   *  0.0 (default) for peaceful locations, 0.4-0.7 for normal combat
   *  zones, 1.0 for boss rooms and obvious combat areas. */
  encounter_chance?:   number;
  /** Enemy ids drawn from the genre bestiary or the region's enemies
   *  array. The encounter trigger picks 1-4 of these per fight. Empty
   *  / undefined when encounter_chance is 0. */
  encounter_roster?:   string[];
  /** Boss rooms guarantee combat (chance 1.0) and lock until cleared.
   *  Encounter handler treats this as a flag to wire boss-fight rules
   *  (no flee, fixed enemy group from roster). */
  is_boss_room?:       boolean;
  /** IDs of NPCs that live / work here (NPCDefinition.id). */
  npc_ids:             string[];
  /** Tier 1 named interactable objects this location contains. */
  objects:             LocationObject[];
  /** Tier 2 ambient template lookup key — e.g. "tavern_common_room",
   *  "smithy", "market_stall". Drives the Day 19C ambient response engine. */
  ambient_type:        string;
}

export interface NPCDefinition {
  /** "character_<slug>" — permanent asset id. */
  id:                string;
  /** Real name from generation, never a placeholder. */
  name:              string;
  /** LocationDefinition.id where they normally are. */
  home_location_id:  string;
  /** Role descriptor (innkeeper, merchant, guard, quest_giver, etc.). */
  role:              string;
  /** Brief archetype description. */
  archetype:         string;
  /** 1-2 sentences of physical description. */
  appearance:        string;
  /** Descriptive sentence with 2-3 defining traits. */
  personality:       string;
  /** How they talk — e.g. "clipped and military". */
  speech_style:      string;
  /** WCD faction id, when affiliated. */
  faction_id?:       string;
  /** WCD-consistent facts the NPC plausibly knows. Generated as
   *  `{topic, content}` pairs (Architecture C). Plain-string entries
   *  from legacy saves are normalized to objects at apply time so
   *  consumers can rely on a single shape. */
  knowledge:         Array<string | NPCKnowledgeItem>;
  /** "key" / "supporting" / "none". Optional. */
  quest_relevance?:  string;
  /** Index 0-4 of the breadcrumb this NPC can hint at. */
  knows_breadcrumb?: number;
  is_merchant?:      boolean;
  /** What the merchant sells. */
  speciality?:       string;
  /** Starting trust score (0-100). */
  default_trust:     number;
}

// ---------------------------------------------------------------------------
// Day 20 Combat — Enemy data structure (combat-spec §6.2)
// ---------------------------------------------------------------------------

/**
 * Domain 2 frozen content. Lives either in the genre bestiary
 * (`/lib/game/bestiary/<genre>.ts`) or in `RegionBible.enemies` /
 * `RegionOutline.enemies`. The combat resolver (Prompt 2) reads stats
 * from this shape when spawning encounters; HP is randomized within
 * `hp_range` per spawn.
 */
export interface Enemy {
  /** Stable id used in encounter rosters. Genre prefix keeps them
   *  unique across regions (e.g. "fantasy_goblin", "ash_wraith_knight"). */
  id:               string;
  name:             string;
  /** 1-sentence description for AI narration. Not stat-block prose. */
  description:      string;
  /** [min, max] inclusive — randomized per spawn. */
  hp_range:         [number, number];
  /** Typically -2 to +4. Drives initiative and dodge DC. */
  agi_mod:          number;
  /** Typically -2 to +4. Adds to damage roll. */
  str_mod:          number;
  /** Dice notation: "1d4", "1d6", "1d8", "1d10", "2d4", "2d6", "2d8". */
  damage_die:       string;
  /** Typically 0-3. Adds to target DC. */
  armor_bonus:      number;
  /** Base XP awarded on kill. Scales with difficulty. */
  xp_value:         number;
  /** Reference to a Day 21 loot table; stub-shaped for Day 20. */
  loot_table_id:    string;
  /** Boss flag: guarantees combat, locks flee, awards higher loot. */
  is_boss:          boolean;
  /** 1-3 word phrase consumed by the narrator only ("aggressive melee",
   *  "ranged ambusher", "defensive caster"). Not mechanically dispatched
   *  in Day 20 — every enemy just attacks each turn. */
  behavior_flavor:  string;
}

export interface RegionExit {
  direction:        "north" | "south" | "east" | "west"
                  | "northeast" | "northwest" | "southeast" | "southwest";
  target_region_id: string;
  /** Which location inside the region the exit is accessible from. */
  from_location_id: string;
  /** What the player sees looking that way — 1 sentence. */
  description:      string;
}

export interface QuestBreadcrumb {
  /** 0 through 4 — first breadcrumb is the starting hook delivery. */
  index:             number;
  /** The actual hint or discovery the player receives. */
  content:           string;
  delivery_method:   "npc_dialogue" | "discovered_object" | "environmental" | "overheard";
  /** Location ID where this naturally fits. */
  suggested_location: string;
  /** NPC delivering the hint when delivery_method is "npc_dialogue". */
  npc_id?:           string;
  /** Object ID containing the hint when delivery_method is "discovered_object". */
  object_id?:        string;
}

export interface MainQuest {
  /** Internal label — the player never sees this. */
  title:               string;
  antagonist_name:     string;
  /** Region or location ID where the antagonist is rooted. */
  antagonist_location: string;
  antagonist_faction?: string;
  /** What completing the quest requires. */
  goal:                string;
  /** First hint planted in the starting scene. */
  opening_hook:        string;
  /** Exactly 5 breadcrumbs, escalating in danger and revelation. */
  breadcrumbs:         QuestBreadcrumb[];
  win_condition:       string;
}

export interface RegionOutline {
  id:                   string;
  name:                 string;
  /** Region type — settlement_hub, wilderness, dungeon, port, ruin, stronghold, etc. */
  type:                 string;
  grid_centre:          { x: number; y: number };
  direction_from_start: string;
  distance:             "adjacent" | "near" | "far";
  controlling_faction?: string;
  /** 1 sentence of atmosphere, WCD-consistent. */
  atmosphere_hint:      string;
  /** How many NPCs to generate when this region is expanded into a RegionBible. */
  key_npc_count:        number;
  /** How many notable locations to generate on expansion. */
  location_count:       number;
  /** WCD landmark id when this region contains one. */
  landmark_id?:         string;
  /** Day 20 Combat — 1-2 themed enemies sketched at WorldBible time.
   *  Less detail than RegionBible.enemies (which holds the full 3-5).
   *  When the region is expanded, the RegionBible prompt receives this
   *  list so the full enemy roster can build on the outline thematically. */
  enemies?:             Enemy[];
}

export interface RegionBible {
  /** Geographic-region slug — landscape, district, territory.
   *  e.g. "the_salt_plains", "rust_peaks_foothills", "the_ashwood". */
  id:                   string;
  /** Geographic-region display name. NEVER a town/building name.
   *  e.g. "The Salt Plains", "Rust Peaks Foothills". */
  name:                 string;
  type:                 string;
  grid_centre:          { x: number; y: number };
  /** How many cells this region spans on the world grid (typically 3-5). */
  grid_radius:          number;
  /** Region atmosphere — must not contradict the WCD. */
  atmosphere:           string;
  /** WCD faction id when one controls this region. */
  controlling_faction?: string;

  /** Day 20 — geographic restructure.
   *  Which location id inside `locations[]` is the main settlement hub
   *  (the town within this geographic area). When omitted, callers
   *  resolve it via the legacy `is_settlement_node` flag. */
  settlement_id?:       string;
  /** Day 20 — display name of the town/settlement. Distinct from
   *  `name` (which is the geographic region) so the player can see
   *  e.g. "Salt-Iron Crossing" inside "The Salt Plains". */
  settlement_name?:     string;

  /** Includes the settlement node and all notable sub-locations
   *  inside it. */
  locations:            LocationDefinition[];

  /** Day 20 — standalone locations that live in the geographic region
   *  alongside the settlement (NOT inside it). Dungeon entrances,
   *  ancient shrines, abandoned structures, wilderness points. They
   *  share `zone_id = <geographic region id>` rather than the
   *  settlement node id used by sub-locations. */
  region_locations?:    LocationDefinition[];

  /** Every NPC in this region — real names from generation. */
  npcs:                 NPCDefinition[];
  exits:                RegionExit[];

  /** Day 20 Combat (combat-spec §6.5) — 3-5 region-themed enemies
   *  generated alongside the RegionBible. Frozen content: spawned by
   *  encounter triggers later, never modified at runtime. Optional
   *  for legacy bibles generated before Day 20. */
  enemies?:             Enemy[];
}

export interface WorldBible {
  starting_region:  RegionBible;
  /** Structural outlines of 3-5 adjacent regions. */
  adjacent_regions: RegionOutline[];
  main_quest:       MainQuest;
  /** ISO timestamp. */
  generated_at:     string;
}

// ---------------------------------------------------------------------------
// Day 17 — World Seed (the world skeleton generated at character creation)
// ---------------------------------------------------------------------------

export interface SeedLocation {
  /** Normalized slug used as both world_assets.asset_id and current_location_id. */
  id:           string;
  /** Display name e.g. "The Iron Gate Tavern". */
  name:         string;
  type:         "tavern" | "settlement" | "wilderness" | "dungeon"
              | "market" | "stronghold" | "ruin" | "port" | "other";
  /** 2-3 sentences of structural facts. */
  description:  string;
  /** Faction id (when one controls this place). */
  faction_id?:  string;
  /** Other location ids this connects to — used by the narrator for hints. */
  connected_to?: string[];
  /** Day 18 — World Graph fields. Older seeds may omit these; apply-world-seed
   *  fills sensible defaults so the graph still builds. */
  connections?: string[];
  is_expandable?: boolean;
  map_position?: { x: number; y: number };
  npc_ids?: string[];
}

export interface SeedNPC {
  /** Normalized slug e.g. "innkeeper_marta". */
  id:          string;
  /** Display name — known from session start (no placeholder). */
  name:        string;
  /** Short role descriptor — "innkeeper", "merchant", "quest_giver", etc. */
  role:        string;
  /** Where the NPC is found. Matches a SeedLocation id. */
  location_id: string;
  /** 1-2 sentences capturing the NPC's voice and motivation. */
  personality: string;
  /** Quest hooks or world facts this NPC can share (used by the narrator). */
  knows_about?: string[];
  is_merchant?: boolean;
}

export interface SeedQuest {
  /** Internal label — the player never sees this. */
  title:           string;
  /** The opening hint the narrator should plant in the first scene. */
  hook:            string;
  /** Who or what the conflict involves. */
  antagonist:      string;
  /** What resolving the quest requires. */
  goal:            string;
  /** 3-5 hints to surface naturally over time. */
  breadcrumbs:     string[];
  /** What constitutes completing the quest. */
  win_condition:   string;
}

export interface SeedFaction {
  id:           string;
  name:         string;
  disposition: "ally" | "neutral" | "enemy";
  /** Locations this faction controls — free text or comma-separated names. */
  territory:    string;
}

export interface WorldSeed {
  /** World identity. */
  world_name:        string;
  /** One evocative sentence describing the world. */
  world_tagline:     string;
  /** Fully pre-seeded starting area. */
  starting_location: SeedLocation;
  /** 2-3 additional named locations connected to the start. */
  known_locations:   SeedLocation[];
  /** 3+ key NPCs in the starting area. */
  key_npcs:          SeedNPC[];
  /** Sealed main quest the player gradually discovers. */
  main_quest:        SeedQuest;
  /** 2+ world factions. */
  factions:          SeedFaction[];
}

export interface Metadata {
  genre:       Genre;
  tone:        string;
  difficulty:  Difficulty;
  session_id:  string;
  created_at:  string;
  last_played: string;
  /** Day 17 — pre-generated world skeleton, immutable for the session. */
  world_seed?: WorldSeed;
  /** Day 19A — World Consistency Document. Layer 0 of the new generation
   *  architecture: generated once at character creation, injected as the
   *  first block of every AI prompt, and never modified afterwards. */
  world_consistency?: WorldConsistencyDocument;
  /** Day 19B — Main quest from the WorldBible. Stored on metadata so the
   *  game loop can plant breadcrumbs without re-fetching the full bible
   *  every turn. The full WorldBible itself lives in
   *  game_sessions.world_bible (jsonb column) for analytics + Phase 2
   *  region expansion lookups. */
  main_quest?: MainQuest;
  /** Day 19D — Pre-generated WorldBible. Mirrored from the
   *  game_sessions.world_bible jsonb column so the game loop can match
   *  WORLD_EXPLORE destinations against adjacent_regions without an extra
   *  DB roundtrip per move. The bible itself never changes after Day 19B
   *  applied it; only world_state and visited_locations evolve.
   *
   *  Day 20 Combat — `world_bible.starting_region.enemies` and
   *  `world_bible.adjacent_regions[i].enemies` ride along inside this
   *  blob; no extra column needed for WorldBible-time enemies. */
  world_bible?: WorldBible;
  /** Day 20 Combat — RegionBibles for regions the player has expanded
   *  into via apply-regional-bible. Keyed by region id. The enemies
   *  array on each region is the authoritative source for combat
   *  triggers in expanded regions; the genre bestiary covers the rest.
   *  The full RegionBible blob is preserved so future systems (loot
   *  tables, faction quests) have the same shape they need. */
  region_bibles?: Record<string, RegionBible>;
}

// ---------------------------------------------------------------------------
// MasterState — the single serializable game state stored in Supabase
// ---------------------------------------------------------------------------

export interface MasterState {
  metadata:     Metadata;
  player_state: PlayerState;
  world_state:  WorldState;
  log_book:     LogBook;
  npc_registry: Record<string, NPCMemory>;
  /** Day 18 — persistent connected location graph. Optional: old saves and
   *  fresh sessions before world-seed application have no graph yet, in
   *  which case the resolver and game loop fall back to legacy behaviour. */
  world_graph?: WorldGraph;
  // ── Day 20 Combat ────────────────────────────────────────────────────────
  /** Active combat encounter slice. `undefined` when not in combat;
   *  fully populated when combat is in progress. Combat is a self-
   *  contained slice of game state: dismissed entirely on victory /
   *  defeat / flee, no leftovers. UI subscribes to this and renders
   *  combat mode reactively. */
  combat?: CombatState;
  /** Tracked for the defeat teleport. Updated whenever the player
   *  arrives at a settlement hub (is_settlement_node=true). Defaults
   *  to the starting settlement. */
  last_settlement_hub_id?: string;
  /** Last 5 visited node ids, most recent at end. Flee uses the
   *  second-to-last as the rollback target. */
  navigation_trail?:       string[];
}

// ---------------------------------------------------------------------------
// Day 20 Combat — runtime state slice
// ---------------------------------------------------------------------------

/**
 * One instance of an enemy spawned in an encounter. HP rolled per
 * spawn from the bestiary `hp_range`. instance_id is unique within
 * the encounter so multiple of the same enemy id can coexist
 * (e.g. two goblins, fantasy_goblin_1 and fantasy_goblin_2).
 */
export interface CombatEnemyInstance {
  /** Unique within this encounter — typically `${enemy_id}_${index}`. */
  instance_id:     string;
  /** Resolves against the bestiary or RegionBible.enemies. */
  enemy_id:        string;
  name:            string;
  description:     string;
  current_hp:      number;
  max_hp:          number;
  agi_mod:         number;
  str_mod:         number;
  damage_die:      string;
  armor_bonus:     number;
  xp_value:        number;
  loot_table_id:   string;
  is_boss:         boolean;
  behavior_flavor: string;
  /** False once current_hp <= 0. Dead enemies stay in the array so
   *  the combat log keeps a stable reference to them. */
  alive:           boolean;
}

/**
 * One atomic event in a combat encounter. The combat_log is the
 * narration source: Prompt 3 will render these into the story feed.
 * For Prompt 2, a console logger prints these for visibility.
 */
export interface CombatEvent {
  type:                  | "combat_start" | "round_start"
                         | "player_turn_start" | "enemy_phase_start"
                         | "player_attack" | "enemy_attack"
                         | "defend"       | "use_item"
                         | "flee_attempt"
                         | "kill"         | "victory"
                         | "defeat"       | "flee_success";
  /** Date.now() at event emission. */
  timestamp:             number;
  /** "PLAYER" or an enemy `instance_id`. */
  actor:                 "PLAYER" | string;
  /** "PLAYER", an enemy `instance_id`, or null for non-targeted events. */
  target:                "PLAYER" | string | null;
  outcome:               | "hit" | "miss" | "crit" | "fumble"
                         | "kill"
                         | "defended" | "fled" | "fled_failed"
                         | "item_used"
                         | null;
  damage_dealt:          number | null;
  remaining_target_hp:   number | null;
  /** Weapon or item name — used by the narrator (Prompt 3). */
  weapon_or_item:        string | null;
  /** Free-form flavor note. Lets the encounter trigger pass enemy
   *  behavior_flavor / region atmosphere without the resolver having
   *  to infer it. */
  context_note:          string | null;
  /** Day 20.4 — granular roll detail for inline display + floating
   *  damage numbers. Optional and additive: existing consumers that
   *  ignore this field continue to work. Populated by combat-resolver
   *  on hit / miss / fumble / crit / flee / use_item. Other event
   *  types omit it. */
  rolls?: CombatEventRolls;
  /** Day 20.4 TASK 4 — defeat / flee_success destination metadata.
   *  Resolved by handleDefeat / handleFleeSuccess at teleport time
   *  using the world_graph. StoryFeed renders an info line
   *  ("You wake at <Settlement> in <Region>.") below the resolution
   *  prose. Defeat carries node + region context; flee_success
   *  drops region (short hop). */
  destination?: CombatEventDestination;
}

/**
 * Day 20.4 — granular roll breakdown for a CombatEvent. Every field
 * is optional because the relevant data depends on the event type
 * (no d20 on a heal, no damage_die on a miss, etc.). UI consumers
 * read what's present and skip what isn't.
 */
export interface CombatEventRolls {
  /** Raw d20 roll (1-20). Present on hit/miss/crit/fumble/flee. */
  d20?:             number;
  /** Modifier added to d20 (AGI mod for attacks/flee). */
  d20_modifier?:    number;
  /** Difficulty class compared against (10 + AGI + armor for attacks). */
  target_dc?:       number;
  /** Damage die notation, e.g. "1d6". Present on hit/crit/use_item. */
  damage_die?:      string;
  /** Raw die roll. For crits this is the BONUS die (the +1d(die)
   *  part of crit math); the max value is in crit_max_damage. */
  damage_die_roll?: number;
  /** Crits only — the maxed value of the damage die (e.g. 6 for 1d6). */
  crit_max_damage?: number;
  /** Strength mod added to damage rolls. Absent on heal events. */
  str_modifier?:    number;
}

/**
 * Day 20.4 TASK 4 — Defeat / flee_success destination payload.
 * Resolved by the combat engine at teleport time so StoryFeed can
 * render a templated info line below the resolution prose. Region
 * fields are omitted for short-hop events (flee_success only carries
 * the previous node). */
export interface CombatEventDestination {
  node_id:      string;
  node_name:    string;
  /** Defeat: region zone id + name. Flee_success: undefined. */
  region_id?:   string;
  region_name?: string;
}

export interface CombatState {
  /** False = no combat. When combat dismisses cleanly the slice
   *  should be unset on MasterState rather than left at active=false. */
  active:             boolean;
  /** Unique per encounter — used for log correlation. */
  encounter_id:       string;
  enemies:            CombatEnemyInstance[];
  /** Initiative order: enemy `instance_id`s + the literal "PLAYER". */
  turn_order:         string[];
  /** Index into `turn_order` — advances after each turn resolves. */
  current_turn_index: number;
  /** Increments after a full pass through `turn_order`. */
  round_number:       number;
  /** True from the moment the player chooses Defend until the start of
   *  their next turn. Damage halved (min 1) and +2 AGI for defense
   *  calcs while true. */
  player_defending:   boolean;
  /** Every event since combat started — survives until combat dismisses. */
  combat_log:         CombatEvent[];
  /** Node id where combat began. Used for victory return + the
   *  fallback flee target when navigation_trail is too short. */
  origin_node_id:     string;
  /** Player.xp at combat start. Restored verbatim on defeat (§9). */
  pre_combat_xp:      number;
}

// ---------------------------------------------------------------------------
// AI Loop
// ---------------------------------------------------------------------------

export interface ParsedAction {
  action_type:      ActionType;
  primary_target?:  string;
  secondary_target?: string;
  item_used?:       string;
  inferred_intent:  string;
  confidence:       number;
  /** Tone classification — only set when action_type is DIALOGUE. */
  dialogue_tone?:   "friendly" | "persuasive" | "deceptive" | "intimidating" | "curious" | "neutral";
  /** Day 18 — populated by the resolver when a world_graph exists, after
   *  classifyMove() decides what kind of move this is. */
  move_type?:       MoveType;
}

export type StateDelta = {
  metadata?:     Partial<Metadata>;
  player_state?: Partial<PlayerState>;
  world_state?:  Partial<WorldState>;
  log_book?:     Partial<LogBook>;
  npc_registry?: Record<string, NPCMemory>;
};

export interface ResolutionResult {
  success:            boolean;
  outcome_type:       string;
  state_delta:        StateDelta;
  narrative_context:  Record<string, unknown>;
}

export interface PointOfInterest {
  label:       string;
  /** Day 19E: LANDMARK is informational only — clicking shows the WCD
   *  landmark's public_description and never triggers a game action. */
  type:        "LOCATION" | "NPC" | "CONTAINER" | "ITEM" | "HAZARD" | "LANDMARK";
  description: string;
}

export interface DialogueOption {
  id:    string;
  text:  string;
  tone:  "friendly" | "aggressive" | "curious" | "deceptive";
  // No stat_check field — the stat check applied when clicking this option
  // is derived purely from `tone` by the game engine. The DialogueModal
  // renders a tone-derived badge for the player; the resolver routes the
  // tone classification through resolveDialogue's switch.

  // ── Architecture C — code-built dialogue options ──────────────────────────
  /** Dispatch class. When set, click handling diverges from the legacy
   *  "submit option.text as quoted speech" flow:
   *    knowledge → submits speech AND pipes content to the narrator as
   *                closed-context (revealed on success, deflected on fail).
   *    trade     → opens the trade panel directly (no speech submitted).
   *    free      → opens the inline free-type input row (no speech yet).
   *    farewell  → closes the dialogue (no speech submitted).
   *  Legacy AI-generated options omit this and rely on `tone` alone. */
  type?:    "knowledge" | "trade" | "free" | "farewell";
  /** For type==="knowledge": the full closed-context fact the NPC knows.
   *  Routed through resolution.narrative_context.selected_knowledge so
   *  the narrator prompt can reveal it on a passed stat check or
   *  deflect on a failed one. The player's UI shows only the topic
   *  (option.text); the AI receives both. */
  content?: string;
}

/** WorldBible / RegionBible NPC knowledge item — code-built dialogue
 *  options surface `topic` as the button label and pipe `content` to
 *  the narrator as closed-context on click. Legacy plain-string
 *  knowledge entries are normalized to `{topic, content}` at apply
 *  time so the dialogue option builder can read a single shape. */
export interface NPCKnowledgeItem {
  topic:   string;
  content: string;
}

export interface CodexEntry {
  id:                  string;
  category:            "LOCATION" | "CHARACTER" | "FACTION" | "ITEM" | "LORE" | "BESTIARY";
  name:                string;
  description:         string;
  first_seen_location: string;
  significance:        "MINOR" | "NOTABLE" | "MAJOR";
}

export interface NarratorResponse {
  response_tier:       1 | 2 | 3;
  narrative_text:      string;
  ascii_art?:          string | null;
  sound_id?:           string | null;
  new_npcs:            NPCMemory[];
  items_acquired?:     Item[];
  points_of_interest:  PointOfInterest[];
  codex_entries:       CodexEntry[];
  /** Terse 12-word journal shorthand of the beat — used for LogBook STORY entries. */
  log_summary?:        string;
  /** 3-4 response options shown in the Dialogue Modal; only for NPC interactions. */
  dialogue_options?:   DialogueOption[];
  /** Trust score deltas for NPCs affected by this interaction. */
  trust_changes?:      Array<{ npc_key: string; delta: number; reason: string }>;
  /** Items the merchant is offering for sale this turn. NOT granted —
   *  shown to the player in the Trade Modal so they can choose to buy. */
  items_for_sale?:     Item[];
}

// ---------------------------------------------------------------------------
// World Assets — permanent constitution of every named entity
// ---------------------------------------------------------------------------

export enum AssetCategory {
  LOCATION  = "LOCATION",
  CHARACTER = "CHARACTER",
  FACTION   = "FACTION",
  ITEM      = "ITEM",
  LORE      = "LORE",
  BESTIARY  = "BESTIARY",
}

export interface WorldAssetConstitution {
  // LOCATION fields
  physical_description?: string;
  atmosphere?:           string;
  size?:                 string;
  faction_affiliation?:  string;
  key_landmarks?:        string[];
  available_services?:   string[];
  /** Day 19C — Tier 2 ambient template lookup key (e.g. "tavern_common_room",
   *  "smithy", "market_stall"). Drives the ambient-objects.ts router so
   *  player interactions with non-Tier-1 objects get instant template
   *  responses without an AI call. */
  ambient_type?:         string;

  // CHARACTER fields
  appearance?:           string;
  personality?:          string;
  role?:                 string;
  faction?:              string;
  speech_patterns?:      string;
  initial_relationship?: string;
  /** Architecture C — structured `{topic, content}` knowledge entries
   *  written by apply-world-bible / apply-regional-bible from
   *  NPCDefinition.knowledge. Read by buildDialogueOptions to produce
   *  the code-built dialogue option list (knowledge probes the player
   *  may ask the NPC about). */
  knowledge?:            NPCKnowledgeItem[];

  // FACTION fields
  ideology?:               string;
  territory?:              string;
  relationship_to_others?: string;

  // CREATURE / BESTIARY fields
  behavior?:               string;
  habitat?:                string;
  threat_level?:           string;

  // ITEM fields
  item_type?:        string;
  item_description?: string;

  // LORE fields
  lore_content?: string;

  // Shared
  notes?: string;

  // CHARACTER — true name (may differ from placeholder display name)
  true_name?: string;
}

export interface WorldAsset {
  id:                  string;
  category:            AssetCategory;
  name:                string;
  constitution:        WorldAssetConstitution;
  significance:        "NOTABLE" | "MAJOR";
  first_seen_location: string;
  session_id:          string;
  created_at:          string;
  svg_content?:        string;
  /** false = player hasn't learned this CHARACTER's real identity yet */
  name_known:          boolean;
}
