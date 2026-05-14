import type { Item } from "@/types/game";

/**
 * Day 23B (V8.61) — narrator output guards.
 *
 * The narrator is a creative-prose engine, NOT an authority on world state.
 * Specific kinds of state mutation are reserved to the engine. This module
 * holds the pure predicates / filters that the game loop applies to each
 * narrator response BEFORE writing any field to MasterState.
 */

/**
 * Rule 107 — Narrator never grants items.
 *
 * Sanctioned item-creation paths:
 *   • resolveLoot via container INTERACT   (engine-resolved, rule 84)
 *   • handleVictory → floor_loot drops     (combat loot,    rule 83)
 *   • buyItem (merchant trade)             (mechanical commerce)
 *
 * Pre-rule-107 the narrator's `items_acquired` field flowed into
 * `addToInventory` unconditionally, letting the LLM invent and grant
 * arbitrary items whenever its prose described "you find …". This filter
 * is the explicit drop point — narrator items_acquired never reach
 * inventory, regardless of count, rarity, or framing.
 *
 * Returns the empty array. The caller logs a diagnostic when the narrator
 * tried (so we can tune the system prompt if violations persist), but the
 * inventory mutation never happens.
 */
export function acceptNarratorItemsAcquired(items: Item[] | undefined): Item[] {
  void items;
  return [];
}
