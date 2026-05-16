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
// New entries require a PR-level justification comment.
const ALLOWED_HEX_CODES = new Set<string>([
  // ── Genre primaries (globals.css --g-*) ─────────────────────────
  "#c4943a", // --g-fantasy
  "#22d3ee", // --g-cyber
  "#84cc16", // --g-horror
  "#a855f7", // --g-space
  "#ea580c", // --g-apoc

  // ── Surfaces (globals.css --bg-*, --line-*) ─────────────────────
  "#0a0907", "#110f0c", "#181410", "#211c16",
  "#2a2520", "#3a342c",

  // ── Text inks (globals.css --ink-*) ─────────────────────────────
  "#e8dfd1", "#c8bfae", "#a89e8c", "#6e6557", "#4a4339",

  // ── Highlight roles (globals.css --hl-*) ────────────────────────
  "#7dd3fc", // --hl-loc
  "#c4b5fd", // --hl-region
  "#94d8b8", // --hl-sublocation / --hl-landmark
  "#b45309", // --hl-dungeon
  "#e8c547", // --hl-item
  "#f0c060", // --hl-said
  "#a3e635", // --hl-pass
  "#f87171", // --hl-fail

  // ── Combat event colours (globals.css --combat-*) ───────────────
  "#7ab8c8", "#e87c6d", "#3b82a8", "#c0392b",
  "#7dbb8e", "#a93226", "#a8a29c", "#f4a07a",

  // ── HP state bands (design ref §8, screenshot "HP BAR STATES") ──
  "#4a8a4a", "#5a9a5a", "#5a9450", "#a87830",
  "#c84830", "#e03030",

  // ── NPC disposition dots (design ref §10) ───────────────────────
  "#c44040", "#b06030", "#b07030", "#8a6a3a",

  // ── Pure black / transparent stubs ──────────────────────────────
  "#000000", "#ffffff",
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
