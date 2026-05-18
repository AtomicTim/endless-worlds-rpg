"use client";

import { useEffect, useMemo, useState } from "react";
import { useGameStore } from "@/lib/stores/game-store";
import { Genre } from "@/types/game";
import type { MainQuest, QuestEntry, SideQuest } from "@/types/game";

/**
 * UI-7 / PR-9v — Journal / Chronicle modal.
 *
 * Section 12 of /docs/ui-design-reference.md. PR-9v rebuild: the
 * modal now visually mirrors the Codex (PR-8v) so the two surfaces
 * read as siblings — same per-genre background plate, same card
 * style (var(--bg-3) cards with 3px accent left border), same tab
 * indicator (dedicated 2px div below the label, not borderBottom on
 * the button), same section header treatment.
 *
 *  • Per-genre dark plate background matching CodexModal.
 *  • Header: genre-specific title left + day/cycle badge right.
 *  • Two tabs replace the previous four:
 *      QUESTS    — 4 sections (MAIN / SIDE / COMPLETED / FAILED)
 *      JOURNAL   — every entry, every quest, chronological
 *  • QUESTS cards match the Codex EntryRow card style exactly:
 *      bg-3, 3px accent left border, 7px radius, 10/12 padding.
 *      Status-driven accent colour (main quest = genre accent,
 *      active side = ui-text-2, completed = rarity-uncommon,
 *      failed = action-destructive).
 *  • Journal entry expand/collapse retained from the prior design
 *      so a quest's entries stay one click away from the card.
 *  • JOURNAL tab is the full diary — all entries from main +
 *      sides interleaved chronologically, day-grouped via the
 *      existing GENRE_JOURNAL_LABEL + day-header formatter.
 *  • All data logic preserved verbatim: groupEntriesByDay,
 *      formatDayHeader, GENRE_JOURNAL_LABEL, STATUS_LABEL/FG/BG,
 *      ORDINAL_WORD. Presentation only.
 */

type TabId = "quests" | "journal";

interface TabConfig {
  id:    TabId;
  label: string;
}

const TABS: TabConfig[] = [
  { id: "quests",  label: "Quests"  },
  { id: "journal", label: "Journal" },
];

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
  completed: "var(--rarity-uncommon)",
  failed:    "var(--action-destructive)",
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

// PR-9v — per-genre top-of-modal title.
const GENRE_TITLE: Record<Genre, string> = {
  [Genre.FANTASY]:             "Chronicle",
  [Genre.CYBERPUNK]:           "MISSION_LOG",
  [Genre.HORROR_LOVECRAFTIAN]: "Case Files",
  [Genre.SPACE_OPERA]:         "Ship Archive",
  [Genre.POST_APOCALYPTIC]:    "Survival Log",
};

// PR-9v — genre-specific labels for the 4 QUESTS sections:
//   [MAIN, SIDE, COMPLETED, FAILED]
const GENRE_SECTION_LABELS: Record<Genre, [string, string, string, string]> = {
  [Genre.FANTASY]:             ["Main Quest", "Side Quests", "Completed", "Failed"],
  [Genre.CYBERPUNK]:           ["Primary Objective", "Active Ops", "Closed", "Failed"],
  [Genre.HORROR_LOVECRAFTIAN]: ["The Main Case", "Open Threads", "Closed", "Abandoned"],
  [Genre.SPACE_OPERA]:         ["Primary Mission", "Active Assignments", "Resolved", "Abandoned"],
  [Genre.POST_APOCALYPTIC]:    ["The Main Job", "Side Jobs", "Done", "Lost"],
};

// PR-9v — Codex parity: the same 5-genre dark plate map. Hex
// values are already registered in ALLOWED_HEX_CODES from PR-8v
// (CodexModal). The Set dedupes, no test changes needed.
const GENRE_MODAL_BG: Record<Genre, string> = {
  [Genre.FANTASY]:             "#141008",
  [Genre.CYBERPUNK]:           "#0a1414",
  [Genre.HORROR_LOVECRAFTIAN]: "#100808",
  [Genre.SPACE_OPERA]:         "#08080f",
  [Genre.POST_APOCALYPTIC]:    "#161008",
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

// PR-9v — bare day/cycle badge for the modal header.
// Drops the decorative dashes / slashes formatDayHeader uses
// inside the journal feed; produces a single short label suitable
// for a 2x8 pill.
function formatDayBadge(genre: Genre, day: number): string {
  switch (genre) {
    case Genre.FANTASY:             return `DAY ${day}`;
    case Genre.CYBERPUNK:           return `DAY_${String(day).padStart(2, "0")}`;
    case Genre.HORROR_LOVECRAFTIAN: return `Night ${day}`;
    case Genre.SPACE_OPERA:         return `CYCLE ${day}`;
    case Genre.POST_APOCALYPTIC:    return `DAY ${day}`;
    default:                        return `DAY ${day}`;
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

// PR-9v — title-case a region/giver slug for the metadata line.
function toTitleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

export function JournalModal() {
  const open    = useGameStore((s) => s.journalModalOpen);
  const setOpen = useGameStore((s) => s.setJournalModalOpen);
  const qt      = useGameStore((s) => s.masterState?.quest_threads ?? null);
  const genre   = useGameStore((s) => s.masterState?.metadata.genre) ?? Genre.FANTASY;
  const [tab, setTab] = useState<TabId>("quests");

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  // PR-9v — collect every QuestEntry across main + sides for the
  // JOURNAL tab + the day-badge derivation. Computed unconditionally
  // (cheap; tiny arrays) but memoised so the day-badge derivation
  // below doesn't re-walk on every render.
  const mainQuest    = qt?.main_quest ?? null;
  const sideQuests   = qt?.side_quests ?? [];
  const allEntries = useMemo<QuestEntry[]>(() => [
    ...(mainQuest?.journal_entries ?? []),
    ...sideQuests.flatMap((q) => q.entries),
  ], [mainQuest, sideQuests]);

  const currentDay = useMemo(() => {
    if (allEntries.length === 0) return 1;
    const grouped = groupEntriesByDay(allEntries);
    return grouped[grouped.length - 1].day;
  }, [allEntries]);

  if (!open) return null;

  const modalBg      = GENRE_MODAL_BG[genre]      ?? GENRE_MODAL_BG[Genre.FANTASY];
  const titleLabel   = GENRE_TITLE[genre]         ?? GENRE_TITLE[Genre.FANTASY];
  const sectionLabels = GENRE_SECTION_LABELS[genre] ?? GENRE_SECTION_LABELS[Genre.FANTASY];
  const journalLabel = GENRE_JOURNAL_LABEL[genre];

  // PR-9v — counts for the tab badges.
  const visibleSides   = sideQuests.filter((q) => q.discovered === true);
  const activeSides    = visibleSides.filter((q) => q.status === "active");
  const completedSides = visibleSides.filter((q) => q.status === "completed");
  const failedSides    = visibleSides.filter((q) => q.status === "failed");
  const mainActive     = mainQuest && mainQuest.status === "active"    ? mainQuest : null;
  const mainCompleted  = mainQuest && mainQuest.status === "completed" ? mainQuest : null;
  const mainFailed     = mainQuest && mainQuest.status === "failed"    ? mainQuest : null;
  const questsCount    =
    (mainActive ? 1 : 0)
    + activeSides.length
    + (mainCompleted ? 1 : 0) + completedSides.length
    + (mainFailed ? 1 : 0)    + failedSides.length;
  const journalCount   = allEntries.length;

  return (
    <div
      // UI-11 — shared modal entry animation (design ref §14).
      className="fixed inset-0 z-50 flex items-start justify-center modal-backdrop-in"
      style={{ background: "rgba(0,0,0,0.82)" }}
      onClick={() => setOpen(false)}
      role="dialog"
      aria-label={titleLabel}
      aria-modal="true"
    >
      <div
        className="flex flex-col modal-card-in"
        style={{
          // PR-9v — Codex parity: width lifted min(580, 96vw) →
          // min(660, 96vw) and surface bg switched from the shared
          // var(--content-bg) to a per-genre dark plate.
          position:     "relative",
          width:        "min(660px, 96vw)",
          maxHeight:    "88vh",
          margin:       "4vh auto",
          background:   modalBg,
          border:       "1px solid var(--card-border)",
          borderRadius: "var(--card-radius)",
          boxShadow:    "var(--card-shadow)",
          overflow:     "hidden",
          color:        "var(--ink-2)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* UI-1 overlay trio — required by ui-foundation gate. */}
        <div className="ol-tex"  aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 2 }} />
        <div className="ol-scan" aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 2 }} />
        <div className="ol-grid" aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 2 }} />

        <div
          className="relative flex min-h-0 flex-1 flex-col"
          style={{ zIndex: 10 }}
        >
          {/* PR-9v — header: genre title left, day badge centre,
              close right. The badge has a thin accent border + tint
              so it reads as theme chrome rather than a button. */}
          <header
            className="flex shrink-0 items-center justify-between"
            style={{
              padding:      "12px 16px",
              borderBottom: "1px solid var(--ui-border-default)",
              gap:          12,
            }}
          >
            <h1
              className="ew-sans uppercase"
              style={{
                fontFamily:    "var(--sans)",
                fontWeight:    600,
                fontSize:      14,
                letterSpacing: "0.10em",
                color:         "var(--genre-accent)",
                margin:        0,
                lineHeight:    1.2,
              }}
            >
              {titleLabel}
            </h1>
            <span
              className="ew-sans uppercase"
              aria-label={`Current day ${currentDay}`}
              style={{
                fontFamily:    "var(--sans)",
                fontSize:      8,
                letterSpacing: "0.12em",
                color:         "var(--genre-accent)",
                background:    "rgba(var(--genre-accent-rgb), .10)",
                border:        "1px solid rgba(var(--genre-accent-rgb), .30)",
                borderRadius:  4,
                padding:       "2px 8px",
                marginLeft:    "auto",
              }}
            >
              {formatDayBadge(genre, currentDay)}
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close journal"
              style={{
                width:           24,
                height:          24,
                border:          "1px solid var(--ui-border-default)",
                background:      "transparent",
                color:           "var(--ui-text-muted)",
                cursor:          "pointer",
                display:         "inline-flex",
                alignItems:      "center",
                justifyContent:  "center",
              }}
            >
              ✕
            </button>
          </header>

          {/* PR-9v — Tabs: PR-8v-c pattern (column flex + dedicated
              2px indicator div), 2 tabs only. paddingBottom 0 on the
              button keeps the indicator flush above the nav's 1px
              bottom border. */}
          <nav
            className="flex shrink-0 gap-1 px-4 pt-2"
            style={{
              borderBottom:   "1px solid var(--ui-border-default)",
              scrollbarWidth: "none",
            }}
            aria-label="Journal tabs"
          >
            {TABS.map((t) => {
              const isActive = tab === t.id;
              const count = t.id === "quests" ? questsCount : journalCount;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  style={{
                    background:    "transparent",
                    color:         isActive ? "var(--genre-accent)" : "var(--ui-text-muted)",
                    border:        "none",
                    display:       "flex",
                    flexDirection: "column",
                    alignItems:    "stretch",
                    gap:           4,
                    padding:       "6px 10px 0",
                    cursor:        "pointer",
                    transition:    "color 120ms",
                    flexShrink:    0,
                    whiteSpace:    "nowrap",
                  }}
                >
                  <span
                    className="ew-sans uppercase"
                    style={{
                      fontFamily:    "var(--sans)",
                      fontSize:      8,
                      letterSpacing: "0.12em",
                      textAlign:     "center",
                    }}
                  >
                    {t.label}
                    {count > 0 && (
                      <span
                        style={{
                          marginLeft: 4,
                          color:      isActive ? "var(--genre-accent)" : "var(--ui-text-muted)",
                          fontSize:   7,
                          opacity:    0.7,
                        }}
                      >
                        {count}
                      </span>
                    )}
                  </span>
                  <div
                    aria-hidden
                    style={{
                      height:       2,
                      background:   isActive ? "var(--genre-accent)" : "transparent",
                      borderRadius: 1,
                    }}
                  />
                </button>
              );
            })}
          </nav>

          <div
            className="flex-1 overflow-y-auto px-4 py-4"
            style={{ minHeight: 0 }}
          >
            {tab === "quests" ? (
              <QuestsTab
                mainActive={mainActive}
                mainCompleted={mainCompleted}
                mainFailed={mainFailed}
                activeSides={activeSides}
                completedSides={completedSides}
                failedSides={failedSides}
                sectionLabels={sectionLabels}
                genre={genre}
                journalLabel={journalLabel}
              />
            ) : (
              <JournalTab
                entries={allEntries}
                genre={genre}
                journalLabel={journalLabel}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// QUESTS tab — 4 fixed-order sections matching the Codex EntryRow visual
// language. Empty sections drop out, but the order across renders is stable.
// ─────────────────────────────────────────────────────────────────────────────

interface QuestsTabProps {
  mainActive:     MainQuest | null;
  mainCompleted:  MainQuest | null;
  mainFailed:     MainQuest | null;
  activeSides:    SideQuest[];
  completedSides: SideQuest[];
  failedSides:    SideQuest[];
  sectionLabels:  [string, string, string, string];
  genre:          Genre;
  journalLabel:   string;
}

function QuestsTab({
  mainActive, mainCompleted, mainFailed,
  activeSides, completedSides, failedSides,
  sectionLabels, genre, journalLabel,
}: QuestsTabProps) {
  const [mainLabel, sideLabel, completedLabel, failedLabel] = sectionLabels;

  // Aggregate the 4 sections. The completed / failed buckets fold
  // the main quest in alongside side quests when its status puts it
  // in that bucket — there's no separate "MAIN COMPLETED" slot.
  const sections: Array<{
    key:    string;
    label:  string;
    count:  number;
    cards:  React.ReactNode;
  }> = [];
  if (mainActive) {
    sections.push({
      key:   "main",
      label: mainLabel,
      count: 1,
      cards: (
        <MainQuestCard
          key={mainActive.id}
          quest={mainActive}
          genre={genre}
          journalLabel={journalLabel}
        />
      ),
    });
  }
  if (activeSides.length > 0) {
    sections.push({
      key:   "side",
      label: sideLabel,
      count: activeSides.length,
      cards: activeSides.map((q) => (
        <SideQuestCard key={q.id} quest={q} genre={genre} journalLabel={journalLabel} />
      )),
    });
  }
  const completedCount = (mainCompleted ? 1 : 0) + completedSides.length;
  if (completedCount > 0) {
    sections.push({
      key:   "completed",
      label: completedLabel,
      count: completedCount,
      cards: (
        <>
          {mainCompleted && (
            <MainQuestCard
              key={mainCompleted.id}
              quest={mainCompleted}
              genre={genre}
              journalLabel={journalLabel}
            />
          )}
          {completedSides.map((q) => (
            <SideQuestCard key={q.id} quest={q} genre={genre} journalLabel={journalLabel} />
          ))}
        </>
      ),
    });
  }
  const failedCount = (mainFailed ? 1 : 0) + failedSides.length;
  if (failedCount > 0) {
    sections.push({
      key:   "failed",
      label: failedLabel,
      count: failedCount,
      cards: (
        <>
          {mainFailed && (
            <MainQuestCard
              key={mainFailed.id}
              quest={mainFailed}
              genre={genre}
              journalLabel={journalLabel}
            />
          )}
          {failedSides.map((q) => (
            <SideQuestCard key={q.id} quest={q} genre={genre} journalLabel={journalLabel} />
          ))}
        </>
      ),
    });
  }

  if (sections.length === 0) {
    return (
      <p
        className="ew-serif italic"
        style={{ color: "var(--ui-text-muted)", fontSize: 13 }}
      >
        No quests recorded yet.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {sections.map((sec, i) => (
        <section key={sec.key} style={{ marginTop: i === 0 ? 0 : 6 }}>
          <SectionHeader label={sec.label} count={sec.count} />
          <div className="flex flex-col gap-2" style={{ marginTop: 6 }}>
            {sec.cards}
          </div>
        </section>
      ))}
    </div>
  );
}

function SectionHeader({ label, count }: { label: string; count: number }) {
  return (
    <header
      className="ew-sans uppercase"
      style={{
        display:       "flex",
        alignItems:    "center",
        gap:           6,
        color:         "var(--ui-text-2)",
        fontSize:      8,
        letterSpacing: "0.14em",
        borderBottom:  "1px solid var(--card-border)",
        paddingBottom: 4,
      }}
    >
      <span>{label}</span>
      <span style={{ opacity: 0.6 }}>{count}</span>
    </header>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Quest cards — compact layout matching the Codex EntryRow visual:
//   row 1: title (+ status badge right) — optional ◈ for main quest
//   row 2: metadata (giver · region) — Inter Tight 8px muted
//   row 3: prose description — italic 12px ui-text-prose, line-clamp 2
//   row 4 (active only): objective box — tinted genre-accent surface
//   row 5: reward hint — italic 11px atmosphere
//   tail (when entries exist): ▸/▾ JournalFeed toggle
// Completed / failed cards drop the objective box and dim to 0.5.
// ─────────────────────────────────────────────────────────────────────────────

function cardAccentColor(category: "main" | "active-side" | "completed" | "failed"): string {
  switch (category) {
    case "main":        return "var(--genre-accent)";
    case "active-side": return "var(--ui-text-2)";
    case "completed":   return "var(--rarity-uncommon)";
    case "failed":      return "var(--action-destructive)";
  }
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className="ew-sans uppercase"
      style={{
        fontSize:      7,
        letterSpacing: "0.14em",
        padding:       "2px 8px",
        borderRadius:  20,
        background:    STATUS_BG[status] ?? "transparent",
        color:         STATUS_FG[status] ?? "var(--ui-text-muted)",
        flexShrink:    0,
      }}
    >
      {STATUS_LABEL[status] ?? status.toUpperCase()}
    </span>
  );
}

function ObjectiveBox({ text }: { text: string }) {
  return (
    <div
      style={{
        background:   "rgba(var(--genre-accent-rgb), .06)",
        border:       "1px solid rgba(var(--genre-accent-rgb), .20)",
        borderRadius: 5,
        padding:      "6px 10px",
        marginTop:    6,
      }}
    >
      <p
        className="ew-serif italic"
        style={{
          fontSize:   12,
          color:      "var(--ui-text-1)",
          lineHeight: 1.5,
          margin:     0,
        }}
      >
        →&nbsp;{text}
      </p>
    </div>
  );
}

function CardShell({
  accent, dim, children,
}: {
  accent:   string;
  dim:      boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background:   "var(--bg-3)",
        border:       "1px solid var(--card-border)",
        borderLeft:   `3px solid ${accent}`,
        borderRadius: 7,
        padding:      "10px 12px",
        opacity:      dim ? 0.5 : 1,
        display:      "flex",
        flexDirection: "column",
        gap:          4,
      }}
    >
      {children}
    </div>
  );
}

function CardTitle({ title, isMain, status }: {
  title:  string;
  isMain: boolean;
  status: string;
}) {
  return (
    <header
      style={{
        display:    "flex",
        alignItems: "flex-start",
        gap:        8,
      }}
    >
      <h2
        className="ew-sans"
        style={{
          fontFamily: "var(--sans)",
          fontWeight: 600,
          fontSize:   13,
          color:      "var(--ui-text-1)",
          margin:     0,
          lineHeight: 1.3,
          flex:       1,
          minWidth:   0,
        }}
      >
        {isMain && (
          <span aria-hidden style={{ color: "var(--genre-accent)", marginRight: 6 }}>◈</span>
        )}
        {title}
      </h2>
      <StatusBadge status={status} />
    </header>
  );
}

function MetadataLine({ giver, region }: { giver?: string; region?: string }) {
  if (!giver && !region) return null;
  return (
    <p
      className="ew-sans uppercase"
      style={{
        fontSize:      8,
        letterSpacing: "0.12em",
        color:         "var(--ui-text-muted)",
        margin:        0,
      }}
    >
      {giver}
      {giver && region && " · "}
      {region && toTitleCase(region.replace(/_/g, " "))}
    </p>
  );
}

function DescriptionBlock({ text }: { text: string }) {
  return (
    <p
      className="ew-serif italic"
      style={{
        fontFamily:        "var(--serif)",
        fontStyle:         "italic",
        fontSize:          12,
        color:             "var(--ui-text-prose)",
        lineHeight:        1.6,
        margin:            "2px 0 0",
        // Two-line clamp keeps the row at a stable height across
        // cards. Full prose surfaces in the JOURNAL tab.
        display:           "-webkit-box",
        WebkitLineClamp:   2,
        WebkitBoxOrient:   "vertical",
        overflow:          "hidden",
      } as React.CSSProperties}
    >
      {text}
    </p>
  );
}

function EntriesToggle({
  entries, genre, journalLabel,
}: {
  entries:      QuestEntry[];
  genre:        Genre;
  journalLabel: string;
}) {
  const [expanded, setExpanded] = useState(false);
  if (entries.length === 0) return null;
  return (
    <div className="flex flex-col gap-2" style={{ marginTop: 6 }}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="ew-sans uppercase self-start"
        style={{
          fontSize:      7,
          letterSpacing: "0.16em",
          color:         "var(--ui-text-muted)",
          background:    "transparent",
          border:        "none",
          padding:       0,
          cursor:        "pointer",
        }}
      >
        {expanded
          ? "▾ Hide entries"
          : `▸ ${entries.length} entr${entries.length === 1 ? "y" : "ies"}`}
      </button>
      {expanded && <JournalFeed entries={entries} genre={genre} journalLabel={journalLabel} />}
    </div>
  );
}

function MainQuestCard({
  quest, genre, journalLabel,
}: {
  quest:        MainQuest;
  genre:        Genre;
  journalLabel: string;
}) {
  // Latest discovered breadcrumb is the closest analogue to a
  // "current objective" for the main quest; show only on active.
  const latestDiscovered = quest.status === "active"
    ? [...(quest.breadcrumbs ?? [])].reverse().find((b) => b.discovered)
    : undefined;
  const isActive    = quest.status === "active";
  const isCompleted = quest.status === "completed";
  const isFailed    = quest.status === "failed";
  const accent      = cardAccentColor(
    isCompleted ? "completed"
    : isFailed  ? "failed"
    : "main",
  );
  const entries = quest.journal_entries ?? [];

  return (
    <CardShell accent={accent} dim={isCompleted || isFailed}>
      <CardTitle title={quest.title} isMain status={quest.status} />
      {quest.threat_description && (
        <DescriptionBlock text={quest.threat_description} />
      )}
      {isActive && latestDiscovered && (
        <ObjectiveBox text={latestDiscovered.content} />
      )}
      <EntriesToggle entries={entries} genre={genre} journalLabel={journalLabel} />
    </CardShell>
  );
}

function SideQuestCard({
  quest, genre, journalLabel,
}: {
  quest:        SideQuest;
  genre:        Genre;
  journalLabel: string;
}) {
  const isActive    = quest.status === "active";
  const isCompleted = quest.status === "completed";
  const isFailed    = quest.status === "failed";
  const accent      = cardAccentColor(
    isCompleted ? "completed"
    : isFailed  ? "failed"
    : "active-side",
  );
  // Description prose — side quests have no dedicated description
  // field; use the first journal entry text when available (the
  // discovery beat reads as a quest-description analogue) or skip.
  const description = quest.entries[0]?.text;

  return (
    <CardShell accent={accent} dim={isCompleted || isFailed}>
      <CardTitle title={quest.title} isMain={false} status={quest.status} />
      <MetadataLine giver={quest.giver_name} region={quest.region_id} />
      {description && <DescriptionBlock text={description} />}
      {isActive && <ObjectiveBox text={quest.current_objective} />}
      {quest.reward_hint && (
        <p
          className="ew-serif italic"
          style={{
            fontFamily: "var(--serif)",
            fontStyle:  "italic",
            fontSize:   11,
            color:      "var(--atmosphere)",
            lineHeight: 1.5,
            margin:     "2px 0 0",
          }}
        >
          Reward · {quest.reward_hint}
        </p>
      )}
      <EntriesToggle entries={quest.entries} genre={genre} journalLabel={journalLabel} />
    </CardShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// JOURNAL tab — all entries from main + sides, chronological, day-grouped.
// ─────────────────────────────────────────────────────────────────────────────

function JournalTab({
  entries, genre, journalLabel,
}: {
  entries:      QuestEntry[];
  genre:        Genre;
  journalLabel: string;
}) {
  if (entries.length === 0) {
    return (
      <p
        className="ew-serif italic"
        style={{
          color:    "var(--ui-text-muted)",
          fontSize: 13,
        }}
      >
        No entries recorded yet.
      </p>
    );
  }
  return <JournalFeed entries={entries} genre={genre} journalLabel={journalLabel} />;
}

/** Auto-log entries grouped by calendar day with genre-specific day
 *  headers + label. Shared between the QUESTS-tab per-card expansion
 *  (EntriesToggle) and the JOURNAL tab. */
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
              color:         "var(--nav-breadcrumb)",
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
                borderLeft:    "2px solid rgba(196,148,58,.38)",
                paddingLeft:   12,
                paddingTop:    2,
                paddingBottom: 2,
              }}
            >
              <p
                className="ew-sans uppercase"
                style={{
                  fontSize:      7,
                  letterSpacing: "0.16em",
                  color:         "var(--nav-breadcrumb)",
                  margin:        "0 0 2px",
                }}
              >
                {journalLabel}
              </p>
              <p
                className="ew-serif italic"
                style={{
                  fontFamily: "var(--serif)",
                  fontStyle:  "italic",
                  fontSize:   12,
                  color:      "var(--ui-text-prose)",
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
