"use client";

import React, { useEffect, useRef, useState } from "react";
import { Send, X } from "lucide-react";
import { useGameStore } from "@/lib/stores/game-store";
import { getNpcDisposition } from "@/lib/game/state-utils";
import { AssetCategory, Genre } from "@/types/game";
import type { Attributes, DialogueOption } from "@/types/game";

/**
 * Dialogue Modal — inline panel that lives inside the story-feed scroll
 * container, NOT a fixed overlay. The panel sits at the bottom of the
 * feed, pushes earlier messages up when it opens, and never covers the
 * navigation bar below the feed.
 *
 * Minimize is a local UI state — collapsing rolls the panel up to its
 * 48px header row and clicking the header re-expands it. Closing fires
 * the global clearDialogueOptions() so the panel disappears entirely.
 */

interface DialogueModalProps {
  onSubmit:     (input: string, options?: { npcName?: string; tone?: DialogueOption["tone"] }) => void;
  onFocusInput: () => void;
  onOpenTrade:  (npcName: string) => void;
}

interface ToneBadge {
  stat:  "CHA" | "STR" | "PER";
  value: number;
  note?: string;
}

function getToneBadge(tone: DialogueOption["tone"], attributes: Attributes): ToneBadge | null {
  switch (tone) {
    case "curious":    return { stat: "PER", value: attributes.perception };
    case "deceptive":  return { stat: "CHA", value: attributes.charisma, note: "+2" };
    case "aggressive": return { stat: "STR", value: attributes.strength };
    case "friendly":
    default:           return null;
  }
}

const DISPOSITION_DOT: Record<string, string> = {
  hostile:    "#ef4444",
  suspicious: "#f97316",
  neutral:    "#facc15",
  friendly:   "#22c55e",
  allied:     "#a855f7",
};

function ensureResponsiveSvg(svg: string): string {
  let out = svg;
  if (!/width\s*=/.test(out))  out = out.replace(/<svg\b/i, '<svg width="100%"');
  if (!/height\s*=/.test(out)) out = out.replace(/<svg\b/i, '<svg height="100%"');
  return out;
}

function npcInitials(name: string | null | undefined): string {
  if (!name) return "??";
  const parts = name.trim().split(/\s+/);
  return parts.map((w) => w[0]?.toUpperCase() ?? "").join("").slice(0, 2) || "??";
}

export function DialogueModal({ onSubmit, onFocusInput, onOpenTrade }: DialogueModalProps) {
  const options       = useGameStore((s) => s.currentDialogueOptions);
  const npcName       = useGameStore((s) => s.currentDialogueNpc);
  const npcKey        = useGameStore((s) => s.currentDialogueNpcKey);
  const portrait      = useGameStore((s) => s.currentNpcPortrait);
  const clear         = useGameStore((s) => s.clearDialogueOptions);
  const tradeItems    = useGameStore((s) => s.currentTradeItems);
  const tradeOpen     = useGameStore((s) => s.tradeOpen);
  const locationAssets = useGameStore((s) => s.locationAssets);

  const playerStats = useGameStore((s) => s.masterState?.player_state.attributes);
  const genre  = useGameStore((s) => s.masterState?.metadata.genre) ?? Genre.FANTASY;
  void genre;

  // Local collapsed state — minimize is a UI affordance, not session state.
  const [collapsed, setCollapsed] = useState(false);
  // Inline-input state for the "type your own response" row.
  const [inlineInputOpen, setInlineInputOpen] = useState(false);
  const [inlineValue,     setInlineValue]     = useState("");
  const inlineInputRef = useRef<HTMLInputElement | null>(null);

  // Reset local UI state whenever the active NPC changes — fresh
  // conversation always opens expanded with no half-typed text.
  useEffect(() => {
    setCollapsed(false);
    setInlineInputOpen(false);
    setInlineValue("");
  }, [npcName]);

  useEffect(() => {
    if (inlineInputOpen) inlineInputRef.current?.focus();
  }, [inlineInputOpen]);

  const trustScore = useGameStore((s) => {
    if (!npcKey || !s.masterState) return null;
    return s.masterState.npc_registry[npcKey]?.trust_score ?? null;
  });

  if (options.length === 0) return null;

  const handleOption = (option: DialogueOption) => {
    clear();
    onSubmit(`"${option.text}"`, {
      ...(npcName ? { npcName } : {}),
      tone: option.tone,
    });
  };

  void onFocusInput;
  const handleTypeOwn      = () => setInlineInputOpen(true);
  const handleInlineSubmit = () => {
    const trimmed = inlineValue.trim();
    if (!trimmed) return;
    setInlineValue("");
    setInlineInputOpen(false);
    onSubmit(`"${trimmed}"`, npcName ? { npcName } : {});
  };
  const handleInlineKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleInlineSubmit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setInlineInputOpen(false);
      setInlineValue("");
    }
  };

  // Merchant detection — role-only so leftover items_for_sale can't keep
  // the trade button visible after the player switches NPCs.
  const npcAsset = npcName
    ? locationAssets.find(
        (a) => a.category === AssetCategory.CHARACTER &&
               a.name.toLowerCase() === npcName.toLowerCase()
      )
    : undefined;
  const npcRole = (npcAsset?.constitution.role ?? "").toLowerCase();
  const isCurrentNpcMerchant =
    npcRole.includes("merchant") ||
    npcRole.includes("trader") ||
    npcRole.includes("vendor") ||
    npcRole.includes("shopkeeper");

  const handleOpenTrade = () => {
    if (!npcName) return;
    setInlineInputOpen(false);
    onOpenTrade(npcName);
  };

  const effectiveTrust = trustScore ?? 50;
  const disposition    = getNpcDisposition(effectiveTrust);
  const dispDot        = DISPOSITION_DOT[disposition] ?? DISPOSITION_DOT.neutral;

  // ── Header row ─────────────────────────────────────────────────────────────
  // 48px tall, padding 0 16px. Click anywhere on the header re-expands a
  // collapsed panel; the right-side ─/× buttons stop event propagation
  // so they don't also re-expand on click.
  const header = (
    <div
      onClick={collapsed ? () => setCollapsed(false) : undefined}
      style={{
        height:       48,
        padding:      "0 16px",
        display:      "flex",
        alignItems:   "center",
        gap:          10,
        cursor:       collapsed ? "pointer" : "default",
        flexShrink:   0,
      }}
      role={collapsed ? "button" : undefined}
      aria-label={collapsed ? "Expand dialogue" : undefined}
    >
      {/* 32px initials / portrait chip */}
      <div
        style={{
          width:          32,
          height:         32,
          background:     "var(--bg-3)",
          border:         "1px solid var(--accent)",
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
          fontFamily:     "var(--mono)",
          fontSize:       11,
          color:          "var(--accent)",
          letterSpacing:  "0.08em",
          flexShrink:     0,
          overflow:       "hidden",
        }}
      >
        {portrait ? (
          <div
            className="h-full w-full"
            style={{ imageRendering: "pixelated" }}
            dangerouslySetInnerHTML={{ __html: ensureResponsiveSvg(portrait) }}
          />
        ) : (
          <span>{npcInitials(npcName)}</span>
        )}
      </div>

      {/* Name + role + trust */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          className="ew-serif"
          style={{
            fontSize:    14,
            color:       "var(--ink-1)",
            lineHeight:  1.2,
            display:     "flex",
            alignItems:  "center",
            gap:         7,
            flexWrap:    "wrap",
          }}
        >
          <span style={{ fontStyle: "italic" }}>{npcName ?? "Unknown"}</span>
          <span
            style={{
              width:        5,
              height:       5,
              background:   dispDot,
              borderRadius: 3,
              flexShrink:   0,
            }}
          />
        </div>
        {(npcRole || trustScore !== null) && (
          <div
            className="ew-mono"
            style={{
              fontSize:      8,
              letterSpacing: "0.18em",
              color:         "var(--ink-4)",
              marginTop:     2,
              display:       "flex",
              alignItems:    "center",
              gap:           8,
            }}
          >
            {npcRole && <span>{npcRole.toUpperCase()}</span>}
            {trustScore !== null && <span>TRUST {effectiveTrust}</span>}
          </div>
        )}
      </div>

      {/* Minimize ─ */}
      <button
        onClick={(e) => { e.stopPropagation(); setCollapsed((c) => !c); }}
        aria-label={collapsed ? "Expand dialogue" : "Minimize dialogue"}
        title={collapsed ? "Expand" : "Minimize"}
        style={{
          width:          24,
          height:         24,
          border:         "1px solid var(--line-2)",
          background:     "transparent",
          color:          "var(--ink-3)",
          cursor:         "pointer",
          display:        "inline-flex",
          alignItems:     "center",
          justifyContent: "center",
          fontFamily:     "var(--mono)",
          fontSize:       12,
          lineHeight:     1,
        }}
      >
        ─
      </button>

      {/* Close × */}
      <button
        onClick={(e) => { e.stopPropagation(); clear(); }}
        aria-label="Close dialogue"
        title="Walk away"
        style={{
          width:          24,
          height:         24,
          border:         "1px solid var(--line-2)",
          background:     "transparent",
          color:          "var(--ink-3)",
          cursor:         "pointer",
          display:        "inline-flex",
          alignItems:     "center",
          justifyContent: "center",
        }}
      >
        <X className="size-3" />
      </button>
    </div>
  );

  // ── Inline panel ──────────────────────────────────────────────────────────
  return (
    <div
      role="dialog"
      aria-label="Dialogue options"
      style={{
        width:        "100%",
        background:   "var(--bg-1)",
        borderTop:    "2px solid var(--accent)",
        borderRadius: "8px 8px 0 0",
        padding:      "0 0 16px 0",
        marginTop:    24,
        fontFamily:   "var(--sans)",
        color:        "var(--ink-2)",
      }}
    >
      {header}

      {!collapsed && (
        <>
          {/* Options list */}
          <div>
            {options.map((option) => {
              const badge   = playerStats ? getToneBadge(option.tone, playerStats) : null;
              return (
                <button
                  key={option.id}
                  onClick={() => handleOption(option)}
                  style={{
                    width:        "100%",
                    minHeight:    44,
                    padding:      "10px 16px",
                    display:      "flex",
                    alignItems:   "center",
                    gap:          12,
                    background:   "transparent",
                    border:       "none",
                    borderBottom: "1px solid var(--line)",
                    borderLeft:   "3px solid transparent",
                    color:        "var(--ink-1)",
                    fontFamily:   "var(--serif)",
                    fontSize:     14,
                    textAlign:    "left",
                    cursor:       "pointer",
                    transition:   "background 120ms, border-color 120ms",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background  = "var(--bg-2)";
                    e.currentTarget.style.borderLeft  = "3px solid var(--accent)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background  = "transparent";
                    e.currentTarget.style.borderLeft  = "3px solid transparent";
                  }}
                >
                  <span
                    style={{
                      color:         "var(--accent)",
                      fontFamily:    "var(--mono)",
                      fontSize:      11,
                      letterSpacing: "0.1em",
                    }}
                  >
                    ›
                  </span>
                  <span style={{ flex: 1, fontStyle: "italic", minWidth: 0 }}>
                    {option.text}
                  </span>
                  {badge && (
                    <span
                      className="ew-mono"
                      title={`Check fires on use. Your ${badge.stat}: ${badge.value}${badge.note ? ` (${badge.note})` : ""}`}
                      style={{
                        fontSize:      8,
                        letterSpacing: "0.2em",
                        color:         "var(--ink-3)",
                        background:    "var(--bg-3)",
                        padding:       "2px 6px",
                        borderRadius:  1,
                        flexShrink:    0,
                      }}
                    >
                      {badge.stat} {badge.value}{badge.note ? ` ${badge.note}` : ""}
                    </span>
                  )}
                </button>
              );
            })}

            {/* Trade button (merchant only) — sits in the options list */}
            {isCurrentNpcMerchant && (
              <button
                onClick={handleOpenTrade}
                disabled={tradeOpen && tradeItems.length > 0}
                style={{
                  width:         "100%",
                  minHeight:     44,
                  padding:       "10px 16px",
                  display:       "flex",
                  alignItems:    "center",
                  justifyContent:"center",
                  gap:           8,
                  background:    "transparent",
                  border:        "none",
                  borderBottom:  "1px solid var(--line)",
                  color:         "#fbbf24",
                  fontFamily:    "var(--mono)",
                  fontSize:      10,
                  letterSpacing: "0.32em",
                  fontWeight:    600,
                  cursor:        (tradeOpen && tradeItems.length > 0) ? "default" : "pointer",
                  opacity:       (tradeOpen && tradeItems.length > 0) ? 0.4 : 1,
                }}
                title={
                  tradeOpen && tradeItems.length > 0
                    ? "Trade panel is open"
                    : "Open trade panel"
                }
              >
                ◆ TRADE
              </button>
            )}
          </div>

          {/* Free-type input row */}
          <div style={{ padding: "8px 16px" }}>
            {inlineInputOpen ? (
              <div
                style={{
                  display:    "flex",
                  alignItems: "center",
                  background: "var(--bg-0)",
                  border:     "none",
                  padding:    "4px 4px 4px 10px",
                }}
              >
                <span
                  style={{
                    color:       "var(--accent)",
                    fontFamily:  "var(--mono)",
                    fontSize:    12,
                    marginRight: 8,
                  }}
                >
                  ✎
                </span>
                <input
                  ref={inlineInputRef}
                  type="text"
                  value={inlineValue}
                  onChange={(e) => setInlineValue(e.target.value)}
                  onKeyDown={handleInlineKeyDown}
                  onBlur={(e) => {
                    const next = e.relatedTarget as HTMLElement | null;
                    if (next?.dataset?.dialogueSend === "true") return;
                    if (!inlineValue.trim()) setInlineInputOpen(false);
                  }}
                  placeholder={
                    npcName ? `Say something to ${npcName}...` : "Say something..."
                  }
                  maxLength={300}
                  style={{
                    flex:       1,
                    background: "transparent",
                    border:     "none",
                    outline:    "none",
                    fontFamily: "var(--serif)",
                    fontStyle:  "italic",
                    fontSize:   13,
                    color:      "var(--ink-1)",
                    padding:    "6px 0",
                  }}
                />
                <button
                  onClick={handleInlineSubmit}
                  data-dialogue-send="true"
                  disabled={!inlineValue.trim()}
                  aria-label="Send"
                  style={{
                    border:        "none",
                    background:    "var(--accent-faint)",
                    color:         "var(--accent)",
                    fontFamily:    "var(--mono)",
                    fontSize:      10,
                    letterSpacing: "0.24em",
                    padding:       "6px 12px",
                    cursor:        inlineValue.trim() ? "pointer" : "not-allowed",
                    opacity:       inlineValue.trim() ? 1 : 0.4,
                  }}
                >
                  <Send className="size-3" />
                </button>
              </div>
            ) : (
              <button
                onClick={handleTypeOwn}
                style={{
                  width:      "100%",
                  display:    "flex",
                  alignItems: "center",
                  gap:        8,
                  padding:    "8px 10px",
                  background: "var(--bg-0)",
                  border:     "none",
                  fontFamily: "var(--serif)",
                  fontStyle:  "italic",
                  color:      "var(--ink-5)",
                  fontSize:   13,
                  cursor:     "pointer",
                  textAlign:  "left",
                }}
              >
                ✎  type your own response…
              </button>
            )}
          </div>

          {/* Walk away link — centered mono */}
          <div style={{ padding: "6px 0 0", textAlign: "center" }}>
            <button
              onClick={() => clear()}
              className="ew-mono"
              style={{
                fontSize:       9,
                letterSpacing:  "0.2em",
                color:          "var(--ink-4)",
                background:     "transparent",
                border:         "none",
                cursor:         "pointer",
                padding:        "6px 0",
              }}
            >
              walk away
            </button>
          </div>
        </>
      )}
    </div>
  );
}
