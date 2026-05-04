"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Genre } from "@/types/game";
import type { MasterState } from "@/types/game";
import { formatLocationId } from "@/lib/game/location-formatter";

// ── Types ─────────────────────────────────────────────────────────────────────

interface SessionRow {
  id:           string;
  master_state: MasterState;
}

// ── Genre display config ──────────────────────────────────────────────────────

const GENRE_LABELS: Record<Genre, string> = {
  [Genre.FANTASY]:             "Fantasy",
  [Genre.CYBERPUNK]:           "Cyberpunk",
  [Genre.HORROR_LOVECRAFTIAN]: "Horror",
  [Genre.SPACE_OPERA]:         "Space Opera",
  [Genre.POST_APOCALYPTIC]:    "Post-Apoc",
};

const GENRE_COLORS: Record<Genre, { border: string; text: string }> = {
  [Genre.FANTASY]:             { border: "#b45309", text: "#f59e0b" },
  [Genre.CYBERPUNK]:           { border: "#0e7490", text: "#06b6d4" },
  [Genre.HORROR_LOVECRAFTIAN]: { border: "#6d28d9", text: "#a855f7" },
  [Genre.SPACE_OPERA]:         { border: "#7c3aed", text: "#c084fc" },
  [Genre.POST_APOCALYPTIC]:    { border: "#92400e", text: "#d97706" },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function relativeTime(isoString: string): string {
  const diffSec = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (diffSec < 60)    return "just now";
  if (diffSec < 3600)  return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;
  return new Date(isoString).toLocaleDateString();
}

function formatTimePlayed(createdAt: string, lastPlayed: string): string {
  const diffMs   = Math.max(0, new Date(lastPlayed).getTime() - new Date(createdAt).getTime());
  const totalMin = Math.floor(diffMs / 60000);
  const hours    = Math.floor(totalMin / 60);
  const mins     = totalMin % 60;
  if (hours === 0 && mins < 1) return "< 1m";
  if (hours === 0) return `${mins}m`;
  return `${hours}h ${mins}m`;
}

const MAX_FREE_SLOTS = 3;

// ── Slot card ─────────────────────────────────────────────────────────────────

function FilledSlot({ session }: { session: SessionRow }) {
  const ms     = session.master_state;
  const genre  = ms.metadata.genre;
  const colors = GENRE_COLORS[genre] ?? GENRE_COLORS[Genre.FANTASY];
  const label  = GENRE_LABELS[genre] ?? genre;

  const lastEntry    = ms.log_book.entries[0]?.content ?? "(no log entries yet)";
  const preview      = lastEntry.length > 60 ? lastEntry.slice(0, 57) + "…" : lastEntry;
  const locationName = formatLocationId(ms.world_state.current_location_id);
  const timePlayed   = formatTimePlayed(ms.metadata.created_at, ms.metadata.last_played);
  const lastPlayed   = relativeTime(ms.metadata.last_played);
  const sessionId    = ms.metadata.session_id;

  return (
    <div
      className="flex flex-col gap-3 rounded-sm p-4"
      style={{
        backgroundColor: "color-mix(in srgb, var(--color-primary) 4%, transparent)",
        border:          "1px solid color-mix(in srgb, var(--color-primary) 30%, transparent)",
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p
            className="text-sm font-bold tracking-wide"
            style={{ color: "var(--color-text)" }}
          >
            {ms.player_state.name}
          </p>
          <p className="text-[10px] mt-0.5" style={{ color: "var(--color-muted)" }}>
            Lv.{ms.player_state.level} · {ms.player_state.background}
          </p>
        </div>
        <span
          className="shrink-0 rounded-sm px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest"
          style={{ border: `1px solid ${colors.border}`, color: colors.text }}
        >
          {label}
        </span>
      </div>

      {/* Location */}
      <div className="text-[10px]" style={{ color: "var(--color-muted)" }}>
        <span style={{ color: "var(--color-primary)" }}>📍</span>{" "}
        {locationName}
      </div>

      {/* Last log entry */}
      <p
        className="text-[10px] italic leading-relaxed"
        style={{
          color:        "var(--color-text)",
          opacity:      0.75,
          borderLeft:   "2px solid color-mix(in srgb, var(--color-primary) 35%, transparent)",
          paddingLeft:  "0.5rem",
        }}
      >
        {preview}
      </p>

      {/* Stats row */}
      <div className="flex justify-between text-[9px]" style={{ color: "var(--color-muted)" }}>
        <span>⏱ {timePlayed} played</span>
        <span>Last played {lastPlayed}</span>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <Link
          href={`/game?session_id=${sessionId}`}
          className="flex-1 rounded-sm py-1.5 text-center text-xs font-bold uppercase tracking-wider transition-colors"
          style={{
            backgroundColor: "color-mix(in srgb, var(--color-primary) 18%, transparent)",
            border:          "1px solid var(--color-primary)",
            color:           "var(--color-primary)",
          }}
        >
          Continue →
        </Link>
        <div className="relative group">
          <button
            disabled
            className="rounded-sm px-3 py-1.5 text-xs font-bold uppercase tracking-wider cursor-not-allowed"
            style={{
              border: "1px solid color-mix(in srgb, var(--color-muted) 30%, transparent)",
              color:  "var(--color-muted)",
              opacity: 0.5,
            }}
          >
            Delete
          </button>
          <div
            className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 whitespace-nowrap rounded-sm px-2 py-1 text-[9px] opacity-0 group-hover:opacity-100 transition-opacity"
            style={{
              backgroundColor: "var(--color-bg)",
              border:          "1px solid var(--color-border)",
              color:           "var(--color-muted)",
            }}
          >
            Coming soon
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptySlot({ slotIndex }: { slotIndex: number }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-3 rounded-sm p-8"
      style={{
        border: "1px dashed color-mix(in srgb, var(--color-primary) 25%, transparent)",
        color:  "var(--color-muted)",
      }}
    >
      <span className="text-2xl opacity-30">⬡</span>
      <div className="text-center">
        <p className="text-xs font-bold uppercase tracking-wider">
          Empty Slot {slotIndex + 1}
        </p>
        <p className="mt-1 text-[10px] italic">No adventure in progress</p>
      </div>
      <Link
        href="/game/new"
        className="mt-1 rounded-sm px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors"
        style={{
          backgroundColor: "color-mix(in srgb, var(--color-primary) 10%, transparent)",
          border:          "1px solid color-mix(in srgb, var(--color-primary) 40%, transparent)",
          color:           "var(--color-primary)",
        }}
      >
        Start Adventure
      </Link>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();

  const [sessions,    setSessions]    = useState<SessionRow[]>([]);
  const [loading,     setLoading]     = useState(true);

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

  const isFull    = sessions.length >= MAX_FREE_SLOTS;
  const emptySlots = Math.max(0, MAX_FREE_SLOTS - sessions.length);

  return (
    <div
      className="min-h-screen font-mono"
      style={{ backgroundColor: "var(--color-bg)", color: "var(--color-text)" }}
    >
      {/* Header */}
      <header
        className="flex items-center justify-between px-6 py-4"
        style={{ borderBottom: "1px solid var(--color-border)" }}
      >
        <div className="flex items-center gap-3">
          <span
            className="text-sm font-bold tracking-widest uppercase"
            style={{ color: "var(--color-primary)" }}
          >
            ⬡ ENDLESS WORLDS
          </span>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/game/codex"
            className="text-xs tracking-wider"
            style={{ color: "var(--color-muted)" }}
          >
            Codex
          </Link>
          <div className="relative group">
            <Link
              href={isFull ? "#" : "/game/new"}
              onClick={isFull ? (e) => e.preventDefault() : undefined}
              className="rounded-sm px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors"
              style={
                isFull
                  ? {
                      border:  "1px solid color-mix(in srgb, var(--color-muted) 30%, transparent)",
                      color:   "var(--color-muted)",
                      opacity: 0.5,
                      cursor:  "not-allowed",
                    }
                  : {
                      backgroundColor: "color-mix(in srgb, var(--color-primary) 10%, transparent)",
                      border:          "1px solid var(--color-primary)",
                      color:           "var(--color-primary)",
                    }
              }
            >
              + New Adventure
            </Link>
            {isFull && (
              <div
                className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 whitespace-nowrap rounded-sm px-2 py-1 text-[9px] opacity-0 group-hover:opacity-100 transition-opacity z-10"
                style={{
                  backgroundColor: "var(--color-bg)",
                  border:          "1px solid var(--color-border)",
                  color:           "var(--color-muted)",
                }}
              >
                Delete a save first
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Body */}
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1
          className="mb-1 text-xl font-bold tracking-wide"
          style={{ color: "var(--color-primary)" }}
        >
          Your Adventures
        </h1>
        <p className="mb-8 text-xs" style={{ color: "var(--color-muted)" }}>
          Free tier · {sessions.length}/{MAX_FREE_SLOTS} save slots used
        </p>

        {loading ? (
          <p className="text-sm italic" style={{ color: "var(--color-muted)" }}>
            Loading your adventures…
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sessions.map((s) => (
              <FilledSlot key={s.id} session={s} />
            ))}
            {Array.from({ length: emptySlots }).map((_, i) => (
              <EmptySlot key={`empty-${i}`} slotIndex={sessions.length + i} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
