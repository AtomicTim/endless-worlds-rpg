"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { getAllCodex, getWorldAssetsByCategory, normalizeAssetId } from "@/lib/game/codex";
import { AssetCategory } from "@/types/game";
import type { CodexEntry, MasterState, WorldAsset } from "@/types/game";

type TabId = "LOCATION" | "CHARACTER" | "FACTION" | "ITEM" | "LORE" | "BESTIARY";

interface TabConfig {
  id:    TabId;
  label: string;
  icon:  string;
}

const TABS: TabConfig[] = [
  { id: "LOCATION",  label: "Locations",  icon: "🏛" },
  { id: "CHARACTER", label: "Characters", icon: "👤" },
  { id: "FACTION",   label: "Factions",   icon: "🏴" },
  { id: "ITEM",      label: "Items",      icon: "💠" },
  { id: "LORE",      label: "Lore",       icon: "📜" },
  { id: "BESTIARY",  label: "Bestiary",   icon: "⚔" },
];

export default function CodexPage() {
  const router = useRouter();
  const [characterName, setCharacterName]             = useState<string>("");
  const [entries, setEntries]                         = useState<CodexEntry[]>([]);
  const [locationWorldAssets, setLocationWorldAssets] = useState<WorldAsset[]>([]);
  const [characterWorldAssets, setCharacterWorldAssets] = useState<WorldAsset[]>([]);
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
      setCharacterName(session.master_state.player_state.name);
      const sessionId = session.master_state.metadata.session_id;
      const [all, locAssets, charAssets] = await Promise.all([
        getAllCodex(sessionId),
        getWorldAssetsByCategory(sessionId, AssetCategory.LOCATION),
        getWorldAssetsByCategory(sessionId, AssetCategory.CHARACTER),
      ]);
      if (!cancelled) {
        setEntries(all);
        setLocationWorldAssets(locAssets);
        setCharacterWorldAssets(charAssets);
        setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [router]);

  // Close modal on Escape
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
    <div
      className="flex min-h-screen flex-col font-mono"
      style={{ backgroundColor: "var(--color-bg)", color: "var(--color-text)" }}
    >
      {/* Header */}
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
            Codex {characterName ? `— ${characterName}'s World` : ""}
          </h1>
        </div>
        <Link href="/game">
          <Button
            variant="outline"
            size="sm"
            className="font-mono"
            style={{
              borderColor: "color-mix(in srgb, var(--color-primary) 40%, transparent)",
              color:       "var(--color-primary)",
            }}
          >
            ← Back to Game
          </Button>
        </Link>
      </header>

      {/* Tabs */}
      <nav
        className="flex flex-wrap gap-1 px-6 py-3"
        style={{ borderBottom: "1px solid var(--color-border)" }}
      >
        {TABS.map((tab) => {
          const count = entries.filter((e) => e.category === tab.id).length;
          const active = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="rounded-sm px-3 py-1.5 text-xs tracking-wider uppercase transition-colors"
              style={{
                backgroundColor: active ? "var(--color-primary)" : "transparent",
                color:           active ? "#000"                  : "var(--color-text)",
                border:          active
                  ? "1px solid var(--color-primary)"
                  : "1px solid color-mix(in srgb, var(--color-primary) 25%, transparent)",
              }}
            >
              <span className="mr-1.5">{tab.icon}</span>
              {tab.label}
              {count > 0 && (
                <span
                  className="ml-2 text-[10px] opacity-80"
                  style={{ color: active ? "#000" : "var(--color-muted)" }}
                >
                  ({count})
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Body */}
      <main className="flex-1 overflow-y-auto px-6 py-6">
        {loading ? (
          <p className="text-sm" style={{ color: "var(--color-muted)" }}>
            Loading codex…
          </p>
        ) : tabEntries.length === 0 ? (
          <p
            className="mx-auto max-w-md text-center text-sm italic"
            style={{ color: "var(--color-muted)" }}
          >
            Nothing discovered yet in this category.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {tabEntries.map((entry) => {
              const isMajor = entry.significance === "MAJOR";
              const tab = TABS.find((t) => t.id === activeTab);

              // Check name_known for CHARACTER entries
              const charAsset =
                entry.category === "CHARACTER"
                  ? characterWorldAssets.find(
                      (a) => a.id === normalizeAssetId("CHARACTER", entry.name)
                    )
                  : undefined;
              const identityUnknown = charAsset?.name_known === false;

              return (
                <button
                  key={entry.id}
                  onClick={() => setSelected(entry)}
                  className="group flex flex-col gap-2 rounded-sm p-4 text-left transition-colors"
                  style={{
                    backgroundColor: "color-mix(in srgb, var(--color-primary) 6%, transparent)",
                    border:          "1px solid color-mix(in srgb, var(--color-primary) 25%, transparent)",
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{tab?.icon}</span>
                      <span
                        className="text-sm font-bold"
                        style={{ color: "var(--color-primary)" }}
                      >
                        {entry.name}{identityUnknown ? " ?" : ""}
                      </span>
                    </div>
                    {identityUnknown ? (
                      <span
                        className="rounded-sm px-1.5 py-0.5 text-[9px] tracking-wider uppercase"
                        style={{
                          backgroundColor: "color-mix(in srgb, var(--color-muted) 15%, transparent)",
                          color:           "var(--color-muted)",
                        }}
                      >
                        Identity Unknown
                      </span>
                    ) : (
                      <span
                        className="rounded-sm px-1.5 py-0.5 text-[9px] tracking-wider uppercase"
                        style={{
                          backgroundColor: isMajor
                            ? "color-mix(in srgb, #f59e0b 20%, transparent)"
                            : "color-mix(in srgb, var(--color-muted) 15%, transparent)",
                          color: isMajor ? "#fbbf24" : "var(--color-muted)",
                        }}
                      >
                        {entry.significance}
                      </span>
                    )}
                  </div>
                  <p
                    className="line-clamp-3 text-xs leading-relaxed"
                    style={{ color: "var(--color-text)" }}
                  >
                    {entry.description}
                  </p>
                  {entry.first_seen_location && (
                    <p
                      className="text-[10px] italic"
                      style={{ color: "var(--color-muted)" }}
                    >
                      First seen: {entry.first_seen_location.replace(/_/g, " ")}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </main>

      {/* Detail modal */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="w-full max-w-lg rounded-sm p-6"
            style={{
              backgroundColor: "var(--color-bg)",
              border:          "1px solid var(--color-primary)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header — resolves name_known for CHARACTER entries */}
            {(() => {
              const modalCharAsset =
                selected.category === "CHARACTER"
                  ? characterWorldAssets.find(
                      (a) => a.id === normalizeAssetId("CHARACTER", selected.name)
                    )
                  : undefined;
              const modalIdentityUnknown = modalCharAsset?.name_known === false;
              return (
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <p
                      className="text-[10px] tracking-wider uppercase"
                      style={{ color: "var(--color-muted)" }}
                    >
                      {selected.category}
                    </p>
                    <h2
                      className="text-xl font-bold"
                      style={{ color: "var(--color-primary)" }}
                    >
                      {selected.name}{modalIdentityUnknown ? " ?" : ""}
                    </h2>
                    {modalIdentityUnknown && (
                      <span
                        className="mt-1 inline-block rounded-sm px-2 py-0.5 text-[9px] tracking-wider uppercase"
                        style={{
                          backgroundColor: "color-mix(in srgb, var(--color-muted) 15%, transparent)",
                          color:           "var(--color-muted)",
                        }}
                      >
                        Identity Unknown
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => setSelected(null)}
                    className="text-lg"
                    style={{ color: "var(--color-muted)" }}
                    aria-label="Close"
                  >
                    ✕
                  </button>
                </div>
              );
            })()}

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

            <p className="text-sm leading-relaxed" style={{ color: "var(--color-text)" }}>
              {selected.description}
            </p>
            {selected.first_seen_location && (
              <p
                className="mt-4 text-[11px] italic"
                style={{ color: "var(--color-muted)" }}
              >
                First seen at {selected.first_seen_location.replace(/_/g, " ")}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
