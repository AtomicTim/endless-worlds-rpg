"use client";

import { useState } from "react";
import { Package } from "lucide-react";
import { ItemType, ItemRarity } from "@/types/game";
import type { Item } from "@/types/game";
import { useGameStore } from "@/lib/stores/game-store";
import { SidebarPanel } from "./SidebarPanel";

// ── Constants ─────────────────────────────────────────────────────────────────

const GRID_SLOTS = 16; // 4 × 4

const ITEM_ICONS: Record<ItemType, string> = {
  [ItemType.WEAPON]:     "⚔",
  [ItemType.ARMOR]:      "🛡",
  [ItemType.CONSUMABLE]: "⚗",
  [ItemType.KEY]:        "🗝",
  [ItemType.LORE]:       "📜",
};

const RARITY_COLORS: Record<ItemRarity, string> = {
  [ItemRarity.COMMON]:    "var(--color-muted)",
  [ItemRarity.UNCOMMON]:  "#22c55e",
  [ItemRarity.RARE]:      "#3b82f6",
  [ItemRarity.LEGENDARY]: "#f59e0b",
};

// ── InventoryPanel ─────────────────────────────────────────────────────────────

interface InventoryPanelProps {
  onSubmit?: (input: string) => void;
}

export function InventoryPanel({ onSubmit }: InventoryPanelProps) {
  const inventory    = useGameStore((s) => s.masterState?.player_state.inventory) ?? [];
  const isProcessing = useGameStore((s) => s.isProcessing);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedItem = inventory.find((item) => item.id === selectedId) ?? null;
  const slots        = Array.from({ length: GRID_SLOTS }).map((_, i) => inventory[i] ?? null);

  function handleSlotClick(item: Item | null) {
    if (!item) {
      setSelectedId(null);
      return;
    }
    setSelectedId(item.id === selectedId ? null : item.id);
  }

  return (
    <SidebarPanel
      id="inventory"
      title="Inventory"
      icon={<Package className="size-3" />}
      defaultCollapsed={false}
    >
      {/* Slot grid */}
      <div className="grid grid-cols-4 gap-1.5">
        {slots.map((item, i) => (
          <button
            key={i}
            className="flex aspect-square items-center justify-center rounded-sm text-sm transition-colors"
            style={{
              border: item
                ? `1px solid ${RARITY_COLORS[item.rarity]}`
                : "1px dashed var(--color-border)",
              backgroundColor:
                selectedId === item?.id
                  ? "color-mix(in srgb, var(--color-primary) 12%, transparent)"
                  : "transparent",
              cursor: item ? "pointer" : "default",
            }}
            onClick={() => handleSlotClick(item)}
            onMouseEnter={(e) => {
              if (!item) {
                e.currentTarget.style.borderColor = "var(--color-muted)";
              }
            }}
            onMouseLeave={(e) => {
              if (!item) {
                e.currentTarget.style.borderColor = "var(--color-border)";
              }
            }}
            title={item?.name}
          >
            {item && (
              <span style={{ color: RARITY_COLORS[item.rarity] }}>
                {ITEM_ICONS[item.type]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Selected item detail panel */}
      {selectedItem ? (
        <div
          className="mt-2 space-y-1 rounded-sm p-2"
          style={{ border: `1px solid ${RARITY_COLORS[selectedItem.rarity]}` }}
        >
          <div className="flex items-center justify-between gap-1">
            <span
              className="text-[11px] font-bold"
              style={{ color: RARITY_COLORS[selectedItem.rarity] }}
            >
              {ITEM_ICONS[selectedItem.type]}{" "}
              {selectedItem.name}
              {selectedItem.quantity > 1 && (
                <span style={{ color: "var(--color-muted)" }}> ×{selectedItem.quantity}</span>
              )}
            </span>
            <span
              className="shrink-0 text-[9px] uppercase tracking-wide"
              style={{ color: "var(--color-muted)" }}
            >
              {selectedItem.rarity}
            </span>
          </div>

          <p className="text-[10px]" style={{ color: "var(--color-muted)" }}>
            {selectedItem.description}
          </p>

          {selectedItem.type === ItemType.CONSUMABLE && onSubmit && (
            <button
              className="mt-1 w-full rounded-sm px-2 py-1 text-[10px] font-bold uppercase tracking-wide transition-opacity disabled:opacity-40"
              style={{
                backgroundColor: "var(--color-primary)",
                color: "#000",
              }}
              disabled={isProcessing}
              onClick={() => {
                onSubmit(`use ${selectedItem.name}`);
                setSelectedId(null);
              }}
            >
              Use
            </button>
          )}
        </div>
      ) : inventory.length === 0 ? (
        <p
          className="mt-2 text-center text-[10px] italic"
          style={{ color: "var(--color-muted)" }}
        >
          Your pack is empty
        </p>
      ) : null}
    </SidebarPanel>
  );
}
