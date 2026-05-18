"use client";

import React, { useState } from "react";
// PR-6v-c: IconMap import dropped alongside the region footer. The
// panel no longer renders any Tabler glyph — verb-label + name carries
// the row, the footer's map icon went away with the footer itself.
import { LootModal } from "@/components/game/loot/LootModal";
import { AssetCategory } from "@/types/game";
import type {
  FloorLootEntry,
  LocationDefinition,
  LocationObject,
  MasterState,
  WorldAsset,
  WorldBible,
  RegionBible,
  WorldNode,
} from "@/types/game";
import { useGameStore } from "@/lib/stores/game-store";
import { findNpcInRegistry } from "@/lib/game/state-utils";

/**
 * UI-3 — Context Panel.
 *
 * Section 18 of /docs/ui-design-reference.md. The always-visible left
 * column that describes the current space. Pure presentational — no
 * navigation, no new action types, no new game state.
 *
 *  • Location header  (name + type pill)
 *  • Atmosphere prose (from bible LocationDefinition.atmosphere)
 *  • HERE NOW         (NPCs present, from locationAssets)
 *  • IN THIS SPACE    (Tier-1 objects from the bible — discovered only)
 *  • Unlooted remains (floor_loot entries pending or with items left)
 *
 * Tapping an NPC fires `submitAction("talk to {name}", { npcName })`,
 * matching the InventoryPanel.onTalk path in app/game/page.tsx. Tapping
 * an object fires `submitAction("{verb} the {name}")` with the verb
 * mapped from LocationObject.type per CLAUDE.md rule 87 (Search · Read
 * · Examine · Use). Unlooted-remains taps are stubbed — UI-8 wires the
 * loot modal.
 *
 * Genre-aware via the per-genre CSS variable sets seeded in UI-1 +
 * `--genre-accent-rgb` introduced here. The three overlay divs
 * (`.ol-tex`, `.ol-scan`, `.ol-grid`) opt this surface into the
 * existing UI-1 genre overlay treatment.
 */

export interface ContextPanelProps {
  /** Reuses the existing useGameLoop submitAction — same path the
   *  story feed and InventoryPanel use. */
  onSubmit: (input: string, opts?: { npcName?: string }) => void;
  /** UI-fix-D 4b — opens the AttunementModal. Surfaced inside the
   *  "In This Space" section as an Attune card when the player is
   *  at a settlement_hub and not in combat. State (open/close) is
   *  owned by app/game/page.tsx — this prop is the bridge.
   *  Optional so callers that don't wire attunement (tests,
   *  storybook) keep working unchanged. */
  onAttune?: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Style constants (kept inside the file — none participate in CLAUDE.md's
// Story Feed Colors token system, so no globals.css contamination).
// ─────────────────────────────────────────────────────────────────────────────

// PR-6v: HEADING_LABEL (#6a5530) const dropped — section labels now
// consume var(--ui-text-2) directly per (C). The hex is still on the
// allow-list as it backs --ui-text-muted globally.
const NAME_INK      = "#e2cda0";
const PROSE_INK     = "#9a7e52";
const NPC_NAME_INK  = "#d4bc88";
const NPC_ROLE_INK  = "#7a6040";
// UI-fix-E 4a — object name now matches NPC name tone (#d4bc88, was
// #c4b090). Per design-reference §18 both names are the primary
// label inside their respective cards and share visual weight; the
// previous #c4b090 made object names read as secondary.
const OBJ_NAME_INK  = "#d4bc88";
// Change 5 — ICON_INK dropped alongside the icon column. Reinstate
// if a glyph-style affordance returns to ObjectCard.

// ─────────────────────────────────────────────────────────────────────────────
// Pure helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Locate the bible LocationDefinition that matches a world graph
 *  node id. Walks the world bible's starting_region (locations +
 *  region_locations) first, then every region in metadata.region_bibles.
 *  Returns null if the node lives in the graph but has no bible source
 *  (legacy / placeholder nodes). */
function findLocationDefinition(
  state: MasterState | null,
  nodeId: string | null | undefined,
): LocationDefinition | null {
  if (!state || !nodeId) return null;
  const tryBible = (bible: RegionBible | undefined): LocationDefinition | null => {
    if (!bible) return null;
    return (
      (bible.locations?.find((l) => l.id === nodeId) ?? null) ||
      (bible.region_locations?.find((l) => l.id === nodeId) ?? null)
    );
  };

  const wb: WorldBible | undefined = state.metadata.world_bible;
  const sr = wb?.starting_region;
  const fromWorld = tryBible(sr);
  if (fromWorld) return fromWorld;

  const regionBibles = state.metadata.region_bibles ?? {};
  for (const rb of Object.values(regionBibles)) {
    const hit = tryBible(rb);
    if (hit) return hit;
  }
  return null;
}

/** Map a numeric trust score (0–100) to a disposition dot colour.
 *  Bands track the prompt verbatim (hostile/suspicious/neutral/
 *  friendly/allied). */
function dispositionColour(trust: number): string {
  if (trust <= 20) return "#c44040"; // hostile
  if (trust <= 40) return "#b06030"; // suspicious
  if (trust <= 60) return "#8a6a3a"; // neutral
  if (trust <= 80) return "#5a9a5a"; // friendly
  return "#4a8a4a";                  // allied
}

/** Resolve the trust score for an NPC, falling back to 50 (neutral)
 *  when the registry doesn't have an entry yet (first-encounter). */
function trustFor(state: MasterState, npcAsset: WorldAsset): number {
  const found = findNpcInRegistry(state.npc_registry, npcAsset.id);
  if (found) return found.npc.trust_score;
  const byName = findNpcInRegistry(state.npc_registry, npcAsset.name);
  return byName?.npc.trust_score ?? 50;
}

/** PR-6v — broad category label for the header's top-left chip.
 *  Maps WorldNode metadata to one of three coarse buckets per
 *  design ref §18 + design/mockups/context panel.png:
 *    region zone (is_expandable && self-zoned)   → "REGION"
 *    settlement (is_settlement_node || node_type → "SETTLEMENT"
 *    containing "settlement")
 *    everything else                              → "PLACE"
 *  Coarser than the specific typeBadge below the name (which can be
 *  TAVERN / DUNGEON / WILDERNESS / etc.), so the header reads as a
 *  two-level hierarchy: kind-of-place, then name, then exact-type. */
function broadCategoryLabel(node: WorldNode): string {
  if (node.is_expandable === true && node.zone_id === node.id) return "REGION";
  if (
    node.is_settlement_node === true ||
    (typeof node.node_type === "string" && node.node_type.includes("settlement"))
  ) {
    return "SETTLEMENT";
  }
  return "PLACE";
}

/** PR-6v — presence badge text for the header's top-right pill.
 *  Renders only when at least one NPC is present:
 *    1 NPC   → "WITH NPC"
 *    2 NPCs  → "WITH NPCS"
 *    3+ NPCs → "WITH PRESENCE"   (matches the busy-tavern mockup) */
function presenceBadgeText(npcCount: number): string | null {
  if (npcCount <= 0)  return null;
  if (npcCount === 1) return "WITH NPC";
  if (npcCount === 2) return "WITH NPCS";
  return "WITH PRESENCE";
}

/** Action verb per LocationObject.type (CLAUDE.md rule 87).
 *   container         → Search
 *   lore              → Read
 *   fixture / trigger → Examine
 *   (undefined)       → Examine */
function actionFor(obj: LocationObject): { label: string; verb: string; icon: "container" | "lore" | "box" } {
  switch (obj.type) {
    case "container": return { label: "Search",  verb: "search the",  icon: "container" };
    case "lore":      return { label: "Read",    verb: "read the",    icon: "lore" };
    case "fixture":
    case "trigger":
    default:          return { label: "Examine", verb: "examine the", icon: "box" };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function ContextPanel({ onSubmit, onAttune }: ContextPanelProps) {
  const masterState    = useGameStore((s) => s.masterState);
  const locationAssets = useGameStore((s) => s.locationAssets);
  // UI-8 — open loot modal state. ID === null when modal is closed.
  // Replaces the UI-3 console.log stub. The modal reads the live
  // entry from masterState.floor_loot so taking items in the modal
  // immediately reflects in the entry's items count + the Context
  // Panel entry disappearing once the pile is empty.
  const [lootModalEntryId, setLootModalEntryId] = useState<string | null>(null);

  // Stable identity check — render the genre-overlay shell even when
  // there's no state yet, so the panel doesn't flash blank during
  // initial hydration.
  const node = masterState?.world_graph
    ? masterState.world_graph.nodes[masterState.world_graph.current_node_id]
    : undefined;
  const locationDef = findLocationDefinition(masterState ?? null, node?.id);
  const nodeAsset   = node
    ? locationAssets.find(
        (a) => a.category === AssetCategory.LOCATION && a.id === node.asset_id,
      )
    : undefined;

  // ── NPCs (always show when present — discovered for objects only) ─────────
  const npcAssets = node
    ? locationAssets.filter(
        (a) =>
          a.category === AssetCategory.CHARACTER &&
          node.npc_ids.includes(a.id),
      )
    : [];

  // ── Objects (discovered-only) ────────────────────────────────────────────
  // Discovery-tracking note: LocationObject does not carry an
  // individual `discovered` flag. The pragmatic fallback per the
  // prompt is the node's own `discovered` field — true after the
  // player first arrives. Subsequent visits show every interactable
  // object the bible seeded; the first arrival narration is what
  // "discovers" them.
  const objects: LocationObject[] = (() => {
    if (!locationDef || !node?.discovered) return [];
    return locationDef.objects.filter((o) => o.is_interactable);
  })();

  // ── Unlooted remains for this node ───────────────────────────────────────
  const floorLoot: FloorLootEntry[] = (masterState?.floor_loot ?? []).filter(
    (e) =>
      e.node_id === node?.id &&
      (e.pending !== undefined || e.items.length > 0 || e.gold > 0),
  );

  // ── Renderers ────────────────────────────────────────────────────────────

  // Change 3 — section labels rephrased from environmental copy ("Here
  // Now" / "In This Space") to action-first ("Present" / "Interact").
  // The new wording reads as a UI affordance rather than a narrator
  // aside, matching the row-level Talk → / Search verbs below it.
  const npcSection = npcAssets.length === 0 ? null : (
    <Section label="Present">
      {npcAssets.map((npc) => {
        const role  = String(npc.constitution?.role ?? "").trim();
        const trust = masterState ? trustFor(masterState, npc) : 50;
        return (
          <NpcCard
            key={npc.id}
            name={npc.name}
            role={role}
            dot={dispositionColour(trust)}
            onClick={() => onSubmit(`talk to ${npc.name}`, { npcName: npc.name })}
          />
        );
      })}
    </Section>
  );

  // UI-fix-D 4b — Attune entry is settlement-hub-only and locked
  // during combat (rule 166 — attunement is locked in combat; the
  // AttunementModal also self-guards, but suppressing the entry here
  // keeps the panel from advertising a no-op tap). The entry sits at
  // the TOP of the "In This Space" section so the player sees it
  // before any environmental objects on a settlement arrival.
  const showAttune =
    !!onAttune &&
    node?.node_type === "settlement_hub" &&
    masterState?.combat?.active !== true;

  // PR-6v (E): when the node is discovered but has zero interactables,
  // surface an explicit "Nothing to interact with here." line inside
  // the Interact section instead of hiding the section entirely.
  // This keeps the panel rhythm stable (PRESENT / INTERACT / REGION
  // always in the same vertical slots when explored) and gives the
  // player closure: "no, you really didn't miss anything here."
  // The section still hides pre-discovery so unvisited spaces don't
  // spoil their lack of objects.
  const hasInteractables = showAttune || objects.length > 0 || floorLoot.length > 0;
  const showEmptyInteract = !hasInteractables && node?.discovered === true;
  const objectsSection = !(hasInteractables || showEmptyInteract) ? null : (
    <Section label="Interact">
      {hasInteractables ? (
        <>
          {showAttune && (
            <ObjectCard
              key="attune"
              name="Attune abilities"
              icon="attune"
              actionLabel="Attune"
              onClick={() => onAttune?.()}
            />
          )}
          {objects.map((obj) => {
            const a = actionFor(obj);
            return (
              <ObjectCard
                key={obj.id}
                name={obj.name}
                icon={a.icon}
                actionLabel={a.label}
                onClick={() => onSubmit(`${a.verb} ${obj.name}`)}
              />
            );
          })}
          {floorLoot.map((entry) => (
            <ObjectCard
              key={`loot-${entry.id}`}
              name={entry.source === "enemy" ? "Remains" : "Container"}
              icon={entry.source === "enemy" ? "remains" : "container"}
              actionLabel="Search"
              // UI-8 — open the loot modal. The entry disappears from this
              // list automatically once items + gold are all taken (the
              // floor_loot filter at the top of this component drops fully-
              // looted entries).
              onClick={() => setLootModalEntryId(entry.id)}
            />
          ))}
        </>
      ) : (
        <p
          className="italic"
          style={{
            fontFamily: "var(--serif)",
            fontSize:   11,
            color:      "var(--ui-text-muted)",
            margin:     0,
          }}
        >
          Nothing to interact with here.
        </p>
      )}
    </Section>
  );

  // ── Atmosphere prose source ──────────────────────────────────────────────
  // Prefer bible LocationDefinition.atmosphere; fall back to the world
  // asset's atmosphere/physical_description so re-applied legacy saves
  // still surface prose.
  const atmosphere =
    locationDef?.atmosphere?.trim() ||
    String(nodeAsset?.constitution?.atmosphere ?? "").trim() ||
    String(nodeAsset?.constitution?.physical_description ?? "").trim();

  const typeBadge = (node?.category ?? locationDef?.type ?? "").toString();

  return (
    <div
      role="complementary"
      aria-label="Context Panel"
      // PR-6v (A): panel wrapper matches the CharacterPanel card
      // treatment from PR-5v — visible warm-charcoal background,
      // soft border, rounded corners. Was var(--content-bg) (the
      // genre gradient) with no border, so the panel read as a
      // bleed of the page bg rather than a contained surface.
      // overflow-y-auto preserved so internal content still scrolls
      // when long; modern browsers clip the scroll content to the
      // border-radius cleanly.
      className="relative flex h-full flex-col overflow-y-auto"
      style={{
        background:   "var(--bg-2)",
        border:       "1px solid var(--card-border)",
        borderRadius: 8,
        color:        NPC_NAME_INK,
      }}
    >
      {/* UI-1 overlay trio — let the genre class on the GameLayout
          root paint the texture; .ol-* are inert on genres that don't
          opt in. pointer-events:none so they never block clicks. */}
      <div
        className="ol-tex"
        aria-hidden
        style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 2 }}
      />
      <div
        className="ol-scan"
        aria-hidden
        style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 2 }}
      />
      <div
        className="ol-grid"
        aria-hidden
        style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 2 }}
      />

      {/* Content stack — sits above the overlay z-index 2 layer. */}
      <div className="relative z-10 flex flex-col gap-3 p-3">
        {/* ── Section A: Location header (PR-6v (B): 3-row hierarchy) ──
            Row 1 — broad category left + presence badge right
            Row 2 — location name large
            Row 3 — specific type (only when distinct from broad)
            Replaces the prior single-row name + muted-type-label
            layout (which read as two ranks of equal weight). The
            new hierarchy puts the broad kind-of-place on top, the
            named place in the visual centre, and the exact type
            below — match design/mockups/context panel.png. */}
        {node && (() => {
          const broad        = broadCategoryLabel(node);
          const specific     = (typeBadge ?? "").toString().toUpperCase();
          const presenceText = presenceBadgeText(npcAssets.length);
          return (
            <header style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div
                style={{
                  display:        "flex",
                  alignItems:     "center",
                  justifyContent: "space-between",
                  gap:            6,
                }}
              >
                <span
                  className="uppercase"
                  style={{
                    fontFamily:    "var(--sans)",
                    fontSize:      8,
                    letterSpacing: "0.14em",
                    color:         "var(--ui-text-muted)",
                  }}
                >
                  {broad}
                </span>
                {presenceText && (
                  <span
                    aria-label="NPCs present"
                    className="uppercase"
                    style={{
                      fontFamily:    "var(--sans)",
                      fontSize:      8,
                      letterSpacing: "0.14em",
                      color:         "var(--genre-accent)",
                      background:    "rgba(var(--genre-accent-rgb), .12)",
                      border:        "1px solid rgba(var(--genre-accent-rgb), .30)",
                      borderRadius:  20,
                      padding:       "2px 8px",
                      flexShrink:    0,
                    }}
                  >
                    {presenceText}
                  </span>
                )}
              </div>
              <div
                className="italic"
                style={{
                  fontFamily: "var(--serif)",
                  fontSize:   20,
                  fontWeight: 500,
                  lineHeight: 1.2,
                  color:      NAME_INK,
                }}
              >
                {node.name}
              </div>
              {specific && specific !== broad && (
                <div
                  className="uppercase"
                  style={{
                    fontFamily:    "var(--sans)",
                    fontSize:      9,
                    letterSpacing: "0.12em",
                    color:         "var(--genre-accent)",
                  }}
                >
                  {specific}
                </div>
              )}
            </header>
          );
        })()}

        {/* ── Section B: Atmosphere prose ───────────────────────────────── */}
        {atmosphere && (
          <p
            className="italic"
            style={{
              fontFamily: "var(--serif)",
              fontSize:   11,
              lineHeight: 1.7,
              color:      PROSE_INK,
              margin:     0,
            }}
          >
            {atmosphere}
          </p>
        )}

        {/* ── Section C: HERE NOW (NPCs) ────────────────────────────────── */}
        {npcSection}

        {/* ── Section D: IN THIS SPACE (Objects) ────────────────────────── */}
        {objectsSection}

        {/* PR-6v-c: Section E (region footer + breadcrumb) removed —
            the TopBar breadcrumb and StoryFeed header both already
            communicate location, making the panel-foot card a third
            redundant restatement. The panel now ends on the Interact
            section; the wrapper's p-3 supplies the bottom padding
            (12px, matches the gap between sections), so no orphaned
            footer-margin remains at 375px or any other viewport. */}
      </div>

      {/* UI-8 — Loot modal overlay. Mounts adjacent to the panel so it
          inherits the same React subtree but lives at z-index 50 over
          the rest of the layout. Closes on backdrop tap or ✕. */}
      <LootModal
        entryId={lootModalEntryId}
        onClose={() => setLootModalEntryId(null)}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal pieces
// ─────────────────────────────────────────────────────────────────────────────

/** Section header — 2px left accent bar + Inter Tight uppercase
 *  label. Used by both NPC and object sections. */
function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          style={{
            display:    "inline-block",
            width:      2,
            height:     10,
            background: "var(--genre-accent)",
          }}
        />
        <span
          // PR-6v (C): section label brightness lift — matches the
          // CharacterPanel PR-5v-b treatment (var(--ui-text-2) 9px
          // 0.12em). Was 7px / 0.14em / HEADING_LABEL (#6a5530), which
          // washed out against the new BG-1 / panel-card surface.
          className="uppercase"
          style={{
            fontFamily:    "var(--sans)",
            fontSize:      9,
            letterSpacing: "0.12em",
            color:         "var(--ui-text-2)",
          }}
        >
          {label}
        </span>
      </div>
      <div className="flex flex-col gap-1.5">{children}</div>
    </section>
  );
}

/** NPC card.
 *  Change 4 — name switches from serif italic to Inter Tight 600 so it
 *  reads as a UI label, not a narrator beat. Role gets explicit 0.10em
 *  tracking to space it out at 8px. A new "Talk →" affordance lands
 *  rightmost in the genre accent, pinned via marginLeft:auto so it
 *  hugs the right edge regardless of name length. The whole row stays
 *  tappable — Talk → is signal, not a target. */
function NpcCard({
  name, role, dot, onClick,
}: {
  name:    string;
  role:    string;
  dot:     string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      // PR-6v-b (A): match the CharacterPanel EquipSlotRow shell so
      // NPC and equipped-item cards read at the same visual weight
      // across the two sidebars. Was a faint genre-accent tinted bg
      // (rgba .06 / .10) which made the NPC list float against the
      // PR-6v warm-charcoal card; the solid dark rgba(0,0,0,.20)
      // (= the equipped-row background) sits firmly inside the panel.
      className="group flex w-full items-center gap-2 transition-colors text-left"
      style={{
        background:   "rgba(0,0,0,.20)",
        border:       "1px solid var(--card-border)",
        borderRadius: 7,
        padding:      "8px 10px",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background =
          "rgba(0,0,0,.30)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background =
          "rgba(0,0,0,.20)";
      }}
    >
      <span
        aria-hidden
        className="shrink-0"
        style={{
          width:        6,
          height:       6,
          borderRadius: "50%",
          background:   dot,
        }}
      />
      <div className="min-w-0 flex-1">
        <div
          className="truncate"
          style={{
            // PR-6v (D): NPC name lifted 12 → 14px to match the
            // primary-label weight in design/mockups/context panel.png.
            // Roles + Talk → affordance stay at their PR-5 sizes
            // so the name reads as the dominant element in the row.
            fontFamily: "var(--sans)",
            fontWeight: 600,
            fontSize:   14,
            color:      NPC_NAME_INK,
          }}
        >
          {name}
        </div>
        {role && (
          <div
            className="truncate uppercase"
            style={{
              fontFamily:    "var(--sans)",
              fontSize:      8,
              letterSpacing: "0.10em",
              color:         NPC_ROLE_INK,
            }}
          >
            {role}
          </div>
        )}
      </div>
      <span
        aria-hidden
        style={{
          fontFamily:  "var(--sans)",
          fontSize:    10,
          color:       "var(--genre-accent)",
          flexShrink:  0,
          marginLeft:  "auto",
          paddingLeft: 8,
        }}
      >
        Talk →
      </span>
    </button>
  );
}

/** Object card — verb label + name.
 *  Change 5 — collapsed from "icon + name + pill" to a two-element
 *  horizontal row: the verb leads (Inter Tight 7px uppercase ls
 *  0.14em in the genre accent), the object name follows in Cormorant
 *  Garamond italic 12px (OBJ_NAME_INK = #d4bc88, shared with NPC
 *  names per UI-fix-E). The icon column and the right-side accent
 *  pill are both gone — the verb label and italic name carry the
 *  action read on their own without the visual noise.
 *
 *  The `icon` prop is retained on the signature so call sites in
 *  this file don't need a coordinated edit and the type stays
 *  documented; it's marked unused via `void`. The Tabler icon
 *  imports stay in place per spec (may be reintroduced later).
 *
 *  The Attune entry uses the same shell — its caller passes
 *  actionLabel="Attune" + name="Attune abilities", which slots
 *  cleanly into the verb-then-name layout without a special case. */
function ObjectCard({
  name, icon, actionLabel, onClick,
}: {
  name:        string;
  icon:        "container" | "lore" | "box" | "remains" | "attune";
  actionLabel: string;
  onClick:     () => void;
}) {
  void icon;
  return (
    <button
      type="button"
      onClick={onClick}
      // PR-6v-b (A): match the NpcCard / EquipSlotRow dark card shell.
      // Hover is one notch brighter (rgba .28 vs the NpcCard's .30)
      // so the two card types still read as a hierarchy — NPC slightly
      // more prominent than object — without the prior accent tint.
      className="group flex w-full items-center transition-colors text-left"
      style={{
        background:   "rgba(0,0,0,.20)",
        border:       "1px solid var(--card-border)",
        borderRadius: 7,
        padding:      "7px 10px",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background =
          "rgba(0,0,0,.28)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background =
          "rgba(0,0,0,.20)";
      }}
    >
      <span
        className="uppercase"
        style={{
          fontFamily:    "var(--sans)",
          fontSize:      7,
          letterSpacing: "0.14em",
          color:         "var(--genre-accent)",
          flexShrink:    0,
          marginRight:   8,
        }}
      >
        {actionLabel}
      </span>
      <span
        className="italic"
        style={{
          fontFamily:   "var(--serif)",
          fontStyle:    "italic",
          fontSize:     12,
          color:        OBJ_NAME_INK,
          flex:         1,
          minWidth:     0,
          overflow:     "hidden",
          textOverflow: "ellipsis",
          whiteSpace:   "nowrap",
        }}
      >
        {name}
      </span>
    </button>
  );
}
