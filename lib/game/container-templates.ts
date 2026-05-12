import type { Genre, Item } from "@/types/game";
import { currencyLabelFor } from "./currency";

/**
 * Day 21 — container search narrative templates (TASK 7 spec).
 *
 * Two helpers:
 *   - getEmptyContainerTemplate: returns a templated "already
 *     searched / can't search this" line keyed on the object's
 *     `type` field (and a fuzzy match on its name for legacy
 *     objects without a type tag). Routes the player away from
 *     burning an LLM call for things that don't loot.
 *
 *   - getSearchNarrative: returns the templated beat that pops in
 *     the story feed the FIRST time a container is searched —
 *     enumerates the items + gold. Empty containers delegate to
 *     getEmptyContainerTemplate.
 *
 * Both are pure / sync; both are safe to call from useGameLoop's
 * short-circuit branches. No store access, no LLM, no React.
 */

/**
 * Pick the right "this container is empty" line based on the
 * object's type (preferred) or a fuzzy match on its name (fallback
 * for legacy LocationObjects without a `type` field).
 */
export function getEmptyContainerTemplate(
  object_name: string,
  object_type?: string
): string {
  const name = object_name?.trim() || "the container";
  const nameLower = name.toLowerCase();

  // Type → template lookup. Order matters: more specific
  // descriptors (bones / shelf) before generic ones (container).
  if (object_type === "container" || /\bchest\b/.test(nameLower)) {
    return `${name} has already been opened and picked clean.`;
  }
  if (/\b(barrel|crate)\b/.test(nameLower)) {
    return `${name} is empty save for the smell of rot.`;
  }
  if (/\bbones?\b/.test(nameLower) || /pile of bones/.test(nameLower)) {
    return "The bones scatter at your touch, leaving nothing but dust.";
  }
  if (/\b(shelf|bookshelf|bookcase)\b/.test(nameLower)) {
    return `${name} has been stripped bare.`;
  }
  if (object_type === "fixture") {
    return `${name} is solid and immovable — nothing to take.`;
  }
  if (object_type === "lore") {
    return `${name} reveals nothing new on a second look.`;
  }
  if (object_type === "trigger") {
    return `${name} has already done its work.`;
  }
  return `You search ${name} and find nothing of value.`;
}

/**
 * Build the search-success beat for a container. Lists found items
 * with rarity + a gold tally. Falls through to the empty template
 * when nothing was rolled — keeps the player feedback consistent.
 *
 * Currency label resolves from genre (Fantasy → "Gold",
 * Cyberpunk → "Credits", Horror → "Marks", etc).
 */
export function getSearchNarrative(
  container_name: string,
  items: Item[],
  gold:  number,
  genre: Genre | string
): string {
  const name      = container_name?.trim() || "the container";
  const hasItems  = items.length > 0;
  const hasGold   = gold > 0;
  if (!hasItems && !hasGold) {
    return getEmptyContainerTemplate(container_name);
  }
  const currency = currencyLabelFor(genre);
  if (hasItems && hasGold) {
    return `You search ${name} and uncover ${formatItemList(items)} and ${gold} ${currency}.`;
  }
  if (hasItems) {
    return `You search ${name} and find ${formatItemList(items)}.`;
  }
  // gold only
  return `You search ${name} and find ${gold} ${currency}.`;
}

/**
 * Format an item list with Oxford commas. Mirrors the encounter
 * banner's `formatEnemyList` helper so the prose has a consistent
 * voice across systems.
 */
function formatItemList(items: Item[]): string {
  const names = items.map((i) => i.name).filter((s) => s && s.trim().length > 0);
  if (names.length === 0) return "nothing of note";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  const head = names.slice(0, -1).join(", ");
  const tail = names[names.length - 1];
  return `${head}, and ${tail}`;
}
