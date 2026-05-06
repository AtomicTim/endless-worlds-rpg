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
 *
 * BUG FIX 2: covers vertical movement and interior areas across all 5
 * genres so "go upstairs" / "head to engine room" / "lower level" don't
 * spawn duplicate WORLD_EXPLORE nodes.
 */
const INTERNAL_DESCRIBE_PATTERNS: RegExp[] = [
  // Generic furniture / fixtures (Fantasy/Cyberpunk/Horror lounges).
  /\b(bar|counter|window|corner|table|tables|fireplace|hearth|stairs|stairway|booth|stool|stools|bench|benches|back of the room|far end|other side)\b/i,
  /\blook (at|around|toward|over)\b/i,
  /\b(approach|step toward|walk to(ward)?|move to(ward)?) (the )?(bar|counter|fireplace|hearth|window|table|stool|booth)\b/i,

  // FIX 3: approaching/walking toward a person. These are dialogue
  // setups, never location moves — without this, "walk up to the
  // knight" classifies as WORLD_EXPLORE and spawns a duplicate node.
  /\b(walk up to|walked up to|approach|approaches|approached|move toward|step toward|step up to|head toward|go to the|go up to)\s+(the\s+)?(woman|man|figure|person|stranger|knight|guard|merchant|innkeeper|bartender|clerk|vendor)\b/i,

  // Vertical movement (all genres).
  /\b(upstairs|downstairs|up the stairs|down the stairs|upper floor|lower floor|ground floor|mezzanine)\b/i,
  /\b(go (up|down)|head (up|down)|climb (up|down)|make (my |your |our )?way (up|down))\b/i,

  // Interior rooms — Fantasy/Horror.
  /\b(common room|tap room|taproom|main hall|great hall|back room|back hall|side room|cellar|kitchen|storeroom)\b/i,

  // Interior areas — Cyberpunk.
  /\b(server room|back office|maintenance corridor|loading bay|cargo hold|lower deck)\b/i,

  // Interior areas — Space Opera.
  /\b(engine room|bridge|cargo bay|med bay|crew quarters|observation deck|airlock)\b/i,

  // Interior areas — Post-Apocalyptic.
  /\b(lower level|storage area|generator room|back of the|deeper into the)\b/i,
];

/**
 * BUG FIX 1: Type-keyword bank used as a third matching channel inside
 * matchesNode(). When the player says "make for the inn" we need to
 * resolve to the connected node typed "tavern" — substring matching on
 * the node's NAME ("Driftwood Tavern") doesn't catch "inn", but the
 * type-keyword channel does.
 */
const TYPE_KEYWORDS: Record<string, string[]> = {
  // Fantasy
  tavern:       ["inn", "tavern", "pub", "alehouse", "lodge", "rest", "hostel"],
  settlement:   ["town", "village", "crossing", "hamlet", "outpost", "settlement"],
  dungeon:      ["dungeon", "cave", "crypt", "ruins", "vault", "underground"],
  stronghold:   ["castle", "fort", "fortress", "keep", "citadel", "tower"],
  wilderness:   ["forest", "woods", "marsh", "swamp", "plains", "hills", "wilds"],
  market:       ["market", "bazaar", "docks", "harbor", "wharf", "depot"],
  // Cyberpunk
  "data-hub":   ["hub", "node", "server", "data center", "uplink", "terminal"],
  "corp-zone":  ["corp", "corporate", "arcology", "tower", "complex"],
  slum:         ["slum", "undercity", "sprawl", "alley", "district", "block"],
  bar:          ["bar", "club", "dive", "joint", "lounge", "cantina"],
  // Space Opera
  station:      ["station", "dock", "port", "bay", "hangar", "outpost"],
  ship:         ["ship", "vessel", "craft", "cruiser", "freighter"],
  colony:       ["colony", "settlement", "base", "outpost", "habitat"],
  // Horror
  mansion:      ["mansion", "house", "estate", "manor", "asylum", "institute"],
  street:       ["street", "alley", "lane", "road", "avenue"],
  // Post-Apocalyptic
  shelter:      ["shelter", "vault", "bunker", "safehouse", "camp", "settlement"],
  wasteland:    ["wasteland", "ruins", "highway", "outpost", "scrapyard"],
  // Catch-all generic types we use ourselves.
  ruin:         ["ruin", "ruins"],
  port:         ["port", "dock", "harbor", "wharf", "marina"],
  other:        [],
};

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

function matchesNode(
  haystack: string,
  primaryTarget: string,
  nodeName: string,
  nodeType?: string
): boolean {
  const lowerName    = nodeName.toLowerCase().trim();
  const lowerTarget  = primaryTarget.toLowerCase().trim();

  if (lowerName) {
    // Substring either way — handles "the inn" → "Driftwood Inn".
    if (haystack.includes(lowerName)) return true;
    if (lowerTarget && lowerName.includes(lowerTarget)) return true;

    // Distance fallback for typos / abbreviations.
    if (lowerTarget && Math.abs(lowerName.length - lowerTarget.length) < 8) {
      if (levenshtein(lowerTarget, lowerName) < 4) return true;
    }
  }

  // BUG FIX 1: type-keyword channel. When the player uses a category word
  // ("inn", "market", "ship") that matches the node's TYPE rather than its
  // proper name, accept the match so "make for the inn" routes to the
  // connected tavern rather than spawning a duplicate via WORLD_EXPLORE.
  if (nodeType) {
    const keywords = TYPE_KEYWORDS[nodeType] ?? [];
    for (const kw of keywords) {
      if (haystack.includes(kw)) return true;
    }
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

  // ── Step 0 (FIX 3) — approaching a person is NOT a move. ──────────────────
  // The intent parser sometimes classifies "walk up to the knight" as
  // ActionType.MOVE because of the verb. The graph has no node for "the
  // knight", so without this short-circuit we'd fall through to
  // WORLD_EXPLORE and spawn a phantom location. Treating it as
  // INTERNAL_DESCRIBE keeps the player in place and lets the narrator
  // describe the encounter; the player's next turn (a quoted line)
  // routes through the dialogue path naturally.
  const isApproachingPerson =
    /\b(walk(ed)?\s+up\s+to|approach(es|ed)?|step(ped)?\s+(up|toward)|move(d)?\s+toward)\b/i.test(haystack);
  if (isApproachingPerson) {
    const hasPersonTarget =
      /\b(woman|man|figure|person|stranger|knight|guard|merchant|innkeeper|bartender|clerk|vendor)\b/i.test(haystack);
    if (hasPersonTarget) {
      return { type: "INTERNAL_DESCRIBE" };
    }
  }

  // ── Step 2 (precedence over INTERNAL_DESCRIBE) ────────────────────────────
  // Check known connections first so that an explicit nav to a connected
  // place ALWAYS wins over a heuristic "internal" hit (a connected node
  // named "The Hearth" should NOT be hijacked by the hearth pattern).
  //
  // Two-pass:
  //   1. Look for a NAME match (substring or Levenshtein on the node's
  //      proper name / id). Wins immediately.
  //   2. If no name match, look for TYPE-keyword matches. Only commit if
  //      EXACTLY ONE connection matches via its type — otherwise the
  //      reference is ambiguous (e.g. two taverns connected) and we leave
  //      it to the user to be more specific.
  let nameMatchId: string | null = null;
  const typeMatchIds: string[]   = [];
  for (const connId of currentNode.connections) {
    const node = graph.nodes[connId];
    if (!node) continue;
    // Name-only match (skip type bank by passing undefined).
    if (matchesNode(haystack, primary, node.name) ||
        matchesNode(haystack, primary, node.id)) {
      nameMatchId = node.id;
      break;
    }
    // Type-only match: re-run matchesNode with empty name + the node's
    // category (seed-location type — tavern/market/etc., not the structural
    // 'zone'|'sub_location' value).
    if (node.category && matchesNode(haystack, primary, "", node.category)) {
      typeMatchIds.push(node.id);
    }
  }
  if (nameMatchId) {
    return { type: "GRAPH_NAVIGATE", target_node_id: nameMatchId };
  }
  if (typeMatchIds.length === 1) {
    return { type: "GRAPH_NAVIGATE", target_node_id: typeMatchIds[0] };
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
