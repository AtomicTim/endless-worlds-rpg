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
 * Routes to the matching FantasyMap / CyberMap / SpaceMap / ApocMap /
 * HorrorMap renderer module by `genreSlug`, then picks the WorldMap
 * (tier 1), RegionMap (tier 2), or LocalMap (tier 3) export.
 *
 * The shared RendererProps shape lets WorldMap.tsx (the sidebar
 * container) compute projected node positions / connections / exits
 * once and forward them to whichever genre is active without
 * conditional branching.
 */
export function GenreMap({ genre, tier, ...rendererProps }: Props) {
  const slug = genreSlug(genre);
  const mod  = pickModule(slug);
  const Renderer = tier === 1 ? mod.WorldMap
                 : tier === 2 ? mod.RegionMap
                 : mod.LocalMap;
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

export type { RendererProps, MapNode, MapConnection, MapExit, BoundsLike } from "./types";
export { project, VIEW, PAD } from "./types";
