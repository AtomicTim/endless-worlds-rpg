"use client";

import React from "react";
import type { ActiveStatusEffect, StatusEffectId } from "@/types/game";
import {
  getStatusDisplayName,
  type WcdStatusAliasSource,
} from "@/lib/game/combat-narration/status-display";

/**
 * Prompt 5 — active status effect pills, rendered below the player's
 * HP bar in combat. One small chip per active effect: display name +
 * rounds-remaining count.
 *
 * Colour coding (locked Prompt 5):
 *   ailments — solid colored background, dark text
 *   buffs    — outlined / ghost style, lighter appearance
 *
 * Display name resolves through the WCD status_effect_alias map when
 * one is supplied (the "rootblight" rule), else the capitalized
 * canonical id.
 */

interface StatusVisual {
  color: string;
  /** true = buff (ghost/outline), false = ailment (solid fill). */
  buff:  boolean;
}

// PR-2: hex-based token substitution preserves the visual output of every
// pill exactly. The token names below match the brief's hex→token map, not
// the row labels — e.g. `fortified` consumes --status-poisoned because the
// fortified pill was authored as #86efac (now the canonical poisoned tone).
// A future semantic-rename PR can realign labels to tokens once both sides
// are tokenised.
const STATUS_VISUALS: Record<StatusEffectId, StatusVisual> = {
  poisoned:   { color: "#a3e635",                  buff: false },
  burning:    { color: "var(--status-burning)",    buff: false },
  chilled:    { color: "var(--status-chilled)",    buff: false },
  weakened:   { color: "var(--status-weakened)",   buff: false },
  frightened: { color: "var(--status-frightened)", buff: false },
  fortified:  { color: "var(--status-poisoned)",   buff: true  },
  hastened:   { color: "var(--status-fortified)",  buff: true  },
  focused:    { color: "var(--status-hastened)",   buff: true  },
};

/** Defensive fallback for an unknown id (forward-compat). */
const FALLBACK_VISUAL: StatusVisual = { color: "var(--status-weakened)", buff: false };

interface Props {
  effects: ActiveStatusEffect[];
  wcd?:    WcdStatusAliasSource;
}

export function StatusEffectPills({ effects, wcd }: Props) {
  if (effects.length === 0) return null;

  return (
    <div
      style={{
        width:          "100%",
        display:        "flex",
        flexWrap:       "wrap",
        gap:            4,
        justifyContent: "center",
        marginTop:      2,
      }}
    >
      {effects.map((e) => {
        const v    = STATUS_VISUALS[e.id] ?? FALLBACK_VISUAL;
        const name = getStatusDisplayName(e.id, wcd);

        const base: React.CSSProperties = {
          fontFamily:    "var(--mono)",
          fontSize:      10,
          lineHeight:    1.4,
          letterSpacing: "0.04em",
          borderRadius:  9999,
          padding:       "1px 8px",
          whiteSpace:    "nowrap",
          display:       "inline-flex",
          alignItems:    "center",
          gap:           4,
        };
        const style: React.CSSProperties = v.buff
          ? {
              // Buff — outlined / ghost.
              ...base,
              background: "transparent",
              border:     `1px solid ${v.color}`,
              color:      v.color,
            }
          : {
              // Ailment — solid fill, dark text.
              ...base,
              background: v.color,
              border:     `1px solid ${v.color}`,
              color:      "#1a1a1a",
            };

        return (
          <span
            key={e.id}
            style={style}
            title={`${name} — ${e.rounds_remaining} round${e.rounds_remaining === 1 ? "" : "s"} left`}
          >
            {name}
            <span style={{ opacity: 0.7, fontWeight: 600 }}>
              {e.rounds_remaining}
            </span>
          </span>
        );
      })}
    </div>
  );
}
