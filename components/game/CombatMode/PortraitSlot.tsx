"use client";

import React from "react";

/**
 * Day 20 Combat — reserved portrait slot.
 *
 * PR-11v-a HF1 — placeholder rewritten as a styled circular badge.
 * Player: genre-accent tinted circle with the player's first initial
 * in a mono serif glyph. Enemy: red-tinted circle with a skull SVG.
 * Both retain the `shake` and `isTargetable` affordances. The
 * portraitUrl branch still renders an <img> when a real portrait is
 * provided (future-ready).
 *
 * The circle scales with the card width up to a 72px cap so it
 * keeps a readable footprint at 4-enemy density without shrinking
 * under the FloatingDamage anchor.
 */
interface Props {
  name:           string;
  isPlayer?:      boolean;
  isBoss?:        boolean;
  isTargetable?:  boolean;
  /** Triggers the .combat-portrait-shake animation (~400ms). */
  shake?:         boolean;
  /** Future-ready: render an <img> when provided. */
  portraitUrl?:   string | null;
}

function SkullIcon() {
  // 32×32 cranium + jaw + eye sockets + nose cavity + teeth. Single
  // stroke colour (#c84830) to match the enemy badge border.
  return (
    <svg
      width={32}
      height={32}
      viewBox="0 0 32 32"
      fill="none"
      stroke="#c84830"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* Cranium + jaw silhouette */}
      <path d="M16 4 C9.5 4 5 9 5 14.5 C5 18 6.5 20.5 8.5 22 V25 H11 V23 H13 V25 H15.5 V23 H16.5 V25 H19 V23 H21 V25 H23.5 V22 C25.5 20.5 27 18 27 14.5 C27 9 22.5 4 16 4 Z" />
      {/* Left eye socket */}
      <circle cx="11.5" cy="15" r="2.5" />
      {/* Right eye socket */}
      <circle cx="20.5" cy="15" r="2.5" />
      {/* Nose cavity */}
      <path d="M16 18 L14.5 21 L16 22 L17.5 21 Z" />
      {/* Tooth dividers (jaw line) */}
      <path d="M11 23 H21" />
    </svg>
  );
}

export function PortraitSlot({
  name, isPlayer, isTargetable, shake, portraitUrl,
}: Props) {
  // Player initial — uppercase first letter of name. Defensive fallback
  // for empty strings so the badge never renders blank.
  const initial = (name?.[0] ?? "?").toUpperCase();

  // PR-11v-a HF1 — colour band per role. Player uses the live genre
  // accent so the portrait tints with the active world; enemy is a
  // dimmed muted-red regardless of boss state (boss tells live on the
  // card border + name prefix in CombatantRow).
  const bg = isPlayer
    ? "rgba(var(--genre-accent-rgb), 0.18)"
    : "rgba(180, 60, 60, 0.18)";
  const border = isPlayer
    ? "2px solid rgba(var(--genre-accent-rgb), 0.55)"
    : "2px solid rgba(180, 60, 60, 0.45)";

  // PR-11v-a HF1 — targetable glow stays as an outer box-shadow so it
  // reads as an interactive ring without recolouring the badge fill.
  const targetableGlow = isTargetable
    ? "0 0 0 2px color-mix(in srgb, var(--combat-enemy-crit) 35%, transparent)"
    : undefined;
  const baseShadow = "0 2px 8px rgba(0,0,0,0.35)";
  const boxShadow  = targetableGlow
    ? `${baseShadow}, ${targetableGlow}`
    : baseShadow;

  return (
    <div
      className={shake ? "combat-portrait-shake" : undefined}
      style={{
        width:           "100%",
        aspectRatio:     "1 / 1",
        maxWidth:        72,
        margin:          "0 auto",
        background:      bg,
        border,
        borderRadius:    "50%",
        display:         "flex",
        alignItems:      "center",
        justifyContent:  "center",
        position:        "relative",
        boxShadow,
        transition:      "box-shadow 120ms",
        overflow:        "hidden",
      }}
    >
      {portraitUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={portraitUrl}
          alt={name}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : isPlayer ? (
        <span
          style={{
            fontFamily: "var(--mono)",
            fontSize:   28,
            fontWeight: 700,
            color:      "var(--genre-accent)",
            lineHeight: 1,
          }}
        >
          {initial}
        </span>
      ) : (
        <SkullIcon />
      )}
    </div>
  );
}
