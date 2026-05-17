# Endless Worlds RPG — Build Status
# Updated after every prompt. Claude.ai owns this file.
# CLAUDE.md is only rewritten when rules or architecture decisions change.

**CLAUDE.md version:** 8.84
**Last code commit:** f266ebb (UI-PR3v: NavigationBar visual — horizontal layout, mixed-case names, TYPE · DIRECTION sublabels)
**jest baseline:** 854 (authoritative — zero delta PR-3v, ui-foundation 120/120; nav-cards 32/32 with updated expectations)
**tsc:** clean

## Gameplay Implementation Arc

| # | Prompt | Commit | Tests | Status |
|---|--------|--------|-------|--------|
| P1–P8 | (see history) | — | — | ✅ |
| HF2 | Dungeon Enemy Spawn Fix | 13468a0 | 734 | ✅ (verify in test session) |
| P9–P11 | Professions | — | — | ⏳ Day 25 |

## UI Implementation Arc — COMPLETE ✅

| # | Prompt | Commit | Tests | Status |
|---|--------|--------|-------|--------|
| UI-1 | Design Token + Genre System | c7d0370 | 648 | ✅ |
| UI-2 | Top Bar | 463a593 | 678 | ✅ |
| UI-3 | Context Panel | 689d511 | 699 | ✅ |
| UI-4 | Story Panel Typography + Streaming | 995f063 | 719 | ✅ |
| UI-5 | Navigation Cards | 21e0f25 | 719 | ✅ |
| UI-6 | NPC Dialogue | 9db1e58 | 734 | ✅ |
| UI-7 | Codex + Journal/Quests | aa98896 | 734 | ✅ |
| UI-8 | Loot Flow | 8749056 | 734 | ✅ |
| UI-9 | Character Panel | f811645 | 734 | ✅ |
| UI-9b | Nav Card Layout Cleanup | 51587a8 | 734 | ✅ |
| UI-10 | Combat UI Overhaul | a11d82b | 734 | ✅ |
| UI-11 | Transitions + Toast System | d4a99e5 | 734 | ✅ |
| UI-12 | Character Creation Wizard | beeb2ef | 734 | ✅ |
| UI-13 | Main Menu + Save Slots | 913578f | 734 | ✅ |

## UI Fix Brief — Targeted Surface Passes

| Group | Prompt | Commit | Tests | Status |
|-------|--------|--------|-------|--------|
| A | Foundation — fonts, genre vars, bg colours, overlay divs | 3993bc9 | 734 | ✅ |
| B | Character wizard — cards, stat colours, fonts, name bug, motivation | e33e5e8 | 734 | ✅ |
| C | Nav cards — compact chip style, typography, no-mono arrows | 8bbab32 | 734 | ✅ |
| D | Arrival format confirmed, Attune button → Context Panel (also Group L item 3) | 2dbc973 | 734 | ✅ |
| E | Context Panel — object name colour, Tabler icons | f496807 | 734 | ✅ |
| F | Character Panel — pack grid font, equipped name colour, sidebar 196/160px | 16b5c78 | 734 | ✅ |
| G | Dialogue Modal — avatar circle, initials sans, badge size | 901eccd | 734 | ✅ |
| H | Top Bar — Section 17 conformance | 986f874 | 734 | ✅ |
| I | Chronicle — quest objectives sentence case, inactive tab contrast | 3c598c0 | 734 | ✅ |
| J | World Intro Cinematic — prose 15px, warm colour, hint contrast | f3de117 | 734 | ✅ |
| K | Fantasy settlement map — Canvas bird's-eye, building footprints, curved roads (Local tier only; World/Region/Dungeon + non-Fantasy stay SVG) | 16b5298 | 734 | ✅ |
| L | Misc bugs verification — L1 closed by B, L2 closed by B, L3 closed by D | (no new commit) | 734 | ✅ |

## Context Panel polish pass (post-brief)

| # | Change | Commit | Tests | Status |
|---|--------|--------|-------|--------|
| 1–6 | Larger name, plain badge, Present/Interact labels, NPC Talk→, object verb-label, region breadcrumb | 8f88f56 | 734 | ✅ |

## Post-Foundation Visual Refactor — Token Discipline Pass

Separate from the UI arc above. Goal: enforce the §5 workflow across all game surfaces — zero hardcoded hex strings in components/game/, all values via var(--token). ui-foundation suite enforces this in CI.

Pattern: proposed new tokens frequently turn out to be covered by PR-1/PR-2 names. Claude Code makes the hybrid call each time — reusing existing tokens rather than introducing aliases. rgba() literals are not flagged by the harness; any that are not genre-bound are acceptable to leave as-is.

| PR | Surface | Commit | Tests | New tokens | Status |
|----|---------|--------|-------|------------|--------|
| PR-1 | globals.css canonical tokens + legacy #f59e0b purge | 0be34aa | 854 | ~canonical set | ✅ |
| PR-2 | 42 semantic tokens (POI, status effects, dialogue tones, codex, loot rarity, nav, surfaces) | 6101441 | 854 | 42 | ✅ |
| PR-3 | NavigationBar.tsx — zero hex strings remain | f31dec3 | 854 | 4 (--nav-border-unknown/name/sublabel/breadcrumb) | ✅ |
| PR-4 | StoryFeed.tsx + StoryComponents.tsx — zero hex strings remain | dbfd1af | 854 | 1 (--status-resolved) | ✅ |
| PR-5 | CharacterPanel.tsx — zero hex strings remain; genre-accent rgba bug fixed; hpThresholdColor() → var() | 10a772f | 854 | 5 (--hp-healthy/good/hurt/danger/critical) | ✅ |
| PR-3v | NavigationBar visual — horizontal flex row (known cards) + full-width undiscovered stack; mixed-case italic-serif names; `TYPE · DIRECTION` sublabels per design ref §6 / nav cards.png mockup. Closes PR-3b nav-layout gap. | f266ebb | 854 | 0 (helper added: `directionLabel(kind)`) | ✅ |
| PR-6 | Next surface (CharacterSheet.tsx audit) | — | — | — | ⏳ |

## Workflow note (post PR-4 merge conflict)

Claude.ai waits for Tim to report the full final commit hash before writing to PROMPT-LOG.md, so Claude.ai's write lands on top of Claude Code's. Tim resolves any conflict by taking origin (Claude.ai's version).

## Known Gaps (post-arc)

- **Narrator streaming buffered (UI-4b).** Structural refactor prompt needed.
- **Perk gold/xp consumers not wired (P8).** Small follow-up.
- **Enemy-side status ticks not running (P7).** Follow-up HF.
- **Bug 2 — zone_id cache leak.** Defensive fix shipped. Root cause pending.
- **Combat panel exit animation deferred (UI-10).** Polish patch.
- **FloorLootStrip still rendered (UI-8).** Retire in cleanup pass.
- **Codex/Journal tab restructure deferred (UI-7).** Data shape change required.
- ~~**Sidebar width 280px (UI-9).** LogBook co-tenant blocks narrowing.~~ → resolved in UI-fix-F (16b5c78).
- **CharacterSheet.tsx + InventoryPanel.tsx orphaned.** Delete in cleanup pass (or verify orphaned before PR-6).
- **OneDrive sync race (recurring).** Staged-as-you-go pattern for CombatMode files.
- ~~**PR-3b — Nav card layout.** Cards render as unbounded single column.~~ → resolved in PR-3v (f266ebb); horizontal flex row for known cards + full-width undiscovered stack matches design ref §6 mockup.
- **CharacterPanel rgba() literals not flagged by harness.** Two intentional: rgba(74,138,74,X) STAT_XP picker (not genre-bound) · rgba(196,72,48,.35) drop border (danger red, not accent-bound). Acceptable as-is.

## Next Steps

1. Comprehensive test session (see Claude.ai for full checklist)
2. Fix anything broken
3. Cleanup pass (orphaned files, FloorLootStrip, sidebar)
4. UI-4b narrator streaming refactor
5. Enemy-side status tick HF
6. Day 24 design + implementation
7. Day 25 — P9–P11 professions + customization
8. Genre Session
9. In-app zoom / settings screen
