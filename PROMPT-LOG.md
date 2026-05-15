# Endless Worlds RPG — Build Status
# Updated after every prompt. Claude.ai owns this file.
# CLAUDE.md is only rewritten when rules or architecture decisions change.

**CLAUDE.md version:** 8.84
**Last code commit:** c7d0370 (UI-1 — design token + genre system)
**jest baseline:** 648 (authoritative)
**tsc:** clean

## Gameplay Implementation Arc

| # | Prompt | Commit | Status |
|---|--------|--------|--------|
| P1 | Status Effects + Death Penalty + Gold Calibration | d577359 | ✅ 580 tests |
| P2 | Generation Prompts (WCD + WorldBible + RegionBible) | 354a013 | ✅ 580 tests |
| HF1 | Combat UX + Dungeon Nav + Quest Pipeline | 16e990d | ✅ 593 tests |
| P3 | Merchant Trading + Inn Rest | 0219bec | ✅ 626 tests |
| P4 | Quest Completion Gate Enforcement | d5ceeb1 | ✅ 648 tests |
| P5 | Combat UX: Status Effect Display | 7439cb8 | ✅ 605 tests |
| P6 | Ability System — Foundation | — | ⏳ IN PROGRESS |
| P7 | Ability System — Combat + Attunement UI | — | ⏳ (after P6) |
| P8 | Perks System | — | ⏳ |
| P9 | Professions Foundation | — | ⏳ Day 25 |
| P10 | Professions Crafting + XP + Milestones | — | ⏳ Day 25 |
| P11 | Professions Character Sheet UI | — | ⏳ Day 25 |

## UI Implementation Arc

| # | Prompt | Commit | Status |
|---|--------|--------|--------|
| UI-1 | Design Token + Genre System | c7d0370 | ✅ 648 tests (CSS only) |
| UI-2 | Top Bar | — | ⏳ NEXT (safe to run now — no P6 overlap) |
| UI-3 | Context Panel | — | ⏳ (after UI-2) |
| UI-4 | Story Panel Typography + Streaming | — | ⏳ |
| UI-5 | Navigation Cards | — | ⏳ |
| UI-6 | NPC Dialogue | — | ⏳ |
| UI-7 | Codex + Journal/Quests | — | ⏳ |
| UI-8 | Loot Flow | — | ⏳ (after UI-3) |
| UI-9 | Character Panel | — | ⏳ (coordinate with P8) |
| UI-10 | Combat UI Overhaul | — | ⏳ (after P7) |
| UI-11 | Transitions + Toast System | — | ⏳ |
| UI-12 | Character Creation Wizard | — | ⏳ |
| UI-13 | Main Menu + Save Slots | — | ⏳ |

## Key Implementation Notes

**UI-1 findings (inform all future UI prompts):**
- genreClassName() helper added to lib/game/genre-slug.ts — returns long-form class (genre-fantasy,
  genre-cyberpunk etc.) from Genre enum. Use this in all future components.
- GameLayout.tsx applies both data-genre (existing, owns --accent) AND genre-X class (new, owns
  --card-bg/--content-bg/overlay/typography vars). Both must coexist going forward.
- .ol-scan/.ol-grid/.ol-tex are inert until a surface opts in — add the divs in each surface prompt.
- No .ui-label selectors exist yet — CHANGE 5 typography rules are forward-looking.

## Manual Verification Pending

**P4 — required before P6:**
- Take a quest with an item objective → walk to quest-giver WITHOUT item → confirm NPC deflects.
- Pick up the item → return → confirm ✦ Quest complete banner + item consumed + quest in COMPLETED.
- Confirm narrator never proclaims completion (only the ✦ system message does).

**P5 — required before P6:**
- Enter combat with a status-capable enemy → confirm status pill below HP bar, DoT tick in feed,
  floating DoT number appears.

**UI-1 — no blocking tests. Visual only:**
- Load game in Fantasy genre → accent should be warmer amber (#c4943a not the old yellow #f59e0b).
  Can verify anytime, not blocking.
