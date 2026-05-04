"use client";

import { useEffect, useState } from "react";
import { useGameStore } from "@/lib/stores/game-store";
import { generateArt, getSceneType } from "@/lib/game/art-generator";
import { updateWorldAssetSvg, normalizeAssetId } from "@/lib/game/codex";
import { AssetCategory } from "@/types/game";

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
  const cached           = useGameStore((s) => s.artCache[locationId]);
  const setArtCache      = useGameStore((s) => s.setArtCache);
  const setLocationAssets = useGameStore((s) => s.setLocationAssets);
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
      if (result?.svg) {
        setArtCache(locationId, result.svg);

        // Backfill svg_content on the world asset for this location so the
        // Codex page can display it. Only write if session is known and the
        // asset exists without SVG already.
        if (!sessionId) {
          console.warn("[SceneArt] sessionId is undefined — cannot backfill SVG on world asset.");
        } else {
          const store         = useGameStore.getState();
          const assetId       = normalizeAssetId(AssetCategory.LOCATION, locationName);
          const matchingAsset = store.locationAssets.find(
            (a) => a.category === AssetCategory.LOCATION && a.first_seen_location === locationId
          );

          console.log(
            `[SceneArt] SVG ready for locationId=${locationId} session=${sessionId}`,
            `matchingAsset=${matchingAsset?.id ?? "none"}`,
            `locationAssets count=${store.locationAssets.length}`
          );

          if (!matchingAsset) {
            console.warn(
              `[SceneArt] No LOCATION world asset found for locationId=${locationId}` +
              ` — asset may not be saved yet (race condition). GameLoop will retry.`
            );
          } else if (matchingAsset.svg_content) {
            console.log(`[SceneArt] SVG already set on asset ${matchingAsset.id}, skipping.`);
          } else {
            const targetId = matchingAsset.id ?? assetId;
            console.log(`[SceneArt] Calling updateWorldAssetSvg(session=${sessionId}, asset=${targetId})`);
            void updateWorldAssetSvg(sessionId, targetId, result.svg)
              .then(() => console.log(`[SceneArt] SVG backfill succeeded for asset ${targetId}`))
              .catch((err) => console.error(`[SceneArt] SVG backfill failed for asset ${targetId}:`, err));
            // Optimistically update the in-memory store so Codex page sees it
            // without a full refetch.
            setLocationAssets(
              store.locationAssets.map((a) =>
                a.id === matchingAsset.id ? { ...a, svg_content: result.svg } : a
              )
            );
          }
        }
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
