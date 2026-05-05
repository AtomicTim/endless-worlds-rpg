import { Genre } from "@/types/game";
import type { SeedLocation, WorldSeed } from "@/types/game";
import { normalizeLocationId } from "@/lib/game/codex";

/**
 * Day 17 — fires when the player MOVEs to a location that doesn't exist in
 * world_assets yet. Calls /api/game/generate-location-stub which uses Claude
 * to produce a structured SeedLocation with id/name/type/description.
 *
 * Falls back to a minimal stub derived from the player's hint on any failure
 * so the game loop never blocks. The real narrator description fills in
 * during the MOVE narration; this stub just gives the asset table a
 * canonical record so future references stay consistent.
 */
export async function generateLocationStub(
  locationHint: string,
  currentLocation: string,
  worldSeed: WorldSeed | undefined,
  genre: Genre
): Promise<SeedLocation> {
  const fallback: SeedLocation = {
    id:          normalizeLocationId(locationHint || "unknown") || "unknown_place",
    name:        locationHint || "Unnamed Place",
    type:        "other",
    description: "A newly encountered location. The narrator will fill in details on first visit.",
  };

  try {
    const response = await fetch("/api/game/generate-location-stub", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ locationHint, currentLocation, worldSeed, genre }),
    });

    if (!response.ok) return fallback;

    const data = (await response.json()) as { stub?: SeedLocation };
    return data.stub ?? fallback;
  } catch {
    return fallback;
  }
}
