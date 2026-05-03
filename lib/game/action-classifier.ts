import { ActionType, ItemType } from "@/types/game";
import type { MasterState, ParsedAction } from "@/types/game";

// ── Intent keyword testers ────────────────────────────────────────────────────

export const isEquipIntent = (s: string) => /\b(equip|unequip|wear|wield)\b/i.test(s);
export const isDropIntent  = (s: string) => /\b(drop|discard|throw)\b/i.test(s);
export const isReadIntent  = (s: string) => /\bread\b/i.test(s);

const FAST_PATH_INTENT_RE = /\b(equip|unequip|wear|wield|drop|discard|throw|read)\b/i;

// ── isNarrativeAction ─────────────────────────────────────────────────────────

/**
 * Returns false for actions that should bypass the Narrator entirely and
 * resolve instantly with a brief SYSTEM message:
 *
 * - CUSTOM actions whose inferred_intent contains inventory-management keywords
 *   (equip, unequip, wear, wield, drop, discard, throw, read)
 * - USE_ITEM actions targeting a WEAPON or ARMOR in the player's inventory
 *   (equip / unequip triggered from the UI)
 *
 * Everything else (MOVE, ATTACK, INTERACT, EXAMINE, DIALOGUE, USE_ITEM for
 * CONSUMABLEs/KEYs/LORE, and non-matching CUSTOMs) returns true.
 */
export function isNarrativeAction(action: ParsedAction, state: MasterState): boolean {
  if (action.action_type === ActionType.CUSTOM) {
    if (FAST_PATH_INTENT_RE.test(action.inferred_intent)) return false;
  }

  if (action.action_type === ActionType.USE_ITEM) {
    const lookup = (action.item_used ?? action.primary_target ?? "").trim().toLowerCase();
    if (lookup) {
      const item = state.player_state.inventory.find(
        (i) => i.id === lookup || i.name.toLowerCase() === lookup
      );
      if (item && (item.type === ItemType.WEAPON || item.type === ItemType.ARMOR)) {
        return false;
      }
    }
  }

  return true;
}
