"use client";

import { useEffect, useState } from "react";
import { useGameStore } from "@/lib/stores/game-store";
import type { MainQuest, QuestBreadcrumb, QuestEntry, SideQuest } from "@/types/game";

/**
 * Day 23C — Morrowind-style journal modal.
 *
 * Three tabs:
 *   • MAIN QUEST   — main_quest header + discovered breadcrumbs +
 *                    LLM-generated diary entries below each.
 *   • SIDE QUESTS  — shell only (23D populates).
 *   • COMPLETED    — completed_quest_ids list (one-line summaries).
 *   • FAILED       — failed_quest_ids list with reason.
 *
 * Opens on top of /game (z-50 backdrop) so combat / dialogue stay
 * mounted underneath. Mirrors the CodexModal pattern.
 */

type TabId = "main" | "side" | "completed" | "failed";

interface TabConfig {
  id:    TabId;
  label: string;
}

const TABS: TabConfig[] = [
  { id: "main",      label: "MAIN QUEST" },
  { id: "side",      label: "SIDE QUESTS" },
  { id: "completed", label: "COMPLETED" },
  { id: "failed",    label: "FAILED" },
];

const ACT_LABEL: Record<QuestBreadcrumb["act"], string> = {
  1:        "ACT 1",
  2:        "ACT 2",
  3:        "ACT 3",
  climax:   "CLIMAX",
};

const STATUS_LABEL: Record<string, string> = {
  active:    "ACTIVE",
  completed: "COMPLETED",
  failed:    "FAILED",
};
const STATUS_COLOR: Record<string, string> = {
  active:    "var(--accent)",
  completed: "var(--hl-pass)",
  failed:    "var(--combat-enemy-crit, #c0392b)",
};

export function JournalModal() {
  const open    = useGameStore((s) => s.journalModalOpen);
  const setOpen = useGameStore((s) => s.setJournalModalOpen);
  const qt      = useGameStore((s) => s.masterState?.quest_threads ?? null);
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/70"
      onClick={() => setOpen(false)}
      role="dialog"
      aria-label="Journal"
      aria-modal="true"
    >
      <div
        className="flex w-full max-w-5xl flex-col font-mono shadow-2xl"
        style={{
          backgroundColor: "var(--color-bg)",
          color:           "var(--color-text)",
          border:          "1px solid color-mix(in srgb, var(--color-primary) 35%, transparent)",
          margin:          "2vh auto",
          maxHeight:       "96vh",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <header
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: "1px solid var(--color-border)" }}
        >
          <div className="flex items-center gap-3">
            <span className="text-xl">📖</span>
            <h1
              className="text-lg font-bold tracking-wide"
              style={{ color: "var(--color-primary)" }}
            >
              Journal
            </h1>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-xl font-mono"
            style={{ color: "var(--color-muted)" }}
            aria-label="Close journal"
          >
            ✕
          </button>
        </header>

        <div
          className="flex min-h-0 flex-1 flex-col sm:flex-row"
          style={{ borderTop: "0" }}
        >
          {/* Tabs — vertical list on desktop, horizontal scroll on mobile */}
          <nav
            className="flex shrink-0 flex-row gap-1 px-2 py-3 sm:flex-col sm:gap-2 sm:px-3 sm:py-4"
            style={{
              borderRight: "1px solid var(--color-border)",
              minWidth:    180,
              overflowX:   "auto",
            }}
            aria-label="Journal tabs"
          >
            {TABS.map((t) => {
              const isActive = tab === t.id;
              const badge =
                t.id === "side"      ? sideQuests.length :
                t.id === "completed" ? completedIds.length :
                t.id === "failed"    ? failedIds.length :
                0;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className="flex items-center justify-between gap-2 rounded-sm px-3 py-2 text-left transition-colors"
                  style={{
                    background:    isActive ? "color-mix(in srgb, var(--accent) 12%, transparent)" : "transparent",
                    border:        `1px solid ${isActive ? "var(--accent)" : "var(--line-2)"}`,
                    color:         isActive ? "var(--accent)" : "var(--ink-2)",
                    fontFamily:    "var(--mono)",
                    fontSize:      11,
                    letterSpacing: "0.16em",
                  }}
                >
                  <span>{t.label}</span>
                  {badge > 0 && (
                    <span
                      style={{
                        fontSize:        9,
                        padding:         "1px 6px",
                        border:          "1px solid var(--line-2)",
                        color:           "var(--ink-3)",
                      }}
                    >
                      {badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          <div
            className="flex-1 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6"
            style={{ minHeight: 0 }}
          >
            {tab === "main"      && <MainQuestTab mainQuest={mainQuest} />}
            {tab === "side"      && <SideQuestsTab sideQuests={sideQuests} />}
            {tab === "completed" && <CompletedTab ids={completedIds} />}
            {tab === "failed"    && <FailedTab ids={failedIds} />}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Quest tab ───────────────────────────────────────────────────────────

function MainQuestTab({ mainQuest }: { mainQuest: MainQuest | null }) {
  if (!mainQuest) {
    return (
      <p className="ew-serif italic" style={{ color: "var(--color-muted)", fontSize: 13 }}>
        No quest recorded yet.
      </p>
    );
  }

  const discovered = (mainQuest.breadcrumbs ?? []).filter((b) => b.discovered);
  const journalEntries = mainQuest.journal_entries ?? [];

  // Group breadcrumbs by act for the section headers.
  const orderedActs: Array<QuestBreadcrumb["act"]> = [1, 2, 3, "climax"];
  const grouped: Record<string, QuestBreadcrumb[]> = {};
  for (const b of discovered) {
    const key = String(b.act);
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(b);
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <header className="flex flex-col gap-2">
        <h2
          className="ew-serif"
          style={{
            fontSize:   22,
            color:      "var(--color-primary)",
            fontWeight: 700,
            lineHeight: 1.2,
          }}
        >
          {mainQuest.title}
        </h2>
        <div className="flex items-center gap-3">
          <span
            className="inline-flex items-center"
            style={{
              padding:       "2px 8px",
              border:        `1px solid ${STATUS_COLOR[mainQuest.status] ?? "var(--ink-3)"}`,
              color:         STATUS_COLOR[mainQuest.status] ?? "var(--ink-3)",
              fontFamily:    "var(--mono)",
              fontSize:      10,
              letterSpacing: "0.2em",
            }}
          >
            {STATUS_LABEL[mainQuest.status] ?? mainQuest.status.toUpperCase()}
          </span>
        </div>
        <p
          className="ew-serif italic"
          style={{
            fontSize:   13,
            color:      "var(--ink-2)",
            lineHeight: 1.6,
            marginTop:  6,
          }}
        >
          {mainQuest.threat_description}
        </p>
      </header>

      {/* Discoveries */}
      {discovered.length === 0 ? (
        <p
          className="ew-serif italic"
          style={{
            color:      "var(--color-muted)",
            fontSize:   13,
            lineHeight: 1.6,
            borderLeft: "1px solid var(--line-2)",
            paddingLeft: 12,
          }}
        >
          Your journey has only just begun. There is more to uncover.
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          {orderedActs.map((act) => {
            const bcs = grouped[String(act)] ?? [];
            if (bcs.length === 0) return null;
            return (
              <section key={String(act)} className="flex flex-col gap-3">
                <div
                  className="ew-mono"
                  style={{
                    fontSize:      10,
                    letterSpacing: "0.32em",
                    color:         "var(--accent)",
                    borderBottom:  "1px solid var(--line-2)",
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
  breadcrumb,
  entries,
}: {
  breadcrumb: QuestBreadcrumb;
  entries:    QuestEntry[];
}) {
  return (
    <div className="flex flex-col gap-2">
      <p
        className="ew-serif italic"
        style={{
          fontSize:   14,
          color:      "var(--ink-1)",
          lineHeight: 1.6,
        }}
      >
        ✦ {breadcrumb.content}
      </p>
      {entries.map((e) => (
        <p
          key={e.id}
          className="ew-serif"
          style={{
            fontSize:   13,
            color:      "var(--ink-2)",
            lineHeight: 1.65,
            marginLeft: 12,
            paddingLeft: 12,
            borderLeft: "1px solid var(--line-2)",
            fontStyle:  "italic",
          }}
        >
          {e.text}
        </p>
      ))}
    </div>
  );
}

// ── Side Quests tab ──────────────────────────────────────────────────────────

function SideQuestsTab({ sideQuests }: { sideQuests: SideQuest[] }) {
  if (sideQuests.length === 0) {
    return (
      <p className="ew-serif italic" style={{ color: "var(--color-muted)", fontSize: 13 }}>
        No side quests recorded yet.
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-3">
      {sideQuests.map((q) => (
        <li
          key={q.id}
          className="flex flex-col gap-1.5 rounded-sm p-3"
          style={{ border: "1px solid var(--line-2)" }}
        >
          <header className="flex items-center justify-between gap-3">
            <span
              className="ew-serif"
              style={{ fontSize: 15, fontWeight: 700, color: "var(--ink-1)" }}
            >
              {q.title}
            </span>
            <span
              style={{
                fontSize:      9,
                padding:       "1px 6px",
                border:        `1px solid ${STATUS_COLOR[q.status] ?? "var(--ink-3)"}`,
                color:         STATUS_COLOR[q.status] ?? "var(--ink-3)",
                fontFamily:    "var(--mono)",
                letterSpacing: "0.2em",
              }}
            >
              {STATUS_LABEL[q.status] ?? q.status.toUpperCase()}
            </span>
          </header>
          <p
            className="ew-serif italic"
            style={{ fontSize: 12, color: "var(--ink-3)" }}
          >
            {q.current_objective}
          </p>
        </li>
      ))}
    </ul>
  );
}

// ── Completed tab ────────────────────────────────────────────────────────────

function CompletedTab({ ids }: { ids: string[] }) {
  if (ids.length === 0) {
    return (
      <p className="ew-serif italic" style={{ color: "var(--color-muted)", fontSize: 13 }}>
        No quests completed yet.
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {ids.map((id) => (
        <li key={id} className="ew-mono" style={{ fontSize: 12, color: "var(--ink-2)" }}>
          {id}
        </li>
      ))}
    </ul>
  );
}

// ── Failed tab ──────────────────────────────────────────────────────────────

function FailedTab({ ids }: { ids: string[] }) {
  if (ids.length === 0) {
    return (
      <p className="ew-serif italic" style={{ color: "var(--color-muted)", fontSize: 13 }}>
        No quests failed yet.
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {ids.map((id) => (
        <li key={id} className="ew-mono" style={{ fontSize: 12, color: "var(--ink-2)" }}>
          {id}
        </li>
      ))}
    </ul>
  );
}
