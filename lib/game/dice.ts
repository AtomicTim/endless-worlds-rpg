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

/** D&D-style ability modifier: floor((score - 10) / 2). */
export function getAttributeModifier(score: number): number {
  return Math.floor((score - 10) / 2);
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
