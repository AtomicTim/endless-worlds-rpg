# Endless Worlds RPG — Build Status
# Updated after every prompt. Claude.ai owns this file exclusively.
# Claude Code does NOT update this file. One writer, no conflicts.

**CLAUDE.md version:** 8.84
**Last code commit:** 7ab070c (UI-PR5v-d: item detail card — value right-aligned in header)
**jest baseline:** 854 (authoritative — zero delta all PR-5v sub-commits; ui-foundation 120/120)
**tsc:** clean

---

## Visual Fidelity Track — THE ACTIVE TRACK

Goal: make every surface match the mockup screenshots in design/mockups/.
Authority: docs/ui-implementation-handoff.md §4 table (in order) + mockup PNGs + design ref v3.3.
Previous UI arc work (UI-1 through UI-13, fix groups A–L) is not assumed to be correct.
Every surface is verified against its mockup before moving to the next PR.

| PR | Surface | Mockup | Commit | Visual ✓ | Status |
|----|---------|--------|--------|----------|--------|
| BG-1 | Global background temperature | nav cards.png eyedropper | dd6cbe5 | ✅ | ✅ |
| BG-2 | Nav card text contrast | nav cards.png eyedropper | c391403 | ✅ | ✅ |
| PR-3v | NavigationBar.tsx | nav cards.png | f266ebb | ✅ | ✅ |
| PR-4v | StoryFeed.tsx | skipped — arrival format accepted as-is | — | ✅ | ✅ |
| PR-5v | CharacterPanel.tsx — card bg, stat blocks, equipped rows, pack tiles | character panel fantasy.png + inventory*.png | 38966c7 | ✅ | ✅ |
| PR-5v-b | CharacterPanel — 4-col pack grid, section label contrast | — | bc5e0d3 | ✅ | ✅ |
| PR-5v-c | Sidebar width 196→240px / 160→200px; item detail above pack grid | — | a2d428c | ✅ | ✅ |
| PR-5v-d | CharacterPanel — item detail card value right-aligned | — | 7ab070c | ✅ | ✅ |
| PR-6v | ContextPanel.tsx full visual rework | context panel.png | — | — | ⏳ next |
| PR-7v | DialogueModal.tsx | npc dialogue mobile.png | — | — | ⏳ |
| PR-8v | CodexContent.tsx + CodexModal.tsx | codex mobile.png | — | — | ⏳ |
| PR-9v | JournalModal.tsx | quest and journal mobile.png, quests cyberpunk.png, quests space.png | — | — | ⏳ |
| PR-10v | LevelUpModal.tsx | ability panel expanded mobile.png | — | — | ⏳ |
| PR-11v | CombatMode/* | combat desktop.png, combat panel mobile.png, turn resolution timing.png, health bar and damage numbers.png | — | — | ⏳ |
| PR-12v | loot/* + FloorLootStrip.tsx | loot panel.png | — | — | ⏳ |
| PR-13v | TradeModal.tsx | design ref only | — | — | ⏳ |
| PR-14v | AttunementModal.tsx | design ref only | — | — | ⏳ |
| PR-15v | InputBar.tsx + VerbosityToggle.tsx | design ref §17 | — | — | ⏳ |
| PR-16v | Save slots + Main Menu | save slots.png, genre select mobile.png | — | — | ⏳ |
| PR-17v | map/renderers/* | world map.png, region map.png, settlement map.png, dungeon map.png | — | — | ⏳ |

---

## Token Discipline Pass (foundation — complete)

| PR | Surface | Commit | Tokens added |
|----|---------|--------|--------------|
| PR-1 | globals.css canonical tokens + legacy purge | 0be34aa | ~canonical set |
| PR-2 | 42 semantic tokens across 16 files | 6101441 | 42 |
| PR-3 | NavigationBar.tsx token pass | f31dec3 | 4 |
| PR-4 | StoryFeed.tsx + StoryComponents.tsx token pass | dbfd1af | 1 |
| PR-5 | CharacterPanel.tsx token pass + genre-accent bug fix | 10a772f | 5 |

---

## Gameplay Implementation Arc

| # | Prompt | Commit | Tests | Status |
|---|--------|--------|-------|--------|
| P1–P8 | (see history) | — | — | ✅ |
| HF2 | Dungeon Enemy Spawn Fix | 13468a0 | 734 | ✅ |
| P9–P11 | Professions | — | — | ⏳ Day 25 |

---

## Workflow notes

- Claude.ai waits for Tim's final commit hash before writing to PROMPT-LOG.md.
- Claude Code does NOT update PROMPT-LOG.md.
- Visual verification is non-negotiable before each PR is marked ✅.
- Previous UI arc work (UI-1–UI-13, fix groups A–L) is not treated as correct baseline.

## Known Gaps

- **Narrator streaming buffered (UI-4b).** Structural refactor needed.
- **Perk gold/xp consumers not wired (P8).** Small follow-up.
- **Enemy-side status ticks not running (P7).** Follow-up HF.
- **Bug 2 — zone_id cache leak.** Defensive fix shipped. Root cause pending.
- **FloorLootStrip still rendered.** Retire in PR-12v.
- **CharacterSheet.tsx + InventoryPanel.tsx orphaned.** Delete in cleanup pass.
- **OneDrive sync race (recurring).** Staged-as-you-go pattern for CombatMode files.
- **Perks section header in CharacterPanel** still at old dim styling — one-line fix, bundle into next CharacterPanel touch.
