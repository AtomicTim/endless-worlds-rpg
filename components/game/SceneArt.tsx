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

  void colors;
  return (
    <div
      className="shrink-0"
      style={{
        borderBottom: "1px solid var(--line)",
        padding:      "10px 16px",
        background:   "var(--bg-1)",
      }}
    >
      <div
        className="mx-auto flex w-full max-w-[640px] flex-col items-center text-center"
      >
        <div
          className="ew-serif"
          style={{
            color:      "var(--ink-1)",
            fontSize:   20,
            fontStyle:  "italic",
            lineHeight: 1.2,
            wordBreak:  "break-word",
          }}
        >
          {locationName}
        </div>
        {locationType && (
          <div
            className="ew-mono"
            style={{
              marginTop:     4,
              fontSize:      9,
              color:         "var(--ink-4)",
              letterSpacing: "0.32em",
              textTransform: "uppercase",
            }}
          >
            {locationType}
          </div>
        )}
      </div>
    </div>
  );
}
