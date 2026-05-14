# Endless Worlds RPG — Build Status
# Updated after every prompt. Claude.ai owns this file.
# CLAUDE.md is only rewritten when rules or architecture decisions change.

**CLAUDE.md version:** 8.81
**Last code commit:** 7439cb8 (P5 — combat UX status display)
**jest baseline:** 605 (authoritative)
**tsc:** clean

## Implementation Arc

| # | Prompt | Commit | Status |
|---|--------|--------|--------|
| P1 | Status Effects + Death Penalty + Gold Calibration | d577359 | ✅ 580 tests |
| P2 | Generation Prompts (WCD + WorldBible + RegionBible) | 354a013 | ✅ 580 tests |
| HF1 | Combat UX + Dungeon Nav + Quest Pipeline | 16e990d | ✅ 593 tests |
| P3 | Merchant Trading + Inn Rest | — | ⏳ NEXT |
| P4 | Quest Completion Gate Enforcement | — | ⏳ |
| P5 | Combat UX: Status Effect Display | 7439cb8 | ✅ 605 tests |
| P6 | Ability System — Foundation | — | ⏳ |
| P7 | Ability System — Combat + Attunement UI | — | ⏳ |
| P8 | Perks System | — | ⏳ |
| P9 | Professions Foundation | — | ⏳ Day 25 |
| P10 | Professions Crafting + XP + Milestones | — | ⏳ Day 25 |
| P11 | Professions Character Sheet UI | — | ⏳ Day 25 |

## Manual Verification Pending

**HF1 + P1 — required before P3:**
- Die in combat → confirm 75% HP respawn (NOT 50%).
- Die holding 200g → confirm lose 20g (10%, under 50g cap).
- Die holding 1000g → confirm lose 50g (capped).
- Enter combat → confirm encounter banner appears in feed.
- Get a crit landed on you → confirm NO LLM paragraph, just the templated line.
- Exit any dungeon → confirm landing in region zone, not settlement.
- Talk to a quest NPC twice → confirm main quest banner appears only once.

**P2 — nice to have, not blocking:**
- Generate a new world → inspect WorldBible output for typed enemies with status_effect field
- Confirm starting settlement shop/library has 3 lore objects (profession manuals)

**P5 — required before P6:**
- Enter combat with a status-capable enemy → confirm status pill appears below HP bar, DoT tick shows in feed with correct template text, DoT floating number appears.
