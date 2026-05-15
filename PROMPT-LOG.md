# Endless Worlds RPG — Build Status
# Updated after every prompt. Claude.ai owns this file.
# CLAUDE.md is only rewritten when rules or architecture decisions change.

**CLAUDE.md version:** 8.84
**Last code commit:** beeb2ef (UI-12 — character creation wizard)
**jest baseline:** 734 (authoritative)
**tsc:** clean

## Gameplay Implementation Arc

| # | Prompt | Commit | Tests | Status |
|---|--------|--------|-------|--------|
| P1–P8 | (see history) | — | — | ✅ |
| HF2 | Dungeon Enemy Spawn Fix | 13468a0 | 734 | ✅ (verify: enter dungeon) |
| P9–P11 | Professions | — | — | ⏳ Day 25 |

## UI Implementation Arc

| # | Prompt | Commit | Tests | Status |
|---|--------|--------|-------|--------|
| UI-1–UI-5 | (see history) | — | — | ✅ |
| UI-6 | NPC Dialogue | 9db1e58 | 734 | ✅ |
| UI-7 | Codex + Journal/Quests | aa98896 | 734 | ✅ |
| UI-8 | Loot Flow | 8749056 | 734 | ✅ |
| UI-9 | Character Panel | f811645 | 734 | ✅ |
| UI-9b | Nav Card Layout Cleanup | 51587a8 | 734 | ✅ |
| UI-10 | Combat UI Overhaul | — | — | ⏳ (after HF2 manual verify) |
| UI-11 | Transitions + Toast System | — | — | ⏳ IN PROGRESS |
| UI-12 | Character Creation Wizard | beeb2ef | 734 | ✅ |
| UI-13 | Main Menu + Save Slots | — | — | ⏳ |

## Known Gaps / Bugs

- **Narrator streaming buffered (UI-4b).** Structural refactor needed. Not blocking.
- **Perk gold/xp consumers not wired (P8).** Small follow-up.
- **Enemy-side status ticks not running (P7).** Follow-up after UI-10.
- **Bug 2 — zone_id cache leak.** HF2 defensive fix shipped. Root cause refactor pending.
- **Tabler icons installed (UI-12).** @tabler/icons-react 3.44. CharacterPanel currency row + all
  25 class cards now use real icons. Marine uses IconAnchor (ti-ship absent in v3).
- **CharacterSheet.tsx + InventoryPanel.tsx orphaned.** Delete in cleanup pass.
- **Sidebar width 280px (UI-9).** Spec 196/160px. LogBook co-tenant blocks narrowing.
- **FloorLootStrip still rendered (UI-8).** Visual overlap with new feed-embedded loot UI. Retire later.
- **Per-item ✓ on taken loot deferred (UI-8).** Taken items drop from list. Polish patch later.
- **Codex 5-tab + Journal 2-tab spec deferred (UI-7).** Data shape change required. Later.
- **Codex section grouping deferred (UI-7).** Requires metadata not on entries. Later.

## Key Implementation Notes

**UI-8:** LootItemCard shared component (inline + modal). Take/Take All flow. Victory card gets
  "Search the remains →" link. LootModal for Context Panel revisit. Inventory full state (orange
  banner + disabled pills). FloorLootStrip retirement deferred. Gold is a loot item — explicit Take.
**UI-7:** Entry type left borders (LOCATION #7a9ab8, CHARACTER #c4943a, LORE #a888c8).
  ◈ on significance=MAJOR. Quest cards with status badge tints. Journal day headers genre-specific.
**UI-6:** DialogueModal inline panel at StoryFeed bottom. 4 slots + secondary row + End outside.
**UI-9b:** Single-column nav card list. min-height 56px. Typography floor 13px/8px.

## Manual Verification Pending

**HF2:** Enter dungeon → confirm enemy spawns. Required before UI-10. ← BLOCKING
**UI-8 (test before UI-10):**
- Win fight → "Search the remains →" appears → tap → loot list with gold + items + Take All
- Take individual item → removed from list, added to inventory
- Take All → all land at once → "All collected ✓"
- Inventory full (20/20) → orange banner + disabled Take pills (gold still works)
- Leave without searching → Context Panel shows "Remains · Search" → tap → loot modal
- All taken → Context Panel entry disappears
**P4/P5/P8/UI-6/7/9:** Visual or non-urgent. Not blocking.
**UI-12:** Visual — start a new game, walk through every wizard step: genre cards (accent pill +
  --card-bg), Forging screen (#08060a + genre-accent headline + sweep bar), class cards (Tabler
  icon in stat colour + role pill in stat colour, selected border is stat colour), species/
  origin/appearance cards (genre-accent border on select), name input (#141210 bg + Cormorant
  italic 15px + caret in genre accent), motivation textarea (same shell), step dots at top
  (no labels). Not blocking.
