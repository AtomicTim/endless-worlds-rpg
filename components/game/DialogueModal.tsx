"use client";

import { Lock } from "lucide-react";
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
 * Dialogue Modal — slides in above the InputBar when an NPC interaction
 * produces response options. Shows the NPC portrait on the left (if available)
 * and a column of response buttons on the right.
 *
 * Each option is submitted as a quoted string ("text") so the game loop routes
 * it through the DIALOGUE path automatically.
 */
export function DialogueModal({ onSubmit, onFocusInput }: DialogueModalProps) {
  const options  = useGameStore((s) => s.currentDialogueOptions);
  const npcName  = useGameStore((s) => s.currentDialogueNpc);
  const portrait = useGameStore((s) => s.currentNpcPortrait);
  const charisma = useGameStore((s) => s.masterState?.player_state.attributes.charisma ?? 10);
  const clear    = useGameStore((s) => s.clearDialogueOptions);

  // Hidden when there are no options — zero height, no layout impact.
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
    <div
      className="shrink-0 overflow-hidden"
      style={{
        height:          "280px",
        borderTop:       "3px solid var(--color-accent)",
        borderBottom:    "1px solid var(--color-border)",
        backgroundColor: "var(--color-bg)",
      }}
    >
      <div className="flex h-full">
        {/* ── LEFT — Portrait + NPC name ─────────────────────────────────── */}
        <div
          className="flex shrink-0 flex-col items-center gap-2 p-3"
          style={{
            width:       "28%",
            borderRight: "1px solid var(--color-border)",
          }}
        >
          {/* Portrait box */}
          <div
            className="overflow-hidden rounded-sm"
            style={{
              width:           "76px",
              height:          "76px",
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
              // Generic silhouette placeholder while portrait loads (or if unavailable)
              <svg viewBox="0 0 76 76" className="h-full w-full" aria-hidden>
                <circle cx="38" cy="26" r="13" fill="var(--color-muted)" opacity="0.35" />
                <ellipse cx="38" cy="56" rx="20" ry="15" fill="var(--color-muted)" opacity="0.35" />
              </svg>
            )}
          </div>

          {/* NPC name */}
          <p
            className="text-center text-[10px] font-bold uppercase tracking-widest leading-tight"
            style={{ color: "var(--color-accent)", maxWidth: "88px", wordBreak: "break-word" }}
          >
            {npcName ?? "???"}
          </p>

          {/* Walk away — small text link at bottom */}
          <button
            onClick={() => clear()}
            className="mt-auto text-[9px] italic underline-offset-2 underline hover:opacity-70 transition-opacity"
            style={{ color: "var(--color-muted)" }}
          >
            walk away
          </button>
        </div>

        {/* ── RIGHT — Response options ────────────────────────────────────── */}
        <div className="flex min-w-0 flex-1 flex-col gap-1.5 overflow-y-auto p-3">
          {options.map((option) => {
            const locked = typeof option.charisma_required === "number" && charisma < option.charisma_required;
            const color  = TONE_COLORS[option.tone];

            return (
              <button
                key={option.id}
                disabled={locked}
                onClick={() => !locked && handleOption(option)}
                className="flex w-full items-start gap-2 rounded-sm px-3 py-2 text-left text-xs transition-opacity"
                style={{
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
                  className="mt-0.5 size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: locked ? "var(--color-muted)" : color }}
                  title={TONE_LABELS[option.tone]}
                />

                {/* Option text */}
                <span
                  className="flex-1 font-mono text-[11px] leading-snug"
                  style={{ color: locked ? "var(--color-muted)" : "var(--color-text)" }}
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
            className="mt-auto w-full rounded-sm px-3 py-1.5 text-center text-[10px] italic transition-opacity hover:opacity-70"
            style={{
              color:  "var(--color-muted)",
              border: "1px dashed color-mix(in srgb, var(--color-border) 70%, transparent)",
            }}
          >
            ✎ type your own response
          </button>
        </div>
      </div>
    </div>
  );
}
