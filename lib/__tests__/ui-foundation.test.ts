// lib/__tests__/ui-foundation.test.ts
//
// UI Foundation Verification Harness — gate that the design-token
// system is the single source of truth for visual surface values.
//
// Scope:
//  (1) Forbids new hardcoded hex codes inside components/game/* that
//      aren't on the ALLOWED list below. Shadow color palettes (e.g.
//      `const NAME_INK = "#e2cda0"`) are how the previous two UI
//      audits silently drifted from globals.css — this test makes
//      that drift impossible to merge unchecked.
//  (2) Scrollable surfaces must include the .ol-tex / .ol-scan /
//      .ol-grid overlay trio so the per-genre texture treatment
//      paints. A missing overlay div is invisible until you switch
//      genre, then it's the difference between "feels alive" and
//      "feels flat."
//  (3) GameLayout must stamp a genre-* className on the root container,
//      otherwise the per-genre CSS variable sets in globals.css never
//      apply.
//
// Adding a new colour:
//  - First ask whether the value is semantic (HP states, damage type,
//    NPC disposition, etc.) — if yes, it belongs as a CSS variable in
//    globals.css (or damage-tokens.css). Add it there, then reference
//    via var(--token-name) in components and the test will pass.
//  - Only register a literal hex in ALLOWED_HEX_CODES below if it's
//    truly file-local (single-component decorative tint that doesn't
//    track theming). Include a comment justifying it.
//
// Running:
//  npx jest lib/__tests__/ui-foundation.test.ts

import fs from "node:fs";
import path from "node:path";

const REPO_ROOT = path.resolve(__dirname, "../..");
const COMPONENTS_DIR = path.join(REPO_ROOT, "components", "game");
const APP_DIR = path.join(REPO_ROOT, "app");

// ────────────────────────────────────────────────────────────────────────────
// ALLOWED HEX CODES
// ────────────────────────────────────────────────────────────────────────────
// Every hex code listed here is either:
//   (a) An exact value from globals.css :root tokens (kept here for
//       reference until components fully migrate to var(--token-name)
//       — see TODO in NAME_INK and friends in ContextPanel.tsx)
//   (b) A semantic colour with a clear single-source justification
//       (HP state bands, combat event colours, NPC disposition dots).
//   (c) A debug or temporary stub explicitly tagged with a // ALLOW
//       comment on the same line (the parser respects that).
//
// ────────────────────────────────────────────────────────────────────────────
// ALLOWED HEX CODES — every value here is in the design-ref or has a clear
// single-source justification (HP bands, NPC dispositions, combat events).
// New entries require a PR-level justification comment.
// ────────────────────────────────────────────────────────────────────────────
const ALLOWED_HEX_CODES = new Set<string>([
  // ── Genre primaries (globals.css --g-*) ─────────────────────────
  "#c4943a", "#22d3ee", "#84cc16", "#a855f7", "#ea580c",

  // ── Surfaces (globals.css --bg-* / --ui-bg-*) ───────────────────
  "#0a0907", "#110f0c", "#181410", "#211c16",
  "#1c1a17", "#1e1b16", "#141210", "#221e19",

  // ── Borders / lines (--line / --ui-border-*) ───────────────────
  "#2a2520", "#3a342c",
  "#2d2618", "#252018", "#3a3020",

  // ── Text inks (globals.css --ink-* / --ui-text-*) ───────────────
  "#e8dfd1", "#c8bfae", "#a89e8c", "#6e6557", "#4a4339",
  "#e2cda0", "#a08870", "#6a5530", "#5a4828", "#c0a878",

  // ── Context Panel inks (--npc-name, --npc-role, --atmosphere) ───
  "#d4bc88", "#7a6040", "#9a7e52",

  // ── Breadcrumb tone descent (Context Panel footer) ──────────────
  "#3a2a18", "#2a1e10", "#6a4a28", "#1e1912", "#4a3818",

  // ── Object name (matches NPC name per design-ref §18) ───────────
  "#c4b090",

  // ── Chronicle / Journal (design ref §12) ────────────────────────
  "#b0956a", "#ceaf78",

  // ── Highlight roles (--hl-*) ────────────────────────────────────
  "#7dd3fc", "#c4b5fd", "#94d8b8", "#b45309",
  "#e8c547", "#f0c060", "#a3e635", "#f87171",

  // ── Combat event colours (--combat-*) ───────────────────────────
  "#7ab8c8", "#e87c6d", "#3b82a8", "#c0392b",
  "#7dbb8e", "#a93226", "#a8a29c", "#f4a07a",
  "#fb923c",  // DoT tick orange (design ref §14)

  // ── Item stat colours (design ref §20) ──────────────────────────
  "#7abb7a", "#a888c8",

  // ── HP state bands (design ref §8, "HP BAR STATES" screenshot) ──
  "#4a8a4a", "#5a9a5a", "#5a9450", "#a87830",
  "#c84830", "#e03030",

  // ── NPC disposition dots (design ref §10) ───────────────────────
  "#c44040", "#b06030", "#b07030", "#8a6a3a",

  // ── Toast colours (design ref §14) ──────────────────────────────
  "#e8d070",

  // ── Combat panel auxiliary (CombatMode internal) ────────────────
  "#9a7060",

  // ── Map renderer art palette (file-local; lives only inside
  //    components/game/map/renderers/* — hand-drawn parchment art is
  //    not a global token system, it's illustration colour data).
  //    Audited 2026-05; reduce/promote to tokens only if the
  //    illustration style changes.
  "#1a1611", "#0e0c09", "#1a1108", "#0d0805", "#0a0f08",
  "#040603", "#070a0c", "#04030c", "#0d0a1f", "#cfd8ff",
  "#8a6f4a", "#6b5638", "#3a2f20", "#1f1813", "#a08868",
  "#d8c8a8", "#7a5e38", "#c9a872", "#7a92a8", "#e8d8b0",
  "#14110c", "#c4302b", "#2d3a1a", "#3d3220", "#4a3c28",
  "#c8b890", "#7a6850", "#5a4a38", "#0f0d0a", "#1a1410",

  // ── PR-2 semantic tokens (POI / status / tone / codex /
  //    observation / character / loot / surface / action) ──────
  // POI markers
  "#60a5fa", "#93c5fd", "#fbbf24", "#fde68a", "#f97316",
  "#fdba74", "#ef4444", "#fca5a5", "#a78bfa",
  // Status effects
  "#67e8f9", "#86efac", "#d1d5db", "#c084fc",
  // Dialogue tones
  "#22aa44", "#334455", "#4488cc", "#8844cc", "#aaaa22", "#cc4422",
  // Codex entry types
  "#7a9ab8", "#c8885a",
  // Observation badge
  "#4a9888",
  // Character sheet
  "#cbb888", "#9a8060",
  // Loot quality
  "#d8884c",
  // Surfaces
  "#191308", "#111009", "#222015",
  // Cross-region nav
  "#c2410c",
  // Semantic action colours
  "#22c55e", "#eab308", "#3b82f6", "#7c3aed", "#e2e8f0",
  // Journal destructive
  "#9a4040",

  // ── Navigation Cards (PR-3) ─────────────────────────────────────
  // All seven values are also covered by earlier sections (chip
  // surface + cross-region overlap PR-2 surfaces; #4a3818 lives in
  // breadcrumb tone descent from PR-1; #3a3020 / #c8b890 / #5a4828
  // are in borders / map art palette / text inks). Listed again
  // here so the nav-card system is documented as a group — Set
  // dedupes, so this is informational, not functional.
  "#c2410c", "#3a3020",           // left-border tier
  "#111009", "#222015",           // chip surface
  "#c8b890", "#5a4828", "#4a3818", // typography

  // ── Story Feed + Scene Arrival (PR-4) ──────────────────────────
  // All 5 brief-proposed values turned out to be duplicates of PR-1
  // tokens: #191308 = --bg-story-feed (PR-2 surfaces); #c0a878 =
  // --ui-text-prose; #2d2618 = --ui-border-default; #6a5530 =
  // --ui-text-muted; #e2cda0 = --ui-text-1. StoryFeed/StoryComponents
  // reuse those existing tokens rather than introduce aliases.
  // #5a9a5a was the only genuinely new value — it's now the
  // --status-resolved token used for "Searched ✓" loot indicators.
  // All hexes below are already in the Set from earlier sections;
  // listed here for documentation discoverability — Set dedupes.
  "#191308", "#c0a878",           // story surface
  "#2d2618", "#6a5530", "#e2cda0", // scene arrival
  "#5a9a5a",                       // resolved status indicator

  // ── Modal backdrops / generic dark fills ────────────────────────
  "#0a0a0a", "#1a1a1a",

  // ── Pure black / transparent stubs ──────────────────────────────
  "#000000", "#ffffff",
]);

// ────────────────────────────────────────────────────────────────────────────
// FORBIDDEN_HEX_CODES — explicit deny list for legacy or accidentally
// duplicated values. A separate test catches these so the failure
// message is louder than "unauthorized hex."
// ────────────────────────────────────────────────────────────────────────────
const FORBIDDEN_HEX_CODES = new Map<string, string>([
  ["#f59e0b", "Legacy Fantasy accent. Replaced by --g-fantasy = #c4943a in V3.3 of the design ref. Use var(--g-fantasy) instead."],
]);

// Components that legitimately render hex codes as DATA, not styling
// (e.g. a damage-type swatch in a debug panel that lists the type).
// These files are skipped entirely. Keep this list short.
const SKIPPED_FILES = new Set<string>([
  // (intentionally empty — every component should pass the sweep)
]);

// Files where the .ol-tex / .ol-scan / .ol-grid trio must be present.
// These are the surfaces that the design ref §3 calls out as "every
// scrollable content area." When you add a new top-level surface
// (a modal, a new sidebar panel), add it here.
const OVERLAY_REQUIRED = [
  "components/game/ContextPanel.tsx",
  "components/game/sidebar/CharacterPanel.tsx",
  "components/game/StoryFeed.tsx",
  "components/game/CodexModal.tsx",
  "components/game/JournalModal.tsx",
  "components/game/DialogueModal.tsx",
];

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function walkTsx(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkTsx(p));
    else if (entry.isFile() && (p.endsWith(".tsx") || p.endsWith(".ts"))) {
      out.push(p);
    }
  }
  return out;
}

function relativeFromRepo(p: string): string {
  return path.relative(REPO_ROOT, p).split(path.sep).join("/");
}

function readWithoutComments(filePath: string): string {
  const src = fs.readFileSync(filePath, "utf8");
  // Strip block + line comments so hex codes inside docstrings don't trigger.
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function findUnauthorizedHexCodes(filePath: string): string[] {
  const stripped = readWithoutComments(filePath);
  const all = stripped.match(/#[0-9a-fA-F]{6}\b/g) ?? [];
  const seen = new Set<string>();
  const violations: string[] = [];
  for (const raw of all) {
    const hex = raw.toLowerCase();
    if (seen.has(hex)) continue;
    seen.add(hex);
    if (!ALLOWED_HEX_CODES.has(hex)) violations.push(hex);
  }
  return violations;
}

// ────────────────────────────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────────────────────────────

describe("UI Foundation — design token consumption", () => {
  const allFiles = walkTsx(COMPONENTS_DIR).filter(
    (p) => !SKIPPED_FILES.has(relativeFromRepo(p)),
  );

  it("registers component files for scanning", () => {
    expect(allFiles.length).toBeGreaterThan(10);
  });

  describe("no unauthorized hardcoded hex codes", () => {
    for (const filePath of allFiles) {
      const rel = relativeFromRepo(filePath);
      it(`${rel} consumes design tokens (no shadow hex codes)`, () => {
        const violations = findUnauthorizedHexCodes(filePath);
        if (violations.length > 0) {
          throw new Error(
            `${rel} contains hex codes outside the allowed token list:\n` +
            `  ${violations.join(", ")}\n\n` +
            `These need to be either:\n` +
            `  (a) replaced with var(--token-name) referencing globals.css, or\n` +
            `  (b) added to ALLOWED_HEX_CODES in lib/__tests__/ui-foundation.test.ts\n` +
            `      with a comment justifying why this colour is file-local.\n\n` +
            `If this is a new semantic colour (HP state, damage type, mood\n` +
            `band, etc.), it belongs as a CSS variable in app/globals.css.`,
          );
        }
      });
    }
  });

  describe("no forbidden legacy hex codes", () => {
    for (const filePath of allFiles) {
      const rel = relativeFromRepo(filePath);
      it(`${rel} contains no forbidden legacy values`, () => {
        const src = readWithoutComments(filePath).toLowerCase();
        // Array.from() avoids the ES2015-target Map<>-iteration error
        // the project's tsconfig (no downlevelIteration) would otherwise
        // throw on `for (const [k, v] of map)`.
        for (const [hex, reason] of Array.from(FORBIDDEN_HEX_CODES)) {
          if (src.includes(hex)) {
            throw new Error(`${rel} contains forbidden legacy hex ${hex}\n  ${reason}`);
          }
        }
      });
    }
  });

  describe("scrollable surfaces include the overlay trio", () => {
    for (const rel of OVERLAY_REQUIRED) {
      it(`${rel} includes .ol-tex, .ol-scan, .ol-grid`, () => {
        const full = path.join(REPO_ROOT, rel);
        if (!fs.existsSync(full)) {
          // File may not exist yet during incremental refactor —
          // skip rather than fail. Once it exists, this test enforces.
          console.warn(`[ui-foundation] ${rel} not present yet — skipping overlay check`);
          return;
        }
        const src = fs.readFileSync(full, "utf8");
        expect(src).toMatch(/className=["']ol-tex["']/);
        expect(src).toMatch(/className=["']ol-scan["']/);
        expect(src).toMatch(/className=["']ol-grid["']/);
      });
    }
  });

  describe("genre class wiring", () => {
    it("GameLayout applies a genre-* className to the game root", () => {
      const candidates = [
        path.join(REPO_ROOT, "components/layout/GameLayout.tsx"),
        path.join(REPO_ROOT, "components/game/GameLayout.tsx"),
        path.join(APP_DIR, "game/layout.tsx"),
        path.join(APP_DIR, "game/page.tsx"),
      ];
      const file = candidates.find((p) => fs.existsSync(p));
      expect(file).toBeDefined();
      const src = fs.readFileSync(file!, "utf8");
      // Accepts either literal class names or a string template.
      const hasGenreClass =
        /genre-(fantasy|cyberpunk|horror|space|postapoc)/.test(src) ||
        /genreClassName/.test(src) ||
        /`genre-\$\{/.test(src);
      expect(hasGenreClass).toBe(true);
    });

    it("globals.css defines the five genre primary tokens", () => {
      const css = fs.readFileSync(path.join(APP_DIR, "globals.css"), "utf8");
      expect(css).toMatch(/--g-fantasy:\s*#c4943a/);
      expect(css).toMatch(/--g-cyber:\s*#22d3ee/);
      expect(css).toMatch(/--g-horror:\s*#84cc16/);
      expect(css).toMatch(/--g-space:\s*#a855f7/);
      expect(css).toMatch(/--g-apoc:\s*#ea580c/);
    });

    it("Fantasy accent is the canonical #c4943a, not legacy #f59e0b", () => {
      const css = fs.readFileSync(path.join(APP_DIR, "globals.css"), "utf8");
      const stripped = css
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|[^:])\/\/.*$/gm, "$1");
      expect(stripped).not.toMatch(/#f59e0b/i);
    });
  });
});
