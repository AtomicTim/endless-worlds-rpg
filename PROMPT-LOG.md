# Endless Worlds RPG — Build Status
# Updated after every prompt. Claude.ai owns this file.
# CLAUDE.md is only rewritten when rules or architecture decisions change.

**CLAUDE.md version:** 8.80
**Last code commit:** 354a013 (P2 — generation prompts)
**jest baseline:** 580 (authoritative)
**tsc:** clean

## Implementation Arc

| # | Prompt | Commit | Status |
|---|--------|--------|--------|
| P1 | Status Effects + Death Penalty + Gold Calibration | d577359 | ✅ 580 tests |
| P2 | Generation Prompts (WCD + WorldBible + RegionBible) | 354a013 | ✅ 580 tests |
| P3 | Merchant Trading + Inn Rest | — | ⏳ NEXT |
| P4 | Quest Completion Gate Enforcement | — | ⏳ |
| P5 | Combat UX: Status Effect Display | — | ⏳ |
| P6 | Ability System — Foundation | — | ⏳ |
| P7 | Ability System — Combat + Attunement UI | — | ⏳ |
| P8 | Perks System | — | ⏳ |
| P9 | Professions Foundation | — | ⏳ Day 25 |
| P10 | Professions Crafting + XP + Milestones | — | ⏳ Day 25 |
| P11 | Professions Character Sheet UI | — | ⏳ Day 25 |

## Manual Verification Pending

**P1 — required before P3:**
- Die in combat → confirm HP on respawn = 75% of max (not 50%)
- Die holding 200g → confirm gold loss = 20g (10%, under cap)
- Die holding 1000g → confirm gold loss = 50g (capped)
- DoT in combat: get hit by a status-capable enemy and confirm story feed shows tick events

**P2 — nice to have, not blocking:**
- Generate a new world → inspect WorldBible output for typed enemies with status_effect field
- Confirm starting settlement shop/library has 3 lore objects (profession manuals)
