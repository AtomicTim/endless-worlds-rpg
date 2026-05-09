"use client";

import React, { useEffect } from "react";
import { ItemType } from "@/types/game";
import type { Item } from "@/types/game";

/**
 * Day 20 Combat — consumable picker modal.
 *
 * Day 20 only ships health potions (the basic_health_potion stub).
 * Filters inventory for consumables and lists them; click submits
 * use_item with the selected item id. Cancel via button or Escape.
 */
interface Props {
  inventory: Item[];
  onSelect:  (itemId: string) => void;
  onCancel:  () => void;
}

export function UseItemPicker({ inventory, onSelect, onCancel }: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const consumables = inventory.filter((i) => i.type === ItemType.CONSUMABLE);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Use Item"
      style={{
        position:       "absolute",
        inset:          0,
        display:        "flex",
        alignItems:     "center",
        justifyContent: "center",
        background:     "color-mix(in srgb, var(--bg-0) 80%, transparent)",
        zIndex:         50,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        style={{
          minWidth:     320,
          maxWidth:     420,
          background:   "var(--bg-1)",
          border:       "1px solid var(--line)",
          borderRadius: 4,
          padding:      "16px 18px",
        }}
      >
        <div
          className="ew-mono"
          style={{
            fontSize:      10,
            letterSpacing: "0.32em",
            color:         "var(--accent)",
            textTransform: "uppercase",
            marginBottom:  10,
          }}
        >
          ◆ Use Item
        </div>
        {consumables.length === 0 ? (
          <div
            className="ew-serif"
            style={{
              fontSize:    13,
              fontStyle:   "italic",
              color:       "var(--ink-3)",
              padding:     "8px 0 12px",
            }}
          >
            No consumables available.
          </div>
        ) : (
          <ul
            style={{
              display:        "flex",
              flexDirection:  "column",
              gap:            4,
              padding:        0,
              margin:         "0 0 12px",
              listStyle:      "none",
              maxHeight:      240,
              overflowY:      "auto",
            }}
          >
            {consumables.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onSelect(item.id)}
                  style={{
                    display:        "flex",
                    justifyContent: "space-between",
                    alignItems:     "center",
                    gap:            10,
                    width:          "100%",
                    padding:        "8px 10px",
                    background:     "var(--bg-2)",
                    border:         "1px solid var(--line)",
                    borderRadius:   3,
                    cursor:         "pointer",
                    fontFamily:     "var(--mono)",
                    fontSize:       11,
                    color:          "var(--ink-1)",
                    textAlign:      "left",
                  }}
                >
                  <span>{item.name}</span>
                  <span style={{ color: "var(--ink-4)", fontSize: 9 }}>
                    ×{item.quantity}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          onClick={onCancel}
          style={{
            width:          "100%",
            padding:        "8px 10px",
            background:     "transparent",
            border:         "1px solid var(--line-2)",
            borderRadius:   3,
            fontFamily:     "var(--mono)",
            fontSize:       10,
            letterSpacing:  "0.18em",
            color:          "var(--ink-3)",
            textTransform:  "uppercase",
            cursor:         "pointer",
          }}
        >
          Cancel (Esc)
        </button>
      </div>
    </div>
  );
}
