"use client";

import { useState } from "react";
import { X } from "lucide-react";
import type { Item } from "@/types/game";
import { ItemType } from "@/types/game";
import { useGameStore } from "@/lib/stores/game-store";
import { getGenreColors } from "./genre-ui";
import {
  findMerchantNpc,
  getMerchantTrust,
  trustAdjustedPrice,
  sellPriceFor,
  merchantAcceptsItem,
} from "@/lib/game/trade-resolver";

interface TradeModalProps {
  onBuy:  (item: Item) => void;
  onSell: (item: Item) => void;
}

const RARITY_COLORS: Record<string, string> = {
  COMMON:    "var(--color-muted)",
  UNCOMMON:  "#22c55e",
  RARE:      "#3b82f6",
  LEGENDARY: "#f59e0b",
};

type Tab = "buy" | "sell";

/**
 * P3 — Merchant Trade Modal.
 *
 * Renders inline between StoryFeed and InputBar while `tradeOpen` is set.
 * Two tabs:
 *   • Buy  — the merchant's world-asset-backed inventory
 *            (NPCDefinition.merchant_inventory) with trust-adjusted
 *            prices. Depleted stacks show "Sold Out".
 *   • Sell — the player's pack at 50% of value, speciality-filtered:
 *            items the merchant won't take are grayed "Not interested".
 *
 * All pricing / acceptance logic lives in lib/game/trade-resolver.ts;
 * this component is display-only. Buy/sell dispatch through the
 * useGameLoop callbacks, which mutate the store — the modal re-renders
 * reactively (optimistic update for free).
 */
export function TradeModal({ onBuy, onSell }: TradeModalProps) {
  const tradeOpen   = useGameStore((s) => s.tradeOpen);
  const wares       = useGameStore((s) => s.currentTradeItems);
  const tradeNpc    = useGameStore((s) => s.tradeNpcName);
  const masterState = useGameStore((s) => s.masterState);
  const setItems    = useGameStore((s) => s.setTradeItems);

  const [tab, setTab] = useState<Tab>("buy");

  // Visibility is driven by `tradeOpen`, NOT the inventory length — a
  // merchant with nothing to sell still opens the panel.
  if (!tradeOpen || !masterState) return null;

  const genre       = masterState.metadata.genre;
  const colors      = getGenreColors(genre);
  const currencyKey = colors.currencyKey;
  const currencyLbl = colors.currency;
  // Horror has no currency — fail closed if the panel somehow opens.
  if (!currencyKey || !currencyLbl) return null;

  const balance = masterState.player_state.resources[currencyKey] ?? 0;

  // Resolve the merchant NPC for trust + speciality. Null is tolerated
  // (defensive): trust falls back to neutral, speciality to empty.
  const lookup       = findMerchantNpc(masterState, tradeNpc);
  const npc          = lookup?.npc ?? null;
  const trust        = npc ? getMerchantTrust(masterState, npc) : 50;
  const npcRole      = npc?.role ?? "merchant";

  const sellableInv = masterState.player_state.inventory.filter((i) => !i.equipped);

  const accepts = (item: Item): boolean =>
    npc ? merchantAcceptsItem(npc, item) : item.type === ItemType.VALUABLE;

  return (
    <div
      role="dialog"
      aria-label="Merchant trade"
      className="flex shrink-0 flex-col overflow-hidden"
      style={{
        height:          "280px",
        maxHeight:       "280px",
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
        <div className="flex items-baseline gap-2">
          <span
            className="text-[11px] font-bold uppercase tracking-widest"
            style={{ color: "var(--color-primary)" }}
          >
            {tradeNpc ?? "Merchant"}
          </span>
          <span className="text-[9px] uppercase tracking-wide" style={{ color: "var(--color-muted)" }}>
            {npcRole}
          </span>
        </div>
        <button
          onClick={() => setItems([])}
          aria-label="Close trade"
          className="rounded-sm p-1 transition-colors hover:bg-white/10"
          style={{ color: "var(--color-muted)" }}
        >
          <X className="size-3" />
        </button>
      </div>

      {/* ── Tab bar ────────────────────────────────────────────────────────── */}
      <div
        className="flex shrink-0"
        style={{ borderBottom: "1px solid var(--color-border)" }}
      >
        {(["buy", "sell"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="flex-1 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-colors"
            style={{
              color: tab === t ? "var(--color-primary)" : "var(--color-muted)",
              backgroundColor:
                tab === t
                  ? "color-mix(in srgb, var(--color-primary) 10%, transparent)"
                  : "transparent",
              borderBottom:
                tab === t ? "2px solid var(--color-primary)" : "2px solid transparent",
            }}
          >
            {t === "buy" ? "Buy" : "Sell"}
          </button>
        ))}
      </div>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-2 py-2">
        {tab === "buy" ? (
          wares.length === 0 ? (
            <p
              className="mt-6 text-center text-[10px] italic"
              style={{ color: "var(--color-muted)" }}
            >
              The merchant has nothing to sell right now.
            </p>
          ) : (
            wares.map((item) => {
              const soldOut   = (item.quantity ?? 0) <= 0;
              const price     = trustAdjustedPrice(item.value ?? 0, trust);
              const canAfford = balance >= price;
              const buyable   = !soldOut && canAfford;
              return (
                <div
                  key={item.id}
                  className="mb-1 flex items-center gap-2 rounded-sm px-2 py-1.5"
                  style={{
                    border:          `1px solid ${RARITY_COLORS[item.rarity] ?? "var(--color-border)"}`,
                    backgroundColor: "color-mix(in srgb, var(--color-primary) 4%, transparent)",
                    opacity:         soldOut ? 0.45 : 1,
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
                  <TypePill type={item.type} />
                  <span className="shrink-0 font-mono text-[10px]" style={{ color: "var(--color-text)" }}>
                    {price} {currencyLbl}
                  </span>
                  <button
                    disabled={!buyable}
                    onClick={() => onBuy(item)}
                    className="shrink-0 rounded-sm px-2 py-1 text-[9px] font-bold uppercase tracking-wide transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
                    style={{
                      backgroundColor: buyable ? "var(--color-accent)" : "var(--color-border)",
                      color:           buyable ? "#000" : "var(--color-muted)",
                    }}
                    title={
                      soldOut
                        ? "Sold out"
                        : canAfford
                          ? `Buy for ${price} ${currencyLbl}`
                          : `Not enough ${currencyLbl}`
                    }
                  >
                    {soldOut ? "Sold Out" : "Buy"}
                  </button>
                </div>
              );
            })
          )
        ) : sellableInv.length === 0 ? (
          <p
            className="mt-6 text-center text-[10px] italic"
            style={{ color: "var(--color-muted)" }}
          >
            Nothing in your pack to sell.
          </p>
        ) : (
          sellableInv.map((item) => {
            const accepted  = accepts(item);
            const sellPrice = sellPriceFor(item);
            const worthless = item.starting_item === true || sellPrice <= 0;
            const sellable  = accepted && !worthless;
            return (
              <div
                key={item.id}
                className="mb-1 flex items-center gap-2 rounded-sm px-2 py-1.5"
                style={{
                  border:          `1px solid ${RARITY_COLORS[item.rarity] ?? "var(--color-border)"}`,
                  backgroundColor: "color-mix(in srgb, var(--color-accent) 4%, transparent)",
                  opacity:         sellable ? 1 : 0.45,
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
                <TypePill type={item.type} />
                {sellable ? (
                  <>
                    <span className="shrink-0 font-mono text-[10px]" style={{ color: "var(--color-text)" }}>
                      +{sellPrice} {currencyLbl}
                    </span>
                    <button
                      onClick={() => onSell(item)}
                      className="shrink-0 rounded-sm px-2 py-1 text-[9px] font-bold uppercase tracking-wide transition-opacity"
                      style={{ backgroundColor: "var(--color-primary)", color: "#000" }}
                      title={`Sell for ${sellPrice} ${currencyLbl}`}
                    >
                      Sell
                    </button>
                  </>
                ) : (
                  <span
                    className="shrink-0 text-[9px] italic"
                    style={{ color: "var(--color-muted)" }}
                  >
                    {worthless ? "No value" : "Not interested"}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* ── Footer — player balance ────────────────────────────────────────── */}
      <div
        className="flex shrink-0 items-center justify-end px-3 py-1.5"
        style={{
          borderTop:       "1px solid var(--color-border)",
          backgroundColor: "color-mix(in srgb, var(--color-primary) 6%, transparent)",
        }}
      >
        <span className="font-mono text-[11px]" style={{ color: "var(--color-text)" }}>
          {balance.toLocaleString()} {currencyLbl}
        </span>
      </div>
    </div>
  );
}

/** Small uppercase pill showing the item's ItemType. */
function TypePill({ type }: { type: ItemType }) {
  return (
    <span
      className="shrink-0 rounded-sm px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider"
      style={{
        backgroundColor: "color-mix(in srgb, var(--color-muted) 18%, transparent)",
        color:           "var(--color-muted)",
      }}
    >
      {type}
    </span>
  );
}
