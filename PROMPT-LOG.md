# Endless Worlds RPG — Build Status
# Updated after every prompt. Claude.ai owns this file.
# CLAUDE.md is only rewritten when rules or architecture decisions change.

**CLAUDE.md version:** 8.84
**Last code commit:** 995f063 (PROMPT-LOG: P8 complete — also contains UI-4 files, both on main)
**jest baseline:** 719 (authoritative)
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
| P8 | Perks System | b160ff4 | 719 | ✅ |
| HF2 | Dungeon Enemy Spawn Fix | — | — | ⏳ IN PROGRESS |
| P9 | Professions Foundation | — | — | ⏳ Day 25 |
| P10 | Professions Crafting + XP + Milestones | — | — | ⏳ Day 25 |
| P11 | Professions Character Sheet UI | — | — | ⏳ Day 25 |

## UI Implementation Arc

| # | Prompt | Commit | Tests | Status |
|---|--------|--------|-------|--------|
| UI-1 | Design Token + Genre System | c7d0370 | 648 | ✅ |
| UI-2 | Top Bar | 463a593 | 678 | ✅ |
| UI-3 | Context Panel | 689d511 | 699 | ✅ |
| UI-4 | Story Panel Typography + Streaming | 995f063* | 719 | ✅ |
| UI-5 | Navigation Cards | — | — | ⏳ IN PROGRESS |
| UI-6 | NPC Dialogue | — | — | ⏳ |
| UI-7 | Codex + Journal/Quests | — | — | ⏳ |
| UI-8 | Loot Flow | — | — | ⏳ |
| UI-9 | Character Panel | — | — | ⏳ |
| UI-10 | Combat UI Overhaul | — | — | ⏳ (after HF2) |
| UI-11 | Transitions + Toast System | — | — | ⏳ |
| UI-12 | Character Creation Wizard | — | — | ⏳ |
| UI-13 | Main Menu + Save Slots | — | — | ⏳ |

*UI-4 files bundled into 995f063 commit (labeled "PROMPT-LOG: P8 complete"). Both fully on main.

## Known Gaps / Bugs

- **Narrator streaming buffered (UI-4b needed).** narrator.ts returns full response before any
  tokens reach UI. StreamCursor + tap-to-skip wired and ready. Needs dedicated structural refactor
  prompt (UI-4b) — not blocking other UI prompts.
- **Perk gold/xp consumers not wired (P8).** perk_gold_bonus_pct / perk_xp_bonus_pct stored on
  PlayerState but loot-resolver and handleVictory don't read them. Small follow-up patch.
- **Dungeon enemy spawn failing (HF2 — in progress).** RegionBible enemy IDs fail 4-layer lookup.
- **Enemy-side status ticks not running (P7).** Follow-up after HF2.
- **Variant pools v2 deferred (P7).** Genre Session scope.
- **Object discovery per-flag missing (UI-3).** node.discovered fallback. Flagged in code.

## Key Implementation Notes

**UI-4:** NarrativeBlock 14/15px Cormorant Garamond italic #c0a878. NPCSpeech #f0c060 weight 500.
  SceneArrival (rule · ◆ · name · region · rule). StreamCursor genre-aware (│█▌·▍), 5 keyframes.
  atmospheric-fragments.ts 10-per-genre no-repeat pool. Loading patterns 1+2 live. Stream buffered.
**P8:** PERK_LIBRARY 20 entries. applyPerkEffects pure (caller appends perks[]). LevelUpModal perk
  step at 4/8/12/16/20. perk_charge_bonus + perk_status_resist wired to combat engine. Gold/xp gap.
**P7:** AbilityTemplate.effects. LevelUpModal slot step at L5/10/15. restCompleteSignal → modal.
**UI-3:** submitAction for NPC/object taps. Loot stubbed — UI-8. findLocationDefinition walks bibles.

## Manual Verification Pending

**P4:** Quest item gate — deflect without item, complete + consume with item, narrator silent.
**P5:** Status pill, DoT in feed, floating DoT number.
**P8:** Perk step at level 4 — 3 cards, confirm stat-bonus applies, Momentum adds charge. Not urgent.
**UI-4:** Visual — prose warmer (#c0a878), scene dividers on arrival, genre cursor blinks.
