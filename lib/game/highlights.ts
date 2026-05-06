/**
 * Day 19E — Exact-match highlight builder.
 *
 * Replaces the narrator-driven `points_of_interest` highlight pipeline.
 * Instead of trusting whatever the model emits, we build the highlight
 * list deterministically from the live game state at the moment a
 * narrative renders:
 *
 *   - Tier 1 OBJECTs: current location's world_asset.constitution.key_landmarks
 *   - NPCs:           CHARACTER assets whose ids appear in currentNode.npc_ids
 *   - LOCATIONs:      WorldNode names for currentNode.connections
 *   - LANDMARKs:      WCD landmarks where known_by === "everyone"
 *
 * Matching is whole-word, case-insensitive, and prefers longer phrases
 * when multiple candidates collide.
 */

import { AssetCategory } from "@/types/game";
import type {
  MasterState,
  PointOfInterest,
  WorldAsset,
} from "@/types/game";

export interface HighlightCandidate {
  label:       string;
  type:        PointOfInterest["type"];
  description: string;
  /** Navigation redesign — set on LOCATION candidates. When the player
   *  clicks a LOCATION highlight in the story feed, the click handler
   *  uses this id to call useGameLoop.navigateTo directly, bypassing
   *  text parsing and the popover. */
  nodeId?:     string;
}

/**
 * Compute the candidate list of exact-match highlights for the current
 * scene. Pure function — no React, no store access. Caller passes the
 * live state and locationAssets in.
 */
export function buildExactHighlights(
  state:          MasterState,
  locationAssets: readonly WorldAsset[]
): HighlightCandidate[] {
  const out: HighlightCandidate[] = [];
  const graph = state.world_graph;
  const currentNodeId =
    graph?.current_node_id ?? state.world_state.current_node_id ?? state.world_state.current_location_id;
  const currentNode = graph?.nodes[currentNodeId];

  // ── Tier 1 OBJECT highlights ───────────────────────────────────────────────
  const currentLocAsset = locationAssets.find(
    (a) =>
      a.category === AssetCategory.LOCATION &&
      (a.id === `location_${state.world_state.current_location_id}` ||
        a.first_seen_location === state.world_state.current_location_id)
  );
  const tier1Names = (currentLocAsset?.constitution.key_landmarks ?? []).filter(
    (s) => typeof s === "string" && s.trim().length > 0
  );
  for (const name of tier1Names) {
    out.push({
      label:       name,
      type:        "ITEM", // ITEM popover is the closest behaviour: Examine/Take/Leave
      description: `An interactable object in this scene.`,
    });
  }

  // ── NPC highlights ─────────────────────────────────────────────────────────
  if (currentNode) {
    const npcAssets = currentNode.npc_ids
      .map((id) => locationAssets.find((a) => a.id === id))
      .filter((a): a is WorldAsset => !!a && a.category === AssetCategory.CHARACTER);
    for (const npc of npcAssets) {
      const role =
        typeof npc.constitution.role === "string" ? npc.constitution.role : "";
      out.push({
        label:       npc.name,
        type:        "NPC",
        description: role || "A character in this scene.",
      });
    }
  }

  // ── Connected LOCATION highlights ──────────────────────────────────────────
  if (currentNode && graph) {
    for (const connId of currentNode.connections) {
      const node = graph.nodes[connId];
      if (!node) continue;
      out.push({
        label:       node.name,
        type:        "LOCATION",
        description:
          node.type === "sub_location"
            ? "A connected sub-location."
            : "A connected location.",
        // Navigation redesign — store the canonical node id so a click
        // on a LOCATION highlight can route through navigateTo without
        // parsing the display name back into a slug.
        nodeId:      node.id,
      });
    }
  }

  // ── WCD LANDMARK highlights (info only) ────────────────────────────────────
  const wcd = state.metadata.world_consistency;
  if (wcd) {
    for (const lm of wcd.landmarks) {
      if (lm.known_by !== "everyone") continue;
      out.push({
        label:       lm.name,
        type:        "LANDMARK",
        description: lm.public_description || "A landmark known throughout this world.",
      });
    }
  }

  return out;
}

/**
 * Whole-word, case-insensitive matcher. The needle must be flanked by a
 * non-word character (or a string boundary) on both sides — guards against
 * matching "ire" inside "fireplace".
 *
 * Returns -1 when no match is found, otherwise the start index in the
 * lowercased haystack.
 */
function findWholeWord(haystackLower: string, needleLower: string): number {
  if (!needleLower) return -1;
  let from = 0;
  while (from <= haystackLower.length) {
    const idx = haystackLower.indexOf(needleLower, from);
    if (idx < 0) return -1;
    const before = idx === 0 ? "" : haystackLower[idx - 1];
    const after  = idx + needleLower.length >= haystackLower.length
      ? ""
      : haystackLower[idx + needleLower.length];
    const isWordChar = (c: string) => /[\w']/.test(c);
    if (!isWordChar(before) && !isWordChar(after)) return idx;
    from = idx + 1;
  }
  return -1;
}

export interface HighlightMatch {
  start: number;
  end:   number;
  point: PointOfInterest;
  /** Navigation redesign — present for LOCATION matches so the click
   *  handler in StoryFeed can route directly via navigateTo(nodeId)
   *  without round-tripping through text parsing. */
  nodeId?: string;
}

/**
 * Scan `text` for exact, whole-word, case-insensitive occurrences of
 * each highlight candidate. Returns ordered, non-overlapping matches —
 * longer phrases win on tie.
 */
export function findExactHighlights(
  text:       string,
  candidates: readonly HighlightCandidate[]
): HighlightMatch[] {
  if (candidates.length === 0 || !text) return [];
  const lower = text.toLowerCase();
  const raw: HighlightMatch[] = [];

  for (const c of candidates) {
    const needle = c.label.trim().toLowerCase();
    if (!needle) continue;
    const idx = findWholeWord(lower, needle);
    if (idx < 0) continue;
    raw.push({
      start: idx,
      end:   idx + needle.length,
      point: { label: c.label, type: c.type, description: c.description },
      ...(c.nodeId ? { nodeId: c.nodeId } : {}),
    });
  }

  // Earliest start wins; on tie, the longer phrase wins (so "Korven Thrike"
  // beats "Korven" when both candidates appear at the same offset).
  raw.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));

  // Drop overlapping matches — first match wins.
  const out: HighlightMatch[] = [];
  let lastEnd = -1;
  for (const m of raw) {
    if (m.start >= lastEnd) {
      out.push(m);
      lastEnd = m.end;
    }
  }
  return out;
}
