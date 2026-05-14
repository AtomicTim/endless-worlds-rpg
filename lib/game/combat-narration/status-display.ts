import type { StatusEffectAlias, StatusEffectId } from "@/types/game";

/**
 * Prompt 5 — status effect display naming.
 *
 * The combat UI surfaces status effects by a display name. By default
 * that's the capitalized canonical id ("poisoned" → "Poisoned"). When
 * the world's WCD declares a status_effect_alias for that id (the
 * "rootblight" rule — see generate-wcd / rule 174), the world-native
 * name is used instead.
 */

/** Structural shape covering the WCD's optional status_effect_aliases.
 *  A full WorldConsistencyDocument is assignable to this, so callers
 *  can pass metadata.world_consistency directly; tests can pass a
 *  minimal `{ status_effect_aliases: [...] }` object. */
export interface WcdStatusAliasSource {
  status_effect_aliases?: StatusEffectAlias[];
}

/** Capitalize a canonical status id for display ("burning" → "Burning"). */
export function capitalizeStatusId(id: string): string {
  if (!id) return id;
  return id.charAt(0).toUpperCase() + id.slice(1);
}

/**
 * Resolve a status effect id to its display name. Uses the world's
 * status_effect_alias when one exists, else the capitalized canonical
 * id. Safe to call with an undefined wcd.
 */
export function getStatusDisplayName(
  id:   StatusEffectId,
  wcd?: WcdStatusAliasSource
): string {
  const alias = wcd?.status_effect_aliases?.find((a) => a.canonical_id === id);
  return alias?.world_name ?? capitalizeStatusId(id);
}
