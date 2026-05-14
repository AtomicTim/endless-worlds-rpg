import type { Attributes } from "@/types/game";
import {
  STAT_BASE,
  STAT_PRIMARY_BONUS,
  STAT_SECONDARY_BONUS,
} from "./constants";

/**
 * Day 22 — archetype map.
 *
 * The class chosen at character creation IS the archetype (Option B
 * from Day 22 design decisions). Each background maps to a primary
 * stat and a secondary stat. These drive:
 *
 *   • Starting attribute distribution — primary +STAT_PRIMARY_BONUS (2),
 *     secondary +STAT_SECONDARY_BONUS (1), other 3 stats stay at STAT_BASE.
 *   • Per-level auto gains — primary +1, secondary +1, plus HP scaled by
 *     HP_PER_LEVEL[primary] (STR archetypes scale durably, AGI moderately,
 *     casters/finesse +5 baseline).
 *   • Mid-combat STAT_XP fast-apply target (auto-pumps the primary so
 *     the player doesn't have to choose mid-fight).
 *
 * 25 entries — 5 classes × 5 genres. Matches project-log.md's locked
 * Day 22 archetype table. Pure lookup; no React or game-loop imports.
 */

export interface ArchetypeConfig {
  primary:   keyof Attributes;
  secondary: keyof Attributes;
}

export const ARCHETYPE_MAP: Record<string, ArchetypeConfig> = {
  // ── Fantasy ────────────────────────────────────────────────────────────────
  knight:         { primary: "strength",     secondary: "agility"      },
  rogue:          { primary: "agility",      secondary: "perception"   },
  mage:           { primary: "intelligence", secondary: "perception"   },
  ranger:         { primary: "perception",   secondary: "agility"      },
  herald:         { primary: "charisma",     secondary: "intelligence" },

  // ── Cyberpunk ──────────────────────────────────────────────────────────────
  netrunner:      { primary: "intelligence", secondary: "perception"   },
  fixer:          { primary: "charisma",     secondary: "intelligence" },
  street_samurai: { primary: "agility",      secondary: "strength"     },
  enforcer:       { primary: "strength",     secondary: "agility"      },
  ghost:          { primary: "perception",   secondary: "agility"      },

  // ── Horror / Lovecraftian ──────────────────────────────────────────────────
  investigator:   { primary: "intelligence", secondary: "perception"   },
  cultist:        { primary: "perception",   secondary: "intelligence" },
  survivor:       { primary: "strength",     secondary: "agility"      },
  phantom:        { primary: "agility",      secondary: "perception"   },
  medium:         { primary: "charisma",     secondary: "intelligence" },

  // ── Space Opera ────────────────────────────────────────────────────────────
  commander:      { primary: "charisma",     secondary: "intelligence" },
  pilot:          { primary: "agility",      secondary: "perception"   },
  engineer:       { primary: "intelligence", secondary: "strength"     },
  marine:         { primary: "strength",     secondary: "agility"      },
  recon:          { primary: "perception",   secondary: "agility"      },

  // ── Post-Apocalyptic ───────────────────────────────────────────────────────
  scavenger:      { primary: "perception",   secondary: "intelligence" },
  raider:         { primary: "strength",     secondary: "agility"      },
  medic:          { primary: "intelligence", secondary: "charisma"     },
  runner:         { primary: "agility",      secondary: "perception"   },
  demagogue:      { primary: "charisma",     secondary: "intelligence" },
};

/**
 * Return the archetype config for a background, or null if the
 * background isn't registered. The route handler + level resolver use
 * the null branch to fall back to flat baselines.
 */
export function getArchetype(background: string): ArchetypeConfig | null {
  return ARCHETYPE_MAP[background] ?? null;
}

/**
 * Build the starting attribute distribution for a background:
 *   • All stats begin at STAT_BASE.
 *   • Primary stat receives +STAT_PRIMARY_BONUS.
 *   • Secondary stat receives +STAT_SECONDARY_BONUS.
 *   • Other three stats stay at STAT_BASE.
 *
 * When the background isn't a registered archetype (legacy backgrounds,
 * test fixtures), every stat stays at STAT_BASE — equivalent to a "null
 * archetype" who gets no bonuses. The caller is responsible for any
 * downstream warning the player should see.
 */
export function buildStartingAttributes(background: string): Attributes {
  const attrs: Attributes = {
    strength:     STAT_BASE,
    agility:      STAT_BASE,
    intelligence: STAT_BASE,
    perception:   STAT_BASE,
    charisma:     STAT_BASE,
  };
  const cfg = ARCHETYPE_MAP[background];
  if (!cfg) return attrs;
  attrs[cfg.primary]   += STAT_PRIMARY_BONUS;
  attrs[cfg.secondary] += STAT_SECONDARY_BONUS;
  return attrs;
}
