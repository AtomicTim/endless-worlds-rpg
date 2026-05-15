# Endless Worlds RPG — Build Status
# Updated after every prompt. Claude.ai owns this file.
# CLAUDE.md is only rewritten when rules or architecture decisions change.

**CLAUDE.md version:** 8.84
**Last code commit:** 689d511 (UI-3 — Context Panel)
**jest baseline:** 699 (authoritative)
**tsc:** clean

## Gameplay Implementation Arc

| # | Prompt | Commit | Tests | Status |
|---|--------|--------|-------|--------|
| P1 | Status Effects + Death Penalty + Gold | d577359 | 580 | ✅ |
| P2 | Generation Prompts (WCD + WorldBible + RegionBible) | 354a013 | 580 | ✅ |
| HF1 | Combat UX + Dungeon Nav + Quest Pipeline | 16e990d | 593 | ✅ |
| P3 | Merchant Trading + Inn Rest | 0219bec | 626 | ✅ |
| P4 | Quest Completion Gate Enforcement | d5ceeb1 | 648 | ✅ |
| P5 | Combat UX: Status Effect Display | 7439cb8 | 605 | ✅ |
| P6 | Ability System — Foundation | 87741fb | 678 | ✅ |
| P7 | Ability System — Combat + Attunement UI | 334c6b5 | 699 | ✅ verified |
| HF2 | Dungeon Enemy Spawn Fix | — | — | ⏳ QUEUE (run when slot opens) |
| P8 | Perks System | — | — | ⏳ NEXT |
| P9 | Professions Foundation | — | — | ⏳ Day 25 |
| P10 | Professions Crafting + XP + Milestones | — | — | ⏳ Day 25 |
| P11 | Professions Character Sheet UI | — | — | ⏳ Day 25 |

## UI Implementation Arc

| # | Prompt | Commit | Tests | Status |
|---|--------|--------|-------|--------|
| UI-1 | Design Token + Genre System | c7d0370 | 648 | ✅ |
| UI-2 | Top Bar | 463a593 | 678 | ✅ |
| UI-3 | Context Panel | 689d511 | 699 | ✅ |
| UI-4 | Story Panel Typography + Streaming | — | — | ⏳ IN PROGRESS |
| UI-5 | Navigation Cards | — | — | ⏳ |
| UI-6 | NPC Dialogue | — | — | ⏳ |
| UI-7 | Codex + Journal/Quests | — | — | ⏳ |
| UI-8 | Loot Flow | — | — | ⏳ |
| UI-9 | Character Panel | — | — | ⏳ (coordinate with P8) |
| UI-10 | Combat UI Overhaul | — | — | ⏳ (after HF2) |
| UI-11 | Transitions + Toast System | — | — | ⏳ |
| UI-12 | Character Creation Wizard | — | — | ⏳ |
| UI-13 | Main Menu + Save Slots | — | — | ⏳ |

## Known Gaps / Bugs

- **Dungeon enemy spawn failing (HF2).** RegionBible enemy IDs (e.g. the_seam_foothills_rockfall_sentinel)
  fail the 4-layer lookup in combat-engine — encounter silently cancelled. Dungeons must always have a
  chance to spawn. Fix: investigate ID resolution path + add generic fallback when all roster IDs fail.
- **Enemy-side status ticks not running (P7).** target_status lands on enemy.status_effects[] but
  engine only ticks player side. Follow-up after HF2.
- **Variant pools v2 deferred (P7).** 1 candidate per slot per class. Genre Session scope.
- **Object discovery per-flag missing (UI-3).** Objects shown on node.discovered === true. Flagged.

## Key Implementation Notes

**UI-1:** genreClassName() in lib/game/genre-slug.ts. data-genre + genre-X class both on root.
  --genre-accent-rgb added (UI-3). .ol-scan/.ol-grid/.ol-tex inert until surface opts in.
**UI-2:** Save & Exit preserved. Hamburger wired in UI-3.
**UI-3:** submitAction("talk to <name>") for NPCs, submitAction("<verb> the <name>") for objects.
  Loot taps stubbed (console.log) — UI-8 wires. findLocationDefinition() walks bibles directly.
**P7:** AbilityTemplate.effects added. LevelUpModal 2-step at L5/10/15. restCompleteSignal → modal.

## Manual Verification Pending

**P4:** Quest item gate — deflect without item, complete + consume with item, narrator silent.
**P5:** Status pill, DoT in feed, floating DoT number.
**P7:** ✅ Verified (abilities panel, damage, attunement modal, victory flow).
