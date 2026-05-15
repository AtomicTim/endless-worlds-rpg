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
| P7 | Ability System — Combat + Attunement UI | 334c6b5 | 699 | ✅ |
| P8 | Perks System | — | — | ⏳ NEXT (after P7 manual verify) |
| P9 | Professions Foundation | — | — | ⏳ Day 25 |
| P10 | Professions Crafting + XP + Milestones | — | — | ⏳ Day 25 |
| P11 | Professions Character Sheet UI | — | — | ⏳ Day 25 |

## UI Implementation Arc

| # | Prompt | Commit | Tests | Status |
|---|--------|--------|-------|--------|
| UI-1 | Design Token + Genre System | c7d0370 | 648 | ✅ |
| UI-2 | Top Bar | 463a593 | 678 | ✅ |
| UI-3 | Context Panel | 689d511 | 699 | ✅ |
| UI-4 | Story Panel Typography + Streaming | — | — | ⏳ NEXT |
| UI-5 | Navigation Cards | — | — | ⏳ |
| UI-6 | NPC Dialogue | — | — | ⏳ |
| UI-7 | Codex + Journal/Quests | — | — | ⏳ |
| UI-8 | Loot Flow | — | — | ⏳ (after UI-3 ✅) |
| UI-9 | Character Panel | — | — | ⏳ (coordinate with P8) |
| UI-10 | Combat UI Overhaul | — | — | ⏳ (after P7 verify) |
| UI-11 | Transitions + Toast System | — | — | ⏳ |
| UI-12 | Character Creation Wizard | — | — | ⏳ |
| UI-13 | Main Menu + Save Slots | — | — | ⏳ |

## Known Gaps (non-blocking, tracked)

- **Enemy-side status ticks not running (P7).** target_status writes land on enemy.status_effects[]
  but engine only ticks player side. Follow-up HF before UI-10.
- **Variant pools v2 deferred (P7).** 1 candidate per slot per class. Genre Session scope.
- **Object discovery per-flag missing (UI-3).** Objects shown when node.discovered === true as
  fallback. Flagged in ContextPanel.tsx for future per-object tracking.

## Key Implementation Notes

**UI-1:** genreClassName() in lib/game/genre-slug.ts. data-genre + genre-X class both on root.
  .ol-scan/.ol-grid/.ol-tex inert until surface opts in. --genre-accent-rgb added in UI-3.
**UI-2:** Save & Exit preserved. Hamburger wired in UI-3.
**UI-3:** ContextPanel uses submitAction("talk to <name>") for NPCs, submitAction("<verb> the <name>")
  for objects. Loot taps stubbed — UI-8 wires. findLocationDefinition() walks bibles directly.
**P6:** ABILITY_LIBRARY 125 entries. PlayerState fields required with safe defaults.
**P7:** AbilityTemplate.effects added. LevelUpModal 2-step at L5/10/15. Enemy status tick gap above.

## Manual Verification Pending

**P4:** Quest item gate — deflect without item, complete + consume with item, narrator silent.
**P5:** Status pill, DoT in feed, floating DoT number.
**P7 — required before P8:**
- Enter combat → Abilities → 4-slot panel, slot 1 named + charges, slots 2/3/4 locked, Back works.
- Use damage ability → enemy HP drops, charge decrements.
- Use heal/buff ability → player HP/status updates, charge decrements.
- Exhaust ability → no-charges flash, turn does NOT advance.
- Inn Rest → AttunementModal opens automatically.
- Settlement hub (not in combat) → Attune button visible, tap opens modal.
