# Endless Worlds RPG — Build Status
# Updated after every prompt. Claude.ai owns this file.
# CLAUDE.md is only rewritten when rules or architecture decisions change.

**CLAUDE.md version:** 8.84
**Last code commit:** 6990d25 (BG-1 PROMPT-LOG update — final state on origin/main)
**jest baseline:** 854 (authoritative — zero delta BG-1; ui-foundation 120/120)
**tsc:** clean

---

## Visual Fidelity Track — THE ACTIVE TRACK

Goal: make every surface match the mockup screenshots in design/mockups/.
Authority: docs/ui-implementation-handoff.md §4 table (in order) + mockup PNGs + design ref v3.3.
Previous UI arc work (UI-1 through UI-13, fix groups A–L) is not assumed to be correct.
Every surface is verified against its mockup before moving to the next PR.

| PR | Handoff §4 row | Surface | Mockup | Commit | Tests | Visual ✓ | Status |
|----|----------------|---------|--------|--------|-------|----------|--------|
| BG-1 | pre-track | Global background temperature | nav cards.png (eyedropper) | dd6cbe5 | 854 | ✅ | ✅ |
| BG-2 | pre-track | Nav card text contrast | nav cards.png (eyedropper needed) | — | — | — | ⏳ next |
| PR-3v | Row 3 | NavigationBar.tsx | nav cards.png | f266ebb | 854 | ✅ | ✅ |
| PR-4v | Row 4 | StoryFeed.tsx | design ref §5 + combat panel mobile | — | — | — | ⏳ |
| PR-5v | Row 5 | CharacterPanel.tsx | character panel fantasy.png, inventory and character panel.png, inventory.png | — | — | — | ⏳ |
| PR-6v | Row 6 | CharacterSheet.tsx (if not orphaned) | same as PR-5v | — | — | — | ⏳ |
| PR-7v | Row 7 | DialogueModal.tsx | npc dialogue mobile.png | — | — | — | ⏳ |
| PR-8v | Row 8 | CodexContent.tsx + CodexModal.tsx | codex mobile.png | — | — | — | ⏳ |
| PR-9v | Row 9 | JournalModal.tsx | quest and journal mobile.png, quests cyberpunk.png, quests space.png | — | — | — | ⏳ |
| PR-10v | Row 10 | LevelUpModal.tsx | ability panel expanded mobile.png | — | — | — | ⏳ |
| PR-11v | Row 11 | CombatMode/* | combat desktop.png, combat panel mobile.png, turn resolution timing.png, health bar and damage numbers.png | — | — | — | ⏳ |
| PR-12v | Row 12 | loot/* + FloorLootStrip.tsx | loot panel.png | — | — | — | ⏳ |
| PR-13v | Row 13 | TradeModal.tsx | design ref only | — | — | — | ⏳ |
| PR-14v | Row 14 | AttunementModal.tsx | design ref only | — | — | — | ⏳ |
| PR-15v | Row 15 | InputBar.tsx + VerbosityToggle.tsx | design ref §17 | — | — | — | ⏳ |
| PR-16v | Row 16 | Save slots + Main Menu | save slots.png, genre select mobile.png | — | — | — | ⏳ |
| PR-17v | Row 17 | map/renderers/* | world map.png, region map.png, settlement map.png, dungeon map.png | — | — | — | ⏳ |

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
- Tim resolves any merge conflict by taking origin (Claude.ai's version).
- Visual verification is non-negotiable before each PR is marked ✅.
- Previous UI arc work (UI-1–UI-13, fix groups A–L) is not treated as correct baseline.

## Known Gaps

- **Narrator streaming buffered (UI-4b).** Structural refactor needed.
- **Perk gold/xp consumers not wired (P8).** Small follow-up.
- **Enemy-side status ticks not running (P7).** Follow-up HF.
- **Bug 2 — zone_id cache leak.** Defensive fix shipped. Root cause pending.
- **FloorLootStrip still rendered.** Retire in PR-12v.
- **CharacterSheet.tsx + InventoryPanel.tsx.** Verify orphaned before PR-6v; delete if so.
- **CharacterPanel equipped tiles too wide.** 3 × 80px tiles overflow 196px sidebar. Fix in PR-5v.
- **OneDrive sync race (recurring).** Staged-as-you-go pattern for CombatMode files.
