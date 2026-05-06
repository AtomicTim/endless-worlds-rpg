"use client";

import { ChevronUp, ChevronDown, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useGameStore } from "@/lib/stores/game-store";
import { getNpcDisposition } from "@/lib/game/state-utils";
import { AssetCategory, Genre } from "@/types/game";
import type { Attributes, DialogueOption } from "@/types/game";
import { getGenreColors, TONE_BAR_COLORS } from "./genre-ui";

interface DialogueModalProps {
  /** Submit a player line. Includes the active NPC name so the game loop can
   *  pin primary_target without relying on the Intent Parser to extract it.
   *  Also includes the option's tone (for option-click submits) so the
   *  resolver fires the EXACT check the badge advertised — never the
   *  re-classified speech tone. */
  onSubmit:     (input: string, options?: { npcName?: string; tone?: DialogueOption["tone"] }) => void;
  onFocusInput: () => void;
  /** FIX (UX 4) — open the trade panel directly without routing through
   *  the intent parser or resolveDialogue. Hook handler synthesizes a
   *  trade_available resolution and calls the narrator without firing
   *  a stat check. Trade is always available for merchants. */
  onOpenTrade:  (npcName: string) => void;
}

interface ToneBadge {
  icon:  string;
  stat:  "CHA" | "STR" | "PER";
  value: number;
  note?: string;
}

/**
 * Tone-derived stat badge — shows the player which attribute the resolver
 * will roll if they click this option. Mirrors the resolver's tone switch
 * exactly: aggressive → STR, curious → PER, deceptive → CHA at +2 difficulty.
 * friendly options have no badge (no check fires).
 */
function getToneBadge(tone: DialogueOption["tone"], attributes: Attributes): ToneBadge | null {
  switch (tone) {
    case "curious":
      return { icon: "👁", stat: "PER", value: attributes.perception };
    case "deceptive":
      return { icon: "💬", stat: "CHA", value: attributes.charisma, note: "+2 diff" };
    case "aggressive":
      return { icon: "💪", stat: "STR", value: attributes.strength };
    case "friendly":
    default:
      return null;
  }
}

const DISPOSITION_STYLES: Record<string, { color: string; icon: string }> = {
  hostile:    { color: "#ef4444", icon: "🔴" },
  suspicious: { color: "#f97316", icon: "🟠" },
  neutral:    { color: "#eab308", icon: "🟡" },
  friendly:   { color: "#22c55e", icon: "🟢" },
  allied:     { color: "#a855f7", icon: "✨" },
};

/**
 * Force the portrait SVG to fill its container — same helper as SceneArt.
 */
function ensureResponsiveSvg(svg: string): string {
  let out = svg;
  if (!/width\s*=/.test(out))  out = out.replace(/<svg\b/i, '<svg width="100%"');
  if (!/height\s*=/.test(out)) out = out.replace(/<svg\b/i, '<svg height="100%"');
  return out;
}

/**
 * Dialogue Modal — rendered inline between the StoryFeed and the InputBar.
 * Takes up DOM space (never overlays the story feed). Collapses to a compact
 * 40px bar that the player can re-expand without losing their options.
 */
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

  // Player's own attribute scores — used by the stat-check tooltip & badge.
  const playerStats = useGameStore((s) => s.masterState?.player_state.attributes);
  // Day 18 — every accent comes from the active genre. Falls back to Fantasy
  // before masterState is hydrated (purely cosmetic; primary changes once loaded).
  const genre  = useGameStore((s) => s.masterState?.metadata.genre) ?? Genre.FANTASY;
  const colors = getGenreColors(genre);

  // FIX 3 — inline free-type input state. When the player clicks the
  // "type your own response" button, we DON'T close the modal or jump
  // to the main InputBar; instead we reveal an input INSIDE the modal
  // so the conversation context (NPC name, portrait, options) stays
  // anchored on screen. Submit on Enter or send-button click.
  const [inlineInputOpen, setInlineInputOpen] = useState(false);
  const [inlineValue,     setInlineValue]     = useState("");
  const inlineInputRef = useRef<HTMLInputElement | null>(null);

  // Reset inline mode whenever the conversation pivots to a different NPC
  // so a stale input doesn't bleed across characters.
  useEffect(() => {
    setInlineInputOpen(false);
    setInlineValue("");
  }, [npcName]);

  // Focus the inline input as soon as it appears.
  useEffect(() => {
    if (inlineInputOpen) {
      inlineInputRef.current?.focus();
    }
  }, [inlineInputOpen]);

  // Trust score is the AUTHORITATIVE value: read directly from
  // masterState.npc_registry via currentDialogueNpcKey. Updates reactively
  // every time trust_changes are applied to the registry.
  const trustScore = useGameStore((s) => {
    if (!npcKey || !s.masterState) return null;
    return s.masterState.npc_registry[npcKey]?.trust_score ?? null;
  });

  if (options.length === 0) return null;

  // Both submit paths pass the stored NPC name so the game loop can pin
  // primary_target without re-extracting it from speech. Issue B: the
  // option's tone is ALSO passed so resolveDialogue fires exactly the
  // check the player saw on the badge.
  const handleOption = (option: DialogueOption) => {
    clear();
    onSubmit(`"${option.text}"`, {
      ...(npcName ? { npcName } : {}),
      tone: option.tone,
    });
  };

  // FIX 3 — replaced. The button now opens an inline input INSIDE the
  // modal instead of clearing the modal and routing to the main
  // InputBar. The conversation context (NPC name, portrait, disposition)
  // stays visible while the player types their custom line. The
  // onFocusInput callback is preserved for the legacy behaviour but is
  // no longer wired to this button.
  void onFocusInput;
  const handleTypeOwn = () => {
    setInlineInputOpen(true);
  };

  const handleInlineSubmit = () => {
    const trimmed = inlineValue.trim();
    if (!trimmed) return;
    // Wrap in quotes so the Intent Parser classifies the line as
    // DIALOGUE rather than a CUSTOM action. npcName pinning makes
    // sure the resolver fires against the active NPC even when the
    // parser can't extract a target from raw speech.
    const wrapped = `"${trimmed}"`;
    setInlineValue("");
    setInlineInputOpen(false);
    onSubmit(wrapped, npcName ? { npcName } : {});
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

  // FIX (UX 4 / round 5) — merchant detection now ONLY trusts the NPC
  // asset's role. We deliberately drop the "items_for_sale > 0 means
  // merchant" shortcut: when the player switches conversations to a
  // non-merchant NPC, leftover items from the previous trade would
  // otherwise keep the button visible and let the player open trade
  // with someone who has nothing to sell. tradeOpen is honoured purely
  // as a render flag for the active state — it never overrides the
  // role gate.
  const isCurrentNpcMerchant = (() => {
    if (!npcName) return false;
    const npcAsset = locationAssets.find(
      (a) => a.category === AssetCategory.CHARACTER &&
             a.name.toLowerCase() === npcName.toLowerCase()
    );
    if (!npcAsset) return false;
    const role = (npcAsset.constitution.role ?? "").toLowerCase();
    return role.includes("merchant")
        || role.includes("trader")
        || role.includes("vendor")
        || role.includes("shopkeeper");
  })();

  // FIX 1 — the trade button no longer submits a quoted dialogue line.
  // It calls onOpenTrade(npcName) which the hook handles directly:
  // the narrator is invoked with a synthetic trade_available resolution
  // and never goes through resolveDialogue / parseIntent — no stat
  // check fires. Trade is always free to open for any merchant; trust
  // governs price (handled in buyItem/sellItem), not access.
  const handleOpenTrade = () => {
    if (!npcName) return;
    setInlineInputOpen(false);
    onOpenTrade(npcName);
  };

  // ── Collapsed bar ───────────────────────────────────────────────────────────
  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        aria-label="Expand dialogue"
        className="flex h-10 w-full shrink-0 items-center justify-center gap-2 transition-colors hover:bg-white/[0.04]"
        style={{
          borderTop:       "2px solid var(--color-accent)",
          borderBottom:    "1px solid var(--color-border)",
          backgroundColor: "color-mix(in srgb, var(--color-accent) 8%, var(--color-bg))",
          color:           "var(--color-accent)",
        }}
      >
        <ChevronUp className="size-3.5" />
        <span className="text-[10px] font-bold uppercase tracking-widest">
          {npcName ?? "Dialogue"}
        </span>
        <span className="text-[9px] italic" style={{ color: "var(--color-muted)" }}>
          ({options.length} options)
        </span>
      </button>
    );
  }

  // ── Disposition badge ───────────────────────────────────────────────────────
  // Always render a badge — fall back to neutral (trust 50) when the NPC
  // isn't in the registry yet so the player never sees a "missing" UI gap.
  const effectiveTrust = trustScore ?? 50;
  const disposition    = getNpcDisposition(effectiveTrust);
  const dispStyle      = DISPOSITION_STYLES[disposition] ?? DISPOSITION_STYLES.neutral;

  // ── Expanded modal ──────────────────────────────────────────────────────────
  return (
    <div
      role="dialog"
      aria-label="Dialogue options"
      className="flex shrink-0 overflow-hidden"
      style={{
        height:          "200px",
        maxHeight:       "200px",
        borderTop:       `3px solid ${colors.primary}`,
        borderBottom:    "1px solid var(--color-border)",
        backgroundColor: "var(--color-bg)",
        fontFamily:      "var(--font-mono)",
      }}
    >
      {/* ── LEFT — Portrait, NPC name, disposition ─────────────────────────── */}
      <div
        className="flex shrink-0 flex-col items-center gap-1 px-2 py-2"
        style={{
          width:       "112px",
          borderRight: "1px solid var(--color-border)",
        }}
      >
        {/* Portrait box (80×80) */}
        <div
          className="overflow-hidden rounded-sm"
          style={{
            width:           "80px",
            height:          "80px",
            border:          `1px solid ${colors.primary}`,
            backgroundColor: `color-mix(in srgb, ${colors.primary} 6%, var(--color-bg))`,
            flexShrink:      0,
          }}
        >
          {portrait ? (
            <div
              className="h-full w-full"
              style={{ imageRendering: "pixelated" }}
              dangerouslySetInnerHTML={{ __html: ensureResponsiveSvg(portrait) }}
            />
          ) : (
            <svg viewBox="0 0 80 80" className="h-full w-full" aria-hidden>
              <circle cx="40" cy="28" r="14" fill="var(--color-muted)" opacity="0.35" />
              <ellipse cx="40" cy="58" rx="22" ry="16" fill="var(--color-muted)" opacity="0.35" />
            </svg>
          )}
        </div>

        {/* NPC name — genre primary, mono, bold */}
        <p
          className="text-center leading-tight"
          style={{
            color:         colors.primary,
            fontFamily:    "var(--font-mono)",
            fontWeight:    "bold",
            fontSize:      13,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            maxWidth:      "100px",
            wordBreak:     "break-word",
          }}
        >
          {npcName ?? "???"}
        </p>

        {/* Disposition indicator — always shown, defaults to Neutral */}
        <span
          className="flex items-center gap-1 rounded-sm px-1 py-0.5 text-[9px] font-bold uppercase tracking-wider"
          style={{
            color:           dispStyle.color,
            backgroundColor: `color-mix(in srgb, ${dispStyle.color} 12%, transparent)`,
          }}
          title={`Trust ${effectiveTrust}/100`}
        >
          <span aria-hidden>{dispStyle.icon}</span>
          <span>{disposition}</span>
        </span>

        {/* Walk away — fully clears the modal */}
        <button
          onClick={() => clear()}
          className="mt-auto text-[9px] italic underline-offset-2 underline transition-opacity hover:opacity-70"
          style={{ color: "var(--color-muted)" }}
        >
          walk away
        </button>
      </div>

      {/* ── RIGHT — Response options + minimize ───────────────────────────── */}
      <div className="relative flex min-w-0 flex-1 flex-col gap-1 overflow-y-auto px-3 py-2 pr-8">
        {/* Minimize button — top right */}
        <button
          onClick={() => setCollapsed(true)}
          aria-label="Minimize dialogue"
          className="absolute right-1.5 top-1.5 z-50 rounded-sm p-1 transition-colors hover:bg-white/10"
          style={{ color: "var(--color-muted)" }}
        >
          <ChevronDown className="size-3" />
        </button>

        {options.map((option) => {
          const barColor = TONE_BAR_COLORS[option.tone] ?? TONE_BAR_COLORS.neutral;

          // Tone-derived stat badge — shows the player their actual stat for
          // whichever check the resolver will fire on this option's tone.
          // Returns null for friendly/neutral so no badge renders for those.
          const badge       = playerStats ? getToneBadge(option.tone, playerStats) : null;
          const tooltipText = badge
            ? `Check fires on use. Your ${badge.stat}: ${badge.value}${badge.note ? ` (${badge.note})` : ""}`
            : "";

          return (
            <button
              key={option.id}
              onClick={() => handleOption(option)}
              style={{
                display:        "flex",
                alignItems:     "stretch",
                width:          "100%",
                marginBottom:   4,
                border:         "0.5px solid #2a3040",
                borderRadius:   3,
                overflow:       "hidden",
                cursor:         "pointer",
                background:     "transparent",
                fontFamily:     "var(--font-mono)",
                textAlign:      "left",
                transition:     "background-color 0.15s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.03)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
              }}
            >
              {/* Left tone accent bar (4px) */}
              <span
                aria-hidden
                style={{
                  width:           4,
                  flexShrink:      0,
                  backgroundColor: barColor,
                }}
              />

              {/* Option text — fills remaining space */}
              <span
                style={{
                  flex:        1,
                  minWidth:    0,
                  padding:     "6px 10px",
                  color:       "#aab8cc",
                  fontFamily:  "var(--font-mono)",
                  fontSize:    12,
                  lineHeight:  1.5,
                  overflow:    "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace:  "nowrap",
                }}
              >
                {option.text}
              </span>

              {/* Stat badge (right side, only when getToneBadge non-null) */}
              {badge && (
                <span
                  title={tooltipText}
                  style={{
                    fontFamily:  "var(--font-mono)",
                    fontSize:    10,
                    color:       "#6688bb",
                    padding:     "0 8px",
                    whiteSpace:  "nowrap",
                    alignSelf:   "center",
                  }}
                >
                  {badge.icon} {badge.stat} {badge.value}{badge.note ? ` (${badge.note})` : ""}
                </span>
              )}
            </button>
          );
        })}

        {/* FIX 3 — inline free-type input. Slides into place under the
            options when the player clicks "type your own". Stays inside
            the modal so the NPC's name + portrait remain visible. */}
        {inlineInputOpen ? (
          <div
            className="mt-auto flex items-center gap-2"
            style={{
              border:       `1px solid ${colors.primary}`,
              borderRadius: 4,
              padding:      4,
              backgroundColor: "color-mix(in srgb, var(--color-bg) 70%, #000)",
            }}
          >
            <input
              ref={inlineInputRef}
              type="text"
              value={inlineValue}
              onChange={(e) => setInlineValue(e.target.value)}
              onKeyDown={handleInlineKeyDown}
              onBlur={(e) => {
                // Don't close if focus moves to the send button —
                // relatedTarget will be the button in that case.
                const next = e.relatedTarget as HTMLElement | null;
                if (next?.dataset?.dialogueSend === "true") return;
                if (!inlineValue.trim()) {
                  setInlineInputOpen(false);
                }
              }}
              placeholder={
                npcName
                  ? `Say something to ${npcName}...`
                  : "Say something..."
              }
              maxLength={300}
              className="min-w-0 flex-1 bg-transparent px-2 text-[12px] focus:outline-none"
              style={{
                color:      "var(--color-text)",
                fontFamily: "var(--font-mono)",
              }}
            />
            <button
              onClick={handleInlineSubmit}
              data-dialogue-send="true"
              disabled={!inlineValue.trim()}
              aria-label="Send"
              className="shrink-0 rounded-sm px-2 py-1 text-[10px] font-bold uppercase tracking-wider transition-opacity disabled:opacity-40"
              style={{
                backgroundColor: colors.primary,
                color:           "#000",
                cursor:          inlineValue.trim() ? "pointer" : "not-allowed",
              }}
            >
              <Send className="size-3" />
            </button>
          </div>
        ) : (
          <button
            onClick={handleTypeOwn}
            className="mt-auto w-full rounded-sm px-2 py-1 text-center text-[10px] italic transition-opacity hover:opacity-70"
            style={{
              color:  "var(--color-muted)",
              border: "1px dashed color-mix(in srgb, var(--color-border) 70%, transparent)",
            }}
          >
            ✎ type your own response
          </button>
        )}

        {/* FIX 9 / FIX (UX 4) — permanent trade button when the active
            NPC is a merchant. Gated solely on the merchant's role so
            stale items_for_sale from a previous merchant can't keep
            the button visible after the player switches conversations.
            tradeOpen flips the button to its "active" state. */}
        {isCurrentNpcMerchant && (
          <button
            onClick={handleOpenTrade}
            disabled={tradeOpen && tradeItems.length > 0}
            className="mt-1 w-full rounded-sm px-2 py-1 text-center text-[10px] font-bold uppercase tracking-wider transition-opacity hover:opacity-80 disabled:opacity-40"
            style={{
              backgroundColor: "color-mix(in srgb, #fbbf24 18%, transparent)",
              border:          "1px solid #fbbf24",
              color:           "#fbbf24",
              cursor:          (tradeOpen && tradeItems.length > 0) ? "default" : "pointer",
            }}
            title={
              tradeOpen && tradeItems.length > 0
                ? "Trade panel is open"
                : "Open trade panel"
            }
          >
            💰 Trade
          </button>
        )}
      </div>
    </div>
  );
}
