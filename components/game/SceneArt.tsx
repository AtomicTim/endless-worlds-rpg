"use client";

import { useEffect, useState } from "react";
import { useGameStore } from "@/lib/stores/game-store";
import { generateArt, getSceneType } from "@/lib/game/art-generator";

interface SceneArtProps {
  locationId:   string;
  locationName: string;
  genre:        string;
  description:  string;
  sessionId?:   string;
}

/**
 * Renders the SVG pixel-art scene for a given location. Reads from the
 * Zustand artCache for instant display on revisit; otherwise fires an async
 * fetch to /api/game/generate-art and shows a scan-line loading state until
 * the SVG arrives.
 */
export function SceneArt({
  locationId,
  locationName,
  genre,
  description,
  sessionId,
}: SceneArtProps) {
  const cached      = useGameStore((s) => s.artCache[locationId]);
  const setArtCache = useGameStore((s) => s.setArtCache);
  const [loading, setLoading] = useState(!cached);

  useEffect(() => {
    if (cached) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    void (async () => {
      const result = await generateArt({
        location_id:   locationId,
        location_name: locationName,
        scene_type:    getSceneType(locationId),
        genre,
        description,
        session_id:    sessionId,
      });
      if (cancelled) return;
      if (result?.svg) setArtCache(locationId, result.svg);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [locationId, locationName, genre, description, sessionId, cached, setArtCache]);

  return (
    <div
      className="shrink-0 px-4 py-3"
      style={{ borderBottom: "1px solid var(--color-border)" }}
    >
      <div
        className="mx-auto w-full max-w-[320px] overflow-hidden rounded-md"
        style={{
          aspectRatio:    "320 / 200",
          border:         "1px solid color-mix(in srgb, var(--color-primary) 55%, var(--color-border))",
          backgroundColor: "var(--color-bg)",
        }}
      >
        {cached ? (
          <div
            className="svg-fade-in h-full w-full"
            style={{ imageRendering: "pixelated" }}
            dangerouslySetInnerHTML={{ __html: ensureResponsiveSvg(cached) }}
          />
        ) : loading ? (
          <div className="svg-loader h-full w-full" aria-label={`Generating art for ${locationName}`} />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center text-[10px] italic"
            style={{ color: "var(--color-muted)" }}
          >
            Art unavailable
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Force the SVG to fill its container by adding/replacing width/height
 * attributes if the model omits them. The viewBox stays as authored.
 */
function ensureResponsiveSvg(svg: string): string {
  // Inject width="100%" height="100%" if absent.
  let out = svg;
  if (!/width\s*=/.test(out))  out = out.replace(/<svg\b/i, '<svg width="100%"');
  if (!/height\s*=/.test(out)) out = out.replace(/<svg\b/i, '<svg height="100%"');
  return out;
}
