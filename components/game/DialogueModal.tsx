"use client";

import { ChevronUp, ChevronDown } from "lucide-react";
import { useGameStore } from "@/lib/stores/game-store";
import { getNpcDisposition } from "@/lib/game/state-utils";
import type { DialogueOption } from "@/types/game";

interface DialogueModalProps {
  /** Submit a player line. Includes the active NPC name so the game loop can
   *  pin primary_target without relying on the Intent Parser to extract it. */
  onSubmit:     (input: string, options?: { npcName?: string }) => void;
  onFocusInput: () => void;
}

const TONE_COLORS: Record<DialogueOption["tone"], string> = {
  friendly:   "#22c55e",
  aggressive: "#ef4444",
  curious:    "#3b82f6",
  deceptive:  "#eab308",
};

const TONE_LABELS: Record<DialogueOption["tone"], string> = {
  friendly:   "Friendly",
  aggressive: "Aggressive",
  curious:    "Curious",
  deceptive:  "Deceptive",
};

type StatKey = NonNullable<DialogueOption["stat_check"]>["stat"];

const STAT_ICONS: Record<StatKey, string> = {
  charisma:     "💬",
  strength:     "💪",
  perception:   "👁",
  intelligence: "🧠",
};

const STAT_LABELS: Record<StatKey, string> = {
  charisma:     "CHA",
  strength:     "STR",
  perception:   "PER",
  intelligence: "INT",
};

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
export function DialogueModal({ onSubmit, onFocusInput }: DialogueModalProps) {
  const options       = useGameStore((s) => s.currentDialogueOptions);
  const npcName       = useGameStore((s) => s.currentDialogueNpc);
  const npcKey        = useGameStore((s) => s.currentDialogueNpcKey);
  const portrait      = useGameStore((s) => s.currentNpcPortrait);
  const collapsed     = useGameStore((s) => s.dialogueModalCollapsed);
  const setCollapsed  = useGameStore((s) => s.setDialogueModalCollapsed);
  const clear         = useGameStore((s) => s.clearDialogueOptions);

  // Player's own attribute scores — used by the stat-check tooltip & badge.
  const playerStats = useGameStore((s) => s.masterState?.player_state.attributes);

  // Trust score is the AUTHORITATIVE value: read directly from
  // masterState.npc_registry via currentDialogueNpcKey. Updates reactively
  // every time trust_changes are applied to the registry.
  const trustScore = useGameStore((s) => {
    if (!npcKey || !s.masterState) return null;
    return s.masterState.npc_registry[npcKey]?.trust_score ?? null;
  });

  if (options.length === 0) return null;

  // Both submit paths pass the stored NPC name so the game loop can pin
  // primary_target without re-extracting it from speech.
  const handleOption = (option: DialogueOption) => {
    clear();
    onSubmit(`"${option.text}"`, npcName ? { npcName } : undefined);
  };

  const handleTypeOwn = () => {
    clear();
    onFocusInput();
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
        borderTop:       "3px solid var(--color-accent)",
        borderBottom:    "1px solid var(--color-border)",
        backgroundColor: "var(--color-bg)",
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
            border:          "1px solid var(--color-accent)",
            backgroundColor: "color-mix(in srgb, var(--color-accent) 6%, var(--color-bg))",
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

        {/* NPC name */}
        <p
          className="text-center text-[10px] font-bold uppercase tracking-wider leading-tight"
          style={{ color: "var(--color-accent)", maxWidth: "100px", wordBreak: "break-word" }}
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
          const color = TONE_COLORS[option.tone];
          const label = TONE_LABELS[option.tone];

          // Stat-check badge — amber warning, never a hard gate.
          const sc            = option.stat_check;
          const playerStat    = sc && playerStats ? playerStats[sc.stat] ?? 10 : 10;
          const tooltipText   = sc
            ? `Your ${STAT_LABELS[sc.stat]}: ${playerStat} | Difficulty: ${sc.difficulty} — ${
                playerStat >= sc.difficulty + 4 ? "Likely to succeed"
                : playerStat >= sc.difficulty - 2 ? "Risky"
                : "Difficult"
              }`
            : "";

          return (
            <button
              key={option.id}
              onClick={() => handleOption(option)}
              className="flex w-full items-center gap-2 rounded-sm px-2.5 py-1.5 text-left transition-opacity"
              style={{
                fontSize:        "0.85rem",
                backgroundColor: `color-mix(in srgb, ${color} 10%, transparent)`,
                border:          `1px solid ${color}`,
                cursor:          "pointer",
              }}
            >
              {/* Tone dot */}
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: color }}
                title={label}
              />

              {/* Tone label — visible from 480px and up, hidden on narrow mobile */}
              <span
                className="hidden shrink-0 text-[9px] font-bold uppercase tracking-wider min-[480px]:inline"
                style={{ color, minWidth: "62px" }}
              >
                {label}
              </span>

              {/* Option text */}
              <span
                className="min-w-0 flex-1 truncate font-mono leading-snug"
                style={{
                  color:    "var(--color-text)",
                  fontSize: "0.85rem",
                }}
              >
                {option.text}
              </span>

              {/* Stat-check badge (amber, informational) */}
              {sc && (
                <span
                  title={tooltipText}
                  className="ml-auto flex shrink-0 items-center gap-1 rounded-sm px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide"
                  style={{
                    color:           "#f59e0b",
                    backgroundColor: "color-mix(in srgb, #f59e0b 14%, transparent)",
                    border:          "1px solid color-mix(in srgb, #f59e0b 50%, transparent)",
                  }}
                >
                  <span aria-hidden>{STAT_ICONS[sc.stat]}</span>
                  <span>{STAT_LABELS[sc.stat]} {sc.difficulty}+</span>
                </span>
              )}
            </button>
          );
        })}

        {/* Type your own — always last */}
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
      </div>
    </div>
  );
}
