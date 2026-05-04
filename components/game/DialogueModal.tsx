"use client";

import { Lock, X } from "lucide-react";
import { useGameStore } from "@/lib/stores/game-store";
import type { DialogueOption } from "@/types/game";

interface DialogueModalProps {
  onSubmit:     (input: string) => void;
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
 * Dialogue Modal — slides up from the bottom of the main game area when an
 * NPC interaction produces response options. Absolutely positioned within the
 * main panel so it overlays only the InputBar area without pushing the
 * StoryFeed up. Click outside the modal does NOT dismiss it (the InputBar is
 * still reachable via "type your own"); the small "X" / "walk away" buttons
 * close it explicitly.
 */
export function DialogueModal({ onSubmit, onFocusInput }: DialogueModalProps) {
  const options  = useGameStore((s) => s.currentDialogueOptions);
  const npcName  = useGameStore((s) => s.currentDialogueNpc);
  const portrait = useGameStore((s) => s.currentNpcPortrait);
  const charisma = useGameStore((s) => s.masterState?.player_state.attributes.charisma ?? 10);
  const clear    = useGameStore((s) => s.clearDialogueOptions);

  if (options.length === 0) return null;

  const handleOption = (option: DialogueOption) => {
    clear();
    onSubmit(`"${option.text}"`);
  };

  const handleTypeOwn = () => {
    clear();
    onFocusInput();
  };

  return (
    <>
      {/* Backdrop — only over the bottom strip where the modal sits.
          Lets the StoryFeed above stay clear and interactive. */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 z-30 pointer-events-none"
        style={{
          height:          "200px",
          backgroundColor: "rgba(0,0,0,0.45)",
        }}
      />

      <div
        role="dialog"
        aria-label="Dialogue options"
        className="absolute inset-x-0 bottom-0 z-40 flex"
        style={{
          height:          "200px",
          maxHeight:       "200px",
          borderTop:       "3px solid var(--color-accent)",
          backgroundColor: "var(--color-bg)",
        }}
      >
        {/* ── LEFT — Portrait + NPC name ─────────────────────────────────── */}
        <div
          className="flex shrink-0 flex-col items-center justify-center gap-1.5 px-2 py-2"
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

          {/* Walk away — small text link */}
          <button
            onClick={() => clear()}
            className="text-[9px] italic underline-offset-2 underline transition-opacity hover:opacity-70"
            style={{ color: "var(--color-muted)" }}
          >
            walk away
          </button>
        </div>

        {/* ── RIGHT — Response options + close ─────────────────────────── */}
        <div className="relative flex min-w-0 flex-1 flex-col gap-1 overflow-y-auto px-3 py-2 pr-8">
          {/* Close button — top right */}
          <button
            onClick={() => clear()}
            aria-label="Close dialogue"
            className="absolute right-1.5 top-1.5 z-50 rounded-sm p-1 transition-colors hover:bg-white/10"
            style={{ color: "var(--color-muted)" }}
          >
            <X className="size-3" />
          </button>

          {options.map((option) => {
            const locked = typeof option.charisma_required === "number" && charisma < option.charisma_required;
            const color  = TONE_COLORS[option.tone];
            const label  = TONE_LABELS[option.tone];

            return (
              <button
                key={option.id}
                disabled={locked}
                onClick={() => !locked && handleOption(option)}
                className="flex w-full items-center gap-2 rounded-sm px-2.5 py-1.5 text-left transition-opacity"
                style={{
                  fontSize:        "0.85rem",
                  backgroundColor: locked
                    ? "color-mix(in srgb, var(--color-muted) 6%, transparent)"
                    : `color-mix(in srgb, ${color} 10%, transparent)`,
                  border:  `1px solid ${locked ? "color-mix(in srgb, var(--color-border) 80%, transparent)" : color}`,
                  cursor:  locked ? "not-allowed" : "pointer",
                  opacity: locked ? 0.5 : 1,
                }}
              >
                {/* Tone dot */}
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: locked ? "var(--color-muted)" : color }}
                  title={label}
                />

                {/* Tone label — visible from 480px and up, hidden on narrow mobile */}
                <span
                  className="hidden shrink-0 text-[9px] font-bold uppercase tracking-wider min-[480px]:inline"
                  style={{ color: locked ? "var(--color-muted)" : color, minWidth: "62px" }}
                >
                  {label}
                </span>

                {/* Option text */}
                <span
                  className="min-w-0 flex-1 truncate font-mono leading-snug"
                  style={{
                    color:    locked ? "var(--color-muted)" : "var(--color-text)",
                    fontSize: "0.85rem",
                  }}
                >
                  {option.text}
                </span>

                {/* CHA lock badge */}
                {locked && typeof option.charisma_required === "number" && (
                  <span
                    className="ml-auto flex shrink-0 items-center gap-0.5 text-[9px] uppercase tracking-wide"
                    style={{ color: "var(--color-muted)" }}
                  >
                    <Lock className="size-2.5" />
                    CHA {option.charisma_required}
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
    </>
  );
}
