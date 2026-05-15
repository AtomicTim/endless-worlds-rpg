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
  // Day 21 — sellable / quest / stat-XP item kinds. VALUABLE has no
  // mechanical effect: it converts to gold at merchants (delayed gold).
  // QUEST_ITEM is a stub category for Day 23's main-quest wiring.
  // STAT_XP is a collectible that Day 22's stat-selection UI will
  // consume to bump a chosen attribute.
  VALUABLE   = "VALUABLE",
  QUEST_ITEM = "QUEST_ITEM",
  STAT_XP    = "STAT_XP",
}

export enum ItemRarity {
  COMMON    = "COMMON",
  UNCOMMON  = "UNCOMMON",
  RARE      = "RARE",
  LEGENDARY = "LEGENDARY",
}

// ---------------------------------------------------------------------------
// Status effects (Prompt 1 — combat ailments + buffs)
// ---------------------------------------------------------------------------

/** Canonical status effect ids. Ailments are inflicted by enemy hits or
 *  offensive consumables; buffs come from defensive consumables. Save
 *  DCs / durations / stat modifiers are defined in
 *  lib/game/combat-resolver.buildStatusEffect. */
export type StatusEffectId =
  | "poisoned"    // 1d4 DoT / 3r / AGI DC 12
  | "burning"     // 1d6 DoT / 2r / AGI DC 14
  | "chilled"     // -2 atk+saves / 2r / STR DC 11
  | "weakened"    // -3 STR rolls / 2r / STR DC 10
  | "frightened"  // -2 ALL d20 rolls / 2r / CHA DC 12
  | "fortified"   // +3 armor / 3r (buff)
  | "hastened"    // +3 atk / 2r (buff)
  | "focused";    // +3 INT/PER / 2r (buff)

/** A status effect actively applied to a combatant. damage_per_tick is
 *  rolled at application time (poisoned=1d4, burning=1d6) and re-applied
 *  every round-start until the effect saves or expires. stat_modifier
 *  carries the per-round mechanical effect for non-DoT entries. */
export interface ActiveStatusEffect {
  id:               StatusEffectId;
  rounds_remaining: number;
  /** Pre-rolled DoT damage (poisoned/burning); omitted for other ids. */
  damage_per_tick?: number;
  /** Per-round mechanical modifier. amount is negative for debuffs and
   *  positive for buffs. `"all_rolls"` covers d20 rolls universally;
   *  `"armor"` adjusts the armor bonus only. */
  stat_modifier?: {
    stat:   keyof Attributes | "all_rolls" | "armor";
    amount: number;
  };
  /** DC the target rolls against at end-of-turn to break the effect.
   *  Buffs use 0 (cannot be saved against). */
  save_dc:   number;
  /** Stat used for the save roll. Buffs use a placeholder — they expire
   *  by duration only, no save. */
  save_stat: keyof Attributes;
  /** Narrative label of the source — enemy name, item name, etc. */
  source:    string;
}

// ---------------------------------------------------------------------------
// ── ABILITY SYSTEM (P6 foundation) ──
// Hardcoded class abilities — 25 classes × 5 (4 active slots + 1 passive)
// = 125 templates total. Live in lib/game/abilities.ts (ABILITY_LIBRARY).
// World-native flavor names are layered on top in P7.
//
// PlayerState carries:
//   • learned_abilities       — pool of abilities the player knows (5-7/run)
//   • equipped_ability_slots  — fixed-length 4 tuple, one ability per slot
//   • passive_ability         — class passive, always active, never slotted
//
// Slot unlock schedule (rules 97 / 164):
//   slot 1 — start (level 1+)
//   slot 2 — level 5
//   slot 3 — level 10
//   slot 4 — level 15
// ---------------------------------------------------------------------------

/** Canonical ability id ("knight_shield_bash"). Plain string alias —
 *  branded types would force casts at every literal site, which buys
 *  nothing for a closed library keyed by snake_case slugs. */
export type AbilityId = string;

/** Coarse ability classification for sorting / filtering / UI badges.
 *  Categorized by primary effect — a damage ability that also inflicts
 *  WEAKENED is still `"damage"`; a heal+buff combo is `"heal"`. */
export type AbilityCategory =
  | "damage"
  | "heal"
  | "buff"
  | "debuff"
  | "utility";

/** Stat short-form used by ability gates + charge_stat scaling. Mirrors
 *  the Attributes keys but in the engine-friendly 3-letter form the
 *  ability library was authored against. */
export type AbilityStatShort = "str" | "agi" | "int" | "per" | "cha";

/** P7 — mechanical resolution blueprint for an ability. Every field is
 *  optional so an entry can carry any combination of damage / heal /
 *  buff / debuff / status-clear effects. Read by combat-engine's
 *  resolveAbility branch. Passive abilities omit this entirely (they
 *  are not dispatchable; the runtime applies their effect implicitly).
 */
export interface AbilityEffects {
  /** Damage die (e.g. "1d6"). When present, the ability deals damage
   *  to a single target. Auto-hits (no d20 to-hit check). */
  damage_die?:       string;
  /** Stat modifier added to each damage roll. Mirrors the AGI/STR/etc.
   *  bonus on a weapon attack. Defaults to "str". */
  damage_stat?:      AbilityStatShort;
  /** Multi-hit count. Defaults to 1. Each hit rolls damage independently
   *  against the same target (Flurry, Rapid Shot, Breach and Clear). */
  hits?:             number;
  /** Flat HP restored to the player on use (Restore N HP). Capped at
   *  max_health. */
  heal_amount?:      number;
  /** Status effects applied to the player on use (FORTIFIED / HASTENED /
   *  FOCUSED). Applied via buildStatusEffect → player_status_effects. */
  self_statuses?:    StatusEffectId[];
  /** Single status effect rolled against the target enemy. `chance` is
   *  the 0-1 application probability (POISONED 40% etc.). */
  target_status?:    { id: StatusEffectId; chance: number };
  /** Status effect ids cleared from the player on use (Fade clears
   *  CHILLED or WEAKENED; Antidote Mastery clears any ailment). The
   *  literal "any_ailment" sentinel clears every ailment in one pass. */
  clears_self_ids?:  Array<StatusEffectId | "any_ailment">;
}

/** One hardcoded class ability template. Identity for the engine; the
 *  world-flavor `name` is replaced per-world by P7 (the WCD generator
 *  receives the mechanical block and emits a thematic rename). */
export interface AbilityTemplate {
  /** Canonical id ("knight_shield_bash"). Stable across worlds. */
  id:                AbilityId;
  /** Display name. Equals `base_name` until P7 overlays a world flavor
   *  name (e.g. "Frost Bolt" → "Abyssal Chill"). */
  name:              string;
  /** Canonical class-doc name ("Shield Bash"). Never re-skinned. */
  base_name:         string;
  /** Snake-case class id ("knight", "street_samurai"). */
  class_id:          string;
  category:          AbilityCategory;
  /** Terse mechanical line — derived from docs/ability-library.md. */
  description:       string;
  /** Cross-class gate — present only on abilities the player learned
   *  outside their class. CLAUDE.md rule 165: own-class abilities have
   *  NO stat gate; cross-class abilities require ≥ 6 in `stat`. Always
   *  `min: 6` for cross-class today; the field carries the value
   *  explicitly so future variants can raise the bar. */
  stat_requirement?: { stat: AbilityStatShort; min: number };
  /** Base charges per combat (always 2 per CLAUDE.md). The runtime adds
   *  +1 per 2 levels in `charge_stat`, and +1 to Slot 1 at level 5. */
  base_charges:      number;
  /** Stat that drives the per-2-levels-in-this-stat charge bonus.
   *  Passives don't have a meaningful charge scaling, so the field is
   *  optional. */
  charge_stat?:      AbilityStatShort;
  /** True for the class passive — always active, never slotted, no
   *  charge accounting. Exactly one passive per class. */
  is_passive:        boolean;
  /** Slot the ability fills when equipped. Slot 1 is the fixed class
   *  identity; slot 2 unlocks at level 5; slots 3-4 at level 10/15.
   *  Undefined when `is_passive: true`. */
  slot_position?:    1 | 2 | 3 | 4;
  /** P7 — mechanical effect blueprint read by combat-engine.
   *  Undefined on passives + utility abilities whose effect is narrator
   *  flavour only. */
  effects?:          AbilityEffects;
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
  /** Day 23C — quest breadcrumb discovery + side-quest milestones.
   *  Log Book renders these with a "QUEST" tag prefix; the Journal
   *  modal owns the richer presentation. */
  QUEST     = "QUEST",
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
  /** Free-form effect map. Engine-consumed keys (Prompt 1):
   *    heal                 number          — flat HP restored on USE
   *    damage_die           "1d6" etc.      — weapon-only
   *    armor_bonus          number          — armor-only
   *    cure_status          StatusEffectId  — clear this ailment on USE
   *    apply_status         StatusEffectId  — apply to target on USE
   *    apply_status_chance  number          — 0-1, default 1.0
   *    apply_status_target  string          — "enemy"|"self", default "self"
   *    burst_damage         number          — flat damage dealt first (Fire Bomb) */
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
  /** P3 — true for player starting equipment. Starting gear has a
   *  sell value of 0 (CLAUDE.md ECONOMY BASELINE); sellItem refuses
   *  it with `no_value` regardless of the `value` field. */
  starting_item?: boolean;
  // ── Day 23A — Dungeon key items ──────────────────────────────────────────
  /** Day 23A — when true, this item is a story-named key found in a
   *  dungeon's middle chamber. Used by the boss-room USE-key flow:
   *  inventory check filters on is_key_item && unlocks_node === room. */
  is_key_item?: boolean;
  /** Day 23A — node id this key unlocks. Set on the Item alongside
   *  is_key_item. Consumed on USE-key, then removed from inventory. */
  unlocks_node?: string;
  // ── Prompt 1 — Status effects + damage types ─────────────────────────────
  /** Weapon: chance to inflict a status effect on hit (0-1). */
  on_hit_status?:      { id: StatusEffectId; chance: number };
  /** Armor: incoming-damage reductions by canonical damage type. */
  damage_resistances?: Partial<Record<DamageType, number>>;
  /** Armor / accessory: status effects this item prevents outright. */
  status_immunities?:  StatusEffectId[];
  // ── P6 — Lore item ability teaching ──────────────────────────────────────
  /** P6 — lore item: on first READ, adds the named ability to the
   *  player's learned_abilities pool (subject to the cross-class stat
   *  gate). Path 2 of the ability acquisition spec (rule 168). The
   *  rarity-vs-functions rule (rule 169) limits how many of these +
   *  other special fields a single item may carry. */
  teaches_ability?:    AbilityId;
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

// ---------------------------------------------------------------------------
// Day 23.5A — Species + damage types + player character profile
//
// Schema-only at this stage. UI, narrator wiring, and combat hooks land in
// later parts. The fields are declared now so the WCD generator can emit
// them at world creation and apply-world-*-bible can persist them at
// metadata.species / metadata.damage_type_aliases.
// ---------------------------------------------------------------------------

/** Canonical stat keys. Derived from Attributes — the names in this union
 *  MUST match Attributes property names so `Partial<Record<StatKey, number>>`
 *  is a structural subset of Attributes. Do not invent new stat names; the
 *  existing 5 are the system's truth. */
export type StatKey =
  | "strength"
  | "agility"
  | "charisma"
  | "intelligence"
  | "perception";

/** Canonical damage types across all genres. Trailing `| string` lets a
 *  world emit a custom canonical_type without breaking type-checking; the
 *  DamageTypeAlias table renames any canonical type to a world-specific
 *  display name (e.g. "void" → "the Whispering Cold"). */
export type DamageType =
  // Fantasy
  | "physical" | "fire" | "cold" | "poison"
  | "arcane"   | "holy" | "shadow"
  // Cyberpunk
  | "electric" | "thermal" | "toxic" | "emp" | "viral"
  // Horror
  | "psychic"  | "corruption" | "void"
  // Space Opera
  | "plasma"   | "radiation"  | "sonic"
  // Post-Apoc
  | "acid"
  // Shared / extensible
  | string;

export interface DamageTypeAlias {
  canonical_type: DamageType;
  world_name:     string;
  description:    string;
}

/** Prompt 5 — world-specific status effect rename. Same opt-in shape as
 *  DamageTypeAlias (the "rootblight" rule). Emitted by generate-wcd
 *  (shipped P2); the combat UI resolves display names off this via
 *  getStatusDisplayName. `description` is optional — the UI only needs
 *  canonical_id + world_name. */
export interface StatusEffectAlias {
  canonical_id: StatusEffectId;
  world_name:   string;
  description?: string;
}

/** Trait effect categories. effect_data carries the type-specific payload;
 *  most 23.5A traits ship as "flavor_only" until their mechanical systems
 *  are wired. */
export type TraitEffectType =
  | "resistance"
  | "skill_boost"
  | "combat_passive"
  | "environmental"
  | "social"
  | "regeneration"
  | "flavor_only";

export type EnvironmentalFlag =
  | "water_breathing"
  | "heat_adapted"
  | "cold_adapted"
  | "dark_vision"
  | "toxin_immune"
  | "radiation_resistant"
  | "void_adapted";

export interface PassiveTrait {
  id:          string;
  label:       string;
  description: string;
  effect_type: TraitEffectType;
  effect_data: Record<string, unknown>;
}

/** A playable species generated by the WCD. Two anchor species per world
 *  (Human + a genre-second) plus 1-2 world-specific entries that emerge
 *  from the WCD's atmosphere + world_rules. Mechanical effects (resistances,
 *  skill_affinities, etc.) are stored now and wired in subsequent rounds. */
export interface Species {
  id:                  string;
  name:                string;
  description:         string;
  lore_notes:          string;
  is_anchor:           boolean;
  /** When set, restricts this species to the listed genres. Anchor species
   *  use this to limit Human/Augmented/Mutant/etc. to their home genre. */
  available_in?:       Genre[];
  stat_modifiers:      Partial<Record<StatKey, number>>;
  skill_affinities:    Array<{ skill_id: string; modifier: number }>;
  resistances:         Partial<Record<DamageType, number>>;
  vulnerabilities:     Partial<Record<DamageType, number>>;
  passive_traits:      PassiveTrait[];
  environmental_flags: EnvironmentalFlag[];
  /** Cold-start disposition modifier applied to every NPC's trust score
   *  when the player's species_id is set. Range -15 to +15. */
  npc_disposition_seed: number;
  faction_affinities?: Array<{ faction_id: string; modifier: number }>;
}

// ── Player character profile (Day 23.5 character creation) ────────────────

export interface StartingBonus {
  type:              "item" | "gold";
  item_name?:        string;
  item_description?: string;
  gold_amount?:      number;
}

export interface OriginChoice {
  id:             string;
  label:          string;
  description:    string;
  starting_bonus: StartingBonus;
}

export interface AppearanceProfile {
  descriptors: string[];
  summary:     string;
}

/** The full character record written by the 23.5B character creation flow.
 *  Persisted at player_state.character_profile and read by the narrator
 *  for biographical references. */
export interface PlayerCharacterProfile {
  species_id: string;
  /** Day 23.5B — feeds narrator pronoun context so NPCs and prose
   *  refer to the player correctly. */
  gender:     "male" | "female";
  origin:     OriginChoice;
  appearance: AppearanceProfile;
  motivation: string;
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
  /** Day 22 — set true by handleVictory (combat-engine) when the
   *  awarded XP crosses the next XP threshold mid-combat. The
   *  LevelUpModal opens when this is true AND combat is no longer
   *  active, so the level-up beat lands after the resolution banner
   *  rather than interrupting the drain. Cleared by applyLevelUp. */
  pending_level_up?: boolean;
  /** Day 22 — copy of STAT_CAP cached on the player so the LevelUpModal
   *  can render "(Max)" labels without importing the constant. The
   *  authoritative cap lives in lib/game/constants.ts. */
  stat_cap?:   number;
  /** Day 23.5A — full character creation record (species, origin,
   *  appearance, motivation). Optional so legacy saves load cleanly;
   *  the character creation rework in 23.5B will populate this for
   *  every new game. Read by the narrator for biographical references. */
  character_profile?: PlayerCharacterProfile;
  // ── P6 — Ability system ──────────────────────────────────────────────────
  /** P6 — every ability the player has acquired this run (class +
   *  lore-item READs + NPC-taught). 5-7 entries by end-game per the
   *  pool/slot model (rule 166). New games start empty; P7 seeds slot
   *  1 + passive on class assignment. */
  learned_abilities:       AbilityId[];
  /** P6 — fixed-length 4-slot loadout. Slot 1 (index 0) is the class
   *  identity; slots 2-4 unlock at levels 5/10/15 (see
   *  getUnlockedSlotCount). A `null` entry = slot empty / not yet
   *  unlocked. Attunement (re-slotting) happens at settlements + Inn
   *  Rest in P7. */
  equipped_ability_slots:  [
    AbilityId | null,
    AbilityId | null,
    AbilityId | null,
    AbilityId | null,
  ];
  /** P6 — the class passive ability. Always active, never slotted.
   *  `null` until the class is assigned + the passive seeded (P7). */
  passive_ability:         AbilityId | null;
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

// ── Day 23A — Location & region typology ─────────────────────────────────────

/**
 * Day 23A — semantic node-type for a WorldGraph node. Refines the
 * coarser `category` field (which carries legacy `LocationDefinition.type`
 * strings) into a small fixed set the runtime + UI key off:
 *   • settlement_hub — Safe town with services
 *   • outpost — 1-2 NPCs, limited supplies, no full services
 *   • wilderness — Outdoor travel node, optional low encounter
 *   • dungeon — Dangerous multi-room structure (carries dungeon_rooms[])
 *   • landmark — Ruin / monument / sacred site; lore-rich
 *   • abandoned_settlement — Ruined former settlement
 */
export type LocationNodeType =
  | "settlement_hub"
  | "outpost"
  | "wilderness"
  | "dungeon"
  | "landmark"
  | "abandoned_settlement";

/**
 * Day 23A — region difficulty / character. Drives location-mix
 * generation in the WB/RB prompts (settled = settlement + dungeons +
 * landmarks; frontier = outposts + dungeons; hostile = no settlement,
 * higher encounter chance across the board).
 */
export type RegionType = "settled" | "frontier" | "hostile";

/**
 * Day 23A — locked-door schema. Only `"key"` lock type is implemented
 * for 23A; full lock variety (code / riddle / fragments / lore) is
 * Day 23C scope per quest-system-spec.md.
 */
export interface DungeonLock {
  /** Lock kind. Day 23A ships "key" only. */
  type:           "key";
  /** 1-2 sentence narrative description shown when the player clicks
   *  the locked nav card. Establishes WHY the door is sealed. */
  hint:           string;
  /** Item id required to unlock. Matches an Item.id stamped onto the
   *  player's inventory after the key item is taken from the dungeon's
   *  middle chamber. */
  key_item_id:    string;
  /** Display name for the key item — used in the USE-key button
   *  label and the templated unlock story-feed beat. */
  key_item_name:  string;
  /** True after the player has consumed the key item to open this
   *  door. Persists with the dungeon node so re-entry stays unlocked. */
  unlocked:       boolean;
}

/**
 * Day 23A — one room inside a dungeon node. Dungeons are 3-room
 * structures: entrance → middle → boss. Rooms live on the parent
 * dungeon WorldNode (dungeon_rooms[]) rather than as standalone
 * graph nodes — they're navigation children but never appear on
 * the world map.
 */
export interface DungeonRoom {
  /** Permanent slug — typically `${dungeon_id}_${entrance|middle|boss}`. */
  id:               string;
  /** Display name (e.g. "The Entrance Hall", "The Warden's Chamber"). */
  name:             string;
  /** 1-2 sentence room description shown on first entry. Stored on the
   *  room so room-to-room navigation skips the narrator API call. */
  description:      string;
  /** Structural slot. Drives nav-card labelling + boss-room lock. */
  room_type:        "entrance" | "middle" | "side" | "boss";
  /** Ids of adjacent rooms within the same dungeon. Entrance ↔ middle;
   *  middle ↔ boss. The boss connection from middle is rendered but
   *  blocked by `lock` until unlocked. */
  connections:      string[];
  /** Tier-1 objects (containers, fixtures, the key item) inside the
   *  room. Same schema as LocationDefinition.objects so the existing
   *  container-search + INTERACT pipeline applies unchanged. */
  objects:          LocationObject[];
  /** Probability of a combat encounter on FIRST entry — checked per
   *  room arrival (entrance ~0.5, middle ~0.7, boss 1.0). */
  encounter_chance: number;
  /** Lock metadata — present on boss rooms; undefined elsewhere. */
  lock?:            DungeonLock;
  /** True once the player has visited this room at least once.
   *  Read by revisit suppression (rule 86) so re-entry shows
   *  "You return to the {room name}." instead of re-describing. */
  discovered:       boolean;
}

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
  // ── Day 23A — Location variety + dungeon structure ───────────────────────
  /** Day 23A — semantic node-type. Refines `category` for the runtime
   *  + UI; mostly informational but `dungeon` is the trigger for the
   *  room-navigation system. Optional for legacy nodes; safe to treat
   *  `undefined` as "use the legacy category as a fallback". */
  node_type?:       LocationNodeType;
  /** Day 23A — region difficulty character. Set on region zone nodes
   *  only (type === "zone" + is_settlement_node === false). Drives
   *  WorldMap visual treatment + encounter weighting in 23B. */
  region_type?:     RegionType;
  /** Day 23A — for `node_type === "dungeon"` nodes, the 3-room
   *  structure (entrance → middle → boss). Rooms are navigation
   *  children of this node and never appear as top-level graph nodes
   *  on the world map. Undefined for non-dungeon nodes. */
  dungeon_rooms?:   DungeonRoom[];
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
  /** Day 23B — Main quest seed. The WCD picks the archetype that fits the
   *  world's theme most naturally and lays out the faction web + finale
   *  type. The WorldBible expands this into breadcrumbs, resolutions, and
   *  the world_intro_template. Optional so legacy WCDs still load. */
  main_quest?: {
    archetype:          QuestArchetype;
    threat_description: string;
    factions: Array<{
      id:          string;
      name:        string;
      role:        "defenders" | "exploiters" | "deniers";
      description: string;
    }>;
    finale_type:        FinaleType;
  };
  /** Day 23.5A — playable species. 3-4 entries per world: 2 anchors
   *  (Human + a genre-second except Horror) and 1-2 world-specific
   *  species that emerge from this WCD's atmosphere + world_rules.
   *  Optional so legacy saves load cleanly; apply-world-bible /
   *  apply-world-seed promote this to metadata.species at apply time. */
  species?: Species[];
  /** Day 23.5A — world-specific damage type renames. Default []; only
   *  1-2 aliases when world_rules / atmosphere strongly imply a renamed
   *  type. Most worlds use the canonical names directly. */
  damage_type_aliases?: DamageTypeAlias[];
  /** Prompt 5 — world-specific status effect renames. Default []; same
   *  opt-in rule as damage_type_aliases (the "rootblight" rule, rule
   *  174). Emitted by generate-wcd (shipped P2); the combat UI resolves
   *  status pill display names off this. Optional so legacy WCDs load. */
  status_effect_aliases?: StatusEffectAlias[];
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
  /** Day 21 — INTERACT routing class for is_interactable objects:
   *  - "container" → INTERACT rolls the loot resolver and drops items
   *    onto the floor strip. Search-once: subsequent INTERACT returns
   *    the templated already-searched response.
   *  - "fixture" / "lore" / "trigger" → INTERACT returns a templated
   *    empty / informational response with no LLM call and no loot
   *    roll.
   *  - Undefined → legacy behavior (INTERACT_SUCCESS, narrator runs).
   *  The apply-bible normalization passes promote at least one
   *  is_interactable object in every dungeon node to "container" so
   *  every combat-eligible room has something to loot. */
  type?:             "container" | "fixture" | "lore" | "trigger";
  /** Optional item ID if the object contains something. */
  contains_item_id?: string;
  /** Optional lore text revealed when the player examines it. */
  contains_lore?:    string;
  is_locked?:        boolean;
  /** Item ID required to unlock when is_locked is true. */
  unlock_requires?:  string;
  /** When true, examining this object delivers a quest breadcrumb. */
  quest_relevance?:  boolean;
  // ── Day 23A — Dungeon key items ──────────────────────────────────────────
  /** Day 23A — marks a LocationObject (or the Item it spawns) as the
   *  dungeon key item that unlocks a downstream room. Set on the
   *  middle-chamber object that contains the key + on the Item itself
   *  when it lands in player inventory. */
  is_key_item?:      boolean;
  /** Day 23A — when is_key_item is true, the room/node id this key
   *  unlocks. The locked nav card's USE-key handler matches against
   *  this. */
  unlocks_node?:     string;
  /** Day 23B — when set, this object is the seeded anchor for the named
   *  floating breadcrumb (e.g. "breadcrumb_act2"). apply-regional-bible
   *  reads this marker and stamps anchor_location_id on the matching
   *  QuestBreadcrumb so the discovery trigger (23C) knows which object
   *  unlocks the reveal. */
  quest_breadcrumb_id?: string;
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
  /** Day 23B — when set, this NPC carries dialogue or knowledge that
   *  anchors the named floating breadcrumb (e.g. "breadcrumb_act2").
   *  apply-regional-bible reads this marker and stamps the breadcrumb's
   *  anchor_location_id to the NPC's home_location_id. */
  quest_breadcrumb_id?: string;
  /** Day 23D — true when this NPC is a side-quest hook. The RegionBible
   *  prompt asks generators to mark 1-2 NPCs per region with this flag
   *  + a quest_seed sentence. generate-side-quests reads these markers
   *  to expand them into full SideQuest objects. */
  quest_hook?:       boolean;
  /** Day 23D — 1-sentence seed describing what this NPC needs/wants,
   *  embedded in their situation. Only meaningful when quest_hook is
   *  true. Should read as a situation, not a mission ("She's been
   *  waiting three weeks for a shipment that never arrived" — NOT
   *  "She wants the player to retrieve the shipment"). */
  quest_seed?:       string;
  is_merchant?:      boolean;
  /** What the merchant sells. */
  speciality?:       string;
  /** P3 — world-asset-backed merchant inventory. Seeded at
   *  WorldBible/RegionBible generation time, never narrator-generated.
   *  Depletes on purchase (item quantity → 0 = "Sold Out"); a sold
   *  item is bought back into this list. Undefined / empty = the
   *  merchant has nothing to sell. */
  merchant_inventory?: Item[];
  /** P3 — ItemTypes this merchant accepts when the player sells.
   *  Omitted = non-merchant NPC (accepts nothing). VALUABLE items are
   *  accepted by ANY merchant regardless of this list. */
  merchant_speciality?: ItemType[];
  /** Starting trust score (0-100). */
  default_trust:     number;
  /** Day 23.5A — id of a Species entry in metadata.species (or
   *  metadata.world_consistency.species). Optional so legacy NPCs and
   *  newly-generated NPCs that don't carry species data still load.
   *  The WorldBible prompt can opt-in to setting this on NPCs whose
   *  identity is shaped by their species. */
  species_id?:       string;
  /** Day 23.5A — explicit cold-start trust modifiers. toward_species
   *  keys are Species.id; toward_factions keys are WorldFaction.id.
   *  Values are integers ±N applied to default_trust when the player's
   *  species_id / faction membership matches the key. Most NPCs omit
   *  this; only NPCs whose history implies species or faction tension
   *  should carry it. */
  disposition_modifiers?: {
    toward_species:  Record<string, number>;
    toward_factions: Record<string, number>;
  };
  /** Day 23.5A — minimum trust score the player must reach before this
   *  NPC will accept a recruitment / faction-membership / quest-give
   *  prompt. Reserved for future systems; populated by the generator
   *  on NPCs the WorldBible flags as recruitable. */
  min_trust_to_recruit?: number;
  /** P6 — NPC-taught ability (rule 168 Path 3). When set, an NPC at
   *  trust ≥ 70-80 can teach this ability via a "learn_ability" dialogue
   *  option, adding it to the player's learned_abilities pool. The
   *  exact trust threshold is enforced by the runtime in P7; the type
   *  layer just carries the id. */
  teaches_ability?:      AbilityId;
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
  // ── Prompt 1 — Status effects + damage types ─────────────────────────────
  /** Bestiary-declared canonical damage type for this enemy's attacks.
   *  Used by armor.damage_resistances at the engine layer. */
  primary_damage_type?: DamageType;
  /** On-hit status application from bestiary. id + chance (0-1). */
  status_effect?:       { id: StatusEffectId; chance: number };
  /** Convenience flag for STR-themed enemies. When true and
   *  status_effect is absent, the engine spawns with a 20% WEAKENED
   *  status_effect on hit. */
  can_weaken?:          boolean;
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

// ---------------------------------------------------------------------------
// Day 23B — Main Quest schema
//
// Two related shapes:
//   • The WORLDBIBLE shape (declared inline on WorldBible.main_quest) is what
//     the LLM produces at world generation: title + archetype + threat +
//     factions + finale_type + breadcrumbs (no anchors yet) + resolutions +
//     world_intro_template. It does NOT carry runtime fields like
//     anchor_location_id / discovered / status — those are added at
//     apply-world-bible time when the runtime quest_threads slice is
//     initialized.
//   • The RUNTIME shape (MainQuest, below) is the live quest state stored in
//     MasterState.quest_threads. It carries the runtime additions:
//     anchor_location_id (set when a floating breadcrumb is seeded into a
//     region), discovered (set when the player triggers the breadcrumb),
//     status, active_resolution_id (set at climax), climax_location_id (set
//     when the dungeon boss room is wired in 23C).
//
// Archetype is INTERNAL — never surfaced to the player. The narrator must
// never mention it. See quest-system-spec.md §"The Six Archetypes".
// ---------------------------------------------------------------------------

export type QuestArchetype =
  | "ancient_awakening"
  | "power_vacuum"
  | "corruption"
  | "forbidden_knowledge"
  | "sacrifice"
  | "the_return";

export type FinaleType = "confrontation" | "choice" | "discovery";

export type QuestStatus = "active" | "completed" | "failed";

/** Runtime faction state — populated from the WB faction seed plus the
 *  npc_ids of NPCs the apply-world-bible / apply-regional-bible routes
 *  associate with this faction. Day 23B: npc_ids start empty and fill in
 *  as faction alignment is wired up across 23C/23D. */
export interface QuestFaction {
  id:          string;
  name:        string;
  role:        "defenders" | "exploiters" | "deniers";
  description: string;
  /** NPC asset ids ("character_<slug>") who belong to this faction. */
  npc_ids:     string[];
}

/** Runtime breadcrumb. Act 1 + climax are FIXED (always seeded at world gen,
 *  anchor_type "fixed"). Acts 2 + 3 are FLOATING — content baked at gen time
 *  but anchor_location_id is unset until a RegionBible expansion seeds them
 *  into an eligible region (rule per quest-system-spec §"Floating
 *  Breadcrumb Model"). */
export interface QuestBreadcrumb {
  id:                  string;
  act:                 1 | 2 | 3 | "climax";
  content:             string;
  anchor_type:         "fixed" | "floating";
  /** Location id where this breadcrumb was seeded. Undefined when the
   *  breadcrumb is still floating (Acts 2/3 before RegionBible anchoring). */
  anchor_location_id?: string;
  /** True once the player has triggered the breadcrumb (read the lore object,
   *  heard the NPC dialogue, etc.). */
  discovered:          boolean;
}

/** Two resolutions per world; one is the player's chosen ending after the
 *  climax. Both are valid endings — neither is secretly "wrong". */
export interface QuestResolution {
  id:                 "resolution_a" | "resolution_b";
  summary:            string;
  tone:               "hopeful" | "dark" | "ambiguous";
  /** Faction id this resolution favors. Set at WB time when the resolution
   *  is generated with knowledge of the faction web. */
  faction_alignment?: string;
}

export interface MainQuest {
  id:                    string;
  title:                 string;
  /** Internal-only. The narrator never references this. */
  archetype:             QuestArchetype;
  threat_description:    string;
  factions:              QuestFaction[];
  finale_type:           FinaleType;
  /** Dungeon boss room or world-unique climax site. Wired in 23C when the
   *  starting region's main dungeon is identified. */
  climax_location_id?:   string;
  breadcrumbs:           QuestBreadcrumb[];
  /** Exactly two — never more, never fewer. */
  resolutions:           [QuestResolution, QuestResolution];
  /** Set at climax when the player commits to a resolution. */
  active_resolution_id?: "resolution_a" | "resolution_b";
  status:                QuestStatus;
  /** Day 23C — LLM-generated diary entries written when a breadcrumb is
   *  discovered. Each entry's `quest_id` field stores the breadcrumb_id
   *  it belongs to (overloaded to associate entry → breadcrumb without a
   *  separate field). Rendered below the breadcrumb in the journal Main
   *  Quest tab. Optional so legacy saves load cleanly. */
  journal_entries?:      QuestEntry[];
}

export interface QuestEntry {
  id:        string;
  quest_id:  string;
  /** First-person, diary format. Generated by the journal-entry pipeline
   *  (23C) when the player discovers something quest-relevant. */
  text:      string;
  /** Insertion order. Journal sort key. */
  timestamp: number;
  /** True when this entry is also surfaced in the Log Book as a QUEST tag. */
  tagged:    boolean;
}

/** Day 23D — how a side quest is surfaced to the player when they meet
 *  the source. "npc_dialogue" = the NPC asks directly. "npc_rumor" = the
 *  NPC mentions a situation without asking for help. The Journal entry
 *  and discovery beat read identically; the difference is purely how
 *  the generator framed the NPC's voice. Post-23D adds object_examine,
 *  lore_read, environmental, item_pickup per the source taxonomy. */
export type QuestDiscoveryTrigger =
  | "npc_dialogue"
  | "npc_rumor"
  | "object_examine"
  | "lore_read"
  | "environmental"
  | "item_pickup";

/** Day 23D — machine-readable completion target. The runtime doesn't
 *  consume this in 23D scope (no completion logic yet), but the field is
 *  generated so the post-23D completion engine has structured anchors
 *  instead of LLM-prose-only objectives. */
export interface QuestCompletionCondition {
  type:      "item" | "location" | "enemy_defeated" | "npc_return";
  /** Item id, location id, enemy id, or NPC id depending on type. */
  target_id: string;
}

export interface SideQuest {
  id:                string;
  title:             string;
  status:            QuestStatus;
  /** Day 23D — see QuestDiscoveryTrigger. 23D scope: npc_dialogue +
   *  npc_rumor only. The other values are reserved for post-23D
   *  expansion per the source taxonomy. */
  source_type:       "npc" | "environment";
  /** NPC id or LocationObject id that started this quest. */
  source_id:         string;
  /** Day 23D — display name of the quest giver. NPC source_type only;
   *  environment quests leave this undefined and the journal renders
   *  the source LocationObject name instead. */
  giver_name?:       string;
  /** Day 23D — RegionBible region id this quest was generated in.
   *  Drives the "Region" badge in the journal so the player can scan
   *  quests by where they belong. */
  region_id?:        string;
  /** Day 23D — how this quest is delivered to the player. Decided by
   *  the generator based on the NPC's quest_seed wording. */
  discovery_trigger?: QuestDiscoveryTrigger;
  /** Day 23D — structured completion target. Optional for legacy data
   *  and future generators that only emit prose objectives. */
  completion_condition?: QuestCompletionCondition;
  /** Day 23D — 1-sentence hint at what the player gets for finishing.
   *  Surfaced in the journal only when set. */
  reward_hint?:      string;
  /** Day 23D — false until the player meets the quest-giver. The
   *  Journal hides undiscovered quests so the list grows organically.
   *  Defaults to false; useGameLoop's DIALOGUE trigger flips it true
   *  on the first successful conversation with source_id. */
  discovered?:       boolean;
  /** Directional, never a map pin. Shown at the top of the side-quest
   *  section of the journal. */
  current_objective: string;
  entries:           QuestEntry[];
  can_fail:          boolean;
  /** Plain-English description of what action fails the quest. Consumed by
   *  the side-quest engine (23D) on relevant player choices. */
  failure_trigger?:  string;
}

/** The slice of MasterState that owns all live quest state. Optional on
 *  MasterState so legacy saves load cleanly; apply-world-bible initializes
 *  it on every new game. */
export interface QuestThreads {
  main_quest?:          MainQuest;
  side_quests:          SideQuest[];
  /** Faction id → score in [-100, 100]. Tracks how the player has aligned
   *  with each faction's interests across the game. */
  faction_alignment:    Record<string, number>;
  completed_quest_ids:  string[];
  failed_quest_ids:     string[];
}

export interface RegionOutline {
  id:                   string;
  name:                 string;
  /** Region type — settlement_hub, wilderness, dungeon, port, ruin, stronghold, etc. */
  type:                 string;
  /** Day 23A — region difficulty character. Settled regions have a
   *  settlement_hub + dungeons + landmarks; frontier swaps settlement
   *  for outposts; hostile has no settlement at all and higher
   *  encounter chance everywhere. Drives both the RegionBible prompt's
   *  location-mix instructions when this outline expands and the
   *  WorldMap's region-tier visual treatment. Optional for legacy
   *  bibles generated before Day 23A — apply-world-bible's normalizer
   *  defaults to "settled" when missing. */
  region_type?:         RegionType;
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

  // ── Day 21 Loot ──────────────────────────────────────────────────────────
  /** Day 21 — 3-5 region-themed loot items generated at apply-regional-bible
   *  time. Layer 3 of the 3-layer loot model (static pool +
   *  world_loot_items + region_loot_items). Items here only spawn from
   *  encounters / containers in this region. Optional for legacy bibles. */
  region_loot_items?:   Item[];
  /** Day 21 — unique RARE reward for defeating this region's boss.
   *  Always a weapon or armor that feels like a trophy of the fight.
   *  Omitted when the region has no boss. */
  boss_drop_item?:      Item;
}

export interface WorldBible {
  starting_region:  RegionBible;
  /** Structural outlines of 3-5 adjacent regions. */
  adjacent_regions: RegionOutline[];
  /** Day 23B — bible-shape main quest. Distinct from the runtime MainQuest
   *  (which carries anchor_location_id / discovered / status / climax). The
   *  bible-shape carries archetype, threat description, factions WITHOUT
   *  npc_ids, breadcrumbs WITHOUT anchors, resolutions, and the
   *  world_intro_template (3-part second-person intro, {name}/{class}
   *  placeholders, resolved at game start). Optional so legacy WBs still
   *  parse — apply-world-bible falls back to a synthesized default. */
  main_quest?: {
    title:              string;
    archetype:          QuestArchetype;
    threat_description: string;
    factions: Array<{
      id:          string;
      name:        string;
      role:        "defenders" | "exploiters" | "deniers";
      description: string;
    }>;
    finale_type:        FinaleType;
    breadcrumbs: Array<{
      id:          string;
      act:         1 | 2 | 3 | "climax";
      content:     string;
      anchor_type: "fixed" | "floating";
    }>;
    resolutions: [
      { id: "resolution_a"; summary: string; tone: "hopeful" | "dark" | "ambiguous" },
      { id: "resolution_b"; summary: string; tone: "hopeful" | "dark" | "ambiguous" },
    ];
    world_intro_template: string;
  };
  /** ISO timestamp. */
  generated_at:     string;
  /** Day 21 — 6-8 world-themed loot items generated at apply-world-bible
   *  time. Layer 2 of the 3-layer loot model. Items native to this
   *  specific world's themes (mostly COMMON, some UNCOMMON, 1 RARE).
   *  Available everywhere in the world. Optional for legacy bibles. */
  world_loot_items?: Item[];
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
  /** Day 19B / Day 23B — Main quest from the WorldBible, stored on metadata
   *  so the game loop can plant breadcrumbs without re-fetching the full
   *  bible every turn. Day 23B redefined the shape — it now mirrors the
   *  WorldBible.main_quest bible shape (archetype, threat, factions
   *  without npc_ids, breadcrumbs without anchors, resolutions,
   *  world_intro_template). The runtime quest state — anchor_location_id,
   *  discovered flags, status, faction npc_ids — lives in
   *  MasterState.quest_threads instead. */
  main_quest?: WorldBible["main_quest"];
  /** Day 23B — Resolved world intro text, with {name} and {class}
   *  placeholders swapped from the player's character at game start. The
   *  game's new-game preamble (rule 42) reads this and emits it as the
   *  opening story-feed beat instead of the legacy "Your adventure
   *  begins..." line. Empty / undefined falls back to the legacy. */
  world_intro?: string;
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
  /** Day 23.5A — playable species hoisted from the WCD's species array
   *  at apply time. Top-level here (rather than reading via
   *  metadata.world_consistency.species) so the 23.5B character creation
   *  UI has a clean lookup path that doesn't depend on the world
   *  consistency document's storage shape. */
  species?: Species[];
  /** Day 23.5A — world-specific damage type renames hoisted from the
   *  WCD. Used by the narrator's combat copy + future loot generators
   *  to refer to canonical types by the world's chosen name. */
  damage_type_aliases?: DamageTypeAlias[];
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
  /** Day 21 — items + gold dropped at world nodes, awaiting player pickup.
   *  Survives navigation: a player can leave loot behind and return for
   *  it later. Each entry is keyed by node_id; FloorLootStrip filters
   *  to the current node when rendering. Empty entries are cleaned up
   *  by TAKE handlers when both items and gold reach zero. */
  floor_loot?:             FloorLootEntry[];
  /** Day 23A — active-dungeon navigation slice. Populated when the
   *  player is inside a dungeon node; cleared when they exit back to
   *  the parent region. Dungeon rooms aren't graph nodes — they live
   *  on the dungeon's WorldNode.dungeon_rooms[] array — so the runtime
   *  tracks "which room am I in" here.
   *
   *  node_id          — id of the dungeon WorldNode the player is in
   *  current_room_id  — id of the currently-occupied room within it
   *  rooms_visited    — ids of every room the player has entered at
   *                     least once. Read by the revisit-suppression
   *                     path to choose between the full room
   *                     description and "You return to …".
   */
  dungeon_state?: {
    node_id:         string;
    current_room_id: string;
    rooms_visited:   string[];
  };
  /** Day 23B — Live quest state. Initialized by apply-world-bible from the
   *  WorldBible's main_quest seed. Holds the runtime main quest (with
   *  anchor_location_id / discovered / status), discovered side quests,
   *  per-faction alignment score [-100..100], and the lists of completed /
   *  failed quest ids. Optional so old saves load cleanly. */
  quest_threads?: QuestThreads;
}

// ---------------------------------------------------------------------------
// Day 21 — Floor Loot
// ---------------------------------------------------------------------------

/**
 * One pile of items + gold dropped at a world node. Created on combat
 * victory (initially with `pending` set — the player must press SEARCH
 * REMAINS to materialize the loot) or on a container search (filled
 * immediately by the loot resolver). Persists across navigation: the
 * player may leave and return.
 *
 * Multiplayer schema (Day 24 layering point):
 *   - `owner` is null until a party member claims the pile.
 *   - Gold auto-splits between living party members at SEARCH REMAINS
 *     resolve time; on Day 21 (solo) the full amount goes to the
 *     player.
 */
export interface FloorLootEntry {
  /** UUID, stamped at entry creation. */
  id:       string;
  /** World node id where the loot dropped. FloorLootStrip filters
   *  to entries matching the player's current node. */
  node_id:  string;
  /** Items remaining in the pile. Empties as the player TAKEs them. */
  items:    Item[];
  /** Currency remaining in the pile (genre currency key resolved at
   *  pickup time). 0 once the player has taken the gold. */
  gold:     number;
  /** Day 24 — null = unclaimed; populated party-member id when claimed. */
  owner:    string | null;
  /** Where the pile came from. Drives the templated narrative beat
   *  and the FloorLootStrip's "SEARCH REMAINS" vs "[items]" display. */
  source:   "enemy" | "container";
  /** When present, the loot has not yet been rolled. FloorLootStrip
   *  shows a "SEARCH REMAINS" button instead of pills; clicking it
   *  calls resolveLoot per enemy_loot_ref, fills items + gold, then
   *  clears `pending`. The refs capture loot_table_id + is_boss so
   *  resolution doesn't need the bestiary at search time. */
  pending?: {
    enemy_instance_ids: string[];
    /** Prompt 1 — xp_value is propagated so loot-resolver can pick the
     *  correct gold tier (Tier 2 fires when xp_value >= 20). Optional
     *  for backwards-compat with pending entries persisted before this
     *  field existed. */
    enemy_loot_refs:    Array<{ loot_table_id: string; is_boss: boolean; xp_value?: number }>;
  };
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
  // ── Prompt 1 — Status effects + damage types ─────────────────────────────
  /** On-hit status application (mirrored from Enemy at spawn time). */
  status_effect?:       { id: StatusEffectId; chance: number };
  /** Canonical damage type (mirrored from Enemy at spawn time). */
  primary_damage_type?: DamageType;
  /** Effects currently applied to this enemy. Reserved for future
   *  player-→-enemy status application; engine currently writes to
   *  CombatState.player_status_effects only. */
  status_effects?:      ActiveStatusEffect[];
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
                         | "defeat"       | "flee_success"
                         | "status_applied" | "status_tick"
                         | "status_saved"   | "status_expired"
                         // P7 — ability dispatch
                         | "ability_used" | "ability_no_charges";
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
  // ── Prompt 1 — Status effects ────────────────────────────────────────────
  /** Effects currently applied to the player. Ticks at start of player
   *  turn; saves rolled at end of player turn. Dismissed with the rest
   *  of CombatState on victory / defeat / flee (rule 29). */
  player_status_effects?: ActiveStatusEffect[];
  // ── P7 — Ability charges ─────────────────────────────────────────────────
  /** P7 — uses-per-ability this combat. Charges reset automatically
   *  when the CombatState slice is dismissed on victory/defeat/flee
   *  (rule 29) — the next encounter spawns a fresh combat slice with
   *  an empty map. */
  ability_charges_used?: Record<AbilityId, number>;
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
   *    rest      → P3: innkeeper inn-rest action (10 gold → full HP).
   *    free      → opens the inline free-type input row (no speech yet).
   *    farewell  → closes the dialogue (no speech submitted).
   *  Legacy AI-generated options omit this and rely on `tone` alone. */
  type?:    "knowledge" | "trade" | "rest" | "free" | "farewell";
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
  /** V8.67 (Day 23D) — mirrored from NPCDefinition.quest_hook so the
   *  narrator DIALOGUE prompt can detect quest-hook NPCs without
   *  reading the region bible. Truthy only when the NPC is a side-
   *  quest source. */
  quest_hook?:           boolean;
  /** V8.67 (Day 23D) — mirrored from NPCDefinition.quest_seed. The
   *  1-sentence "situation" the narrator threads through the NPC's
   *  dialogue when they're a quest hook. Read by prompt-builder's
   *  ACTIVE NPC block under a SITUATION sub-section. */
  quest_seed?:           string;

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

  /** Day 23.5C — mirrored from NPCDefinition.disposition_modifiers so the
   *  trust-seed pipeline (state-utils.seedNpcRegistry) can read it without
   *  re-loading the world bible. Same shape as NPCDefinition's field; both
   *  sub-records are optional so apply-*-bible can write a partial mirror
   *  when only one axis is populated. */
  disposition_modifiers?: {
    toward_species?:  Record<string, number>;
    toward_factions?: Record<string, number>;
  };
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
