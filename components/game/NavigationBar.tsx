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
  /** UI-5 — action bar is processing. Every card dims to opacity 0.4
   *  + pointer-events: none + cursor: default while true. Mirrors
   *  the existing generatingRegionId dim path but covers normal
   *  action latency (LLM call in flight, etc.) too. */
  isLoading?:          boolean;
}

// ────────────────────────────────────────────────────────────────────────────

export function NavigationBar({
  worldGraph, masterState, onNavigate,
  onNavigateRoom, onUseKeyOnRoom, onForceRoom,
  canForceUnlock = false,
  keyItemForRoom,
  strBypassThreshold = 6,
  isLoading = false,
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
  // UI-5: per-column labels removed (single "Where to go." header
  // above replaces them); grouping logic stays.
  const colOrder: CardDirection[] = ["back", "deeper", "peer", "undiscovered"];

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
            // UI-fix-C — breadcrumb is UI chrome (Inter Tight) at 9px
            // with light tracking (.10em) and the dim warm-brown
            // #4a3818 per design ref §6 / Group C step 4c. Casing is
            // upstream (buildBreadcrumb .toUpperCase) — those pure
            // functions are out of scope for this prompt; no CSS
            // textTransform here.
            fontFamily:    "var(--sans)",
            fontSize:      9,
            letterSpacing: "0.10em",
            color:         "var(--nav-breadcrumb)",
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
          Mutually exclusive with the dungeon branch above.
          UI-5 — Section header "Where to go." rendered once above all
          columns (replaces per-group italic labels). Internal grouping
          (BACK / DEEPER / PEER / UNDISCOVERED) is unchanged and no
          longer surfaced as visible text. */}
      {!inDungeon && (
      <div style={{ padding: "8px 16px 0" }}>
        <div
          // UI-fix-C — section header per design ref §6 step 4h:
          // ew-sans uppercase, 7px, 0.14em, #4a3818, marginBottom 5.
          // ew-sans (utility class) overrides the parent's font-mono
          // -- which is now JetBrains Mono after UI-fix-A, but the
          // explicit ew-sans here keeps the header firmly in Inter
          // Tight regardless of any parent inheritance.
          className="ew-sans uppercase"
          style={{
            fontSize:      7,
            letterSpacing: "0.14em",
            color:         "var(--nav-breadcrumb)",
            marginBottom:  5,
          }}
        >
          Where to go.
        </div>
      </div>
      )}
      {!inDungeon && (() => {
        // PR-3v — design ref §6 + design/mockups/nav cards.png: known
        // destinations (back / deeper / peer-known) sit side-by-side
        // in a horizontal flex row at the top, each chip flex: 1 to
        // share the row evenly; UNDISCOVERED destinations (peer-unknown)
        // stack full-width below as their own rows. The internal
        // grouping logic (BACK / DEEPER / PEER / UNDISCOVERED buckets
        // from groupCardsByDirection) is preserved — only the visual
        // arrangement of the buckets changed.
        const orderedCards    = colOrder.flatMap((dir) => grouped[dir] ?? []);
        const knownCards      = orderedCards.filter((c) => c.kind !== "peer-unknown");
        const undiscoveredCards = orderedCards.filter((c) => c.kind === "peer-unknown");
        return (
          <div
            className="ew-nav-cols"
            style={{
              display:        "flex",
              flexDirection:  "column",
              gap:            6,
              padding:        "0 16px 12px",
              width:          "100%",
            }}
          >
            {knownCards.length > 0 && (
              <div
                style={{
                  display:        "flex",
                  flexDirection:  "row",
                  gap:            8,
                  width:          "100%",
                }}
              >
                {knownCards.map((c) => (
                  <NavCard
                    key={c.key}
                    card={c}
                    onClick={() => onNavigate(c.targetId)}
                    generatingRegionId={generatingRegionId}
                    isLoading={isLoading}
                    isHere={worldGraph?.current_node_id === c.targetId}
                    layout="row"
                  />
                ))}
              </div>
            )}
            {undiscoveredCards.map((c) => (
              <NavCard
                key={c.key}
                card={c}
                onClick={() => onNavigate(c.targetId)}
                generatingRegionId={generatingRegionId}
                isLoading={isLoading}
                isHere={worldGraph?.current_node_id === c.targetId}
                layout="full"
              />
            ))}
          </div>
        );
      })()}
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
      // PR-3v: mixed-case name + TYPE · BACK sublabel to match the
      // standard nav-card grammar (design ref §6).
      label = parent.name;
      sublabel = `${nodeTypeLabel(parent.node_type) ?? "REGION"} · BACK`;
    }
  } else {
    // Step back to entrance room.
    const entrance = (dungeonNode.dungeon_rooms ?? []).find((r) => r.room_type === "entrance");
    if (entrance) {
      targetId = entrance.id;
      // PR-3v: mixed-case name; the dungeon-room sublabel keeps its
      // bespoke "ENTRANCE" form since dungeon nav doesn't use the
      // TYPE · DIRECTION grammar (room-to-room nav has its own
      // visual language).
      label = entrance.name;
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
                /* PR-3v: mixed-case room names (no toUpperCase). */
                name={card.name}
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
          // UI-fix-C — dungeon room name (Group C step 4g): Cormorant
          // Garamond italic, 500-weight, 11px. letterSpacing dropped
          // — serifs need no tracking at this size and the previous
          // 0.04em pushed the cap-height too wide. Color inherits
          // from the button's `color` prop above.
          fontFamily: "var(--serif)",
          fontSize:   11,
          fontWeight: 500,
          fontStyle:  "italic",
        }}
      >
        <span style={{ fontSize: 13 }}>{arrow}</span>
        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
      </div>
      <div
        style={{
          marginTop:    2,
          // UI-fix-C — dungeon sublabel (Group C step 4g): Inter Tight
          // 8px / 0.10em / var(--ink-4). Was 9px / 0.20em — the
          // tighter spacing matches the new compact chip rhythm.
          fontFamily:   "var(--sans)",
          fontSize:     8,
          letterSpacing: "0.10em",
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

// Polish 4a TASK 2's per-tier --hl-* border colour map was retired
// in UI-5. The new left-border palette (burnt copper / sky blue /
// burnt orange / dashed dim) lives inline in NavCard, keyed by
// card.kind + card.tier directly.

function NavCard({
  card,
  onClick,
  generatingRegionId,
  isLoading = false,
  isHere = false,
  layout = "row",
}: {
  card: Card;
  onClick: () => void;
  /** When non-null, RegionBible expansion is in flight. Every card
   *  disables; the targeted ◇ swaps its badge to "GENERATING...". */
  generatingRegionId: string | null;
  /** UI-5 — action bar processing. Cards dim to opacity 0.4 +
   *  pointer-events: none + cursor: default. */
  isLoading?: boolean;
  /** UI-5 — destination IS the player's current location (rare;
   *  defensive). Shows HERE chip + suppresses VISITED. */
  isHere?: boolean;
  /** PR-3v — chip layout mode. "row" = known card in the horizontal
   *  flex row of equal-width chips (flex: 1, minWidth: 0). "full" =
   *  full-width chip on its own row (peer-unknown / UNDISCOVERED). */
  layout?: "row" | "full";
}) {
  const isBack       = card.kind === "back";
  const isExit       = card.kind === "exit";
  const isUnknown    = card.kind === "peer-unknown";
  const isSettlement = card.tier === "settlement";
  const isDungeon    = card.tier === "dungeon";
  const arrow        = ARROW[card.kind];

  const isGenerating       = generatingRegionId !== null;
  const isGeneratingTarget = isUnknown && generatingRegionId === card.targetId;
  const isDimmed           = isLoading || (isGenerating && !isGeneratingTarget);

  // UI-5 — destination-type-driven LEFT border colour. Order of
  // precedence: UNDISCOVERED dashed dim → BACK / EXIT burnt copper →
  // settlement sky blue → dungeon burnt orange → else --card-border.
  const leftBorderColor =
    isUnknown    ? "var(--nav-border-unknown)" // very dim, dashed
    : isBack || isExit ? "var(--hl-dungeon)"   // burnt copper
    : isSettlement ? "var(--hl-loc)"           // sky blue
    : isDungeon    ? "var(--nav-cross-region)" // burnt orange (PR-2 token retained — same #c2410c)
    :                "var(--card-border)";

  // [[hover-state]] CSS-inline pattern — onMouseEnter / Leave swap a
  // tinted inset highlight on the chip. UI-fix-C dropped the genre
  // var(--card-shadow) base entirely (nav chips are flat, not full
  // genre cards per design ref §6 / Group C step 4a); the hover
  // affordance is the inset accent tint alone.
  const baseShadow  = "none";
  const hoverShadow = "inset 0 0 0 999px rgba(var(--genre-accent-rgb), .04)";

  // Show VISITED when the player has been here (card.discovered true,
  // skipped on UNDISCOVERED + BACK + the current node). HERE wins.
  const showVisited = !isUnknown && !isHere && card.discovered === true && !isBack;

  // GENERATING... badge takes precedence over the type sublabel on
  // the in-flight ◇ card so the player sees the wait state.
  // PR-3v: dropped the legacy "UNDISCOVERED" override — nav-cards.ts
  // now produces the full "UNEXPLORED · NEARBY" sublabel directly
  // for peer-unknown cards, so we render card.sublabel verbatim.
  const typeLabel = isGeneratingTarget
    ? "GENERATING..."
    : (card.sublabel ?? "");

  return (
    <button
      onClick={onClick}
      title={card.name}
      disabled={isGenerating || isLoading}
      aria-busy={isGeneratingTarget}
      onMouseEnter={(e) => {
        if (isDimmed) return;
        (e.currentTarget as HTMLButtonElement).style.boxShadow = hoverShadow;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.boxShadow = baseShadow;
      }}
      style={{
        display:        "flex",
        alignItems:     "center",
        gap:            6,
        // PR-3v: layout="row" → chip shares the horizontal flex row
        // with siblings, flex: 1 + minWidth: 0 lets the row split
        // evenly and the name truncate with ellipsis when it gets
        // long. layout="full" → chip stretches the parent container
        // (peer-unknown UNDISCOVERED row below the known row).
        ...(layout === "full"
          ? { width: "100%" }
          : { flex: 1, minWidth: 0 }
        ),
        // UI-fix-C — touch-target floor 44px, compact padding 7×10.
        // Was 56 / 10×14. Nav cards are now lighter chips, not full
        // genre cards (design ref §6 / Group C step 4f).
        minHeight:      44,
        padding:        "7px 10px",
        // UI-fix-C — chip surface (Group C step 4a): nav cards drop the
        // per-genre --card-bg / --card-border / --card-radius / shadow
        // tokens because they are not full genre cards. They use the
        // simpler nav-specific palette so the row of chips reads as a
        // navigation strip rather than a stack of large cards. The
        // borderLeft override (destination-tier colour) stays.
        background:     "var(--bg-nav-card)",
        border:         `1px ${isUnknown ? "dashed" : "solid"} var(--border-nav-card)`,
        borderLeft:     `2px ${isUnknown ? "dashed" : "solid"} ${leftBorderColor}`,
        borderRadius:   6,
        boxShadow:      baseShadow,
        color:          "var(--ink-2)",
        textAlign:      "left",
        whiteSpace:     "nowrap",
        transition:     "box-shadow 140ms, opacity 140ms",
        // CHANGE 4 — loading dim. UNDISCOVERED also drops to 0.5 per
        // CHANGE 2 (the dimmed.4 loading state stacks naturally).
        opacity:        isDimmed ? 0.4 : isUnknown ? 0.5 : 1,
        pointerEvents:  isDimmed ? "none" : "auto",
        cursor:         isDimmed ? "default" : isGenerating ? "wait" : "pointer",
      }}
    >
      <span
        aria-hidden
        style={{
          // UI-fix-C — arrow glyph (← → ↑ ◆ ◇) is a directional
          // symbol, not a numeric value. Drop var(--mono) per Group
          // C step 4b so it inherits the chip's typeface and stays
          // visually balanced with the serif name beside it.
          fontSize:      14,
          // Arrow leans on the destination colour for at-a-glance
          // scanning; back arrows stay on the burnt-copper border tone.
          color:         isUnknown ? "var(--nav-border-unknown)" : leftBorderColor,
          flexShrink:    0,
          fontWeight:    600,
          opacity:       isBack || isExit ? 0.9 : 1,
        }}
      >
        {arrow}
      </span>
      <span
        style={{
          display:        "flex",
          flexDirection:  "column",
          gap:            3,
          minWidth:       0,
          flex:           1,
        }}
      >
        <span
          style={{
            display:       "flex",
            alignItems:    "center",
            gap:           6,
            overflow:      "hidden",
          }}
        >
          <span
            // UI-fix-C — location name (Group C step 4d): Cormorant
            // Garamond italic, 11px, #c8b890. Was 13px / #d4bc88 from
            // UI-5; the new sizing fits the compact chip and the
            // muted #c8b890 sits one step quieter so the chip reads
            // as nav-list, not headline.
            className="ew-serif italic"
            style={{
              fontSize:      11,
              color:         "var(--nav-name)",
              overflow:      "hidden",
              textOverflow:  "ellipsis",
              whiteSpace:    "nowrap",
              minWidth:      0,
              flex:          1,
            }}
          >
            {card.name}
          </span>
          {isHere && (
            <span
              className="ew-sans uppercase"
              style={{
                fontSize:      8,                       // UI-9b — chip floor 8px (was 6)
                fontWeight:    600,
                letterSpacing: "0.12em",
                color:         "var(--genre-accent)",
                background:    "rgba(var(--genre-accent-rgb), .14)",
                border:        "1px solid color-mix(in srgb, var(--genre-accent) 35%, transparent)",
                borderRadius:  20,
                padding:       "1px 6px",
                flexShrink:    0,
              }}
            >
              Here
            </span>
          )}
          {showVisited && (
            <span
              className="ew-sans uppercase"
              style={{
                fontSize:      8,                       // UI-9b — chip floor 8px (was 6)
                letterSpacing: "0.12em",
                color:         "var(--nav-breadcrumb)",
                border:        "1px solid var(--ui-border-default)",
                borderRadius:  20,
                padding:       "1px 6px",
                flexShrink:    0,
              }}
            >
              Visited
            </span>
          )}
        </span>
        {typeLabel && (
          <span
            // UI-fix-C — sub-label "type · direction" (Group C step 4e):
            // Inter Tight uppercase, 7.5px, #5a4828. Smaller and dimmer
            // than the prior 8px / #6a5530 so the chip's centre of
            // gravity sits firmly on the serif name above. GENERATING…
            // and UNDISCOVERED labels render in this slot.
            className="ew-sans uppercase"
            style={{
              fontFamily:    "var(--sans)",
              fontSize:      7.5,
              letterSpacing: "0.12em",
              color:         "var(--nav-sublabel)",
              overflow:      "hidden",
              textOverflow:  "ellipsis",
              whiteSpace:    "nowrap",
            }}
          >
            {typeLabel}
          </span>
        )}
      </span>
    </button>
  );
}
