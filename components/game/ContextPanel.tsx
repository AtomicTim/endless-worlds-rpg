"use client";

import React, { useState } from "react";
// UI-fix-E 4b — swapped from Lucide to Tabler per design-reference §18.
// Tabler is the icon library called out in the spec and is already a
// project dependency (@tabler/icons-react ^3.44.0, used by the wizard,
// dashboard, and TopBar). Mapping:
//   container → IconPackage   (was lucide Package)
//   lore      → IconBook      (was lucide BookOpen)
//   remains   → IconSkull     (was lucide Skull)
//   box/other → IconBox       (was lucide Box)
import { IconPackage, IconBox, IconBook, IconSkull } from "@tabler/icons-react";
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
}

// ─────────────────────────────────────────────────────────────────────────────
// Style constants (kept inside the file — none participate in CLAUDE.md's
// Story Feed Colors token system, so no globals.css contamination).
// ─────────────────────────────────────────────────────────────────────────────

const HEADING_LABEL = "#6a5530";
const NAME_INK      = "#e2cda0";
const PROSE_INK     = "#9a7e52";
const NPC_NAME_INK  = "#d4bc88";
const NPC_ROLE_INK  = "#7a6040";
// UI-fix-E 4a — object name now matches NPC name tone (#d4bc88, was
// #c4b090). Per design-reference §18 both names are the primary
// label inside their respective cards and share visual weight; the
// previous #c4b090 made object names read as secondary.
const OBJ_NAME_INK  = "#d4bc88";
const ICON_INK      = "#7a6040";

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

export function ContextPanel({ onSubmit }: ContextPanelProps) {
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

  const npcSection = npcAssets.length === 0 ? null : (
    <Section label="Here Now">
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

  const showObjects = objects.length > 0 || floorLoot.length > 0;
  const objectsSection = !showObjects ? null : (
    <Section label="In This Space">
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
      className="relative flex h-full flex-col overflow-y-auto"
      style={{
        background: "var(--content-bg)",
        color:      NPC_NAME_INK,
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
        {/* ── Section A: Location header ────────────────────────────────── */}
        {node && (
          <div className="flex items-center gap-2">
            <div
              className="min-w-0 flex-1 italic truncate"
              style={{
                fontFamily: "var(--serif)",
                fontSize:   13,
                color:      NAME_INK,
              }}
            >
              {node.name}
            </div>
            {typeBadge && (
              <span
                aria-label="Location type"
                className="shrink-0 uppercase"
                style={{
                  fontFamily:    "var(--sans)",
                  fontSize:      7,
                  letterSpacing: "0.12em",
                  padding:       "2px 8px",
                  borderRadius:  20,
                  color:         "var(--genre-accent)",
                  background:    "rgba(var(--genre-accent-rgb), .12)",
                  border:        "1px solid rgba(var(--genre-accent-rgb), .28)",
                }}
              >
                {typeBadge}
              </span>
            )}
          </div>
        )}

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
          className="uppercase"
          style={{
            fontFamily:    "var(--sans)",
            fontSize:      7,
            letterSpacing: "0.14em",
            color:         HEADING_LABEL,
          }}
        >
          {label}
        </span>
      </div>
      <div className="flex flex-col gap-1.5">{children}</div>
    </section>
  );
}

/** NPC card. */
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
      className="group flex w-full items-center gap-2 transition-colors text-left"
      style={{
        background:   "rgba(var(--genre-accent-rgb), .06)",
        border:       "1px solid rgba(var(--genre-accent-rgb), .16)",
        borderRadius: 7,
        padding:      "8px 10px",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background =
          "rgba(var(--genre-accent-rgb), .10)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background =
          "rgba(var(--genre-accent-rgb), .06)";
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
          className="italic truncate"
          style={{
            fontFamily: "var(--serif)",
            fontSize:   12,
            color:      NPC_NAME_INK,
          }}
        >
          {name}
        </div>
        {role && (
          <div
            className="truncate"
            style={{
              fontFamily: "var(--sans)",
              fontSize:   8,
              color:      NPC_ROLE_INK,
            }}
          >
            {role}
          </div>
        )}
      </div>
    </button>
  );
}

/** Object card — icon + name + accent action pill. */
function ObjectCard({
  name, icon, actionLabel, onClick,
}: {
  name:        string;
  icon:        "container" | "lore" | "box" | "remains";
  actionLabel: string;
  onClick:     () => void;
}) {
  const IconCmp =
    icon === "container" ? IconPackage
    : icon === "lore"    ? IconBook
    : icon === "remains" ? IconSkull
    :                      IconBox;

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center gap-2 transition-colors text-left"
      style={{
        background:   "rgba(var(--genre-accent-rgb), .04)",
        border:       "1px solid rgba(var(--genre-accent-rgb), .12)",
        borderRadius: 7,
        padding:      "7px 10px",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background =
          "rgba(var(--genre-accent-rgb), .08)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background =
          "rgba(var(--genre-accent-rgb), .04)";
      }}
    >
      <IconCmp
        aria-hidden
        size={13}
        style={{ color: ICON_INK, flexShrink: 0 }}
      />
      <div
        className="min-w-0 flex-1 italic truncate"
        style={{
          fontFamily: "var(--serif)",
          fontSize:   12,
          color:      OBJ_NAME_INK,
        }}
      >
        {name}
      </div>
      <span
        className="shrink-0 uppercase"
        style={{
          fontFamily:    "var(--sans)",
          fontSize:      7,
          letterSpacing: "0.12em",
          padding:       "2px 8px",
          borderRadius:  20,
          color:         "var(--genre-accent)",
          background:    "rgba(var(--genre-accent-rgb), .12)",
          border:        "1px solid rgba(var(--genre-accent-rgb), .28)",
        }}
      >
        {actionLabel}
      </span>
    </button>
  );
}
