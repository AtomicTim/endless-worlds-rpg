/**
 * Day 21 — global gameplay constants.
 *
 * Tunables that don't belong to any one module live here so adjusting
 * them is a one-line change. Treat as locked design values; flag any
 * change to the team before tuning.
 */

/**
 * Maximum unique inventory rows on a single player. The 21st pickup
 * is refused at the TAKE handler level — the FloorLootStrip's item
 * pills go disabled with a "(Inventory Full)" warning, but gold pills
 * remain active because gold lives in `player_state.resources`, not
 * `inventory`. Day 21 single-player; the Day 24 multiplayer round
 * will recompute caps per party member.
 *
 * Stackable items (potions, ammo) consume ONE slot regardless of
 * quantity. Equipped gear still occupies its slot.
 */
export const INVENTORY_CAP = 20;
