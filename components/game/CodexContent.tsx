"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getAllCodex, getWorldAssetsByCategory, normalizeAssetId } from "@/lib/game/codex";
import { AssetCategory } from "@/types/game";
import type { CodexEntry, MasterState, WorldAsset } from "@/types/game";
import { useGameStore } from "@/lib/stores/game-store";

/**
 * Day 20.4.2 TASK 4 — Codex body, extracted from app/game/codex/page.tsx
 * so the same renderer can run inside a modal overlay (CodexModal) on
 * top of /game without unmounting CombatMode. The route-based page now
 * wraps this in a header + "back to game" Link; the modal wraps it in
 * an X close button.
 *
 * Pure presentation + data loading — no header/chrome. The host
 * decides how to close (route navigation vs modal toggle).
 */

type TabId = "LOCATION" | "CHARACTER" | "FACTION" | "ITEM" | "LORE" | "BESTIARY";

interface TabConfig {
  id:    TabId;
  label: string;
  icon:  string;
}

const TABS: TabConfig[] = [
  { id: "LOCATION",  label: "Places",     icon: "🏛" },
  { id: "CHARACTER", label: "People",     icon: "👤" },
  { id: "FACTION",   label: "Factions",   icon: "🏴" },
  { id: "ITEM",      label: "Items",      icon: "💠" },
  { id: "LORE",      label: "Lore",       icon: "📜" },
  { id: "BESTIARY",  label: "Bestiary",   icon: "⚔" },
];

// UI-7 — per-category left-border colour (Section 11). The spec's
// 5-tab vocabulary (All · People · Places · Lore · Events) maps onto
// the existing 6-category CodexEntry data as follows; FACTION + ITEM
// fall through to the closest semantic neighbour.
const ENTRY_TYPE_COLOR: Record<TabId, string> = {
  LOCATION:  "#7a9ab8", // muted blue — Places
  CHARACTER: "#c4943a", // amber       — People
  LORE:      "#a888c8", // purple      — Lore
  FACTION:   "#a888c8", // purple      — lore-adjacent
  ITEM:      "#c8885a", // warm orange — Events-adjacent (artifacts)
  BESTIARY:  "#c8885a", // warm orange — Events-adjacent (encounters)
};

interface Props {
  /** Called when the user picks a codex entry and clicks the X to close
   *  the entry's detail overlay. The host (page or modal) reuses the
   *  same close handler for full-page dismissal — they're distinct
   *  concerns: entry detail close vs codex-as-a-whole close. */
  onCharacterNameLoaded?: (name: string) => void;
}

export function CodexContent({ onCharacterNameLoaded }: Props) {
  const router = useRouter();
  // Always read sessionId from the live game store first — this is the
  // authoritative source for whichever session the player is currently in.
  // Falls back to a DB lookup only if the store hasn't been hydrated yet
  // (e.g. direct navigation to /game/codex without visiting /game first).
  const storeSessionId     = useGameStore((s) => s.masterState?.metadata.session_id ?? null);
  const storeCharacterName = useGameStore((s) => s.masterState?.player_state.name ?? null);

  const [entries, setEntries]                         = useState<CodexEntry[]>([]);
  const [locationWorldAssets, setLocationWorldAssets] = useState<WorldAsset[]>([]);
  const [activeTab, setActiveTab]                     = useState<TabId>("LOCATION");
  const [selected, setSelected]                       = useState<CodexEntry | null>(null);
  const [loading, setLoading]                         = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      // ── Resolve sessionId & characterName ──────────────────────────────────
      // Prefer the in-memory game store (always correct for the active session).
      // Only hit the DB when the store has no master_state (e.g. cold load).
      let sessionId = storeSessionId;
      let charName  = storeCharacterName ?? "";

      if (!sessionId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: sessions } = (await (supabase.from("game_sessions") as any)
          .select("id, master_state")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .order("last_played", { ascending: false })
          .limit(1)) as { data: { id: string; master_state: MasterState }[] | null };

        if (cancelled) return;

        if (!sessions || sessions.length === 0) {
          router.push("/game/new");
          return;
        }

        const session = sessions[0];
        sessionId = session.master_state.metadata.session_id;
        charName  = session.master_state.player_state.name;
      }

      if (onCharacterNameLoaded) onCharacterNameLoaded(charName);

      // Day 19E: stopped fetching CHARACTER assets here — the codex page
      // no longer renders an "Identity Unknown" badge, so we don't need
      // them. LOCATION assets still feed the location detail panel.
      const [all, locAssets] = await Promise.all([
        getAllCodex(sessionId),
        getWorldAssetsByCategory(sessionId, AssetCategory.LOCATION),
      ]);
      if (!cancelled) {
        setEntries(all);
        setLocationWorldAssets(locAssets);
        setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [router, storeSessionId, storeCharacterName, onCharacterNameLoaded]);

  // Close entry-detail modal on Escape
  useEffect(() => {
    if (!selected) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setSelected(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  const tabEntries = entries.filter((e) => e.category === activeTab);

  return (
    <>
      {/* UI-7 — Tabs: Inter Tight 8px uppercase. Active = genre accent
          underline + #e2cda0 text; inactive = #4a3818. */}
      <nav
        className="flex flex-wrap gap-1 px-4 py-2"
        style={{ borderBottom: "1px solid #2d2618" }}
      >
        {TABS.map((tab) => {
          const count  = entries.filter((e) => e.category === tab.id).length;
          const active = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="ew-sans uppercase"
              style={{
                background:    "transparent",
                color:         active ? "#e2cda0" : "#4a3818",
                border:        "none",
                borderBottom:  active
                  ? "2px solid var(--genre-accent)"
                  : "2px solid transparent",
                padding:       "6px 10px",
                fontSize:      8,
                letterSpacing: "0.14em",
                cursor:        "pointer",
                transition:    "color 120ms",
              }}
            >
              {tab.label}
              {count > 0 && (
                <span
                  className="ml-1"
                  style={{ color: active ? "#a08870" : "#4a3818", fontSize: 7 }}
                >
                  · {count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Body — single-column stack of entry cards. Each card carries
          a 2px left border in the type colour per Section 11. */}
      <main className="flex-1 overflow-y-auto px-4 py-4">
        {loading ? (
          <p
            className="ew-serif italic"
            style={{ color: "#6a5530", fontSize: 13 }}
          >
            Loading codex…
          </p>
        ) : tabEntries.length === 0 ? (
          <p
            className="ew-serif italic mx-auto max-w-md text-center"
            style={{ color: "#6a5530", fontSize: 13 }}
          >
            Nothing discovered yet in this category.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {tabEntries.map((entry) => {
              // UI-7 (CHANGE 4) — ◈ Notable mark when significance is
              // MAJOR (explicitly set by codex write logic; AI-flagged
              // quest_relevance="key" NPCs etc.). Never automatic.
              const isMajor   = entry.significance === "MAJOR";
              const leftColor = ENTRY_TYPE_COLOR[entry.category];

              return (
                <button
                  key={entry.id}
                  onClick={() => setSelected(entry)}
                  className="group flex flex-col text-left transition-colors"
                  style={{
                    background:   "var(--card-bg)",
                    border:       "1px solid var(--card-border)",
                    borderLeft:   `2px solid ${leftColor}`,
                    borderRadius: "var(--card-radius)",
                    boxShadow:    "var(--card-shadow)",
                    padding:      "8px 10px",
                    gap:          4,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background =
                      "color-mix(in srgb, var(--card-bg) 92%, rgba(var(--genre-accent-rgb), .04))";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "var(--card-bg)";
                  }}
                >
                  <div className="flex items-baseline gap-2">
                    <span
                      className="ew-serif italic truncate"
                      style={{
                        fontSize:   13,
                        color:      "#d4bc88",
                        lineHeight: 1.3,
                        flex:       1,
                        minWidth:   0,
                      }}
                    >
                      {isMajor && (
                        <span
                          aria-hidden
                          style={{
                            color:       "var(--genre-accent)",
                            marginRight: 4,
                          }}
                        >
                          ◈
                        </span>
                      )}
                      {entry.name}
                    </span>
                  </div>
                  <span
                    className="ew-sans uppercase truncate"
                    style={{
                      fontSize:      8,
                      letterSpacing: "0.10em",
                      color:         "#6a5530",
                    }}
                  >
                    {entry.category}
                    {entry.first_seen_location && (
                      <> · {entry.first_seen_location.replace(/_/g, " ")}</>
                    )}
                  </span>
                  {entry.description && (
                    <p
                      className="ew-serif italic line-clamp-2"
                      style={{
                        fontSize:   11,
                        color:      "#9a7e52",
                        lineHeight: 1.6,
                        margin:     "2px 0 0",
                      }}
                    >
                      {entry.description}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </main>

      {/* Detail modal — UI-7: same shell tokens as the codex frame
          itself (var(--content-bg) + var(--card-border) +
          var(--card-radius)) so it reads as a nested surface, not a
          foreign panel. */}
      {selected && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.82)" }}
          onClick={() => setSelected(null)}
        >
          <div
            className="w-full max-w-lg p-6"
            style={{
              background:   "var(--content-bg)",
              border:       "1px solid var(--card-border)",
              borderLeft:   `2px solid ${ENTRY_TYPE_COLOR[selected.category]}`,
              borderRadius: "var(--card-radius)",
              boxShadow:    "var(--card-shadow)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p
                  className="ew-sans uppercase"
                  style={{
                    fontSize:      8,
                    letterSpacing: "0.14em",
                    color:         "#6a5530",
                    margin:        0,
                  }}
                >
                  {selected.category}
                </p>
                <h2
                  className="ew-serif italic"
                  style={{
                    fontSize:   18,
                    color:      "#e2cda0",
                    margin:     "2px 0 0",
                    lineHeight: 1.2,
                  }}
                >
                  {selected.significance === "MAJOR" && (
                    <span
                      aria-hidden
                      style={{
                        color:       "var(--genre-accent)",
                        marginRight: 6,
                      }}
                    >
                      ◈
                    </span>
                  )}
                  {selected.name}
                </h2>
              </div>
              <button
                onClick={() => setSelected(null)}
                aria-label="Close"
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
            </div>

            {/* SVG scene art — LOCATION entries only */}
            {selected.category === "LOCATION" && (() => {
              const normalizedId = normalizeAssetId("LOCATION", selected.name);
              const wa = locationWorldAssets.find(
                (a) => a.id === normalizedId || a.first_seen_location === selected.first_seen_location
              );
              return wa?.svg_content ? (
                <div
                  className="mb-4 overflow-hidden rounded-sm"
                  style={{
                    width:       "100%",
                    aspectRatio: "320 / 200",
                    border:      "1px solid color-mix(in srgb, var(--color-primary) 55%, transparent)",
                    backgroundColor: "var(--color-bg)",
                  }}
                  dangerouslySetInnerHTML={{ __html: wa.svg_content }}
                />
              ) : null;
            })()}

            <p
              className="ew-serif italic"
              style={{
                fontSize:   12,
                color:      "#9a7e52",
                lineHeight: 1.7,
                margin:     0,
              }}
            >
              {selected.description}
            </p>
            {selected.first_seen_location && (
              <p
                className="ew-sans uppercase"
                style={{
                  marginTop:     12,
                  fontSize:      8,
                  letterSpacing: "0.10em",
                  color:         "#6a5530",
                }}
              >
                First seen · {selected.first_seen_location.replace(/_/g, " ")}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
