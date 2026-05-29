/**
 * PR-11v-d — canonical damage type colour / duration / label system.
 *
 * One module owns the {damage_type → colour, duration, display label}
 * mapping so the float layer (CombatMode.makeFloatingEntry) and the
 * combatant card (CombatantRow enemy subtitle) can't drift. New
 * surfaces (codex entries, item tooltips, ability cards) plug into
 * the same table.
 *
 * Aliases (cyberpunk "thermal" / horror "corruption" / etc.) collapse
 * onto a small palette by genre family so the colours stay readable
 * across a 5-genre game. The DamageType union in types/game.ts is the
 * source of truth for the supported keys; this table is keyed on
 * `string` so an unknown / undefined damage_type falls through the
 * default branch in getDamageTypeColor (`#e0d8c0` physical).
 *
 * Holy was lifted from #ffdc40 to #c8940a (amber gold) in PR-11v-d so
 * holy reads as distinct from lightning (#ffee40) at a glance.
 */

/** Per-damage-type float / accent colour. */
export const DAMAGE_TYPE_COLOR: Partial<Record<string, string>> = {
  physical:   "#e0d8c0",
  fire:       "#ff7030",
  thermal:    "#ff7030",
  plasma:     "#ff7030",
  frost:      "#60d8ff",
  cold:       "#60d8ff",
  sonic:      "#60d8ff",
  poison:     "#80e040",
  toxic:      "#80e040",
  acid:       "#80e040",
  viral:      "#80e040",
  lightning:  "#ffee40",
  electric:   "#ffee40",
  emp:        "#ffee40",
  radiation:  "#ffee40",
  shadow:     "#c060ff",
  arcane:     "#c060ff",
  psychic:    "#c060ff",
  void:       "#c060ff",
  corruption: "#c060ff",
  holy:       "#c8940a",
  bleed:      "#ff3060",
  // heal is not a DamageType but the float system reuses this table.
  heal:       "#7abb7a",
};

/** Animation duration override (ms) per damage type. Types not listed
 *  fall back to the float system's default (1100ms). */
export const DAMAGE_TYPE_DURATION: Partial<Record<string, number>> = {
  fire:      900,
  thermal:   900,
  plasma:    900,
  lightning: 750,
  electric:  750,
  emp:       750,
  frost:     1400,
  cold:      1400,
  sonic:     1400,
};

/** Display label shown next to the damage_die on enemy combat cards.
 *  Physical resolves to the empty string so the label simply hides
 *  (no need to clutter every card with "PHYSICAL"). */
export const DAMAGE_TYPE_LABEL: Partial<Record<string, string>> = {
  physical:   "",
  fire:       "FIRE",
  thermal:    "FIRE",
  plasma:     "FIRE",
  frost:      "FROST",
  cold:       "FROST",
  sonic:      "FROST",
  poison:     "POISON",
  toxic:      "POISON",
  acid:       "POISON",
  viral:      "POISON",
  lightning:  "LIGHTNING",
  electric:   "LIGHTNING",
  emp:        "LIGHTNING",
  radiation:  "RADIATION",
  shadow:     "SHADOW",
  arcane:     "SHADOW",
  psychic:    "SHADOW",
  void:       "SHADOW",
  corruption: "SHADOW",
  holy:       "HOLY",
  bleed:      "BLEED",
};

/** Resolve a damage type string to its canonical colour. Falls back
 *  to physical (#e0d8c0) for unknown / undefined inputs so a missing
 *  primary_damage_type renders as the neutral cream rather than
 *  breaking the layout. */
export function getDamageTypeColor(type: string | undefined): string {
  return DAMAGE_TYPE_COLOR[type ?? ""] ?? "#e0d8c0";
}
