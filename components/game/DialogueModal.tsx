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

  // ── Collapsed bar ────────────────────────────────────────────────────────
  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        aria-label="Expand dialogue"
        className="ew-mono flex h-10 w-full shrink-0 items-center justify-center gap-2 transition-opacity hover:opacity-90"
        style={{
          borderTop:    "2px solid var(--accent)",
          borderBottom: "1px solid var(--line)",
          background:   "var(--accent-faint)",
          color:        "var(--accent)",
          fontSize:     10,
          letterSpacing:"0.28em",
        }}
      >
        <ChevronUp className="size-3.5" />
        <span style={{ fontWeight: 600 }}>{(npcName ?? "DIALOGUE").toUpperCase()}</span>
        <span style={{ color: "var(--ink-4)", fontStyle: "italic", fontSize: 9 }}>
          ({options.length} options)
        </span>
      </button>
    );
  }

  const effectiveTrust = trustScore ?? 50;
  const disposition    = getNpcDisposition(effectiveTrust);
  const dispDot        = DISPOSITION_DOT[disposition] ?? DISPOSITION_DOT.neutral;

  // ── Expanded panel ───────────────────────────────────────────────────────
  return (
    <div
      role="dialog"
      aria-label="Dialogue options"
      className="shrink-0"
      style={{
        position:   "relative",
        background: "var(--bg-0)",
        color:      "var(--ink-2)",
        fontFamily: "var(--sans)",
        borderTop:  "1px solid var(--line)",
        padding:    16,
      }}
    >
      <div
        style={{
          margin:        "0 auto",
          maxWidth:      720,
          background:    "var(--bg-1)",
          border:        "1px solid var(--accent-soft)",
          position:      "relative",
          display:       "flex",
          flexDirection: "column",
        }}
      >
        {/* Inset border — the design's classic frame-within-a-frame */}
        <div
          aria-hidden
          style={{
            position:      "absolute",
            inset:         4,
            border:        "1px solid var(--accent-soft)",
            pointerEvents: "none",
          }}
        />

        {/* Header — avatar, ◆ IN CONVERSATION, name, chips, minimize, close */}
        <div
          style={{
            display:      "flex",
            alignItems:   "center",
            padding:      "16px 20px",
            gap:          14,
            borderBottom: "1px solid var(--line)",
            position:     "relative",
            zIndex:       1,
          }}
        >
          {/* Portrait / initials avatar (56×56) */}
          <div
            style={{
              width:           56,
              height:          56,
              background:      "var(--bg-2)",
              border:          "1px solid var(--accent-soft)",
              display:         "flex",
              alignItems:      "center",
              justifyContent:  "center",
              fontFamily:      "var(--mono)",
              fontSize:        18,
              color:           "var(--accent)",
              letterSpacing:   "0.1em",
              flexShrink:      0,
              overflow:        "hidden",
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

          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              className="ew-mono"
              style={{
                fontSize:      9,
                letterSpacing: "0.32em",
                color:         "var(--accent)",
                marginBottom:  2,
              }}
            >
              ◆ IN CONVERSATION
            </div>
            <div
              className="ew-serif"
              style={{
                fontStyle: "italic",
                fontSize:  20,
                color:     "var(--ink-1)",
                lineHeight: 1.2,
              }}
            >
              {npcName ?? "Unknown"}
            </div>
            <div
              style={{
                display:       "flex",
                gap:           10,
                marginTop:     4,
                fontFamily:    "var(--mono)",
                fontSize:      9,
                letterSpacing: "0.2em",
                color:         "var(--ink-4)",
                flexWrap:      "wrap",
              }}
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                <span
                  style={{
                    width:        5,
                    height:       5,
                    background:   dispDot,
                    borderRadius: 3,
                  }}
                />
                {disposition.toUpperCase()}
              </span>
              {npcRole && <span>· {npcRole.toUpperCase()}</span>}
              {npcLocation && (
                <span>· {npcLocation.replace(/_/g, " ").toUpperCase()}</span>
              )}
            </div>
          </div>

          <button
            onClick={() => setCollapsed(true)}
            aria-label="Minimize dialogue"
            title="Minimize"
            style={{
              width:       28,
              height:      28,
              border:      "1px solid var(--line-2)",
              background:  "transparent",
              color:       "var(--ink-3)",
              fontFamily:  "var(--mono)",
              fontSize:    14,
              cursor:      "pointer",
              display:     "inline-flex",
              alignItems:  "center",
              justifyContent: "center",
            }}
          >
            <ChevronDown className="size-3" />
          </button>
          <button
            onClick={() => clear()}
            aria-label="Close dialogue"
            title="Walk away"
            style={{
              width:       28,
              height:      28,
              border:      "1px solid var(--line-2)",
              background:  "transparent",
              color:       "var(--ink-3)",
              fontFamily:  "var(--mono)",
              fontSize:    14,
              cursor:      "pointer",
            }}
          >
            x
          </button>
        </div>

        {/* Options list */}
        <div
          className="ew-scroll"
          style={{
            position:      "relative",
            zIndex:        1,
            padding:       "12px 18px 14px",
            display:       "flex",
            flexDirection: "column",
            gap:           6,
            maxHeight:     "calc(100vh - 320px)",
            overflowY:     "auto",
          }}
        >
          {options.map((option) => {
            const badge = playerStats ? getToneBadge(option.tone, playerStats) : null;
            const isCheck = !!badge;
            return (
              <button
                key={option.id}
                onClick={() => handleOption(option)}
                style={{
                  display:        "flex",
                  alignItems:     "center",
                  gap:            12,
                  padding:        "10px 14px",
                  background:     "var(--bg-2)",
                  border:         "1px solid var(--line)",
                  borderLeft:     isCheck
                    ? "3px solid var(--accent)"
                    : "3px solid var(--line-2)",
                  color:          "var(--ink-2)",
                  fontFamily:     "var(--serif)",
                  fontSize:       14,
                  textAlign:      "left",
                  cursor:         "pointer",
                  transition:     "background 120ms",
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

          {/* Type your own — dashed-border input */}
          {inlineInputOpen ? (
            <div
              style={{
                display:       "flex",
                alignItems:    "center",
                marginTop:     4,
                border:        "1px dashed var(--accent-soft)",
                background:    "var(--bg-0)",
                padding:       "4px 4px 4px 12px",
              }}
            >
              <span
                style={{
                  color:      "var(--accent)",
                  fontFamily: "var(--mono)",
                  fontSize:   12,
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
                  flex:        1,
                  background:  "transparent",
                  border:      "none",
                  outline:     "none",
                  fontFamily:  "var(--serif)",
                  fontStyle:   "italic",
                  fontSize:    13,
                  color:       "var(--ink-1)",
                  padding:     "6px 0",
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
                marginTop:    4,
                display:      "flex",
                alignItems:   "center",
                gap:          8,
                padding:      "8px 12px",
                border:       "1px dashed var(--line-2)",
                background:   "transparent",
                fontFamily:   "var(--serif)",
                fontStyle:    "italic",
                color:        "var(--ink-5)",
                fontSize:     13,
                cursor:       "pointer",
                textAlign:    "left",
              }}
            >
              ✎  type your own response…
            </button>
          )}

          {/* Trade button (merchant only) */}
          {isCurrentNpcMerchant && (
            <button
              onClick={handleOpenTrade}
              disabled={tradeOpen && tradeItems.length > 0}
              style={{
                marginTop:     6,
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

          {/* Walk away link */}
          <button
            onClick={() => clear()}
            className="ew-mono"
            style={{
              marginTop:      4,
              alignSelf:      "flex-start",
              fontSize:       9,
              letterSpacing:  "0.2em",
              color:          "var(--ink-5)",
              textDecoration: "underline",
              background:     "transparent",
              border:         "none",
              cursor:         "pointer",
              padding:        0,
            }}
          >
            walk away
          </button>
        </div>
      </div>
    </div>
  );
}
