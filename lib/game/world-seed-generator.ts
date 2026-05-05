import { Genre } from "@/types/game";
import type { WorldConsistencyDocument, WorldSeed } from "@/types/game";
import { fallbackWorldSeed } from "@/lib/game/world-seed-generator-fallback";

/**
 * Day 17 — generates the pre-seeded world skeleton at character creation.
 *
 * Calls the server route /api/game/generate-world-seed which invokes
 * Claude (a SEPARATE AI call from the narrator) to produce a structured
 * WorldSeed object. The server route validates the response and falls back
 * to a hardcoded genre-appropriate skeleton on parse / network failure, so
 * this helper never throws — the wizard always gets a usable seed.
 *
 * Expected latency: 3-5 seconds. The wizard should display a
 * "Generating your world..." indicator while this runs.
 */
export async function generateWorldSeed(
  genre: Genre,
  characterName: string,
  characterBackground: string,
  // Day 19A — Optional WCD. When provided, the route prepends it to the
  // generation prompt so the resulting WorldSeed respects the WCD's
  // landmarks, factions, and rules.
  wcd?: WorldConsistencyDocument
): Promise<WorldSeed> {
  try {
    const response = await fetch("/api/game/generate-world-seed", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        genre,
        characterName,
        characterBackground,
        ...(wcd ? { wcd } : {}),
      }),
    });

    if (!response.ok) {
      console.warn("[generateWorldSeed] non-OK response, using fallback");
      return fallbackWorldSeed(genre, characterName);
    }

    const data = (await response.json()) as { worldSeed?: WorldSeed; error?: string };
    if (!data.worldSeed) {
      console.warn("[generateWorldSeed] missing worldSeed in payload, using fallback");
      return fallbackWorldSeed(genre, characterName);
    }
    return data.worldSeed;
  } catch (err) {
    console.warn("[generateWorldSeed] fetch failed, using fallback", err);
    return fallbackWorldSeed(genre, characterName);
  }
}
