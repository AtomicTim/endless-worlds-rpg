"use client";

import { useState } from "react";
import { Package } from "lucide-react";
import { ItemType, ItemRarity } from "@/types/game";
import type { Item } from "@/types/game";
import { useGameStore } from "@/lib/stores/game-store";
import { SidebarPanel } from "./SidebarPanel";

// ── Constants ─────────────────────────────────────────────────────────────────

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

const EQUIP_SLOTS = [
  { key: "weapon",    icon: "⚔",  label: "Weapon",    accepts: [ItemType.WEAPON] },
  { key: "armor",     icon: "🛡",  label: "Armor",     accepts: [ItemType.ARMOR] },
  { key: "accessory", icon: "💍", label: "Accessory", accepts: [ItemType.KEY, ItemType.LORE] },
] as const;

const PACK_SLOTS = 16;

// ── InventoryPanel ─────────────────────────────────────────────────────────────

interface InventoryPanelProps {
  onSubmit?: (input: string) => void;
}

export function InventoryPanel({ onSubmit }: InventoryPanelProps) {
  const inventory    = useGameStore((s) => s.masterState?.player_state.inventory) ?? [];
  const isProcessing = useGameStore((s) => s.isProcessing);

  const [selectedId,  setSelectedId]  = useState<string | null>(null);
  const [draggingId,  setDraggingId]  = useState<string | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const [rejectedSlot, setRejectedSlot] = useState<string | null>(null);

  const equippedWeapon    = inventory.find((i) => i.equipped && i.type === ItemType.WEAPON)    ?? null;
  const equippedArmor     = inventory.find((i) => i.equipped && i.type === ItemType.ARMOR)     ?? null;
  const equippedAccessory = inventory.find(
    (i) => i.equipped && i.type !== ItemType.WEAPON && i.type !== ItemType.ARMOR && i.type !== ItemType.CONSUMABLE
  ) ?? null;

  const equippedBySlot: Record<string, Item | null> = {
    weapon:    equippedWeapon,
    armor:     equippedArmor,
    accessory: equippedAccessory,
  };

  const packItems  = inventory.filter((i) => !i.equipped);
  const packSlots  = Array.from({ length: PACK_SLOTS }).map((_, i) => packItems[i] ?? null);
  const selectedItem = inventory.find((i) => i.id === selectedId) ?? null;

  // ── Drag handlers ────────────────────────────────────────────────────────────

  const DRAGGABLE_TYPES: ItemType[] = [ItemType.WEAPON, ItemType.ARMOR];

  function handleDragStart(e: React.DragEvent, item: Item) {
    e.dataTransfer.setData("text/plain", item.id);
    setDraggingId(item.id);
  }

  function handleDragEnd() {
    setDraggingId(null);
    setDragOverKey(null);
  }

  function flashRejected(slotKey: string) {
    setRejectedSlot(slotKey);
    setTimeout(() => setRejectedSlot(null), 700);
  }

  function handleDropOnEquipSlot(
    e: React.DragEvent,
    slotKey: string,
    accepts: readonly ItemType[]
  ) {
    e.preventDefault();
    setDragOverKey(null);
    const itemId = e.dataTransfer.getData("text/plain");
    const item   = inventory.find((i) => i.id === itemId);
    if (!item) return;
    // Accessory slot always rejects — no drag-equip for that slot.
    if (slotKey === "accessory") { flashRejected(slotKey); return; }
    if (!(accepts as ItemType[]).includes(item.type)) { flashRejected(slotKey); return; }
    if (!onSubmit) return;
    onSubmit(`equip ${item.name}`);
  }

  function handleDropOnPack(e: React.DragEvent) {
    e.preventDefault();
    setDragOverKey(null);
    const itemId = e.dataTransfer.getData("text/plain");
    const item   = inventory.find((i) => i.id === itemId);
    if (!item?.equipped || !onSubmit) return;
    onSubmit(`unequip ${item.name}`);
  }

  // ── Stat bonus string ────────────────────────────────────────────────────────

  function statBonusLine(item: Item): string {
    if (!item.stat_bonus) return "";
    return Object.entries(item.stat_bonus)
      .filter(([, v]) => typeof v === "number")
      .map(([k, v]) => `+${v as number} ${k.slice(0, 3).toUpperCase()}`)
      .join(", ");
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <SidebarPanel
      id="inventory"
      title="Inventory"
      icon={<Package className="size-3" />}
      defaultCollapsed={false}
    >
      {/* ── EQUIPPED ────────────────────────────────────────────────────── */}
      <div className="mb-3">
        <span
          className="mb-1.5 block text-[9px] uppercase tracking-widest"
          style={{ color: "var(--color-muted)" }}
        >
          Equipped
        </span>
        <div className="grid grid-cols-3 gap-1.5">
          {EQUIP_SLOTS.map(({ key, icon, label, accepts }) => {
            const item         = equippedBySlot[key];
            const isOver       = dragOverKey === key;
            const isRejected   = rejectedSlot === key;
            const isSelected   = item ? selectedId === item.id : false;
            return (
              <button
                key={key}
                draggable={!!item && DRAGGABLE_TYPES.includes(item.type)}
                className="flex aspect-square flex-col items-center justify-center gap-0.5 rounded-sm text-xs transition-all"
                style={{
                  border: isRejected
                    ? "1px solid #ef4444"
                    : item
                      ? `1px solid ${isOver ? "var(--color-primary)" : "var(--color-accent)"}`
                      : `1px dashed ${isOver ? "var(--color-primary)" : "var(--color-border)"}`,
                  backgroundColor: isRejected
                    ? "color-mix(in srgb, #ef4444 15%, transparent)"
                    : item
                      ? isSelected
                        ? "color-mix(in srgb, var(--color-accent) 18%, transparent)"
                        : "color-mix(in srgb, var(--color-accent) 8%, transparent)"
                      : isOver
                        ? "color-mix(in srgb, var(--color-primary) 8%, transparent)"
                        : "transparent",
                  boxShadow: item && !isRejected
                    ? "0 0 6px color-mix(in srgb, var(--color-accent) 35%, transparent)"
                    : "none",
                  cursor: item ? "pointer" : "default",
                }}
                onClick={() => item && setSelectedId(item.id === selectedId ? null : item.id)}
                onDragStart={item && DRAGGABLE_TYPES.includes(item.type) ? (e) => handleDragStart(e, item) : undefined}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => { e.preventDefault(); setDragOverKey(key); }}
                onDragLeave={() => setDragOverKey(null)}
                onDrop={(e) => handleDropOnEquipSlot(e, key, accepts)}
                title={item?.name ?? `${label} slot (empty)`}
              >
                <span
                  style={{
                    color: item ? RARITY_COLORS[item.rarity] : "var(--color-border)",
                    fontSize: "1em",
                  }}
                >
                  {item ? ITEM_ICONS[item.type] : icon}
                </span>
                <span
                  className="text-[8px]"
                  style={{ color: item ? "var(--color-accent)" : "var(--color-border)" }}
                >
                  {item ? item.name.slice(0, 7) : label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── PACK ────────────────────────────────────────────────────────── */}
      <div>
        <span
          className="mb-1.5 block text-[9px] uppercase tracking-widest"
          style={{ color: "var(--color-muted)" }}
        >
          Pack
        </span>
        <div
          className="grid grid-cols-4 gap-1.5 rounded-sm p-0.5 transition-colors"
          style={{
            backgroundColor: dragOverKey === "pack"
              ? "color-mix(in srgb, var(--color-primary) 5%, transparent)"
              : "transparent",
          }}
          onDragOver={(e) => { e.preventDefault(); setDragOverKey("pack"); }}
          onDragLeave={() => setDragOverKey(null)}
          onDrop={handleDropOnPack}
        >
          {packSlots.map((item, i) => (
            <button
              key={i}
              draggable={!!item && DRAGGABLE_TYPES.includes(item.type)}
              className="flex aspect-square items-center justify-center rounded-sm text-sm transition-colors"
              style={{
                border: item
                  ? `1px solid ${draggingId === item.id ? "var(--color-primary)" : RARITY_COLORS[item.rarity]}`
                  : "1px dashed var(--color-border)",
                backgroundColor:
                  selectedId === item?.id
                    ? "color-mix(in srgb, var(--color-primary) 12%, transparent)"
                    : "transparent",
                opacity: draggingId === item?.id ? 0.45 : 1,
                cursor: item ? "pointer" : "default",
              }}
              onClick={() => {
                if (!item) return;
                setSelectedId(item.id === selectedId ? null : item.id);
              }}
              onDragStart={item && DRAGGABLE_TYPES.includes(item.type) ? (e) => handleDragStart(e, item) : undefined}
              onDragEnd={handleDragEnd}
              onMouseEnter={(e) => { if (!item) e.currentTarget.style.borderColor = "var(--color-muted)"; }}
              onMouseLeave={(e) => { if (!item) e.currentTarget.style.borderColor = "var(--color-border)"; }}
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
      </div>

      {/* ── Item detail panel ────────────────────────────────────────────── */}
      {selectedItem ? (
        <div
          className="mt-2 space-y-1 rounded-sm p-2"
          style={{ border: `1px solid ${RARITY_COLORS[selectedItem.rarity]}` }}
        >
          {/* Name + rarity */}
          <div className="flex items-center justify-between gap-1">
            <span
              className="text-[11px] font-bold"
              style={{ color: RARITY_COLORS[selectedItem.rarity] }}
            >
              {ITEM_ICONS[selectedItem.type]}{" "}
              {selectedItem.name}
              {selectedItem.stackable && selectedItem.quantity > 1 && (
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

          {/* Description */}
          <p className="text-[10px]" style={{ color: "var(--color-muted)" }}>
            {selectedItem.description}
          </p>

          {/* Stat bonuses */}
          {selectedItem.stat_bonus && Object.keys(selectedItem.stat_bonus).length > 0 && (
            <p className="font-mono text-[10px]" style={{ color: "var(--color-accent)" }}>
              {statBonusLine(selectedItem)}
            </p>
          )}

          {/* Weight */}
          {selectedItem.weight !== undefined && (
            <p className="text-[9px]" style={{ color: "var(--color-muted)" }}>
              Weight: {selectedItem.weight}
            </p>
          )}

          {/* Action buttons */}
          {selectedItem.type === ItemType.KEY ? (
            <p className="pt-0.5 text-[9px] italic" style={{ color: "var(--color-muted)" }}>
              Used automatically when needed
            </p>
          ) : (
            <div className="flex gap-1 pt-0.5">
              {(selectedItem.type === ItemType.WEAPON || selectedItem.type === ItemType.ARMOR) &&
                onSubmit && (
                  <button
                    className="flex-1 rounded-sm px-2 py-1 text-[10px] font-bold uppercase tracking-wide transition-opacity disabled:opacity-40"
                    style={{ backgroundColor: "var(--color-accent)", color: "#000" }}
                    disabled={isProcessing}
                    onClick={() => {
                      const verb = selectedItem.equipped ? "unequip" : "equip";
                      onSubmit(`${verb} ${selectedItem.name}`);
                      setSelectedId(null);
                    }}
                  >
                    {selectedItem.equipped ? "Unequip" : "Equip"}
                  </button>
                )}

              {selectedItem.type === ItemType.CONSUMABLE && onSubmit && (
                <button
                  className="flex-1 rounded-sm px-2 py-1 text-[10px] font-bold uppercase tracking-wide transition-opacity disabled:opacity-40"
                  style={{ backgroundColor: "var(--color-primary)", color: "#000" }}
                  disabled={isProcessing}
                  onClick={() => {
                    onSubmit(`use ${selectedItem.name}`);
                    setSelectedId(null);
                  }}
                >
                  Use
                </button>
              )}

              {selectedItem.type === ItemType.LORE && onSubmit && (
                <button
                  className="flex-1 rounded-sm px-2 py-1 text-[10px] font-bold uppercase tracking-wide transition-opacity disabled:opacity-40"
                  style={{ backgroundColor: "var(--color-primary)", color: "#000" }}
                  disabled={isProcessing}
                  onClick={() => {
                    onSubmit(`read ${selectedItem.name}`);
                    setSelectedId(null);
                  }}
                >
                  Read
                </button>
              )}

              {onSubmit && (
                <button
                  className="rounded-sm px-2 py-1 text-[10px] font-bold uppercase tracking-wide transition-opacity disabled:opacity-40"
                  style={{
                    border: "1px solid var(--color-muted)",
                    color:  "var(--color-muted)",
                  }}
                  disabled={isProcessing}
                  onClick={() => {
                    onSubmit(`drop ${selectedItem.name}`);
                    setSelectedId(null);
                  }}
                >
                  Drop
                </button>
              )}
            </div>
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
