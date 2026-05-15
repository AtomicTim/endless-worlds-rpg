# Endless Worlds RPG — Build Status
# Updated after every prompt. Claude.ai owns this file.
# CLAUDE.md is only rewritten when rules or architecture decisions change.

**CLAUDE.md version:** 8.84
**Last code commit:** 0db542e (PROMPT-LOG: P6 complete)
**jest baseline:** 678 (authoritative)
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
| P7 | Ability System — Combat + Attunement UI | — | — | ⏳ NEXT |
| P8 | Perks System | — | — | ⏳ |
| P9 | Professions Foundation | — | — | ⏳ Day 25 |
| P10 | Professions Crafting + XP + Milestones | — | — | ⏳ Day 25 |
| P11 | Professions Character Sheet UI | — | — | ⏳ Day 25 |

## UI Implementation Arc

| # | Prompt | Commit | Tests | Status |
|---|--------|--------|-------|--------|
| UI-1 | Design Token + Genre System | c7d0370 | 648 | ✅ |
| UI-2 | Top Bar | — | — | ⏳ IN PROGRESS |
| UI-3 | Context Panel | — | — | ⏳ (after UI-2) |
| UI-4 | Story Panel Typography + Streaming | — | — | ⏳ |
| UI-5 | Navigation Cards | — | — | ⏳ |
| UI-6 | NPC Dialogue | — | — | ⏳ |
| UI-7 | Codex + Journal/Quests | — | — | ⏳ |
| UI-8 | Loot Flow | — | — | ⏳ (after UI-3) |
| UI-9 | Character Panel | — | — | ⏳ (coordinate with P8) |
| UI-10 | Combat UI Overhaul | — | — | ⏳ (after P7) |
| UI-11 | Transitions + Toast System | — | — | ⏳ |
| UI-12 | Character Creation Wizard | — | — | ⏳ |
| UI-13 | Main Menu + Save Slots | — | — | ⏳ |

## Key Implementation Notes

**UI-1 findings (inform all future UI prompts):**
- genreClassName() in lib/game/genre-slug.ts — returns long-form class (genre-fantasy etc.).
  Use in every component that needs the genre class. Never derive inline.
- GameLayout.tsx applies both data-genre (owns --accent) AND genre-X class (owns card/content vars).
  Both must coexist. Do not remove data-genre.
- .ol-scan/.ol-grid/.ol-tex inert until surface opts in. Add three overlay divs per surface prompt.
- .ui-label selectors are forward-looking — no current matches. Components must add the class.

**P6 findings (inform P7):**
- ABILITY_LIBRARY: 125 entries keyed by AbilityId. 25 classes × 5 (4 active slots + 1 passive).
- PlayerState: learned_abilities[], equipped_ability_slots [null,null,null,null], passive_ability null.
  All required fields with safe defaults in state-factory.ts.
- restCompleteSignal in game-store.ts is the existing P7 attunement hook (rule 156).
- teaches_ability?: AbilityId on both Item and NPCDefinition — ready for acquisition paths.
- docs/ability-library.md header says "level 3/6/9" for slot unlocks — stale doc. Code uses 5/10/15.

## Manual Verification Pending

**P4:** Quest item gate — deflect without item, complete + consume with item, narrator silent.
**P5:** Status pill below HP bar, DoT in feed, floating DoT number.
**P6:** Data layer only — jest covers it. Spot-check ability library entries if desired, not blocking.
**UI-1:** Visual — Fantasy accent warmer amber (#c4943a). Not blocking.
