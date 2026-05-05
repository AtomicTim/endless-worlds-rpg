import type { MoveType, ParsedAction, WorldGraph, WorldNode } from "@/types/game";

export interface MoveClassification {
  type:              MoveType;
  /** For GRAPH_NAVIGATE — the resolved node id. */
  target_node_id?:   string;
  /** For ZONE_EXPAND / WORLD_EXPLORE — the player's stated destination. */
  destination_hint?: string;
}

// ── Pattern banks ──────────────────────────────────────────────────────────────

/**
 * Words that describe interior, in-room sub-areas the player commonly says
 * "go to" but which are NOT separate locations. Phrasing here NEVER causes
 * the world graph to update — the narrator just describes the sub-area in
 * place.
 */
const INTERNAL_DESCRIBE_PATTERNS: RegExp[] = [
  /\b(bar|counter|window|corner|table|tables|fireplace|hearth|stairs|stairway|booth|stool|stools|bench|benches|back of the room|far end|other side)\b/i,
  /\blook (at|around|toward|over)\b/i,
  /\b(approach|step toward|walk to(ward)?|move to(ward)?) (the )?(bar|counter|fireplace|hearth|window|table|stool|booth)\b/i,
];

/**
 * Words that describe sub-areas of an expandable zone the player may be
 * walking to (alley, courtyard, garden, etc.). When the current zone is
 * expandable AND the destination matches these AND it isn't a known
 * graph node, the move becomes ZONE_EXPAND — a new sub_location is
 * created under the current zone.
 */
const ZONE_EXPAND_KEYWORDS = [
  "alley", "courtyard", "basement", "rooftop", "garden", "stables",
  "chapel", "back lot", "back of town", "town square", "warehouse",
  "yard", "side street", "back street", "rear", "around back",
  "outside", "behind the", "next door", "kitchen", "cellar",
  "attic", "loft", "storeroom", "stockroom", "smithy", "workshop",
];

// ── Levenshtein (small inline impl — no external dep) ──────────────────────────

function levenshtein(a: string, b: string): number {
  if (a === b)             return 0;
  if (a.length === 0)      return b.length;
  if (b.length === 0)      return a.length;

  const dp: number[][] = [];
  for (let i = 0; i <= a.length; i++) dp.push([i]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j]     + 1,    // deletion
        dp[i][j - 1]     + 1,    // insertion
        dp[i - 1][j - 1] + cost  // substitution
      );
    }
  }
  return dp[a.length][b.length];
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function searchHaystack(action: ParsedAction): string {
  return [
    action.primary_target ?? "",
    action.inferred_intent ?? "",
  ].join(" ").toLowerCase();
}

function matchesNode(haystack: string, primaryTarget: string, nodeName: string): boolean {
  const lowerName    = nodeName.toLowerCase().trim();
  const lowerTarget  = primaryTarget.toLowerCase().trim();
  if (!lowerName) return false;

  // Substring either way — handles "the inn" → "Driftwood Inn".
  if (haystack.includes(lowerName)) return true;
  if (lowerTarget && lowerName.includes(lowerTarget)) return true;

  // Distance fallback for typos / abbreviations.
  if (lowerTarget && Math.abs(lowerName.length - lowerTarget.length) < 8) {
    if (levenshtein(lowerTarget, lowerName) < 4) return true;
  }
  return false;
}

// ── Classifier ─────────────────────────────────────────────────────────────────

/**
 * Decides what kind of move the player is attempting in the context of the
 * current World Graph node.
 *
 * 1. INTERNAL_DESCRIBE — sub-area phrase ("go to the bar"); no nav.
 * 2. GRAPH_NAVIGATE    — fuzzy match against a connected node's name.
 * 3. ZONE_EXPAND       — current zone is expandable AND destination
 *                        matches a sub-area keyword.
 * 4. WORLD_EXPLORE     — anything else; player is heading somewhere new.
 *
 * The function is pure — it never mutates the graph. The resolver and
 * game loop apply consequences based on the returned classification.
 */
export function classifyMove(
  action:      ParsedAction,
  currentNode: WorldNode,
  graph:       WorldGraph
): MoveClassification {
  const primary = (action.primary_target ?? "").trim();
  const haystack = searchHaystack(action);

  // ── Step 2 (precedence over INTERNAL_DESCRIBE) ────────────────────────────
  // Check known connections first so that an explicit nav to a connected
  // place ALWAYS wins over a heuristic "internal" hit (a connected node
  // named "The Hearth" should NOT be hijacked by the hearth pattern).
  for (const connId of currentNode.connections) {
    const node = graph.nodes[connId];
    if (!node) continue;
    if (matchesNode(haystack, primary, node.name) ||
        matchesNode(haystack, primary, node.id)) {
      return { type: "GRAPH_NAVIGATE", target_node_id: node.id };
    }
  }

  // ── Step 1 — sub-area phrasing inside the current room ────────────────────
  for (const re of INTERNAL_DESCRIBE_PATTERNS) {
    if (re.test(haystack)) {
      return { type: "INTERNAL_DESCRIBE" };
    }
  }

  // ── Step 3 — ZONE_EXPAND when current zone allows it and destination
  // sounds like a sub-area inside it.
  if (currentNode.is_expandable) {
    for (const kw of ZONE_EXPAND_KEYWORDS) {
      if (haystack.includes(kw)) {
        return {
          type:             "ZONE_EXPAND",
          destination_hint: primary || kw,
        };
      }
    }
  }

  // ── Step 4 — anything else. Heading somewhere genuinely new. ─────────────
  return {
    type:             "WORLD_EXPLORE",
    destination_hint: primary,
  };
}
