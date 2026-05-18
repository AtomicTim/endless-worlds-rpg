# Endless Worlds RPG — Build Status
# Updated after every prompt. Claude.ai owns this file exclusively.
# Claude Code does NOT update this file. One writer, no conflicts.

**CLAUDE.md version:** 8.84
**Last code commit:** 53629b1 (BG-3f) + PR-7v sub-commits in progress
**jest baseline:** 852 (ui-foundation: 118/118)
**tsc:** clean

---

## Visual Fidelity Track — THE ACTIVE TRACK

Goal: make every surface match the mockup screenshots in design/mockups/.
Authority: docs/ui-implementation-handoff.md §4 table (in order) + mockup PNGs + design ref v3.3.
Previous UI arc work (UI-1 through UI-13, fix groups A–L) is not assumed to be correct.
Every surface is verified against its mockup before moving to the next PR.
Every prompt includes a mobile sanity note — dedicated mobile pass planned at end of visual track.

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
| PR-5v-e | Rarity color system (5 tiers) + pack/equipped indicators | — | 36e45f6 | ✅ | ✅ |
| PR-6v | ContextPanel.tsx full visual rework | context panel.png | 6090f56 | ✅ | ✅ |
| PR-6v-b | ContextPanel — NPC/object card backgrounds + region footer contrast | — | 2ad5974 | ✅ | ✅ |
| PR-6v-c | ContextPanel — remove redundant region footer | — | 997e75b | ✅ | ✅ |
| BG-3 | Neutral panels + equipped name·RARITY·stat + thicker rarity borders | — | dd56263 | ✅ | ✅ |
| BG-3b | Rarity abbreviations + remove panel overlays | — | 5c8a9a2 | ✅ | ✅ |
| BG-3c | Equipped row rarity no-truncate + visible pipe separator | — | 8dcd7b1 | ✅ | ✅ |
| BG-3d | Equipped row name flex 4, rarity/stat flex 1 | — | 0cc5e3f | ✅ | ✅ |
| BG-3e | Equipped row stat minWidth + separator margin fix | — | a4dcf0b | — | superseded by BG-3f |
| BG-3f | Equipped row fixed-width columns (name flex:1 / rarity 38px / stat 52px) | — | 53629b1 | ✅ | ✅ |
| PR-7v | DialogueModal.tsx — conversation history + header badge + option cards | npc dialogue mobile.png | 53dd529 | ⏳ | ⏳ |
| PR-7v-b | DialogueModal — compact option cards, smaller history | — | ⏳ | — | ⏳ |
| PR-7v-c | DialogueModal — viewport fit + 700px desktop width | — | — | — | ⏳ running |
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
| MOBILE | Full mobile layout pass | all mobile mockups | — | — | ⏳ end |

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
- Visual verification required before each PR marked ✅.
- Mobile note included in every prompt going forward; dedicated mobile pass at end of visual track.
- Previous UI arc work (UI-1–UI-13, fix groups A–L) not treated as correct baseline.
- Genre overlays removed from CharacterPanel + ContextPanel; retained in StoryFeed + modals.
- Equipped row layout: fixed-width columns (rarity 38px, stat 52px) established in BG-3f — do not revert to flex proportions.

## Known Gaps

- **Narrator streaming buffered (UI-4b).** Structural refactor needed.
- **Perk gold/xp consumers not wired (P8).** Small follow-up.
- **Enemy-side status ticks not running (P7).** Follow-up HF.
- **Bug 2 — zone_id cache leak.** Defensive fix shipped. Root cause pending.
- **FloorLootStrip still rendered.** Retire in PR-12v.
- **CharacterSheet.tsx + InventoryPanel.tsx orphaned.** Delete in cleanup pass.
- **OneDrive sync race (recurring).** Staged-as-you-go for CombatMode files.
- **Perks section header in CharacterPanel** still dim — bundle into next CharacterPanel touch.
- **LootList.tsx** consumes --loot-quality-uncommon alias (now green via PR-5v-e) — verify in PR-12v.
- **Dialogue empty slots (PR-7v).** 2 empty dashed placeholders show when fewer than 4 options exist. Fix: remove fixed 4-slot grid, render only real options. Schedule in next DialogueModal touch.
- **Dialogue history content (PR-7v).** History section shows general story feed messages rather than filtering to current NPC conversation only. Needs scoped message filter by npcKey/conversationId. Schedule after PR-7v stabilises.
