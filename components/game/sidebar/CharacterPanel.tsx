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
  // char-panel: equipped tile grid + 4-col pack — Tabler glyphs
  // replace the unicode/emoji set so the tiles match the rest of
  // the Tabler-icon design language and stay crisp at 18-22px.
  IconSword,
  IconShield,
  IconDiamond,
  IconFlask,
  IconKey,
  IconBook,
  IconPackage,
  IconStar,
  IconSparkles,
  IconQuestionMark,
} from "@tabler/icons-react";
import { Genre, ItemType } from "@/types/game";
import type { Attributes, Item } from "@/types/game";
import { useGameStore, makeMessage } from "@/lib/stores/game-store";
import { useCombat } from "@/hooks/useCombat";
import { getGenreColors } from "@/components/game/genre-ui";
import { applyStatBoost } from "@/lib/game/level-resolver";
import { STAT_CAP, INVENTORY_CAP } from "@/lib/game/constants";
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

/** char-panel — ItemType → Tabler icon. Replaces the prior unicode/
 *  emoji set; @tabler/icons-react is already a dependency (UI-12) so
 *  the tile grid renders crisp at any DPR. RARITY_COLORS dropped
 *  with the icon-only pack redesign — rarity hue no longer tints the
 *  pack icon, so the legacy map had no remaining caller. */
const ITEM_TABLER_ICONS: Record<ItemType, TablerIcon> = {
  [ItemType.WEAPON]:     IconSword,
  [ItemType.ARMOR]:      IconShield,
  [ItemType.CONSUMABLE]: IconFlask,
  [ItemType.KEY]:        IconKey,
  [ItemType.LORE]:       IconBook,
  [ItemType.CONTAINER]:  IconPackage,
  [ItemType.VALUABLE]:   IconDiamond,
  [ItemType.QUEST_ITEM]: IconStar,
  [ItemType.STAT_XP]:    IconSparkles,
};

/** char-panel — equipped slot kind → Tabler icon for the empty-slot
 *  affordance. When something IS equipped the tile uses the item's
 *  own icon from ITEM_TABLER_ICONS above; this map covers the empty
 *  tile so the slot still reads as "weapon" / "armor" / "accessory". */
const SLOT_TABLER_ICONS: Record<"weapon" | "armor" | "accessory", TablerIcon> = {
  weapon:    IconSword,
  armor:     IconShield,
  accessory: IconDiamond,
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

/** PR-5v-e — rarity → CSS variable name. Returns the var() expression
 *  rather than a hex so theming + the ui-foundation hex sweep both
 *  stay clean. The five tier names match types/game.ts ItemRarity
 *  enum values (COMMON / UNCOMMON / RARE / LEGENDARY); "epic" is
 *  carried defensively for any future tier expansion — the enum
 *  doesn't expose it today but the colour is defined in globals.css
 *  and may surface via lore items / loot card uplift later. Unknown
 *  / undefined input falls back to common (gray). */
function rarityColor(rarity: string | undefined): string {
  switch ((rarity ?? "").toLowerCase()) {
    case "uncommon":  return "var(--rarity-uncommon)";
    case "rare":      return "var(--rarity-rare)";
    case "epic":      return "var(--rarity-epic)";
    case "legendary": return "var(--rarity-legendary)";
    default:          return "var(--rarity-common)";
  }
}

/** BG-3 (D) / BG-3b (A) — rarity → short display string for the
 *  EquipSlotRow's middle column. The full enum words ("UNCOMMON",
 *  "LEGENDARY") overflowed the 1.5-flex rarity slot in the equipped
 *  row, so we map to a 3–4 char abbreviation. RARE and EPIC are
 *  already short enough to keep their full form. Unknown / missing
 *  rarity falls back to "COM" so the column never blanks. */
function rarityLabel(rarity: string | undefined): string {
  switch ((rarity ?? "").trim().toLowerCase()) {
    case "common":    return "COM";
    case "uncommon":  return "UNC";
    case "rare":      return "RARE";
    case "epic":      return "EPIC";
    case "legendary": return "LEG";
    default:          return "COM";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HP / XP helpers
// ─────────────────────────────────────────────────────────────────────────────

/** UI-9 CHANGE 3 — HP threshold colour ladder.
 *  PR-5: returns CSS var() strings; React passes them straight into the
 *  style prop where CSS resolves at paint time. The 5-band gradient lives
 *  in globals.css as --hp-healthy / --hp-good / --hp-hurt / --hp-danger /
 *  --hp-critical (design ref §8 HP STATES). Function is only consumed
 *  inside this file (line 199 ↓ `background: hpColor`). */
export function hpThresholdColor(pct: number): string {
  if (pct >= 75) return "var(--hp-healthy)";
  if (pct >= 50) return "var(--hp-good)";
  if (pct >= 25) return "var(--hp-hurt)";
  if (pct >= 10) return "var(--hp-danger)";
  return "var(--hp-critical)";
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
          color:      "var(--atmosphere)",
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
        position:     "relative",
        // PR-5v (A): panel wrapper is a visible card now — was a
        // bare borderLeft-only edge against the page background.
        // mockup: character panel fantasy.png shows the panel sitting
        // as a rounded card distinct from the page bg.
        background:   "var(--bg-2)",
        border:       "1px solid var(--card-border)",
        borderRadius: 8,
        overflow:     "hidden",
        minHeight:    "100%",
      }}
    >
      {/* BG-3b (B): genre overlay trio (.ol-tex / .ol-scan / .ol-grid)
          removed. The Fantasy candlelight gradient was bleeding amber
          into the sidebar against the BG-3 neutral panel surface, which
          read as a smudge rather than a treatment. Overlays belong in
          the story feed, not the sidebars — see UI-1 for the original
          opt-in pattern. */}

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
                color:        "var(--ui-text-1)",
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
                color:         "var(--ui-text-muted)",
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
              background:   "var(--ui-bg-primary)",
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
              color:      "var(--ui-text-2)",
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
              background:   "var(--ui-bg-primary)",
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
              // PR-5v-b (B): XP line lifted to match the section-label
              // brightness — was 7px / 0.18em / var(--nav-breadcrumb)
              // (washed out against the new BG-1 surface).
              fontFamily:    "var(--sans)",
              fontSize:      9,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color:         "var(--ui-text-2)",
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

        {/* ── PR-5v (B) — Attribute block: bordered cells, number TOP
              + label BOTTOM (mockup 1: character panel fantasy.png).
              Section header "ATTRIBUTES" matches mockup 1. */}
        <section aria-label="Attributes">
          <div
            style={{
              // PR-5v-b (B): section-label brightness lift —
              // var(--ui-text-2) 9px 0.12em was 7px / 0.24em / dim.
              fontFamily:    "var(--sans)",
              fontSize:      9,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color:         "var(--ui-text-2)",
              marginBottom:  6,
            }}
          >
            Attributes
          </div>
          <div
            style={{
              display:             "grid",
              gridTemplateColumns: "repeat(5, 1fr)",
              gap:                 6,
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
                  padding:        "6px 8px",
                  // BG-3 (B) — attribute cell on the new neutral
                  // panel surface. var(--bg-3) sits one step above
                  // the panel wrapper (--bg-2) for visible card
                  // separation; was rgba(0,0,0,.15) which produced
                  // an ad-hoc dark wash that no longer reads against
                  // the neutral gray panel.
                  background:     "var(--bg-3)",
                  border:         "1px solid var(--card-border)",
                  borderRadius:   7,
                  minWidth:       0,
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize:   22,
                    lineHeight: 1,
                    color:      "var(--ui-text-1)",
                    fontWeight: 500,
                  }}
                >
                  {attributes[k]}
                </span>
                <span
                  style={{
                    fontFamily:    "var(--sans)",
                    fontSize:      8,
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    color:         "var(--ui-text-muted)",
                  }}
                >
                  {STAT_LABELS[k]}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* ── PR-5v (C+D) — Equipped: 3 full-width rows + gold in header.
              The 3 × 80px tile layout from the previous char-panel pass
              overflowed the 196px sidebar (known gap closed by this PR).
              Rows always render all 3 slots — empty slots show "— empty"
              with the slot type on the right so the player can see
              which slots are open. */}
        <section aria-label="Equipped">
          <div
            style={{
              display:       "flex",
              alignItems:    "center",
              gap:           6,
              marginBottom:  4,
            }}
          >
            <span
              style={{
                // PR-5v-b (B): brightness lift (see Attributes header).
                fontFamily:    "var(--sans)",
                fontSize:      9,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color:         "var(--ui-text-2)",
                flex:          1,
              }}
            >
              Equipped
            </span>
            {primaryCurrency !== null && currencyLabel !== null && (
              <span
                aria-label={currencyLabel}
                title={currencyLabel}
                style={{
                  display:    "inline-flex",
                  alignItems: "center",
                  gap:        4,
                  color:      "var(--genre-accent)",
                }}
              >
                {(() => {
                  const Icon = CURRENCY_ICON[genre] ?? IconCoins;
                  return <Icon size={12} stroke={1.75} aria-hidden />;
                })()}
                <span
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize:   11,
                    color:      "var(--genre-accent)",
                  }}
                >
                  {primaryCurrency.toLocaleString()}g
                </span>
              </span>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <EquipSlotRow
              kind="weapon"
              item={equippedWeapon}
              isSelected={!!equippedWeapon && selectedId === equippedWeapon.id}
              onTap={() => equippedWeapon && setSelectedId(
                selectedId === equippedWeapon.id ? null : equippedWeapon.id
              )}
            />
            <EquipSlotRow
              kind="armor"
              item={equippedArmor}
              isSelected={!!equippedArmor && selectedId === equippedArmor.id}
              onTap={() => equippedArmor && setSelectedId(
                selectedId === equippedArmor.id ? null : equippedArmor.id
              )}
            />
            <EquipSlotRow
              kind="accessory"
              item={equippedAccessory}
              isSelected={!!equippedAccessory && selectedId === equippedAccessory.id}
              onTap={() => equippedAccessory && setSelectedId(
                selectedId === equippedAccessory.id ? null : equippedAccessory.id
              )}
            />
          </div>
        </section>

        {/* ── CHANGE 9 — Pack inventory (3-col, actual items only) ─────── */}
        <section aria-label="Pack">
          <div
            style={{
              // PR-5v-b (B): brightness lift (see Attributes header).
              fontFamily:    "var(--sans)",
              fontSize:      9,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color:         "var(--ui-text-2)",
              marginBottom:  4,
            }}
          >
            Pack
          </div>
          {/* PR-5v-c (B): ItemDetailCard moved ABOVE the grid. Was
              below the grid (post PR-5v); on tap the expanded card
              would push the grid out of view. Above the grid means
              the detail is always visible without scrolling, and
              the selection-target tile sits below the detail for
              an obvious visual link. */}
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
          {/* PR-5v-b (A) — 4-col grid, fixed 20 cells (INVENTORY_CAP).
              Replaces PR-5v's dynamic 3-col count with a stable
              4×5 = 20 grid that matches mockup 3 (inventory.png).
              PR-5v-c lifted the sidebar to 200/240px so each cell
              is now ~44-50px square; pack tiles are still icon-only
              at this scale — full name is available in the inline
              ItemDetailCard above the grid (PR-5v-c moved it above
              on tap). Empty cells stay as the same dim bordered
              tiles introduced in PR-5v. */}
          <div
            style={{
              display:             "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap:                 6,
              marginTop:           selectedItem ? 8 : 0,
            }}
          >
            {Array.from({ length: INVENTORY_CAP }).map((_, i) => {
              const item = packItems[i];
              if (!item) {
                return (
                  <div
                    key={`empty-${i}`}
                    aria-hidden
                    style={{
                      aspectRatio:  "1",
                      background:   "transparent",
                      border:       "1px solid var(--card-border)",
                      borderRadius: 6,
                      opacity:      0.4,
                    }}
                  />
                );
              }
              const isSelected = selectedId === item.id;
              const Icon       = ITEM_TABLER_ICONS[item.type] ?? IconQuestionMark;
              // PR-5v-e — pack cell border tinted by rarity colour.
              // Selected: full-brightness rarity border at 1.5px,
              // replacing the prior genre-accent treatment so the
              // rarity reads as the cell's identity. Unselected: the
              // rarity colour rendered at ~45% via color-mix against
              // transparent — visible but subtle. Empty cells (the
              // earlier branch above) keep the dim --card-border
              // dashed style so they read as "slot, not item."
              const tier      = rarityColor(item.rarity);
              const tierSoft  = `color-mix(in srgb, ${tier} 45%, transparent)`;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedId(isSelected ? null : item.id)}
                  title={item.name}
                  style={{
                    aspectRatio:    "1",
                    // BG-3 (B) — pack cell on the neutral surface tier.
                    // Was var(--bg-2) (the panel wrapper); now one step
                    // above so the grid cells still pop against the
                    // panel after both --bg-2 and --bg-3 shifted to the
                    // neutral gray palette.
                    background:     "var(--bg-3)",
                    // BG-3 (E) — rarity border thickened: 1px → 2px
                    // unselected, 1.5px → 3px selected, so the rarity
                    // colour reads at a glance against the dark cell.
                    border:         isSelected
                      ? `3px solid ${tier}`
                      : `2px solid ${tierSoft}`,
                    borderRadius:   6,
                    display:        "flex",
                    alignItems:     "center",
                    justifyContent: "center",
                    cursor:         "pointer",
                    padding:        0,
                    transition:     "border-color 120ms",
                  }}
                  onMouseEnter={(e) => {
                    if (isSelected) return;
                    (e.currentTarget as HTMLButtonElement).style.borderColor = tier;
                  }}
                  onMouseLeave={(e) => {
                    if (isSelected) return;
                    (e.currentTarget as HTMLButtonElement).style.borderColor = tierSoft;
                  }}
                >
                  <Icon size={18} stroke={1.75} color="var(--npc-role)" aria-hidden />
                </button>
              );
            })}
          </div>

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
                color:         "var(--nav-breadcrumb)",
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
                    color:     "var(--atmosphere)",
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
// Equipped row — PR-5v rebuild
//
// Full-width row per slot (weapon / armor / accessory) with:
//   [icon] [italic-serif name flex:1] [stat OR slot type, right-aligned]
//
// Replaces the 3×80px EquipSlotTile from the previous pass — those
// tiles overflowed the 196px sidebar and clipped the accessory slot
// (known gap noted in PROMPT-LOG, closed by this PR). Always renders
// all 3 slots; empty slots show "— empty" + the slot type so the
// player can see which slots are open. Filled slots show stat
// (d6+1, +2 arm, +1 INT) right-aligned per design ref §13 + mockup 2
// (inventory and character panel.png).
// ─────────────────────────────────────────────────────────────────────────────

interface EquipSlotRowProps {
  kind:        "weapon" | "armor" | "accessory";
  item:        Item | null;
  isSelected:  boolean;
  onTap:       () => void;
}

function EquipSlotRow({ kind, item, isSelected, onTap }: EquipSlotRowProps) {
  const slotLabelLong =
    kind === "weapon"    ? "Weapon"
    : kind === "armor"   ? "Armor"
    : "Accessory";

  // Slot-type label for the right side of empty rows. Matches mockup 1
  // (character panel fantasy.png) — WEAPON / ARMOUR / ACCESSORY in
  // Inter Tight uppercase muted.
  const slotLabelShort =
    kind === "weapon"    ? "WEAPON"
    : kind === "armor"   ? "ARMOUR"
    : "ACCESSORY";

  // Stat abbreviation, preserved from the prior EquipSlotTile logic:
  // weapons collapse "1d6" → "d6"; armor renders "+N arm"; accessories
  // surface the first stat_bonus entry. PR-5v adds an "—" fallback
  // per brief: filled slot with no stat-worthy field shows the em dash
  // rather than an empty right column.
  let statLine: string = "—";
  if (item) {
    if (kind === "weapon") {
      const die = item.effect?.damage_die;
      if (typeof die === "string" && die.length > 0) {
        statLine = die.replace(/^1d/, "d");
      }
    } else if (kind === "armor") {
      const ab = item.effect?.armor_bonus;
      if (typeof ab === "number") {
        statLine = `${ab >= 0 ? "+" : ""}${ab} arm`;
      }
    } else if (kind === "accessory") {
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

  // Icon source: equipped item uses its ItemType icon; empty slot
  // falls back to SLOT_TABLER_ICONS so the row still reads as "this
  // is the weapon slot" even when empty.
  const Icon = item
    ? (ITEM_TABLER_ICONS[item.type] ?? IconQuestionMark)
    : SLOT_TABLER_ICONS[kind];

  // BG-3 (D) — filled-slot inner layout: name · RARITY · stat with
  // middle-dot separators. The card container (background, border,
  // padding, radius, height) is unchanged — only the inner flex
  // structure shifts so the rarity is now a labelled column instead
  // of a 5px dot. Empty slots keep their prior shape (no separators,
  // no rarity column).
  //
  // Flex proportions on filled rows:
  //   name   : flex 3   (truncated, ellipsis)
  //   RARITY : flex 1.5 (centred, Inter Tight uppercase)
  //   stat   : flex 1.5 (right-aligned, JetBrains Mono accent)
  //
  // BG-3c (B) — separator switched from middle-dot to pipe and lifted
  // in contrast (var(--ui-border-strong) → var(--ui-text-muted)), with
  // 6→8px side margins for breathing room. The pipe stroke reads at
  // the 200px sidebar width where the middle-dot had been visually
  // disappearing. Explicit fontSize: 10 stops it inheriting the row's
  // 12px serif italic and rendering oversized in the gap.
  // BG-3e — separator margins trimmed 0 8px → 0 5px (6px total saved
  // per separator, 12px over both) to hand the recovered space to
  // the name and stat columns. The pipe still reads cleanly because
  // it has its own glyph weight; the 8px breathing room turned out
  // to be more than the layout needed once the stat column got its
  // minWidth guarantee.
  const sep = (
    <span
      aria-hidden
      style={{
        color:      "var(--ui-text-muted)",
        margin:     "0 5px",
        flexShrink: 0,
        fontSize:   10,
      }}
    >
      |
    </span>
  );

  return (
    <button
      type="button"
      onClick={onTap}
      disabled={!item}
      title={item ? item.name : `${slotLabelLong} (empty)`}
      style={{
        display:        "flex",
        alignItems:     "center",
        gap:            10,
        width:          "100%",
        padding:        "8px 10px",
        // BG-3 (B) — equipped card now sits on --bg-3 (neutral dark
        // gray) instead of rgba(0,0,0,.2). Container shape unchanged.
        background:     "var(--bg-3)",
        border:         isSelected
          ? "1.5px solid rgba(var(--genre-accent-rgb), 0.45)"
          : "1px solid var(--card-border)",
        borderRadius:   7,
        cursor:         item ? "pointer" : "default",
        opacity:        item ? 1 : 0.45,
        textAlign:      "left",
        transition:     "border-color 120ms",
      }}
    >
      <Icon size={14} stroke={1.75} color="var(--npc-role)" aria-hidden />
      {item ? (
        <>
          {/* Name — flex 4, truncated. BG-3d lifted 3→4 so common
              short names ("Robes", "Staff") render in full at the
              200px sidebar breakpoint without the rarity/stat
              columns stealing space. */}
          <span
            className="ew-serif"
            style={{
              flex:         4,
              minWidth:     0,
              fontStyle:    "italic",
              fontSize:     12,
              color:        "var(--npc-name)",
              whiteSpace:   "nowrap",
              overflow:     "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {item.name}
          </span>

          {sep}

          {/* RARITY — Inter Tight uppercase tinted by the item's tier
              colour. BG-3c (A) — must never truncate: flexShrink: 0
              pins width to content, minWidth: 38 reserves enough room
              for the longest 4-char label (RARE / EPIC) even when
              the name column is squeezing the row. overflow: visible
              + no text-overflow: ellipsis means the column will push
              the name shorter rather than clip itself. BG-3d dropped
              the growth weight 1.5→1 so the name column (now flex 4)
              keeps the lion's share of any slack at wider breakpoints
              instead of splitting it three ways. */}
          <span
            className="uppercase"
            style={{
              flex:          1,
              flexShrink:    0,
              minWidth:      38,
              fontFamily:    "var(--sans)",
              fontSize:      8,
              letterSpacing: "0.10em",
              color:         rarityColor(item.rarity),
              textAlign:     "center",
              whiteSpace:    "nowrap",
              overflow:      "visible",
            }}
          >
            {rarityLabel(item.rarity)}
          </span>

          {sep}

          {/* Stat — flex 1, right-aligned, JetBrains Mono accent.
              BG-3d dropped 1.5→1 alongside rarity so the name column
              gets the row's growth budget. BG-3e raised minWidth
              from 0 to 44 — the widest expected string ("+0 arm")
              at JetBrains Mono 11px lands just inside that, so the
              column will push the name shorter rather than clip
              itself. Without the floor, a tight 200px sidebar was
              truncating "d6" → "d" and "+0 arm" → "+". */}
          <span
            style={{
              flex:       1,
              minWidth:   44,
              fontFamily: "var(--mono)",
              fontSize:   11,
              color:      "var(--genre-accent)",
              textAlign:  "right",
              whiteSpace: "nowrap",
              overflow:   "hidden",
            }}
          >
            {statLine}
          </span>
        </>
      ) : (
        <>
          {/* Empty-slot layout unchanged — name "— empty" on the left,
              slot type label (WEAPON / ARMOUR / ACCESSORY) on the
              right. No separators, no rarity column. */}
          <span
            className="ew-serif"
            style={{
              flex:         1,
              minWidth:     0,
              fontStyle:    "italic",
              fontSize:     12,
              color:        "var(--npc-name)",
              whiteSpace:   "nowrap",
              overflow:     "hidden",
              textOverflow: "ellipsis",
            }}
          >
            — empty
          </span>
          <span
            style={{
              fontFamily:    "var(--sans)",
              fontSize:      8,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color:         "var(--ui-text-muted)",
              flexShrink:    0,
            }}
          >
            {slotLabelShort}
          </span>
        </>
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
  let statColor: string        = "var(--genre-accent)";
  if (item.type === ItemType.WEAPON && item.effect?.damage_die) {
    statText  = `Damage: ${item.effect.damage_die}`;
    statColor = "var(--genre-accent)";
  } else if (item.type === ItemType.ARMOR && typeof item.effect?.armor_bonus === "number") {
    statText  = `Armor: ${item.effect.armor_bonus >= 0 ? "+" : ""}${item.effect.armor_bonus}`;
    statColor = "var(--genre-accent)";
  } else if (item.type === ItemType.CONSUMABLE) {
    if (item.id === BASIC_HEALTH_POTION_ID) {
      statText  = "Heal: 1d8+4";
    } else if (typeof item.effect?.heal === "number") {
      statText  = `Heal: ${item.effect.heal}`;
    }
    statColor = "var(--stat-heal)";
  } else if (item.stat_bonus && Object.keys(item.stat_bonus).length > 0) {
    statText  = Object.entries(item.stat_bonus)
      .filter(([, v]) => typeof v === "number")
      .map(([k, v]) => `+${v as number} ${k.slice(0, 3).toUpperCase()}`)
      .join(", ");
    statColor = "var(--stat-accessory)";
  }

  const showEquip = (item.type === ItemType.WEAPON || item.type === ItemType.ARMOR) && !inCombat;
  const showUse   = (item.type === ItemType.CONSUMABLE && !item.is_key_item)
                  || item.type === ItemType.STAT_XP;
  const showRead  = item.type === ItemType.LORE && !inCombat;
  const showDrop  = !inCombat && item.type !== ItemType.KEY;

  // PR-5v-e — detail card border picks up the item's rarity colour
  // at ~45% (matching the pack cell unselected tint) so the rarity
  // reads as the card's identity. Background stays the genre-accent
  // wash for tonal continuity with the surrounding sidebar.
  const rarityTier      = rarityColor(item.rarity);
  const rarityBorderTone = `color-mix(in srgb, ${rarityTier} 45%, transparent)`;
  return (
    <div
      role="region"
      aria-label={`${item.name} detail`}
      style={{
        marginTop:    8,
        padding:      8,
        // BG-3 (B) — item detail expand card sits on --bg-elevated
        // (#2a2a2a), one tier above --bg-3 cells, so the elevated
        // state reads against the panel. Was a faint genre-accent
        // wash that drifted against the neutral palette.
        background:   "var(--bg-elevated)",
        // BG-3 (E) — rarity border thickened 1px → 2px to match the
        // pack cells. rarityBorderTone is still the rarity colour at
        // ~45% via color-mix so the tier reads without overpowering
        // the elevated surface.
        border:       `2px solid ${rarityBorderTone}`,
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
            color:        "var(--ui-text-1)",
            whiteSpace:   "nowrap",
            overflow:     "hidden",
            textOverflow: "ellipsis",
            flex:         1,
            minWidth:     0,
          }}
        >
          {item.name}
          {item.stackable && item.quantity > 1 && (
            <span style={{ color: "var(--ui-text-muted)", marginLeft: 4 }}>×{item.quantity}</span>
          )}
        </span>
        {/* PR-5v-d: item value in genre accent — Common 5-15, Uncommon
            20-50, Rare 100-300, Legendary 500+ (Item.value JSDoc).
            Suppressed when value is missing, zero, or this is a
            starting item (sell value 0 per CLAUDE.md ECONOMY BASELINE
            — starting gear can't be sold so showing "0g" would mislead). */}
        {typeof item.value === "number" && item.value > 0 && !item.starting_item && (
          <span
            style={{
              fontFamily: "var(--mono)",
              fontSize:   11,
              color:      "var(--genre-accent)",
              flexShrink: 0,
            }}
          >
            {item.value}g
          </span>
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label="Collapse"
          style={{
            background:    "transparent",
            border:        "none",
            color:         "var(--ui-text-muted)",
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

      {/* PR-5v-e — type / rarity meta line. Split so the TYPE keeps
          the existing muted UI ink and the RARITY word picks up its
          tier colour. Both spans inherit the row-level tracking and
          uppercase treatment from the parent div. */}
      <div
        style={{
          fontFamily:    "var(--sans)",
          fontSize:      9,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
        }}
      >
        <span style={{ color: "var(--ui-text-muted)" }}>
          {item.type} ·{" "}
        </span>
        <span style={{ color: rarityTier }}>
          {item.rarity}
        </span>
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
            color:      "var(--atmosphere)",
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
            color:     "var(--ui-text-muted)",
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
              color:         "var(--ui-text-muted)",
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
                    color:          "var(--action-buff)",
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
          // PR-5: drop button reuses var(--hp-danger) for its text colour
          // — same hex (#c84830) as the HP 10–25% band. Cross-semantic
          // reuse is intentional: "deep red = danger" applies to both
          // a near-death HP bar and an inventory-drop confirm. The
          // rgba(196,72,48,.35) border is a separate hex (#c44830,
          // slightly darker red) that the harness doesn't flag — left
          // as-is per PR-5 scope.
          border:        "1px solid rgba(196, 72, 48, 0.35)",
          color:         "var(--hp-danger)",
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
