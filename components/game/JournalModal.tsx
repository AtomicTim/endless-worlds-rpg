"use client";

import { useEffect, useState } from "react";
import { useGameStore } from "@/lib/stores/game-store";
import { Genre } from "@/types/game";
import type { MainQuest, QuestBreadcrumb, QuestEntry, SideQuest } from "@/types/game";

/**
 * UI-7 — Journal / Chronicle modal.
 *
 * Section 12 of /docs/ui-design-reference.md. Visual redesign of the
 * prior Day-23C modal; all data, tabs, and quest-state logic
 * preserved. The 4 existing tabs (MAIN QUEST · SIDE QUESTS ·
 * COMPLETED · FAILED) are kept and restyled (the §12 2-tab spec
 * "Quests · Journal" would require merging logic, deferred to a
 * future structural refactor).
 *
 *  • Modal shell follows the UI-1 genre card system + three overlay
 *    divs (matches CodexModal).
 *  • Screen title "Chronicle" — Cormorant Garamond italic 18px,
 *    var(--genre-accent), centered.
 *  • Quest cards: left border 2px (main quest var(--genre-accent),
 *    side quest #6a5530 dim), ◈ prefix on main quest, status badges
 *    with proper tints.
 *  • Journal entries (BreadcrumbBlock / SideQuestBlock): 2px left
 *    border rgba(196,148,58,.38), genre-specific label (Chronicle /
 *    SYS_LOG / case notes / SHIP LOG / LOG), prose 12px #b0956a.
 *  • Day headers grouped from QuestEntry.timestamp (calendar-day
 *    ordinal), genre-specific format per spec.
 */

type TabId = "main" | "side" | "completed" | "failed";

interface TabConfig {
  id:    TabId;
  label: string;
}

const TABS: TabConfig[] = [
  { id: "main",      label: "Main Quest" },
  { id: "side",      label: "Side Quests" },
  { id: "completed", label: "Completed" },
  { id: "failed",    label: "Failed" },
];

const ACT_LABEL: Record<QuestBreadcrumb["act"], string> = {
  1:        "ACT I",
  2:        "ACT II",
  3:        "ACT III",
  climax:   "CLIMAX",
};

const STATUS_LABEL: Record<string, string> = {
  active:    "ACTIVE",
  completed: "COMPLETED",
  failed:    "FAILED",
};

// UI-7 (CHANGE 6) — status badge tints. ACTIVE picks up the genre
// accent so the tint shifts with theme; COMPLETED + FAILED are
// semantic (always green / red).
const STATUS_FG: Record<string, string> = {
  active:    "var(--genre-accent)",
  completed: "#5a9a5a",
  failed:    "#9a4040",
};
const STATUS_BG: Record<string, string> = {
  active:    "rgba(var(--genre-accent-rgb), .12)",
  completed: "rgba(90, 154, 90, .14)",
  failed:    "rgba(154, 64, 64, .14)",
};

// UI-7 (CHANGE 7) — per-genre journal label.
const GENRE_JOURNAL_LABEL: Record<Genre, string> = {
  [Genre.FANTASY]:             "Chronicle",
  [Genre.CYBERPUNK]:           "SYS_LOG",
  [Genre.HORROR_LOVECRAFTIAN]: "case notes",
  [Genre.SPACE_OPERA]:         "SHIP LOG",
  [Genre.POST_APOCALYPTIC]:    "LOG",
};

// Ordinal word for the Fantasy day header ("Day the Third"). Falls
// back to a numeric form past 12 to keep the spec language while not
// overcommitting to a long ordinal table.
const ORDINAL_WORD: Record<number, string> = {
  1: "First", 2: "Second", 3: "Third", 4: "Fourth", 5: "Fifth",
  6: "Sixth", 7: "Seventh", 8: "Eighth", 9: "Ninth", 10: "Tenth",
  11: "Eleventh", 12: "Twelfth",
};

function formatDayHeader(genre: Genre, day: number): string {
  switch (genre) {
    case Genre.FANTASY:
      return `— Day the ${ORDINAL_WORD[day] ?? day} —`;
    case Genre.CYBERPUNK:
      return `// DAY_${String(day).padStart(2, "0")} ///`;
    case Genre.HORROR_LOVECRAFTIAN:
      return `${ORDINAL_WORD[day]?.toLowerCase() ?? day} night`;
    case Genre.SPACE_OPERA:
      return `◈ CYCLE ${day}`;
    case Genre.POST_APOCALYPTIC:
      return `DAY ${day} //`;
    default:
      return `Day ${day}`;
  }
}

/** Group QuestEntries by calendar day. Day 1 = the earliest entry's
 *  date; subsequent calendar days increment the ordinal. Returns an
 *  ordered array of { day, entries } so callers can render day
 *  headers between groups. */
function groupEntriesByDay(entries: QuestEntry[]): Array<{ day: number; entries: QuestEntry[] }> {
  if (entries.length === 0) return [];
  const sorted = [...entries].sort((a, b) => a.timestamp - b.timestamp);
  const baseDate = new Date(sorted[0].timestamp);
  const baseDayKey = baseDate.toISOString().slice(0, 10);
  const dayKeyToOrdinal = new Map<string, number>();
  dayKeyToOrdinal.set(baseDayKey, 1);
  let nextOrdinal = 2;
  const buckets = new Map<number, QuestEntry[]>();
  for (const e of sorted) {
    const k = new Date(e.timestamp).toISOString().slice(0, 10);
    let ord = dayKeyToOrdinal.get(k);
    if (ord === undefined) {
      ord = nextOrdinal++;
      dayKeyToOrdinal.set(k, ord);
    }
    if (!buckets.has(ord)) buckets.set(ord, []);
    buckets.get(ord)!.push(e);
  }
  // Array.from instead of spread — project tsconfig doesn't enable
  // downlevelIteration so iterator spread on Map.entries() won't compile.
  return Array.from(buckets.entries())
    .sort(([a], [b]) => a - b)
    .map(([day, list]) => ({ day, entries: list }));
}

export function JournalModal() {
  const open    = useGameStore((s) => s.journalModalOpen);
  const setOpen = useGameStore((s) => s.setJournalModalOpen);
  const qt      = useGameStore((s) => s.masterState?.quest_threads ?? null);
  const genre   = useGameStore((s) => s.masterState?.metadata.genre) ?? Genre.FANTASY;
  const [tab, setTab] = useState<TabId>("main");

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  if (!open) return null;

  const mainQuest    = qt?.main_quest ?? null;
  const sideQuests   = qt?.side_quests ?? [];
  const completedIds = qt?.completed_quest_ids ?? [];
  const failedIds    = qt?.failed_quest_ids ?? [];
  const journalLabel = GENRE_JOURNAL_LABEL[genre];

  return (
    <div
      // UI-11 — shared modal entry animation (design ref §14).
      className="fixed inset-0 z-50 flex items-start justify-center modal-backdrop-in"
      style={{ background: "rgba(0,0,0,0.82)" }}
      onClick={() => setOpen(false)}
      role="dialog"
      aria-label="Chronicle"
      aria-modal="true"
    >
      <div
        className="flex flex-col modal-card-in"
        style={{
          position:     "relative",
          width:        "min(580px, 96vw)",
          maxHeight:    "88vh",
          margin:       "4vh auto",
          background:   "var(--content-bg)",
          border:       "1px solid var(--card-border)",
          borderRadius: "var(--card-radius)",
          boxShadow:    "var(--card-shadow)",
          overflow:     "hidden",
          color:        "var(--ink-2)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* UI-1 overlay trio. */}
        <div className="ol-tex"  aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 2 }} />
        <div className="ol-scan" aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 2 }} />
        <div className="ol-grid" aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 2 }} />

        <div
          className="relative flex min-h-0 flex-1 flex-col"
          style={{ zIndex: 10 }}
        >
          {/* CHANGE 5 — Screen title "Chronicle", centered serif accent. */}
          <header
            className="flex shrink-0 items-center justify-between"
            style={{
              padding:      "12px 16px 6px",
              position:     "relative",
            }}
          >
            <span style={{ width: 24 }} aria-hidden />
            <h1
              className="ew-serif italic"
              style={{
                fontSize:   18,
                color:      "var(--genre-accent)",
                margin:     0,
                lineHeight: 1.2,
                textAlign:  "center",
                flex:       1,
              }}
            >
              Chronicle
            </h1>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close chronicle"
              style={{
                width:           24,
                height:          24,
                border:          "1px solid #2d2618",
                background:      "transparent",
                color:           "#6a5530",
                cursor:          "pointer",
                display:         "inline-flex",
                alignItems:      "center",
                justifyContent:  "center",
              }}
            >
              ✕
            </button>
          </header>

          {/* Tabs — Inter Tight 8px uppercase, active accent underline. */}
          <nav
            className="flex shrink-0 flex-wrap gap-0 px-4 pb-1"
            style={{ borderBottom: "1px solid #2d2618" }}
            aria-label="Journal tabs"
          >
            {TABS.map((t) => {
              const isActive = tab === t.id;
              const badge =
                t.id === "side"      ? sideQuests.filter((q) => q.discovered === true).length :
                t.id === "completed" ? completedIds.length :
                t.id === "failed"    ? failedIds.length :
                0;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className="ew-sans uppercase"
                  style={{
                    background:    "transparent",
                    // UI-fix-I 4b — inactive label was #4a3818
                    // (near-black on the dark modal surface — illegible).
                    // Bumped to #6a5530, the standard UI muted text the
                    // design system uses elsewhere; reads cleanly without
                    // competing with the active #e2cda0 + accent underline.
                    color:         isActive ? "#e2cda0" : "#6a5530",
                    border:        "none",
                    borderBottom:  isActive
                      ? "2px solid var(--genre-accent)"
                      : "2px solid transparent",
                    padding:       "6px 10px",
                    fontSize:      8,
                    letterSpacing: "0.14em",
                    cursor:        "pointer",
                    transition:    "color 120ms",
                  }}
                >
                  {t.label}
                  {badge > 0 && (
                    <span
                      className="ml-1"
                      // UI-fix-I 4b — badge count tracked the same #4a3818
                      // tone; bumped in lockstep so the count stays legible
                      // beside its (now-readable) label.
                      style={{ color: isActive ? "#a08870" : "#6a5530", fontSize: 7 }}
                    >
                      · {badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          <div
            className="flex-1 overflow-y-auto px-5 py-5"
            style={{ minHeight: 0 }}
          >
            {tab === "main"      && <MainQuestTab mainQuest={mainQuest} genre={genre} journalLabel={journalLabel} />}
            {tab === "side"      && <SideQuestsTab sideQuests={sideQuests} genre={genre} journalLabel={journalLabel} />}
            {tab === "completed" && <CompletedTab ids={completedIds} />}
            {tab === "failed"    && <FailedTab    ids={failedIds} />}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Quest tab ───────────────────────────────────────────────────────────

function MainQuestTab({
  mainQuest, genre, journalLabel,
}: {
  mainQuest:    MainQuest | null;
  genre:        Genre;
  journalLabel: string;
}) {
  if (!mainQuest) {
    return (
      <p className="ew-serif italic" style={{ color: "#6a5530", fontSize: 13 }}>
        No quest recorded yet.
      </p>
    );
  }

  const discovered = (mainQuest.breadcrumbs ?? []).filter((b) => b.discovered);
  const journalEntries = mainQuest.journal_entries ?? [];

  const orderedActs: Array<QuestBreadcrumb["act"]> = [1, 2, 3, "climax"];
  const grouped: Record<string, QuestBreadcrumb[]> = {};
  for (const b of discovered) {
    const key = String(b.act);
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(b);
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Quest header card — main quest = ◈ prefix + var(--genre-accent)
          left border per CHANGE 6. */}
      <header
        className="flex flex-col"
        style={{
          gap:          6,
          borderLeft:   "2px solid var(--genre-accent)",
          paddingLeft:  10,
        }}
      >
        <h2
          className="ew-serif italic"
          style={{
            fontSize:   13,
            color:      "#e2cda0",
            margin:     0,
            lineHeight: 1.3,
          }}
        >
          <span aria-hidden style={{ color: "var(--genre-accent)", marginRight: 6 }}>◈</span>
          {mainQuest.title}
        </h2>
        <div className="flex items-center gap-2">
          <span
            className="ew-sans uppercase"
            style={{
              padding:       "2px 8px",
              borderRadius:  20,
              background:    STATUS_BG[mainQuest.status] ?? "transparent",
              color:         STATUS_FG[mainQuest.status] ?? "#6a5530",
              fontSize:      7,
              letterSpacing: "0.14em",
            }}
          >
            {STATUS_LABEL[mainQuest.status] ?? mainQuest.status.toUpperCase()}
          </span>
        </div>
        <p
          className="ew-serif italic"
          style={{
            fontSize:   11,
            color:      "#9a7e52",
            lineHeight: 1.6,
            margin:     "2px 0 0",
          }}
        >
          {mainQuest.threat_description}
        </p>
      </header>

      {discovered.length === 0 ? (
        <p
          className="ew-serif italic"
          style={{
            color:        "#6a5530",
            fontSize:     12,
            lineHeight:   1.6,
            borderLeft:   "1px solid #2d2618",
            paddingLeft:  10,
          }}
        >
          Your journey has only just begun. There is more to uncover.
        </p>
      ) : (
        <div className="flex flex-col gap-5">
          {orderedActs.map((act) => {
            const bcs = grouped[String(act)] ?? [];
            if (bcs.length === 0) return null;
            return (
              <section key={String(act)} className="flex flex-col gap-3">
                <div
                  className="ew-sans uppercase"
                  style={{
                    fontSize:      7,
                    letterSpacing: "0.20em",
                    color:         "#4a3818",
                    borderBottom:  "1px solid #2d2618",
                    paddingBottom: 4,
                  }}
                >
                  {ACT_LABEL[act]}
                </div>
                {bcs.map((b) => (
                  <BreadcrumbBlock
                    key={b.id}
                    breadcrumb={b}
                    entries={journalEntries.filter((e) => e.quest_id === b.id)}
                    genre={genre}
                    journalLabel={journalLabel}
                  />
                ))}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function BreadcrumbBlock({
  breadcrumb, entries, genre, journalLabel,
}: {
  breadcrumb:   QuestBreadcrumb;
  entries:      QuestEntry[];
  genre:        Genre;
  journalLabel: string;
}) {
  // UI-fix-I 4a — current-objective line. Was uppercase tracked
  // chrome ("ew-sans uppercase 8px tracked, var(--genre-accent)")
  // which read like a database row. Per design ref §12 quest
  // objectives are narrative sentence-case ("Find the clerk who
  // sent the message."), not field labels. The serif italic +
  // warm neutral #c4b090 sits between the title (#e2cda0) and
  // the journal prose (#b0956a) without burning the genre accent
  // on every objective line. The → prefix stays as a visual
  // bullet; sentence case comes for free from dropping the CSS
  // textTransform: uppercase (no content change).
  return (
    <div className="flex flex-col gap-2">
      <p
        className="ew-serif italic"
        style={{
          fontSize:      12,
          letterSpacing: "0.01em",
          color:         "#c4b090",
          margin:        0,
        }}
      >
        →&nbsp;{breadcrumb.content}
      </p>
      {entries.length > 0 && (
        <JournalFeed entries={entries} genre={genre} journalLabel={journalLabel} />
      )}
    </div>
  );
}

/** UI-7 (CHANGE 7) — auto-log entries grouped by calendar day with
 *  genre-specific day headers + label. */
function JournalFeed({
  entries, genre, journalLabel,
}: {
  entries:      QuestEntry[];
  genre:        Genre;
  journalLabel: string;
}) {
  const grouped = groupEntriesByDay(entries);
  return (
    <div className="flex flex-col gap-3">
      {grouped.map(({ day, entries: dayEntries }) => (
        <div key={day} className="flex flex-col gap-2">
          <div
            className="ew-sans uppercase"
            style={{
              fontSize:      8,
              letterSpacing: "0.16em",
              color:         "#4a3818",
              textAlign:     "center",
              padding:       "2px 0",
            }}
          >
            {formatDayHeader(genre, day)}
          </div>
          {dayEntries.map((e) => (
            <div
              key={e.id}
              style={{
                borderLeft:  "2px solid rgba(196,148,58,.38)",
                paddingLeft: 12,
                paddingTop:  2,
                paddingBottom: 2,
              }}
            >
              <p
                className="ew-sans uppercase"
                style={{
                  fontSize:      7,
                  letterSpacing: "0.16em",
                  color:         "#4a3818",
                  margin:        "0 0 2px",
                }}
              >
                {journalLabel}
              </p>
              <p
                className="ew-serif italic"
                style={{
                  fontSize:   12,
                  color:      "#b0956a",
                  lineHeight: 1.7,
                  margin:     0,
                }}
              >
                {e.text}
              </p>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Side Quests tab ──────────────────────────────────────────────────────────

const STATUS_ORDER: Array<{ status: SideQuest["status"]; heading: string }> = [
  { status: "active",    heading: "ACTIVE"    },
  { status: "completed", heading: "COMPLETED" },
  { status: "failed",    heading: "FAILED"    },
];

function SideQuestsTab({
  sideQuests, genre, journalLabel,
}: {
  sideQuests:   SideQuest[];
  genre:        Genre;
  journalLabel: string;
}) {
  const visible = sideQuests.filter((q) => q.discovered === true);
  if (visible.length === 0) {
    return (
      <p className="ew-serif italic" style={{ color: "#6a5530", fontSize: 13 }}>
        No side quests recorded yet.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-5">
      {STATUS_ORDER.map(({ status, heading }) => {
        const group = visible.filter((q) => q.status === status);
        if (group.length === 0) return null;
        return (
          <section key={status} className="flex flex-col gap-3">
            <div
              className="ew-sans uppercase"
              style={{
                fontSize:      7,
                letterSpacing: "0.20em",
                color:         STATUS_FG[status] ?? "#4a3818",
                borderBottom:  "1px solid #2d2618",
                paddingBottom: 4,
              }}
            >
              {heading}
            </div>
            <ul className="flex flex-col gap-3">
              {group.map((q) => (
                <SideQuestBlock key={q.id} quest={q} genre={genre} journalLabel={journalLabel} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function SideQuestBlock({
  quest, genre, journalLabel,
}: {
  quest:        SideQuest;
  genre:        Genre;
  journalLabel: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasEntries = quest.entries.length > 0;
  return (
    <li
      className="flex flex-col gap-2"
      style={{
        borderLeft:   "2px solid #6a5530",
        paddingLeft:  10,
      }}
    >
      <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span
          className="ew-serif italic"
          style={{ fontSize: 13, color: "#e2cda0", lineHeight: 1.3, flex: 1, minWidth: 0 }}
        >
          {quest.title}
        </span>
        <span
          className="ew-sans uppercase"
          style={{
            fontSize:      7,
            letterSpacing: "0.14em",
            padding:       "2px 8px",
            borderRadius:  20,
            background:    STATUS_BG[quest.status] ?? "transparent",
            color:         STATUS_FG[quest.status] ?? "#6a5530",
          }}
        >
          {STATUS_LABEL[quest.status] ?? quest.status.toUpperCase()}
        </span>
      </header>
      {(quest.giver_name || quest.region_id) && (
        <p
          className="ew-sans uppercase"
          style={{
            fontSize:      7,
            letterSpacing: "0.12em",
            color:         "#4a3818",
            margin:        0,
          }}
        >
          {quest.giver_name}
          {quest.giver_name && quest.region_id && " · "}
          {quest.region_id?.replace(/_/g, " ")}
        </p>
      )}
      {/* UI-fix-I 4a — side-quest current objective. Same change as
          BreadcrumbBlock above: serif italic narrative register
          replaces the uppercase-tracked chrome treatment. Sentence
          case is what the source content already reads as; the
          uppercase CSS transform was the one forcing it into
          field-label form. */}
      <p
        className="ew-serif italic"
        style={{
          fontSize:      12,
          letterSpacing: "0.01em",
          color:         "#c4b090",
          margin:        0,
        }}
      >
        →&nbsp;{quest.current_objective}
      </p>
      {quest.reward_hint && (
        <p
          className="ew-serif italic"
          style={{ fontSize: 11, color: "#9a7e52", lineHeight: 1.6, margin: 0 }}
        >
          Reward · {quest.reward_hint}
        </p>
      )}
      {hasEntries && (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="ew-sans uppercase self-start"
            style={{
              fontSize:      7,
              letterSpacing: "0.16em",
              color:         "#6a5530",
              background:    "transparent",
              border:        "none",
              padding:       0,
              cursor:        "pointer",
            }}
          >
            {expanded ? "▾ Hide entries" : `▸ ${quest.entries.length} entr${quest.entries.length === 1 ? "y" : "ies"}`}
          </button>
          {expanded && (
            <JournalFeed entries={quest.entries} genre={genre} journalLabel={journalLabel} />
          )}
        </div>
      )}
    </li>
  );
}

// ── Completed tab ────────────────────────────────────────────────────────────

function CompletedTab({ ids }: { ids: string[] }) {
  if (ids.length === 0) {
    return (
      <p className="ew-serif italic" style={{ color: "#6a5530", fontSize: 13 }}>
        No quests completed yet.
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {ids.map((id) => (
        <li
          key={id}
          className="ew-sans uppercase"
          style={{
            fontSize:      8,
            letterSpacing: "0.10em",
            color:         "#9a7e52",
            borderLeft:    "2px solid #5a9a5a",
            paddingLeft:   10,
          }}
        >
          {id.replace(/_/g, " ")}
        </li>
      ))}
    </ul>
  );
}

// ── Failed tab ───────────────────────────────────────────────────────────────

function FailedTab({ ids }: { ids: string[] }) {
  if (ids.length === 0) {
    return (
      <p className="ew-serif italic" style={{ color: "#6a5530", fontSize: 13 }}>
        No quests failed yet.
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {ids.map((id) => (
        <li
          key={id}
          className="ew-sans uppercase"
          style={{
            fontSize:      8,
            letterSpacing: "0.10em",
            color:         "#9a7e52",
            borderLeft:    "2px solid #9a4040",
            paddingLeft:   10,
          }}
        >
          {id.replace(/_/g, " ")}
        </li>
      ))}
    </ul>
  );
}
