"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AssetCategory } from "@/types/game";
import type { MasterState, WorldAsset, WorldGraph, WorldNode } from "@/types/game";
import { GenreMap, project, VIEW, PAD } from "./map/renderers";
import type { MapNode, MapConnection, MapExit, BoundsLike, Tier } from "./map/renderers";

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
  /** Navigation redesign — receives a raw node id. Wire to
   *  useGameLoop.navigateTo, which routes via submitAction's
   *  forceMoveToNode option (bypasses the text-pipeline MOVE intercept). */
  onNavigate:     (nodeId: string) => void;
  /** Optional — when set, the ◆ INTERACT panel rows become clickable
   *  buttons that submit "examine <landmark name>" through the normal
   *  action pipeline. Falls back to inert rows when omitted. */
  onExamine?:     (input: string) => void;
  /** When true, render in mobile bottom-sheet mode (no left border, top
   *  drag handle, rounded top corners). */
  asSheet?:       boolean;
}

export function WorldMap({
  masterState,
  worldGraph,
  locationAssets,
  onNavigate,
  onExamine,
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

  // ── Build the renderer payload for the active tier ────────────────────────
  const payload = useMemo(() => {
    return buildRendererPayload({
      masterState,
      worldGraph,
      activeTier,
      selectedRegionId,
    });
  }, [masterState, worldGraph, activeTier, selectedRegionId]);

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

  // ── Click handlers ─────────────────────────────────────────────────────────
  function handleSelectNode(nodeId: string) {
    const node = worldGraph.nodes[nodeId];
    if (!node) return;
    if (activeTier === 1) {
      // From world tier, clicking a region zooms to Tier 2.
      setSelectedRegionId(findRootZoneId(nodeId, worldGraph.nodes));
      setActiveTier(2);
    } else if (activeTier === 2) {
      // From region tier, clicking a settlement / sub-zone moves to Tier 3.
      setSelectedRegionId(findRootZoneId(nodeId, worldGraph.nodes));
      setActiveTier(3);
    } else {
      // Tier 3 — clicking a sub-location triggers navigation.
      onNavigate(nodeId);
    }
  }
  function handleSelectExit(targetId: string) {
    // Exits always represent a destination region; jump to it on Tier 2
    // and let the player decide whether to navigate.
    setSelectedRegionId(findRootZoneId(targetId, worldGraph.nodes));
    setActiveTier(2);
  }

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

      {/* Map area — square aspect ratio so renderers fit their 320×320 viewBox */}
      <div style={{ position: "relative", aspectRatio: "1", flexShrink: 0 }}>
        <GenreMap
          genre={masterState.metadata.genre}
          tier={activeTier}
          title={payload.title}
          subtitle={payload.subtitle}
          nodes={payload.nodes}
          connections={payload.connections}
          exits={payload.exits}
          onSelectNode={handleSelectNode}
          onSelectExit={handleSelectExit}
          npcMode
        />
      </div>

      {/* Location info panel */}
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
        <div
          className="ew-mono"
          style={{
            fontSize:      8,
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
            fontSize:     17,
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
              fontSize:     12,
              color:        "var(--ink-3)",
              lineHeight:   1.65,
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
                letterSpacing: "0.3em",
                color:         "var(--ink-4)",
                marginBottom:  6,
              }}
            >
              ◆ PRESENT — {info.npcs.length}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {info.npcs.map((npc) => (
                <div
                  key={npc.id}
                  style={{
                    display:    "flex",
                    alignItems: "center",
                    gap:        8,
                    padding:    "5px 8px",
                    background: "var(--bg-2)",
                    border:     "1px solid var(--line)",
                    borderLeft: "2px solid var(--accent)",
                  }}
                >
                  <span
                    style={{
                      width:        5,
                      height:       5,
                      borderRadius: "50%",
                      background:   "var(--accent)",
                      flexShrink:   0,
                    }}
                  />
                  <span
                    className="ew-mono"
                    style={{
                      fontSize:      10,
                      color:         "var(--ink-1)",
                      letterSpacing: "0.06em",
                      flex:          1,
                    }}
                  >
                    {npc.name}
                  </span>
                  {npc.role && (
                    <span
                      className="ew-mono"
                      style={{
                        fontSize:       8,
                        color:          "var(--ink-4)",
                        letterSpacing:  "0.16em",
                        textTransform:  "uppercase",
                      }}
                    >
                      {npc.role}
                    </span>
                  )}
                </div>
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
  id:       Tier;
  active:   boolean;
  label:    string;
  icon:     React.ReactNode;
  onSelect: (t: Tier) => void;
}

function TierBtn({ id, active, label, icon, onSelect }: TierBtnProps) {
  return (
    <button
      onClick={() => onSelect(id)}
      title={label}
      style={{
        flex:           1,
        padding:        "8px 0",
        background:     active ? "var(--accent-faint)" : "transparent",
        border:         active ? "1px solid var(--accent)" : "1px solid var(--line-2)",
        borderRadius:   2,
        color:          active ? "var(--accent)" : "var(--ink-3)",
        cursor:         "pointer",
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
  masterState:      MasterState;
  worldGraph:       WorldGraph;
  activeTier:       Tier;
  selectedRegionId: string | null;
}

interface RendererPayload {
  title:       string;
  subtitle:    string;
  nodes:       MapNode[];
  connections: MapConnection[];
  exits:       MapExit[];
}

/**
 * Auto-position helper.
 *
 * The MVP location generators don't always populate `map_position` on
 * every node — and when several nodes inherit the same coords (a common
 * generator quirk), filtering by `hasMapPos` left the map looking
 * empty. autoPositionNodes resolves both issues: it projects every node
 * with a real position into the 320×320 viewBox, then arranges any
 * node without a position (or all of them, when every position is
 * identical) in a tidy ellipse around the centroid of the positioned
 * set. The returned objects carry `_px` / `_py` already in viewBox
 * space — callers should use those directly without another `project`.
 */
function autoPositionNodes(
  candidates: WorldNode[]
): Array<WorldNode & { _px: number; _py: number }> {
  const withPos    = candidates.filter(hasMapPos);
  const withoutPos = candidates.filter((n) => !hasMapPos(n));

  // When every positioned node sits at the same coords, the projection
  // collapses to a single point and the map reads as empty. Treat that
  // case as "nothing has a real position" so the circle layout below
  // distributes everyone uniformly instead.
  const allSame = withPos.length > 1 &&
    withPos.every((n) =>
      n.map_position.x === withPos[0].map_position.x &&
      n.map_position.y === withPos[0].map_position.y
    );
  const effectiveWithPos = allSame ? [] : withPos;
  const effectiveWithout = allSame ? candidates : withoutPos;

  // Enforce a minimum range in both axes. When every positioned node
  // shares an x (or y) value, the raw bounds collapse to dx=0 and
  // project() pins the whole row to PAD (the left or top edge).
  // Padding the bounds out to MIN_RANGE grid units keeps the row
  // centred even in that degenerate case.
  const MIN_RANGE = 4;
  const rawBounds = effectiveWithPos.length > 0
    ? boundsFor(effectiveWithPos.map((n) => n.map_position))
    : { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  const bounds: BoundsLike = {
    minX: rawBounds.minX,
    minY: rawBounds.minY,
    maxX: Math.max(rawBounds.maxX, rawBounds.minX + MIN_RANGE),
    maxY: Math.max(rawBounds.maxY, rawBounds.minY + MIN_RANGE),
  };

  const projected = new Map<string, { x: number; y: number }>();
  for (const n of effectiveWithPos) {
    projected.set(n.id, project(n.map_position.x, n.map_position.y, bounds));
  }

  // Centroid of already-positioned nodes — the unpositioned ones orbit
  // this point so the two layers compose naturally.
  const cx = effectiveWithPos.length > 0
    ? effectiveWithPos.reduce((s, n) => s + projected.get(n.id)!.x, 0) /
      effectiveWithPos.length
    : VIEW / 2;
  const cy = effectiveWithPos.length > 0
    ? effectiveWithPos.reduce((s, n) => s + projected.get(n.id)!.y, 0) /
      effectiveWithPos.length
    : VIEW / 2;

  // Spread unpositioned nodes around the centroid in a flattened circle.
  // The radius is capped so the orbit never escapes the padded
  // viewBox — important when a single positioned node sits near an
  // edge and the rest of the cohort needs to wrap around it.
  const r = Math.min(VIEW * 0.32, (VIEW - PAD * 2) / 2.2);
  effectiveWithout.forEach((n, i) => {
    const total = effectiveWithout.length;
    const angle = (i / (total || 1)) * 2 * Math.PI - Math.PI / 2;
    projected.set(n.id, {
      x: cx + Math.cos(angle) * r,
      y: cy + Math.sin(angle) * (r * 0.75),
    });
  });

  return candidates.map((n) => {
    const pos = projected.get(n.id) ?? { x: VIEW / 2, y: VIEW / 2 };
    return { ...n, _px: pos.x, _py: pos.y };
  });
}

function buildRendererPayload({
  masterState,
  worldGraph,
  activeTier,
  selectedRegionId,
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
  const zoneId =
    player && player.type === "sub_location"
      ? player.zone_id
      : worldGraph.current_node_id;
  return buildLocalTier({ zoneId, worldGraph });
}

function buildWorldTier({
  wcd, worldGraph,
}: {
  wcd:        MasterState["metadata"]["world_consistency"] | undefined;
  worldGraph: WorldGraph;
}): RendererPayload {
  // Pull every zone — autoPositionNodes resolves the missing-coord
  // and degenerate-coord cases that previously left the map empty.
  const allZones = Object.values(worldGraph.nodes).filter(
    (n) => n.type === "zone"
  );
  const discoveredZones = allZones.filter((n) => n.discovered);

  // Reachable but undiscovered zones — the design wants ??? hints.
  const reachable = new Set<string>();
  for (const node of discoveredZones) {
    for (const c of node.connections) {
      const target = worldGraph.nodes[c];
      if (target && !target.discovered && target.type === "zone") {
        reachable.add(target.id);
      }
    }
  }
  const undiscoveredHints = allZones.filter(
    (n) => !n.discovered && reachable.has(n.id)
  );

  const candidates = [...discoveredZones, ...undiscoveredHints];
  const projected  = autoPositionNodes(candidates);
  const idIndex    = new Map(projected.map((n) => [n.id, n] as const));

  const nodes: MapNode[] = projected.map((n) => ({
    id:           n.id,
    name:         n.name,
    type:         n.type,
    category:     n.category,
    x:            n._px,
    y:            n._py,
    isCurrent:    n.id === worldGraph.current_node_id ||
                  worldGraph.nodes[worldGraph.current_node_id]?.zone_id === n.id,
    isDiscovered: n.discovered,
    npcCount:     n.npc_ids?.length ?? 0,
  }));

  // Only discovered zones emit connections so the world view stays
  // legible — rumored hints float free until reached.
  const connections: MapConnection[] = [];
  const seen = new Set<string>();
  for (const n of projected) {
    if (!n.discovered) continue;
    for (const c of n.connections) {
      const target = idIndex.get(c);
      if (!target) continue;
      const key = [n.id, target.id].sort().join("→");
      if (seen.has(key)) continue;
      seen.add(key);
      connections.push({
        fromX: n._px, fromY: n._py,
        toX:   target._px, toY:   target._py,
        visited: target.discovered,
      });
    }
  }

  return {
    title:       wcd?.world_name ?? "World",
    subtitle:    wcd?.world_tagline ?? `${discoveredZones.length} known · ${undiscoveredHints.length} rumored`,
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
  // Pull settlement + region_locations (top-level zones whose zone_id
  // points at this region). Hide sub_locations — they belong on Tier 3.
  const candidates = Object.values(worldGraph.nodes).filter(
    (n) => (n.zone_id === region.id || n.id === region.id) && n.type !== "sub_location"
  );
  const projected = autoPositionNodes(candidates);
  const idIndex   = new Map(projected.map((n) => [n.id, n] as const));

  const nodes: MapNode[] = projected.map((n) => ({
    id:           n.id,
    name:         n.name,
    type:         n.type,
    category:     n.category,
    x:            n._px,
    y:            n._py,
    isCurrent:    n.id === worldGraph.current_node_id,
    isDiscovered: n.discovered,
    npcCount:     n.npc_ids?.length ?? 0,
  }));

  const connections: MapConnection[] = [];
  const seen = new Set<string>();
  for (const n of projected) {
    for (const c of n.connections) {
      const target = idIndex.get(c);
      if (!target) continue;
      const key = [n.id, target.id].sort().join("→");
      if (seen.has(key)) continue;
      seen.add(key);
      connections.push({
        fromX: n._px, fromY: n._py,
        toX:   target._px, toY:   target._py,
        visited: target.discovered,
      });
    }
  }

  // Cross-region exits: edges that leave this region's zone entirely.
  const exits: MapExit[] = [];
  for (const n of projected) {
    if (n.type !== "zone") continue;
    for (const c of n.connections) {
      const target = worldGraph.nodes[c];
      if (!target) continue;
      if (target.type === "sub_location") continue;
      if (target.zone_id === region.id) continue;
      if (target.id === region.id) continue;
      const targetRegionId = target.type === "zone" ? target.id : target.zone_id;
      const targetName     = worldGraph.nodes[targetRegionId]?.name ?? target.name;
      exits.push({
        targetId:   targetRegionId,
        targetName,
        fromX:      n._px,
        fromY:      n._py,
      });
    }
  }

  return {
    title:    region.name,
    subtitle: `${projected.filter((n) => n.discovered).length} known · ${exits.length} exits`,
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
  // only has the hub. Pull every sub_location in the graph as a last
  // resort so the local map isn't empty when interior content exists.
  if (included.size <= 1 && hubNode) {
    for (const [id, node] of Object.entries(worldGraph.nodes)) {
      if (included.has(id)) continue;
      if (node.type === "sub_location") {
        included.add(id);
      }
    }
  }

  const candidates = Array.from(included)
    .map((id) => worldGraph.nodes[id])
    .filter(Boolean) as WorldNode[];

  const projected = autoPositionNodes(candidates);
  const idIndex   = new Map(projected.map((n) => [n.id, n] as const));

  const nodes: MapNode[] = projected.map((n) => ({
    id:           n.id,
    name:         n.name,
    type:         n.type,
    category:     n.category,
    x:            n._px,
    y:            n._py,
    isCurrent:    n.id === worldGraph.current_node_id,
    isDiscovered: n.discovered,
    npcCount:     n.npc_ids?.length ?? 0,
  }));

  // Connections only between included nodes — anything pointing
  // outside the included set is treated as an exit below.
  const connections: MapConnection[] = [];
  const seen = new Set<string>();
  for (const n of projected) {
    const a = nodes.find((x) => x.id === n.id);
    if (!a) continue;
    for (const c of n.connections) {
      const target = idIndex.get(c);
      if (!target) continue;
      const key = [n.id, c].sort().join("→");
      if (seen.has(key)) continue;
      seen.add(key);
      const b = nodes.find((x) => x.id === c);
      if (!b) continue;
      connections.push({
        fromX: a.x, fromY: a.y,
        toX:   b.x, toY:   b.y,
        visited: target.discovered,
      });
    }
  }

  // Exits: connections that leave the included set entirely.
  const exits: MapExit[] = [];
  for (const n of projected) {
    const a = nodes.find((x) => x.id === n.id);
    if (!a) continue;
    for (const c of n.connections) {
      if (included.has(c)) continue;
      const target = worldGraph.nodes[c];
      if (!target) continue;
      exits.push({
        targetId:   target.id,
        targetName: target.name,
        fromX:      a.x,
        fromY:      a.y,
      });
    }
  }

  const zoneNode = worldGraph.nodes[zoneId];
  const total    = projected.length;
  const known    = projected.filter((n) => n.discovered).length;
  return {
    title:    zoneNode?.name ?? "Local",
    subtitle: `${known} of ${total} known`,
    nodes,
    connections,
    exits,
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
  // Tier 1 — entire world overview
  if (activeTier === 1) {
    const wcd = masterState.metadata.world_consistency;
    return {
      type:       wcd ? "WORLD" : "—",
      title:      wcd?.world_name ?? "Unknown",
      atmosphere: wcd?.atmosphere ?? null,
      npcs:       [],
      landmarks:  (wcd?.landmarks ?? []).slice(0, 4).map((lm) => lm.name),
    };
  }

  // Tier 2 — region overview
  if (activeTier === 2 && selectedRegion) {
    const exits = countCrossRegionExits(selectedRegion, worldGraph);
    return {
      type:       `REGION · ${exits} EXIT${exits === 1 ? "" : "S"}`,
      title:      selectedRegion.name,
      atmosphere: extractFirstSentence(
        firstAtmosphere(selectedRegion, locationAssets) ??
        masterState.metadata.world_consistency?.atmosphere ?? ""
      ),
      npcs:       [],
      landmarks:  resolveLandmarks(selectedRegion, locationAssets),
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
  return asset?.constitution.atmosphere ?? null;
}

function resolveLandmarks(region: WorldNode, assets: WorldAsset[]): string[] {
  const asset = assets.find(
    (a) =>
      a.category === AssetCategory.LOCATION &&
      (a.id === region.id || a.id === `location_${region.id}`)
  );
  return asset?.constitution.key_landmarks?.slice(0, 4) ?? [];
}

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
  if (player.is_expandable) return 3;
  return 2;
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

function hasMapPos(node: WorldNode | undefined): node is WorldNode {
  return !!node &&
         !!node.map_position &&
         typeof node.map_position.x === "number" &&
         typeof node.map_position.y === "number";
}

function boundsFor(points: Array<{ x: number; y: number }>): BoundsLike {
  if (points.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}

function extractFirstSentence(s: string): string | null {
  const trimmed = s.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^[^.!?]+[.!?]/);
  return match ? match[0].trim() : trimmed;
}
