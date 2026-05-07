"use client";

import React from "react";
// DEBUG MODE: using DebugMap. Restore GenreMap when confirmed.
// import * as Fantasy from "./FantasyMap";
// import * as Cyber   from "./CyberMap";
// import * as Space   from "./SpaceMap";
// import * as Apoc    from "./ApocMap";
// import * as Horror  from "./HorrorMap";
// import { genreSlug } from "@/lib/game/genre-slug";
import type { Genre } from "@/types/game";
import type { RendererProps } from "./types";
import { DebugMap } from "./DebugMap";

export type Tier = 1 | 2 | 3;

interface Props extends RendererProps {
  genre: Genre | string | null | undefined;
  tier:  Tier;
}

/**
 * Genre dispatcher for the three-tier map.
 *
 * DEBUG MODE: temporarily routing every (genre × tier) combination
 * through the diagnostic DebugMap renderer so we can verify node
 * coordinates, connections, exits, and tier filters with the styled
 * art removed. The genre renderers (FantasyMap / CyberMap / SpaceMap /
 * ApocMap / HorrorMap) are unchanged on disk and ready to be restored
 * by uncommenting the imports above and re-enabling pickModule below.
 */
export function GenreMap({ genre, tier, ...rendererProps }: Props) {
  void genre; void tier;
  return <DebugMap {...rendererProps} />;

  // Restore when DebugMap is no longer needed:
  // const slug     = genreSlug(genre);
  // const mod      = pickModule(slug);
  // const Renderer = tier === 1 ? mod.WorldMap
  //                : tier === 2 ? mod.RegionMap
  //                : mod.LocalMap;
  // return <Renderer {...rendererProps} />;
}

// function pickModule(slug: string) {
//   switch (slug) {
//     case "cyber":   return Cyber;
//     case "space":   return Space;
//     case "apoc":    return Apoc;
//     case "horror":  return Horror;
//     case "fantasy":
//     default:        return Fantasy;
//   }
// }

export type { RendererProps, MapNode, MapConnection, MapExit, BoundsLike, ExitEdge } from "./types";
export { project, VIEW, PAD } from "./types";
