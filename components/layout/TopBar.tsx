"use client";

import React from "react";
import { Save, Menu } from "lucide-react";
import {
  IconBook, IconNotebook, IconMap,
  IconShield, IconEyeOff, IconWand, IconCrosshair, IconMessage,
  IconCpu, IconBriefcase, IconSword, IconHammer, IconGhost,
  IconSearch, IconMoon, IconHeart, IconMask, IconEye,
  IconBadge, IconRocket, IconTool, IconAnchor, IconRadar,
  IconAxe, IconFirstAidKit, IconRun, IconSpeakerphone,
  type Icon as TablerIcon,
} from "@tabler/icons-react";
import { Genre } from "@/types/game";
import type { WorldGraph } from "@/types/game";
import { useGameStore } from "@/lib/stores/game-store";
import { genreSlug, GENRE_LABEL } from "@/lib/game/genre-slug";
import { UserMenu } from "@/components/layout/UserMenu";

/**
 * UI-fix-H — Top bar, Section 17 of /docs/ui-design-reference.md.
 *
 * Dark chrome (#141210) in all genres; only the logo, genre pill,
 * verbosity-active segment, loading dot, icon hover, and character pill
 * pick up the per-genre accent via var(--genre-accent).
 *
 * Hiding on main menu / character creation is by composition: GameLayout
 * mounts the TopBar, and /dashboard + /game/new don't render GameLayout.
 *
 * Wiring is read-only from the store — no new state.
 */

export interface TopBarProps {
  genre: Genre;
  /** True when GameLayout wired a map panel. MAP icon suppressed when false. */
  mapPanelAvailable: boolean;
  /** Toggles the right-side character drawer (mobile). */
  onToggleSidebar: () => void;
  /** Existing Save & Exit handler from GameLayout. */
  onSaveAndExit: () => void;
  /** Mirror of GameLayout's `saveState` for the SAVE label transitions. */
  saveLabel: "SAVE" | "SAVING…" | "SAVED ✓";
  /** Disable save during in-flight + post-save window. */
  saveDisabled: boolean;
  /** Hamburger handler — opens Context Panel left drawer. */
  onOpenContextPanel?: () => void;
}

// ── Tokens ──────────────────────────────────────────────────────────────────
//
// Pure colour literals match Section 17. Per-genre accents flow through
// var(--genre-accent) / var(--genre-accent-rgb) (UI-1 in globals.css).

const ACCENT   = "var(--genre-accent)";
const BAR_BG   = "#141210";
const BAR_BORDER = "#2d2618";

/** Breadcrumb tier colours, per Section 17:
 *  region segment, separator, current location. */
const CRUMB_REGION  = "#5a4828";
const CRUMB_SEP     = "#3a2a18";
const CRUMB_CURRENT = "#a08060";

/** Icon-button rest colour = var(--ink-3) per spec.
 *  ink-3 is defined in globals.css as #a89e8c — wired through the var
 *  so a future ink palette change carries through. */
const ICON_REST = "var(--ink-3)";

/** Verbosity toggle inactive label colour (per spec: #6a5530). */
const VERBOSITY_INACTIVE = "#6a5530";

/** Character pill name colour (per spec: #c0a878). */
const CHAR_NAME = "#c0a878";

// ── Class icon map (mirrors app/dashboard/page.tsx, UI-13) ───────────────
//
// Marine: @tabler/icons-react v3 has no IconShip, so IconAnchor is the
// nearest naval analogue. Scavenger uses IconSearch (shares with
// Investigator) — both are search-themed and the duplication is
// intentional per the verified list in design-reference §9.
const CLASS_ICON: Record<string, TablerIcon> = {
  // Fantasy
  knight: IconShield, rogue: IconEyeOff, mage: IconWand,
  ranger: IconCrosshair, herald: IconMessage,
  // Cyberpunk
  netrunner: IconCpu, fixer: IconBriefcase, street_samurai: IconSword,
  enforcer: IconHammer, ghost: IconGhost,
  // Horror
  investigator: IconSearch, cultist: IconMoon, survivor: IconHeart,
  phantom: IconMask, medium: IconEye,
  // Space Opera
  commander: IconBadge, pilot: IconRocket, engineer: IconTool,
  marine: IconAnchor, recon: IconRadar,
  // Post-Apoc
  scavenger: IconSearch, raider: IconAxe, medic: IconFirstAidKit,
  runner: IconRun, demagogue: IconSpeakerphone,
};

/** Build the breadcrumb parts (Region › Settlement › Current).
 *  Last entry is the current location (rendered in CRUMB_CURRENT);
 *  preceding entries are region/settlement (CRUMB_REGION). */
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
  onOpenContextPanel,
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
  const classId    = masterState?.player_state.background ?? "knight";
  const ClassIcon: TablerIcon = CLASS_ICON[classId] ?? IconShield;

  const breadcrumbParts = buildBreadcrumbParts(masterState?.world_graph);
  const lastCrumbIdx    = breadcrumbParts.length - 1;
  const loading         = generatingRegion !== null;

  return (
    <header
      role="banner"
      className={[
        "flex items-center gap-2 px-3 shrink-0 border-b",
        // §4 / §17: 52px mobile, 44px desktop. Fixed height — never
        // grows with content. min-h pinned so 44px tap-target buttons
        // can't expand the bar.
        "h-[52px] md:h-11",
      ].join(" ")}
      style={{ background: BAR_BG, borderBottomColor: BAR_BORDER }}
    >
      {/* ── Mobile hamburger (Context Panel drawer) ──────────────────── */}
      {onOpenContextPanel && (
        <button
          type="button"
          aria-label="Open context panel"
          onClick={onOpenContextPanel}
          className="lg:hidden shrink-0 inline-flex items-center justify-center min-w-[44px] min-h-[44px] transition-colors"
          style={{ color: ICON_REST, background: "transparent" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = ACCENT; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = ICON_REST; }}
        >
          <Menu className="size-4" aria-hidden />
        </button>
      )}

      {/* ── A. Logo ────────────────────────────────────────────────────── */}
      <div
        aria-label="Endless Worlds"
        className="shrink-0 italic font-medium"
        style={{
          fontFamily:    "var(--serif)",
          fontSize:      14,
          color:         ACCENT,
          letterSpacing: "0.01em",
        }}
      >
        ✦ Endless Worlds
      </div>

      {/* ── B. Genre tag pill (desktop) ──────────────────────────────── */}
      <div
        className="hidden md:inline-flex shrink-0 items-center uppercase"
        style={{
          fontFamily:    "var(--sans)",
          fontSize:      11,
          letterSpacing: "0.1em",
          padding:       "2px 8px",
          borderRadius:  20,
          color:         ACCENT,
          background:    "rgba(var(--genre-accent-rgb), 0.10)",
          border:        "1px solid rgba(var(--genre-accent-rgb), 0.25)",
        }}
      >
        {genreText}
      </div>

      {/* ── C. Breadcrumb (desktop) ──────────────────────────────────── */}
      {breadcrumbParts.length > 0 && (
        <div
          aria-label="Location breadcrumb"
          className="hidden md:flex min-w-0 items-center overflow-hidden whitespace-nowrap"
          style={{
            fontFamily: "var(--sans)",
            fontSize:   11,
          }}
        >
          {breadcrumbParts.map((p, i) => {
            const isCurrent = i === lastCrumbIdx;
            return (
              <React.Fragment key={`${i}-${p}`}>
                {i > 0 && (
                  <span
                    aria-hidden
                    className="mx-1.5"
                    style={{ color: CRUMB_SEP }}
                  >
                    ›
                  </span>
                )}
                <span
                  className="truncate"
                  style={{
                    maxWidth: 180,
                    color:    isCurrent ? CRUMB_CURRENT : CRUMB_REGION,
                  }}
                >
                  {p}
                </span>
              </React.Fragment>
            );
          })}
        </div>
      )}

      {/* ── D. flex-1 spacer ─────────────────────────────────────────── */}
      <div className="flex-1" />

      {/* ── E. Background loading dot ────────────────────────────────── */}
      {/* Section 17 + Pattern 3 (§5): 6px pulsing dot in genre accent
          during WorldBible/RegionBible prefetch. Uses `ew-pulse` from
          globals.css (line 420 / 428) — single source of truth for the
          pulse keyframe. Hidden via opacity 0 when idle so layout
          doesn't jump. */}
      <div
        aria-label={loading ? "Background generation in progress" : undefined}
        aria-hidden={!loading}
        className={loading ? "ew-pulse shrink-0" : "shrink-0"}
        style={{
          width:        6,
          height:       6,
          borderRadius: "50%",
          background:   ACCENT,
          opacity:      loading ? 1 : 0,
          transition:   "opacity 200ms ease",
        }}
      />

      {/* ── F. Verbosity toggle (desktop) ────────────────────────────── */}
      {/* Section 17: per-button border on active, no shared container
          border. Inactive = #6a5530 plain. Active = accent fg + .12 bg
          + .30 border + 4px radius. */}
      <div
        role="group"
        aria-label="Narrator verbosity"
        className="hidden md:inline-flex shrink-0 items-center gap-1"
      >
        {(["terse", "standard", "rich"] as const).map((key) => {
          const active = verbosity === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setVerbosity(key)}
              aria-pressed={active}
              className="transition-colors min-h-[44px] md:min-h-0 inline-flex items-center"
              style={{
                fontFamily:    "var(--sans)",
                fontSize:      11,
                letterSpacing: "0.02em",
                padding:       "3px 8px",
                borderRadius:  4,
                color:         active ? ACCENT : VERBOSITY_INACTIVE,
                background:    active
                  ? "rgba(var(--genre-accent-rgb), 0.12)"
                  : "transparent",
                border:        active
                  ? "1px solid rgba(var(--genre-accent-rgb), 0.30)"
                  : "1px solid transparent",
              }}
            >
              {key[0].toUpperCase() + key.slice(1)}
            </button>
          );
        })}
      </div>

      {/* ── G. Icon buttons — Codex · Journal · Map ──────────────────── */}
      <IconButton ariaLabel="Open codex" onClick={() => toggleCodexModal()}>
        <IconBook size={15} stroke={1.5} aria-hidden />
      </IconButton>
      <IconButton ariaLabel="Open journal" onClick={() => toggleJournalModal()}>
        <IconNotebook size={15} stroke={1.5} aria-hidden />
      </IconButton>
      {mapPanelAvailable && (
        <IconButton ariaLabel="Open map" onClick={() => toggleMapPanel()}>
          <IconMap size={15} stroke={1.5} aria-hidden />
        </IconButton>
      )}

      {/* ── H. Character pill ────────────────────────────────────────── */}
      <button
        type="button"
        onClick={onToggleSidebar}
        aria-label="Open character panel"
        className="shrink-0 inline-flex items-center gap-2 transition-colors min-h-[44px]"
        style={{
          // Pill container, per spec: rgba(.10) bg, rgba(.25) border,
          // 20px radius, asymmetric padding (4px 10px 4px 4px) — the
          // 4px left padding kisses the 24px avatar against the border.
          background:   "rgba(var(--genre-accent-rgb), 0.10)",
          border:       "1px solid rgba(var(--genre-accent-rgb), 0.25)",
          borderRadius: 20,
          padding:      "4px 10px 4px 4px",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background =
            "rgba(var(--genre-accent-rgb), 0.18)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background =
            "rgba(var(--genre-accent-rgb), 0.10)";
        }}
      >
        {/* Avatar — 24px circle, solid genre accent fill, class icon
            12px in dark bar colour (#141210) so the icon reads as a
            cut-out against the saturated accent. */}
        <span
          aria-hidden
          className="inline-flex items-center justify-center shrink-0"
          style={{
            width:        24,
            height:       24,
            borderRadius: "50%",
            background:   ACCENT,
            color:        "#141210",
          }}
        >
          <ClassIcon size={12} stroke={2} />
        </span>
        <span
          className="hidden md:inline truncate"
          style={{
            fontFamily: "var(--sans)",
            fontSize:   11,
            color:      CHAR_NAME,
            maxWidth:   120,
          }}
        >
          {playerName}
        </span>
      </button>

      {/* ── Additive: Save & Exit (desktop) + UserMenu ───────────────── */}
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
    </header>
  );
}

// ── Internal pieces ─────────────────────────────────────────────────────────

interface IconButtonProps {
  ariaLabel: string;
  onClick:   () => void;
  children:  React.ReactNode;
}
/** Icon button — 15px glyph centred in a 44×44 hit area at every
 *  breakpoint (Section 17: "44px minimum tap target — achieve via
 *  padding on the button wrapper, not by enlarging the icon").
 *  Hover/focus adds a subtle accent-tinted background (.08). */
function IconButton({ ariaLabel, onClick, children }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      title={ariaLabel}
      onClick={onClick}
      className="shrink-0 inline-flex items-center justify-center min-w-[44px] min-h-[44px] transition-colors"
      style={{ color: ICON_REST, background: "transparent", borderRadius: 4 }}
      onMouseEnter={(e) => {
        const t = e.currentTarget as HTMLButtonElement;
        t.style.color      = ACCENT;
        t.style.background = "rgba(var(--genre-accent-rgb), 0.08)";
      }}
      onMouseLeave={(e) => {
        const t = e.currentTarget as HTMLButtonElement;
        t.style.color      = ICON_REST;
        t.style.background = "transparent";
      }}
      onFocus={(e) => {
        const t = e.currentTarget as HTMLButtonElement;
        t.style.color      = ACCENT;
        t.style.background = "rgba(var(--genre-accent-rgb), 0.08)";
      }}
      onBlur={(e) => {
        const t = e.currentTarget as HTMLButtonElement;
        t.style.color      = ICON_REST;
        t.style.background = "transparent";
      }}
    >
      {children}
    </button>
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
