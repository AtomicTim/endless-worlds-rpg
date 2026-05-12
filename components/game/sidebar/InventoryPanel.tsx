"use client";

import { useState } from "react";
import { Package } from "lucide-react";
import { Genre, ItemType, ItemRarity } from "@/types/game";
import type { Attributes, Item } from "@/types/game";
import { useGameStore, makeMessage } from "@/lib/stores/game-store";
import { useCombat } from "@/hooks/useCombat";
import { SidebarPanel } from "./SidebarPanel";
import { getGenreColors } from "@/components/game/genre-ui";
import { applyStatBoost } from "@/lib/game/level-resolver";
import { STAT_CAP } from "@/lib/game/constants";

// Day 22 — short labels for the STAT_XP inline picker buttons. The
// LevelUpModal uses the same shorts (kept in two places intentionally —
// the modal is a top-level overlay, the inventory picker lives in the
// sidebar, neither imports the other's UI constants).
const STAT_SHORT: Record<keyof Attributes, string> = {
  strength:     "STR",
  agility:      "AGI",
  intelligence: "INT",
  perception:   "PER",
  charisma:     "CHA",
};
const STAT_NAMES: Record<keyof Attributes, string> = {
  strength:     "Strength",
  agility:      "Agility",
  intelligence: "Intelligence",
  perception:   "Perception",
  charisma:     "Charisma",
};
const STAT_KEYS_LIST: Array<keyof Attributes> = [
  "strength", "agility", "intelligence", "perception", "charisma",
];

// ── Constants ─────────────────────────────────────────────────────────────────

const ITEM_ICONS: Record<ItemType, string> = {
  [ItemType.WEAPON]:     "⚔",
  [ItemType.ARMOR]:      "🛡",
  [ItemType.CONSUMABLE]: "⚗",
  [ItemType.KEY]:        "🗝",
  [ItemType.LORE]:       "📜",
  [ItemType.CONTAINER]:  "📦",
  // Day 21 — icons for VALUABLE / QUEST_ITEM / STAT_XP. VALUABLE
  // shows a gem (it sells for value at merchants). QUEST_ITEM uses
  // a star — Day 23 main-quest wiring will style this further.
  // STAT_XP uses a sparkle — Day 22 stat-selection UI consumes it.
  [ItemType.VALUABLE]:   "💎",
  [ItemType.QUEST_ITEM]: "✦",
  [ItemType.STAT_XP]:    "✨",
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
  // Day 22 — STAT_XP application happens directly in the panel: pick a
  // stat, mutate player_state via setMasterState, consume the item.
  // Out-of-combat only — the combat path routes through submitCombatAction
  // and the engine auto-applies to the archetype's primary stat (no
  // picker mid-fight to keep the action loop snappy).
  const masterState    = useGameStore((s) => s.masterState);
  const setMasterState = useGameStore((s) => s.setMasterState);
  const addMessage     = useGameStore((s) => s.addMessage);
  // Day 20.4.1 TASK 2 — when combat is active, the sidebar Use button
  // must route through the combat-engine action loop instead of
  // useGameLoop.submitAction (which would hit the V8.37 input gate
  // and show "Combat input is disabled"). Read combat slice + the
  // submitCombatAction binding from useCombat. Non-CONSUMABLE items
  // (weapons, armor, lore, keys) lose their action button entirely
  // during combat — combat resolution doesn't include those flows.
  const inCombat              = useGameStore((s) => s.masterState?.combat?.active === true);
  const { submitCombatAction, isResolving: combatResolving } = useCombat();
  // Day 18 — currency from genre config; null for Horror (no currency).
  const currencyLbl  = getGenreColors(genre).currency;
  const hasCurrency  = currencyLbl !== null;

  const [selectedId,  setSelectedId]  = useState<string | null>(null);
  const [draggingId,  setDraggingId]  = useState<string | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const [rejectedSlot, setRejectedSlot] = useState<string | null>(null);
  // Day 22 — when the player clicks USE on a STAT_XP item, expand an
  // inline stat picker beneath the action buttons. Null = picker closed.
  const [statPickerOpen, setStatPickerOpen] = useState<boolean>(false);

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

  // ── Day 22 — STAT_XP application (out-of-combat only) ────────────────────
  // Combat-path STAT_XP is handled by combat-engine's use_item case
  // (auto-applies to archetype primary). Out-of-combat we let the
  // player pick. Both paths consume the item exactly once.
  function applyStatXpAndConsume(itemId: string, stat: keyof Attributes) {
    if (!masterState) return;
    const player = masterState.player_state;
    const owned  = player.inventory.find((i) => i.id === itemId);
    if (!owned || owned.type !== ItemType.STAT_XP) return;

    const beforeValue = player.attributes[stat];
    const afterAttrs  = applyStatBoost(player, stat);
    const afterValue  = afterAttrs[stat];
    const capped      = afterValue === beforeValue;

    // Consume one stack — drop the row when it would hit zero. Same
    // pattern as combat-engine's consumeItem helper, kept local to
    // avoid pulling a combat-engine import into the sidebar.
    const nextQty = (owned.quantity ?? 1) - 1;
    const newInventory = nextQty > 0
      ? player.inventory.map((i) => (i.id === itemId ? { ...i, quantity: nextQty } : i))
      : player.inventory.filter((i) => i.id !== itemId);

    setMasterState({
      ...masterState,
      player_state: {
        ...player,
        attributes: afterAttrs,
        inventory:  newInventory,
      },
    });

    // Templated story-feed beat — no LLM call.
    const beat = capped
      ? `You study ${owned.name}, but your ${STAT_NAMES[stat]} is already at its peak.`
      : `You study ${owned.name} and feel your ${STAT_NAMES[stat]} sharpen.`;
    addMessage(
      makeMessage("SYSTEM", beat, {
        stat_xp_used: true,
        stat,
        capped,
      })
    );

    setSelectedId(null);
    setStatPickerOpen(false);
  }

  // ── FIX 4 — direct consumable heal (out-of-combat only) ─────────────────
  // Mirrors rule 88 (resolveUseItem heal priority) and the combat-engine
  // path. Bypasses the text-input / intent-parser so the heal fires
  // immediately without a narrator call.
  function handleDirectConsumeItem(item: Item) {
    if (!masterState) return;
    if (item.type !== ItemType.CONSUMABLE) return;

    const player = masterState.player_state;

    // Resolve heal amount (mirrors combat-resolver's resolveUseItem).
    let healAmount = 0;
    let healDisplay = "0";
    if (typeof item.effect?.heal === "number" && item.effect.heal > 0) {
      healAmount = item.effect.heal;
      healDisplay = String(healAmount);
    } else if (item.id === BASIC_HEALTH_POTION_ID) {
      const dieRoll  = Math.floor(Math.random() * 8) + 1;
      healAmount     = dieRoll + 4;
      healDisplay    = String(healAmount);
    } else {
      // Non-healing consumable — let the narrator handle it.
      onSubmit?.(`use ${item.name}`);
      return;
    }

    const newHp = Math.min(player.max_health, player.health + healAmount);

    const nextQty = (item.quantity ?? 1) - 1;
    const newInventory = nextQty > 0
      ? player.inventory.map((i) => (i.id === item.id ? { ...i, quantity: nextQty } : i))
      : player.inventory.filter((i) => i.id !== item.id);

    setMasterState({
      ...masterState,
      player_state: { ...player, health: newHp, inventory: newInventory },
    });

    addMessage(
      makeMessage("SYSTEM", `You use ${item.name}. Restored ${healDisplay} HP.`, {
        outcome_type: "USE_ITEM_CONSUMED",
        direct_consume: true,
        item_name: item.name,
      })
    );
    setSelectedId(null);
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
              {/* Day 20.4.1 TASK 2 — equip/unequip is gated to non-combat
                  flows. Combat doesn't expose mid-fight gear swap. */}
              {(selectedItem.type === ItemType.WEAPON || selectedItem.type === ItemType.ARMOR) &&
                onSubmit && !inCombat && (
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

              {/* FIX 4 — key items never show a USE button (text path or
                  nav-card popover are the only paths per FIX 3). Healing
                  consumables direct-dispatch out of combat. Other
                  consumables (buffs) still fall back to onSubmit → narrator. */}
              {selectedItem.type === ItemType.CONSUMABLE &&
               !selectedItem.is_key_item && (
                <button
                  className="flex-1 rounded-sm px-2 py-1 text-[10px] font-bold uppercase tracking-wide transition-opacity disabled:opacity-40"
                  style={{ backgroundColor: "var(--color-primary)", color: "#000" }}
                  disabled={isProcessing || (inCombat && combatResolving)}
                  onClick={() => {
                    // Day 20.4.1 TASK 2 — when combat is active, route
                    // through useCombat.submitCombatAction so the
                    // engine consumes a turn properly.
                    // FIX 4 — out of combat, direct-dispatch so the heal
                    // fires instantly without a narrator round-trip.
                    if (inCombat) {
                      void submitCombatAction({
                        action:  "use_item",
                        item_id: selectedItem.id,
                      });
                      setSelectedId(null);
                    } else {
                      handleDirectConsumeItem(selectedItem);
                    }
                  }}
                >
                  Use
                </button>
              )}

              {/* Day 20.4.1 TASK 2 — read/search/drop are non-combat
                  flows; hidden when combat is active. Combat input
                  gating in useGameLoop would block these anyway. */}
              {selectedItem.type === ItemType.LORE && onSubmit && !inCombat && (
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

              {selectedItem.type === ItemType.CONTAINER && onSubmit && !inCombat && (
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

              {/* Day 22 — STAT_XP USE button. Out-of-combat opens an
                  inline 5-stat picker below the action row. In-combat
                  routes through submitCombatAction; combat-engine
                  auto-applies to archetype primary (no picker mid-fight
                  to keep the action loop snappy). */}
              {selectedItem.type === ItemType.STAT_XP && (
                <button
                  className="flex-1 rounded-sm px-2 py-1 text-[10px] font-bold uppercase tracking-wide transition-opacity disabled:opacity-40"
                  style={{ backgroundColor: "var(--hl-pass)", color: "#000" }}
                  disabled={isProcessing || (inCombat && combatResolving)}
                  onClick={() => {
                    if (inCombat) {
                      void submitCombatAction({
                        action:  "use_item",
                        item_id: selectedItem.id,
                      });
                      setSelectedId(null);
                    } else {
                      setStatPickerOpen((open) => !open);
                    }
                  }}
                >
                  Use
                </button>
              )}

              {onSubmit && !inCombat && (
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

          {/* Day 22 — STAT_XP inline picker. Only shows for STAT_XP
              items, out-of-combat, after the player taps USE. */}
          {selectedItem.type === ItemType.STAT_XP && !inCombat && statPickerOpen && masterState && (
            <div
              className="mt-2 space-y-1.5"
              style={{
                borderTop: "1px solid var(--color-border)",
                paddingTop: 8,
              }}
            >
              <p
                className="text-[9px] uppercase tracking-wider"
                style={{ color: "var(--color-muted)" }}
              >
                Improve which stat?
              </p>
              <div className="grid grid-cols-5 gap-1">
                {STAT_KEYS_LIST.map((s) => {
                  const current = masterState.player_state.attributes[s];
                  const capped  = current >= STAT_CAP;
                  return (
                    <button
                      key={s}
                      type="button"
                      disabled={capped}
                      onClick={() => applyStatXpAndConsume(selectedItem.id, s)}
                      className="flex flex-col items-center rounded-sm px-1 py-1 text-[9px] uppercase transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
                      style={{
                        backgroundColor: "color-mix(in srgb, var(--hl-pass) 12%, transparent)",
                        border:          "1px solid color-mix(in srgb, var(--hl-pass) 40%, transparent)",
                        color:           "var(--hl-pass)",
                      }}
                      title={capped ? `${STAT_NAMES[s]} is already at the cap (${STAT_CAP}).` : `+1 ${STAT_NAMES[s]}`}
                    >
                      <span className="font-bold">{STAT_SHORT[s]}</span>
                      <span className="text-[10px]">{current}</span>
                    </button>
                  );
                })}
              </div>
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
