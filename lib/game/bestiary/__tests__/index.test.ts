import { Genre } from "@/types/game";
import {
  getGenreBestiary,
  findGenreEnemy,
  FANTASY_BESTIARY,
  CYBER_BESTIARY,
  HORROR_BESTIARY,
  SPACE_BESTIARY,
  APOC_BESTIARY,
} from "../index";

describe("getGenreBestiary", () => {
  it("returns the Fantasy bestiary for Genre.FANTASY", () => {
    expect(getGenreBestiary(Genre.FANTASY)).toBe(FANTASY_BESTIARY);
  });

  it("returns the Cyberpunk bestiary for Genre.CYBERPUNK", () => {
    expect(getGenreBestiary(Genre.CYBERPUNK)).toBe(CYBER_BESTIARY);
  });

  it("returns the Horror bestiary for Genre.HORROR_LOVECRAFTIAN", () => {
    expect(getGenreBestiary(Genre.HORROR_LOVECRAFTIAN)).toBe(HORROR_BESTIARY);
  });

  it("returns the Space bestiary for Genre.SPACE_OPERA", () => {
    expect(getGenreBestiary(Genre.SPACE_OPERA)).toBe(SPACE_BESTIARY);
  });

  it("returns the Apoc bestiary for Genre.POST_APOCALYPTIC", () => {
    expect(getGenreBestiary(Genre.POST_APOCALYPTIC)).toBe(APOC_BESTIARY);
  });

  it("returns an empty array for unknown genres", () => {
    expect(getGenreBestiary("noir" as Genre)).toEqual([]);
    expect(getGenreBestiary(undefined)).toEqual([]);
    expect(getGenreBestiary("" as Genre)).toEqual([]);
  });

  it("placeholder bestiaries each ship at least 3 entries", () => {
    expect(CYBER_BESTIARY.length).toBeGreaterThanOrEqual(3);
    expect(HORROR_BESTIARY.length).toBeGreaterThanOrEqual(3);
    expect(SPACE_BESTIARY.length).toBeGreaterThanOrEqual(3);
    expect(APOC_BESTIARY.length).toBeGreaterThanOrEqual(3);
  });
});

describe("findGenreEnemy", () => {
  it("returns the matching enemy when the id exists in the genre", () => {
    const goblin = findGenreEnemy(Genre.FANTASY, "fantasy_goblin");
    expect(goblin).toBeDefined();
    expect(goblin?.name).toBe("Goblin");
  });

  it("returns undefined for an id that exists in a different genre", () => {
    const result = findGenreEnemy(Genre.CYBERPUNK, "fantasy_goblin");
    expect(result).toBeUndefined();
  });

  it("returns undefined for an unknown id", () => {
    expect(findGenreEnemy(Genre.FANTASY, "fantasy_does_not_exist")).toBeUndefined();
  });

  it("returns undefined gracefully for an unknown genre", () => {
    expect(findGenreEnemy("noir" as Genre, "fantasy_goblin")).toBeUndefined();
  });
});
