import type {
  MasterState, Perk, PerkId, PlayerState, StatusEffectId,
} from "@/types/game";

/**
 * P8 — Perks library + resolution helpers.
 *
 * Pure data + functions. No React, no hooks. The LevelUpModal calls
 * `drawPerkOptions` to render the 3-card picker and `applyPerkEffects`
 * to commit the chosen perk's mechanical effect into MasterState.
 *
 * Unlock cadence: every 4 combat levels — 4, 8, 12, 16, 20. Five picks
 * total per playthrough.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Library
// ─────────────────────────────────────────────────────────────────────────────

/** ~20-entry pool, fantasy-default naming. The engine applies the
 *  mechanical effect generically; UI-12 will overlay genre-themed
 *  renames if/when the design calls for it. */
const ENTRIES: Perk[] = [
  // ── Combat (5) ───────────────────────────────────────────────────────
  {
    id:          "iron_skin",
    name:        "Iron Skin",
    category:    "combat",
    description: "+4 max HP. You weather blows that would fell lesser folk.",
    effect:      { type: "max_hp_bonus", amount: 4 },
  },
  {
    id:          "momentum",
    name:        "Momentum",
    category:    "combat",
    description: "+1 charge to all ability slots — your rhythm carries forward.",
    effect:      { type: "charge_bonus", amount: 1 },
  },
  {
    id:          "veterans_eye",
    name:        "Veteran's Eye",
    category:    "combat",
    description: "+1 Perception. You read the field a half-step before others do.",
    effect:      { type: "stat_bonus", stat: "per", amount: 1 },
  },
  {
    id:          "toughened",
    name:        "Toughened",
    category:    "combat",
    description: "25% chance to shrug off WEAKENED before it lands.",
    effect:      { type: "status_resist", status: "weakened", reduction_pct: 0.25 },
  },
  {
    id:          "relentless",
    name:        "Relentless",
    category:    "combat",
    description: "+1 Strength. Each round you fight a little harder than the last.",
    effect:      { type: "stat_bonus", stat: "str", amount: 1 },
  },

  // ── Status resist (4) ────────────────────────────────────────────────
  {
    id:          "clearheaded",
    name:        "Clearheaded",
    category:    "status",
    description: "30% chance to resist FRIGHTENED — fear finds no purchase.",
    effect:      { type: "status_resist", status: "frightened", reduction_pct: 0.30 },
  },
  {
    id:          "fireproof",
    name:        "Fireproof",
    category:    "status",
    description: "25% chance to resist BURNING. Flame slides off you.",
    effect:      { type: "status_resist", status: "burning", reduction_pct: 0.25 },
  },
  {
    id:          "frostwalker",
    name:        "Frostwalker",
    category:    "status",
    description: "25% chance to resist CHILLED. Cold cannot slow you.",
    effect:      { type: "status_resist", status: "chilled", reduction_pct: 0.25 },
  },
  {
    id:          "antitoxin",
    name:        "Antitoxin",
    category:    "status",
    description: "25% chance to resist POISONED. Venoms struggle to take root.",
    effect:      { type: "status_resist", status: "poisoned", reduction_pct: 0.25 },
  },

  // ── Ability (5) ──────────────────────────────────────────────────────
  {
    id:          "channelled_power",
    name:        "Channelled Power",
    category:    "ability",
    description: "+1 Intelligence. Insight sharpens with practice.",
    effect:      { type: "stat_bonus", stat: "int", amount: 1 },
  },
  {
    id:          "arcane_reserve",
    name:        "Arcane Reserve",
    category:    "ability",
    description: "+1 charge to every ability slot — a deeper well to draw from.",
    effect:      { type: "charge_bonus", amount: 1 },
  },
  {
    id:          "quick_study",
    name:        "Quick Study",
    category:    "ability",
    description: "Your next attunement will surface an extra ability option.",
    effect:      { type: "passive" },
  },
  {
    id:          "focused_mind",
    name:        "Focused Mind",
    category:    "ability",
    description: "+1 Perception. You notice patterns mid-fight.",
    effect:      { type: "stat_bonus", stat: "per", amount: 1 },
  },
  {
    id:          "battle_mage",
    name:        "Battle Mage",
    category:    "ability",
    description: "Your first ability each combat costs no charge.",
    effect:      { type: "passive" },
  },

  // ── World (6) ────────────────────────────────────────────────────────
  {
    id:          "appraiser",
    name:        "Appraiser",
    category:    "world",
    description: "+15% gold from all sources. You know what a thing is worth.",
    effect:      { type: "gold_bonus_pct", amount: 15 },
  },
  {
    id:          "seasoned",
    name:        "Seasoned",
    category:    "world",
    description: "+10% XP from all sources. Lessons stick.",
    effect:      { type: "xp_bonus_pct", amount: 10 },
  },
  {
    id:          "wayfarer",
    name:        "Wayfarer",
    category:    "world",
    description: "The narrator notes your road-weary experience in conversations.",
    effect:      { type: "passive" },
  },
  {
    id:          "silver_tongue",
    name:        "Silver Tongue",
    category:    "world",
    description: "+1 Charisma. Words slide easy and find the right ears.",
    effect:      { type: "stat_bonus", stat: "cha", amount: 1 },
  },
  {
    id:          "keen_eye",
    name:        "Keen Eye",
    category:    "world",
    description: "+1 Perception. Details speak to those who look twice.",
    effect:      { type: "stat_bonus", stat: "per", amount: 1 },
  },
  {
    id:          "fortunes_favour",
    name:        "Fortune's Favour",
    category:    "world",
    description: "The narrator sometimes describes small lucky moments in your favour.",
    effect:      { type: "passive" },
  },
];

/** Keyed by id for O(1) lookup. Frozen — perks are hardcoded data. */
export const PERK_LIBRARY: Readonly<Record<PerkId, Perk>> =
  Object.freeze(Object.fromEntries(ENTRIES.map((p) => [p.id, p])));

/** The full pool, in declaration order. Useful for tests + UI prototyping. */
export function getPerkPool(): Perk[] {
  return ENTRIES.slice();
}

// ─────────────────────────────────────────────────────────────────────────────
// Level-up cadence
// ─────────────────────────────────────────────────────────────────────────────

const PERK_LEVELS = new Set<number>([4, 8, 12, 16, 20]);

/** Whether `level` is a perk-unlock gate (every 4 combat levels). */
export function isPerkLevel(level: number): boolean {
  return PERK_LEVELS.has(level);
}

// ─────────────────────────────────────────────────────────────────────────────
// Draw helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Return `count` perks the player doesn't already own, sampled randomly
 * from the pool. Deterministic when `rng` is injected (tests pass a
 * cycler); defaults to Math.random.
 *
 * Pool smaller than count → returns whatever's left without padding.
 */
export function drawPerkOptions(
  playerPerks: PerkId[],
  count: number = 3,
  rng:   () => number = Math.random,
): Perk[] {
  const owned = new Set(playerPerks);
  const available = ENTRIES.filter((p) => !owned.has(p.id));
  if (available.length <= count) return available.slice();
  // Fisher-Yates shuffle, take first `count`.
  const arr = available.slice();
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, count);
}

// ─────────────────────────────────────────────────────────────────────────────
// Effect application
// ─────────────────────────────────────────────────────────────────────────────

/** Stat short → full Attributes key. */
const STAT_KEY = {
  str: "strength",
  agi: "agility",
  int: "intelligence",
  per: "perception",
  cha: "charisma",
} as const;

/**
 * Apply the perk's mechanical effect to MasterState. Returns a new
 * MasterState — pure / no mutation.
 *
 * NOTE: this does NOT push the perk id onto player.perks; the caller
 * (LevelUpModal) does that separately so the test contract "passive
 * perks → state unchanged" stays clean (a passive perk only updates
 * the perks list, which is gameplay bookkeeping, not a mechanical
 * effect).
 *
 * Unknown perk id is a no-op (defensive — should never happen at
 * runtime; the picker only surfaces ids drawn from PERK_LIBRARY).
 */
export function applyPerkEffects(
  state:  MasterState,
  perkId: PerkId,
): MasterState {
  const perk = PERK_LIBRARY[perkId];
  if (!perk) return state;
  const effect = perk.effect;
  const player: PlayerState = state.player_state;

  switch (effect.type) {
    case "stat_bonus": {
      const key = STAT_KEY[effect.stat];
      return {
        ...state,
        player_state: {
          ...player,
          attributes: {
            ...player.attributes,
            [key]: (player.attributes[key] ?? 0) + effect.amount,
          },
        },
      };
    }
    case "max_hp_bonus": {
      // Mirror the level-up convention: bump both max and current so the
      // bar doesn't render at partial HP after the perk lands.
      return {
        ...state,
        player_state: {
          ...player,
          max_health: player.max_health + effect.amount,
          health:     player.health     + effect.amount,
        },
      };
    }
    case "charge_bonus": {
      return {
        ...state,
        player_state: {
          ...player,
          perk_charge_bonus: (player.perk_charge_bonus ?? 0) + effect.amount,
        },
      };
    }
    case "status_resist": {
      const current = player.perk_status_resist ?? {};
      const prior   = current[effect.status] ?? 0;
      const next    = Math.min(1, prior + effect.reduction_pct);
      const map: Partial<Record<StatusEffectId, number>> = { ...current };
      map[effect.status] = next;
      return {
        ...state,
        player_state: { ...player, perk_status_resist: map },
      };
    }
    case "gold_bonus_pct": {
      return {
        ...state,
        player_state: {
          ...player,
          perk_gold_bonus_pct: (player.perk_gold_bonus_pct ?? 0) + effect.amount,
        },
      };
    }
    case "xp_bonus_pct": {
      return {
        ...state,
        player_state: {
          ...player,
          perk_xp_bonus_pct: (player.perk_xp_bonus_pct ?? 0) + effect.amount,
        },
      };
    }
    case "passive":
      // Narrator-only / handled elsewhere. No state delta.
      return state;
  }
}
