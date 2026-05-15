"use client";

import React from "react";
import { ItemType } from "@/types/game";
import type { Item } from "@/types/game";

/**
 * UI-8 — Shared loot item card. Used identically in:
 *   • The inline feed card rendered below the Victory banner
 *   • The loot modal opened from the Context Panel
 *
 * Spec: docs/ui-design-reference.md §20 ("Item Card Spec") +
 * the prompt's CHANGE 1/2 specifying typography + Take button.
 *
 * Layout:
 *   [icon] [name + stat line + type·rarity]                      [Take]
 *
 * The component is pure — taking an item is the caller's
 * responsibility. The card just renders the row + Take button
 * and fires onTake when clicked. After all items are taken from
 * a loot pile, the parent stops rendering the cards for the
 * taken items (or replaces them with the all-collected line).
 */

// ─────────────────────────────────────────────────────────────────────────────
// Constants — colour system + icon glyphs
// ─────────────────────────────────────────────────────────────────────────────

const ICON_INK_REST = "#7a6040";
const NAME_INK      = "#d4bc88";
const META_INK      = "#6a5530";

// Stat colour per loot system (design ref §20):
//   weapon damage / armor / lore  → #c4943a (amber)
//   heal consumable               → #7abb7a (green)
//   accessory                     → #a888c8 (purple)
//   gold / currency               → no stat (type text only)
const STAT_AMBER  = "#c4943a";
const STAT_GREEN  = "#7abb7a";
const STAT_PURPLE = "#a888c8";

/** Unicode glyph by ItemType. Tabler font is not yet installed
 *  (UI-12 will swap these for ti-* class names). */
const ITEM_GLYPH: Record<ItemType, string> = {
  [ItemType.WEAPON]:     "⚔",   // ti-sword
  [ItemType.ARMOR]:      "🛡",  // ti-shield
  [ItemType.CONSUMABLE]: "♥",   // ti-heart (heal-style fallback below decides)
  [ItemType.KEY]:        "🗝",  // ti-key
  [ItemType.LORE]:       "📜",  // ti-book
  [ItemType.CONTAINER]:  "📦",  // ti-package
  [ItemType.VALUABLE]:   "💎",  // ti-gem
  [ItemType.QUEST_ITEM]: "✦",   // ti-asterisk
  [ItemType.STAT_XP]:    "✨",  // ti-sparkles
};

// Heal consumables get a heart; non-heal consumables get the backpack.
const NON_HEAL_CONSUMABLE_GLYPH = "🎒";

// ─────────────────────────────────────────────────────────────────────────────
// Stat formatters
// ─────────────────────────────────────────────────────────────────────────────

function isHealConsumable(item: Item): boolean {
  return item.type === ItemType.CONSUMABLE && typeof item.effect?.heal === "number" && item.effect.heal > 0;
}

interface StatLine {
  text:  string;
  color: string;
}

/** Returns the stat line + colour to render under the item name. Null
 *  for items with no surfaceable stat (key items, plain valuables, etc.). */
function statLineFor(item: Item): StatLine | null {
  // Weapon → "d6+1" style. damage_die is e.g. "1d6" — strip the leading
  // "1d" for the abbreviated form (matches the §20 example).
  if (item.type === ItemType.WEAPON) {
    const die = item.effect?.damage_die;
    if (typeof die === "string" && die.length > 0) {
      const short = die.replace(/^1d/, "d");
      return { text: short, color: STAT_AMBER };
    }
  }
  // Armor → "+2 armor"
  if (item.type === ItemType.ARMOR) {
    const ab = item.effect?.armor_bonus;
    if (typeof ab === "number") {
      return { text: `${ab >= 0 ? "+" : ""}${ab} armor`, color: STAT_AMBER };
    }
  }
  // Heal consumable → "Heal N" (or "Heal 1d8+4" for the basic potion)
  if (item.type === ItemType.CONSUMABLE) {
    if (item.id === "consumable_basic_health_potion") {
      return { text: "Heal 1d8+4", color: STAT_GREEN };
    }
    if (typeof item.effect?.heal === "number") {
      return { text: `Heal ${item.effect.heal}`, color: STAT_GREEN };
    }
  }
  // Accessory / lore stat_bonus → "+1 INT" (purple) for stat-bearing
  // accessories; amber "Lore item" for pure lore. Lore items often carry
  // stat_bonus too — type wins for colour, value drives text.
  if (item.stat_bonus && Object.keys(item.stat_bonus).length > 0) {
    const entries = Object.entries(item.stat_bonus)
      .filter(([, v]) => typeof v === "number");
    if (entries.length > 0) {
      const [k, v] = entries[0];
      return { text: `+${v as number} ${k.slice(0, 3).toUpperCase()}`, color: STAT_PURPLE };
    }
  }
  if (item.type === ItemType.LORE) {
    return { text: "Lore item", color: STAT_AMBER };
  }
  return null;
}

function glyphFor(item: Item): string {
  if (item.type === ItemType.CONSUMABLE) {
    return isHealConsumable(item) ? "♥" : NON_HEAL_CONSUMABLE_GLYPH;
  }
  return ITEM_GLYPH[item.type] ?? "•";
}

// ─────────────────────────────────────────────────────────────────────────────
// Take button — identical in inline + modal
// ─────────────────────────────────────────────────────────────────────────────

interface TakeBtnProps {
  disabled?: boolean;
  /** When true, render the "Inventory full" disabled label (still
   *  styled like a pill but greyed, opacity 0.5, non-interactive). */
  inventoryFull?: boolean;
  onClick:    () => void;
}

function TakeButton({ disabled, inventoryFull, onClick }: TakeBtnProps) {
  if (inventoryFull) {
    return (
      <span
        role="status"
        style={{
          fontFamily:    "var(--ui-sans, var(--mono))",
          fontSize:      9.5,
          padding:       "2px 10px",
          borderRadius:  20,
          background:    "rgba(196,148,58,.05)",
          border:        "1px solid rgba(196,148,58,.15)",
          color:         "#6a5530",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          opacity:       0.5,
          marginTop:     1,
          flexShrink:    0,
          cursor:        "not-allowed",
        }}
      >
        Inventory full
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        fontFamily:    "var(--ui-sans, var(--mono))",
        fontSize:      9.5,
        padding:       "2px 10px",
        borderRadius:  20,
        color:         "#c4943a",
        background:    "rgba(196,148,58,.10)",
        border:        "1px solid rgba(196,148,58,.30)",
        marginTop:     1,
        flexShrink:    0,
        cursor:        disabled ? "not-allowed" : "pointer",
        opacity:       disabled ? 0.4 : 1,
        letterSpacing: "0.10em",
        textTransform: "uppercase",
        fontWeight:    600,
        transition:    "background 140ms, border-color 140ms",
      }}
      onMouseEnter={(e) => {
        if (disabled) return;
        (e.currentTarget as HTMLButtonElement).style.background    = "rgba(196,148,58,.22)";
        (e.currentTarget as HTMLButtonElement).style.borderColor   = "rgba(196,148,58,.55)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background    = "rgba(196,148,58,.10)";
        (e.currentTarget as HTMLButtonElement).style.borderColor   = "rgba(196,148,58,.30)";
      }}
    >
      Take
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LootItemCard — the row
// ─────────────────────────────────────────────────────────────────────────────

interface LootCardCommon {
  /** Tap on the Take button. */
  onTake:         () => void;
  /** Inventory full → disabled pill. Ignored for gold rows (gold lives
   *  in resources, never the inventory cap). */
  inventoryFull?: boolean;
}

interface ItemLootCardProps extends LootCardCommon {
  kind: "item";
  item: Item;
}

interface GoldLootCardProps extends LootCardCommon {
  kind:           "gold";
  gold:           number;
  currencyLabel:  string;
}

type LootItemCardProps = ItemLootCardProps | GoldLootCardProps;

export function LootItemCard(props: LootItemCardProps) {
  // Hover treatment per spec: background .10, border .28. Inline-CSS
  // mouseenter/leave hooks rather than a hover stylesheet so the card
  // ships without globals.css churn.
  const baseBg     = "rgba(var(--genre-accent-rgb), .05)";
  const baseBorder = "1px solid rgba(var(--genre-accent-rgb), .16)";

  const handleEnter = (e: React.MouseEvent<HTMLDivElement>) => {
    e.currentTarget.style.background = "rgba(var(--genre-accent-rgb), .10)";
    e.currentTarget.style.border     = "1px solid rgba(var(--genre-accent-rgb), .28)";
  };
  const handleLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    e.currentTarget.style.background = baseBg;
    e.currentTarget.style.border     = baseBorder;
  };

  const isGold = props.kind === "gold";
  const glyph  = isGold ? "◈" : glyphFor(props.item);
  const name   = isGold ? `${props.gold.toLocaleString()} ${props.currencyLabel}` : props.item.name;
  const stat   = isGold ? null : statLineFor(props.item);

  // Type · rarity sub-line. Gold rows just show "Currency".
  const subline = isGold
    ? "Currency"
    : `${props.item.type} · ${props.item.rarity}`;

  // Inventory-full only blocks ITEM rows. Gold always takeable.
  const itemBlocked = !isGold && (props.inventoryFull === true);

  return (
    <div
      role="group"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      style={{
        display:        "flex",
        alignItems:     "center",
        gap:            10,
        padding:        "9px 10px",
        marginBottom:   5,
        background:     baseBg,
        border:         baseBorder,
        borderRadius:   7,
        transition:     "background 120ms, border-color 120ms",
      }}
    >
      <span
        aria-hidden
        style={{
          width:      18,
          textAlign:  "center",
          fontSize:   14,
          color:      ICON_INK_REST,
          flexShrink: 0,
        }}
      >
        {glyph}
      </span>
      <span
        style={{
          flex:          1,
          minWidth:      0,
          display:       "flex",
          flexDirection: "column",
          gap:           1,
        }}
      >
        <span
          className="ew-serif"
          style={{
            fontStyle:    "italic",
            fontSize:     12,
            color:        NAME_INK,
            overflow:     "hidden",
            textOverflow: "ellipsis",
            whiteSpace:   "nowrap",
          }}
        >
          {name}
        </span>
        {stat && (
          <span
            style={{
              fontFamily: "var(--mono)",
              fontSize:   10,
              color:      stat.color,
              whiteSpace: "nowrap",
            }}
          >
            {stat.text}
          </span>
        )}
        <span
          style={{
            fontFamily:    "var(--ui-sans, var(--mono))",
            fontSize:      9,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color:         META_INK,
            whiteSpace:    "nowrap",
            overflow:      "hidden",
            textOverflow:  "ellipsis",
          }}
        >
          {subline}
        </span>
      </span>
      <TakeButton
        onClick={props.onTake}
        inventoryFull={itemBlocked}
      />
    </div>
  );
}
