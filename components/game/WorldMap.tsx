"use client";

import { useEffect, useMemo, useState } from "react";
import { Globe2, Map as MapIcon, MapPin } from "lucide-react";
import { AssetCategory } from "@/types/game";
import type { MasterState, WorldAsset, WorldGraph, WorldNode } from "@/types/game";
import { getGenreColors } from "./genre-ui";
import { getNodeTypeAbbr, MAP_NPC_DOT } from "@/lib/game/map-colors";
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
 * Header shows only three icon-buttons (🌍 / 🗺 / 📍). The active tier
 * label and its in-context name (world / region / sub-location) are
 * rendered inside the body, above the active tier component.
 *
 * When the player crosses into a new region, an effect snaps
 * selectedRegionId to the new zone and switches the view to Tier 3 so
 * arrival is instantly readable.
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
  const colors = getGenreColors(masterState.metadata.genre);
  const player = worldGraph.nodes[worldGraph.current_node_id];

  // ── Tier + selection state ─────────────────────────────────────────────────
  const [activeTier, setActiveTier] = useState<Tier>(() => chooseInitialTier(player));
  // Day 20 — initial selectedRegionId tracks the GEOGRAPHIC zone, not
  // the immediate parent. findRootZoneId walks up the zone chain so a
  // player loading inside a tavern still anchors Tier 2 to the broader
  // landscape.
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(
    () => findRootZoneId(worldGraph.current_node_id, worldGraph.nodes) ?? null
  );

  // FIX 1C / FIX 9 / Day 20 — auto-update selectedRegionId when the
  // player crosses regions. We always re-anchor the breadcrumb / focus
  // to the GEOGRAPHIC zone (the topmost `zone_id` chain root) so Tier 2
  // shows the town + region landmarks side by side.
  // Hierarchy under Day 20:
  //   sub_location.zone_id   = settlement node id
  //   settlement.zone_id     = geographic region id
  //   geographic region.zone_id = self
  // The tier switch is conditional: only auto-jump to Tier 3 if the
  // player was already on Tier 3. Tier 1 / 2 viewers stay where they
  // are — they may be planning a journey and shouldn't get yanked.
  useEffect(() => {
    if (!masterState?.world_graph) return;
    const graph         = masterState.world_graph;
    const currentNodeId = graph.current_node_id;
    const rootZoneId    = findRootZoneId(currentNodeId, graph.nodes);
    if (!rootZoneId) return;
    if (rootZoneId !== selectedRegionId) {
      setSelectedRegionId(rootZoneId);
      setActiveTier((cur) => (cur === 3 ? 3 : cur));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [masterState?.world_graph?.current_node_id]);

  // ── Labels for the in-body header ──────────────────────────────────────────
  const wcd        = masterState.metadata.world_consistency;
  const worldName  = wcd?.world_name ?? "World";
  const regionNode = selectedRegionId ? worldGraph.nodes[selectedRegionId] : null;
  const regionName = regionNode?.name ?? "—";

  // Tier 3 context — show the player's CURRENT node name. Under Day 20
  // the geographic zone is its own node, so the settlement's name is
  // distinct from the regionName above (e.g. settlement "Salt-Iron
  // Crossing" inside region "The Salt Plains"). Falling back to the
  // region name covers legacy saves that share an id between region
  // and settlement.
  const tier3Name = player?.name ?? regionName;

  const tierLabel = activeTier === 1 ? "WORLD MAP"
                  : activeTier === 2 ? "REGION MAP"
                  : "LOCAL MAP";
  const tierContext = activeTier === 1 ? worldName
                    : activeTier === 2 ? regionName
                    : tier3Name;

  // ── Tier handlers ─────────────────────────────────────────────────────────
  function handleSelectRegion(regionId: string) {
    setSelectedRegionId(regionId);
    setActiveTier(2);
  }
  function handleSelectNode(nodeId: string) {
    const node = worldGraph.nodes[nodeId];
    if (!node) return;
    // Day 20 — keep selectedRegionId anchored to the geographic root so
    // the Tier 2 viewport remains useful when the player toggles back.
    setSelectedRegionId(findRootZoneId(nodeId, worldGraph.nodes));
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
      {/* Header — icon-only tier toggles. The breadcrumb and text labels
          have moved into the in-body header (below) to free up the header
          row for chrome only. */}
      <div
        className="flex shrink-0 items-center justify-between gap-2 px-3 py-2"
        style={{
          borderBottom: "1px solid var(--color-border)",
          backgroundColor: "var(--color-bg)",
        }}
      >
        <span
          className="text-[10px] tracking-wider uppercase"
          style={{ color: "var(--color-muted)", fontFamily: "var(--font-mono)" }}
        >
          MAP
        </span>
        <TierToggle
          activeTier={activeTier}
          accent={colors.primary}
          onSelect={setActiveTier}
        />
      </div>

      {/* Body: in-body tier title + active tier component + location info. */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {/* Two-line tier header — small-caps label + context name. */}
        <div
          className="flex shrink-0 flex-col gap-0.5 px-3 py-2"
          style={{
            borderBottom: "1px solid var(--color-border)",
            backgroundColor: "var(--color-bg)",
          }}
        >
          <span
            className="text-[9px] tracking-[0.2em] uppercase"
            style={{ color: "var(--color-muted)", fontFamily: "var(--font-mono)" }}
          >
            {tierLabel}
          </span>
          <span
            className="text-[13px] font-bold tracking-wide"
            style={{ color: colors.primary, fontFamily: "var(--font-mono)" }}
          >
            {tierContext}
          </span>
        </div>

        {/* Active tier component */}
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

        {/* Location info panel — sits below the tier body, above the
            footer. Always summarises the player's CURRENT node so the
            information stays anchored to "where am I" regardless of which
            tier you're browsing. */}
        {player && (
          <LocationInfoPanel
            currentNode={player}
            locationAssets={locationAssets}
            accent={colors.primary}
          />
        )}
      </div>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function TierToggle({
  activeTier,
  accent,
  onSelect,
}: {
  activeTier: Tier;
  accent:     string;
  onSelect:   (t: Tier) => void;
}) {
  const items: Array<{ tier: Tier; icon: (active: boolean) => React.ReactNode; label: string }> = [
    { tier: 1, icon: (a) => <Globe2 className={a ? "size-5" : "size-4"} />, label: "World"  },
    { tier: 2, icon: (a) => <MapIcon className={a ? "size-5" : "size-4"} />, label: "Region" },
    { tier: 3, icon: (a) => <MapPin className={a ? "size-5" : "size-4"} />, label: "Local"  },
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
              backgroundColor: isActive
                ? `color-mix(in srgb, ${accent} 14%, transparent)`
                : "transparent",
              border: "none",
              cursor: "pointer",
            }}
          >
            {it.icon(isActive)}
          </button>
        );
      })}
    </div>
  );
}

interface LocationInfoPanelProps {
  currentNode:    WorldNode;
  locationAssets: WorldAsset[];
  accent:         string;
}

function LocationInfoPanel({
  currentNode,
  locationAssets,
  accent,
}: LocationInfoPanelProps) {
  // Resolve the WorldAsset for this location. apply-world-bible writes
  // location assets keyed as "location_<bareId>", but legacy / fallback
  // saves may use the bare id directly — accept either, and fall back to
  // matching by first_seen_location.
  const locationAsset = useMemo(() => {
    return locationAssets.find(
      (a) =>
        a.category === AssetCategory.LOCATION &&
        (a.id === currentNode.id ||
         a.id === `location_${currentNode.id}` ||
         a.id === currentNode.asset_id ||
         a.first_seen_location === currentNode.id)
    );
  }, [locationAssets, currentNode.id, currentNode.asset_id]);

  const npcs = useMemo(() => {
    return currentNode.npc_ids
      .map((id) => {
        const asset = locationAssets.find(
          (a) => a.id === id || a.id === `character_${id}`
        );
        if (!asset) return null;
        return {
          id,
          name: asset.constitution.true_name && asset.name_known
            ? asset.constitution.true_name
            : asset.name,
        };
      })
      .filter((x): x is { id: string; name: string } => x !== null);
  }, [currentNode.npc_ids, locationAssets]);

  const typeAbbr   = getNodeTypeAbbr(currentNode.category ?? currentNode.type);
  const physical   = locationAsset?.constitution.physical_description ??
                     locationAsset?.constitution.atmosphere ??
                     null;
  const snippet    = physical ? extractFirstSentence(physical) : null;

  const keyLandmarks    = locationAsset?.constitution.key_landmarks ?? [];
  const visibleLandmarks = keyLandmarks.slice(0, 4);
  const extraLandmarks   = Math.max(0, keyLandmarks.length - 4);

  return (
    <div
      className="flex shrink-0 flex-col gap-1.5 px-3 py-2"
      style={{
        borderTop:       "1px solid var(--color-border)",
        backgroundColor: "var(--color-bg)",
      }}
    >
      <div className="flex items-baseline gap-2">
        <span
          style={{
            color:      accent,
            fontSize:   13,
            fontWeight: 700,
            fontFamily: "var(--font-mono)",
            lineHeight: 1.15,
          }}
        >
          {currentNode.name}
        </span>
        <span
          style={{
            fontSize:      10,
            fontFamily:    "var(--font-mono)",
            color:         "var(--color-muted)",
            letterSpacing: "0.08em",
          }}
        >
          {typeAbbr}
        </span>
      </div>

      {snippet && (
        <p
          style={{
            fontSize:      11,
            fontStyle:     "italic",
            color:         "var(--color-muted)",
            margin:        0,
            display:       "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow:        "hidden",
            lineHeight:    1.4,
          }}
        >
          {snippet}
        </p>
      )}

      {npcs.length > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-1" style={{ fontSize: 11 }}>
          {npcs.map((npc) => (
            <span key={npc.id} style={{ color: "var(--color-text)" }}>
              <span
                aria-hidden
                style={{
                  color:        MAP_NPC_DOT,
                  marginRight:  4,
                  fontSize:     10,
                  textShadow:   `0 0 4px ${MAP_NPC_DOT}`,
                }}
              >
                ●
              </span>
              {npc.name}
            </span>
          ))}
        </div>
      )}

      {visibleLandmarks.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {visibleLandmarks.map((lm, i) => (
            <span
              key={i}
              style={{
                fontSize:    10,
                fontFamily:  "var(--font-mono)",
                color:       "var(--color-muted)",
                border:      "1px solid color-mix(in srgb, var(--color-border) 80%, transparent)",
                borderRadius: 3,
                padding:     "1px 6px",
              }}
            >
              {lm}
            </span>
          ))}
          {extraLandmarks > 0 && (
            <span
              style={{
                fontSize:   10,
                fontFamily: "var(--font-mono)",
                color:      "var(--color-muted)",
                padding:    "1px 4px",
              }}
            >
              +{extraLandmarks}
            </span>
          )}
        </div>
      )}
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

/**
 * Walk up the zone chain from `nodeId` to the topmost zone — the
 * geographic-region root under the Day 20 hierarchy. Sub-locations
 * point at their settlement; the settlement points at the geographic
 * region; the geographic region points at itself. Cycle-safe via a
 * visited set.
 */
function findRootZoneId(
  nodeId: string,
  nodes:  Record<string, WorldNode>
): string {
  const visited = new Set<string>();
  let cur: WorldNode | undefined = nodes[nodeId];
  while (cur && !visited.has(cur.id)) {
    visited.add(cur.id);
    if (!cur.zone_id || cur.zone_id === cur.id) return cur.id;
    cur = nodes[cur.zone_id];
  }
  return nodeId;
}

/**
 * Pull the first sentence out of a longer paragraph. Used by the
 * Location Info Panel to keep the atmosphere snippet to a couple of
 * lines without truncating mid-word.
 */
function extractFirstSentence(s: string): string {
  const trimmed = s.trim();
  if (!trimmed) return "";
  const match = trimmed.match(/^[^.!?]+[.!?]/);
  return match ? match[0].trim() : trimmed;
}
