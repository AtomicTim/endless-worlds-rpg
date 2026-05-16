"use client";

import { useEffect, useState } from "react";
import type { Genre } from "@/types/game";

/**
 * Day 23.5D — WorldIntroModal.
 *
 * Cinematic full-screen overlay shown once at the start of a fresh
 * game, replacing the in-feed NARRATIVE world_intro beat. No close
 * button, no header. Dismissed by clicking anywhere on the overlay
 * or pressing any key.
 *
 * Fade-in sequence (opacity only — no transforms, no slides):
 *   1. Overlay      : 0 → 1 over 800ms on mount
 *   2. World name   : fade in (200ms) at 800ms
 *   3. Prose + hint : fade in (400ms) at 1200ms
 */

interface Props {
  worldName:  string;
  worldIntro: string;
  // Accepted for future genre-specific theming; current implementation
  // relies on the inherited CSS variables (data-genre on the game page).
  genre:      Genre;
  onDismiss:  () => void;
}

export default function WorldIntroModal({
  worldName,
  worldIntro,
  genre,
  onDismiss,
}: Props) {
  // Accept the genre prop for the API contract; current visual design
  // relies on inherited CSS variables, so we mark it as intentionally
  // unused without disabling the no-unused-vars rule globally.
  void genre;

  const [overlayVisible, setOverlayVisible] = useState(false);
  const [nameVisible,    setNameVisible]    = useState(false);
  const [proseVisible,   setProseVisible]   = useState(false);

  useEffect(() => {
    // Fade-in cascade — schedule each layer's opacity flip. All
    // timeouts are tracked and cleared on unmount.
    const t0 = setTimeout(() => setOverlayVisible(true), 20);   // overlay 0 → 1
    const t1 = setTimeout(() => setNameVisible(true),    800);  // world name reveal
    const t2 = setTimeout(() => setProseVisible(true),   1200); // prose + hint

    // Any-key dismiss.
    const onKey = () => onDismiss();
    window.addEventListener("keydown", onKey);

    return () => {
      clearTimeout(t0);
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener("keydown", onKey);
    };
  }, [onDismiss]);

  return (
    <div
      onClick={onDismiss}
      role="dialog"
      aria-modal="true"
      aria-label="World introduction"
      style={{
        position:       "fixed",
        inset:          0,
        zIndex:         60,
        cursor:         "pointer",
        opacity:        overlayVisible ? 1 : 0,
        transition:     "opacity 800ms ease-out",
        backgroundColor: "rgba(0, 0, 0, 0.92)",
        backgroundImage:
          "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.6) 100%)",
      }}
    >
      <div
        className="ew-world-intro-modal"
        style={{
          maxWidth:      "640px",
          margin:        "0 auto",
          padding:       "3rem 2rem",
          minHeight:     "100%",
          display:       "flex",
          flexDirection: "column",
          alignItems:    "center",
          justifyContent: "center",
          pointerEvents: "none",
        }}
      >
        {/* World name — UI-fix-A: prose/title context uses Cormorant
            Garamond italic per the three-font rule. Was font-mono
            (Courier) which read flat and modern; serif italic gives
            the cinematic warmth the world reveal calls for. */}
        <div
          className="text-3xl sm:text-4xl text-center text-glow ew-serif italic"
          style={{
            color:          "var(--color-primary)",
            fontWeight:     500,
            marginBottom:   "1.5rem",
            opacity:        nameVisible ? 1 : 0,
            transition:     "opacity 200ms ease-out",
          }}
        >
          {worldName}
        </div>

        {/* World intro prose — italic-serif via ew-serif, mirroring the
            in-feed style this modal replaces.
            UI-fix-J 4a — fontSize "0.9rem" (≈14.4px) → 15px. Brief
              calls for 15-16px minimum on the cinematic; the prior
              value sat below the readability floor on the dark
              backdrop.
            UI-fix-J 4b — color var(--color-text) (≈#e8dfd1, the
              near-white prose ink) → #c0a878, the warm amber NarrativeBlock
              uses for story prose (design-reference §2/§5). The white
              read sterile; the amber gives the cinematic the warmth
              its source material has.
            UI-fix-J 4b — opacity dimmed from .85 → 1. The explicit
              warm colour now carries the tone; no opacity tax needed.
            UI-fix-J 4d — dropped the ew-world-intro className. The
              class was never defined in globals.css (was a stale
              hook from an earlier draft). */}
        <div
          className="ew-serif text-center"
          style={{
            fontStyle:    "italic",
            fontSize:     15,
            lineHeight:   1.8,
            color:        "#c0a878",
            opacity:      proseVisible ? 1 : 0,
            transition:   "opacity 400ms ease-out",
            maxWidth:     "540px",
            whiteSpace:   "pre-wrap",
          }}
        >
          {worldIntro}
        </div>
      </div>

      {/* Hint — anchored to the bottom of the viewport. UI-fix-A:
          UI chrome label uses Inter Tight (var(--sans)), uppercase
          + tracking. Was font-mono (Courier).
          UI-fix-J 4c — colour var(--color-muted) (= --ink-4 #6e6557)
          → #6a5530, the standard UI muted tone used across the
          design system. The prior value sat too close to the
          backdrop to read against the radial-gradient fade at the
          edges; #6a5530 is consistent with the muted UI-chrome
          ink used by step labels in the wizard. */}
      <div
        className="ew-sans animate-pulse text-center"
        style={{
          position:      "absolute",
          left:          0,
          right:         0,
          bottom:        "2rem",
          fontSize:      "0.7rem",
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color:         "#6a5530",
          opacity:       proseVisible ? 1 : 0,
          transition:    "opacity 400ms ease-out",
          pointerEvents: "none",
        }}
      >
        Click anywhere to begin
      </div>
    </div>
  );
}
