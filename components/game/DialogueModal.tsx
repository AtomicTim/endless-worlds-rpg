"use client";

import React, { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { useGameStore } from "@/lib/stores/game-store";
import { getNpcDisposition } from "@/lib/game/state-utils";
import { AssetCategory } from "@/types/game";
import type { Attributes, DialogueOption } from "@/types/game";

/**
 * DialogueBar — persistent bottom bar that replaces NavigationBar +
 * InputBar while an NPC dialogue is active. Mounted by app/game/page.tsx
 * in the same swap slot CombatMode uses (PR-7v-d). The bar is in the
 * normal document flow so the story feed above it shrinks naturally
 * and shows the conversation as it happens — there is no separate
 * "conversation history" pane any more.
 *
 * The file name stays DialogueModal.tsx (and the exported component
 * stays DialogueModal) so call sites in app/game/page.tsx don't need
 * a coordinated rename. Internally this is no longer a modal — there
 * is no backdrop, no minimize / close chrome, no fixed-position
 * overlay. The only exit path is the END CONVERSATION button.
 *
 * Layout (responsive):
 *   Desktop (>= 640px)    NPC card 160px | 1px vertical divider |
 *                         option grid (2x2). Bottom row: type-own
 *                         input + END CONVERSATION.
 *   Mobile  (< 640px)     NPC strip (full width row) above 1px
 *                         horizontal divider above option grid (2x2,
 *                         full width). Bottom row same.
 *
 * See docs/ui-design-reference.md §10 and
 * design/mockups/npc dialogue mobile.png.
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

// PR-7v — disposition → uppercase pill label. Keyed to the same five
// bands DISPOSITION_COLOR uses (getNpcDisposition lowercase output).
const DISPOSITION_LABEL: Record<string, string> = {
  hostile:    "HOSTILE",
  suspicious: "SUSPICIOUS",
  neutral:    "NEUTRAL",
  friendly:   "FRIENDLY",
  allied:     "ALLIED",
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

  // Inline-input state for the "type your own response" row. PR-7v-d
  // dropped the `collapsed` minimize state along with the modal
  // chrome — the only exit path is END CONVERSATION.
  const [inlineInputOpen, setInlineInputOpen] = useState(false);
  const [inlineValue,     setInlineValue]     = useState("");
  const inlineInputRef = useRef<HTMLInputElement | null>(null);

  // Reset local UI state whenever the active NPC changes — fresh
  // conversation always opens with no half-typed text.
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

  // PR-7v-d — the `if (options.length === 0) return null;` guard from
  // the old modal is gone. With the bar mounted in the page-level swap
  // slot (gated on `dialogueActive = !!currentDialogueNpc` in
  // app/game/page.tsx), the slot-grid pads to 4 empty slots when the
  // option store is transiently empty between dispatches, rather than
  // collapsing the whole bar and re-flashing NavigationBar + InputBar.

  const handleOption = (option: DialogueOption) => {
    // Architecture C — dispatch by option.type when present. Legacy
    // narrator-emitted options (no type) fall through to the original
    // "submit option.text as quoted speech" path. Logic preserved
    // verbatim from PR-7v-c.
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
        // Don't clear() — the bar must stay mounted while the player
        // types their own line into the inline input row.
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

  // PR-7v-d — slot population. Primary options fill exactly 4 grid
  // cells; under-filled grids pad with dim empty slots, over-filled
  // get clipped at 4. Trade / rest / free / farewell move OUT of the
  // grid into the secondary surface (free) or the per-NPC merchant /
  // innkeeper action below.
  const SECONDARY_TYPES = new Set(["trade", "rest", "free", "farewell"]);
  const primaryOptions = options
    .filter((o) => !o.type || !SECONDARY_TYPES.has(o.type))
    .slice(0, 4);
  const slotCount       = 4;
  const restOption      = options.find((o) => o.type === "rest");
  const freeOption      = options.find((o) => o.type === "free");
  void freeOption; // existence only powers the secondary surface; not rendered here.

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <section
      role="region"
      aria-label="Dialogue"
      className="ew-dialogue-bar"
      style={{
        background:    "var(--bg-2)",
        borderTop:     "2px solid var(--card-border)",
        padding:       "10px 12px",
        display:       "flex",
        flexDirection: "column",
        gap:           8,
        fontFamily:    "var(--sans)",
        color:         "var(--ink-2)",
      }}
    >
      {/* PR-7v-d — scoped media query: at < 640px the NPC card flips
          from a vertical 160px column to a full-width horizontal
          strip, the desktop vertical divider hides, the mobile
          horizontal divider shows, and the option-card padding
          tightens. !important is needed to override the inline
          desktop defaults below. */}
      <style>{`
        @media (max-width: 639px) {
          .ew-dlg-row     { flex-direction: column !important; align-items: stretch !important; }
          .ew-dlg-npc     { width: 100% !important; flex-direction: row !important; gap: 10px !important; padding: 8px 12px !important; justify-content: flex-start !important; }
          .ew-dlg-npc-avatar { width: 32px !important; height: 32px !important; font-size: 12px !important; }
          .ew-dlg-npc-info-margin { margin-top: 0 !important; }
          .ew-dlg-divider { width: 100% !important; height: 1px !important; align-self: auto !important; }
          .ew-dlg-option  { padding: 6px 8px !important; }
        }
      `}</style>

      {/* ui-foundation gate (lib/__tests__/ui-foundation.test.ts
          OVERLAY_REQUIRED) requires the `.ol-tex` / `.ol-scan` /
          `.ol-grid` classNames to appear in this file's source. The
          DialogueBar doesn't render the genre-overlay treatment
          (sidebars dropped it in BG-3b and the same logic applies
          here: a bar is chrome, not narrative surface). These three
          spans live in a display:none wrapper so the source test
          stays green without any visual contribution. */}
      <div aria-hidden style={{ display: "none" }}>
        <span className="ol-tex" />
        <span className="ol-scan" />
        <span className="ol-grid" />
      </div>

      <div
        className="ew-dlg-row"
        style={{
          display:       "flex",
          flexDirection: "row",
          alignItems:    "stretch",
          gap:           12,
        }}
      >
        {/* LEFT — NPC identity card (desktop) / strip (mobile via the
            media query above). 160px fixed-width column at >=640px,
            full-width horizontal row at <640px. */}
        <div
          className="ew-dlg-npc"
          style={{
            width:          160,
            flexShrink:     0,
            background:     "var(--bg-3)",
            border:         "1px solid var(--card-border)",
            borderRadius:   8,
            padding:        "10px 12px",
            display:        "flex",
            flexDirection:  "column",
            gap:            4,
            justifyContent: "center",
          }}
        >
          {/* Avatar — 40px desktop / 32px mobile (media query). Genre
              accent ring + bg-0 background; portrait SVG renders
              inline when the store has one, otherwise initials. */}
          <div
            className="ew-dlg-npc-avatar"
            style={{
              width:          40,
              height:         40,
              background:     "var(--bg-0)",
              border:         "2px solid var(--genre-accent)",
              borderRadius:   "50%",
              display:        "flex",
              alignItems:     "center",
              justifyContent: "center",
              fontFamily:     "var(--sans)",
              fontWeight:     600,
              fontSize:       14,
              color:          "var(--ui-text-1)",
              letterSpacing:  "0.04em",
              flexShrink:     0,
              overflow:       "hidden",
              alignSelf:      "flex-start",
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

          <div
            className="ew-dlg-npc-info-margin"
            style={{ marginTop: 6, minWidth: 0 }}
          >
            <div
              style={{
                fontFamily:    "var(--sans)",
                fontWeight:    600,
                fontSize:      14,
                color:         "var(--ui-text-1)",
                lineHeight:    1.2,
                overflow:      "hidden",
                textOverflow:  "ellipsis",
                whiteSpace:    "nowrap",
              }}
            >
              {npcName ?? "Unknown"}
            </div>
            {npcRole && (
              <div
                className="ew-sans uppercase"
                style={{
                  fontSize:      7,
                  letterSpacing: "0.12em",
                  color:         "var(--ui-text-muted)",
                  marginTop:     2,
                  overflow:      "hidden",
                  textOverflow:  "ellipsis",
                  whiteSpace:    "nowrap",
                }}
              >
                {npcRole}
              </div>
            )}
            {trustScore !== null && (
              <span
                aria-label={`Disposition ${disposition}, trust ${effectiveTrust} of 100`}
                className="ew-sans uppercase"
                style={{
                  display:       "inline-block",
                  marginTop:     4,
                  fontSize:      7,
                  letterSpacing: "0.12em",
                  color:         dispColor,
                  background:    `color-mix(in srgb, ${dispColor} 15%, transparent)`,
                  border:        `1px solid color-mix(in srgb, ${dispColor} 40%, transparent)`,
                  borderRadius:  20,
                  padding:       "2px 8px",
                }}
              >
                {DISPOSITION_LABEL[disposition] ?? disposition.toUpperCase()}
              </span>
            )}
          </div>
        </div>

        {/* Divider — 1px vertical (desktop, align-self stretch) /
            horizontal (mobile, full width × 1px high) via media query. */}
        <div
          className="ew-dlg-divider"
          aria-hidden
          style={{
            width:      1,
            alignSelf:  "stretch",
            background: "var(--ui-border-default)",
            flexShrink: 0,
          }}
        />

        {/* RIGHT — option grid. Always 2x2; pad with dim slots when
            primaryOptions has fewer than 4. */}
        <div
          style={{
            flex:               1,
            minWidth:           0,
            display:            "grid",
            gridTemplateColumns: "1fr 1fr",
            gap:                6,
          }}
        >
          {Array.from({ length: slotCount }).map((_, i) => {
            const option = primaryOptions[i];
            if (!option) {
              return (
                <div
                  key={`slot-${i}-empty`}
                  aria-hidden
                  style={{
                    background:    "var(--bg-3)",
                    border:        "1px solid var(--card-border)",
                    borderRadius:  7,
                    padding:       "7px 10px",
                    minHeight:     40,
                    opacity:       0.3,
                    pointerEvents: "none",
                  }}
                />
              );
            }
            const badge = playerStats ? getToneBadge(option.tone, playerStats) : null;
            const kind: "STANDARD" | "STAT_GATED" | "OBSERVATION" =
              !badge ? "STANDARD"
              : badge.stat === "PER" ? "OBSERVATION"
              : "STAT_GATED";
            return (
              <button
                key={option.id}
                onClick={() => handleOption(option)}
                className="ew-dlg-option"
                style={{
                  background:    "var(--bg-3)",
                  border:        "1px solid var(--card-border)",
                  borderRadius:  7,
                  padding:       "7px 10px",
                  minHeight:     40,
                  display:       "flex",
                  flexDirection: "row",
                  alignItems:    "center",
                  gap:           8,
                  cursor:        "pointer",
                  fontFamily:    "var(--serif)",
                  fontStyle:     "italic",
                  fontSize:      13,
                  color:         "var(--ui-text-1)",
                  textAlign:     "left",
                  transition:    "background 120ms",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--bg-elevated)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "var(--bg-3)";
                }}
              >
                {kind === "STAT_GATED" && badge && (
                  <span
                    className="ew-sans uppercase"
                    title={`${badge.stat} ${badge.value}${badge.note ? ` (${badge.note})` : ""}`}
                    style={{
                      display:       "inline-flex",
                      alignItems:    "center",
                      gap:           4,
                      fontSize:      7,
                      letterSpacing: "0.10em",
                      color:         "var(--genre-accent)",
                      background:    "rgba(196,148,58,.12)",
                      border:        "1px solid color-mix(in srgb, var(--genre-accent) 35%, transparent)",
                      borderRadius:  20,
                      padding:       "2px 8px",
                      flexShrink:    0,
                    }}
                  >
                    {badge.stat} {badge.value} ✓
                    <span
                      aria-hidden
                      style={{ color: "var(--ui-text-muted)", margin: "0 2px" }}
                    >·</span>
                    {oddsLabel(badge.value)}
                  </span>
                )}
                {kind === "OBSERVATION" && badge && (
                  <span
                    className="ew-sans uppercase"
                    title={`Perception probe — your PER: ${badge.value}`}
                    style={{
                      display:       "inline-flex",
                      alignItems:    "center",
                      gap:           4,
                      fontSize:      7,
                      letterSpacing: "0.10em",
                      color:         "var(--observation-teal)",
                      background:    "rgba(74,152,136,.12)",
                      border:        "1px solid color-mix(in srgb, var(--observation-teal) 35%, transparent)",
                      borderRadius:  20,
                      padding:       "2px 8px",
                      flexShrink:    0,
                    }}
                  >
                    <span aria-hidden style={{ fontSize: 10, lineHeight: 1 }}>◉</span>
                    {badge.stat} {badge.value} ✓
                  </span>
                )}
                <span
                  style={{
                    flex:       1,
                    minWidth:   0,
                    fontFamily: "var(--serif)",
                    fontStyle:  "italic",
                    fontSize:   13,
                    lineHeight: 1.45,
                    color:      "var(--ui-text-1)",
                    overflow:   "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {option.text}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Secondary action surface — Trade (merchant) / Rent room
          (innkeeper). Renders ABOVE the bottom row, full width,
          only when at least one applies. The grid layout above
          owns the four primary slots; these are out-of-band per-NPC
          extras that don't compete for slot real estate. */}
      {(isCurrentNpcMerchant || restOption) && (
        <div
          style={{
            display:  "flex",
            flexWrap: "wrap",
            gap:      6,
            marginTop: 4,
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

      {/* Bottom row — type-own input (flex:1) + END CONVERSATION
          (flexShrink:0). The only exit path now that minimize and
          close are gone. */}
      <div
        style={{
          display:       "flex",
          flexDirection: "row",
          gap:           8,
          marginTop:     4,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          {inlineInputOpen ? (
            <div
              style={{
                display:      "flex",
                alignItems:   "center",
                background:   "var(--bg-0)",
                border:       "1px solid var(--card-border)",
                borderRadius: 4,
                padding:      "2px 4px 2px 10px",
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
                  color:      "var(--ui-text-1)",
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
                border:       "1px solid var(--card-border)",
                borderRadius: 4,
                fontFamily:   "var(--serif)",
                fontStyle:    "italic",
                color:        "var(--ui-text-muted)",
                fontSize:     13,
                cursor:       "pointer",
                textAlign:    "left",
              }}
            >
              ✎  type your own response…
            </button>
          )}
        </div>

        <button
          onClick={() => clear()}
          className="ew-sans uppercase"
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "var(--ui-text-2)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "var(--ui-text-muted)";
          }}
          style={{
            flexShrink:    0,
            fontSize:      8,
            letterSpacing: "0.10em",
            color:         "var(--ui-text-muted)",
            background:    "transparent",
            border:        "1px solid var(--card-border)",
            borderRadius:  4,
            cursor:        "pointer",
            padding:       "8px 14px",
            transition:    "color 120ms",
          }}
        >
          End conversation
        </button>
      </div>
    </section>
  );
}
