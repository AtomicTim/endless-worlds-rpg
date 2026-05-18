# Endless Worlds RPG — Build Status
# Updated after every prompt. Claude.ai owns this file exclusively.
# Claude Code does NOT update this file. One writer, no conflicts.

**CLAUDE.md version:** 8.84
**Last code commit:** 353dc23 (UI-PR8vc: Codex region lookup, node type formatting, tab underline, ContextPanel type)
**jest baseline:** 852 (ui-foundation: 118/118)
**tsc:** clean

---

## Visual Fidelity Track — THE ACTIVE TRACK

Goal: make every surface match the mockup screenshots in design/mockups/.
Authority: docs/ui-implementation-handoff.md §4 table (in order) + mockup PNGs + design ref v3.3.
Every surface verified against its mockup before moving to the next PR.
Every prompt includes a mobile sanity note — dedicated mobile pass planned at end.

| PR | Surface | Mockup | Commit | Visual ✓ | Status |
|----|---------|--------|--------|----------|--------|
| BG-1 | Global background temperature | nav cards.png eyedropper | dd6cbe5 | ✅ | ✅ |
| BG-2 | Nav card text contrast | nav cards.png eyedropper | c391403 | ✅ | ✅ |
| PR-3v | NavigationBar.tsx | nav cards.png | f266ebb | ✅ | ✅ |
| PR-4v | StoryFeed.tsx | skipped — arrival format accepted as-is | — | ✅ | ✅ |
| PR-5v suite | CharacterPanel.tsx (5v → 5ve + BG-3 → BG-3f) | character panel fantasy.png + inventory*.png | 53629b1 | ✅ | ✅ |
| PR-6v suite | ContextPanel.tsx (6v → 6v-c) | context panel.png | 997e75b | ✅ | ✅ |
| PR-7v suite | DialogueBar full rebuild (7v → 7vg) | npc dialogue mobile.png | 721c59c | ✅ | ✅ |
| PR-8v suite | Codex full rework (8v → 8v-c) | codex mobile.png | 353dc23 | ✅ | ✅ |
| PR-9v | JournalModal.tsx | quest and journal mobile.png, quests cyberpunk.png, quests space.png | — | — | ⏳ next |
| PR-10v | LevelUpModal.tsx | ability panel expanded mobile.png | — | — | ⏳ |
| PR-11v | CombatMode/* | combat desktop.png, combat panel mobile.png, turn resolution timing.png, health bar and damage numbers.png | — | — | ⏳ |
| PR-12v | loot/* + FloorLootStrip.tsx | loot panel.png | — | — | ⏳ |
| PR-13v | TradeModal.tsx | design ref only | — | — | ⏳ |
| PR-14v | AttunementModal.tsx | design ref only | — | — | ⏳ |
| PR-15v | InputBar.tsx + VerbosityToggle.tsx | design ref §17 | — | — | ⏳ |
| PR-16v | Save slots + Main Menu | save slots.png, genre select mobile.png | — | — | ⏳ |
| PR-17v | map/renderers/* | world map.png, region map.png, settlement map.png, dungeon map.png | — | — | ⏳ |
| MOBILE | Full mobile layout pass | all mobile mockups | — | — | ⏳ end |

---

## PR-8v sub-commit chain

| Sub-PR | Change | Commit |
|--------|--------|--------|
| PR-8v | Full rework — genre bg, ALL tab, search, compact rows, inline accordion | a28c1bf |
| PR-8v-b | Tab underlines, title case, location types, expanded readability, first-sentence preview | 9174077 |
| PR-8v-c | Region lookup (walk zone chain), formatNodeType, tab underline (dedicated div), ContextPanel type display | 353dc23 |

---

## PR-7v sub-commit chain

| Sub-PR | Change | Commit |
|--------|--------|--------|
| PR-7v | Conversation history strip + header badge + option cards | 53dd529 |
| PR-7v-b | Compact inline option cards, smaller history | 137a67f |
| PR-7v-c | Viewport fit + 700px desktop width | 4ce1ead |
| PR-7v-d | DialogueBar architectural rebuild (bottom bar replaces nav+input) | 64cd623 |
| PR-7v-e | NPC speech cream, header strip, card sizing, bold options | 525b5c5 |
| PR-7v-f | parseSpokenText — prose amber, quoted words cream bold | 5b9938f |
| PR-7v-g | NPC species next to role (code correct; data gap in pre-23.5A saves) | 721c59c |

---

## Pending HFs (post-UI-overhaul)

**HF-bestiary:** Bestiary auto-entry on first kill.
- Combat engine: on "kill" CombatEvent, call saveCodexEntry (category BESTIARY)
- Fields: enemy.name, enemy.description, hp_range, damage_die, armor_bonus, xp_value, first_seen = current node
- Gate: idempotent — skip if entry already exists

**HF-world-bible-retry:** World-bible retry binds to wrong session on truncation.
- Root cause: world-bible hits max_tokens (10000) mid-JSON, retry creates a new session UUID, GamePage stays bound
  to the first failed session → game starts at placeholder location space_opera_start_01 with no world.
- Fix: wizard must reuse session ID on retry, OR rebind GamePage to the new session before reaching /game.
- Observed on Space Opera (longer descriptions push token count to cap).

**HF-encounter-roster:** Unknown enemy IDs stripped on world generation.
- apply-world-bible strips enemy refs that don't match the master registry (e.g. space_opera_security_drone).
- Fix: either ensure world-bible generation uses canonical enemy IDs, or make encounter_roster tolerant of unknown IDs
  by falling back to a genre-appropriate generic enemy.

---

## Token Discipline Pass (foundation — complete)

| PR | Surface | Commit | Tokens added |
|----|---------|--------|--------------|
| PR-1 | globals.css canonical tokens + legacy purge | 0be34aa | ~canonical set |
| PR-2 | 42 semantic tokens across 16 files | 6101441 | 42 |
| PR-3 | NavigationBar.tsx token pass | f31dec3 | 4 |
| PR-4 | StoryFeed.tsx + StoryComponents.tsx token pass | dbfd1af | 1 |
| PR-5 | CharacterPanel.tsx token pass + genre-accent bug fix | 10a772f | 5 |

---

## Gameplay Implementation Arc

| # | Prompt | Commit | Tests | Status |
|---|--------|--------|-------|--------|
| P1–P8 | (see history) | — | — | ✅ |
| HF2 | Dungeon Enemy Spawn Fix | 13468a0 | 734 | ✅ |
| P9–P11 | Professions | — | — | ⏳ Day 25 |

---

## Workflow notes

- Claude.ai waits for Tim's final commit hash before writing to PROMPT-LOG.md.
- Claude Code does NOT update PROMPT-LOG.md.
- Visual verification required before each PR marked ✅.
- Mobile note included in every prompt; dedicated mobile pass at end.
- --hl-said: bright cream #f5f0e4 — do not revert.
- Equipped row: fixed-width columns (rarity 38px, stat 52px) — do not revert to flex.
- Genre overlays removed from CharacterPanel + ContextPanel; retained in StoryFeed + modals.
- formatNodeType helper in CodexContent + ContextPanel — promote to shared util if third caller appears.

## Known Gaps (post-UI-overhaul backlog)

### Gameplay bugs
- **Narrator streaming buffered (UI-4b).** Structural refactor needed.
- **Perk gold/xp consumers not wired (P8).** Small follow-up.
- **Enemy-side status ticks not running (P7).** Follow-up HF.
- **Bug 2 — zone_id cache leak.** Defensive fix shipped. Root cause pending.
- **World-bible retry session binding.** See HF-world-bible-retry above.
- **Encounter roster unknown enemy references.** See HF-encounter-roster above.

### UI / design
- **FloorLootStrip still rendered.** Retire in PR-12v.
- **CharacterSheet.tsx + InventoryPanel.tsx orphaned.** Delete in cleanup pass.
- **Perks section header in CharacterPanel** still dim — next CharacterPanel touch.
- **Dialogue empty slots.** Render only real options. Next DialogueModal touch.
- **Dialogue history content.** Filter to current NPC conversation only.
- **Codex short_description.** First-sentence heuristic is temporary. True fix: short_description field on CodexEntry.
- **Codex LOCATION subtitle repeats name.** For location entries, subtitle shows "The Rationed Tap — Tavern" which
  repeats the name. Should show the parent location instead (e.g. "Oxygen Junction — Tavern"). Minor.
- **Codex CHARACTER role prefix in description.** NPC description starts with role text ("innkeeper Veska runs...")
  because codex writer includes role in description field. Data pipeline fix needed.
- **Bestiary auto-entry on first kill.** See Pending HFs above.
- **NPC species in DialogueBar.** Shows on new games only (pre-23.5A saves lack species_id).
- **LootList.tsx** consumes --loot-quality-uncommon alias (green) — verify in PR-12v.

### Infrastructure
- **OneDrive sync race (recurring).** Staged-as-you-go pattern for CombatMode files.
