"use client";

import React from "react";
import { Save } from "lucide-react";
import { Genre } from "@/types/game";
import type { WorldGraph } from "@/types/game";
import { useGameStore } from "@/lib/stores/game-store";
import { genreSlug, GENRE_LABEL } from "@/lib/game/genre-slug";
import { UserMenu } from "@/components/layout/UserMenu";

/**
 * UI-2 — Top bar.
 *
 * Section 17 of /docs/ui-design-reference.md. Dark chrome (#141210)
 * in all genres; only the logo, genre pill, character-pill border,
 * verbosity-active segment, loading dot, and icon hover-state pick
 * up the per-genre accent via var(--genre-accent) (UI-1).
 *
 * Wiring is read-only from the store — no new state. The existing
 * verbosity store action, codex / journal / map modal toggles, and
 * the mobile sidebar local state are reused as-is.
 *
 * Hiding on main menu / character creation is handled by composition
 * (GameLayout only mounts on /game; /dashboard and /game/new don't
 * render it).
 */

export interface TopBarProps {
  genre: Genre;
  /** True when the GameLayout caller wired a map panel. The MAP icon
   *  is suppressed when false so there's no dead button. */
  mapPanelAvailable: boolean;
  /** Toggles the mobile right-side character drawer. On desktop the
   *  character sidebar is always visible, so this is a no-op
   *  effect-wise — kept identical for layout symmetry. */
  onToggleSidebar: () => void;
  /** Existing Save & Exit handler from GameLayout. Kept rendered as
   *  an additive desktop-only button — Section 17 doesn't list it
   *  but removing it would be a UX regression with no replacement
   *  path yet (UI-13 / Main Menu lands later). */
  onSaveAndExit: () => void;
  /** Mirror of GameLayout's `saveState` so the button label can flip
   *  through SAVE → SAVING… → SAVED ✓. */
  saveLabel: "SAVE" | "SAVING…" | "SAVED ✓";
  /** Disable the save button during the in-flight + post-save window
   *  (matches the existing GameLayout behaviour). */
  saveDisabled: boolean;
}

const ACCENT       = "var(--genre-accent)";
const BAR_BG       = "#141210";
const BAR_BORDER   = "#2d2618";
const BREADCRUMB   = "#6a5530";
const BREADCRUMB_D = "#4a3818";
const ICON_REST    = "#7a6040";

/** Build the breadcrumb parts (Region › Settlement › Current).
 *  Mirrors NavigationBar.buildBreadcrumb's shape — kept private here
 *  so NavigationBar stays untouched. Returns whatever levels are
 *  available; the renderer joins with styled separators. */
function buildBreadcrumbParts(worldGraph: WorldGraph | undefined): string[] {
  if (!worldGraph) return [];
  const current = worldGraph.nodes[worldGraph.current_node_id];
  if (!current) return [];

  const parts: string[] = [];
  const isRegionZone =
    current.type === "zone" &&
    current.is_expandable === true &&
    current.zone_id === current.id;

  if (isRegionZone) {
    parts.push(current.name);
  } else if (current.zone_id && current.zone_id !== current.id) {
    const parent = worldGraph.nodes[current.zone_id];
    if (parent) {
      const grandparentId =
        parent.zone_id && parent.zone_id !== parent.id ? parent.zone_id : null;
      const grandparent = grandparentId ? worldGraph.nodes[grandparentId] : null;
      if (grandparent) parts.push(grandparent.name);
      parts.push(parent.name);
    }
    parts.push(current.name);
  } else {
    parts.push(current.name);
  }
  return parts;
}

export function TopBar({
  genre,
  mapPanelAvailable,
  onToggleSidebar,
  onSaveAndExit,
  saveLabel,
  saveDisabled,
}: TopBarProps) {
  // ── State reads ──────────────────────────────────────────────────────────
  const masterState        = useGameStore((s) => s.masterState);
  const verbosity          = useGameStore((s) => s.verbosity);
  const setVerbosity       = useGameStore((s) => s.setVerbosity);
  const toggleCodexModal   = useGameStore((s) => s.toggleCodexModal);
  const toggleJournalModal = useGameStore((s) => s.toggleJournalModal);
  const toggleMapPanel     = useGameStore((s) => s.toggleMapPanel);
  const generatingRegion   = useGameStore((s) => s.generatingRegionId);

  const slug      = genreSlug(genre);
  const genreText = GENRE_LABEL[slug] ?? "FANTASY";
  const playerName = masterState?.player_state.name ?? "Adventurer";
  const initials =
    playerName
      .split(/\s+/)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("")
      .slice(0, 2) || "??";

  const breadcrumbParts = buildBreadcrumbParts(masterState?.world_graph);
  const loading = generatingRegion !== null;

  return (
    <header
      role="banner"
      className={[
        "flex items-center gap-2 px-3 shrink-0 border-b",
        "h-[52px] md:h-11", // UI design ref §4 / §17: 52px mobile, 44px desktop
      ].join(" ")}
      style={{ background: BAR_BG, borderBottomColor: BAR_BORDER }}
    >
      {/* ── A. Logo ────────────────────────────────────────────────────── */}
      <div
        aria-label="Endless Worlds"
        className="shrink-0 italic font-medium"
        style={{
          fontFamily: "var(--serif)",
          fontSize:   14,
          color:      ACCENT,
          letterSpacing: "0.01em",
        }}
      >
        ✦ Endless Worlds
      </div>

      {/* ── B. Genre tag pill (desktop only per Section 17 mobile rules) ─ */}
      <div
        className="hidden md:inline-flex shrink-0 items-center uppercase"
        style={{
          fontFamily:     "var(--sans)",
          fontSize:       7,
          letterSpacing:  "0.12em",
          padding:        "2px 8px",
          borderRadius:   20,
          color:          ACCENT,
          background:     "color-mix(in srgb, var(--genre-accent) 12%, transparent)",
          border:         "1px solid color-mix(in srgb, var(--genre-accent) 28%, transparent)",
        }}
      >
        {genreText}
      </div>

      {/* ── C. Breadcrumb (desktop only) ──────────────────────────────── */}
      {breadcrumbParts.length > 0 && (
        <div
          aria-label="Location breadcrumb"
          className="hidden md:flex min-w-0 items-center overflow-hidden whitespace-nowrap"
          style={{
            fontFamily:    "var(--sans)",
            fontSize:      8,
            letterSpacing: "0.08em",
            color:         BREADCRUMB,
            textOverflow:  "ellipsis",
          }}
        >
          {breadcrumbParts.map((p, i) => (
            <React.Fragment key={`${i}-${p}`}>
              {i > 0 && (
                <span
                  aria-hidden
                  className="mx-1.5"
                  style={{ color: BREADCRUMB_D }}
                >
                  ›
                </span>
              )}
              <span className="truncate" style={{ maxWidth: 180 }}>
                {p}
              </span>
            </React.Fragment>
          ))}
        </div>
      )}

      {/* ── D. flex-1 spacer ─────────────────────────────────────────── */}
      <div className="flex-1" />

      {/* ── E. Background loading dot (desktop + mobile) ─────────────── */}
      <div
        aria-label={loading ? "Background generation in progress" : undefined}
        aria-hidden={!loading}
        className="shrink-0"
        style={{
          width:     6,
          height:    6,
          borderRadius: "50%",
          background:   ACCENT,
          opacity:      loading ? 1 : 0,
          animation:    loading ? "ew-loading-dot 1.6s ease-in-out infinite" : "none",
          transition:   "opacity 200ms ease",
        }}
      />

      {/* ── F. Verbosity toggle (desktop only) ───────────────────────── */}
      <div
        role="group"
        aria-label="Narrator verbosity"
        className="hidden md:inline-flex shrink-0 items-stretch overflow-hidden"
        style={{
          border:       `1px solid ${BAR_BORDER}`,
          borderRadius: 4,
          fontFamily:   "var(--sans)",
        }}
      >
        {(["terse", "standard", "rich"] as const).map((key) => {
          const active = verbosity === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setVerbosity(key)}
              aria-pressed={active}
              className="uppercase transition-colors min-h-[44px] md:min-h-0"
              style={{
                fontSize:      7,
                letterSpacing: "0.12em",
                padding:       "3px 7px",
                color:         active ? ACCENT : BREADCRUMB_D,
                background:    active
                  ? "color-mix(in srgb, var(--genre-accent) 14%, transparent)"
                  : "transparent",
                borderLeft:    key === "terse" ? "none" : `1px solid ${BAR_BORDER}`,
              }}
            >
              {key[0].toUpperCase() + key.slice(1)}
            </button>
          );
        })}
      </div>

      {/* ── G. Icon buttons — Codex · Journal · Map ──────────────────── */}
      <IconButton ariaLabel="Open codex" onClick={() => toggleCodexModal()}>
        <CodexIcon />
      </IconButton>
      <IconButton ariaLabel="Open journal" onClick={() => toggleJournalModal()}>
        <JournalIcon />
      </IconButton>
      {mapPanelAvailable && (
        <IconButton ariaLabel="Open map" onClick={() => toggleMapPanel()}>
          <MapIcon />
        </IconButton>
      )}

      {/* ── H. Character pill ────────────────────────────────────────── */}
      <button
        type="button"
        onClick={onToggleSidebar}
        aria-label="Open character panel"
        className="group shrink-0 inline-flex items-center gap-2 transition-colors min-h-[44px] md:min-h-0"
        style={{ background: "transparent", padding: "2px 4px" }}
      >
        <span
          aria-hidden
          className="inline-flex items-center justify-center font-medium"
          style={{
            width:         28,
            height:        28,
            borderRadius:  "50%",
            border:        `1.5px solid ${ACCENT}`,
            color:         ACCENT,
            fontFamily:    "var(--mono)",
            fontSize:      10,
            letterSpacing: "0.06em",
            background:    "color-mix(in srgb, var(--genre-accent) 10%, transparent)",
          }}
        >
          {initials}
        </span>
        <span
          className="hidden md:inline truncate"
          style={{
            fontFamily:    "var(--sans)",
            fontSize:      8,
            letterSpacing: "0.10em",
            color:         "#a08870",
            maxWidth:      80,
            textTransform: "uppercase",
          }}
        >
          {playerName}
        </span>
      </button>

      {/* ── Additive: Save & Exit (desktop) + UserMenu — preserves
              functionality the redesign spec doesn't yet replace. ──── */}
      <DesktopSave
        label={saveLabel}
        disabled={saveDisabled}
        onClick={onSaveAndExit}
      />
      <div className="shrink-0 hidden sm:block">
        <UserMenu />
      </div>
      <div className="shrink-0 flex items-center sm:hidden">
        <UserMenu />
      </div>

      {/* Keyframes — kept inline so the keyframe lives with the dot it
          drives. No globals.css touch (which is restricted to Story
          Feed Colors token system constraints from UI-1). */}
      <style jsx>{`
        @keyframes ew-loading-dot {
          0%, 100% { opacity: 0.4; }
          50%      { opacity: 1; }
        }
      `}</style>
    </header>
  );
}

// ── Internal pieces ─────────────────────────────────────────────────────────

interface IconButtonProps {
  ariaLabel: string;
  onClick:   () => void;
  children:  React.ReactNode;
}
function IconButton({ ariaLabel, onClick, children }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      title={ariaLabel}
      onClick={onClick}
      className="group shrink-0 inline-flex items-center justify-center transition-colors min-w-[44px] min-h-[44px] md:min-w-7 md:min-h-7"
      style={{ color: ICON_REST }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = ACCENT; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = ICON_REST; }}
      onFocus={(e)      => { (e.currentTarget as HTMLButtonElement).style.color = ACCENT; }}
      onBlur={(e)       => { (e.currentTarget as HTMLButtonElement).style.color = ICON_REST; }}
    >
      {children}
    </button>
  );
}

/** Codex icon — book glyph (matches existing GameLayout SVG). */
function CodexIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 14 14" aria-hidden>
      <path
        d="M 2 2 L 7 1 L 12 2 L 12 12 L 7 11 L 2 12 Z M 7 1 L 7 11"
        stroke="currentColor"
        strokeWidth="1.1"
        fill="none"
      />
    </svg>
  );
}

/** Journal icon — open-book glyph. */
function JournalIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 14 14" aria-hidden>
      <path
        d="M 7 2 L 2 3 L 2 12 L 7 11 L 12 12 L 12 3 L 7 2 Z M 7 2 L 7 11"
        stroke="currentColor"
        strokeWidth="1.1"
        fill="none"
      />
      <path
        d="M 3.5 6 L 6 5.7 M 3.5 8 L 6 7.7 M 8 5.7 L 10.5 6 M 8 7.7 L 10.5 8"
        stroke="currentColor"
        strokeWidth="0.6"
        opacity="0.55"
      />
    </svg>
  );
}

/** Map icon — zig-zag terrain glyph. */
function MapIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 14 14" aria-hidden>
      <path
        d="M 1 3 L 5 5 L 9 3 L 13 5 L 13 11 L 9 9 L 5 11 L 1 9 Z"
        stroke="currentColor"
        strokeWidth="1.1"
        fill="none"
      />
    </svg>
  );
}

interface SaveProps {
  label:    "SAVE" | "SAVING…" | "SAVED ✓";
  disabled: boolean;
  onClick:  () => void;
}
function DesktopSave({ label, disabled, onClick }: SaveProps) {
  const saved = label === "SAVED ✓";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="hidden md:inline-flex shrink-0 items-center gap-1.5 transition-colors"
      style={{
        fontFamily:    "var(--sans)",
        fontSize:      8,
        letterSpacing: "0.12em",
        padding:       "4px 8px",
        border:        `1px solid ${BAR_BORDER}`,
        borderRadius:  3,
        color:         saved ? "var(--hl-pass)" : ICON_REST,
        background:    "transparent",
        textTransform: "uppercase",
        opacity:       disabled && !saved ? 0.6 : 1,
        cursor:        disabled ? "not-allowed" : "pointer",
      }}
    >
      <Save className="size-3" aria-hidden />
      {label}
    </button>
  );
}

