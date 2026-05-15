"use client";

import React, { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { FloorLootEntry } from "@/types/game";
import { useGameStore } from "@/lib/stores/game-store";
import { useFloorLoot } from "@/hooks/useFloorLoot";
import { currencyLabelFor } from "@/lib/game/currency";
import { LootList } from "./LootList";

/**
 * UI-8 — Loot Modal. Opens from the Context Panel "In this space"
 * unlooted-remains entries. Same loot data + Take/Take All buttons as
 * the inline feed card, just wrapped in a backdrop + card chrome.
 *
 * Spec: docs/ui-design-reference.md §20 ("Revisit — Context Panel
 * Entry + Loot Modal").
 *
 *   Backdrop: rgba(0,0,0,.78), 300ms fade
 *   Card:     scale(.88)→scale(1) + opacity(0→1),
 *             400ms cubic-bezier(0.22,1,0.36,1)
 *             ~280px wide
 *   Header:   source name + ti-x close (lucide X used until Tabler ships)
 *   Backdrop tap OR ✕ closes.
 *
 * When entry.pending is still set (player opened the modal before
 * tapping Search), we surface the same "Search the remains →" link
 * as the inline card so the modal path can also resolve loot.
 */

interface LootModalProps {
  /** ID of the open floor_loot entry. null = closed. */
  entryId:  string | null;
  onClose:  () => void;
}

export function LootModal({ entryId, onClose }: LootModalProps) {
  const masterState = useGameStore((s) => s.masterState);
  const handlers    = useFloorLoot();

  // Mount animation: render with opacity 0 + scale 0.88, then on the
  // next frame flip to opacity 1 + scale 1 so CSS transitions kick in.
  // The standard double-rAF trick (UI design ref §15).
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    if (entryId === null) {
      setMounted(false);
      return;
    }
    // requestAnimationFrame ×2 ensures the initial render lands first.
    let raf2: number | null = null;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setMounted(true));
    });
    return () => {
      cancelAnimationFrame(raf1);
      if (raf2 !== null) cancelAnimationFrame(raf2);
    };
  }, [entryId]);

  // Resolve the live entry every render — taking an item shrinks
  // entry.items in place via the store, and the modal re-renders.
  if (entryId === null || !masterState) return null;
  const entry: FloorLootEntry | undefined = masterState.floor_loot?.find((e) => e.id === entryId);
  if (!entry) return null;

  const genre         = masterState.metadata.genre;
  const currencyLabel = currencyLabelFor(genre);

  const sourceTitle = entry.source === "enemy" ? "Remains" : "Container";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Loot"
      onClick={onClose}
      style={{
        position:   "fixed",
        inset:      0,
        zIndex:     50,
        background: "rgba(0,0,0,0.78)",
        opacity:    mounted ? 1 : 0,
        transition: "opacity 300ms ease",
        display:    "flex",
        alignItems: "center",
        justifyContent: "center",
        padding:    16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width:        "100%",
          maxWidth:     280,
          maxHeight:    "85vh",
          overflow:     "auto",
          background:   "var(--content-bg, var(--bg-1))",
          border:       "1px solid rgba(var(--genre-accent-rgb), .35)",
          borderRadius: 7,
          padding:      14,
          fontFamily:   "var(--mono)",
          color:        "var(--ink-1)",
          opacity:      mounted ? 1 : 0,
          transform:    mounted ? "scale(1)" : "scale(0.88)",
          transition:   "opacity 400ms cubic-bezier(0.22,1,0.36,1), transform 400ms cubic-bezier(0.22,1,0.36,1)",
        }}
      >
        {/* Header */}
        <header
          style={{
            display:        "flex",
            alignItems:     "center",
            justifyContent: "space-between",
            gap:            8,
            marginBottom:   8,
            paddingBottom:  6,
            borderBottom:   "1px solid rgba(var(--genre-accent-rgb), .18)",
          }}
        >
          <span
            className="ew-serif"
            style={{
              fontStyle:    "italic",
              fontSize:     13,
              color:        "#e2cda0",
              overflow:     "hidden",
              textOverflow: "ellipsis",
              whiteSpace:   "nowrap",
              flex:         1,
              minWidth:     0,
            }}
          >
            {sourceTitle}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close loot"
            style={{
              background: "transparent",
              border:     "none",
              color:      "#7a6040",
              cursor:     "pointer",
              padding:    2,
              flexShrink: 0,
            }}
          >
            <X size={16} />
          </button>
        </header>

        {/* Body — pending → search prompt; resolved → loot list. */}
        {entry.pending ? (
          <button
            type="button"
            onClick={() => handlers.onSearchRemains(entry.id)}
            className="ew-serif"
            style={{
              width:        "100%",
              padding:      "10px 12px",
              fontStyle:    "italic",
              fontSize:     13,
              color:        "var(--genre-accent)",
              background:   "rgba(var(--genre-accent-rgb), .10)",
              border:       "1px solid rgba(var(--genre-accent-rgb), .30)",
              borderRadius: 7,
              cursor:       "pointer",
              textAlign:    "center",
            }}
          >
            Search the remains →
          </button>
        ) : (
          <LootList
            entry={entry}
            currencyLabel={currencyLabel}
            playerInventorySize={masterState.player_state.inventory.length}
            header={null}
            onTake={handlers.onTake}
            onTakeGold={handlers.onTakeGold}
            onTakeAll={handlers.onTakeAll}
          />
        )}
      </div>
    </div>
  );
}
