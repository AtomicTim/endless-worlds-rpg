"use client";

import React, { useState } from "react";
import { User } from "lucide-react";
import type { Icon as TablerIcon } from "@tabler/icons-react";
import {
  IconCoins,
  IconCpu,
  IconBackpack,
  IconCoin,
  IconTool,
} from "@tabler/icons-react";
import { Genre, ItemType, ItemRarity } from "@/types/game";
import type { Attributes, Item } from "@/types/game";
import { useGameStore, makeMessage } from "@/lib/stores/game-store";
import { useCombat } from "@/hooks/useCombat";
import { getGenreColors } from "@/components/game/genre-ui";
import { applyStatBoost } from "@/lib/game/level-resolver";
import { STAT_CAP } from "@/lib/game/constants";
import { xpForNextLevel } from "@/lib/game/level-resolver";
import { PERK_LIBRARY } from "@/lib/game/perks";
import { StatusEffectPills } from "@/components/game/CombatMode/StatusEffectPills";

/**
 * UI-9 — Character Panel (right sidebar). Replaces the old
 * CharacterSheet + InventoryPanel pair with a single unified panel
 * matching docs/ui-design-reference.md §13.
 *
 * Sections (top → bottom):
 *   1. Portrait + identity        (CHANGE 2)
 *   2. HP bar w/ threshold colour (CHANGE 3)
 *   3. XP bar                     (CHANGE 4)
 *   4. Status effect pills        (CHANGE 5 — hidden when empty)
 *   5. Attribute block            (CHANGE 6 — single inline row)
 *   6. Equipped items (3 slots)   (CHANGE 7)
 *   7. Currency                   (CHANGE 8)
 *   8. Pack grid + inline expand  (CHANGE 9 — actual items only)
 *   9. Owned perks                (CHANGE 10 — hidden when empty)
 *
 * Action logic (equip / unequip / use / read / drop / STAT_XP picker /
 * direct-consume heal / combat-aware routing) is preserved verbatim
 * from the InventoryPanel — the prompt's "DO NOT change inventory
 * logic" constraint. UI is rewritten; handlers are not.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const BASIC_HEALTH_POTION_ID = "consumable_basic_health_potion";

/** Unicode glyph by ItemType — Tabler font isn't installed, so we keep the
 *  existing unicode set (matches InventoryPanel's icon table). */
const ITEM_ICONS: Record<ItemType, string> = {
  [ItemType.WEAPON]:     "⚔",
  [ItemType.ARMOR]:      "🛡",
  [ItemType.CONSUMABLE]: "⚗",
  [ItemType.KEY]:        "🗝",
  [ItemType.LORE]:       "📜",
  [ItemType.CONTAINER]:  "📦",
  [ItemType.VALUABLE]:   "💎",
  [ItemType.QUEST_ITEM]: "✦",
  [ItemType.STAT_XP]:    "✨",
};

const RARITY_COLORS: Record<ItemRarity, string> = {
  [ItemRarity.COMMON]:    "#7a6040",
  [ItemRarity.UNCOMMON]:  "#5a9450",
  [ItemRarity.RARE]:      "#5880d0",
  [ItemRarity.LEGENDARY]: "#c4943a",
};

const STAT_KEYS: Array<keyof Attributes> = [
  "strength", "agility", "intelligence", "perception", "charisma",
];
const STAT_LABELS: Record<keyof Attributes, string> = {
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

/** Currency Tabler icon per genre. Per design ref §13:
 *  Fantasy ti-coins · Cyberpunk ti-cpu · Horror ti-backpack ·
 *  Space ti-coin · Post-Apoc ti-tool. UI-12 installed @tabler/icons-react
 *  and resolved the UI-9 fallback gap. */
const CURRENCY_ICON: Record<Genre, TablerIcon> = {
  [Genre.FANTASY]:             IconCoins,
  [Genre.CYBERPUNK]:           IconCpu,
  [Genre.HORROR_LOVECRAFTIAN]: IconBackpack,
  [Genre.SPACE_OPERA]:         IconCoin,
  [Genre.POST_APOCALYPTIC]:    IconTool,
};

// ─────────────────────────────────────────────────────────────────────────────
// HP / XP helpers
// ─────────────────────────────────────────────────────────────────────────────

/** UI-9 CHANGE 3 — HP threshold colour ladder. */
export function hpThresholdColor(pct: number): string {
  if (pct >= 75) return "#4a8a4a";
  if (pct >= 50) return "#5a9450";
  if (pct >= 25) return "#a87830";
  if (pct >= 10) return "#c84830";
  return "#e03030";
}

// ─────────────────────────────────────────────────────────────────────────────
// CharacterPanel
// ─────────────────────────────────────────────────────────────────────────────

interface CharacterPanelProps {
  /** Dispatch helper for legacy text-driven actions (equip / unequip /
   *  read / drop / search). Same shape as InventoryPanel's prop. */
  onSubmit?: (input: string) => void;
}

export function CharacterPanel({ onSubmit }: CharacterPanelProps) {
  // ── Store reads ───────────────────────────────────────────────────────────
  const masterState    = useGameStore((s) => s.masterState);
  const setMasterState = useGameStore((s) => s.setMasterState);
  const addMessage     = useGameStore((s) => s.addMessage);
  const isProcessing   = useGameStore((s) => s.isProcessing);
  const inCombat       = useGameStore((s) => s.masterState?.combat?.active === true);
  const { submitCombatAction, isResolving: combatResolving } = useCombat();

  // ── Local UI state ────────────────────────────────────────────────────────
  // Inline expand: tap a pack item to expand its detail card directly
  // below the grid. Tap the same item to collapse.
  const [selectedId,     setSelectedId]     = useState<string | null>(null);
  const [statPickerOpen, setStatPickerOpen] = useState(false);

  if (!masterState) {
    return (
      <section
        aria-label="Character"
        style={{
          padding:    "16px 12px",
          color:      "#9a7e52",
          fontStyle:  "italic",
          fontSize:   12,
          textAlign:  "center",
        }}
      >
        No character loaded
      </section>
    );
  }

  const { player_state, metadata, combat } = masterState;
  const genre = metadata.genre;
  const {
    name, background, health, max_health, attributes, resources, level, xp,
    inventory, learned_abilities, perks, passive_ability,
  } = player_state;

  const colors        = getGenreColors(genre);
  const currencyLabel = colors.currency;        // string | null
  const currencyKey   = colors.currencyKey;     // string | null
  const primaryCurrency =
    currencyKey ? resources[currencyKey] ?? 0 : null;
  void learned_abilities; void passive_ability; // narrator/ability UI lives elsewhere

  // XP — null at level cap.
  const nextThreshold = xpForNextLevel(level);
  const maxXp         = nextThreshold ?? Math.max(xp, 1);
  const isMaxLevel    = nextThreshold === null;
  const xpPct         = isMaxLevel ? 100 : Math.min(100, (xp / maxXp) * 100);

  // HP threshold.
  const hpPct   = max_health > 0 ? Math.max(0, Math.min(100, (health / max_health) * 100)) : 0;
  const hpColor = hpThresholdColor(hpPct);
  const hpPulsing = hpPct > 0 && hpPct <= 10;

  // Equipped slots.
  const equippedWeapon    = inventory.find((i) => i.equipped && i.type === ItemType.WEAPON)    ?? null;
  const equippedArmor     = inventory.find((i) => i.equipped && i.type === ItemType.ARMOR)     ?? null;
  const equippedAccessory = inventory.find(
    (i) => i.equipped && i.type !== ItemType.WEAPON && i.type !== ItemType.ARMOR && i.type !== ItemType.CONSUMABLE
  ) ?? null;

  // Pack — actual items only, no empty placeholders (CHANGE 9).
  const packItems    = inventory.filter((i) => !i.equipped);
  const selectedItem = inventory.find((i) => i.id === selectedId) ?? null;

  // ── Action handlers — preserved verbatim from InventoryPanel ──────────────

  function applyStatXpAndConsume(itemId: string, stat: keyof Attributes) {
    if (!masterState) return;
    const player = masterState.player_state;
    const owned  = player.inventory.find((i) => i.id === itemId);
    if (!owned || owned.type !== ItemType.STAT_XP) return;

    const beforeValue = player.attributes[stat];
    const afterAttrs  = applyStatBoost(player, stat);
    const afterValue  = afterAttrs[stat];
    const capped      = afterValue === beforeValue;

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

    const beat = capped
      ? `You study ${owned.name}, but your ${STAT_NAMES[stat]} is already at its peak.`
      : `You study ${owned.name} and feel your ${STAT_NAMES[stat]} sharpen.`;
    addMessage(makeMessage("SYSTEM", beat, { stat_xp_used: true, stat, capped }));

    setSelectedId(null);
    setStatPickerOpen(false);
  }

  function handleDirectConsumeItem(item: Item) {
    if (!masterState) return;
    if (item.type !== ItemType.CONSUMABLE) return;
    const player = masterState.player_state;

    let healAmount  = 0;
    let healDisplay = "0";
    if (typeof item.effect?.heal === "number" && item.effect.heal > 0) {
      healAmount  = item.effect.heal;
      healDisplay = String(healAmount);
    } else if (item.id === BASIC_HEALTH_POTION_ID) {
      const dieRoll = Math.floor(Math.random() * 8) + 1;
      healAmount    = dieRoll + 4;
      healDisplay   = String(healAmount);
    } else {
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
    addMessage(makeMessage("SYSTEM", `You use ${item.name}. Restored ${healDisplay} HP.`, {
      outcome_type:   "USE_ITEM_CONSUMED",
      direct_consume: true,
      item_name:      item.name,
    }));
    setSelectedId(null);
  }

  // ── Owned perks ───────────────────────────────────────────────────────────
  const ownedPerks = perks
    .map((id) => PERK_LIBRARY[id])
    .filter((p): p is NonNullable<typeof p> => !!p)
    .slice(0, 5);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <section
      aria-label="Character"
      style={{
        position:    "relative",
        background:  "var(--content-bg)",
        borderLeft:  "1px solid #2d2618",
        minHeight:   "100%",
      }}
    >
      {/* CHANGE 1 — three overlay divs. Inert until the surface opts in
          via genre-X classes on the root (UI-1). */}
      <div className="ol-tex"  style={{ position: "absolute", inset: 0, pointerEvents: "none" }} />
      <div className="ol-scan" style={{ position: "absolute", inset: 0, pointerEvents: "none" }} />
      <div className="ol-grid" style={{ position: "absolute", inset: 0, pointerEvents: "none" }} />

      <div
        style={{
          position:  "relative",
          padding:   "14px 12px 24px",
          display:   "flex",
          flexDirection: "column",
          gap:       12,
        }}
      >
        {/* ── CHANGE 2 — Portrait + identity ──────────────────────────── */}
        <header style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            aria-hidden
            style={{
              width:        48,
              height:       48,
              borderRadius: "50%",
              border:       "1.5px solid var(--genre-accent)",
              background:   "rgba(var(--genre-accent-rgb), 0.10)",
              display:      "flex",
              alignItems:   "center",
              justifyContent: "center",
              color:        "var(--genre-accent)",
              flexShrink:   0,
            }}
          >
            <User size={20} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              className="ew-serif"
              style={{
                fontStyle:    "italic",
                fontSize:     13,
                color:        "#e2cda0",
                whiteSpace:   "nowrap",
                overflow:     "hidden",
                textOverflow: "ellipsis",
              }}
              title={name}
            >
              {name}
            </div>
            <div
              style={{
                fontFamily:    "var(--sans)",
                fontSize:      7,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color:         "#6a5530",
                marginTop:     2,
              }}
            >
              Level {level} · {background}
            </div>
          </div>
        </header>

        {/* ── CHANGE 3 — HP bar ────────────────────────────────────────── */}
        <div>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={max_health}
            aria-valuenow={health}
            aria-label="Health"
            style={{
              width:        "100%",
              height:       8,
              borderRadius: 4,
              background:   "#1c1a17",
              overflow:     "hidden",
            }}
          >
            <div
              style={{
                width:      `${hpPct}%`,
                height:     "100%",
                background: hpColor,
                transition: "width 300ms ease, background 300ms ease",
                animation:  hpPulsing ? "ew-hp-pulse 1200ms ease-in-out infinite" : undefined,
              }}
            />
          </div>
          <div
            style={{
              fontFamily: "var(--mono)",
              fontSize:   10,
              color:      "#a08870",
              textAlign:  "right",
              marginTop:  2,
            }}
          >
            {health} / {max_health}
          </div>
        </div>

        {/* ── CHANGE 4 — XP bar ────────────────────────────────────────── */}
        <div>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={maxXp}
            aria-valuenow={isMaxLevel ? maxXp : xp}
            aria-label="Experience"
            style={{
              width:        "100%",
              height:       3,
              borderRadius: 2,
              background:   "#1c1a17",
              overflow:     "hidden",
            }}
          >
            <div
              style={{
                width:      `${xpPct}%`,
                height:     "100%",
                background: "var(--genre-accent)",
                transition: "width 400ms ease",
              }}
            />
          </div>
          <div
            style={{
              fontFamily:    "var(--sans)",
              fontSize:      7,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color:         "#4a3818",
              marginTop:     2,
            }}
          >
            {isMaxLevel ? "MAX" : `${xp} XP · Level ${level}`}
          </div>
        </div>

        {/* ── CHANGE 5 — Status effect pills (hidden when empty) ───────── */}
        {combat?.active && (combat.player_status_effects?.length ?? 0) > 0 && (
          <div
            style={{
              overflow: "hidden",
              transition: "max-height 300ms ease",
              maxHeight: 200,
            }}
          >
            <StatusEffectPills
              effects={combat.player_status_effects ?? []}
              wcd={metadata.world_consistency}
            />
          </div>
        )}

        {/* ── CHANGE 6 — Attribute block (single inline row) ───────────── */}
        <div
          aria-label="Attributes"
          style={{
            display:        "grid",
            gridTemplateColumns: "repeat(5, 1fr)",
            gap:            0,
          }}
        >
          {STAT_KEYS.map((k) => (
            <div
              key={k}
              style={{
                display:        "flex",
                flexDirection:  "column",
                alignItems:     "center",
                gap:            2,
              }}
            >
              <span
                style={{
                  fontFamily:    "var(--sans)",
                  fontSize:      6,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color:         "#6a5530",
                }}
              >
                {STAT_LABELS[k]}
              </span>
              <span
                style={{
                  fontFamily: "var(--mono)",
                  fontSize:   12,
                  color:      "#cbb888",   // CHANGE 6 — neutral, never colour-coded
                  fontWeight: 500,
                }}
              >
                {attributes[k]}
              </span>
            </div>
          ))}
        </div>

        {/* ── CHANGE 7 — Equipped items (3 slots) ──────────────────────── */}
        <section aria-label="Equipped">
          <div
            style={{
              fontFamily:    "var(--sans)",
              fontSize:      7,
              letterSpacing: "0.24em",
              textTransform: "uppercase",
              color:         "#4a3818",
              marginBottom:  4,
            }}
          >
            Equipped
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <EquipSlotRow
              kind="weapon"
              item={equippedWeapon}
              onTap={() => equippedWeapon && setSelectedId(
                selectedId === equippedWeapon.id ? null : equippedWeapon.id
              )}
            />
            <EquipSlotRow
              kind="armor"
              item={equippedArmor}
              onTap={() => equippedArmor && setSelectedId(
                selectedId === equippedArmor.id ? null : equippedArmor.id
              )}
            />
            <EquipSlotRow
              kind="accessory"
              item={equippedAccessory}
              onTap={() => equippedAccessory && setSelectedId(
                selectedId === equippedAccessory.id ? null : equippedAccessory.id
              )}
            />
          </div>
        </section>

        {/* ── CHANGE 8 — Currency ──────────────────────────────────────── */}
        {primaryCurrency !== null && currencyLabel !== null && (
          <div
            aria-label={currencyLabel}
            title={currencyLabel}
            style={{
              display:    "flex",
              alignItems: "center",
              gap:        6,
            }}
          >
            <span
              aria-hidden
              style={{
                color:           "var(--genre-accent)",
                display:         "inline-flex",
                alignItems:      "center",
              }}
            >
              {(() => {
                const Icon = CURRENCY_ICON[genre] ?? IconCoins;
                return <Icon size={14} stroke={1.75} />;
              })()}
            </span>
            <span
              style={{
                fontFamily: "var(--mono)",
                fontSize:   11,
                color:      "#c4943a",
              }}
            >
              {primaryCurrency.toLocaleString()}
            </span>
          </div>
        )}

        {/* ── CHANGE 9 — Pack inventory (3-col, actual items only) ─────── */}
        <section aria-label="Pack">
          <div
            style={{
              fontFamily:    "var(--sans)",
              fontSize:      7,
              letterSpacing: "0.24em",
              textTransform: "uppercase",
              color:         "#4a3818",
              marginBottom:  4,
            }}
          >
            Pack
          </div>
          {packItems.length === 0 ? (
            <div
              className="ew-serif"
              style={{
                fontSize:  10,
                fontStyle: "italic",
                color:     "#6a5530",
                padding:   "4px 0",
              }}
            >
              — empty —
            </div>
          ) : (
            <div
              style={{
                display:        "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap:            4,
              }}
            >
              {packItems.map((item) => {
                const isSelected = selectedId === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() =>
                      setSelectedId(isSelected ? null : item.id)
                    }
                    title={item.name}
                    style={{
                      display:        "flex",
                      flexDirection:  "column",
                      alignItems:     "center",
                      gap:            2,
                      padding:        "6px 4px",
                      background:     isSelected
                        ? "rgba(var(--genre-accent-rgb), 0.12)"
                        : "transparent",
                      border:         isSelected
                        ? "1px solid var(--genre-accent)"
                        : "1px solid transparent",
                      borderRadius:   3,
                      cursor:         "pointer",
                      minWidth:       0,
                    }}
                  >
                    <span
                      aria-hidden
                      style={{
                        color:    RARITY_COLORS[item.rarity] ?? "#7a6040",
                        fontSize: 14,
                        lineHeight: 1,
                      }}
                    >
                      {ITEM_ICONS[item.type]}
                    </span>
                    <span
                      className="ew-serif"
                      style={{
                        fontStyle:    "italic",
                        fontSize:     9,
                        color:        "#9a7e52",
                        width:        "100%",
                        whiteSpace:   "nowrap",
                        overflow:     "hidden",
                        textOverflow: "ellipsis",
                        textAlign:    "center",
                      }}
                    >
                      {item.name}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Inline detail expand — renders directly below the grid */}
          {selectedItem && (
            <ItemDetailCard
              item={selectedItem}
              onClose={() => { setSelectedId(null); setStatPickerOpen(false); }}
              onEquip={() => {
                if (!onSubmit) return;
                const verb = selectedItem.equipped ? "unequip" : "equip";
                onSubmit(`${verb} ${selectedItem.name}`);
                setSelectedId(null);
              }}
              onUse={() => {
                if (inCombat) {
                  void submitCombatAction({ action: "use_item", item_id: selectedItem.id });
                  setSelectedId(null);
                } else if (selectedItem.type === ItemType.STAT_XP) {
                  setStatPickerOpen((open) => !open);
                } else {
                  handleDirectConsumeItem(selectedItem);
                }
              }}
              onRead={() => {
                if (!onSubmit) return;
                onSubmit(`read ${selectedItem.name}`);
                setSelectedId(null);
              }}
              onDrop={() => {
                if (!onSubmit) return;
                onSubmit(`drop ${selectedItem.name}`);
                setSelectedId(null);
              }}
              statPickerOpen={statPickerOpen}
              onPickStat={(stat) => applyStatXpAndConsume(selectedItem.id, stat)}
              attributes={attributes}
              inCombat={!!inCombat}
              isProcessing={isProcessing || combatResolving}
            />
          )}
        </section>

        {/* ── CHANGE 10 — Owned perks (hidden when empty) ──────────────── */}
        {ownedPerks.length > 0 && (
          <section
            aria-label="Perks"
            style={{
              borderLeft: "2px solid var(--genre-accent)",
              paddingLeft: 8,
            }}
          >
            <div
              style={{
                fontFamily:    "var(--sans)",
                fontSize:      7,
                letterSpacing: "0.24em",
                textTransform: "uppercase",
                color:         "#4a3818",
                marginBottom:  4,
              }}
            >
              Perks
            </div>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {ownedPerks.map((p) => (
                <li
                  key={p.id}
                  className="ew-serif"
                  style={{
                    fontSize:  10,
                    fontStyle: "italic",
                    color:     "#9a7e52",
                    lineHeight: 1.5,
                  }}
                  title={p.description}
                >
                  {p.name}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* HP pulse keyframes — scoped via <style>. */}
        <style>{`
          @keyframes ew-hp-pulse {
            0%, 100% { opacity: 1; }
            50%      { opacity: 0.55; }
          }
        `}</style>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Equipped row — CHANGE 7
// ─────────────────────────────────────────────────────────────────────────────

interface EquipSlotRowProps {
  kind:  "weapon" | "armor" | "accessory";
  item:  Item | null;
  onTap: () => void;
}

function EquipSlotRow({ kind, item, onTap }: EquipSlotRowProps) {
  const slotLabel =
    kind === "weapon"    ? "Weapon"
    : kind === "armor"   ? "Armor"
    : "Accessory";

  // Abbreviated stat inline per spec.
  let statLine: string | null = null;
  if (item) {
    if (kind === "weapon") {
      const die = item.effect?.damage_die;
      if (typeof die === "string" && die.length > 0) {
        // "1d6" → "d6"; strip the leading numeric die-count for the
        // short form (matches the design ref's "d6+1" example).
        const shortDie = die.replace(/^1d/, "d");
        statLine = shortDie;
      }
    } else if (kind === "armor") {
      const ab = item.effect?.armor_bonus;
      if (typeof ab === "number") {
        statLine = `${ab >= 0 ? "+" : ""}${ab} arm`;
      }
    } else if (kind === "accessory") {
      // Primary stat bonus — show the first/highest entry.
      if (item.stat_bonus) {
        const entries = Object.entries(item.stat_bonus)
          .filter(([, v]) => typeof v === "number");
        if (entries.length > 0) {
          const [k, v] = entries[0];
          statLine = `+${v as number} ${k.slice(0, 3).toUpperCase()}`;
        }
      }
    }
  }

  return (
    <button
      type="button"
      onClick={onTap}
      disabled={!item}
      title={item ? item.name : `${slotLabel} (empty)`}
      style={{
        display:        "flex",
        alignItems:     "baseline",
        gap:            8,
        padding:        "3px 0",
        background:     "transparent",
        border:         "none",
        cursor:         item ? "pointer" : "default",
        textAlign:      "left",
        width:          "100%",
        minWidth:       0,
      }}
    >
      <span
        className="ew-serif"
        style={{
          flex:         1,
          fontStyle:    "italic",
          fontSize:     item ? 11 : 10,
          color:        item ? "#c4b090" : "#3a3020",
          whiteSpace:   "nowrap",
          overflow:     "hidden",
          textOverflow: "ellipsis",
          minWidth:     0,
        }}
      >
        {item ? item.name : "— empty"}
      </span>
      {statLine && (
        <span
          style={{
            fontFamily: "var(--mono)",
            fontSize:   10,
            color:      "#c4943a",
            flexShrink: 0,
          }}
        >
          {statLine}
        </span>
      )}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Inline item detail — CHANGE 9 expand
// ─────────────────────────────────────────────────────────────────────────────

interface ItemDetailCardProps {
  item:           Item;
  onClose:        () => void;
  onEquip:        () => void;
  onUse:          () => void;
  onRead:         () => void;
  onDrop:         () => void;
  statPickerOpen: boolean;
  onPickStat:     (stat: keyof Attributes) => void;
  attributes:     Attributes;
  inCombat:       boolean;
  isProcessing:   boolean;
}

function ItemDetailCard(props: ItemDetailCardProps) {
  const { item, onClose, onEquip, onUse, onRead, onDrop, statPickerOpen,
          onPickStat, attributes, inCombat, isProcessing } = props;

  // Loot-system stat colour (CHANGE 9 + UI design ref §15):
  //   weapon → #c4943a · heal → #7abb7a · accessory → #a888c8
  let statText:  string | null = null;
  let statColor: string        = "#c4943a";
  if (item.type === ItemType.WEAPON && item.effect?.damage_die) {
    statText  = `Damage: ${item.effect.damage_die}`;
    statColor = "#c4943a";
  } else if (item.type === ItemType.ARMOR && typeof item.effect?.armor_bonus === "number") {
    statText  = `Armor: ${item.effect.armor_bonus >= 0 ? "+" : ""}${item.effect.armor_bonus}`;
    statColor = "#c4943a";
  } else if (item.type === ItemType.CONSUMABLE) {
    if (item.id === BASIC_HEALTH_POTION_ID) {
      statText  = "Heal: 1d8+4";
    } else if (typeof item.effect?.heal === "number") {
      statText  = `Heal: ${item.effect.heal}`;
    }
    statColor = "#7abb7a";
  } else if (item.stat_bonus && Object.keys(item.stat_bonus).length > 0) {
    statText  = Object.entries(item.stat_bonus)
      .filter(([, v]) => typeof v === "number")
      .map(([k, v]) => `+${v as number} ${k.slice(0, 3).toUpperCase()}`)
      .join(", ");
    statColor = "#a888c8";
  }

  const showEquip = (item.type === ItemType.WEAPON || item.type === ItemType.ARMOR) && !inCombat;
  const showUse   = (item.type === ItemType.CONSUMABLE && !item.is_key_item)
                  || item.type === ItemType.STAT_XP;
  const showRead  = item.type === ItemType.LORE && !inCombat;
  const showDrop  = !inCombat && item.type !== ItemType.KEY;

  return (
    <div
      role="region"
      aria-label={`${item.name} detail`}
      style={{
        marginTop:    8,
        padding:      8,
        background:   "rgba(var(--genre-accent-rgb), 0.06)",
        border:       "1px solid rgba(var(--genre-accent-rgb), 0.30)",
        borderRadius: 3,
        display:      "flex",
        flexDirection: "column",
        gap:          4,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 6 }}>
        <span
          className="ew-serif"
          style={{
            fontStyle:    "italic",
            fontSize:     12,
            color:        "#e2cda0",
            whiteSpace:   "nowrap",
            overflow:     "hidden",
            textOverflow: "ellipsis",
            flex:         1,
            minWidth:     0,
          }}
        >
          {item.name}
          {item.stackable && item.quantity > 1 && (
            <span style={{ color: "#6a5530", marginLeft: 4 }}>×{item.quantity}</span>
          )}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Collapse"
          style={{
            background:    "transparent",
            border:        "none",
            color:         "#6a5530",
            cursor:        "pointer",
            fontFamily:    "var(--sans)",
            fontSize:      9,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            padding:       "2px 4px",
            flexShrink:    0,
          }}
        >
          ▾
        </button>
      </div>

      <div
        style={{
          fontFamily:    "var(--sans)",
          fontSize:      9,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color:         "#6a5530",
        }}
      >
        {item.type} · {item.rarity}
      </div>

      {statText && (
        <div
          style={{
            fontFamily: "var(--mono)",
            fontSize:   10,
            color:      statColor,
          }}
        >
          {statText}
        </div>
      )}

      {item.description && (
        <p
          className="ew-serif"
          style={{
            margin:     0,
            fontStyle:  "italic",
            fontSize:   10,
            color:      "#9a7e52",
            lineHeight: 1.4,
          }}
        >
          {item.description}
        </p>
      )}

      {/* Action buttons */}
      {item.type === ItemType.KEY ? (
        <p
          className="ew-serif"
          style={{
            fontStyle: "italic",
            fontSize:  9,
            color:     "#6a5530",
            margin:    0,
          }}
        >
          Used automatically when needed
        </p>
      ) : (
        <div style={{ display: "flex", gap: 4, marginTop: 2, flexWrap: "wrap" }}>
          {showEquip && (
            <ActionBtn
              label={item.equipped ? "Unequip" : "Equip"}
              tone="primary"
              disabled={isProcessing}
              onClick={onEquip}
            />
          )}
          {showUse && (
            <ActionBtn
              label="Use"
              tone="primary"
              disabled={isProcessing}
              onClick={onUse}
            />
          )}
          {showRead && (
            <ActionBtn
              label="Read"
              tone="primary"
              disabled={isProcessing}
              onClick={onRead}
            />
          )}
          {showDrop && (
            <ActionBtn
              label="Drop"
              tone="drop"
              disabled={isProcessing}
              onClick={onDrop}
            />
          )}
        </div>
      )}

      {/* STAT_XP inline picker (out-of-combat only) */}
      {item.type === ItemType.STAT_XP && !inCombat && statPickerOpen && (
        <div
          style={{
            marginTop:  6,
            paddingTop: 6,
            borderTop:  "1px solid rgba(var(--genre-accent-rgb), 0.25)",
          }}
        >
          <div
            style={{
              fontFamily:    "var(--sans)",
              fontSize:      8,
              letterSpacing: "0.20em",
              textTransform: "uppercase",
              color:         "#6a5530",
              marginBottom:  4,
            }}
          >
            Improve which stat?
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 3 }}>
            {STAT_KEYS.map((s) => {
              const current = attributes[s];
              const capped  = current >= STAT_CAP;
              return (
                <button
                  key={s}
                  type="button"
                  disabled={capped}
                  onClick={() => onPickStat(s)}
                  title={capped ? `${STAT_NAMES[s]} is already at the cap (${STAT_CAP}).` : `+1 ${STAT_NAMES[s]}`}
                  style={{
                    display:        "flex",
                    flexDirection:  "column",
                    alignItems:     "center",
                    padding:        "3px 0",
                    background:     "rgba(74, 138, 74, 0.10)",
                    border:         "1px solid rgba(74, 138, 74, 0.40)",
                    color:          "#86efac",
                    borderRadius:   3,
                    cursor:         capped ? "not-allowed" : "pointer",
                    opacity:        capped ? 0.4 : 1,
                    fontFamily:     "var(--mono)",
                  }}
                >
                  <span style={{ fontSize: 8, letterSpacing: "0.12em" }}>{STAT_LABELS[s]}</span>
                  <span style={{ fontSize: 10 }}>{current}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

interface ActionBtnProps {
  label:    string;
  tone:     "primary" | "drop";
  disabled: boolean;
  onClick:  () => void;
}

function ActionBtn({ label, tone, disabled, onClick }: ActionBtnProps) {
  const style: React.CSSProperties =
    tone === "drop"
      ? {
          background:    "transparent",
          border:        "1px solid rgba(196, 72, 48, 0.35)",
          color:         "#c84830",
        }
      : {
          background:    "rgba(var(--genre-accent-rgb), 0.18)",
          border:        "1px solid rgba(var(--genre-accent-rgb), 0.50)",
          color:         "var(--genre-accent)",
        };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        ...style,
        padding:       "2px 10px",
        borderRadius:  3,
        cursor:        disabled ? "not-allowed" : "pointer",
        opacity:       disabled ? 0.4 : 1,
        fontFamily:    "var(--sans)",
        fontSize:      9.5,
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        fontWeight:    600,
      }}
    >
      {label}
    </button>
  );
}
