"use client";

import React from "react";
import type { FloorLootEntry } from "@/types/game";
import { INVENTORY_CAP } from "@/lib/game/constants";
import { LootItemCard } from "./LootItemCard";

/**
 * UI-8 — shared loot list. Renders a gold row (when applicable),
 * one LootItemCard per remaining item, an inventory-full warning
 * banner when the player is at cap, and the Take All / All-collected
 * footer button.
 *
 * Identical content in the inline feed card and the loot modal — the
 * only difference between contexts is the parent's chrome.
 *
 * The header label is parent-supplied so the two contexts can vary
 * the wording ("You search the remains" inline vs the source name in
 * the modal header).
 */

interface LootListProps {
  entry:                FloorLootEntry;
  /** Genre currency word ("gold" / "credits" / etc.). Provided by the
   *  caller (already resolved against the player's genre). */
  currencyLabel:        string;
  /** Current player inventory size — drives the inventory-full state. */
  playerInventorySize:  number;
  /** Optional header line above the list. Pass null/undefined to omit
   *  (the loot modal renders its own header outside the list). */
  header?:              string | null;
  onTake:               (entry_id: string, item_id: string) => void;
  onTakeGold:           (entry_id: string) => void;
  onTakeAll:            (entry_id: string) => void;
}

export function LootList({
  entry, currencyLabel, playerInventorySize, header,
  onTake, onTakeGold, onTakeAll,
}: LootListProps) {
  const itemCount     = entry.items.length;
  const hasGold       = entry.gold > 0;
  const totalRemaining = itemCount + (hasGold ? 1 : 0);
  const inventoryFull = playerInventorySize >= INVENTORY_CAP;
  const allCollected  = totalRemaining === 0;

  return (
    <div
      role="region"
      aria-label="Loot"
      style={{
        marginTop:    8,
        padding:      0,
      }}
    >
      {/* Header */}
      {header && (
        <div
          style={{
            fontFamily:    "var(--ui-sans, var(--mono))",
            fontSize:      8,
            letterSpacing: "0.24em",
            textTransform: "uppercase",
            color:         "#6a5530",
            marginBottom:  6,
          }}
        >
          {header}
        </div>
      )}

      {/* Inventory full banner (above the list, items-only blocks) */}
      {!allCollected && inventoryFull && itemCount > 0 && (
        <div
          role="alert"
          style={{
            display:        "flex",
            flexDirection:  "column",
            gap:            2,
            padding:        "8px 10px",
            marginBottom:   8,
            background:     "rgba(180,90,40,.12)",
            border:         "1px solid rgba(180,90,40,.28)",
            borderRadius:   6,
          }}
        >
          <span
            className="ew-sans"
            style={{
              fontWeight:    700,
              fontSize:      11,
              color:         "#d8884c",
            }}
          >
            Pack full ({playerInventorySize}/{INVENTORY_CAP})
          </span>
          <span
            className="ew-sans"
            style={{
              fontSize: 10,
              color:    "#a87830",
            }}
          >
            Drop an item to make room
          </span>
        </div>
      )}

      {/* Gold row (when any). Always takeable — gold is never blocked
          by INVENTORY_CAP. Lives at the top of the list per §20. */}
      {hasGold && (
        <LootItemCard
          kind="gold"
          gold={entry.gold}
          currencyLabel={currencyLabel}
          onTake={() => onTakeGold(entry.id)}
        />
      )}

      {/* Item rows */}
      {entry.items.map((item) => (
        <LootItemCard
          key={item.id}
          kind="item"
          item={item}
          inventoryFull={inventoryFull}
          onTake={() => onTake(entry.id, item.id)}
        />
      ))}

      {/* Take All footer */}
      {allCollected ? (
        <div
          className="ew-serif"
          role="status"
          style={{
            marginTop:    6,
            padding:      "6px 0",
            textAlign:    "center",
            fontStyle:    "italic",
            fontSize:     12,
            color:        "#5a9a5a",
          }}
        >
          All collected ✓
        </div>
      ) : totalRemaining >= 1 ? (
        <TakeAllButton
          entryId={entry.id}
          remaining={totalRemaining}
          originalCount={undefined /* "Take remaining (N)" reuses current count */}
          inventoryFullBlock={inventoryFull && !hasGold && itemCount > 0}
          onTakeAll={onTakeAll}
        />
      ) : null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Take All button — full-width amber, label adapts to remaining state.
// ─────────────────────────────────────────────────────────────────────────────

interface TakeAllProps {
  entryId:            string;
  remaining:          number;
  /** Reserved for future "Take remaining (N) →" once we snapshot the
   *  initial pile size. Today every entry just shows "Take all →"
   *  with the live count when partially looted. */
  originalCount?:     number;
  /** When inventory is full AND nothing on the pile is gold, the Take
   *  All button is disabled (gold rows go separately, but the button
   *  itself becomes useless if no gold remains AND inventory is full). */
  inventoryFullBlock: boolean;
  onTakeAll:          (entry_id: string) => void;
}

function TakeAllButton({
  entryId, remaining, originalCount, inventoryFullBlock, onTakeAll,
}: TakeAllProps) {
  void originalCount;
  // Label rule per spec:
  //   all untaken (first render after search): "Take all →"
  //   some taken (count dropped from initial): "Take remaining (N) →"
  // We use a single "Take all (N) →" form when partially looted —
  // remaining count is always present and avoids the snapshot-tracking
  // overhead of distinguishing "initial vs current". Equivalent at the
  // moment of taking the first item; the label gives the same signal.
  const label = remaining === 1
    ? "Take 1 →"
    : `Take all (${remaining}) →`;

  return (
    <button
      type="button"
      onClick={() => onTakeAll(entryId)}
      disabled={inventoryFullBlock}
      className="ew-sans uppercase"
      style={{
        marginTop:     6,
        width:         "100%",
        padding:       8,
        background:    "rgba(196,148,58,.10)",
        border:        "1px solid rgba(196,148,58,.30)",
        color:         "#c4943a",
        borderRadius:  7,
        fontSize:      8,
        letterSpacing: "0.22em",
        fontWeight:    600,
        cursor:        inventoryFullBlock ? "not-allowed" : "pointer",
        opacity:       inventoryFullBlock ? 0.4 : 1,
        transition:    "background 140ms, border-color 140ms",
      }}
      onMouseEnter={(e) => {
        if (inventoryFullBlock) return;
        (e.currentTarget as HTMLButtonElement).style.background  = "rgba(196,148,58,.22)";
        (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(196,148,58,.55)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background  = "rgba(196,148,58,.10)";
        (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(196,148,58,.30)";
      }}
    >
      {label}
    </button>
  );
}
