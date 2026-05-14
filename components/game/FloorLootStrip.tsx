"use client";

import React from "react";
import { ItemRarity } from "@/types/game";
import type { FloorLootEntry, Genre, Item } from "@/types/game";
import { INVENTORY_CAP } from "@/lib/game/constants";
import { currencyLabelFor } from "@/lib/game/currency";

/**
 * Day 21 — Floor Loot Strip (TASK 10 spec).
 *
 * Compact strip between StoryFeed and NavigationBar showing the loot
 * piles dropped at the player's current node. Two modes per entry:
 *
 *   PENDING — full-width amber "SEARCH REMAINS" button. Resolves the
 *             enemy_loot_refs into items + gold when clicked.
 *
 *   RESOLVED — horizontal pill row: gold pill + item pills + TAKE ALL.
 *             Item pills go disabled when inventory is full; gold
 *             pills stay enabled (gold lives in resources, not the
 *             inventory cap).
 *
 * Strip auto-unmounts when no entries match current_node_id. No LLM
 * calls, no async work — purely reactive to floor_loot state.
 */

interface Props {
  floor_loot:              FloorLootEntry[];
  current_node_id:         string;
  genre:                   Genre | string;
  /** Length of player_state.inventory — drives the inventory-full
   *  disabled state on item pills. */
  player_inventory_count:  number;
  onSearchRemains:         (entry_id: string) => void;
  onTake:                  (entry_id: string, item_id: string) => void;
  onTakeGold:              (entry_id: string) => void;
  onTakeAll:               (entry_id: string) => void;
}

// Rarity → text/border color for the item pill badge.
const RARITY_COLOR: Record<ItemRarity, string> = {
  [ItemRarity.COMMON]:    "var(--ink-2)",
  [ItemRarity.UNCOMMON]:  "#7dd3fc",   // sky-blue
  [ItemRarity.RARE]:      "#fbbf24",   // amber
  [ItemRarity.LEGENDARY]: "#c084fc",   // purple
};

export function FloorLootStrip({
  floor_loot,
  current_node_id,
  genre,
  player_inventory_count,
  onSearchRemains,
  onTake,
  onTakeGold,
  onTakeAll,
}: Props) {
  // Filter to entries at the player's current node.
  const entries = floor_loot.filter((e) => e.node_id === current_node_id);
  if (entries.length === 0) return null;

  const currencyLabel = currencyLabelFor(genre);
  const inventoryFull = player_inventory_count >= INVENTORY_CAP;

  return (
    <div
      data-testid="floor-loot-strip"
      role="region"
      aria-label="Floor loot"
      style={{
        display:        "flex",
        flexDirection:  "column",
        gap:            6,
        padding:        "8px 12px",
        borderTop:      "1px solid var(--line-2)",
        background:     "var(--bg-2)",
      }}
    >
      {entries.map((entry) => {
        if (entry.pending) {
          return (
            <button
              key={entry.id}
              data-testid={`floor-loot-search-remains-${entry.id}`}
              type="button"
              onClick={() => onSearchRemains(entry.id)}
              className="ew-mono"
              style={{
                width:          "100%",
                minHeight:      44,
                padding:        "10px 14px",
                background:     "color-mix(in srgb, #f59e0b 18%, var(--bg-1))",
                border:         "1px solid #f59e0b",
                color:          "#fbbf24",
                fontWeight:     700,
                fontSize:       11,
                letterSpacing:  "0.28em",
                textTransform:  "uppercase",
                cursor:         "pointer",
              }}
            >
              ⚔ Search Remains
            </button>
          );
        }
        return (
          <div
            key={entry.id}
            data-testid={`floor-loot-entry-${entry.id}`}
            style={{
              display:        "flex",
              flexWrap:       "wrap",
              gap:            6,
              alignItems:     "center",
            }}
          >
            {entry.gold > 0 && (
              <GoldPill
                gold={entry.gold}
                label={currencyLabel}
                onTake={() => onTakeGold(entry.id)}
              />
            )}
            {entry.items.map((item) => (
              <ItemPill
                key={item.id}
                item={item}
                disabled={inventoryFull}
                onTake={() => onTake(entry.id, item.id)}
              />
            ))}
            {entry.items.length + (entry.gold > 0 ? 1 : 0) > 1 && (
              <button
                data-testid={`floor-loot-take-all-${entry.id}`}
                type="button"
                onClick={() => onTakeAll(entry.id)}
                className="ew-mono"
                style={{
                  marginLeft:    "auto",
                  minHeight:     32,
                  padding:       "4px 10px",
                  background:    "var(--bg-1)",
                  border:        "1px solid var(--line-2)",
                  color:         "var(--ink-1)",
                  fontWeight:    700,
                  fontSize:      10,
                  letterSpacing: "0.20em",
                  textTransform: "uppercase",
                  cursor:        "pointer",
                }}
              >
                Take All
              </button>
            )}
            {inventoryFull && entry.items.length > 0 && (
              <span
                role="note"
                style={{
                  fontFamily:    "var(--mono)",
                  fontSize:      10,
                  letterSpacing: "0.10em",
                  color:         "var(--combat-enemy)",
                  marginLeft:    4,
                }}
              >
                (Inventory Full)
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Pills
// ─────────────────────────────────────────────────────────────────────────────

function GoldPill({
  gold, label, onTake,
}: {
  gold: number; label: string; onTake: () => void;
}) {
  return (
    <button
      type="button"
      data-testid="floor-loot-gold-pill"
      onClick={onTake}
      className="ew-mono"
      style={{
        display:        "inline-flex",
        gap:            6,
        alignItems:     "center",
        minHeight:      32,
        padding:        "4px 10px",
        background:     "color-mix(in srgb, #fbbf24 14%, var(--bg-1))",
        border:         "1px solid color-mix(in srgb, #fbbf24 55%, transparent)",
        color:          "#fbbf24",
        fontWeight:     700,
        fontSize:       11,
        letterSpacing:  "0.16em",
        cursor:         "pointer",
      }}
    >
      <span>◈</span>
      <span>{gold} {label}</span>
      <span style={{ opacity: 0.7 }}>[Take]</span>
    </button>
  );
}

function ItemPill({
  item, disabled, onTake,
}: {
  item: Item; disabled: boolean; onTake: () => void;
}) {
  const rarityColor = RARITY_COLOR[item.rarity] ?? "var(--ink-2)";
  return (
    <button
      type="button"
      data-testid={`floor-loot-item-pill-${item.id}`}
      disabled={disabled}
      onClick={onTake}
      className="ew-mono"
      title={item.description}
      style={{
        display:        "inline-flex",
        gap:            6,
        alignItems:     "center",
        minHeight:      32,
        padding:        "4px 10px",
        background:     "var(--bg-1)",
        border:         `1px solid color-mix(in srgb, ${rarityColor} 50%, transparent)`,
        color:          "var(--ink-1)",
        fontSize:       11,
        letterSpacing:  "0.08em",
        cursor:         disabled ? "not-allowed" : "pointer",
        opacity:        disabled ? 0.45 : 1,
      }}
    >
      <span>{item.name}</span>
      <span
        style={{
          fontSize:       9,
          letterSpacing:  "0.16em",
          textTransform:  "uppercase",
          color:          rarityColor,
        }}
      >
        [{item.rarity}]
      </span>
      <span style={{ opacity: 0.7, fontSize: 10 }}>[Take]</span>
    </button>
  );
}
