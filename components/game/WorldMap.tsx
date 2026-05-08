"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AssetCategory } from "@/types/game";
import type { MasterState, WorldAsset, WorldGraph, WorldNode } from "@/types/game";
import { GenreMap, VIEW } from "./map/renderers";
import type { ExitEdge, MapNode, MapConnection, MapExit, Tier } from "./map/renderers";

/**
 * Map Sidebar — redesign per /design/map-sidebar.jsx.
 *
 * Three-tier map UI:
 *   • Tier 1 — World — every discovered top-level zone projected into
 *     the 320×320 viewBox.
 *   • Tier 2 — Region — settlement + region_locations + cross-region
 *     exits.
 *   • Tier 3 — Local — current zone's sub-locations.
 *
 * The genre-themed renderer is picked by GenreMap (paper / circuit /
 * starfield / salvage / black-ink). All node + connection data is
 * computed here so each renderer can stay a pure SVG painter.
 *
 * The container also renders the design's location info panel below
 * the map: monospace type chip, italic serif name, atmosphere snippet,
 * present-NPCs list, and interactable objects.
 */

interface Props {
  masterState:    MasterState;
  worldGraph:     WorldGraph;
  locationAssets: WorldAsset[];
  /** Optional — when set, the ◆ INTERACT panel rows become clickable
   *  buttons that submit "examine <landmark name>" through the normal
   *  action pipeline. Falls back to inert rows when omitted. */
  onExamine?:     (input: string) => void;
  /** Optional — when set, NPC rows in the location panel become clickable
   *  buttons that open dialogue with that NPC. */
  onOpenDialogue?: (npcName: string) => void;
  /** When true, render in mobile bottom-sheet mode (no left border, top
   *  drag handle, rounded top corners). */
  asSheet?:       boolean;
}

export function WorldMap({
  masterState,
  worldGraph,
  locationAssets,
  onExamine,
  onOpenDialogue,
  asSheet = false,
}: Props) {
  const player = worldGraph.nodes[worldGraph.current_node_id];

  // ── Tier + selection state ─────────────────────────────────────────────────
  const [activeTier, setActiveTier] = useState<Tier>(() => chooseInitialTier(player));
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(
    () => findRootZoneId(worldGraph.current_node_id, worldGraph.nodes) ?? null
  );

  // Auto-snap selectedRegionId when the player crosses regions; preserve
  // the player's tier choice unless they were already on Tier 3.
  useEffect(() => {
    if (!masterState?.world_graph) return;
    const graph        = masterState.world_graph;
    const currentNode  = graph.current_node_id;
    const rootZoneId   = findRootZoneId(currentNode, graph.nodes);
    if (!rootZoneId) return;
    if (rootZoneId !== selectedRegionId) {
      setSelectedRegionId(rootZoneId);
      setActiveTier((cur) => (cur === 3 ? 3 : cur));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [masterState?.world_graph?.current_node_id]);

  // ── FIX 1: detect when player is standing on the geographic region zone ─────
  // The LOCAL tab is meaningless there — there are no sub-locations to browse.
  // (Hoisted above the payload/info useMemos so those memos can read it.)
  const isAtRegionZone =
    !!player &&
    player.is_expandable === true &&
    player.zone_id === player.id;

  // Bug 1 — non-settlement standalone zones (dungeons, wilderness)
  // also have no interior layer. Disable LOCAL there too. These are
  // type=zone, is_settlement_node=false, is_expandable=false (mirrors
  // the apply-world-bible flag set), so the predicate is the
  // complement of "settlement hub" / "geographic region zone".
  const isAtNonSettlementZone =
    !!player &&
    player.type === "zone" &&
    player.is_settlement_node !== true &&
    player.is_expandable === false;

  // ── Build the renderer payload for the active tier ────────────────────────
  const payload = useMemo(() => {
    return buildRendererPayload({
      masterState,
      worldGraph,
      activeTier,
      selectedRegionId,
      isAtNonSettlementZone,
    });
  }, [masterState, worldGraph, activeTier, selectedRegionId, isAtNonSettlementZone]);

  // ── Resolve location-info panel data from world assets ─────────────────────
  const info = useMemo(() => {
    return buildLocationInfo({
      currentNode:    player,
      activeTier,
      selectedRegion: selectedRegionId ? worldGraph.nodes[selectedRegionId] : null,
      worldGraph,
      locationAssets,
      masterState,
    });
  }, [player, activeTier, selectedRegionId, worldGraph, locationAssets, masterState]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        width:          asSheet ? "100%" : 320,
        height:         "100%",
        background:     "var(--bg-1)",
        borderRight:    asSheet ? "none" : "1px solid var(--line)",
        borderRadius:   asSheet ? "12px 12px 0 0" : 0,
        display:        "flex",
        flexDirection:  "column",
        position:       "relative",
        overflow:       "hidden",
        fontFamily:     "var(--sans)",
        color:          "var(--ink-2)",
      }}
    >
      <div className="ew-grain" style={{ ["--grain" as string]: 0.18 }} />

      {asSheet && (
        <div
          style={{
            width:        40,
            height:       4,
            background:   "var(--line-2)",
            borderRadius: 2,
            margin:       "10px auto 4px",
          }}
        />
      )}

      {/* Header — ◆ MAP label + tier switcher */}
      <div
        style={{
          padding:      "12px 14px 10px",
          borderBottom: "1px solid var(--line)",
          position:     "relative",
          zIndex:       1,
        }}
      >
        <div
          className="ew-mono"
          style={{
            fontSize:      9,
            letterSpacing: "0.32em",
            color:         "var(--accent)",
            fontWeight:    600,
            marginBottom:  8,
          }}
        >
          ◆ MAP
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <TierBtn id={1} active={activeTier === 1} onSelect={setActiveTier}
            label="WORLD"
            icon={(
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.1" />
                <path d="M 1.5 7 L 12.5 7 M 7 1.5 Q 4 7 7 12.5 M 7 1.5 Q 10 7 7 12.5"
                  stroke="currentColor" strokeWidth="0.7" />
              </svg>
            )}
          />
          <TierBtn id={2} active={activeTier === 2} onSelect={setActiveTier}
            label="REGION"
            icon={(
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M 1 4 L 5 2 L 9 4 L 13 2 L 13 10 L 9 12 L 5 10 L 1 12 Z"
                  stroke="currentColor" strokeWidth="1.1" />
                <path d="M 5 2 L 5 10 M 9 4 L 9 12"
                  stroke="currentColor" strokeWidth="0.7" />
              </svg>
            )}
          />
          <TierBtn id={3} active={activeTier === 3} onSelect={setActiveTier}
            label="LOCAL"
            disabled={isAtRegionZone || isAtNonSettlementZone}
            icon={(
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M 7 13 Q 2 8 2 5 A 5 5 0 1 1 12 5 Q 12 8 7 13 Z"
                  stroke="currentColor" strokeWidth="1.1" />
                <circle cx="7" cy="5.5" r="1.5" fill="currentColor" />
              </svg>
            )}
          />
        </div>
      </div>

      {/* Map area — square aspect ratio so renderers fit their 320×320 viewBox.
           FIX 4: when Tier 2 has no nodes the region is undiscovered — show a
           placeholder instead of an empty grid. */}
      {activeTier === 2 && payload.nodes.length === 0 ? (
        <div
          style={{
            aspectRatio:    "1",
            flexShrink:     0,
            display:        "flex",
            flexDirection:  "column",
            alignItems:     "center",
            justifyContent: "center",
            background:     "var(--bg-0)",
            gap:            8,
            padding:        24,
            textAlign:      "center",
          }}
        >
          <div
            className="ew-mono"
            style={{ fontSize: 9, letterSpacing: "0.3em", color: "var(--ink-4)" }}
          >
            ◇ UNDISCOVERED TERRITORY
          </div>
          <div
            className="ew-serif"
            style={{
              fontSize:   13,
              color:      "var(--ink-3)",
              fontStyle:  "italic",
              lineHeight: 1.5,
            }}
          >
            Travel here to reveal what lies within.
          </div>
        </div>
      ) : (
        <div style={{ position: "relative", aspectRatio: "1", flexShrink: 0 }}>
          <GenreMap
            genre={masterState.metadata.genre}
            tier={activeTier}
            title={payload.title}
            subtitle={payload.subtitle}
            nodes={payload.nodes}
            connections={payload.connections}
            exits={payload.exits}
            npcMode
          />
        </div>
      )}

      {/* Location info panel — visible on every tier. The "◆ CURRENT
           LOCATION" eyebrow hides at the World tier, where the panel
           describes the geographic region instead of a discrete current
           location and the eyebrow would read as misleading. */}
      <div
        className="ew-scroll"
        style={{
          flex:        1,
          minHeight:   0,
          overflowY:   "auto",
          padding:     "14px 16px",
          borderTop:   "1px solid var(--line)",
          background:  "var(--bg-0)",
        }}
      >
        {activeTier !== 1 && (
        <div
          className="ew-mono"
          style={{
            fontSize:      8,
            letterSpacing: "0.25em",
            color:         "var(--ink-4)",
            marginBottom:  4,
          }}
        >
          ◆ CURRENT LOCATION
        </div>
        )}
        <div
          className="ew-mono"
          style={{
            fontSize:      9,
            letterSpacing: "0.3em",
            color:         "var(--accent)",
            marginBottom:  4,
            fontWeight:    600,
          }}
        >
          {info.type}
        </div>
        <div
          className="ew-serif"
          style={{
            fontStyle:    "italic",
            fontSize:     18,
            color:        "var(--ink-1)",
            marginBottom: 8,
            lineHeight:   1.2,
          }}
        >
          {info.title}
        </div>
        {info.atmosphere && (
          <div
            className="ew-serif"
            style={{
              fontSize:     13,
              color:        "var(--ink-2)",
              lineHeight:   1.6,
              marginBottom: 14,
              fontStyle:    "italic",
            }}
          >
            {info.atmosphere}
          </div>
        )}

        {info.npcs.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div
              className="ew-mono"
              style={{
                fontSize:      8,
                letterSpacing: "0.2em",
                color:         "var(--ink-4)",
                marginBottom:  6,
              }}
            >
              PRESENT
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {info.npcs.map((npc) => (
                <button
                  key={npc.id}
                  type="button"
                  onClick={onOpenDialogue ? () => onOpenDialogue(npc.name) : undefined}
                  disabled={!onOpenDialogue}
                  style={{
                    display:       "flex",
                    alignItems:    "center",
                    gap:           8,
                    width:         "100%",
                    padding:       "8px 10px",
                    background:    "var(--bg-2)",
                    border:        "1px solid var(--line)",
                    borderRadius:  3,
                    cursor:        onOpenDialogue ? "pointer" : "default",
                    color:         "var(--ink-1)",
                    fontFamily:    "var(--mono)",
                    fontSize:      10,
                    textAlign:     "left",
                    transition:    "background 150ms, border-color 150ms",
                  }}
                  onMouseEnter={(e) => {
                    if (!onOpenDialogue) return;
                    e.currentTarget.style.background   = "var(--bg-3)";
                    e.currentTarget.style.borderColor  = "var(--accent)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background   = "var(--bg-2)";
                    e.currentTarget.style.borderColor  = "var(--line)";
                  }}
                >
                  <span
                    style={{
                      width:        6,
                      height:       6,
                      borderRadius: "50%",
                      background:   "var(--accent)",
                      flexShrink:   0,
                    }}
                  />
                  <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {npc.name}
                    {npc.role && (
                      <span
                        style={{
                          marginLeft:    8,
                          fontSize:      8,
                          color:         "var(--ink-4)",
                          letterSpacing: "0.15em",
                          textTransform: "uppercase" as const,
                        }}
                      >
                        {npc.role}
                      </span>
                    )}
                  </span>
                  {onOpenDialogue && (
                    <span
                      style={{
                        fontSize:      8,
                        color:         "var(--accent)",
                        letterSpacing: "0.18em",
                        flexShrink:    0,
                      }}
                    >
                      TALK →
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {info.landmarks.length > 0 && (
          <div>
            <div
              className="ew-mono"
              style={{
                fontSize:      8,
                letterSpacing: "0.3em",
                color:         "var(--ink-4)",
                marginBottom:  6,
              }}
            >
              ◆ INTERACT
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {info.landmarks.map((lm, i) => {
                const clickable = !!onExamine;
                const submit = () => onExamine?.(`examine ${lm}`);
                return (
                  <button
                    key={`${lm}-${i}`}
                    type="button"
                    onClick={clickable ? submit : undefined}
                    disabled={!clickable}
                    title={lm}
                    style={{
                      display:        "flex",
                      alignItems:     "center",
                      gap:            8,
                      padding:        "6px 8px",
                      border:         "1px dashed var(--line-2)",
                      background:     "transparent",
                      cursor:         clickable ? "pointer" : "default",
                      width:          "100%",
                      textAlign:      "left",
                      transition:     "background 120ms",
                    }}
                    onMouseEnter={(e) => {
                      if (!clickable) return;
                      e.currentTarget.style.background =
                        "color-mix(in srgb, var(--accent) 6%, transparent)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <span
                      className="ew-mono"
                      style={{
                        fontSize:      9,
                        color:         "var(--accent)",
                        letterSpacing: "0.18em",
                        textTransform: "uppercase",
                        flexShrink:    0,
                      }}
                    >
                      EXAMINE ›
                    </span>
                    <span
                      className="ew-serif"
                      style={{
                        fontSize:     12,
                        color:        "var(--ink-2)",
                        fontStyle:    "italic",
                        flex:         1,
                        minWidth:     0,
                        overflow:     "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace:   "nowrap",
                      }}
                    >
                      {lm}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Tier button ─────────────────────────────────────────────────────────────

interface TierBtnProps {
  id:        Tier;
  active:    boolean;
  label:     string;
  icon:      React.ReactNode;
  onSelect:  (t: Tier) => void;
  /** FIX 1 — when true the button is dimmed and unclickable. */
  disabled?: boolean;
}

function TierBtn({ id, active, label, icon, onSelect, disabled }: TierBtnProps) {
  return (
    <button
      onClick={() => { if (!disabled) onSelect(id); }}
      title={label}
      disabled={disabled}
      style={{
        flex:           1,
        padding:        "8px 0",
        background:     active ? "var(--accent-faint)" : "transparent",
        border:         active ? "1px solid var(--accent)" : "1px solid var(--line-2)",
        borderRadius:   2,
        color:          active ? "var(--accent)" : "var(--ink-3)",
        cursor:         disabled ? "not-allowed" : "pointer",
        opacity:        disabled ? 0.35 : 1,
        display:        "flex",
        flexDirection:  "column",
        alignItems:     "center",
        gap:            3,
        fontFamily:     "var(--mono)",
        fontSize:       8,
        letterSpacing:  "0.18em",
        transition:     "all 120ms",
      }}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

// ── Renderer payload builder ────────────────────────────────────────────────

interface PayloadInputs {
  masterState:           MasterState;
  worldGraph:            WorldGraph;
  activeTier:            Tier;
  selectedRegionId:      string | null;
  /** Bug 1 — when the player is standing on a non-settlement standalone
   *  zone (dungeon, wilderness), Tier 3 has no content to render; redirect
   *  to the region tier so the player still sees their position in context. */
  isAtNonSettlementZone: boolean;
}

interface RendererPayload {
  title:       string;
  subtitle:    string;
  nodes:       MapNode[];
  connections: MapConnection[];
  exits:       MapExit[];
}

/**
 * Fit-to-viewBox layout engine.
 *
 * The previous topology BFS ignored each node's `map_position` and
 * laid everything out as concentric rings — which made the map
 * visually consistent across runs but destroyed any relationship
 * between the generated world's geography and what the player saw.
 *
 * After the WorldBible skeleton was tightened (every location gets a
 * unique grid_position) and apply-world-bible deduplicates any
 * remaining collisions, we can trust map_position again and project
 * those real coordinates straight into the 320×320 viewBox.
 *
 *   • Compute the bounding box of every positioned node.
 *   • Enforce a minimum range so a single node doesn't collapse to a
 *     point and so a tightly-clustered group still gets some breathing
 *     room.
 *   • Linearly scale into the padded viewBox (PAD-margin on every side).
 *   • Nodes without a `map_position` (rare — mostly legacy saves) fan
 *     around the centroid in a synthetic circle so they stay visible.
 *
 * Positions are deterministic and stable across navigation: clicking a
 * node to travel does not change layout.
 */
// Bug 4 — bumped 60 → 76 so node labels and exit arrows have more
// breathing room from the 320×320 viewBox edges. Below 76, longer
// names ("The Bellhaven Crossing") clip against the edge in the
// Tier 2 / Tier 3 layouts.
const PAD = 76;

function fitToViewBox(
  nodes: WorldNode[]
): Map<string, { x: number; y: number }> {
  const result = new Map<string, { x: number; y: number }>();
  if (nodes.length === 0) return result;

  const withPos = nodes.filter(
    (n) => n.map_position && typeof n.map_position.x === "number"
  );
  const withoutPos = nodes.filter(
    (n) => !n.map_position || typeof n.map_position.x !== "number"
  );

  // Bounding box from positioned nodes; default to (0,0) when nothing
  // has a real position so the synthetic-circle fallback below sits on
  // the viewBox centre.
  let minX = 0, maxX = 0, minY = 0, maxY = 0;
  if (withPos.length > 0) {
    minX = Math.min(...withPos.map((n) => n.map_position!.x));
    maxX = Math.max(...withPos.map((n) => n.map_position!.x));
    minY = Math.min(...withPos.map((n) => n.map_position!.y));
    maxY = Math.max(...withPos.map((n) => n.map_position!.y));
  }

  // Enforce minimum spread so a single node (or a cohort all at the
  // same coord that survived dedup) doesn't collapse to one point.
  const MIN_RANGE = 3;
  if (maxX - minX < MIN_RANGE) {
    const mid = (minX + maxX) / 2;
    minX = mid - MIN_RANGE / 2;
    maxX = mid + MIN_RANGE / 2;
  }
  if (maxY - minY < MIN_RANGE) {
    const mid = (minY + maxY) / 2;
    minY = mid - MIN_RANGE / 2;
    maxY = mid + MIN_RANGE / 2;
  }

  const dx = maxX - minX;
  const dy = maxY - minY;
  const usableW = VIEW - PAD * 2;
  const usableH = VIEW - PAD * 2;

  // Linear scale of grid coords into the padded viewBox.
  for (const n of withPos) {
    result.set(n.id, {
      x: PAD + ((n.map_position!.x - minX) / dx) * usableW,
      y: PAD + ((n.map_position!.y - minY) / dy) * usableH,
    });
  }

  // Synthetic placement for nodes missing real coords — tidy circle
  // around the viewBox centre so they're visible but obviously not
  // anchored to specific geography.
  if (withoutPos.length > 0) {
    const cx = VIEW / 2;
    const cy = VIEW / 2;
    const r  = Math.min(usableW, usableH) * 0.3;
    withoutPos.forEach((n, i) => {
      const angle = (i / withoutPos.length) * 2 * Math.PI - Math.PI / 2;
      result.set(n.id, {
        x: Math.max(PAD, Math.min(VIEW - PAD, cx + Math.cos(angle) * r)),
        y: Math.max(PAD, Math.min(VIEW - PAD, cy + Math.sin(angle) * r)),
      });
    });
  }

  return result;
}

/** Build the deduped Array<[string,string]> connection list from a
 *  candidate set. Each undirected edge appears once. Edges to nodes
 *  outside the candidate set are dropped (they become exits instead). */
function connectionPairs(
  candidates: WorldNode[],
  included:   Set<string>
): Array<[string, string]> {
  const pairs: Array<[string, string]> = [];
  const seen  = new Set<string>();
  for (const n of candidates) {
    for (const c of n.connections) {
      if (!included.has(c)) continue;
      const key = [n.id, c].sort().join("→");
      if (seen.has(key)) continue;
      seen.add(key);
      pairs.push([n.id, c]);
    }
  }
  return pairs;
}

/**
 * Tag every exit with the edge of the viewBox where its label should
 * be rendered. Edges fall out of the source node's relative position:
 * sources on the right half of the viewBox land their labels on the
 * right edge, and so on. Labels that share an edge stack along the
 * perpendicular axis in the renderer rather than pile in one corner.
 */
function distributeExits(exits: MapExit[]): MapExit[] {
  return exits.map((e) => ({
    ...e,
    edge: classifyExitEdge(e.fromX, e.fromY),
  }));
}

function classifyExitEdge(fromX: number, fromY: number): ExitEdge {
  if (fromX > VIEW * 0.6) return "right";
  if (fromX < VIEW * 0.4) return "left";
  if (fromY < VIEW * 0.4) return "top";
  if (fromY > VIEW * 0.6) return "bottom";
  return "right";
}

function buildRendererPayload({
  masterState,
  worldGraph,
  activeTier,
  selectedRegionId,
  isAtNonSettlementZone,
}: PayloadInputs): RendererPayload {
  const wcd     = masterState.metadata.world_consistency;
  const player  = worldGraph.nodes[worldGraph.current_node_id];

  if (activeTier === 1) {
    return buildWorldTier({ wcd, worldGraph });
  }
  if (activeTier === 2 && selectedRegionId) {
    const region = worldGraph.nodes[selectedRegionId];
    return buildRegionTier({ region, worldGraph });
  }
  // Tier 3
  // FIX 1 — if the player is standing on the geographic region zone itself
  // (is_expandable + self-zoned), LOCAL has no content; redirect to region.
  // Bug 1 — same redirect for non-settlement standalone zones; the current
  // node IS the region landmark of interest.
  const isAtRegionZoneInPayload =
    !!player && player.is_expandable === true && player.zone_id === player.id;
  if (isAtRegionZoneInPayload || isAtNonSettlementZone) {
    if (player) {
      return buildRegionTier({ region: player, worldGraph });
    }
  }

  // FIX 6 — resolve zoneId to the settlement hub via an explicit IIFE so
  // we never accidentally pass the geographic region zone to buildLocalTier.
  const zoneId = (() => {
    const raw     = player && player.type === "sub_location"
      ? player.zone_id
      : worldGraph.current_node_id;
    const rawNode = worldGraph.nodes[raw];
    // If raw IS the geographic region zone, walk down to the settlement hub.
    if (rawNode?.is_expandable === true && rawNode?.zone_id === rawNode?.id) {
      const hub = Object.values(worldGraph.nodes).find(
        (n) => n.zone_id === raw && n.is_settlement_node === true
      );
      if (hub) return hub.id;
    }
    return raw;
  })();
  return buildLocalTier({ zoneId, worldGraph });
}

function buildWorldTier({
  wcd, worldGraph,
}: {
  wcd:        MasterState["metadata"]["world_consistency"] | undefined;
  worldGraph: WorldGraph;
}): RendererPayload {
  // FIX 2 — World tier shows ONLY the geographic-region zones
  // (is_expandable === true). The settlement and standalone region
  // locations belong on the Region tier, not here. Show both
  // discovered AND undiscovered so the player sees the broader map
  // shape — undiscovered ones are dimmed by the renderer.
  const candidates = Object.values(worldGraph.nodes).filter(
    (n) => n.is_expandable === true
  );
  const included      = new Set<string>(candidates.map((n) => n.id));
  const discoveredIds = new Set<string>(
    candidates.filter((n) => n.discovered).map((n) => n.id)
  );

  // Only discovered-zone edges produce drawn lines — rumored hints
  // float at their own coords until reached.
  const allPairs = connectionPairs(candidates, included);
  const connPairs = allPairs.filter(
    ([a, b]) => discoveredIds.has(a) && discoveredIds.has(b)
  );

  const positions = fitToViewBox(candidates);

  const nodes: MapNode[] = candidates.map((n) => {
    const pos = positions.get(n.id) ?? { x: VIEW / 2, y: VIEW / 2 };
    return {
      id:            n.id,
      name:          n.name,
      type:          n.type,
      category:      n.category,
      x:             pos.x,
      y:             pos.y,
      isCurrent:     n.id === worldGraph.current_node_id ||
                     worldGraph.nodes[worldGraph.current_node_id]?.zone_id === n.id,
      isDiscovered:  n.discovered,
      isExpandable:  n.is_expandable,
      npcCount:      n.npc_ids?.length ?? 0,
    };
  });

  const connections: MapConnection[] = connPairs.map(([a, b]) => {
    const aPos = positions.get(a) ?? { x: VIEW / 2, y: VIEW / 2 };
    const bPos = positions.get(b) ?? { x: VIEW / 2, y: VIEW / 2 };
    const target = worldGraph.nodes[b];
    return {
      fromX: aPos.x, fromY: aPos.y,
      toX:   bPos.x, toY:   bPos.y,
      visited: target?.discovered ?? false,
    };
  });

  const knownCount = candidates.filter((n) => n.discovered).length;
  const rumored    = candidates.length - knownCount;
  return {
    title:       wcd?.world_name ?? "World",
    // FIX B3 — drop the world_tagline subtitle. It duplicated the
    // world prose now rendered in the description panel below the
    // map and crowded the title row at the top of the canvas.
    // Show region counts instead so the player has at-a-glance
    // discovery progress on the World tier.
    subtitle:    `${knownCount} known · ${rumored} rumored`,
    nodes,
    connections,
    exits:       [],
  };
}

function buildRegionTier({
  region, worldGraph,
}: {
  region:     WorldNode | undefined;
  worldGraph: WorldGraph;
}): RendererPayload {
  if (!region) {
    return { title: "—", subtitle: "no region", nodes: [], connections: [], exits: [] };
  }
  // FIX 2 — Region tier shows WHAT IS INSIDE the geographic region:
  // the settlement and any standalone region_locations. The region
  // node itself belongs on the World tier and is excluded here so
  // the two tiers don't render the same nodes.
  // FIX 3 — include both discovered and undiscovered so the player
  // sees the layout of the area even before exploring it.
  const candidates = Object.values(worldGraph.nodes).filter(
    (n) => n.zone_id === region.id && n.id !== region.id
  );
  const included = new Set<string>(candidates.map((n) => n.id));

  const connPairs = connectionPairs(candidates, included);
  const positions = fitToViewBox(candidates);

  const nodes: MapNode[] = candidates.map((n) => {
    const pos = positions.get(n.id) ?? { x: VIEW / 2, y: VIEW / 2 };
    return {
      id:            n.id,
      name:          n.name,
      type:          n.type,
      category:      n.category,
      x:             pos.x,
      y:             pos.y,
      isCurrent:     n.id === worldGraph.current_node_id,
      isDiscovered:  n.discovered,
      isExpandable:  n.is_expandable,
      npcCount:      n.npc_ids?.length ?? 0,
    };
  });

  const connections: MapConnection[] = connPairs.map(([a, b]) => {
    const aPos = positions.get(a) ?? { x: VIEW / 2, y: VIEW / 2 };
    const bPos = positions.get(b) ?? { x: VIEW / 2, y: VIEW / 2 };
    const target = worldGraph.nodes[b];
    return {
      fromX: aPos.x, fromY: aPos.y,
      toX:   bPos.x, toY:   bPos.y,
      visited: target?.discovered ?? false,
    };
  });

  // Cross-region exits: edges that leave this region's zone entirely.
  const rawExits: MapExit[] = [];
  for (const n of candidates) {
    if (n.type !== "zone") continue;
    const pos = positions.get(n.id);
    if (!pos) continue;
    for (const c of n.connections) {
      const target = worldGraph.nodes[c];
      if (!target) continue;
      if (target.type === "sub_location") continue;
      if (target.zone_id === region.id) continue;
      if (target.id === region.id) continue;
      const targetRegionId = target.type === "zone" ? target.id : target.zone_id;
      const targetName     = worldGraph.nodes[targetRegionId]?.name ?? target.name;
      rawExits.push({
        targetId:   targetRegionId,
        targetName,
        fromX:      pos.x,
        fromY:      pos.y,
      });
    }
  }
  const exits = distributeExits(rawExits);

  return {
    title:    region.name,
    subtitle: `${candidates.filter((n) => n.discovered).length} known · ${exits.length} exits`,
    nodes,
    connections,
    exits,
  };
}

function buildLocalTier({
  zoneId, worldGraph,
}: {
  zoneId:     string;
  worldGraph: WorldGraph;
}): RendererPayload {
  // PRIMARY discovery: zone_id-based seeding.
  // Sub-locations should belong to a settlement via zone_id, but the
  // generators occasionally point a sub_location's zone_id at the
  // geographic region rather than the settlement hub. The BFS below
  // recovers those by following the connection graph instead of
  // trusting zone_id alone.
  const seedIds = new Set<string>();
  for (const [id, node] of Object.entries(worldGraph.nodes)) {
    if (id === zoneId || node.zone_id === zoneId) {
      seedIds.add(id);
    }
  }

  // BFS through connections from each seed. A node is included when
  // it's a sub_location, the hub itself, OR shares zone_id with the
  // hub — anything else is a region-level neighbour and shows up as
  // an exit instead.
  const included = new Set<string>(seedIds);
  const queue    = Array.from(seedIds);
  const hubNode  = worldGraph.nodes[zoneId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const node    = worldGraph.nodes[current];
    if (!node) continue;
    for (const connId of node.connections) {
      if (included.has(connId)) continue;
      const conn = worldGraph.nodes[connId];
      if (!conn) continue;
      if (
        conn.type === "sub_location" ||
        conn.id === zoneId ||
        conn.zone_id === zoneId
      ) {
        included.add(connId);
        queue.push(connId);
      }
    }
  }

  // FALLBACK: if zone_id stitching missed every sub_location AND the
  // hub's connections are all region-level, the included set still
  // only has the hub. Pull every sub_location whose zone_id points
  // back at THIS settlement as a last resort.
  //
  // Bug 1 fix: only run this fallback for settlement hubs. Standalone
  // region zones (dungeons, wilderness) have no interior layer, and
  // pulling sub-locations from siblings would mis-attribute them.
  // We additionally constrain the fallback to sub_locations whose
  // zone_id matches this hub — even the settlement fallback only
  // surfaces its OWN sub_locations, never another settlement's.
  if (included.size <= 1 && hubNode?.is_settlement_node === true) {
    for (const [id, node] of Object.entries(worldGraph.nodes)) {
      if (included.has(id)) continue;
      if (
        node.type === "sub_location" &&
        node.zone_id === hubNode.id
      ) {
        included.add(id);
      }
    }
  }

  const candidates = Array.from(included)
    .map((id) => worldGraph.nodes[id])
    .filter(Boolean) as WorldNode[];

  const connPairs = connectionPairs(candidates, included);
  const positions = fitToViewBox(candidates);

  // FIX 3 — include all candidates regardless of discovered state so
  // the player sees the layout of unexplored sub-locations dimmed
  // rather than missing entirely.
  const nodes: MapNode[] = candidates.map((n) => {
    const pos = positions.get(n.id) ?? { x: VIEW / 2, y: VIEW / 2 };
    return {
      id:            n.id,
      name:          n.name,
      type:          n.type,
      category:      n.category,
      x:             pos.x,
      y:             pos.y,
      isCurrent:     n.id === worldGraph.current_node_id,
      isDiscovered:  n.discovered,
      isExpandable:  n.is_expandable,
      npcCount:      n.npc_ids?.length ?? 0,
    };
  });

  const connections: MapConnection[] = connPairs.map(([a, b]) => {
    const aPos = positions.get(a) ?? { x: VIEW / 2, y: VIEW / 2 };
    const bPos = positions.get(b) ?? { x: VIEW / 2, y: VIEW / 2 };
    const target = worldGraph.nodes[b];
    return {
      fromX: aPos.x, fromY: aPos.y,
      toX:   bPos.x, toY:   bPos.y,
      visited: target?.discovered ?? false,
    };
  });

  // The map is display-only; cross-tier exits no longer render as
  // clickable SVG arrows. Navigation lives in the nav bar.
  const zoneNode = worldGraph.nodes[zoneId];
  const total    = candidates.length;
  const known    = candidates.filter((n) => n.discovered).length;
  return {
    title:    zoneNode?.name ?? "Local",
    subtitle: `${known} of ${total} known`,
    nodes,
    connections,
    exits:    [],
  };
}

// ── Location info panel ─────────────────────────────────────────────────────

interface InfoInputs {
  currentNode:    WorldNode | undefined;
  activeTier:     Tier;
  selectedRegion: WorldNode | null;
  worldGraph:     WorldGraph;
  locationAssets: WorldAsset[];
  masterState:    MasterState;
}

interface InfoPanel {
  type:       string;
  title:      string;
  atmosphere: string | null;
  npcs:       Array<{ id: string; name: string; role?: string }>;
  landmarks:  string[];
}

function buildLocationInfo({
  currentNode,
  activeTier,
  selectedRegion,
  worldGraph,
  locationAssets,
  masterState,
}: InfoInputs): InfoPanel {
  // Tier 1 — entire world overview.
  // FIX B3 — pull world-level prose from `wcd.world_description` (the
  // dedicated 2-3 sentence world summary); fall back to the legacy
  // `wcd.atmosphere` for old saves generated before that field
  // existed. Render the FULL paragraph here — no first-sentence
  // extract — because the world panel is the only place this prose
  // lives in the UI and players need the whole pitch.
  if (activeTier === 1) {
    const wcd = masterState.metadata.world_consistency;
    const worldText = (
      (wcd?.world_description && wcd.world_description.trim()) ||
      (wcd?.atmosphere && wcd.atmosphere.trim()) ||
      ""
    );
    return {
      type:       wcd ? "WORLD" : "—",
      title:      wcd?.world_name ?? "Unknown",
      atmosphere: worldText.length > 0 ? worldText : null,
      npcs:       [],
      landmarks:  [],  // FIX 5 — no EXAMINE buttons on world/region tiers
    };
  }

  // Tier 2 — region overview.
  // FIX B3 — region atmosphere is region-specific prose written by
  // apply-world-bible / apply-regional-bible into the region zone's
  // world_asset. The earlier fallback to `wcd.atmosphere` produced
  // wrong results because it bled the world tier's prose down here;
  // drop the WCD fallback so the region panel only ever shows
  // region-level text.
  if (activeTier === 2 && selectedRegion) {
    const exits = countCrossRegionExits(selectedRegion, worldGraph);
    const regionText = firstAtmosphere(selectedRegion, locationAssets) ?? "";
    return {
      type:       `REGION · ${exits} EXIT${exits === 1 ? "" : "S"}`,
      title:      selectedRegion.name,
      atmosphere: regionText.trim().length > 0
        ? extractFirstSentence(regionText)
        : null,
      npcs:       [],
      landmarks:  [],  // FIX 5 — no EXAMINE buttons on world/region tiers
    };
  }

  // Tier 3 — Bug 3: when the player is standing on the geographic
  // region zone (is_expandable + self-zoned), the panel must read as
  // a REGION overview, not as a sub-location. Without this branch,
  // the panel would label the geographic zone with whatever
  // `category` happened to be on the node, which is misleading and
  // doesn't surface the cross-region exit count.
  // FIX B3 — drop the WCD atmosphere fallback (same reason as the
  // Tier 2 region branch above); show only region-specific prose.
  if (
    currentNode?.is_expandable === true &&
    currentNode.zone_id === currentNode.id
  ) {
    const exits = countCrossRegionExits(currentNode, worldGraph);
    const regionText = firstAtmosphere(currentNode, locationAssets) ?? "";
    return {
      type:       `REGION · ${exits} EXIT${exits === 1 ? "" : "S"}`,
      title:      currentNode.name,
      atmosphere: regionText.trim().length > 0
        ? extractFirstSentence(regionText)
        : null,
      npcs:       [],
      landmarks:  [],
    };
  }

  // Tier 3 — Bug 3: standalone non-settlement zones (dungeons,
  // wilderness) deserve the dungeon/wilderness type label rather
  // than falling through to the generic local-node branch.
  if (
    currentNode?.type === "zone" &&
    !currentNode.is_settlement_node &&
    !currentNode.is_expandable
  ) {
    const asset    = resolveLocationAsset(currentNode, locationAssets);
    const typeAbbr = (currentNode.category ?? currentNode.type).toUpperCase();
    return {
      type:       typeAbbr,
      title:      currentNode.name,
      atmosphere: extractFirstSentence(
        asset?.constitution.physical_description ?? ""
      ),
      npcs:       resolvePresentNpcs(currentNode, locationAssets),
      landmarks:  asset?.constitution.key_landmarks?.slice(0, 4) ?? [],
    };
  }

  // Tier 3 — current local node
  if (!currentNode) {
    return { type: "—", title: "—", atmosphere: null, npcs: [], landmarks: [] };
  }
  const asset = resolveLocationAsset(currentNode, locationAssets);
  const npcs  = resolvePresentNpcs(currentNode, locationAssets);
  const typeAbbr = (currentNode.category ?? currentNode.type).toUpperCase();
  return {
    type:       typeAbbr,
    title:      currentNode.name,
    atmosphere: extractFirstSentence(
      asset?.constitution.physical_description ??
      asset?.constitution.atmosphere ?? ""
    ),
    npcs,
    landmarks:  asset?.constitution.key_landmarks?.slice(0, 4) ?? [],
  };
}

function resolveLocationAsset(node: WorldNode, assets: WorldAsset[]): WorldAsset | undefined {
  return assets.find(
    (a) =>
      a.category === AssetCategory.LOCATION &&
      (a.id === node.id ||
       a.id === `location_${node.id}` ||
       a.id === node.asset_id ||
       a.first_seen_location === node.id)
  );
}

function resolvePresentNpcs(node: WorldNode, assets: WorldAsset[]):
  Array<{ id: string; name: string; role?: string }>
{
  const seenIds   = new Set<string>();
  const seenNames = new Set<string>();
  const out: Array<{ id: string; name: string; role?: string }> = [];
  for (const id of node.npc_ids ?? []) {
    if (seenIds.has(id)) continue;
    seenIds.add(id);
    const asset = assets.find((a) => a.id === id || a.id === `character_${id}`);
    if (!asset) continue;
    const name = asset.constitution.true_name && asset.name_known
      ? asset.constitution.true_name
      : asset.name;
    const key = name.toLowerCase();
    if (seenNames.has(key)) continue;
    seenNames.add(key);
    out.push({ id, name, role: asset.constitution.role });
  }
  return out;
}

function firstAtmosphere(region: WorldNode, assets: WorldAsset[]): string | null {
  const asset = assets.find(
    (a) =>
      a.category === AssetCategory.LOCATION &&
      (a.id === region.id || a.id === `location_${region.id}`)
  );
  // FIX B3 — apply-world-bible / apply-regional-bible's
  // regionZoneToAsset writes the region atmosphere into BOTH
  // `physical_description` AND `atmosphere`. Read both. Prefer
  // whichever has actual content so a row written before the FIX 2
  // dual-write (only physical_description populated) still
  // resolves, and so does a future variant that only sets
  // atmosphere. Empty strings count as "no content" so the panel
  // doesn't render an empty paragraph.
  const c    = asset?.constitution;
  const phys = (typeof c?.physical_description === "string" ? c.physical_description : "").trim();
  const atm  = (typeof c?.atmosphere === "string" ? c.atmosphere : "").trim();
  if (phys.length > 0) return phys;
  if (atm.length > 0)  return atm;
  return null;
}

// resolveLandmarks() helper removed — buildLocationInfo now reads
// landmarks directly off the resolved location asset, so the
// dedicated helper had no remaining callers.

function countCrossRegionExits(region: WorldNode, worldGraph: WorldGraph): number {
  let count = 0;
  for (const n of Object.values(worldGraph.nodes)) {
    if (n.zone_id !== region.id && n.id !== region.id) continue;
    if (n.type === "sub_location") continue;
    for (const c of n.connections) {
      const target = worldGraph.nodes[c];
      if (!target) continue;
      if (target.type === "sub_location") continue;
      if (target.zone_id === region.id || target.id === region.id) continue;
      count += 1;
    }
  }
  return count;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function chooseInitialTier(player: WorldNode | undefined): Tier {
  if (!player) return 2;
  if (player.type === "sub_location") return 3;
  // Geographic region zone has no LOCAL view (it IS the region).
  // Open on Region so the player sees the landmarks they can step into.
  if (player.is_expandable && player.zone_id === player.id) return 2;
  if (player.is_expandable) return 3;
  // FIX 2 — default to LOCAL (3) on mount. Players start at a settlement
  // hub where Local shows the most actionable info (nearby sub-locations,
  // NPCs, landmarks). Region/World are wider-scope views the player opts
  // into manually. The useEffect that snaps selectedRegionId on region
  // changes preserves any manual tier choice the player has made
  // (setActiveTier((cur) => (cur === 3 ? 3 : cur))).
  return 3;
}

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

function extractFirstSentence(s: string): string | null {
  const trimmed = s.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^[^.!?]+[.!?]/);
  return match ? match[0].trim() : trimmed;
}
