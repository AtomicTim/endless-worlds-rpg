# Endless Worlds RPG — Build Status
# Updated after every prompt. Claude.ai owns this file.
# CLAUDE.md is only rewritten when rules or architecture decisions change.

**CLAUDE.md version:** 8.84
**Last code commit:** 1ca4ee6 (PROMPT-LOG: HF2 complete)
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
| UI-1–UI-4 | (see history) | — | — | ✅ |
| UI-5 | Navigation Cards | 21e0f25 | 719 | ✅ |
| UI-6 | NPC Dialogue | — | — | ⏳ IN PROGRESS |
| UI-7 | Codex + Journal/Quests | — | — | ⏳ |
| UI-8 | Loot Flow | — | — | ⏳ |
| UI-9 | Character Panel | — | — | ⏳ IN PROGRESS |
| UI-10 | Combat UI Overhaul | — | — | ⏳ (after HF2 verify) |
| UI-11 | Transitions + Toast System | — | — | ⏳ |
| UI-12 | Character Creation Wizard | — | — | ⏳ |
| UI-13 | Main Menu + Save Slots | — | — | ⏳ |

## Known Gaps / Bugs

- **Narrator streaming buffered (UI-4b needed).** narrator.ts returns full response before tokens
  reach UI. StreamCursor + tap-to-skip wired. Needs dedicated structural refactor prompt.
- **Perk gold/xp consumers not wired (P8).** perk_gold/xp_bonus_pct stored, not consumed.
- **Enemy-side status ticks not running (P7).** Follow-up after UI-10.
- **Bug 2 — zone_id cache leak (HF2 defensive).** Prefix shortcut + fallback + richer diagnostic
  shipped. Root cause (apply-regional-bible cache stamping wrong region) is a larger refactor.
- **Perks display surface missing.** player.perks[] populated but no UI shows owned perks yet.
  Flagged for UI-9 — natural home is Character Panel or a dedicated tab.

## Key Implementation Notes

**HF2:** resolveEnemyLookup layer-2.5 prefix shortcut. buildDungeonFallbackEnemy (tier 1/2,
  genre-themed, hp 15+tier*8). Dungeon-only — non-dungeon silent-cancel preserved. Rich diagnostic.
**UI-5:** "Where to go." single header. Left-border: BACK #b45309, settlement #7dd3fc,
  dungeon #c2410c, unknown dashed #3a3020. Genre card system. isLoading → 0.4 opacity. TIER_COLOR
  map retired (--hl-* tokens untouched).
**UI-4:** NarrativeBlock 14/15px Cormorant Garamond italic #c0a878. NPCSpeech #f0c060 weight 500.
  SceneArrival (rule · ◆ · name · region · rule). StreamCursor genre-aware. Stream still buffered.
**P8:** PERK_LIBRARY 20 entries. LevelUpModal perk step at 4/8/12/16/20. Gold/xp gap noted.

## Manual Verification Pending

**P4:** Quest item gate. **P5:** Status pill + DoT. **P8:** Perk step at L4. (None urgent.)
**HF2:** Enter a dungeon → confirm enemy spawns. Required before UI-10.
**UI-4/UI-5:** Visual only. Not blocking.
