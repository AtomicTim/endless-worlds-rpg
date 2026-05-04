// Known start-location display names
const KNOWN_LOCATIONS: Record<string, string> = {
  post_apocalyptic_start_01:    "The Wasteland",
  fantasy_start_01:             "The Realm",
  cyberpunk_start_01:           "The Grid",
  horror_lovecraftian_start_01: "The Mist",
  space_opera_start_01:         "Docking Bay Alpha",
};

/**
 * Converts a snake_case location ID into a human-readable display name.
 * Uses a table of known start locations; falls back to title-casing the ID.
 */
export function formatLocationId(locationId: string): string {
  if (KNOWN_LOCATIONS[locationId]) return KNOWN_LOCATIONS[locationId];
  return locationId
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
