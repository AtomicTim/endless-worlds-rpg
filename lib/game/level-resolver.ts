import type { Attributes, PlayerState } from "@/types/game";
import {
  HP_PER_LEVEL,
  LEVEL_CAP,
  STAT_CAP,
  XP_THRESHOLDS,
} from "./constants";
import { getArchetype } from "./archetypes";

/**
 * Day 22 — leveling resolver.
 *
 * Pure functions, no MasterState mutation, no React. Mirrors the
 * combat-resolver pattern: callers (route handler, useCombat,
 * LevelUpModal) compose these into game-store updates.
 *
 * Three core functions:
 *   • checkLevelUp     — has the player crossed their next threshold?
 *   • resolveLevelUp   — compute auto gains for the new level
 *   • applyLevelUp     — splice gains (including the player-chosen free
 *                        point) into a player state, capped at STAT_CAP
 *
 * Plus a couple of small UI helpers (xpForNextLevel) that keep the
 * CharacterSheet's XP bar math in this module instead of duplicating
 * the constants.
 */

// ─────────────────────────────────────────────────────────────────────────────
// XP / threshold helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Total XP required to reach the level AFTER `currentLevel`. Returns
 * null when the player has hit LEVEL_CAP (no further progression).
 *
 *   currentLevel = 1 → XP_THRESHOLDS[0] = 100
 *   currentLevel = 9 → XP_THRESHOLDS[8] = 2300
 *   currentLevel = 10 → null (capped)
 */
export function xpForNextLevel(currentLevel: number): number | null {
  if (currentLevel < 1 || currentLevel >= LEVEL_CAP) return null;
  return XP_THRESHOLDS[currentLevel - 1] ?? null;
}

/**
 * Did the player cross at least one XP threshold? Returns the highest
 * level reachable from `xp` (could be multiple level-ups if a single
 * fight awarded a huge bounty — defensive support; current XP pacing
 * never crosses two thresholds at once but the resolver handles it).
 *
 * NOTE: result.new_level is clamped to LEVEL_CAP. `leveled_up: false`
 * when currentLevel is already at LEVEL_CAP regardless of XP, so
 * over-cap XP simply accumulates without triggering modals.
 */
export function checkLevelUp(
  xp:           number,
  currentLevel: number
): { leveled_up: boolean; new_level: number } {
  if (currentLevel >= LEVEL_CAP) {
    return { leveled_up: false, new_level: currentLevel };
  }
  let level = currentLevel;
  while (level < LEVEL_CAP) {
    const threshold = XP_THRESHOLDS[level - 1];
    if (typeof threshold !== "number" || xp < threshold) break;
    level += 1;
  }
  return {
    leveled_up: level > currentLevel,
    new_level:  level,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Level-up resolution
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Auto gains for one level-up plus the player-chosen free stat slot.
 * The modal renders the auto gains for confirmation, then the player
 * picks `free_stat` and calls applyLevelUp.
 *
 * `auto_stat_gains` is a partial because each archetype only touches
 * two stats; the other three rows stay untouched.
 */
export interface LevelUpResult {
  new_level:        number;
  primary_stat:     keyof Attributes;
  secondary_stat:   keyof Attributes;
  /** Set by the LevelUpModal once the player picks their +1. Absent
   *  on the result returned from resolveLevelUp — applyLevelUp is
   *  responsible for honouring it (or omitting if undefined). */
  free_stat?:       keyof Attributes;
  hp_gained:        number;
  auto_stat_gains:  Partial<Attributes>;
}

/**
 * Compute the auto-gain bundle for a level-up. Does NOT include the
 * free point — the modal collects that separately.
 *
 * @param background   the player's archetype string (knight/rogue/…)
 * @param currentLevel the level the player just COMPLETED (i.e. the
 *                     level before the gain). The result.new_level is
 *                     currentLevel + 1, clamped to LEVEL_CAP.
 */
export function resolveLevelUp(
  background:   string,
  currentLevel: number
): LevelUpResult {
  // Default-archetype fallback: STR/AGI baseline + +5 HP. Never fires
  // in practice (every shipped background is in ARCHETYPE_MAP) but
  // keeps the function total for tests + future-proofing.
  const arch = getArchetype(background) ?? {
    primary:   "strength" as keyof Attributes,
    secondary: "agility"  as keyof Attributes,
  };

  const new_level = Math.min(LEVEL_CAP, currentLevel + 1);
  const hp_gained = HP_PER_LEVEL[arch.primary] ?? 5;

  return {
    new_level,
    primary_stat:   arch.primary,
    secondary_stat: arch.secondary,
    hp_gained,
    auto_stat_gains: {
      [arch.primary]:   1,
      [arch.secondary]: 1,
    } as Partial<Attributes>,
  };
}

/**
 * Apply a fully-decided LevelUpResult (auto gains + the player's free
 * stat pick) to a player state. Returns a partial PlayerState slice
 * the caller merges into MasterState. Pure — no mutation.
 *
 * Capping: every attribute is clamped to STAT_CAP after the gain.
 * pending_level_up is cleared regardless of whether anything actually
 * grew, so the modal can re-fire on the NEXT threshold crossing.
 *
 * HP: max_health rises by hp_gained, and current health is RESTORED
 * to the new max. HF-levelup-hp — leveling up is a beat that should
 * feel restorative ("you grow stronger and shake off your wounds"),
 * not "you grew but you're still bleeding". Topping off also avoids
 * the awkward case where a low-HP victory triggers a level-up that
 * then leaves the player still in the danger zone HP band.
 */
export function applyLevelUp(
  player: PlayerState,
  result: LevelUpResult
): Partial<PlayerState> {
  const nextAttrs: Attributes = { ...player.attributes };

  // Auto gains — primary + secondary +1 each (capped).
  for (const [stat, delta] of Object.entries(result.auto_stat_gains) as Array<[keyof Attributes, number]>) {
    if (typeof delta !== "number" || delta === 0) continue;
    nextAttrs[stat] = Math.min(STAT_CAP, nextAttrs[stat] + delta);
  }

  // Player-chosen free point — only honoured when the player picked
  // one (modal cannot confirm without a pick, but applyLevelUp is also
  // called by STAT_XP fast-apply with free_stat as the only delta).
  if (result.free_stat) {
    nextAttrs[result.free_stat] = Math.min(
      STAT_CAP,
      nextAttrs[result.free_stat] + 1
    );
  }

  const newMaxHealth = player.max_health + result.hp_gained;
  return {
    attributes:       nextAttrs,
    max_health:       newMaxHealth,
    health:           newMaxHealth,
    level:            result.new_level,
    pending_level_up: false,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// STAT_XP fast-apply
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Apply a single +1 to a chosen stat, capped at STAT_CAP. Used by the
 * STAT_XP consumable path (out-of-combat picker, mid-combat auto-apply
 * to primary). Returns the new Attributes — caller threads it through
 * the player state.
 */
export function applyStatBoost(
  player: PlayerState,
  stat:   keyof Attributes
): Attributes {
  return {
    ...player.attributes,
    [stat]: Math.min(STAT_CAP, player.attributes[stat] + 1),
  };
}
