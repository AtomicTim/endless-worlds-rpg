"use client";

import { BookText } from "lucide-react";
import { useGameStore } from "@/lib/stores/game-store";
import { SidebarPanel } from "./SidebarPanel";
import { LogEntryType } from "@/types/game";

// ── Relative timestamp ────────────────────────────────────────────────────────

function relativeTime(isoString: string): string {
  const diffSec = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (diffSec < 60)    return "just now";
  if (diffSec < 3600)  return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

// ── Entry style config ────────────────────────────────────────────────────────

interface EntryStyle {
  prefix:     string;
  color:      string;
  italic:     boolean;
  smallText:  boolean;
}

const ENTRY_STYLES: Record<LogEntryType, EntryStyle> = {
  [LogEntryType.STORY]: {
    prefix:    "",
    color:     "var(--color-text)",
    italic:    false,
    smallText: false,
  },
  [LogEntryType.COMBAT]: {
    prefix:    "⚔ ",
    color:     "#f87171",
    italic:    false,
    smallText: false,
  },
  [LogEntryType.DISCOVERY]: {
    prefix:    "✦ ",
    color:     "var(--color-accent)",
    italic:    false,
    smallText: false,
  },
  [LogEntryType.DIALOGUE]: {
    prefix:    "“",
    color:     "var(--color-accent)",
    italic:    true,
    smallText: false,
  },
  [LogEntryType.SYSTEM]: {
    prefix:    "",
    color:     "var(--color-muted)",
    italic:    true,
    smallText: true,
  },
  // Day 23C — QUEST entries surface main / side quest breadcrumbs in the
  // Log Book with a ✦ prefix and accent color. Richer presentation lives
  // in the Journal modal; this is the chronological feed marker.
  [LogEntryType.QUEST]: {
    prefix:    "✦ ",
    color:     "var(--color-accent)",
    italic:    true,
    smallText: false,
  },
};

// ── LogBook ───────────────────────────────────────────────────────────────────

export function LogBook() {
  const entries = useGameStore((s) => s.persistedLogEntries);

  return (
    <SidebarPanel
      id="log-book"
      title="Log Book"
      icon={<BookText className="size-3" />}
      defaultCollapsed={true}
    >
      {entries.length === 0 ? (
        <p
          className="text-center text-[10px] italic py-2"
          style={{ color: "var(--color-muted)" }}
        >
          Your story has not yet begun…
        </p>
      ) : (
        <div className="flex max-h-64 flex-col gap-1.5 overflow-y-auto pr-0.5">
          {[...entries].reverse().map((entry) => {
            const style = ENTRY_STYLES[entry.type] ?? ENTRY_STYLES[LogEntryType.STORY];
            return (
              <div key={entry.id} className="flex flex-col gap-0.5">
                <p
                  className={[
                    style.smallText ? "text-[9px]" : "text-[10px]",
                    "leading-relaxed",
                    style.italic ? "italic" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  style={{ color: style.color }}
                >
                  {style.prefix}
                  {entry.content}
                </p>
                <span
                  className="text-[9px]"
                  style={{ color: "var(--color-muted)", opacity: 0.6 }}
                >
                  {relativeTime(entry.timestamp)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </SidebarPanel>
  );
}
