"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getAllCodex, getWorldAssetsByCategory } from "@/lib/game/codex";
import { AssetCategory } from "@/types/game";
import type { CodexEntry, MasterState, WorldAsset } from "@/types/game";
import { useGameStore } from "@/lib/stores/game-store";

/**
 * Day 20.4.2 TASK 4 / PR-8v — Codex body, extracted from the standalone
 * codex page so the same renderer runs inside the modal overlay on top
 * of /game without unmounting CombatMode.
 *
 * PR-8v rework:
 *   • ALL tab as default, first in the tab strip
 *   • Inline search bar (case-insensitive name + description + first_seen)
 *   • Compact accordion rows replace the prior card grid
 *   • Inline expanded panel replaces the fixed-position entry-detail modal
 *   • Per-category expanded layout (LOCATION / CHARACTER / FACTION /
 *     ITEM / LORE / BESTIARY)
 *   • Section headers on ALL tab, reverse-insertion order so the most
 *     recently discovered entry sits at the top of each group
 *   • Hardcoded hex values replaced with tokens per the brief's map
 */

type TabId    = "LOCATION" | "CHARACTER" | "FACTION" | "ITEM" | "LORE" | "BESTIARY";
type TabKey   = "ALL" | TabId;

interface TabConfig {
  id:    TabKey;
  label: string;
}

const TABS: TabConfig[] = [
  { id: "ALL",       label: "All"       },
  { id: "LOCATION",  label: "Location"  },
  { id: "CHARACTER", label: "Character" },
  { id: "FACTION",   label: "Faction"   },
  { id: "ITEM",      label: "Item"      },
  { id: "LORE",      label: "Lore"      },
  { id: "BESTIARY",  label: "Bestiary"  },
];

// Per-category left-border colour (Section 11). LORE / FACTION share
// the purple lore tone; ITEM / BESTIARY share the events orange.
// PR-8v replaced the hardcoded #c4943a on CHARACTER with the genre
// accent so the People rows pick up the active genre's primary hue.
const ENTRY_TYPE_COLOR: Record<TabId, string> = {
  LOCATION:  "var(--codex-places)",
  CHARACTER: "var(--genre-accent)",
  LORE:      "#a888c8",
  FACTION:   "#a888c8",
  ITEM:      "var(--codex-events)",
  BESTIARY:  "var(--codex-events)",
};

// Section-header glyphs for the ALL tab. Unicode-only so they render
// at small sizes without an icon dependency. Order follows the tab
// strip so the ALL view groups read in the same sequence as the
// per-category tabs.
const CATEGORY_ICONS: Record<TabId, string> = {
  LOCATION:  "◎",
  CHARACTER: "◉",
  FACTION:   "◈",
  ITEM:      "◆",
  LORE:      "✦",
  BESTIARY:  "⚔",
};

// CATEGORY_ORDER drives the ALL-tab section sequence.
const CATEGORY_ORDER: TabId[] = [
  "LOCATION",
  "CHARACTER",
  "FACTION",
  "ITEM",
  "LORE",
  "BESTIARY",
];

interface Props {
  /** Called when the user picks a codex entry. The host (page or modal)
   *  threads the character name through to the header so the title
   *  reads "Codex — Name" once load resolves. */
  onCharacterNameLoaded?: (name: string) => void;
}

// PR-8v — Bestiary stat parser. CodexEntry has no native stat fields,
// so the bestiary write logic embeds them in the description as a
// pipe-separated header line (e.g. "HP: 4-12 · DMG: 1d6 · ARMOR: +1
// · XP: 15"). Returns undefined per field when the regex misses so
// the expanded view can render blank cells rather than zero/dash
// placeholders that would imply "we know this is 0."
function parseBestiaryStats(desc: string): {
  hp?:     string;
  damage?: string;
  armor?:  string;
  xp?:     string;
} {
  return {
    hp:     desc.match(/HP[:\s]+([\d–\-]+)/i)?.[1],
    damage: desc.match(/(?:DMG|DAMAGE)[:\s]+([\dd+\-]+)/i)?.[1],
    armor:  desc.match(/ARMOR[:\s]+([+\-]?\d+)/i)?.[1],
    xp:     desc.match(/XP[:\s]+(\d+)/i)?.[1],
  };
}

// PR-8v — first 70 chars of description for the closed-row preview
// line. Trims at the nearest word boundary so the ellipsis doesn't
// land mid-syllable; falls back to a hard cut when no space exists
// inside the window.
function previewText(desc: string | undefined, limit = 70): string {
  if (!desc) return "";
  if (desc.length <= limit) return desc;
  const window = desc.slice(0, limit);
  const lastSpace = window.lastIndexOf(" ");
  return (lastSpace > 40 ? window.slice(0, lastSpace) : window) + "…";
}

export function CodexContent({ onCharacterNameLoaded }: Props) {
  const router = useRouter();
  // Always read sessionId from the live game store first — this is the
  // authoritative source for whichever session the player is currently in.
  const storeSessionId     = useGameStore((s) => s.masterState?.metadata.session_id ?? null);
  const storeCharacterName = useGameStore((s) => s.masterState?.player_state.name ?? null);
  // PR-8v — npc_registry powers the CHARACTER expanded view's
  // disposition pill. Selector returns the same reference between
  // store updates unless registry contents change, so the lookup
  // below is cheap.
  const npcRegistry        = useGameStore((s) => s.masterState?.npc_registry);

  const [entries, setEntries]                         = useState<CodexEntry[]>([]);
  const [, setLocationWorldAssets]                    = useState<WorldAsset[]>([]);
  const [activeTab, setActiveTab]                     = useState<TabKey>("ALL");
  const [selectedId, setSelectedId]                   = useState<string | null>(null);
  const [searchQuery, setSearchQuery]                 = useState<string>("");
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

      // Location world assets still pre-fetched for any future
      // expanded-LOCATION enrichment (SVG scenes, etc); the PR-8v
      // accordion doesn't render them inline yet but the data plumb
      // stays so re-adding the scene panel is a render-only change.
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

  // PR-8v — close the inline accordion on Escape. Replaces the prior
  // detail-modal Escape handler (modal retired).
  useEffect(() => {
    if (!selectedId) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setSelectedId(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId]);

  // Switching tabs collapses any expanded row + clears the search.
  // The two side effects sit together because both happen on the
  // same user intent ("show me a different list").
  function handleTabChange(tab: TabKey) {
    setActiveTab(tab);
    setSearchQuery("");
    setSelectedId(null);
  }

  // PR-8v — NEW badge: globally the last 5 codex entries (whatever
  // tab they're in) carry a NEW pill. Membership computed via Set so
  // the per-row lookup is O(1) inside the render loop.
  const newIds = useMemo(() => {
    const tail = entries.slice(-5);
    return new Set(tail.map((e) => e.id));
  }, [entries]);

  // PR-8v — case-insensitive substring match across name +
  // description + first_seen_location. Empty query short-circuits
  // to the identity filter so non-search renders pay nothing extra.
  const searchFilter = useMemo<(e: CodexEntry) => boolean>(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return () => true;
    return (e: CodexEntry) =>
      e.name.toLowerCase().includes(q)
      || (e.description ?? "").toLowerCase().includes(q)
      || (e.first_seen_location ?? "").toLowerCase().includes(q);
  }, [searchQuery]);

  // For the per-category tabs we filter to the active category, then
  // apply the search filter. For ALL we apply only the search and
  // let the section-grouping pass handle category ordering.
  const visibleEntries = useMemo<CodexEntry[]>(() => {
    if (activeTab === "ALL") return entries.filter(searchFilter);
    return entries.filter((e) => e.category === activeTab).filter(searchFilter);
  }, [entries, activeTab, searchFilter]);

  // ALL-tab grouping: build a {category → entries} dict, reversing
  // each list so the newest insertion in a category sits at the top.
  // Empty categories drop out via the .filter at render time.
  const allTabGroups = useMemo(() => {
    const groups: Record<TabId, CodexEntry[]> = {
      LOCATION:  [],
      CHARACTER: [],
      FACTION:   [],
      ITEM:      [],
      LORE:      [],
      BESTIARY:  [],
    };
    for (const e of visibleEntries) groups[e.category].push(e);
    // Reverse in-place per category — newest first per the brief.
    for (const k of CATEGORY_ORDER) groups[k] = groups[k].reverse();
    return groups;
  }, [visibleEntries]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* PR-8v — Tab bar. 7 tabs (ALL + 6) with no emoji icons. At
          mobile widths the strip lets a horizontal scroll fall in
          rather than wrapping the labels onto two rows. Counts sit
          inline after each label as small muted suffixes. */}
      <nav
        className="flex gap-1 px-4 py-2 overflow-x-auto"
        style={{
          borderBottom: "1px solid var(--ui-border-default)",
          // Hide native scrollbar but keep horizontal scrolling
          // available — keeps the tab strip a single row on mobile.
          scrollbarWidth: "none",
        }}
      >
        {TABS.map((tab) => {
          const count =
            tab.id === "ALL"
              ? entries.length
              : entries.filter((e) => e.category === tab.id).length;
          const active = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className="ew-sans uppercase"
              style={{
                background:    "transparent",
                color:         active ? "var(--genre-accent)" : "var(--ui-text-muted)",
                border:        "none",
                borderBottom:  active
                  ? "2px solid var(--genre-accent)"
                  : "2px solid transparent",
                padding:       "6px 10px",
                fontSize:      8,
                letterSpacing: "0.12em",
                cursor:        "pointer",
                transition:    "color 120ms",
                flexShrink:    0,
                whiteSpace:    "nowrap",
              }}
            >
              {tab.label}
              {count > 0 && (
                <span
                  style={{
                    marginLeft: 4,
                    color:      active ? "var(--genre-accent)" : "var(--ui-text-muted)",
                    fontSize:   7,
                    opacity:    0.7,
                  }}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* PR-8v — Search bar. Full width, sits between tabs and the
          body. Filter is client-side on every keystroke (entries
          array is small, no debounce needed). */}
      <div
        className="shrink-0 px-4 py-2"
        style={{ borderBottom: "1px solid var(--ui-border-default)" }}
      >
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search entries..."
          className="ew-serif italic w-full"
          style={{
            background:    "var(--bg-3)",
            border:        "1px solid var(--card-border)",
            borderRadius:  6,
            padding:       "6px 10px",
            fontSize:      11,
            fontStyle:     "italic",
            color:         "var(--ui-text-1)",
            outline:       "none",
          }}
        />
      </div>

      {/* Body — accordion list. Loading + empty states preserved; the
          row + expanded-panel layout is the PR-8v rebuild. */}
      <main className="flex-1 overflow-y-auto px-4 py-4">
        {loading ? (
          <p
            className="ew-serif italic"
            style={{ color: "var(--ui-text-muted)", fontSize: 13 }}
          >
            Loading codex…
          </p>
        ) : visibleEntries.length === 0 ? (
          <p
            className="ew-serif italic mx-auto max-w-md text-center"
            style={{ color: "var(--ui-text-muted)", fontSize: 13 }}
          >
            {searchQuery.trim()
              ? `No entries match "${searchQuery.trim()}".`
              : "Nothing discovered yet in this category."}
          </p>
        ) : activeTab === "ALL" ? (
          // ALL tab — section headers + per-category rows.
          <div className="flex flex-col">
            {CATEGORY_ORDER.map((cat, secIdx) => {
              const list = allTabGroups[cat];
              if (list.length === 0) return null;
              return (
                <section key={cat} style={{ marginTop: secIdx === 0 ? 0 : 14 }}>
                  <header
                    className="ew-sans uppercase"
                    style={{
                      display:       "flex",
                      alignItems:    "center",
                      gap:           6,
                      color:         "var(--ui-text-2)",
                      fontSize:      8,
                      letterSpacing: "0.14em",
                      marginBottom:  6,
                    }}
                  >
                    <span aria-hidden style={{ fontSize: 10 }}>
                      {CATEGORY_ICONS[cat]}
                    </span>
                    <span>{cat}</span>
                    <span style={{ opacity: 0.6 }}>{list.length}</span>
                  </header>
                  <div className="flex flex-col gap-2">
                    {list.map((entry) => (
                      <EntryRow
                        key={entry.id}
                        entry={entry}
                        isOpen={selectedId === entry.id}
                        isNew={newIds.has(entry.id)}
                        onToggle={() =>
                          setSelectedId((id) => (id === entry.id ? null : entry.id))
                        }
                        npcRegistry={npcRegistry}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        ) : (
          // Per-category tabs — flat list, default insertion order.
          <div className="flex flex-col gap-2">
            {visibleEntries.map((entry) => (
              <EntryRow
                key={entry.id}
                entry={entry}
                isOpen={selectedId === entry.id}
                isNew={newIds.has(entry.id)}
                onToggle={() =>
                  setSelectedId((id) => (id === entry.id ? null : entry.id))
                }
                npcRegistry={npcRegistry}
              />
            ))}
          </div>
        )}
      </main>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EntryRow — closed-state compact row + open-state expanded panel.
// One open at a time (parent owns selectedId).
// ─────────────────────────────────────────────────────────────────────────────

interface EntryRowProps {
  entry:       CodexEntry;
  isOpen:      boolean;
  isNew:       boolean;
  onToggle:    () => void;
  npcRegistry: MasterState["npc_registry"] | undefined;
}

function EntryRow({ entry, isOpen, isNew, onToggle, npcRegistry }: EntryRowProps) {
  const isMajor   = entry.significance === "MAJOR";
  const leftColor = ENTRY_TYPE_COLOR[entry.category];
  const subtitle  = entry.first_seen_location
    ? entry.first_seen_location.replace(/_/g, " ")
    : "";

  return (
    <div
      style={{
        background:   "var(--bg-3)",
        border:       "1px solid var(--card-border)",
        borderLeft:   `3px solid ${leftColor}`,
        borderRadius: 7,
        overflow:     "hidden",
      }}
    >
      {/* Closed-state row — clickable shell. Always rendered; the
          expanded panel below mounts when isOpen. */}
      <button
        type="button"
        onClick={onToggle}
        className="group flex w-full items-center text-left transition-colors"
        style={{
          gap:        10,
          padding:    "8px 10px",
          background: "transparent",
          border:     "none",
          cursor:     "pointer",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "var(--bg-elevated)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
        }}
      >
        {/* Left column — name + subtitle + preview. */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            className="ew-sans truncate"
            style={{
              fontFamily:    "var(--sans)",
              fontWeight:    600,
              fontSize:      13,
              color:         "var(--ui-text-1)",
              lineHeight:    1.25,
            }}
          >
            {isMajor && (
              <span
                aria-hidden
                style={{ color: "var(--genre-accent)", marginRight: 4 }}
              >
                ◈
              </span>
            )}
            {entry.name}
          </div>
          {subtitle && (
            <div
              className="ew-serif italic truncate"
              style={{
                fontSize:   11,
                fontStyle:  "italic",
                color:      "var(--ui-text-muted)",
                lineHeight: 1.3,
                marginTop:  1,
              }}
            >
              {subtitle}
            </div>
          )}
          {entry.description && !isOpen && (
            <div
              className="ew-serif italic truncate"
              style={{
                fontSize:   11,
                fontStyle:  "italic",
                color:      "var(--atmosphere)",
                lineHeight: 1.5,
                marginTop:  2,
              }}
            >
              {previewText(entry.description)}
            </div>
          )}
        </div>

        {/* Right badges — NEW pill + (◆ when MAJOR and no ◈ prefix
            already showing). Both flex-shrink:0 so they hug the
            right edge regardless of name length. */}
        <div
          style={{
            display:    "flex",
            alignItems: "center",
            gap:        4,
            flexShrink: 0,
          }}
        >
          {isNew && (
            <span
              className="ew-sans uppercase"
              style={{
                fontFamily:    "var(--sans)",
                fontSize:      7,
                letterSpacing: "0.10em",
                color:         "var(--rarity-uncommon)",
                background:    "color-mix(in srgb, var(--rarity-uncommon) 10%, transparent)",
                border:        "1px solid color-mix(in srgb, var(--rarity-uncommon) 30%, transparent)",
                borderRadius:  10,
                padding:       "1px 6px",
              }}
            >
              New
            </span>
          )}
          {/* MAJOR diamond — only shown when the ◈ prefix isn't
              already lighting up the name line. */}
          {isMajor && (
            <span
              aria-hidden
              style={{
                color:    "var(--genre-accent)",
                fontSize: 11,
                opacity:  0.7,
              }}
            >
              ◆
            </span>
          )}
        </div>
      </button>

      {/* Expanded panel — category-specific layout. Renders inside
          the same card so the left tier-colour bar continues into
          the expansion. */}
      {isOpen && (
        <div
          style={{
            padding:      "10px 12px",
            borderTop:    "1px solid var(--card-border)",
            background:   "var(--bg-0)",
          }}
        >
          <ExpandedPanel entry={entry} npcRegistry={npcRegistry} />
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ExpandedPanel — switches on entry.category to render the right
// structured layout. All labels share the same uppercase 7px muted
// tone; values fork between prose (Cormorant italic) and data (Inter
// Tight 11px ui-text-2) depending on field semantics.
// ─────────────────────────────────────────────────────────────────────────────

interface ExpandedPanelProps {
  entry:       CodexEntry;
  npcRegistry: MasterState["npc_registry"] | undefined;
}

const PANEL_LABEL_STYLE: React.CSSProperties = {
  fontFamily:    "var(--sans)",
  fontSize:      7,
  letterSpacing: "0.12em",
  color:         "var(--ui-text-muted)",
  textTransform: "uppercase",
  display:       "block",
  marginBottom:  2,
};

const PANEL_VALUE_STYLE: React.CSSProperties = {
  fontFamily: "var(--sans)",
  fontSize:   11,
  color:      "var(--ui-text-2)",
  lineHeight: 1.4,
};

const PANEL_PROSE_STYLE: React.CSSProperties = {
  fontFamily: "var(--serif)",
  fontStyle:  "italic",
  fontSize:   12,
  color:      "var(--ui-text-1)",
  lineHeight: 1.7,
  margin:     0,
};

const PANEL_DIVIDER_STYLE: React.CSSProperties = {
  height:     1,
  background: "var(--card-border)",
  margin:     "8px 0",
};

function PanelField({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <span style={PANEL_LABEL_STYLE}>{label}</span>
      <span style={PANEL_VALUE_STYLE}>{value || "—"}</span>
    </div>
  );
}

function ExpandedPanel({ entry, npcRegistry }: ExpandedPanelProps) {
  const sourceLocation = entry.first_seen_location
    ? entry.first_seen_location.replace(/_/g, " ")
    : "";

  // CHARACTER: pull trust → disposition pill from npc_registry.
  if (entry.category === "CHARACTER") {
    const reg = npcRegistry?.[entry.id];
    const trust = reg?.trust_score;
    const dispLabel =
      trust === undefined ? undefined
      : trust <= 20 ? "Hostile"
      : trust <= 40 ? "Suspicious"
      : trust <= 60 ? "Neutral"
      : trust <= 80 ? "Friendly"
      : "Allied";
    const dispColor =
      trust === undefined ? "var(--ui-text-muted)"
      : trust <= 20 ? "#c44040"
      : trust <= 40 ? "#b06030"
      : trust <= 60 ? "#8a6a3a"
      : trust <= 80 ? "#5a9a5a"
      : "#4a8a4a";
    return (
      <>
        {entry.description && <p style={PANEL_PROSE_STYLE}>{entry.description}</p>}
        {(dispLabel || sourceLocation) && (
          <>
            <div style={PANEL_DIVIDER_STYLE} aria-hidden />
            <div
              style={{
                display:    "flex",
                flexWrap:   "wrap",
                gap:        6,
                alignItems: "center",
              }}
            >
              {dispLabel && (
                <span
                  className="ew-sans uppercase"
                  style={{
                    fontSize:      7,
                    letterSpacing: "0.12em",
                    color:         dispColor,
                    background:    `color-mix(in srgb, ${dispColor} 15%, transparent)`,
                    border:        `1px solid color-mix(in srgb, ${dispColor} 40%, transparent)`,
                    borderRadius:  20,
                    padding:       "2px 8px",
                  }}
                >
                  {dispLabel}
                </span>
              )}
              {sourceLocation && (
                <span
                  className="ew-sans uppercase"
                  style={{
                    fontSize:      7,
                    letterSpacing: "0.12em",
                    color:         "var(--ui-text-muted)",
                  }}
                >
                  Met at {sourceLocation}
                </span>
              )}
            </div>
          </>
        )}
      </>
    );
  }

  // BESTIARY: prose + 2×2 stat grid + first-encountered footer.
  if (entry.category === "BESTIARY") {
    const stats = parseBestiaryStats(entry.description ?? "");
    return (
      <>
        {entry.description && <p style={PANEL_PROSE_STYLE}>{entry.description}</p>}
        <div style={PANEL_DIVIDER_STYLE} aria-hidden />
        <div
          style={{
            display:             "grid",
            gridTemplateColumns: "1fr 1fr",
            gap:                 8,
          }}
        >
          <PanelField label="HP Range" value={stats.hp} />
          <PanelField label="Damage"   value={stats.damage} />
          <PanelField label="Armor"    value={stats.armor} />
          <PanelField label="XP Value" value={stats.xp} />
        </div>
        {sourceLocation && (
          <>
            <div style={PANEL_DIVIDER_STYLE} aria-hidden />
            <PanelField label="First encountered" value={sourceLocation} />
          </>
        )}
      </>
    );
  }

  // LOCATION: prose + 2-col TYPE / REGION grid.
  if (entry.category === "LOCATION") {
    return (
      <>
        {entry.description && <p style={PANEL_PROSE_STYLE}>{entry.description}</p>}
        <div style={PANEL_DIVIDER_STYLE} aria-hidden />
        <div
          style={{
            display:             "grid",
            gridTemplateColumns: "1fr 1fr",
            gap:                 8,
          }}
        >
          <PanelField label="Type"   value={entry.category} />
          <PanelField label="Region" value={sourceLocation} />
        </div>
      </>
    );
  }

  // FACTION: prose + territory line.
  if (entry.category === "FACTION") {
    return (
      <>
        {entry.description && <p style={PANEL_PROSE_STYLE}>{entry.description}</p>}
        {sourceLocation && (
          <>
            <div style={PANEL_DIVIDER_STYLE} aria-hidden />
            <PanelField label="Territory" value={sourceLocation} />
          </>
        )}
      </>
    );
  }

  // ITEM: prose + 2-col TYPE / RARITY grid. Rarity is unknown at
  // the CodexEntry layer; leaves both as the category fallback.
  if (entry.category === "ITEM") {
    return (
      <>
        {entry.description && <p style={PANEL_PROSE_STYLE}>{entry.description}</p>}
        <div style={PANEL_DIVIDER_STYLE} aria-hidden />
        <div
          style={{
            display:             "grid",
            gridTemplateColumns: "1fr 1fr",
            gap:                 8,
          }}
        >
          <PanelField label="Type"   value={entry.category} />
          <PanelField label="Rarity" value={undefined} />
        </div>
      </>
    );
  }

  // LORE: prose + source line. lineHeight 1.8 for lore prose only
  // — gives the long-form text more vertical breath.
  if (entry.category === "LORE") {
    return (
      <>
        {entry.description && (
          <p style={{ ...PANEL_PROSE_STYLE, lineHeight: 1.8 }}>
            {entry.description}
          </p>
        )}
        {sourceLocation && (
          <>
            <div style={PANEL_DIVIDER_STYLE} aria-hidden />
            <PanelField label="Source" value={sourceLocation} />
          </>
        )}
      </>
    );
  }

  // Defensive fallback — should never hit (TabId covers every
  // CodexEntry.category union member). Renders bare description.
  return entry.description ? <p style={PANEL_PROSE_STYLE}>{entry.description}</p> : null;
}
