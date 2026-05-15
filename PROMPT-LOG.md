# Endless Worlds RPG — Build Status
# Updated after every prompt. Claude.ai owns this file.
# CLAUDE.md is only rewritten when rules or architecture decisions change.

**CLAUDE.md version:** 8.84
**Last code commit:** a11d82b (UI-10 — combat UI overhaul)
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
| UI-1–UI-9b | (see history) | — | — | ✅ |
| UI-10 | Combat UI Overhaul | a11d82b | 734 | ✅ |
| UI-11 | Transitions + Toast System | d4a99e5 | 734 | ✅ |
| UI-12 | Character Creation Wizard | beeb2ef | 734 | ✅ |
| UI-13 | Main Menu + Save Slots | — | — | ⏳ IN PROGRESS |

## Known Gaps / Bugs

- **Narrator streaming buffered (UI-4b).** Structural refactor needed. Not blocking.
- **Perk gold/xp consumers not wired (P8).** Small follow-up.
- **Enemy-side status ticks not running (P7).** Follow-up after UI-10.
- **Bug 2 — zone_id cache leak.** HF2 defensive fix shipped. Root cause refactor pending.
- **FloorLootStrip still rendered (UI-8).** Retire in cleanup pass.
- **Per-item ✓ on taken loot deferred (UI-8).** Polish patch.
- **Codex 5-tab + Journal 2-tab spec deferred (UI-7).** Data shape change needed.
- **Sidebar width 280px (UI-9).** Fix when LogBook redesigned.
- **Marine icon: IconAnchor (UI-12).** ti-ship absent from @tabler/icons-react v3.
- **CharacterSheet.tsx + InventoryPanel.tsx orphaned.** Delete in cleanup pass.

## Key Implementation Notes

**UI-12:** @tabler/icons-react@3.44.0 installed. Class cards Tabler icons in stat colours. Step
  dots (6, no labels). CharacterPanel currency now Tabler. Marine → IconAnchor.
**UI-11:** ToastManager bottom:50 right:16 z-30, max 2 visible, queue cap 3. 4 types wired to
  codex write, quest complete, level-up confirm, victory XP. Modal entry animations on 4 modals.
**UI-8:** LootItemCard + LootList + LootModal. Victory "Search →" link. Context Panel wired.
**UI-6:** DialogueModal inline panel. 4 slots + secondary row + End outside. Odds from stat mod.
**UI-9b:** Single-column nav cards. min-height 56px. Full-width. Typography floor 13/8px.

## Manual Verification Pending

**HF2:** Enter dungeon → confirm enemy spawns. BLOCKING UI-10.
**UI-8:** Loot flow — win fight, search, take, take all, full inventory, Context Panel revisit.
**UI-11:** Toasts fire on codex/quest/level-up/victory. Modal scale-in animation visible.
**UI-12:** Walk through wizard — class icons, stat colours, step dots, accent caret on inputs.
**UI-10:** Visual — enter combat → 380ms panel rise; HP bars use 5-tier threshold ladder
  (#4a8a4a → #e03030 pulse ≤10%); kill an enemy → greyscale + compress; action buttons use
  --card-bg/--card-border with genre-accent hover border; turn badge "YOUR TURN" / "ENEMY TURN"
  (accent / red); dice line ("16 vs 12 · hit") appears below combatants on each roll with
  80ms fade. Not blocking.
(None of the above block UI-13 or UI-10 once HF2 verified.)
