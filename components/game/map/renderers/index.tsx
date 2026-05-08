"use client";

import React from "react";
import * as Fantasy from "./FantasyMap";
import * as Cyber   from "./CyberMap";
import * as Space   from "./SpaceMap";
import * as Apoc    from "./ApocMap";
import * as Horror  from "./HorrorMap";
import { genreSlug } from "@/lib/game/genre-slug";
import type { Genre } from "@/types/game";
import type { RendererProps } from "./types";

export type Tier = 1 | 2 | 3;

interface Props extends RendererProps {
  genre: Genre | string | null | undefined;
  tier:  Tier;
}

/**
 * Genre dispatcher for the three-tier map.
 *
 * Routes (genre × tier) to the correct renderer module. The diagnostic
 * DebugMap that was wired in during the map-overhaul session is no
 * longer the default — every active genre gets its themed art back.
 * To re-enable DebugMap for diagnostics, swap the Renderer line below.
 */
export function GenreMap({ genre, tier, ...rendererProps }: Props) {
  const slug     = genreSlug(genre);
  const mod      = pickModule(slug);
  const Renderer = tier === 1 ? mod.WorldMap
                 : tier === 2 ? mod.RegionMap
                 :              mod.LocalMap;
  return <Renderer {...rendererProps} />;
}

function pickModule(slug: string) {
  switch (slug) {
    case "cyber":   return Cyber;
    case "space":   return Space;
    case "apoc":    return Apoc;
    case "horror":  return Horror;
    case "fantasy":
    default:        return Fantasy;
  }
}

export type { RendererProps, MapNode, MapConnection, MapExit, BoundsLike, ExitEdge } from "./types";
export { project, VIEW, PAD } from "./types";
