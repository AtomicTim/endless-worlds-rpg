// Art generation — scene-type detection, SVG prompt assembly, and the
// client-side fetch wrapper. The actual Claude call lives in the
// /api/game/generate-art route.

export type SceneType =
  | "TOP_DOWN_TOWN"
  | "SIDE_VIEW_INTERIOR"
  | "FRONT_PORTRAIT"
  | "ISOMETRIC_WIDE";

const TOWN_KEYWORDS      = ["town", "city", "settlement", "village", "haven", "district", "market"];
const INTERIOR_KEYWORDS  = ["tavern", "shop", "interior", "room", "cabin", "station", "lab", "facility"];
const PORTRAIT_PREFIXES  = ["npc_", "character_", "enemy_", "boss_"];
const WILDERNESS_KEYWORDS = ["wilderness", "forest", "wasteland", "desert", "space", "void", "ocean", "mountain"];

/**
 * Decide which SVG composition the art engine should produce based on the
 * location_id. Falls back to SIDE_VIEW_INTERIOR for anything unrecognised.
 */
export function getSceneType(locationId: string): SceneType {
  const id = locationId.toLowerCase();

  if (PORTRAIT_PREFIXES.some((p) => id.startsWith(p))) return "FRONT_PORTRAIT";
  if (TOWN_KEYWORDS.some((k) => id.includes(k)))       return "TOP_DOWN_TOWN";
  if (INTERIOR_KEYWORDS.some((k) => id.includes(k)))   return "SIDE_VIEW_INTERIOR";
  if (WILDERNESS_KEYWORDS.some((k) => id.includes(k))) return "ISOMETRIC_WIDE";

  return "SIDE_VIEW_INTERIOR";
}

// ── Genre palettes — referenced in the SVG prompt ────────────────────────────

export const GENRE_PALETTES: Record<string, string[]> = {
  fantasy:             ["#0a0a0a", "#d97706", "#16a34a", "#fef3c7", "#292524"],
  cyberpunk:           ["#0a0a0a", "#06b6d4", "#d946ef", "#e0f2fe", "#1e1b4b"],
  horror_lovecraftian: ["#0a0a0a", "#4ade80", "#7c3aed", "#d1fae5", "#1a1a2e"],
  space_opera:         ["#0a0a0a", "#a855f7", "#c0c0c0", "#ede9fe", "#0f0f1a"],
  post_apocalyptic:    ["#0a0a0a", "#ea580c", "#9ca3af", "#fef3c7", "#1c1917"],
};

function paletteFor(genre: string): string[] {
  return GENRE_PALETTES[genre.toLowerCase()] ?? GENRE_PALETTES.fantasy;
}

// ── Prompt assembly ──────────────────────────────────────────────────────────

const BASE_PROMPT = `You are an SVG pixel art generator for a retro RPG game.
Generate a single valid SVG element (not a full HTML document).
The SVG must:
- Use viewBox='0 0 320 200'
- Use ONLY the provided color palette
- Look like 16-bit era pixel art — hard edges, no gradients, no blur, no anti-aliasing
- Use <rect> elements as 'pixels' (each rect is 4x4 or 8x8)
- NO <text> elements, NO <image> elements, NO filters
- Be self-contained — no external references
- Return ONLY the SVG markup starting with <svg, nothing else`;

const SCENE_INSTRUCTIONS: Record<SceneType, (locationName: string, palette: string) => string> = {
  TOP_DOWN_TOWN: (name, palette) =>
    `Bird's eye view of ${name}. Show building footprints as colored rectangles, paths as lighter colored strips between them, and small detail rects for doors/windows. Make it look like a classic RPG overworld map tile. Palette: ${palette}`,

  SIDE_VIEW_INTERIOR: (name, palette) =>
    `Side-scrolling interior view of ${name}. Show floor, walls, ceiling as horizontal bands. Add furniture/objects as simple rectangular shapes. Leave center area open for character. Palette: ${palette}`,

  FRONT_PORTRAIT: (name, palette) =>
    `Front-facing character portrait for ${name}. Centered figure, simple pixel art face and body. 16-bit RPG sprite style. Bold simple shapes. Palette: ${palette}`,

  ISOMETRIC_WIDE: (name, palette) =>
    `Wide establishing shot of ${name} in slight isometric perspective. Horizon line at 40% height. Ground texture fills bottom 60%. Sky/space fills top 40%. Simple landmark shapes in middle distance. Palette: ${palette}`,
};

export function buildArtSystemPrompt(): string {
  return BASE_PROMPT;
}

export function buildArtUserPrompt(
  sceneType: SceneType,
  locationName: string,
  genre: string,
  description: string
): string {
  const palette = paletteFor(genre).map((c) => `"${c}"`).join(", ");
  const sceneLine = SCENE_INSTRUCTIONS[sceneType](locationName, palette);
  const desc = description.trim()
    ? `\n\nLocation flavor (use as inspiration, not as labels): ${description.trim()}`
    : "";
  return `${sceneLine}${desc}`;
}

// ── Client-side caller ───────────────────────────────────────────────────────

export interface GenerateArtRequest {
  location_id:   string;
  location_name: string;
  scene_type:    SceneType;
  genre:         string;
  description:   string;
  session_id?:   string;
}

export interface GenerateArtResponse {
  svg:    string;
  cached: boolean;
}

/**
 * Fires a non-blocking call to the art engine and returns the SVG. Resolves
 * to null on any failure — callers fall back to no art rather than breaking
 * the scene.
 */
export async function generateArt(
  req: GenerateArtRequest
): Promise<GenerateArtResponse | null> {
  try {
    const response = await fetch("/api/game/generate-art", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(req),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as GenerateArtResponse;
    if (!data.svg) return null;
    return data;
  } catch {
    return null;
  }
}
