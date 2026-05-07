"use client";

import React, { useEffect, useRef, useState } from "react";
import { ChevronUp, ChevronDown, Send } from "lucide-react";
import { useGameStore } from "@/lib/stores/game-store";
import { getNpcDisposition } from "@/lib/game/state-utils";
import { AssetCategory, Genre } from "@/types/game";
import type { Attributes, DialogueOption } from "@/types/game";

/**
 * Dialogue Modal — redesigned per /design/extras.jsx.
 *
 * Sits inline between the StoryFeed and the InputBar. Compact 56px
 * collapsed bar; expands into a panel with:
 *   • 56px avatar (initials) + ◆ IN CONVERSATION header
 *   • Italic serif NPC name + mono mood / role / location chips
 *   • Italic serif speech anchored under the header
 *   • Response options as serif italic rows with optional stat badge
 *     and a tone-coloured 3px left border for stat-check options
 *   • Inline "type your own response" dashed-border input
 *   • "walk away" mono link
 *
 * All existing behaviour preserved: tone passthrough, npcName pinning,
 * merchant-only trade button, inline custom input.
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
  const collapsed     = useGameStore((s) => s.dialogueModalCollapsed);
  const setCollapsed  = useGameStore((s) => s.setDialogueModalCollapsed);
  const clear         = useGameStore((s) => s.clearDialogueOptions);
  const tradeItems    = useGameStore((s) => s.currentTradeItems);
  const tradeOpen     = useGameStore((s) => s.tradeOpen);
  const locationAssets = useGameStore((s) => s.locationAssets);

  const playerStats = useGameStore((s) => s.masterState?.player_state.attributes);
  const genre  = useGameStore((s) => s.masterState?.metadata.genre) ?? Genre.FANTASY;
  void genre;

  // Inline-input state for the design's "type your own response" row.
  const [inlineInputOpen, setInlineInputOpen] = useState(false);
  const [inlineValue,     setInlineValue]     = useState("");
  const inlineInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
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

  // Merchant detection — role-only so leftover items_for_sale can't
  // keep the trade button visible after the player switches NPCs.
  const npcAsset = npcName
    ? locationAssets.find(
        (a) => a.category === AssetCategory.CHARACTER &&
               a.name.toLowerCase() === npcName.toLowerCase()
      )
    : undefined;
  const npcRole = (npcAsset?.constitution.role ?? "").toLowerCase();
  const npcLocation = npcAsset?.first_seen_location ?? "";
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

  // ── Collapsed bar (fixed at viewport bottom) ─────────────────────────────
  if (collapsed) {
    return (
      // Centering wrapper so on desktop the bar stays ≤640px wide and centred.
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 200, display: "flex", justifyContent: "center" }}>
        <button
          onClick={() => setCollapsed(false)}
          aria-label="Expand dialogue"
          className="ew-mono"
          style={{
            width:         "100%",
            maxWidth:      640,
            height:        40,
            display:       "flex",
            alignItems:    "center",
            justifyContent: "center",
            gap:           8,
            borderTop:     "2px solid var(--accent)",
            background:    "var(--accent-faint)",
            color:         "var(--accent)",
            fontSize:      10,
            letterSpacing: "0.28em",
            cursor:        "pointer",
          }}
        >
          <ChevronUp className="size-3.5" />
          <span style={{ fontWeight: 600 }}>{(npcName ?? "DIALOGUE").toUpperCase()}</span>
          <span style={{ color: "var(--ink-4)", fontStyle: "italic", fontSize: 9 }}>
            ({options.length} options)
          </span>
        </button>
      </div>
    );
  }

  // ── Expanded panel (fixed at viewport bottom, centred on desktop) ─────────
  return (
    // Outer wrapper spans the full viewport width and centres the inner panel.
    <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 200, display: "flex", justifyContent: "center" }}>
      <div
        role="dialog"
        aria-label="Dialogue options"
        style={{
          width:         "100%",
          maxWidth:      640,
          maxHeight:     "48vh",
          borderRadius:  "12px 12px 0 0",
          borderTop:     "1px solid var(--line)",
          background:    "var(--bg-1)",
          display:       "flex",
          flexDirection: "column",
          overflow:      "hidden",
          fontFamily:    "var(--sans)",
          color:         "var(--ink-2)",
        }}
      >
        {/* Compact header row — ~52px tall */}
        <div
          style={{
            display:      "flex",
            alignItems:   "center",
            padding:      "10px 14px",
            gap:          10,
            borderBottom: "1px solid var(--line)",
            flexShrink:   0,
          }}
        >
          {/* 32px initials / portrait chip */}
          <div
            style={{
              width:          32,
              height:         32,
              background:     "var(--bg-2)",
              border:         "1px solid var(--accent-soft)",
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

          {/* Name + disposition + role + trust */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
              <span
                className="ew-serif"
                style={{ fontStyle: "italic", fontSize: 15, color: "var(--ink-1)", lineHeight: 1.2 }}
              >
                {npcName ?? "Unknown"}
              </span>
              <span
                style={{
                  width:        5,
                  height:       5,
                  background:   dispDot,
                  borderRadius: 3,
                  flexShrink:   0,
                }}
              />
              {npcRole && (
                <span
                  className="ew-mono"
                  style={{ fontSize: 8, letterSpacing: "0.2em", color: "var(--ink-4)" }}
                >
                  {npcRole.toUpperCase()}
                </span>
              )}
              {trustScore !== null && (
                <span
                  className="ew-mono"
                  style={{
                    fontSize:      8,
                    letterSpacing: "0.16em",
                    color:         "var(--ink-5)",
                    padding:       "1px 5px",
                    border:        "1px solid var(--line-2)",
                  }}
                >
                  {effectiveTrust}
                </span>
              )}
            </div>
          </div>

          {/* Minimize */}
          <button
            onClick={() => setCollapsed(true)}
            aria-label="Minimize dialogue"
            title="Minimize"
            style={{
              width:          28,
              height:         28,
              border:         "1px solid var(--line-2)",
              background:     "transparent",
              color:          "var(--ink-3)",
              cursor:         "pointer",
              display:        "inline-flex",
              alignItems:     "center",
              justifyContent: "center",
            }}
          >
            <ChevronDown className="size-3" />
          </button>
        </div>

        {/* Options list — scrollable */}
        <div
          className="ew-scroll"
          style={{
            flex:          1,
            overflowY:     "auto",
            minHeight:     0,
            padding:       "10px 14px",
            display:       "flex",
            flexDirection: "column",
            gap:           5,
          }}
        >
          {options.map((option) => {
            const badge   = playerStats ? getToneBadge(option.tone, playerStats) : null;
            const isCheck = !!badge;
            return (
              <button
                key={option.id}
                onClick={() => handleOption(option)}
                style={{
                  display:    "flex",
                  alignItems: "center",
                  gap:        12,
                  minHeight:  44,
                  padding:    "8px 12px",
                  background: "var(--bg-2)",
                  border:     "1px solid var(--line)",
                  borderLeft: isCheck
                    ? "3px solid var(--accent)"
                    : "3px solid var(--line-2)",
                  color:      "var(--ink-2)",
                  fontFamily: "var(--serif)",
                  fontSize:   14,
                  textAlign:  "left",
                  cursor:     "pointer",
                  transition: "background 120ms",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "color-mix(in srgb, var(--accent) 5%, var(--bg-2))";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "var(--bg-2)";
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
                      fontSize:      9,
                      letterSpacing: "0.2em",
                      color:         "var(--ink-4)",
                      padding:       "2px 6px",
                      border:        "1px solid var(--line-2)",
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

          {/* Trade button (merchant only) — stays in the scrollable area */}
          {isCurrentNpcMerchant && (
            <button
              onClick={handleOpenTrade}
              disabled={tradeOpen && tradeItems.length > 0}
              style={{
                marginTop:     4,
                padding:       "8px 12px",
                border:        "1px solid #fbbf24",
                background:    "color-mix(in srgb, #fbbf24 18%, transparent)",
                color:         "#fbbf24",
                fontFamily:    "var(--mono)",
                fontSize:      10,
                letterSpacing: "0.32em",
                fontWeight:    600,
                cursor:        (tradeOpen && tradeItems.length > 0) ? "default" : "pointer",
                opacity:       (tradeOpen && tradeItems.length > 0) ? 0.4 : 1,
                textAlign:     "center",
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

        {/* Footer — free-type input + walk away; always visible (flex-shrink: 0) */}
        <div
          style={{
            flexShrink:  0,
            borderTop:   "1px solid var(--line)",
            padding:     "8px 14px",
            background:  "var(--bg-1)",
          }}
        >
          {inlineInputOpen ? (
            <div
              style={{
                display:    "flex",
                alignItems: "center",
                border:     "1px dashed var(--accent-soft)",
                background: "var(--bg-0)",
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
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button
                onClick={handleTypeOwn}
                style={{
                  flex:       1,
                  display:    "flex",
                  alignItems: "center",
                  gap:        8,
                  padding:    "6px 10px",
                  border:     "1px dashed var(--line-2)",
                  background: "transparent",
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
              <button
                onClick={() => clear()}
                className="ew-mono"
                style={{
                  flexShrink:     0,
                  fontSize:       9,
                  letterSpacing:  "0.2em",
                  color:          "var(--ink-5)",
                  textDecoration: "underline",
                  background:     "transparent",
                  border:         "none",
                  cursor:         "pointer",
                  padding:        "6px 0",
                  whiteSpace:     "nowrap",
                }}
              >
                walk away
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
