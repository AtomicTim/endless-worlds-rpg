"use client";

import { X } from "lucide-react";
import { Genre } from "@/types/game";
import type { Item } from "@/types/game";
import { useGameStore } from "@/lib/stores/game-store";

interface TradeModalProps {
  onBuy:  (item: Item) => void;
  onSell: (item: Item) => void;
}

const CURRENCY_KEYS: Partial<Record<Genre, string>> = {
  [Genre.FANTASY]:          "gold",
  [Genre.CYBERPUNK]:        "credits",
  [Genre.SPACE_OPERA]:      "stellar_units",
  [Genre.POST_APOCALYPTIC]: "caps",
};

const CURRENCY_LABELS: Partial<Record<Genre, string>> = {
  [Genre.FANTASY]:          "Gold",
  [Genre.CYBERPUNK]:        "Credits",
  [Genre.SPACE_OPERA]:      "Stellar Units",
  [Genre.POST_APOCALYPTIC]: "Caps",
};

const RARITY_COLORS: Record<string, string> = {
  COMMON:    "var(--color-muted)",
  UNCOMMON:  "#22c55e",
  RARE:      "#3b82f6",
  LEGENDARY: "#f59e0b",
};

/**
 * Trade Modal — opens whenever the narrator emits items_for_sale (resolveInteract
 * detected merchant keywords). Renders inline between StoryFeed and InputBar
 * (same pattern as DialogueModal). Player can buy from merchant or sell items
 * from their pack at 50% of value. Closes on the X button — clears
 * currentTradeItems in the store.
 */
export function TradeModal({ onBuy, onSell }: TradeModalProps) {
  const tradeItems  = useGameStore((s) => s.currentTradeItems);
  const masterState = useGameStore((s) => s.masterState);
  const npcName     = useGameStore((s) => s.currentDialogueNpc);
  const setItems    = useGameStore((s) => s.setTradeItems);

  if (tradeItems.length === 0 || !masterState) return null;

  const genre        = masterState.metadata.genre;
  const currencyKey  = CURRENCY_KEYS[genre];
  const currencyLbl  = CURRENCY_LABELS[genre] ?? "Currency";
  const balance      = currencyKey ? masterState.player_state.resources[currencyKey] ?? 0 : 0;
  const sellableInv  = masterState.player_state.inventory.filter(
    (i) => !i.equipped && (i.value ?? 0) > 0
  );

  return (
    <div
      role="dialog"
      aria-label="Merchant trade"
      className="flex shrink-0 flex-col overflow-hidden"
      style={{
        height:          "260px",
        maxHeight:       "260px",
        borderTop:       "3px solid var(--color-primary)",
        borderBottom:    "1px solid var(--color-border)",
        backgroundColor: "var(--color-bg)",
      }}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div
        className="flex shrink-0 items-center justify-between px-3 py-1.5"
        style={{
          borderBottom:    "1px solid var(--color-border)",
          backgroundColor: "color-mix(in srgb, var(--color-primary) 8%, transparent)",
        }}
      >
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--color-primary)" }}>
            Trading{npcName ? ` with ${npcName}` : ""}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[11px]" style={{ color: "var(--color-text)" }}>
            {balance.toLocaleString()} {currencyLbl}
          </span>
          <button
            onClick={() => setItems([])}
            aria-label="Close trade"
            className="rounded-sm p-1 transition-colors hover:bg-white/10"
            style={{ color: "var(--color-muted)" }}
          >
            <X className="size-3" />
          </button>
        </div>
      </div>

      {/* ── Two-column body ────────────────────────────────────────────────── */}
      <div className="flex min-h-0 flex-1">
        {/* LEFT — Merchant wares */}
        <div
          className="flex min-w-0 flex-1 flex-col overflow-y-auto px-2 py-2"
          style={{ borderRight: "1px solid var(--color-border)" }}
        >
          <p className="mb-1 text-[9px] font-bold uppercase tracking-widest" style={{ color: "var(--color-muted)" }}>
            Merchant Wares
          </p>
          {tradeItems.map((item) => {
            const cost      = item.value ?? 0;
            const canAfford = balance >= cost;
            return (
              <div
                key={item.id}
                className="mb-1 flex items-center gap-2 rounded-sm px-2 py-1.5"
                style={{
                  border:          `1px solid ${RARITY_COLORS[item.rarity] ?? "var(--color-border)"}`,
                  backgroundColor: "color-mix(in srgb, var(--color-primary) 4%, transparent)",
                }}
              >
                <div className="min-w-0 flex-1">
                  <p
                    className="truncate text-[11px] font-bold"
                    style={{ color: RARITY_COLORS[item.rarity] ?? "var(--color-text)" }}
                  >
                    {item.name}
                  </p>
                  <p className="truncate text-[9px] italic" style={{ color: "var(--color-muted)" }}>
                    {item.description}
                  </p>
                </div>
                <span className="shrink-0 font-mono text-[10px]" style={{ color: "var(--color-text)" }}>
                  {cost} {currencyLbl}
                </span>
                <button
                  disabled={!canAfford}
                  onClick={() => onBuy(item)}
                  className="shrink-0 rounded-sm px-2 py-1 text-[9px] font-bold uppercase tracking-wide transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
                  style={{
                    backgroundColor: canAfford ? "var(--color-accent)" : "var(--color-border)",
                    color: canAfford ? "#000" : "var(--color-muted)",
                  }}
                  title={canAfford ? `Buy for ${cost} ${currencyLbl}` : `Not enough ${currencyLbl}`}
                >
                  Buy
                </button>
              </div>
            );
          })}
        </div>

        {/* RIGHT — Player pack */}
        <div className="flex min-w-0 flex-1 flex-col overflow-y-auto px-2 py-2">
          <p className="mb-1 text-[9px] font-bold uppercase tracking-widest" style={{ color: "var(--color-muted)" }}>
            Your Pack (sells at 50%)
          </p>
          {sellableInv.length === 0 ? (
            <p className="text-center text-[10px] italic" style={{ color: "var(--color-muted)" }}>
              Nothing sellable in your pack.
            </p>
          ) : (
            sellableInv.map((item) => {
              const sellPrice = Math.max(1, Math.floor((item.value ?? 0) * 0.5));
              return (
                <div
                  key={item.id}
                  className="mb-1 flex items-center gap-2 rounded-sm px-2 py-1.5"
                  style={{
                    border:          `1px solid ${RARITY_COLORS[item.rarity] ?? "var(--color-border)"}`,
                    backgroundColor: "color-mix(in srgb, var(--color-accent) 4%, transparent)",
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <p
                      className="truncate text-[11px] font-bold"
                      style={{ color: RARITY_COLORS[item.rarity] ?? "var(--color-text)" }}
                    >
                      {item.name}
                      {item.stackable && item.quantity > 1 && (
                        <span style={{ color: "var(--color-muted)" }}> ×{item.quantity}</span>
                      )}
                    </p>
                  </div>
                  <span className="shrink-0 font-mono text-[10px]" style={{ color: "var(--color-text)" }}>
                    +{sellPrice} {currencyLbl}
                  </span>
                  <button
                    onClick={() => onSell(item)}
                    className="shrink-0 rounded-sm px-2 py-1 text-[9px] font-bold uppercase tracking-wide transition-opacity"
                    style={{
                      backgroundColor: "var(--color-primary)",
                      color: "#000",
                    }}
                    title={`Sell for ${sellPrice} ${currencyLbl}`}
                  >
                    Sell
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
