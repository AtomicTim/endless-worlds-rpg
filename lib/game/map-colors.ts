/**
 * Day 19F — Map color palette.
 *
 * Maps every WorldNode `category` (or RegionOutline `type`) to a hex
 * color used by the three-tier map components. Colors span all five
 * launch genres so a Cyberpunk save and a Fantasy save both render
 * sensibly without any extra wiring.
 *
 * Unknown types fall through to MAP_DEFAULT_COLOR so map rendering is
 * always lossless — every discovered node gets a square, even when its
 * category isn't in the palette yet.
 */

export const MAP_NODE_COLORS: Record<string, string> = {
  // ── Fantasy / shared ──────────────────────────────────────────────────────
  tavern:           "#92400e", // dark amber
  settlement_hub:   "#1d4ed8", // blue
  settlement:       "#1d4ed8",
  market:           "#a16207", // amber
  smithy:           "#7c2d12", // dark red
  wilderness:       "#15803d", // green
  dungeon:          "#4b5563", // grey
  stronghold:       "#7c2d12", // dark red
  port:             "#0e7490", // teal
  ruin:             "#78716c", // stone
  temple:           "#6d28d9", // violet
  guild:            "#1d4ed8", // blue
  garrison:         "#991b1b", // red

  // ── Cyberpunk ─────────────────────────────────────────────────────────────
  bar:              "#831843", // dark pink
  "corp-zone":      "#1e1b4b", // dark blue
  slum:             "#78350f", // brown
  "data-hub":       "#0e7490", // teal
  underground:      "#1c1917", // near black

  // ── Space Opera ───────────────────────────────────────────────────────────
  station:          "#4c1d95", // purple
  ship:             "#1e3a5f", // navy
  colony:           "#14532d", // dark green
  cantina:          "#831843",

  // ── Horror ────────────────────────────────────────────────────────────────
  mansion:          "#1f2937", // near black
  asylum:           "#374151", // dark grey
  ritual:           "#3b0764", // very dark purple

  // ── Post-Apocalyptic ──────────────────────────────────────────────────────
  shelter:          "#7f1d1d", // dark red
  wasteland:        "#92400e", // rust
  scrapyard:        "#57534e", // stone
  outpost:          "#78350f",
};

/** Fallback color for nodes whose category is not in MAP_NODE_COLORS. */
export const MAP_DEFAULT_COLOR = "#374151"; // dark grey

/** Amber glow used to highlight the player's current location across all tiers. */
export const MAP_CURRENT_GLOW = "#fbbf24";

/** Outline-only fill for undiscovered nodes hinted at by graph edges. */
export const MAP_UNDISCOVERED  = "#1f2937";

/** Muted gold for WCD landmark diamond markers. */
export const MAP_LANDMARK      = "#a16207";

/** Cyan dot used to mark NPC positions on Tier 2 / Tier 3 maps. */
export const MAP_NPC_DOT       = "#22d3ee";

/**
 * Look up the fill color for a WorldNode given its `category`
 * (preferred) or `type` (fallback for legacy nodes without a category).
 * Returns MAP_DEFAULT_COLOR on miss so callers never have to null-check.
 */
export function getNodeColor(type: string | undefined | null): string {
  if (!type) return MAP_DEFAULT_COLOR;
  return MAP_NODE_COLORS[type] ?? MAP_DEFAULT_COLOR;
}

/**
 * Three-letter abbreviations for the location-type chip rendered in the
 * bottom-left corner of every Tier 3 sub-location block. Replaces the
 * previous emoji icons so small blocks don't get hijacked by a 16px glyph.
 *
 * Match is case-insensitive and falls through to "LOC" for any node whose
 * category isn't enumerated below — keeps the map lossless while still
 * giving the player a quick visual cue.
 */
export const NODE_TYPE_ABBREVIATIONS: Record<string, string> = {
  // ── Fantasy / shared ──────────────────────────────────────────────────────
  settlement:        "HUB",
  settlement_hub:    "HUB",
  hub:               "HUB",
  tavern:            "INN",
  inn:               "INN",
  bar:               "INN",
  alehouse:          "INN",
  market:            "MKT",
  shop:              "MKT",
  store:             "MKT",
  smithy:            "FRG",
  forge:             "FRG",
  workshop:          "FRG",
  temple:            "SHR",
  shrine:            "SHR",
  chapel:            "SHR",
  guild:             "GLD",
  hall:              "GLD",
  garrison:          "GAR",
  guard:             "GAR",
  dungeon:           "DNG",
  crypt:             "DNG",
  ruins:             "DNG",
  ruin:              "DNG",
  wilderness:        "WLD",
  nature:            "WLD",
  port:              "PRT",
  dock:              "PRT",
  harbor:            "PRT",

  // ── Cyberpunk ─────────────────────────────────────────────────────────────
  "data-hub":        "DAT",
  data_hub:          "DAT",
  server:            "DAT",
  corp:              "CRP",
  "corp-zone":       "CRP",
  corporate:         "CRP",
  slum:              "CRP",
  underground:       "DAT",

  // ── Space Opera ───────────────────────────────────────────────────────────
  station:           "STN",
  ship:              "SHP",
  colony:            "STN",
  cantina:           "INN",

  // ── Horror ────────────────────────────────────────────────────────────────
  manor:             "MNR",
  mansion:           "MNR",
  asylum:            "MNR",
  ritual:            "SHR",

  // ── Post-Apocalyptic ──────────────────────────────────────────────────────
  shelter:           "SHR",
  bunker:            "SHR",
  wasteland:         "WST",
  outpost:           "WST",
  scrapyard:         "WST",
  stronghold:        "GAR",
};

export const NODE_TYPE_ABBR_DEFAULT = "LOC";

/**
 * Look up the 3-letter abbreviation for a WorldNode given its `category`
 * (preferred) or `type` (fallback). Returns NODE_TYPE_ABBR_DEFAULT on miss.
 */
export function getNodeTypeAbbr(type: string | undefined | null): string {
  if (!type) return NODE_TYPE_ABBR_DEFAULT;
  const key = type.toLowerCase();
  return NODE_TYPE_ABBREVIATIONS[key] ?? NODE_TYPE_ABBR_DEFAULT;
}
