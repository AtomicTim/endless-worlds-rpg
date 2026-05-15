"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  IconShield, IconEyeOff, IconWand, IconCrosshair, IconMessage,
  IconCpu, IconBriefcase, IconSword, IconHammer, IconGhost,
  IconSearch, IconMoon, IconHeart, IconMask, IconEye,
  IconBadge, IconRocket, IconTool, IconAnchor, IconRadar,
  IconAxe, IconFirstAidKit, IconRun, IconSpeakerphone,
  IconClock,
  type Icon as TablerIcon,
} from "@tabler/icons-react";
import { createClient } from "@/lib/supabase/client";
import { Genre } from "@/types/game";
import type { MasterState } from "@/types/game";
import { formatLocationId } from "@/lib/game/location-formatter";

// ── Types ─────────────────────────────────────────────────────────────────────

interface SessionRow {
  id:           string;
  master_state: MasterState;
}

type View = "menu" | "worlds";

// ── Genre display config ──────────────────────────────────────────────────────
//
// UI-13 redesign. The 5 genre accent hex values + the matching `genre-X`
// CSS class (defined in globals.css) are the source of truth for both
// the main-menu genre pills (decorative) and the per-card data-genre
// theming on Your Worlds save slot cards.

const GENRE_LABELS: Record<Genre, string> = {
  [Genre.FANTASY]:             "Fantasy",
  [Genre.CYBERPUNK]:           "Cyberpunk",
  [Genre.HORROR_LOVECRAFTIAN]: "Horror",
  [Genre.SPACE_OPERA]:         "Space Opera",
  [Genre.POST_APOCALYPTIC]:    "Post-Apocalyptic",
};

/** Accent hex per genre. These coexist on the Main Menu pills row, so
 *  they're hardcoded rather than cascading from a root genre class. */
const GENRE_ACCENT: Record<Genre, string> = {
  [Genre.FANTASY]:             "#c4943a",
  [Genre.CYBERPUNK]:           "#22d3ee",
  [Genre.HORROR_LOVECRAFTIAN]: "#84cc16",
  [Genre.SPACE_OPERA]:         "#a855f7",
  [Genre.POST_APOCALYPTIC]:    "#ea580c",
};

/** Cap-tinted muted colour for the "Level X · Class" row on save slot
 *  cards (UI-13 spec). */
const GENRE_MUTED: Record<Genre, string> = {
  [Genre.FANTASY]:             "#7a6040",
  [Genre.CYBERPUNK]:           "#2a7a8a",
  [Genre.HORROR_LOVECRAFTIAN]: "#4a6a30",
  [Genre.SPACE_OPERA]:         "#7a5a9a",
  [Genre.POST_APOCALYPTIC]:    "#8a5030",
};

/** Genre → `genre-X` CSS class name (matches globals.css UI-1 blocks). */
const GENRE_CLASS: Record<Genre, string> = {
  [Genre.FANTASY]:             "genre-fantasy",
  [Genre.CYBERPUNK]:           "genre-cyberpunk",
  [Genre.HORROR_LOVECRAFTIAN]: "genre-horror",
  [Genre.SPACE_OPERA]:         "genre-space",
  [Genre.POST_APOCALYPTIC]:    "genre-postapoc",
};

/** Order matches the main-menu pills row (Fantasy first → cycles per
 *  globals.css `menu-ambient-cycle`). */
const PILL_GENRES: Genre[] = [
  Genre.FANTASY,
  Genre.CYBERPUNK,
  Genre.HORROR_LOVECRAFTIAN,
  Genre.SPACE_OPERA,
  Genre.POST_APOCALYPTIC,
];

/** Class id → Tabler icon (mirrors app/game/new/page.tsx — UI-12). */
const CLASS_ICON: Record<string, TablerIcon> = {
  // Fantasy
  knight:         IconShield,
  rogue:          IconEyeOff,
  mage:           IconWand,
  ranger:         IconCrosshair,
  herald:         IconMessage,
  // Cyberpunk
  netrunner:      IconCpu,
  fixer:          IconBriefcase,
  street_samurai: IconSword,
  enforcer:       IconHammer,
  ghost:          IconGhost,
  // Horror
  investigator:   IconSearch,
  cultist:        IconMoon,
  survivor:       IconHeart,
  phantom:        IconMask,
  medium:         IconEye,
  // Space Opera
  commander:      IconBadge,
  pilot:          IconRocket,
  engineer:       IconTool,
  marine:         IconAnchor,
  recon:          IconRadar,
  // Post-Apoc
  scavenger:      IconSearch,
  raider:         IconAxe,
  medic:          IconFirstAidKit,
  runner:         IconRun,
  demagogue:      IconSpeakerphone,
};

/** Pretty label for class id (e.g. "street_samurai" → "Street Samurai"). */
function formatClassName(classId: string): string {
  return classId
    .split("_")
    .map((w) => (w.length === 0 ? w : w[0].toUpperCase() + w.slice(1)))
    .join(" ");
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** "X.X hours played" — UI-13 spec. Falls back to "0.0 hours" for very
 *  short sessions; the divider keeps the layout consistent. */
function formatHoursPlayed(createdAt: string, lastPlayed: string): string {
  const diffMs   = Math.max(0, new Date(lastPlayed).getTime() - new Date(createdAt).getTime());
  const hours    = diffMs / 3_600_000;
  return `${hours.toFixed(1)} hours played`;
}

const MAX_FREE_SLOTS = 3;

// ── Main menu view ────────────────────────────────────────────────────────────

interface MainMenuProps {
  hasSaves:    boolean;
  onContinue:  () => void;
}

function MainMenu({ hasSaves, onContinue }: MainMenuProps) {
  return (
    <div
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden"
      style={{ backgroundColor: "#08060a" }}
    >
      {/* Ambient genre glow — large radial behind the logo, cycles the 5
          genre accents over 40s (8s each). Animation defined in
          globals.css (menu-ambient-cycle). */}
      <div
        aria-hidden
        className="menu-ambient-glow pointer-events-none absolute"
        style={{
          width:  "min(90vw, 720px)",
          height: "min(90vw, 720px)",
          top:    "50%",
          left:   "50%",
          transform: "translate(-50%, -50%)",
          filter: "blur(40px)",
          zIndex: 0,
        }}
      />

      <div className="relative z-10 flex flex-col items-center gap-5 px-6 text-center">
        {/* Logo */}
        <h1
          className="ew-serif italic leading-none"
          style={{
            color:    "#e2cda0",
            fontSize: "clamp(28px, 6vw, 40px)",
            letterSpacing: "0.02em",
          }}
        >
          Endless Worlds
        </h1>

        {/* Tagline */}
        <p
          className="ew-sans"
          style={{ color: "#4a3828", fontSize: 12, letterSpacing: "0.04em" }}
        >
          A new adventure every time
        </p>

        {/* Genre pills row — decorative. The 5 accent hex values are
            hardcoded per UI-13 spec (they coexist on this row, so no
            single genre-X class can cascade them). */}
        <div className="mt-1 flex flex-wrap justify-center gap-1.5">
          {PILL_GENRES.map((g) => {
            const accent = GENRE_ACCENT[g];
            return (
              <span
                key={g}
                className="ew-sans uppercase"
                style={{
                  fontSize:     7,
                  letterSpacing: "0.12em",
                  padding:      "3px 9px",
                  borderRadius: 20,
                  background:   `rgba(${hexToRgb(accent)}, .12)`,
                  border:       `1px solid rgba(${hexToRgb(accent)}, .28)`,
                  color:        accent,
                }}
              >
                {GENRE_LABELS[g]}
              </span>
            );
          })}
        </div>

        {/* CTAs */}
        <div className="mt-6 flex w-full flex-col items-stretch gap-3" style={{ maxWidth: 280 }}>
          <Link
            href="/game/new"
            className="menu-cta-accent ew-serif italic text-center transition-colors"
            style={{
              fontSize:     16,
              padding:      "12px 20px",
              borderWidth:  2,
              borderStyle:  "solid",
              borderRadius: 4,
              letterSpacing: "0.01em",
            }}
          >
            Begin New Adventure
          </Link>

          {hasSaves && (
            <button
              type="button"
              onClick={onContinue}
              className="ew-sans uppercase transition-colors"
              style={{
                fontSize:     9,
                letterSpacing: "0.18em",
                padding:      "10px 16px",
                background:   "transparent",
                border:       "1px solid #2d2618",
                borderRadius: 4,
                color:        "#4a3818",
              }}
            >
              Continue ›
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Save slot card (filled) ───────────────────────────────────────────────────

interface FilledSlotProps {
  session:    SessionRow;
  onLongPress: (session: SessionRow) => void;
}

function FilledSlot({ session, onLongPress }: FilledSlotProps) {
  const ms        = session.master_state;
  const genre     = ms.metadata.genre;
  const accent    = GENRE_ACCENT[genre] ?? GENRE_ACCENT[Genre.FANTASY];
  const muted     = GENRE_MUTED[genre]  ?? GENRE_MUTED[Genre.FANTASY];
  const label     = GENRE_LABELS[genre] ?? "Unknown";
  const genreCls  = GENRE_CLASS[genre]  ?? "genre-fantasy";

  const classId      = ms.player_state.background ?? "knight";
  const Icon         = CLASS_ICON[classId] ?? IconShield;
  const classLabel   = formatClassName(classId);
  const charName     = ms.player_state.name;
  const level        = ms.player_state.level;
  const worldName    = ms.metadata.world_consistency?.world_name ?? "Unnamed world";
  const locationName = formatLocationId(ms.world_state.current_location_id);
  const hoursLabel   = formatHoursPlayed(ms.metadata.created_at, ms.metadata.last_played);
  const sessionId    = ms.metadata.session_id;

  // Long-press / right-click handlers. We DO NOT delete here — the
  // confirmation modal is owned by the parent; this card just signals
  // intent. Long press = 600ms hold.
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggered  = useRef(false);

  const startPress = () => {
    triggered.current = false;
    pressTimer.current = setTimeout(() => {
      triggered.current = true;
      onLongPress(session);
    }, 600);
  };
  const cancelPress = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };
  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    onLongPress(session);
  };

  return (
    <div
      data-genre={genre}
      className={`relative ${genreCls}`}
      style={{
        background:   "var(--card-bg)",
        border:       "1px solid var(--card-border)",
        borderRadius: "var(--card-radius)",
        boxShadow:    "var(--card-shadow)",
        padding:      "14px 16px",
      }}
      onMouseDown={startPress}
      onMouseUp={cancelPress}
      onMouseLeave={cancelPress}
      onTouchStart={startPress}
      onTouchEnd={cancelPress}
      onTouchCancel={cancelPress}
      onContextMenu={onContextMenu}
    >
      {/* Row 1 — avatar circle · name · genre badge. flex/no-wrap so
          the row never collapses; name ellipsises before the badge. */}
      <div className="flex items-center gap-3" style={{ minWidth: 0 }}>
        <div
          className="flex shrink-0 items-center justify-center"
          style={{
            width:        36,
            height:       36,
            borderRadius: "50%",
            background:   `rgba(${hexToRgb(accent)}, .12)`,
            border:       `1.5px solid ${accent}`,
          }}
        >
          <Icon size={18} color={accent} stroke={1.6} aria-hidden />
        </div>

        <span
          className="ew-serif italic"
          style={{
            fontSize:     16,
            color:        "#e2cda0",
            flex:         1,
            minWidth:     0,
            whiteSpace:   "nowrap",
            overflow:     "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {charName}
        </span>

        <span
          className="ew-sans uppercase shrink-0"
          style={{
            fontSize:     7,
            letterSpacing: "0.12em",
            padding:      "3px 8px",
            borderRadius: 20,
            background:   `rgba(${hexToRgb(accent)}, .12)`,
            border:       `1px solid rgba(${hexToRgb(accent)}, .28)`,
            color:        accent,
          }}
        >
          {label}
        </span>
      </div>

      {/* Row 2 — "Level N · Class". Single line, no wrap. */}
      <div
        className="ew-sans mt-2"
        style={{
          fontSize:   12,
          color:      muted,
          whiteSpace: "nowrap",
          overflow:   "hidden",
          textOverflow: "ellipsis",
        }}
      >
        Level {level} · {classLabel}
      </div>

      {/* Divider */}
      <div style={{ marginTop: 12, marginBottom: 10, height: 1, background: "#2d2618" }} />

      {/* World name */}
      <div className="ew-serif italic" style={{ fontSize: 12, color: "#6a5530" }}>
        {worldName}
      </div>

      {/* Location breadcrumb + hours played row */}
      <div
        className="ew-sans mt-1.5 flex items-center justify-between gap-2"
        style={{ fontSize: 8, color: "#4a3818", letterSpacing: "0.04em" }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {locationName}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          <IconClock size={10} stroke={1.6} aria-hidden />
          {hoursLabel}
        </span>
      </div>

      {/* Continue button — bottom-right. */}
      <div className="mt-3 flex justify-end">
        <Link
          href={`/game?session_id=${sessionId}`}
          className="ew-sans uppercase transition-colors"
          style={{
            fontSize:     9,
            letterSpacing: "0.18em",
            padding:      "5px 12px",
            borderRadius: 20,
            background:   `rgba(${hexToRgb(accent)}, .12)`,
            border:       `1px solid rgba(${hexToRgb(accent)}, .35)`,
            color:        accent,
          }}
        >
          Continue →
        </Link>
      </div>
    </div>
  );
}

// ── Save slot card (empty) ────────────────────────────────────────────────────

function EmptySlot() {
  return (
    <Link
      href="/game/new"
      className="flex flex-col items-center justify-center gap-2 transition-colors"
      style={{
        padding:      "32px 16px",
        border:       "1px dashed #2d2618",
        borderRadius: 8,
        minHeight:    180,
      }}
    >
      <span style={{ color: "#3a3020", fontSize: 22 }}>✦</span>
      <p
        className="ew-serif italic"
        style={{ color: "#3a3020", fontSize: 12, letterSpacing: "0.02em" }}
      >
        Begin a new adventure
      </p>
    </Link>
  );
}

// ── Delete confirmation modal ─────────────────────────────────────────────────
//
// The gesture (long-press / right-click) is wired per spec; the confirm
// button is intentionally a no-op placeholder for now — UI-13's
// constraint is "Zero changes to … save/load logic," so this modal
// scaffolds the UX without actually deleting. Real deletion will plug
// in here when that route lands.

interface DeleteConfirmProps {
  session:   SessionRow | null;
  onCancel:  () => void;
}

function DeleteConfirmModal({ session, onCancel }: DeleteConfirmProps) {
  if (!session) return null;
  const name = session.master_state.player_state.name;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="modal-backdrop-in fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgba(8,6,10,.78)" }}
      onClick={onCancel}
    >
      <div
        className="modal-card-in"
        onClick={(e) => e.stopPropagation()}
        style={{
          background:   "#100b08",
          border:       "1px solid #2d2618",
          borderRadius: 8,
          padding:      "20px 22px",
          maxWidth:     320,
          width:        "100%",
        }}
      >
        <h3
          className="ew-serif italic"
          style={{ color: "#e2cda0", fontSize: 18, marginBottom: 8 }}
        >
          Delete save?
        </h3>
        <p
          className="ew-sans"
          style={{ color: "#7a6a4a", fontSize: 11, lineHeight: 1.5, marginBottom: 16 }}
        >
          {name}&apos;s adventure will be lost. This cannot be undone.
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="ew-sans uppercase"
            style={{
              fontSize:     9,
              letterSpacing: "0.18em",
              padding:      "7px 14px",
              border:       "1px solid #2d2618",
              borderRadius: 4,
              color:        "#7a6a4a",
              background:   "transparent",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled
            className="ew-sans uppercase"
            style={{
              fontSize:     9,
              letterSpacing: "0.18em",
              padding:      "7px 14px",
              border:       "1px solid rgba(196,148,58,.25)",
              borderRadius: 4,
              color:        "#7a6040",
              background:   "rgba(196,148,58,.08)",
              opacity:      0.6,
              cursor:       "not-allowed",
            }}
            title="Coming soon"
          >
            Delete (coming soon)
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Your Worlds view ──────────────────────────────────────────────────────────

interface YourWorldsProps {
  sessions: SessionRow[];
  loading:  boolean;
  onBack:   () => void;
}

function YourWorlds({ sessions, loading, onBack }: YourWorldsProps) {
  const [pending, setPending] = useState<SessionRow | null>(null);
  const emptySlots = Math.max(0, MAX_FREE_SLOTS - sessions.length);

  return (
    <div
      className="relative min-h-screen"
      style={{ backgroundColor: "#08060a" }}
    >
      <div className="mx-auto max-w-3xl px-6 pt-10 pb-14">
        {/* Back link */}
        <button
          type="button"
          onClick={onBack}
          className="ew-sans uppercase"
          style={{
            fontSize:     8,
            letterSpacing: "0.18em",
            color:        "#4a3818",
            background:   "transparent",
            border:       "none",
            padding:      "0 0 8px 0",
            cursor:       "pointer",
          }}
        >
          ← Main Menu
        </button>

        {/* Title */}
        <h1
          className="ew-serif italic text-center"
          style={{ color: "#e2cda0", fontSize: 22, marginBottom: 24 }}
        >
          Your Worlds
        </h1>

        {loading ? (
          <p
            className="ew-serif italic text-center"
            style={{ color: "#4a3818", fontSize: 13 }}
          >
            Loading your adventures…
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sessions.map((s) => (
              <FilledSlot key={s.id} session={s} onLongPress={setPending} />
            ))}
            {Array.from({ length: emptySlots }).map((_, i) => (
              <EmptySlot key={`empty-${i}`} />
            ))}
          </div>
        )}
      </div>

      <DeleteConfirmModal session={pending} onCancel={() => setPending(null)} />
    </div>
  );
}

// ── Tiny hex-to-rgb helper (no var(--genre-accent-rgb) on the main
//    menu pills because the 5 pills coexist on one screen). ─────────────

function hexToRgb(hex: string): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `${r},${g},${b}`;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();

  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [view,     setView]     = useState<View>("menu");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase.from("game_sessions") as any)
        .select("id, master_state")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("last_played", { ascending: false })
        .limit(MAX_FREE_SLOTS) as { data: SessionRow[] | null };

      if (cancelled) return;
      setSessions(data ?? []);
      setLoading(false);
    }

    void load();
    return () => { cancelled = true; };
  }, [router]);

  const hasSaves = sessions.length > 0;

  return view === "menu"
    ? <MainMenu hasSaves={hasSaves} onContinue={() => setView("worlds")} />
    : <YourWorlds sessions={sessions} loading={loading} onBack={() => setView("menu")} />;
}
