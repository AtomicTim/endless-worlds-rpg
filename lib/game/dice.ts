// Seedable dice utilities. When a seed is supplied, rolls are deterministic
// (Numerical Recipes LCG). When omitted, rolls fall back to Math.random().

const LCG_MULTIPLIER = 1664525;
const LCG_INCREMENT  = 1013904223;

function lcgStep(seed: number): number {
  // Unsigned 32-bit wrap.
  return (Math.imul(seed, LCG_MULTIPLIER) + LCG_INCREMENT) >>> 0;
}

function rollDie(sides: number, seed?: number): number {
  if (seed === undefined) {
    return Math.floor(Math.random() * sides) + 1;
  }
  return (lcgStep(seed) % sides) + 1;
}

// ── Public API ────────────────────────────────────────────────────────────────

export function rollD20(seed?: number): number {
  return rollDie(20, seed);
}

export function rollD6(seed?: number): number {
  return rollDie(6, seed);
}

export function rollD4(seed?: number): number {
  return rollDie(4, seed);
}

/**
 * Ability modifier calibrated for our 2-10 stat range (V8.51+).
 *
 *   score 2-3 → +0    score 6-7 →  +2
 *   score 4-5 → +1    score 8-9 →  +3
 *   score 10  → +4    (max achievable)
 *
 * NOT the D&D 5e formula. Our stats span 2-10 with archetype starting
 * values around 2-4; the D&D formula `floor((score - 10) / 2)` would
 * give every starting character a negative modifier on most checks.
 * Combat / stat-check / CharacterSheet display all read through this
 * helper or combat-engine's internal `abilityMod` (same formula),
 * so display + math stay consistent.
 */
export function getAttributeModifier(score: number): number {
  return Math.floor((score - 2) / 2);
}

export function rollWithAdvantage(seed?: number): number {
  if (seed === undefined) {
    return Math.max(rollD20(), rollD20());
  }
  // Use the LCG step to derive a second deterministic seed for the second die.
  return Math.max(rollD20(seed), rollD20(lcgStep(seed)));
}

export function rollWithDisadvantage(seed?: number): number {
  if (seed === undefined) {
    return Math.min(rollD20(), rollD20());
  }
  return Math.min(rollD20(seed), rollD20(lcgStep(seed)));
}
