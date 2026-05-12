import { ItemType, ItemRarity, Genre } from "@/types/game";
import type { Attributes, Item } from "@/types/game";

/**
 * Day 20.1 — starting equipment configs (TASK 1).
 *
 * Lives in lib/ rather than app/api/game/new/route.ts because Next.js
 * App Router route files are forbidden from exporting anything other
 * than HTTP method handlers (GET/POST/etc) and a small whitelist of
 * config symbols. Tests + the route handler both import from here.
 *
 * Every background ships with a fully-functional combat loadout: an
 * equipped weapon with damage_die, an equipped armor piece with
 * armor_bonus, plus class-flavor consumables / lore items. The
 * combat-engine's `weaponDamageDie()` and `playerArmorBonus()` lookups
 * read from `inventory.find(i => i.equipped && i.type === WEAPON|ARMOR)`
 * and fall back to fists / 0 armor when nothing matches.
 *
 * Health potions reuse the canonical `consumable_basic_health_potion`
 * id so the Use Item flow in CombatMode resolves them through
 * `resolveUseItem` (keyed on that id for the 1d8+4 heal).
 */

export interface StartingItem {
  name:        string;
  type:        ItemType;
  description: string;
  /** WEAPONs + ARMOR start equipped; consumables / lore / keys do not. */
  equipped?:   boolean;
  effect?: {
    damage_die?:  string;   // for WEAPON
    armor_bonus?: number;   // for ARMOR
    heal?:        number;   // for CONSUMABLE
  };
  /** Defaults to 1 when unspecified. */
  quantity?:   number;
  /** Consumables are stackable by default; weapons/armor are not. */
  stackable?:  boolean;
  /** Stable id override — used for the basic health potion so the
   *  combat resolver's BASIC_HEALTH_POTION_ID lookup matches. Other
   *  items get a per-row crypto.randomUUID() at build time. */
  id?:         string;
}

export interface BackgroundConfig {
  bonusAttribute: keyof Attributes;
  startingItems:  StartingItem[];
}

/** Stable id for the basic health potion — matches combat-resolver's
 *  BASIC_HEALTH_POTION_ID + makeStubItem in combat-engine. Two stacked
 *  potions share this row id; UseItemPicker fires use_item with this id
 *  and resolveUseItem returns the 1d8+4 heal. */
export const BASIC_HEALTH_POTION_ID = "consumable_basic_health_potion";

/** Convenience builder for the 2× health potion stack present in every
 *  starting loadout (genre-flavored name, same mechanical effect). */
function healthPotion(name: string, description: string): StartingItem {
  return {
    id:          BASIC_HEALTH_POTION_ID,
    name,
    type:        ItemType.CONSUMABLE,
    description,
    effect:      { heal: 8 },
    quantity:    2,
    stackable:   true,
  };
}

export const BACKGROUND_CONFIGS: Record<Genre, Record<string, BackgroundConfig>> = {
  // ── Fantasy ──────────────────────────────────────────────────────────────
  [Genre.FANTASY]: {
    knight: {
      bonusAttribute: "strength",
      startingItems: [
        {
          name:        "Iron Sword",
          type:        ItemType.WEAPON,
          equipped:    true,
          effect:      { damage_die: "1d6" },
          description: "A well-balanced iron sword, worn but reliable.",
        },
        {
          name:        "Chainmail",
          type:        ItemType.ARMOR,
          equipped:    true,
          effect:      { armor_bonus: 2 },
          description: "Interlocking iron rings sewn to a padded gambeson. Heavy but trustworthy.",
        },
        healthPotion(
          "Basic Health Potion",
          "A small vial of red liquid that restores some health.",
        ),
      ],
    },
    rogue: {
      bonusAttribute: "agility",
      startingItems: [
        {
          name:        "Dagger",
          type:        ItemType.WEAPON,
          equipped:    true,
          effect:      { damage_die: "1d4" },
          description: "A slim, well-balanced dagger. Quick to draw, quick to strike.",
        },
        {
          name:        "Leather Tunic",
          type:        ItemType.ARMOR,
          equipped:    true,
          effect:      { armor_bonus: 1 },
          description: "Soft, supple leather. Doesn't slow you down.",
        },
        {
          name:        "Lockpicks",
          type:        ItemType.KEY,
          description: "A set of delicate picks. Not many doors remain closed to you.",
        },
        healthPotion(
          "Basic Health Potion",
          "A small vial of red liquid that restores some health.",
        ),
      ],
    },
    mage: {
      bonusAttribute: "intelligence",
      startingItems: [
        {
          name:        "Staff",
          type:        ItemType.WEAPON,
          equipped:    true,
          effect:      { damage_die: "1d6" },
          description: "A wooden staff banded with iron. Conducts more than walking weight.",
        },
        {
          name:        "Robes",
          type:        ItemType.ARMOR,
          equipped:    true,
          effect:      { armor_bonus: 0 },
          description: "Loose woven robes. Minimal protection, maximal freedom of motion.",
        },
        {
          name:        "Spell Tome",
          type:        ItemType.LORE,
          description: "A tome of basic arcane knowledge. The ink seems to shift when unobserved.",
        },
        healthPotion(
          "Basic Health Potion",
          "A small vial of red liquid that restores some health.",
        ),
      ],
    },
    // Day 22 — new class. PER primary, AGI secondary. Hunter / scout
    // identity: tracks and reads the land.
    ranger: {
      bonusAttribute: "perception",
      startingItems: [
        {
          name:        "Hunting Bow",
          type:        ItemType.WEAPON,
          equipped:    true,
          effect:      { damage_die: "1d6" },
          description: "Yew limbs, waxed string. Heavier draw than it looks.",
        },
        {
          name:        "Traveler's Cloak",
          type:        ItemType.ARMOR,
          equipped:    true,
          effect:      { armor_bonus: 1 },
          description: "Oiled wool, hooded. Doesn't snag on briars and turns most rain.",
        },
        {
          name:        "Rolled Map",
          type:        ItemType.LORE,
          description: "A weathered map of the borderlands. Several places marked, none labelled.",
        },
        healthPotion(
          "Basic Health Potion",
          "A small vial of red liquid that restores some health.",
        ),
      ],
    },
    // Day 22 — new class. CHA primary, INT secondary. Diplomat / orator
    // identity: opens doors through standing rather than steel.
    herald: {
      bonusAttribute: "charisma",
      startingItems: [
        {
          name:        "Fine Rapier",
          type:        ItemType.WEAPON,
          equipped:    true,
          effect:      { damage_die: "1d6" },
          description: "Slender, balanced, etched with a noble crest. Carried as much for ceremony as combat.",
        },
        {
          name:        "Formal Attire",
          type:        ItemType.ARMOR,
          equipped:    true,
          effect:      { armor_bonus: 0 },
          description: "Court doublet and embroidered cloak. Looks like nothing; opens many doors.",
        },
        {
          name:        "Letter of Introduction",
          type:        ItemType.KEY,
          description: "Sealed parchment from a patron of standing. Few guards stop a bearer who holds it openly.",
        },
        healthPotion(
          "Basic Health Potion",
          "A small vial of red liquid that restores some health.",
        ),
      ],
    },
  },
  // ── Cyberpunk ────────────────────────────────────────────────────────────
  [Genre.CYBERPUNK]: {
    netrunner: {
      bonusAttribute: "intelligence",
      startingItems: [
        {
          name:        "Neural Deck",
          type:        ItemType.WEAPON,
          equipped:    true,
          effect:      { damage_die: "1d6" },
          description: "A jury-rigged interface deck. Doubles as a stunbaton in a pinch.",
        },
        {
          name:        "Nano-Armor Mesh",
          type:        ItemType.ARMOR,
          equipped:    true,
          effect:      { armor_bonus: 1 },
          description: "A thin lattice of reactive fibers under your jacket.",
        },
        healthPotion(
          "Stim Patch",
          "Adhesive nanotech patch — dumps healing compounds straight into the bloodstream.",
        ),
      ],
    },
    fixer: {
      bonusAttribute: "charisma",
      startingItems: [
        {
          name:        "Compact Pistol",
          type:        ItemType.WEAPON,
          equipped:    true,
          effect:      { damage_die: "1d6" },
          description: "Small, smart, and very illegal. Untraceable serial.",
        },
        {
          name:        "Nano-Armor Mesh",
          type:        ItemType.ARMOR,
          equipped:    true,
          effect:      { armor_bonus: 1 },
          description: "A thin lattice of reactive fibers under your jacket.",
        },
        {
          name:        "Burner Phone",
          type:        ItemType.KEY,
          description: "Pre-loaded with a dozen untraceable contacts. Handle with care.",
        },
        healthPotion(
          "Stim Patch",
          "Adhesive nanotech patch — dumps healing compounds straight into the bloodstream.",
        ),
      ],
    },
    street_samurai: {
      bonusAttribute: "agility",
      startingItems: [
        {
          name:        "Katana",
          type:        ItemType.WEAPON,
          equipped:    true,
          effect:      { damage_die: "1d8" },
          description: "A mono-edged blade. Old-world steel. Doesn't need batteries.",
        },
        {
          name:        "Reinforced Jacket",
          type:        ItemType.ARMOR,
          equipped:    true,
          effect:      { armor_bonus: 2 },
          description: "Carbon-fiber weave under leather. Stops most low-velocity rounds.",
        },
        healthPotion(
          "Stim Patch",
          "Adhesive nanotech patch — dumps healing compounds straight into the bloodstream.",
        ),
      ],
    },
    // Day 22 — new class. STR primary, AGI secondary. Corp muscle /
    // bouncer identity: makes problems disappear with kinetic answers.
    enforcer: {
      bonusAttribute: "strength",
      startingItems: [
        {
          name:        "Heavy Baton",
          type:        ItemType.WEAPON,
          equipped:    true,
          effect:      { damage_die: "1d8" },
          description: "Telescoping alloy baton with a weighted cap. Less lethal — mostly.",
        },
        {
          name:        "Reinforced Coat",
          type:        ItemType.ARMOR,
          equipped:    true,
          effect:      { armor_bonus: 2 },
          description: "Long coat layered with kevlar inserts. Bulky but stops a knife cold.",
        },
        healthPotion(
          "Stim Patch",
          "Adhesive nanotech patch — dumps healing compounds straight into the bloodstream.",
        ),
      ],
    },
    // Day 22 — new class. PER primary, AGI secondary. Recon / infiltrator
    // identity: reads rooms before entering them.
    ghost: {
      bonusAttribute: "perception",
      startingItems: [
        {
          name:        "Silenced Pistol",
          type:        ItemType.WEAPON,
          equipped:    true,
          effect:      { damage_die: "1d6" },
          description: "Subsonic rounds, integral suppressor. Whispers louder than it shoots.",
        },
        {
          name:        "Adaptive Camo Mesh",
          type:        ItemType.ARMOR,
          equipped:    true,
          effect:      { armor_bonus: 1 },
          description: "Photoreactive fibres laced through dark fabric. Reads the ambient light and blends.",
        },
        {
          name:        "Signal Scanner",
          type:        ItemType.KEY,
          description: "Palm-sized scanner that maps comms traffic. Sees doors before they open.",
        },
        healthPotion(
          "Stim Patch",
          "Adhesive nanotech patch — dumps healing compounds straight into the bloodstream.",
        ),
      ],
    },
  },
  // ── Horror / Lovecraftian ────────────────────────────────────────────────
  [Genre.HORROR_LOVECRAFTIAN]: {
    investigator: {
      bonusAttribute: "intelligence",
      startingItems: [
        {
          name:        "Service Revolver",
          type:        ItemType.WEAPON,
          equipped:    true,
          effect:      { damage_die: "1d8" },
          description: "Six chambers. Heavy in the hand and steady when it matters.",
        },
        {
          name:        "Leather Coat",
          type:        ItemType.ARMOR,
          equipped:    true,
          effect:      { armor_bonus: 1 },
          description: "Long coat of dark leather. Travels well. Hides much.",
        },
        {
          name:        "Case Notes",
          type:        ItemType.LORE,
          description: "Pages of investigation notes. The last entry trails off mid-sentence.",
        },
        healthPotion(
          "First-Aid Kit",
          "Bandages, antiseptic, a single morphine ampule. Patches a bad cut.",
        ),
      ],
    },
    cultist: {
      bonusAttribute: "perception",
      startingItems: [
        {
          name:        "Ritual Dagger",
          type:        ItemType.WEAPON,
          equipped:    true,
          effect:      { damage_die: "1d4" },
          description: "A bone-handled dagger etched with sigils that ache to read.",
        },
        {
          name:        "Cult Robes",
          type:        ItemType.ARMOR,
          equipped:    true,
          effect:      { armor_bonus: 0 },
          description: "Coarse robes stained with old wax and older intent.",
        },
        {
          name:        "Forbidden Text",
          type:        ItemType.LORE,
          description: "A fragment of a text that should not exist. Reading it costs something.",
        },
        healthPotion(
          "First-Aid Kit",
          "Bandages, antiseptic, a single morphine ampule. Patches a bad cut.",
        ),
      ],
    },
    survivor: {
      bonusAttribute: "strength",
      startingItems: [
        {
          name:        "Makeshift Club",
          type:        ItemType.WEAPON,
          equipped:    true,
          effect:      { damage_die: "1d4" },
          description: "Table leg, nails, duct tape. It works.",
        },
        {
          name:        "Scavenged Padding",
          type:        ItemType.ARMOR,
          equipped:    true,
          effect:      { armor_bonus: 1 },
          description: "Strapped-on layers of canvas and leather. Smells of mildew.",
        },
        healthPotion(
          "First-Aid Kit",
          "Bandages, antiseptic, a single morphine ampule. Patches a bad cut.",
        ),
      ],
    },
    // Day 22 — new class. AGI primary, PER secondary. Backstreet
    // killer / haunted operator identity.
    phantom: {
      bonusAttribute: "agility",
      startingItems: [
        {
          name:        "Straight Razor",
          type:        ItemType.WEAPON,
          equipped:    true,
          effect:      { damage_die: "1d4" },
          description: "Folding razor honed to a hair-splitter. Quick, quiet, and never empty.",
        },
        {
          name:        "Dark Coat",
          type:        ItemType.ARMOR,
          equipped:    true,
          effect:      { armor_bonus: 1 },
          description: "Long coat of black wool, lined with concealed pockets. The collar hides the face.",
        },
        healthPotion(
          "First-Aid Kit",
          "Bandages, antiseptic, a single morphine ampule. Patches a bad cut.",
        ),
      ],
    },
    // Day 22 — new class. CHA primary, INT secondary. Spirit-talker /
    // séance leader identity: pulls truth from the dead and the credulous.
    medium: {
      bonusAttribute: "charisma",
      startingItems: [
        {
          name:        "Silver-Tipped Cane",
          type:        ItemType.WEAPON,
          equipped:    true,
          effect:      { damage_die: "1d4" },
          description: "Ebony cane with a silver pommel. Walking stick by day, club by night.",
        },
        {
          name:        "Séance Vestments",
          type:        ItemType.ARMOR,
          equipped:    true,
          effect:      { armor_bonus: 0 },
          description: "Dark robes worn for the parlour. The fabric holds incense smoke for days.",
        },
        {
          name:        "Ritual Focus",
          type:        ItemType.LORE,
          description: "A small bone-and-silver pendulum. It moves when no hand moves it.",
        },
        healthPotion(
          "First-Aid Kit",
          "Bandages, antiseptic, a single morphine ampule. Patches a bad cut.",
        ),
      ],
    },
  },
  // ── Space Opera ──────────────────────────────────────────────────────────
  [Genre.SPACE_OPERA]: {
    commander: {
      bonusAttribute: "charisma",
      startingItems: [
        {
          name:        "Service Sidearm",
          type:        ItemType.WEAPON,
          equipped:    true,
          effect:      { damage_die: "1d6" },
          description: "Standard-issue plasma sidearm. Reliable. Loud.",
        },
        {
          name:        "Officer's Uniform",
          type:        ItemType.ARMOR,
          equipped:    true,
          effect:      { armor_bonus: 1 },
          description: "Reinforced ceremonial coat. The braid means people listen.",
        },
        {
          name:        "Command Badge",
          type:        ItemType.KEY,
          description: "Worn insignia of rank. Doors open. Crews listen. Sometimes.",
        },
        healthPotion(
          "Medkit",
          "Standard fleet medkit. Auto-injector and quick-seal patches.",
        ),
      ],
    },
    pilot: {
      bonusAttribute: "agility",
      startingItems: [
        {
          name:        "Light Pistol",
          type:        ItemType.WEAPON,
          equipped:    true,
          effect:      { damage_die: "1d6" },
          description: "Compact sidearm rated for vacuum. Fast on the draw.",
        },
        {
          name:        "Flight Suit",
          type:        ItemType.ARMOR,
          equipped:    true,
          effect:      { armor_bonus: 1 },
          description: "Pressure-rated suit. Reinforced at joints and sternum.",
        },
        {
          name:        "Nav Charts",
          type:        ItemType.LORE,
          description: "Star charts of the outer sectors. Several routes are marked unsafe.",
        },
        healthPotion(
          "Medkit",
          "Standard fleet medkit. Auto-injector and quick-seal patches.",
        ),
      ],
    },
    engineer: {
      bonusAttribute: "intelligence",
      startingItems: [
        {
          name:        "Tool-Laser",
          type:        ItemType.WEAPON,
          equipped:    true,
          effect:      { damage_die: "1d6" },
          description: "Cutting torch repurposed for unfriendly hardware. Burns through most plating.",
        },
        {
          name:        "Work Coveralls",
          type:        ItemType.ARMOR,
          equipped:    true,
          effect:      { armor_bonus: 1 },
          description: "Heavy-duty engineering coveralls — reinforced knees, steel toes.",
        },
        {
          name:        "Engineer's Toolkit",
          type:        ItemType.KEY,
          description: "Multi-tool with calibrated instruments. You can fix almost anything.",
        },
        healthPotion(
          "Medkit",
          "Standard fleet medkit. Auto-injector and quick-seal patches.",
        ),
      ],
    },
    // Day 22 — new class. STR primary, AGI secondary. Boarding-action
    // shock trooper identity.
    marine: {
      bonusAttribute: "strength",
      startingItems: [
        {
          name:        "Assault Rifle",
          type:        ItemType.WEAPON,
          equipped:    true,
          effect:      { damage_die: "1d8" },
          description: "Standard-pattern caseless rifle. Heavy. Bites hard at close range.",
        },
        {
          name:        "Combat Armor",
          type:        ItemType.ARMOR,
          equipped:    true,
          effect:      { armor_bonus: 2 },
          description: "Composite plate over reactive mesh. Adds weight and confidence in equal measure.",
        },
        healthPotion(
          "Medkit",
          "Standard fleet medkit. Auto-injector and quick-seal patches.",
        ),
      ],
    },
    // Day 22 — new class. PER primary, AGI secondary. Long-range scout
    // identity: eyes on the target before anyone else has them.
    recon: {
      bonusAttribute: "perception",
      startingItems: [
        {
          name:        "Sniper Carbine",
          type:        ItemType.WEAPON,
          equipped:    true,
          effect:      { damage_die: "1d6" },
          description: "Short-barrel marksman rifle. Optics calibrated to atmosphere and gravity.",
        },
        {
          name:        "Scout Suit",
          type:        ItemType.ARMOR,
          equipped:    true,
          effect:      { armor_bonus: 1 },
          description: "Low-profile suit threaded with thermal baffles. Slips past most sensor sweeps.",
        },
        {
          name:        "Tactical Scanner",
          type:        ItemType.KEY,
          description: "Compact spotting scope with networked uplink. Flags hostiles before they flag you.",
        },
        healthPotion(
          "Medkit",
          "Standard fleet medkit. Auto-injector and quick-seal patches.",
        ),
      ],
    },
  },
  // ── Post-Apocalyptic ─────────────────────────────────────────────────────
  [Genre.POST_APOCALYPTIC]: {
    scavenger: {
      bonusAttribute: "perception",
      startingItems: [
        {
          name:        "Pipe Rifle",
          type:        ItemType.WEAPON,
          equipped:    true,
          effect:      { damage_die: "1d8" },
          description: "Welded-up scrap rifle. Single-shot. Loud as hell.",
        },
        {
          name:        "Scrap Armor",
          type:        ItemType.ARMOR,
          equipped:    true,
          effect:      { armor_bonus: 1 },
          description: "Plates and pads strapped over canvas. Heavy but it stops things.",
        },
        {
          name:        "Scrap Tool",
          type:        ItemType.KEY,
          description: "A repurposed multi-tool salvaged from the ruins. Worth its weight.",
        },
        healthPotion(
          "Medkit",
          "Crumpled tin box of bandages, antibiotics, and a syringe of who-knows-what.",
        ),
      ],
    },
    raider: {
      bonusAttribute: "strength",
      startingItems: [
        {
          name:        "Pipe Wrench",
          type:        ItemType.WEAPON,
          equipped:    true,
          effect:      { damage_die: "1d6" },
          description: "Heavy. Durable. Persuasive.",
        },
        {
          name:        "Spiked Plate",
          type:        ItemType.ARMOR,
          equipped:    true,
          effect:      { armor_bonus: 2 },
          description: "Welded plates studded with rebar spikes. Ugly. Effective.",
        },
        healthPotion(
          "Medkit",
          "Crumpled tin box of bandages, antibiotics, and a syringe of who-knows-what.",
        ),
      ],
    },
    medic: {
      bonusAttribute: "intelligence",
      startingItems: [
        {
          name:        "Hatchet",
          type:        ItemType.WEAPON,
          equipped:    true,
          effect:      { damage_die: "1d6" },
          description: "Single-bit hatchet, edge honed. For wood, mostly.",
        },
        {
          name:        "Duster",
          type:        ItemType.ARMOR,
          equipped:    true,
          effect:      { armor_bonus: 1 },
          description: "Long canvas duster, quilted lining. Cuts the wind. Cuts a knife.",
        },
        {
          name:        "First Aid Kit",
          type:        ItemType.CONSUMABLE,
          description: "Half-depleted but still useful. Bandages, antibiotics, a tourniquet.",
        },
        healthPotion(
          "Medkit",
          "Crumpled tin box of bandages, antibiotics, and a syringe of who-knows-what.",
        ),
      ],
    },
    // Day 22 — new class. AGI primary, PER secondary. Courier /
    // wasteland scrambler identity: moves while everyone else digs in.
    runner: {
      bonusAttribute: "agility",
      startingItems: [
        {
          name:        "Carbon-Fibre Blade",
          type:        ItemType.WEAPON,
          equipped:    true,
          effect:      { damage_die: "1d6" },
          description: "Salvaged composite blade. Lighter than steel, sharper than it should be.",
        },
        {
          name:        "Runner's Leathers",
          type:        ItemType.ARMOR,
          equipped:    true,
          effect:      { armor_bonus: 1 },
          description: "Stripped-down leathers cut for speed. Plates removed, motion preserved.",
        },
        healthPotion(
          "Medkit",
          "Crumpled tin box of bandages, antibiotics, and a syringe of who-knows-what.",
        ),
      ],
    },
    // Day 22 — new class. CHA primary, INT secondary. Wasteland orator
    // identity: rallies the desperate into a following.
    demagogue: {
      bonusAttribute: "charisma",
      startingItems: [
        {
          name:        "Modified Pistol",
          type:        ItemType.WEAPON,
          equipped:    true,
          effect:      { damage_die: "1d6" },
          description: "Customised sidearm with a flared barrel. Loud enough to silence a crowd.",
        },
        {
          name:        "Long Coat",
          type:        ItemType.ARMOR,
          equipped:    true,
          effect:      { armor_bonus: 0 },
          description: "Patched canvas duster strung with badges. The badges mean things to the right people.",
        },
        {
          name:        "Rallying Manifesto",
          type:        ItemType.LORE,
          description: "Hand-bound pamphlet of slogans and parables. The kind of thing that builds a following.",
        },
        healthPotion(
          "Medkit",
          "Crumpled tin box of bandages, antibiotics, and a syringe of who-knows-what.",
        ),
      ],
    },
  },
};

/** Build a final Item row from a StartingItem spec. */
export function buildItem(spec: StartingItem): Item {
  return {
    id:          spec.id ?? crypto.randomUUID(),
    name:        spec.name,
    type:        spec.type,
    rarity:      ItemRarity.COMMON,
    description: spec.description,
    quantity:    spec.quantity ?? 1,
    stackable:   spec.stackable ?? (spec.type === ItemType.CONSUMABLE),
    ...(spec.equipped ? { equipped: true } : {}),
    ...(spec.effect ? { effect: { ...spec.effect } } : {}),
  };
}

/**
 * Build the full starting inventory for a genre × background. Returns
 * the items array + the bonus attribute the route handler should bump.
 * Returns an empty payload when the combo isn't configured (unknown
 * background under a known genre, etc.) — caller falls back to the
 * default state-factory inventory.
 */
export function buildStartingInventory(
  genre:      Genre,
  background: string
): { items: Item[]; bonusAttribute: keyof Attributes | null } {
  const cfg = BACKGROUND_CONFIGS[genre]?.[background];
  if (!cfg) return { items: [], bonusAttribute: null };
  return {
    items:          cfg.startingItems.map(buildItem),
    bonusAttribute: cfg.bonusAttribute,
  };
}
