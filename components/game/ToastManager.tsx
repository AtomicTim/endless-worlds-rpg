"use client";

import React, { useEffect, useState } from "react";
import { Book, CheckCircle, ArrowUpCircle, ShieldCheck, type LucideIcon } from "lucide-react";
import { useGameStore } from "@/lib/stores/game-store";
import type { ToastEntry, ToastType } from "@/lib/stores/game-store";

/**
 * UI-11 — Toast notifications.
 *
 * Section 14 of /docs/ui-design-reference.md. A fixed-position stack
 * of ephemeral cards. Max 2 visible at once (a 3rd push displaces
 * the oldest). Per-type persist durations + colours + icons.
 *
 * Mount once at the root of the game view (app/game/page.tsx).
 * Renders null until a toast is queued. The store owns the queue
 * (useGameStore.toasts); this component owns rendering + auto-
 * dismiss timing.
 *
 * Animation choreography:
 *   Enter — .toast-enter class (translateY(18→0) + opacity 0→1,
 *           250ms cubic-bezier(0.22,1,0.36,1)).
 *   Exit  — .toast-exit class (opacity 1→0, 200ms ease-in) set by
 *           this component when the persist timer fires; the store
 *           dismissal happens 200ms later so the exit animation
 *           plays to completion before the DOM node unmounts.
 *
 * Per-type config:
 *   codex          #c4943a · ti-book           · 3500ms
 *   quest_complete #5a9a5a · ti-circle-check   · 3500ms
 *   level_up       #e8d070 · ti-arrow-up-circle· 4000ms
 *   combat_result  #7abb7a · ti-shield-check   · 3500ms
 */

const TYPE_CONFIG: Record<
  ToastType,
  {
    accent:   string;
    duration: number;
    Icon:     LucideIcon;
  }
> = {
  codex:          { accent: "#c4943a", duration: 3500, Icon: Book },
  quest_complete: { accent: "#5a9a5a", duration: 3500, Icon: CheckCircle },
  level_up:       { accent: "#e8d070", duration: 4000, Icon: ArrowUpCircle },
  combat_result:  { accent: "#7abb7a", duration: 3500, Icon: ShieldCheck },
};

/** Toast exit animation length — matches the .toast-exit keyframe
 *  in globals.css (200ms ease-in). */
const EXIT_MS = 200;

export function ToastManager() {
  const toasts        = useGameStore((s) => s.toasts);
  const dismissToast  = useGameStore((s) => s.dismissToast);
  // Track which toast ids are currently exiting so we can layer the
  // .toast-exit class onto their card before the store removes them.
  const [exiting, setExiting] = useState<Record<string, boolean>>({});

  // Render only the latest 2 toasts visually; older entries in the
  // queue stay in state until their persist timer fires (or new
  // pushes evict them via the store's 3-cap).
  const visible = toasts.slice(-2);

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position:       "fixed",
        right:          16,
        bottom:         50,
        zIndex:         30,
        display:        "flex",
        flexDirection:  "column",
        gap:            8,
        pointerEvents:  "none", // toasts are non-interactive; player keeps tapping under them.
      }}
    >
      {visible.map((t) => (
        <ToastCard
          key={t.id}
          toast={t}
          isExiting={exiting[t.id] === true}
          onPersistDone={() => {
            // Start the exit animation; remove from the store after
            // EXIT_MS so the .toast-exit keyframe plays to completion.
            setExiting((prev) => ({ ...prev, [t.id]: true }));
            window.setTimeout(() => {
              dismissToast(t.id);
              setExiting((prev) => {
                const next = { ...prev };
                delete next[t.id];
                return next;
              });
            }, EXIT_MS);
          }}
        />
      ))}
    </div>
  );
}

interface ToastCardProps {
  toast:         ToastEntry;
  isExiting:     boolean;
  onPersistDone: () => void;
}

function ToastCard({ toast, isExiting, onPersistDone }: ToastCardProps) {
  const config = TYPE_CONFIG[toast.type];

  // Persist timer — fires once per toast id. The store-level cap
  // ensures a given id never re-enters the queue, so a single
  // useEffect run is sufficient.
  useEffect(() => {
    const handle = window.setTimeout(onPersistDone, config.duration);
    return () => window.clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast.id]);

  return (
    <div
      className={isExiting ? "toast-exit" : "toast-enter"}
      role="alert"
      style={{
        position:       "relative",
        display:        "flex",
        alignItems:     "center",
        gap:            10,
        minWidth:       220,
        maxWidth:       320,
        padding:        "10px 14px",
        paddingLeft:    14 + 3, // leave space for the 3px left accent bar
        background:     "var(--card-bg)",
        border:         "1px solid rgba(var(--genre-accent-rgb), .3)",
        borderRadius:   "var(--card-radius)",
        boxShadow:      "var(--card-shadow)",
        overflow:       "hidden",
        pointerEvents:  "auto",
      }}
    >
      {/* 3px left accent bar — coloured per toast type. */}
      <span
        aria-hidden
        style={{
          position:   "absolute",
          left:       0,
          top:        0,
          bottom:     0,
          width:      3,
          background: config.accent,
        }}
      />
      <config.Icon size={16} color={config.accent} aria-hidden />
      <span
        className="ew-serif italic"
        style={{
          fontSize:   13,
          color:      "#d4bc88",
          lineHeight: 1.4,
          flex:       1,
          minWidth:   0,
          overflow:   "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {toast.message}
      </span>
    </div>
  );
}
