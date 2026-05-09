"use client";

import { useState } from "react";
import { Package } from "lucide-react";
import { Genre, ItemType, ItemRarity } from "@/types/game";
import type { Item } from "@/types/game";
import { useGameStore } from "@/lib/stores/game-store";
import { SidebarPanel } from "./SidebarPanel";
import { getGenreColors } from "@/components/game/genre-ui";

// ── Constants ─────────────────────────────────────────────────────────────────

const ITEM_ICONS: Record<ItemType, string> = {
  [ItemType.WEAPON]:     "⚔",
  [ItemType.ARMOR]:      "🛡",
  [ItemType.CONSUMABLE]: "⚗",
  [ItemType.KEY]:        "🗝",
  [ItemType.LORE]:       "📜",
  [ItemType.CONTAINER]:  "📦",
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
  const genre        = useGameStore((s) => s.masterState?.metadata.genre) ?? Genre.FANTASY;
  // Day 18 — currency from genre config; null for Horror (no currency).
  const currencyLbl  = getGenreColors(genre).currency;
  const hasCurrency  = currencyLbl !== null;

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

  // ── Day 20.2 TASK 2 — combat stats line ─────────────────────────────────────
  // WEAPONs show their damage_die, ARMOR shows the armor_bonus,
  // CONSUMABLEs with a heal effect show "Heal: N" (or "Heal: 1d8+4"
  // for the canonical basic health potion — that's the dice shape
  // resolveUseItem actually rolls; the flat `effect.heal: 8` value
  // is just an inventory hint). KEY / LORE / CONTAINER return null.
  const BASIC_HEALTH_POTION_ID = "consumable_basic_health_potion";
  function combatStatsLine(item: Item): string | null {
    if (item.type === ItemType.WEAPON) {
      const die = item.effect?.damage_die;
      return typeof die === "string" && die.length > 0
        ? `Damage: ${die}`
        : null;
    }
    if (item.type === ItemType.ARMOR) {
      const bonus = item.effect?.armor_bonus;
      if (typeof bonus !== "number") return null;
      // Render +0 explicitly so the player sees this is armor with
      // no damage reduction (e.g. mage robes), not "missing data".
      return `Armor: ${bonus >= 0 ? "+" : ""}${bonus}`;
    }
    if (item.type === ItemType.CONSUMABLE) {
      // Basic health potion is the canonical 1d8+4 roll.
      if (item.id === BASIC_HEALTH_POTION_ID) return "Heal: 1d8+4";
      const heal = item.effect?.heal;
      if (typeof heal === "number") return `Heal: ${heal}`;
      return null;
    }
    return null;
  }

  // SMALL FIX 2: include "Worth: N CCY" in the compact slot tooltip so the
  // player sees value on hover without expanding the detail card. For
  // currency-less genres (Horror) the worth line is suppressed.
  function slotTooltip(item: Item | null): string {
    if (!item) return "";
    const lines = [item.name];
    if (hasCurrency && typeof item.value === "number" && item.value > 0) {
      lines.push(`Worth: ${item.value} ${currencyLbl}`);
    }
    return lines.join("\n");
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
                title={item ? slotTooltip(item) : `${label} slot (empty)`}
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
              title={slotTooltip(item)}
            >
              {item && (
                <div className="relative flex flex-col items-center justify-center">
                  <span style={{ color: RARITY_COLORS[item.rarity] }}>
                    {ITEM_ICONS[item.type]}
                  </span>
                  {item.type === ItemType.CONTAINER && item.searched && (
                    <span
                      className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 rounded-sm px-1 text-[7px] font-bold uppercase tracking-wider"
                      style={{
                        backgroundColor: "color-mix(in srgb, var(--color-muted) 60%, transparent)",
                        color:           "var(--color-bg)",
                      }}
                    >
                      Empty
                    </span>
                  )}
                </div>
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
          {/* Name + rarity (+ Day 20.2 equipped pill) */}
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
            <div className="flex shrink-0 items-center gap-1.5">
              {/* Day 20.2 TASK 2 — equipped pill. Visible whenever the
                  item is equipped, regardless of whether it's in the
                  Equipped grid or (defensively) the Pack list. */}
              {selectedItem.equipped && (
                <span
                  className="rounded-sm px-1 text-[8px] font-bold uppercase tracking-wider"
                  style={{
                    backgroundColor: "color-mix(in srgb, var(--hl-pass) 18%, transparent)",
                    color:           "var(--hl-pass)",
                    border:          "1px solid color-mix(in srgb, var(--hl-pass) 50%, transparent)",
                  }}
                >
                  Equipped
                </span>
              )}
              <span
                className="text-[9px] uppercase tracking-wide"
                style={{ color: "var(--color-muted)" }}
              >
                {selectedItem.rarity}
              </span>
            </div>
          </div>

          {/* Description */}
          <p className="text-[10px]" style={{ color: "var(--color-muted)" }}>
            {selectedItem.description}
          </p>

          {/* Day 20.2 TASK 2 — combat stats line.
              Damage / Armor / Heal — small mono, item-yellow tint
              so it's visible without dominating the description. */}
          {(() => {
            const line = combatStatsLine(selectedItem);
            if (!line) return null;
            return (
              <p
                className="font-mono text-[10px]"
                style={{ color: "var(--hl-item)" }}
              >
                {line}
              </p>
            );
          })()}

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

          {/* Day 16 — sell value. Hidden in currency-less genres (Horror). */}
          {hasCurrency && typeof selectedItem.value === "number" && selectedItem.value > 0 && (
            <p
              className="text-[9px]"
              style={{ color: "var(--color-muted)" }}
              title={`Sells to merchants for ~${Math.max(1, Math.floor(selectedItem.value * 0.5))} ${currencyLbl} (50% of value)`}
            >
              Worth: {selectedItem.value} {currencyLbl}
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

              {selectedItem.type === ItemType.CONTAINER && onSubmit && (
                <button
                  className="flex-1 rounded-sm px-2 py-1 text-[10px] font-bold uppercase tracking-wide transition-opacity disabled:opacity-40"
                  style={{
                    backgroundColor: selectedItem.searched
                      ? "color-mix(in srgb, var(--color-muted) 30%, transparent)"
                      : "var(--color-primary)",
                    color: selectedItem.searched ? "var(--color-muted)" : "#000",
                  }}
                  disabled={isProcessing || selectedItem.searched}
                  onClick={() => {
                    onSubmit(`search ${selectedItem.name}`);
                    setSelectedId(null);
                  }}
                >
                  {selectedItem.searched ? "Searched" : "Search"}
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
