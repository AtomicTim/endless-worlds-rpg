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
  onSubmit:     (
    input: string,
    options?: {
      npcName?:           string;
      tone?:              DialogueOption["tone"];
      /** Architecture C — closed-context fact piped to the narrator
       *  when the player clicks a code-built knowledge option. The AI
       *  sees only this one {topic, content}, not the full NPC bank. */
      selectedKnowledge?: { topic: string; content: string };
    }
  ) => void;
  onFocusInput: () => void;
  onOpenTrade:  (npcName: string) => void;
  /** P3 — innkeeper "rest" dialogue action: 10 gold → HP fully restored. */
  onRest:       () => void;
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

// UI-6 — disposition palette (design ref §10). Bands map a 0-100
// trust score to one of five colour bands. Replaces the prior
// light-tone dots with more saturated / desaturated tones that read
// against the genre dark surfaces.
const DISPOSITION_COLOR: Record<string, string> = {
  hostile:    "#c44040",
  suspicious: "#b06030",
  neutral:    "#8a6a3a",
  friendly:   "#5a9a5a",
  allied:     "#4a8a4a",
};
/** UI-6 — odds label for stat-gated options. Mod uses rule 92's
 *  floor((score-2)/2). Pure helper, no side effects. */
function oddsLabel(rawStat: number): "Good odds" | "Risky" | "Long shot" {
  const mod = Math.floor((rawStat - 2) / 2);
  if (mod >= 3) return "Good odds";
  if (mod >= 0) return "Risky";
  return "Long shot";
}

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

export function DialogueModal({ onSubmit, onFocusInput, onOpenTrade, onRest }: DialogueModalProps) {
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
    // Architecture C — dispatch by option.type when present. Legacy
    // narrator-emitted options (no type) fall through to the original
    // "submit option.text as quoted speech" path.
    switch (option.type) {
      case "trade": {
        if (!npcName) return;
        clear();
        setInlineInputOpen(false);
        onOpenTrade(npcName);
        return;
      }
      case "rest": {
        // P3 — innkeeper Inn Rest. clear() closes the dialogue panel;
        // restAtInn handles the gold check, HP restore, and feed beat.
        clear();
        setInlineInputOpen(false);
        onRest();
        return;
      }
      case "free": {
        // Don't clear() — the dialogue panel must stay open while the
        // player types their own line into the inline input row.
        setInlineInputOpen(true);
        return;
      }
      case "farewell": {
        clear();
        return;
      }
      case "knowledge": {
        clear();
        onSubmit(`"${option.text}"`, {
          ...(npcName ? { npcName } : {}),
          tone: option.tone,
          ...(option.content
            ? {
                selectedKnowledge: {
                  topic:   option.text,
                  content: option.content,
                },
              }
            : {}),
        });
        return;
      }
      default: {
        // Legacy AI-generated option — submit the text as quoted speech
        // and let resolveDialogue route the tone-derived stat check.
        clear();
        onSubmit(`"${option.text}"`, {
          ...(npcName ? { npcName } : {}),
          tone: option.tone,
        });
        return;
      }
    }
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
  const dispColor      = DISPOSITION_COLOR[disposition] ?? DISPOSITION_COLOR.neutral;

  // ── UI-6 NPC header card (CHANGE 2) ───────────────────────────────────────
  // Fixed (non-scrolling) header — name (serif italic 15px #e2cda0),
  // role (Inter Tight 8px uppercase #6a5530), and a 6px disposition
  // pill whose filled segment width tracks the trust score 0-100.
  // Click on the header re-expands a collapsed panel; the ─ / ×
  // buttons stop propagation so they don't toggle expand on click.
  const header = (
    <div
      onClick={collapsed ? () => setCollapsed(false) : undefined}
      style={{
        padding:      "10px 14px",
        display:      "flex",
        alignItems:   "center",
        gap:          10,
        cursor:       collapsed ? "pointer" : "default",
        flexShrink:   0,
        borderBottom: "1px solid var(--card-border)",
      }}
      role={collapsed ? "button" : undefined}
      aria-label={collapsed ? "Expand dialogue" : undefined}
    >
      {/* 32px initials / portrait chip.
          UI-fix-G 4a — borderRadius: 50% gives the "avatar circle"
          called for in design-reference §10. overflow:hidden already
          clips the portrait SVG (h-full w-full) to whatever shape the
          parent enforces, so the same clip handles both portrait and
          initials fallback paths.
          UI-fix-G 4b — initials are a 2-char label, not numerics, so
          fontFamily moves from var(--mono) to var(--sans). Size,
          colour, and letter-spacing stay per spec. */}
      <div
        style={{
          width:          32,
          height:         32,
          background:     "var(--bg-3)",
          border:         "1px solid var(--genre-accent)",
          borderRadius:   "50%",
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
          fontFamily:     "var(--sans)",
          fontSize:       11,
          color:          "var(--genre-accent)",
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

      {/* Name + role + disposition bar */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          className="ew-serif italic"
          style={{
            fontSize:    15,
            color:       "#e2cda0",
            lineHeight:  1.2,
            overflow:    "hidden",
            textOverflow:"ellipsis",
            whiteSpace:  "nowrap",
          }}
        >
          {npcName ?? "Unknown"}
        </div>
        {npcRole && (
          <div
            className="ew-sans uppercase"
            style={{
              fontSize:      8,
              letterSpacing: "0.16em",
              color:         "#6a5530",
              marginTop:     2,
            }}
          >
            {npcRole}
          </div>
        )}
        {trustScore !== null && (
          <div
            style={{
              marginTop:  6,
              display:    "flex",
              alignItems: "center",
              gap:        8,
            }}
            aria-label={`Disposition ${disposition}, trust ${effectiveTrust} of 100`}
          >
            <div
              style={{
                position:     "relative",
                flex:         1,
                height:       6,
                borderRadius: 6,
                background:   "color-mix(in srgb, #2d2618 70%, transparent)",
                overflow:     "hidden",
              }}
            >
              <div
                style={{
                  position:     "absolute",
                  top:          0,
                  left:         0,
                  height:       "100%",
                  width:        `${Math.max(0, Math.min(100, effectiveTrust))}%`,
                  background:   dispColor,
                  transition:   "width 200ms ease",
                }}
              />
            </div>
            <span
              className="ew-sans uppercase"
              style={{
                fontSize:      7,
                letterSpacing: "0.14em",
                color:         dispColor,
                flexShrink:    0,
              }}
            >
              {disposition}
            </span>
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
          border:         "1px solid #2d2618",
          background:     "transparent",
          color:          "#6a5530",
          cursor:         "pointer",
          display:        "inline-flex",
          alignItems:     "center",
          justifyContent: "center",
          fontFamily:     "var(--mono)",
          fontSize:       12,
          lineHeight:     1,
          alignSelf:      "flex-start",
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
          border:         "1px solid #2d2618",
          background:     "transparent",
          color:          "#6a5530",
          cursor:         "pointer",
          display:        "inline-flex",
          alignItems:     "center",
          justifyContent: "center",
          alignSelf:      "flex-start",
        }}
      >
        <X className="size-3" />
      </button>
    </div>
  );

  // ── UI-6 — slot population (CHANGE 4) ─────────────────────────────────────
  // Primary options fill exactly 4 slots: knowledge / AI-emitted tone-only
  // options. Pad with placeholders below 4; clip to 4 above. Trade / rest /
  // free / farewell move OUT of the slot grid:
  //   - free      → free-type input row (existing affordance, restyled).
  //   - trade     → secondary action row below slots (merchant only).
  //   - rest      → secondary action row below slots (innkeeper only).
  //   - farewell  → covered by the End Conversation button, suppressed.
  const SECONDARY_TYPES = new Set(["trade", "rest", "free", "farewell"]);
  const primaryOptions = options
    .filter((o) => !o.type || !SECONDARY_TYPES.has(o.type))
    .slice(0, 4);
  const slotCount       = 4;
  const restOption      = options.find((o) => o.type === "rest");
  const freeOption      = options.find((o) => o.type === "free");

  // ── Inline panel ──────────────────────────────────────────────────────────
  return (
    <div
      role="dialog"
      aria-label="Dialogue options"
      style={{
        // UI-6 (CHANGE 1) — genre card shell: var(--content-bg) +
        // var(--card-border) + var(--card-radius). Width constrained
        // to 520px / 94vw so the inline panel doesn't span the full
        // feed at desktop widths. Position stays inline (bottomSlot
        // of GameLayout / StoryFeed) so the conversation feed above
        // and the option panel below read as one continuous scroll.
        position:     "relative",
        width:        "min(520px, 94vw)",
        maxHeight:    "85vh",
        margin:       "24px auto 0",
        background:   "var(--content-bg)",
        border:       "1px solid var(--card-border)",
        borderRadius: "var(--card-radius)",
        boxShadow:    "var(--card-shadow)",
        overflow:     "hidden",
        fontFamily:   "var(--sans)",
        color:        "var(--ink-2)",
      }}
    >
      {/* UI-1 overlay trio — inert on genres that don't opt in;
          pointer-events:none so they never block clicks. */}
      <div
        className="ol-tex"
        aria-hidden
        style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 2 }}
      />
      <div
        className="ol-scan"
        aria-hidden
        style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 2 }}
      />
      <div
        className="ol-grid"
        aria-hidden
        style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 2 }}
      />

      {/* Content sits above the overlay layer. */}
      <div style={{ position: "relative", zIndex: 10 }}>
        {header}

        {!collapsed && (
          <>
            {/* UI-6 (CHANGE 4) — exactly 4 fixed slots. */}
            <div
              style={{
                display:        "flex",
                flexDirection:  "column",
                gap:            6,
                padding:        "10px 14px 6px",
              }}
            >
              {Array.from({ length: slotCount }).map((_, i) => {
                const option = primaryOptions[i];
                if (!option) {
                  // Empty slot — dim dashed placeholder.
                  return (
                    <div
                      key={`slot-${i}-empty`}
                      aria-hidden
                      style={{
                        height:       28,
                        border:       "1px dashed #2d2618",
                        borderRadius: 4,
                        opacity:      0.6,
                      }}
                    />
                  );
                }
                const badge = playerStats ? getToneBadge(option.tone, playerStats) : null;
                // Slot kind: PER badge → OBSERVATION, STR/CHA → STAT_GATED,
                // null → STANDARD.
                const kind: "STANDARD" | "STAT_GATED" | "OBSERVATION" =
                  !badge ? "STANDARD"
                  : badge.stat === "PER" ? "OBSERVATION"
                  : "STAT_GATED";
                return (
                  <button
                    key={option.id}
                    onClick={() => handleOption(option)}
                    style={{
                      width:        "100%",
                      minHeight:    44,
                      padding:      "8px 12px",
                      display:      "flex",
                      alignItems:   "center",
                      gap:          10,
                      background:   "transparent",
                      border:       "1px solid #2d2618",
                      borderRadius: 4,
                      color:        "#c4b090",
                      fontFamily:   "var(--serif)",
                      fontStyle:    "italic",
                      fontSize:     13,
                      textAlign:    "left",
                      cursor:       "pointer",
                      transition:   "background 120ms",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background =
                        "rgba(var(--genre-accent-rgb), .06)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <span style={{ flex: 1, minWidth: 0 }}>{option.text}</span>
                    {/* UI-fix-G 4c — badges bumped from fontSize 6 to 7.
                        At 6px the "CHA · Good odds" / "Observe" labels
                        crowded into illegibility on most monitors; 7
                        keeps the chip dense without sacrificing the
                        odds read. Letter-spacing, radius, padding,
                        and colours unchanged. */}
                    {kind === "STAT_GATED" && badge && (
                      <span
                        className="ew-sans uppercase"
                        title={`${badge.stat} ${badge.value}${badge.note ? ` (${badge.note})` : ""}`}
                        style={{
                          fontSize:      7,
                          letterSpacing: "0.10em",
                          color:         "#c4943a",
                          background:    "rgba(196,148,58,.12)",
                          borderRadius:  20,
                          padding:       "1px 6px",
                          flexShrink:    0,
                        }}
                      >
                        {badge.stat} · {oddsLabel(badge.value)}
                      </span>
                    )}
                    {kind === "OBSERVATION" && (
                      <span
                        className="ew-sans uppercase"
                        title={`Perception probe — your PER: ${badge!.value}`}
                        style={{
                          display:       "inline-flex",
                          alignItems:    "center",
                          gap:           4,
                          fontSize:      7,
                          letterSpacing: "0.10em",
                          color:         "var(--observation-teal)",
                          background:    "rgba(74,152,136,.12)",
                          borderRadius:  20,
                          padding:       "1px 6px",
                          flexShrink:    0,
                        }}
                      >
                        <span aria-hidden style={{ fontSize: 10, lineHeight: 1 }}>◉</span>
                        Observe
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Secondary actions row — trade / rest / free-type sit OUTSIDE
                the 4 primary slots so the slot grid stays a stable shape
                regardless of NPC role. */}
            {(isCurrentNpcMerchant || restOption || freeOption) && (
              <div
                style={{
                  display:        "flex",
                  flexWrap:       "wrap",
                  gap:            6,
                  padding:        "0 14px",
                  marginTop:      4,
                }}
              >
                {isCurrentNpcMerchant && (
                  <button
                    onClick={handleOpenTrade}
                    disabled={tradeOpen && tradeItems.length > 0}
                    title={
                      tradeOpen && tradeItems.length > 0
                        ? "Trade panel is open"
                        : "Open trade panel"
                    }
                    style={{
                      flex:          "1 1 0",
                      minWidth:      90,
                      padding:       "6px 10px",
                      background:    "rgba(var(--genre-accent-rgb), .10)",
                      border:        "1px solid color-mix(in srgb, var(--genre-accent) 35%, transparent)",
                      borderRadius:  4,
                      color:         "var(--genre-accent)",
                      fontFamily:    "var(--sans)",
                      fontSize:      8,
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                      fontWeight:    600,
                      cursor:        (tradeOpen && tradeItems.length > 0) ? "default" : "pointer",
                      opacity:       (tradeOpen && tradeItems.length > 0) ? 0.4 : 1,
                    }}
                  >
                    ◆ Trade
                  </button>
                )}
                {restOption && (
                  <button
                    onClick={() => handleOption(restOption)}
                    style={{
                      flex:          "1 1 0",
                      minWidth:      90,
                      padding:       "6px 10px",
                      background:    "rgba(var(--genre-accent-rgb), .10)",
                      border:        "1px solid color-mix(in srgb, var(--genre-accent) 35%, transparent)",
                      borderRadius:  4,
                      color:         "var(--genre-accent)",
                      fontFamily:    "var(--sans)",
                      fontSize:      8,
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                      fontWeight:    600,
                      cursor:        "pointer",
                    }}
                  >
                    ☾ Rent room
                  </button>
                )}
              </div>
            )}

            {/* Free-type input row — clicking the closed pill opens the
                inline input, same handler as the option-list "free" type.
                Restyled to fit the new panel surface. */}
            <div style={{ padding: "8px 14px 0" }}>
              {inlineInputOpen ? (
                <div
                  style={{
                    display:    "flex",
                    alignItems: "center",
                    background: "var(--bg-0)",
                    border:     "1px solid #2d2618",
                    borderRadius: 4,
                    padding:    "2px 4px 2px 10px",
                  }}
                >
                  <span
                    style={{
                      color:       "var(--genre-accent)",
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
                      color:      "#e2cda0",
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
                      background:    "rgba(var(--genre-accent-rgb), .14)",
                      color:         "var(--genre-accent)",
                      // UI-fix-A — button label is UI chrome → Inter Tight.
                      fontFamily:    "var(--sans)",
                      fontSize:      10,
                      letterSpacing: "0.24em",
                      padding:       "6px 10px",
                      borderRadius:  3,
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
                    width:        "100%",
                    display:      "flex",
                    alignItems:   "center",
                    gap:          8,
                    padding:      "8px 10px",
                    background:   "var(--bg-0)",
                    border:       "1px solid #2d2618",
                    borderRadius: 4,
                    fontFamily:   "var(--serif)",
                    fontStyle:    "italic",
                    color:        "#6a5530",
                    fontSize:     13,
                    cursor:       "pointer",
                    textAlign:    "left",
                  }}
                >
                  ✎  type your own response…
                </button>
              )}
            </div>

            {/* UI-6 (CHANGE 5) — End Conversation: persistent full-width
                button OUTSIDE / BELOW the 4 slots. Inter Tight 8px
                uppercase 0.10em #6a5530, 1px #2d2618 border. Hover
                lifts the colour. */}
            <div style={{ padding: "10px 14px 12px" }}>
              <button
                onClick={() => clear()}
                className="ew-sans uppercase"
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "#a08870";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "#6a5530";
                }}
                style={{
                  width:         "100%",
                  fontSize:      8,
                  letterSpacing: "0.10em",
                  color:         "#6a5530",
                  background:    "transparent",
                  border:        "1px solid #2d2618",
                  borderRadius:  4,
                  cursor:        "pointer",
                  padding:       "8px 0",
                  transition:    "color 120ms",
                }}
              >
                End conversation
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
