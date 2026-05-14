"use client";

import React, { useMemo, useState } from "react";
import { useGameStore } from "@/lib/stores/game-store";
import {
  buildCards,
  groupCardsByDirection,
  nodeTypeLabel,
  type Card,
  type CardDirection,
  type CardKind,
  type CardTier,
} from "@/lib/game/nav-cards";
import {
  buildRoomCards,
  isAtDungeonEntrance,
  findRoom,
  resolveDungeonExitTarget,
  type RoomCard,
} from "@/lib/game/dungeon-navigation";
import { DungeonLockPopover } from "./DungeonLockPopover";
import type {
  DungeonRoom,
  Genre,
  Item,
  MasterState,
  WorldGraph,
  WorldNode,
} from "@/types/game";

/**
 * Navigation Bar — typed card system.
 *
 * The map is display-only; the nav bar owns every navigation action.
 *
 * Polish 4a TASK 1 — cards group into 4 direction buckets (BACK /
 * DEEPER / PEER / UNDISCOVERED), with EXIT folding into BACK.
 *
 * Polish 4a TASK 2 — each card's border, leading arrow, and title
 * are colored by destination tier (region lavender / settlement
 * sky-blue / sub-location mint / dungeon burnt-copper).
 *
 * Polish 4a TASK 3a — the region-zone BACK card prefers the
 * previous region's settlement on cross-region arrival.
 *
 * Polish 4c TASK 3 — layout changed from 4 stacked rows to 4
 * side-by-side columns. Each column is 156 px wide (fixed), has a
 * subtle framing border, and stacks cards vertically. The column
 * container overflows-x on mobile (hidden scrollbar via .ew-nav-cols)
 * with overflow-y: visible per rule 70 (CSS containment).
 *
 * Polish 4c Rule 80 — DEEPER is suppressed when BACK already targets
 * the same settlement (same-region inbound navigation).
 *
 * Tapping a card calls onNavigate(nodeId), which the parent routes
 * through useGameLoop.navigateTo (the only sanctioned UI nav channel).
 */

interface Props {
  masterState: MasterState | null;
  worldGraph:  WorldGraph | undefined;
  onNavigate:  (nodeId: string) => void;
  /** Genre is wired through for legacy reasons; theming now lives in
   *  CSS via [data-genre] on the GameLayout root. */
  genre:       Genre;
  // Day 23A pt 2 — dungeon-room runtime callbacks. Set by page.tsx
  // from useDungeonRuntime. When undefined the dungeon UI is disabled
  // and dungeon nodes fall through to standard graph-node nav. The
  // callbacks themselves no-op when dungeon_state is missing (defence
  // in depth — UI should not invoke them in that state anyway).
  onNavigateRoom?:  (roomId: string) => void;
  onUseKeyOnRoom?:  (roomId: string) => void;
  onForceRoom?:     (roomId: string) => void;
  canForceUnlock?:  boolean;
  /** Looks up the key item for a locked room — null when not held. */
  keyItemForRoom?:  (roomId: string) => Item | null;
  /** STR threshold value, surfaced in the popover label. */
  strBypassThreshold?: number;
}

// ────────────────────────────────────────────────────────────────────────────

/** Split an array into sub-arrays of at most `size` elements.
 *  Used to build the 2-row-max mini-column grid inside each group block. */
function chunkArray<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

export function NavigationBar({
  worldGraph, masterState, onNavigate,
  onNavigateRoom, onUseKeyOnRoom, onForceRoom,
  canForceUnlock = false,
  keyItemForRoom,
  strBypassThreshold = 6,
}: Props) {
  // Adjacent region travel — outline id currently being expanded into
  // a full RegionBible. Set when the player clicks a ◇ peer-unknown
  // card; cleared when apply-regional-bible resolves. We disable every
  // card while truthy so a stray double-click can't fire a second
  // generate, and replace the targeted ◇'s "UNDISCOVERED" badge with
  // "GENERATING..." so the 5-15s wait reads as intentional.
  const generatingRegionId = useGameStore((s) => s.generatingRegionId);

  // Day 23A pt 2 — when the player is inside a dungeon, swap the
  // standard region/settlement nav for room cards. dungeon_state is
  // the canonical signal: set when the runtime initialized + dropped
  // the player at the entrance; cleared only via explicit reset (the
  // player exits + walks far enough that the runtime forgets — V8.56
  // keeps it across re-entries so room discovery sticks).
  //
  // FIX 1 — guard currentNodeId === dungeonState.node_id. Before this
  // fix, dungeon_state persisting across exits caused room cards to
  // render even when the player was back in the region zone. The
  // breadcrumb condition uses inDungeon so it's fixed automatically.
  const currentNodeId = worldGraph?.current_node_id ?? null;
  const dungeonState = masterState?.dungeon_state ?? null;
  const dungeonNode: WorldNode | null = dungeonState && worldGraph?.nodes[dungeonState.node_id]
    ? worldGraph.nodes[dungeonState.node_id]
    : null;
  const inDungeon = !!(
    dungeonState &&
    dungeonNode &&
    currentNodeId === dungeonState.node_id
  );

  // Cards / breadcrumb pick the right branch based on inDungeon.
  const cards = useMemo<Card[]>(
    () => (inDungeon ? [] : buildCards(worldGraph, masterState)),
    [worldGraph, masterState, inDungeon]
  );

  const grouped = useMemo(() => groupCardsByDirection(cards), [cards]);

  const roomCards = useMemo<RoomCard[]>(
    () => buildRoomCards(
      dungeonNode ?? undefined,
      dungeonState ?? undefined,
      masterState?.player_state.inventory ?? []
    ),
    [dungeonNode, dungeonState, masterState?.player_state.inventory]
  );

  const breadcrumb = useMemo<string>(
    () => {
      if (inDungeon && dungeonNode && dungeonState) {
        return buildDungeonBreadcrumb(worldGraph, dungeonNode, dungeonState.current_room_id);
      }
      return buildBreadcrumb(worldGraph);
    },
    [worldGraph, inDungeon, dungeonNode, dungeonState]
  );

  // Lock popover state. Only one room can be in-focus at a time;
  // dismiss on background click / ESC / action select.
  const [lockedRoomId, setLockedRoomId] = useState<string | null>(null);
  const lockedRoom: DungeonRoom | null = lockedRoomId && dungeonNode
    ? findRoom(dungeonNode, lockedRoomId)
    : null;

  // Bail when there's nothing to render in either mode.
  if (!inDungeon && cards.length === 0) return null;
  if (inDungeon && !dungeonNode) return null;

  // Column order — back first, then deeper / peer / undiscovered.
  // Empty columns are skipped entirely (no whitespace, no label).
  const colOrder: CardDirection[] = ["back", "deeper", "peer", "undiscovered"];
  const colLabels: Record<CardDirection, string> = {
    back:         "back",
    deeper:       "deeper",
    peer:         "peer",
    undiscovered: "undiscovered",
  };

  return (
    <div
      role="navigation"
      aria-label="Connected locations"
      className="shrink-0"
      style={{
        borderTop:  "1px solid var(--line)",
        background: "var(--bg-1)",
      }}
    >
      {breadcrumb && (
        <div
          style={{
            padding:       "6px 16px 0",
            fontFamily:    "var(--mono)",
            fontSize:      8,
            letterSpacing: "0.2em",
            color:         "var(--ink-4)",
            whiteSpace:    "nowrap",
            overflow:      "hidden",
            textOverflow:  "ellipsis",
          }}
        >
          {breadcrumb}
        </div>
      )}
      {/* Day 23A pt 2 — when the player is inside a dungeon, render the
          dungeon room cards in place of the standard nav layout. The
          ROOMS column holds room-to-room moves (entrance → middle →
          boss + back). A BACK column either exits to the parent region
          (at entrance) or steps back toward the entrance (anywhere
          else). The locked-boss-room card opens a popover for the
          USE-key / STR-bypass actions. */}
      {inDungeon && dungeonNode && dungeonState && (
        <div
          className="ew-nav-cols"
          style={{
            display:        "flex",
            flexDirection:  "row",
            gap:            8,
            padding:        "10px 16px 12px",
            overflowX:      "auto",
            overflowY:      "visible",
          }}
        >
          {/* BACK column — exit dungeon at entrance, or go to entrance. */}
          <DungeonBackColumn
            worldGraph={worldGraph}
            dungeonNode={dungeonNode}
            dungeonState={dungeonState}
            onNavigate={onNavigate}
            onNavigateRoom={onNavigateRoom}
          />
          {/* ROOMS column — connected rooms from the current room. */}
          <DungeonRoomsColumn
            roomCards={roomCards}
            onNavigateRoom={onNavigateRoom}
            onLockedRoomClick={(roomId) => setLockedRoomId(roomId)}
          />
        </div>
      )}

      {lockedRoom && lockedRoom.lock && (
        <DungeonLockPopover
          room={lockedRoom}
          keyItemName={keyItemForRoom?.(lockedRoom.id)?.name ?? null}
          canForce={canForceUnlock}
          strThreshold={strBypassThreshold}
          onUseKey={() => onUseKeyOnRoom?.(lockedRoom.id)}
          onForce={() => onForceRoom?.(lockedRoom.id)}
          onClose={() => setLockedRoomId(null)}
        />
      )}

      {/* Standard graph-node nav (region / settlement / sub-location).
          Mutually exclusive with the dungeon branch above. */}
      {!inDungeon && (
      <div
        className="ew-nav-cols"
        style={{
          display:        "flex",
          flexDirection:  "row",
          gap:            8,
          padding:        "10px 16px 12px",
          overflowX:      "auto",
          overflowY:      "visible",
        }}
      >
        {colOrder.map((dir) => {
          const colCards = grouped[dir];
          if (colCards.length === 0) return null;
          // Chunk into mini-columns of max 2 cards. Extra cards overflow
          // rightward into new mini-columns. justifyContent: flex-end on
          // each mini-column ensures a lone card in a partial column sits
          // at the bottom (row 2), not the top.
          const miniCols = chunkArray(colCards, 2);
          return (
            <div
              key={dir}
              style={{
                flexShrink:     0,
                display:        "flex",
                flexDirection:  "column",
                gap:            4,
                padding:        "8px",
                border:         "1px solid var(--line-2)",
                borderRadius:   4,
              }}
            >
              <span
                style={{
                  fontFamily:    "var(--serif)",
                  fontStyle:     "italic",
                  fontSize:      10,
                  color:         "var(--ink-4)",
                  opacity:       0.7,
                  letterSpacing: "0.04em",
                  marginBottom:  2,
                }}
              >
                {colLabels[dir]}
              </span>
              {/* Mini-column grid — flex row of fixed-width columns. */}
              <div style={{ display: "flex", flexDirection: "row", gap: 4 }}>
                {miniCols.map((chunk, colIdx) => (
                  <div
                    key={colIdx}
                    style={{
                      display:        "flex",
                      flexDirection:  "column",
                      justifyContent: "flex-end",
                      gap:            4,
                      width:          140,
                    }}
                  >
                    {chunk.map((c) => (
                      <NavCard
                        key={c.key}
                        card={c}
                        onClick={() => onNavigate(c.targetId)}
                        generatingRegionId={generatingRegionId}
                        fullWidth
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
}

// ── Day 23A pt 2 — Dungeon nav columns ───────────────────────────────────────

/**
 * BACK column for dungeon mode. The semantics differ from regular
 * graph nav:
 *   • At the entrance room → BACK exits the dungeon entirely (regular
 *     navigateTo to the parent region). dungeon_state PERSISTS — the
 *     runtime hook clears it lazily on the next non-dungeon arrival,
 *     OR keeps it so re-entry resumes from the same room. Per spec
 *     we keep it.
 *   • From any non-entrance room → BACK steps one room toward the
 *     entrance (the connected room with room_type "entrance" or the
 *     player's previous room id from rooms_visited).
 */
function DungeonBackColumn({
  worldGraph,
  dungeonNode,
  dungeonState,
  onNavigate,
  onNavigateRoom,
}: {
  worldGraph:     WorldGraph | undefined;
  dungeonNode:    WorldNode;
  dungeonState:   NonNullable<MasterState["dungeon_state"]>;
  onNavigate:     (nodeId: string) => void;
  onNavigateRoom?: (roomId: string) => void;
}) {
  const atEntrance = isAtDungeonEntrance(dungeonNode, dungeonState);
  // Resolve the target: parent region node (exit) or the entrance room.
  let targetId: string | null = null;
  let label = "";
  let sublabel = "";
  if (atEntrance) {
    // HF1 FIX 3 — exit ALWAYS lands on the geographic region zone, never
    // the settlement hub (rule 100). resolveDungeonExitTarget walks up
    // the zone_id chain past any settlement node so a dungeon authored
    // as an interior of the town still exits to the region.
    const exitId = resolveDungeonExitTarget(dungeonNode, worldGraph ?? undefined);
    const parent = exitId ? worldGraph?.nodes[exitId] : undefined;
    if (parent) {
      targetId = parent.id;
      label = parent.name.toUpperCase();
      sublabel = nodeTypeLabel(parent.node_type) ?? "REGION";
    }
  } else {
    // Step back to entrance room.
    const entrance = (dungeonNode.dungeon_rooms ?? []).find((r) => r.room_type === "entrance");
    if (entrance) {
      targetId = entrance.id;
      label = entrance.name.toUpperCase();
      sublabel = "ENTRANCE";
    }
  }
  if (!targetId) return null;

  const handleClick = () => {
    if (atEntrance) onNavigate(targetId!);
    else onNavigateRoom?.(targetId!);
  };

  return (
    <div
      style={{
        flexShrink:     0,
        display:        "flex",
        flexDirection:  "column",
        gap:            4,
        padding:        "8px",
        border:         "1px solid var(--line-2)",
        borderRadius:   4,
      }}
    >
      <span
        style={{
          fontFamily:    "var(--serif)",
          fontStyle:     "italic",
          fontSize:      10,
          color:         "var(--ink-4)",
          opacity:       0.7,
          letterSpacing: "0.04em",
          marginBottom:  2,
        }}
      >
        back
      </span>
      <div style={{ display: "flex", flexDirection: "row", gap: 4 }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: 4, width: 140 }}>
          <DungeonNavCardButton
            onClick={handleClick}
            arrow="←"
            name={label}
            sublabel={sublabel}
            color="var(--ink-3)"
            background="var(--bg-2)"
            borderColor="var(--line)"
            borderStyle="solid"
            dimmed={false}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * ROOMS column — connected rooms from the player's current room.
 * Locked rooms (boss room without the key) get the lock icon and
 * route to the popover instead of navigating.
 */
function DungeonRoomsColumn({
  roomCards,
  onNavigateRoom,
  onLockedRoomClick,
}: {
  roomCards:         RoomCard[];
  onNavigateRoom?:   (roomId: string) => void;
  onLockedRoomClick: (roomId: string) => void;
}) {
  if (roomCards.length === 0) return null;
  return (
    <div
      style={{
        flexShrink:     0,
        display:        "flex",
        flexDirection:  "column",
        gap:            4,
        padding:        "8px",
        border:         "1px solid var(--line-2)",
        borderRadius:   4,
      }}
    >
      <span
        style={{
          fontFamily:    "var(--serif)",
          fontStyle:     "italic",
          fontSize:      10,
          color:         "var(--ink-4)",
          opacity:       0.7,
          letterSpacing: "0.04em",
          marginBottom:  2,
        }}
      >
        rooms
      </span>
      <div style={{ display: "flex", flexDirection: "row", gap: 4 }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: 4, width: 140 }}>
          {roomCards.map((card) => {
            const isLocked = card.locked;
            const handleClick = () => {
              if (isLocked) onLockedRoomClick(card.room_id);
              else onNavigateRoom?.(card.room_id);
            };
            // When a key is held the card surfaces key_item_name; we
            // still route through the popover so the player gets the
            // explicit USE-key confirmation (matches the "you decide"
            // beat the prompt requires).
            const hasKeyButLocked = !!card.key_item_name;
            const finalClick = hasKeyButLocked
              ? () => onLockedRoomClick(card.room_id)
              : handleClick;
            return (
              <DungeonNavCardButton
                key={card.room_id}
                onClick={finalClick}
                arrow={isLocked || hasKeyButLocked ? "🔒" : "→"}
                name={card.name.toUpperCase()}
                sublabel={card.type_label}
                color="var(--hl-dungeon)"
                background={card.visited
                  ? "color-mix(in srgb, var(--hl-dungeon) 6%, transparent)"
                  : "color-mix(in srgb, var(--hl-dungeon) 12%, transparent)"}
                borderColor="var(--hl-dungeon)"
                borderStyle={isLocked || hasKeyButLocked ? "dashed" : "solid"}
                dimmed={card.visited && !isLocked && !hasKeyButLocked}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Minimal nav-card button used by both dungeon columns. Mirrors the
 *  visual language of the standard NavCard without dragging in the
 *  region/settlement tier-color plumbing. */
function DungeonNavCardButton({
  onClick, arrow, name, sublabel,
  color, background, borderColor, borderStyle, dimmed,
}: {
  onClick:     () => void;
  arrow:       string;
  name:        string;
  sublabel:    string;
  color:       string;
  background:  string;
  borderColor: string;
  borderStyle: "solid" | "dashed";
  dimmed:      boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left rounded-sm transition-opacity hover:opacity-80"
      style={{
        background,
        border:      `1px ${borderStyle} ${borderColor}`,
        padding:     "8px 10px",
        opacity:     dimmed ? 0.75 : 1,
        cursor:      "pointer",
        width:       "100%",
      }}
    >
      <div
        style={{
          display:    "flex",
          alignItems: "center",
          gap:        6,
          color,
          fontFamily: "var(--mono)",
          fontSize:   11,
          fontWeight: 700,
          letterSpacing: "0.04em",
        }}
      >
        <span style={{ fontSize: 13 }}>{arrow}</span>
        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
      </div>
      <div
        style={{
          marginTop:    2,
          fontFamily:   "var(--mono)",
          fontSize:     9,
          letterSpacing: "0.2em",
          color:        "var(--ink-4)",
        }}
      >
        {sublabel}
      </div>
    </button>
  );
}

// ── Day 23A pt 2 — 3-tier breadcrumb inside a dungeon ───────────────────────
function buildDungeonBreadcrumb(
  worldGraph: WorldGraph | undefined,
  dungeonNode: WorldNode,
  currentRoomId: string,
): string {
  const parts: string[] = [];
  // Tier 1 — geographic region (parent zone). HF1 FIX 3 — resolve the
  // true region zone (walk up past the settlement) so the breadcrumb
  // and the BACK card agree on the dungeon's parent.
  const exitId = resolveDungeonExitTarget(dungeonNode, worldGraph ?? undefined);
  const parent = exitId ? worldGraph?.nodes[exitId] : undefined;
  if (parent) parts.push(parent.name.toUpperCase());
  // Tier 2 — dungeon itself.
  parts.push(dungeonNode.name.toUpperCase());
  // Tier 3 — current room.
  const room = (dungeonNode.dungeon_rooms ?? []).find((r) => r.id === currentRoomId);
  if (room) parts.push(room.name.toUpperCase());
  return parts.join(" › ");
}

// ── Breadcrumb builder ───────────────────────────────────────────────────────

function buildBreadcrumb(worldGraph: WorldGraph | undefined): string {
  if (!worldGraph) return "";
  const current = worldGraph.nodes[worldGraph.current_node_id];
  if (!current) return "";

  const parts: string[] = [];

  const isRegionZone =
    current.type === "zone" &&
    current.is_expandable === true &&
    current.zone_id === current.id;

  if (isRegionZone) {
    parts.push(current.name.toUpperCase());
  } else if (current.zone_id && current.zone_id !== current.id) {
    const parent = worldGraph.nodes[current.zone_id];
    if (parent) {
      // If parent is a settlement hub, its geographic region is the grandparent
      const grandparentId = parent.zone_id && parent.zone_id !== parent.id
        ? parent.zone_id
        : null;
      const grandparent = grandparentId ? worldGraph.nodes[grandparentId] : null;
      if (grandparent) {
        parts.push(grandparent.name.toUpperCase());
      }
      parts.push(parent.name.toUpperCase());
    }
    parts.push(current.name.toUpperCase());
  } else {
    parts.push(current.name.toUpperCase());
  }

  return parts.join(" › ");
}

// ── Card component ──────────────────────────────────────────────────────────

const ARROW: Record<CardKind, string> = {
  back:           "←",
  deeper:         "→",
  exit:           "↑",
  "peer-known":   "◆",
  "peer-unknown": "◇",
};

/** Polish 4a TASK 2 — map destination tier to its CSS color token.
 *  Border + leading arrow + title pick up this color so the player
 *  can scan tier at a glance. Background stays neutral. */
const TIER_COLOR: Record<CardTier, string> = {
  region:         "var(--hl-region)",
  settlement:     "var(--hl-loc)",
  "sub-location": "var(--hl-sublocation)",
  dungeon:        "var(--hl-dungeon)",
};

function NavCard({
  card,
  onClick,
  generatingRegionId,
  fullWidth = false,
}: {
  card: Card;
  onClick: () => void;
  /** When non-null, RegionBible expansion is in flight. Every card
   *  disables; the targeted ◇ swaps its badge to "GENERATING...". */
  generatingRegionId: string | null;
  /** Column layout mode — card fills the column width instead of using
   *  fixed min/maxWidth. Set by the column container. */
  fullWidth?: boolean;
}) {
  const isBack       = card.kind === "back";
  const isExit       = card.kind === "exit";
  const isDeeper     = card.kind === "deeper";
  const isPeerKnown  = card.kind === "peer-known";
  const isUnknown    = card.kind === "peer-unknown";
  const isNew        = !card.discovered && !isUnknown && !isBack;
  const arrow        = ARROW[card.kind];

  const isGenerating       = generatingRegionId !== null;
  const isGeneratingTarget = isUnknown && generatingRegionId === card.targetId;

  // Polish 4a TASK 2 — tier color drives border, arrow, and title.
  const tierColor = TIER_COLOR[card.tier];

  const arrowColor =
    isBack ? "var(--ink-3)"
    : isUnknown ? "var(--ink-4)"
    : tierColor;
  const nameColor =
    isBack    ? "var(--ink-3)"
    : isUnknown ? "var(--ink-3)"
    : isNew   ? "var(--ink-3)"
    : tierColor;
  const subColor =
    isPeerKnown ? tierColor
    : isUnknown  ? tierColor
    : "var(--ink-4)";

  // Backgrounds — TYPE B (deeper) is transparent so settlement
  // sub-loc cards read flatter; TYPE D1 keeps the elevated --bg-2 fill;
  // TYPE D2 (undiscovered) is transparent.
  const background =
    isExit       ? "var(--bg-3)"
    : isDeeper   ? "transparent"
    : isUnknown  ? "transparent"
    : "var(--bg-2)";

  // Border — colored by destination tier. Undiscovered uses a softer
  // dashed variant. Back uses the neutral --line so it doesn't read
  // as a destination color cue.
  const borderColor =
    isBack       ? "var(--line)"
    : isUnknown  ? `color-mix(in srgb, ${tierColor} 35%, transparent)`
    : isNew      ? `color-mix(in srgb, ${tierColor} 50%, transparent)`
    : tierColor;
  const borderStyle = isUnknown || isNew ? "dashed" : "solid";

  // Category / undiscovered badge under the primary name — diamond cards
  // (◆ / ◇) carry an explicit badge so the player can tell a region
  // dungeon apart from a settlement → DEEPER card at a glance.
  // While the player's clicked ◇ is being expanded, swap that card's
  // badge to "GENERATING..." so the wait reads as in-progress work.
  const showBadge = isPeerKnown || isUnknown;
  const badgeText = isGeneratingTarget
    ? "GENERATING..."
    : isUnknown
      ? "UNDISCOVERED"
      : card.sublabel;

  return (
    <button
      onClick={onClick}
      title={card.name}
      disabled={isGenerating}
      aria-busy={isGeneratingTarget}
      style={{
        display:        "flex",
        alignItems:     "center",
        gap:            10,
        // fullWidth (column mode): fill the column; row mode: fixed range.
        ...(fullWidth
          ? { width: "100%" }
          : { minWidth: 140, maxWidth: 200, flexShrink: 0 }
        ),
        height:         64,
        padding:        "0 14px",
        background,
        border:         `1px ${borderStyle} ${borderColor}`,
        borderRadius:   4,
        color:          "var(--ink-2)",
        fontFamily:     "var(--mono)",
        cursor:         isGenerating ? "wait" : "pointer",
        textAlign:      "left",
        whiteSpace:     "nowrap",
        transition:     "all 120ms",
        opacity:        isGenerating && !isGeneratingTarget ? 0.45 : 1,
      }}
    >
      <span
        style={{
          fontFamily:    "var(--mono)",
          fontSize:      16,
          color:         arrowColor,
          flexShrink:    0,
          fontWeight:    600,
        }}
      >
        {arrow}
      </span>
      <span
        style={{
          display:        "flex",
          flexDirection:  "column",
          gap:            2,
          minWidth:       0,
          flex:           1,
        }}
      >
        <span
          style={{
            display:       "flex",
            alignItems:    "center",
            gap:           4,
            overflow:      "hidden",
          }}
        >
          <span
            style={{
              fontFamily:    "var(--mono)",
              fontSize:      9,
              letterSpacing: "0.18em",
              fontWeight:    600,
              color:         nameColor,
              overflow:      "hidden",
              textOverflow:  "ellipsis",
              whiteSpace:    "nowrap",
              minWidth:      0,
            }}
          >
            {card.name}
          </span>
          {isNew && (
            <span style={{
              fontSize:      7,
              fontFamily:    "var(--mono)",
              letterSpacing: "0.2em",
              color:         tierColor,
              border:        `1px solid ${tierColor}`,
              padding:       "1px 4px",
              flexShrink:    0,
            }}>
              NEW
            </span>
          )}
        </span>
        <span
          style={{
            fontFamily:    "var(--mono)",
            fontSize:      showBadge ? 7 : 8,
            letterSpacing: "0.2em",
            color:         subColor,
            overflow:      "hidden",
            textOverflow:  "ellipsis",
            whiteSpace:    "nowrap",
            ...(showBadge ? {
              alignSelf:    "flex-start",
              border:       `1px solid ${isUnknown
                ? `color-mix(in srgb, ${tierColor} 35%, transparent)`
                : `color-mix(in srgb, ${tierColor} 60%, transparent)`}`,
              padding:      "1px 5px",
              marginTop:    2,
            } : {}),
          }}
        >
          {showBadge ? badgeText : card.sublabel}
        </span>
      </span>
    </button>
  );
}
