import { Genre } from "@/types/game";
import type { Enemy } from "@/types/game";
import { FANTASY_BESTIARY } from "./fantasy";
import { CYBER_BESTIARY }   from "./cyber";
import { HORROR_BESTIARY }  from "./horror";
import { SPACE_BESTIARY }   from "./space";
import { APOC_BESTIARY }    from "./apoc";

/**
 * Genre bestiary index — Day 20 Combat (combat-spec §6.4).
 *
 * Returns the hand-authored enemy roster for the requested genre.
 * Region-specific enemies (LLM-generated at WorldBible time) are
 * stored separately on `WorldBible.starting_region.enemies` and
 * `RegionBible.enemies`; the combat resolver will merge both
 * sources when looking up an enemy id at spawn time.
 *
 * Returns [] for unknown genres so callers don't have to guard
 * against undefined; combat triggers are simply suppressed when
 * the genre has no bestiary entries yet.
 */
export function getGenreBestiary(genre: Genre | string | undefined): Enemy[] {
  switch (genre) {
    case Genre.FANTASY:             return FANTASY_BESTIARY;
    case Genre.CYBERPUNK:           return CYBER_BESTIARY;
    case Genre.HORROR_LOVECRAFTIAN: return HORROR_BESTIARY;
    case Genre.SPACE_OPERA:         return SPACE_BESTIARY;
    case Genre.POST_APOCALYPTIC:    return APOC_BESTIARY;
    default:                        return [];
  }
}

/**
 * Look up a single enemy by id within the genre bestiary. Returns
 * undefined when the id isn't in this genre's roster — the combat
 * resolver should then check region-specific enemies before giving up.
 */
export function findGenreEnemy(genre: Genre | string | undefined, id: string): Enemy | undefined {
  return getGenreBestiary(genre).find((e) => e.id === id);
}

export {
  FANTASY_BESTIARY,
  CYBER_BESTIARY,
  HORROR_BESTIARY,
  SPACE_BESTIARY,
  APOC_BESTIARY,
};
