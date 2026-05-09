"use client";

import React from "react";

/**
 * Day 20 Combat — reserved portrait slot.
 *
 * Day 20 ships with a placeholder (single-letter glyph in a bordered
 * frame). Real portrait images drop in via the optional `portraitUrl`
 * prop without changing layout. Sized to ~128×128 with `aspect-square`
 * so the parent flex/grid sets the actual pixel dimensions.
 */
interface Props {
  name:           string;
  isPlayer?:      boolean;
  isBoss?:        boolean;
  isTargetable?:  boolean;
  /** Triggers the .combat-portrait-shake animation (~400ms). */
  shake?:         boolean;
  /** Future-ready: render an <img> when provided. Not used Day 20. */
  portraitUrl?:   string | null;
}

export function PortraitSlot({
  name, isPlayer, isBoss, isTargetable, shake, portraitUrl,
}: Props) {
  const initial = (name?.[0] ?? "?").toUpperCase();

  // Border color: boss = accent gold; player = combat-player teal;
  // enemy = combat-enemy red; targetable enemy gets a stronger glow.
  const borderColor = isBoss
    ? "var(--accent)"
    : isPlayer
      ? "var(--combat-player)"
      : isTargetable
        ? "var(--combat-enemy-crit)"
        : "var(--combat-enemy)";

  return (
    <div
      className={shake ? "combat-portrait-shake" : undefined}
      style={{
        width:           "100%",
        aspectRatio:     "1 / 1",
        maxWidth:        128,
        background:      "var(--bg-2)",
        border:          `2px solid ${borderColor}`,
        borderRadius:    4,
        display:         "flex",
        alignItems:      "center",
        justifyContent:  "center",
        position:        "relative",
        boxShadow:       isTargetable
          ? "0 0 0 2px color-mix(in srgb, var(--combat-enemy-crit) 35%, transparent)"
          : undefined,
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
      ) : (
        <span
          style={{
            fontFamily:    "var(--serif)",
            fontSize:      "min(48px, 50%)",
            color:         borderColor,
            opacity:       0.55,
            letterSpacing: "0.02em",
            fontWeight:    600,
          }}
        >
          {initial}
        </span>
      )}
    </div>
  );
}
