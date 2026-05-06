"use client";

import { useEffect, useMemo, useState } from "react";
import { Globe2, Map as MapIcon, MapPin } from "lucide-react";
import type { MasterState, WorldAsset, WorldGraph } from "@/types/game";
import { getGenreColors } from "./genre-ui";
import { WorldMapTier1 } from "./map/WorldMapTier1";
import { WorldMapTier2 } from "./map/WorldMapTier2";
import { WorldMapTier3 } from "./map/WorldMapTier3";

/**
 * Day 19F — Three-tier map container.
 *
 * Tier 1 (World)    — full WCD grid, discovered zones, landmarks.
 * Tier 2 (Regional) — selected region's nodes + exit arrows.
 * Tier 3 (Local)    — current zone's sub-locations + ambient filler.
 *
 * The default tier is determined from the player's current node:
 *   - Inside a sub_location → Tier 3 (local layout).
 *   - Standing on a top-level zone with sub-locations → Tier 3.
 *   - Otherwise → Tier 2 of the current zone.
 *
 * Whenever the player moves to a new node, the breadcrumb / focus snaps
 * to the new location automatically (effect on current_node_id).
 */

interface Props {
  masterState:    MasterState;
  worldGraph:     WorldGraph;
  locationAssets: WorldAsset[];
  /** Navigation redesign — receives a raw node id. Wire to
   *  useGameLoop.navigateTo, which routes via submitAction's
   *  forceMoveToNode option (bypasses the text-pipeline MOVE intercept). */
  onNavigate:     (nodeId: string) => void;
}

type Tier = 1 | 2 | 3;

export function WorldMap({ masterState, worldGraph, locationAssets, onNavigate }: Props) {
  const colors    = getGenreColors(masterState.metadata.genre);
  const player    = worldGraph.nodes[worldGraph.current_node_id];
  const playerZoneId =
    player && player.type === "sub_location" ? player.zone_id : player?.id;

  // ── Tier + selection state ─────────────────────────────────────────────────
  const [activeTier, setActiveTier]             = useState<Tier>(() =>
    chooseInitialTier(player)
  );
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(
    () => playerZoneId ?? null
  );

  // Re-anchor the breadcrumb / focus whenever the player moves.
  useEffect(() => {
    if (playerZoneId) setSelectedRegionId(playerZoneId);
  }, [playerZoneId]);

  // ── Breadcrumb labels ──────────────────────────────────────────────────────
  const wcd        = masterState.metadata.world_consistency;
  const worldName  = wcd?.world_name ?? "World";
  const regionNode = selectedRegionId ? worldGraph.nodes[selectedRegionId] : null;
  const regionName = regionNode?.name ?? "—";
  const playerName = player?.name ?? masterState.world_state.current_location_id;

  // ── Coords + tier handlers ─────────────────────────────────────────────────
  const coords = useMemo(() => {
    if (!player) return null;
    return player.map_position;
  }, [player]);

  function handleSelectRegion(regionId: string) {
    setSelectedRegionId(regionId);
    setActiveTier(2);
  }
  function handleSelectNode(nodeId: string) {
    const node = worldGraph.nodes[nodeId];
    if (!node) return;
    setSelectedRegionId(node.type === "zone" ? node.id : node.zone_id);
    setActiveTier(3);
  }
  function handleNavigateTo(nodeId: string) {
    // Navigation redesign — pass the raw node id straight through.
    // useGameLoop.navigateTo validates against the live graph + the
    // WorldBible's adjacent_regions outlines, then routes via the
    // sanctioned forceMoveToNode channel.
    onNavigate(nodeId);
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full flex-col">
      {/* Header: breadcrumb + tier toggles */}
      <div
        className="flex shrink-0 items-center justify-between gap-2 px-3 py-2"
        style={{
          borderBottom: "1px solid var(--color-border)",
          backgroundColor: "var(--color-bg)",
        }}
      >
        <Breadcrumb
          worldName={worldName}
          regionName={regionName}
          playerName={playerName}
          activeTier={activeTier}
          accent={colors.primary}
          onTier1={() => setActiveTier(1)}
          onTier2={() => setActiveTier(2)}
          onTier3={() => setActiveTier(3)}
        />
        <TierToggle
          activeTier={activeTier}
          accent={colors.primary}
          onSelect={setActiveTier}
        />
      </div>

      {/* Body: active tier component */}
      <div className="min-h-0 flex-1 overflow-hidden">
        {activeTier === 1 && (
          <WorldMapTier1
            masterState={masterState}
            worldGraph={worldGraph}
            onSelectRegion={handleSelectRegion}
          />
        )}
        {activeTier === 2 && selectedRegionId && (
          <WorldMapTier2
            masterState={masterState}
            worldGraph={worldGraph}
            selectedRegionId={selectedRegionId}
            onSelectNode={handleSelectNode}
            onSelectRegion={handleSelectRegion}
          />
        )}
        {activeTier === 3 && (
          <WorldMapTier3
            masterState={masterState}
            worldGraph={worldGraph}
            currentNodeId={worldGraph.current_node_id}
            locationAssets={locationAssets}
            onNavigateTo={handleNavigateTo}
          />
        )}
      </div>

      {/* Footer: current location + coords */}
      <div
        className="flex shrink-0 items-center justify-between px-3 py-2 text-[10px] tracking-wider uppercase"
        style={{
          borderTop:       "1px solid var(--color-border)",
          color:           "var(--color-muted)",
          backgroundColor: "var(--color-bg)",
          fontFamily:      "var(--font-mono)",
        }}
      >
        <span>
          <span style={{ color: colors.primary }}>◆</span> {playerName}
        </span>
        {coords && (
          <span>
            ({coords.x}, {coords.y})
          </span>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

interface BreadcrumbProps {
  worldName:  string;
  regionName: string;
  playerName: string;
  activeTier: Tier;
  accent:     string;
  onTier1:    () => void;
  onTier2:    () => void;
  onTier3:    () => void;
}

function Breadcrumb({
  worldName,
  regionName,
  playerName,
  activeTier,
  accent,
  onTier1,
  onTier2,
  onTier3,
}: BreadcrumbProps) {
  return (
    <nav
      className="flex min-w-0 items-center gap-1 text-[10px] uppercase tracking-wider"
      style={{ fontFamily: "var(--font-mono)", color: "var(--color-muted)" }}
    >
      <BreadcrumbButton
        label={truncate(worldName, 12)}
        active={activeTier === 1}
        accent={accent}
        onClick={onTier1}
      />
      <span style={{ opacity: 0.5 }}>›</span>
      <BreadcrumbButton
        label={truncate(regionName, 14)}
        active={activeTier === 2}
        accent={accent}
        onClick={onTier2}
      />
      <span style={{ opacity: 0.5 }}>›</span>
      <BreadcrumbButton
        label={truncate(playerName, 14)}
        active={activeTier === 3}
        accent={accent}
        onClick={onTier3}
      />
    </nav>
  );
}

function BreadcrumbButton({
  label,
  active,
  accent,
  onClick,
}: {
  label:   string;
  active:  boolean;
  accent:  string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-sm px-1.5 py-0.5 transition-opacity hover:opacity-80"
      style={{
        color:           active ? accent : "var(--color-muted)",
        backgroundColor: active
          ? `color-mix(in srgb, ${accent} 18%, transparent)`
          : "transparent",
        border:          active
          ? `1px solid color-mix(in srgb, ${accent} 50%, transparent)`
          : "1px solid transparent",
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

function TierToggle({
  activeTier,
  accent,
  onSelect,
}: {
  activeTier: Tier;
  accent:     string;
  onSelect:   (t: Tier) => void;
}) {
  const items: Array<{ tier: Tier; icon: React.ReactNode; label: string }> = [
    { tier: 1, icon: <Globe2 className="size-3.5" />, label: "World" },
    { tier: 2, icon: <MapIcon className="size-3.5" />, label: "Region" },
    { tier: 3, icon: <MapPin className="size-3.5" />, label: "Local" },
  ];
  return (
    <div className="flex shrink-0 items-center gap-1">
      {items.map((it) => {
        const isActive = activeTier === it.tier;
        return (
          <button
            key={it.tier}
            onClick={() => onSelect(it.tier)}
            title={it.label}
            aria-label={it.label}
            className="flex items-center justify-center rounded-sm p-1 transition-opacity hover:opacity-80"
            style={{
              color:  isActive ? accent : "var(--color-muted)",
              border: isActive
                ? `1px solid color-mix(in srgb, ${accent} 60%, transparent)`
                : "1px solid color-mix(in srgb, var(--color-border) 60%, transparent)",
              backgroundColor: isActive
                ? `color-mix(in srgb, ${accent} 14%, transparent)`
                : "transparent",
              cursor: "pointer",
            }}
          >
            {it.icon}
          </button>
        );
      })}
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function chooseInitialTier(
  player: import("@/types/game").WorldNode | undefined
): Tier {
  if (!player) return 2;
  // Inside a sub_location → start zoomed-in to the local map.
  if (player.type === "sub_location") return 3;
  // Standing on a settlement node with sub-locations → also start at Tier 3.
  if (player.is_expandable) return 3;
  return 2;
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}
