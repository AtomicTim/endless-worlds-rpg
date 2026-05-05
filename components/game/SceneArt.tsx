"use client";

import { Genre } from "@/types/game";
import { useGameStore } from "@/lib/stores/game-store";
import { getGenreColors } from "./genre-ui";

interface SceneArtProps {
  /** Bare slug, e.g. "thornbridge_crossing". */
  locationId:   string;
  /** Human-readable name shown in the panel. */
  locationName: string;
  /** Genre passed as a string (legacy prop) — converted to enum below. */
  genre:        string;
  /** Reserved for future use. */
  description?: string;
  /** Reserved for future use. */
  sessionId?:   string;
}

/**
 * Scene art panel — placeholder.
 *
 * The SVG generation pipeline was removed; this component now renders a
 * simple genre-themed plate showing the active location name (and its
 * type if it exists in the world graph). All accents come from
 * GENRE_CONFIGS via getGenreColors so the panel themes correctly across
 * all five genres.
 */
export function SceneArt({ locationId, locationName, genre }: SceneArtProps) {
  // Coerce the legacy string genre prop into the enum for the helper.
  const genreEnum = (Object.values(Genre) as string[]).includes(genre)
    ? (genre as Genre)
    : Genre.FANTASY;
  const colors    = getGenreColors(genreEnum);

  // Look up the current node's category (tavern / settlement / dungeon /
  // etc.) when a world graph is loaded so the panel can show the place's
  // type as a subtle subtitle. Falls back to nothing when no graph yet.
  const locationType = useGameStore((s) => {
    const graph = s.masterState?.world_graph;
    if (!graph) return null;
    const node = graph.nodes[locationId] ?? graph.nodes[graph.current_node_id];
    return node?.category ?? null;
  });

  return (
    <div
      className="shrink-0 px-4 py-3"
      style={{ borderBottom: "1px solid var(--color-border)" }}
    >
      <div
        className="mx-auto flex w-full max-w-[320px] flex-col items-center justify-center"
        style={{
          aspectRatio:     "320 / 200",
          border:          `1px solid color-mix(in srgb, ${colors.primary} 55%, var(--color-border))`,
          borderRadius:    6,
          backgroundColor: `color-mix(in srgb, ${colors.primary} 4%, var(--color-bg))`,
          fontFamily:      "var(--font-mono)",
          padding:         "0.75rem",
        }}
      >
        <div
          style={{
            color:         colors.primary,
            fontSize:      14,
            fontWeight:    700,
            letterSpacing: "0.04em",
            textAlign:     "center",
            lineHeight:    1.3,
            wordBreak:     "break-word",
          }}
        >
          {locationName}
        </div>
        {locationType && (
          <div
            style={{
              marginTop:     6,
              fontSize:      10,
              color:         "var(--color-muted)",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              textAlign:     "center",
            }}
          >
            {locationType}
          </div>
        )}
      </div>
    </div>
  );
}
