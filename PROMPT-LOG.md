# Endless Worlds RPG — Build Status
# Updated after every prompt. Claude.ai owns this file.
# CLAUDE.md is only rewritten when rules or architecture decisions change.

**CLAUDE.md version:** 8.84
**Last code commit:** a5c0739 (PROMPT-LOG: UI-9 complete)
**jest baseline:** 734 (authoritative)
**tsc:** clean

## Gameplay Implementation Arc

| # | Prompt | Commit | Tests | Status |
|---|--------|--------|-------|--------|
| P1–P8 | (see history) | — | — | ✅ |
| HF2 | Dungeon Enemy Spawn Fix | 13468a0 | 734 | ✅ (verify: enter dungeon) |
| P9 | Professions Foundation | — | — | ⏳ Day 25 |
| P10 | Professions Crafting + XP + Milestones | — | — | ⏳ Day 25 |
| P11 | Professions Character Sheet UI | — | — | ⏳ Day 25 |

## UI Implementation Arc

| # | Prompt | Commit | Tests | Status |
|---|--------|--------|-------|--------|
| UI-1–UI-5 | (see history) | — | — | ✅ |
| UI-6 | NPC Dialogue | — | — | ⏳ IN PROGRESS |
| UI-7 | Codex + Journal/Quests | — | — | ⏳ (after UI-6) |
| UI-8 | Loot Flow | — | — | ⏳ |
| UI-9 | Character Panel | f811645 | 734 | ✅ |
| UI-9b | Nav Card Layout Cleanup | — | — | ⏳ IN PROGRESS |
| UI-10 | Combat UI Overhaul | — | — | ⏳ (after HF2 verify) |
| UI-11 | Transitions + Toast System | — | — | ⏳ |
| UI-12 | Character Creation Wizard | — | — | ⏳ |
| UI-13 | Main Menu + Save Slots | — | — | ⏳ |

## Known Gaps / Bugs

- **Narrator streaming buffered (UI-4b).** Structural refactor needed. Not blocking.
- **Perk gold/xp consumers not wired (P8).** Small follow-up.
- **Enemy-side status ticks not running (P7).** Follow-up after UI-10.
- **Bug 2 — zone_id cache leak.** HF2 defensive fix shipped. Root cause refactor pending.
- **Tabler icon font not installed (UI-9).** Unicode fallbacks in CharacterPanel. Fixed in UI-12.
- **CharacterSheet.tsx + InventoryPanel.tsx orphaned.** Delete in a cleanup pass.
- **Sidebar width 280px (UI-9).** Spec is 196/160px. LogBook co-tenant blocks narrowing now.

## Key Implementation Notes

**UI-9:** CharacterPanel.tsx replaces CharacterSheet + InventoryPanel (kept as orphaned exports).
  HP bar threshold ladder + ≤10% pulse. StatusEffectPills reused from P5. Pack grid tap → inline
  detail expand. Perks section hidden when empty, PERK_LIBRARY lookup. Tabler fallbacks noted.
**UI-5:** "Where to go." header. Left-border type colours. Genre card system. isLoading dims cards.
**HF2:** Prefix shortcut + dungeon fallback + rich diagnostic. Zone_id root cause pending.
**P8:** PERK_LIBRARY 20 entries. LevelUpModal perk step at 4/8/12/16/20. Gold/xp gap noted.

## Manual Verification Pending

**P4:** Quest item gate. **P5:** Status pill + DoT. **P8:** Perk step at L4. (None urgent.)
**HF2:** Enter a dungeon → confirm enemy spawns. Required before UI-10.
**UI-9:** Visual — new sidebar layout, HP colour states, pack grid inline expand. Not blocking.
