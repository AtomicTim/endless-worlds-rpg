# Endless Worlds RPG — Build Status
# Updated after every prompt. Claude.ai owns this file exclusively.
# Claude Code does NOT update this file. One writer, no conflicts.

**CLAUDE.md version:** 8.84
**Last code commit:** 3545637 (UI-PR9v: JournalModal genre bg, 2-tab QUESTS/JOURNAL, compact cards)
**jest baseline:** 852 (ui-foundation: 118/118)
**tsc:** clean

---

## Visual Fidelity Track — THE ACTIVE TRACK

| PR | Surface | Mockup | Commit | Visual ✓ | Status |
|----|---------|--------|--------|----------|--------|
| BG-1 | Global background temperature | eyedropper | dd6cbe5 | ✅ | ✅ |
| BG-2 | Nav card text contrast | eyedropper | c391403 | ✅ | ✅ |
| PR-3v | NavigationBar.tsx | nav cards.png | f266ebb | ✅ | ✅ |
| PR-4v | StoryFeed.tsx | skipped | — | ✅ | ✅ |
| PR-5v suite | CharacterPanel.tsx | character panel fantasy.png | 53629b1 | ✅ | ✅ |
| PR-6v suite | ContextPanel.tsx | context panel.png | 997e75b | ✅ | ✅ |
| PR-7v suite | DialogueBar | npc dialogue mobile.png | 721c59c | ✅ | ✅ |
| PR-8v suite | Codex | codex mobile.png | 353dc23 | ✅ | ✅ |
| PR-9v | JournalModal | quests cyberpunk.png + quests space.png | 3545637 | ✅ | ✅ |
| PR-10v | LevelUpModal.tsx | ability panel expanded mobile.png | — | — | ⏳ next |
| PR-11v | CombatMode/* | combat desktop.png, combat panel mobile.png, health bar and damage numbers.png | — | — | ⏳ |
| PR-12v | loot/* + FloorLootStrip.tsx | loot panel.png | — | — | ⏳ |
| PR-13v | TradeModal.tsx | design ref only | — | — | ⏳ |
| PR-14v | AttunementModal.tsx | design ref only | — | — | ⏳ |
| PR-15v | InputBar.tsx + VerbosityToggle.tsx | design ref §17 | — | — | ⏳ |
| PR-16v | Save slots + Main Menu | save slots.png, genre select mobile.png | — | — | ⏳ |
| PR-17v | map/renderers/* | world map.png, region map.png, settlement map.png, dungeon map.png | — | — | ⏳ |
| MOBILE | Full mobile layout pass | all mobile mockups | — | — | ⏳ end |

---

## Pending HFs (post-UI-overhaul)

**HF-bestiary:** On first kill → saveCodexEntry(BESTIARY) with enemy stats. Idempotent gate.

**HF-world-bible-retry:** Retry creates new session UUID; GamePage stays bound to failed session.
Fix: reuse session ID on retry OR rebind GamePage. Observed on Space Opera (token cap hit).

**HF-encounter-roster:** Unknown enemy IDs stripped on generation. Need canonical IDs or fallback enemy.

---

## Token Discipline Pass (foundation — complete)

| PR | Commit | Tokens |
|----|--------|--------|
| PR-1 | 0be34aa | ~canonical set |
| PR-2 | 6101441 | 42 |
| PR-3 | f31dec3 | 4 |
| PR-4 | dbfd1af | 1 |
| PR-5 | 10a772f | 5 |

---

## Gameplay Implementation Arc

| # | Commit | Status |
|---|--------|--------|
| P1–P8 | — | ✅ |
| HF2 | 13468a0 | ✅ |
| P9–P11 | — | ⏳ Day 25 |

---

## Workflow notes

- Claude.ai waits for Tim's final commit hash before writing PROMPT-LOG.md.
- Claude Code does NOT update PROMPT-LOG.md.
- --hl-said #f5f0e4 — do not revert.
- Equipped row: fixed-width columns (rarity 38px, stat 52px) — do not revert.
- Genre overlays removed from CharacterPanel + ContextPanel; retained in StoryFeed + modals.
- formatNodeType in CodexContent + ContextPanel — promote to shared util if third caller appears.
- Codex + Journal share same genre background palette and card visual language — keep consistent.

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
- **Codex short_description.** First-sentence heuristic temporary. Needs short_description field on CodexEntry.
- **Codex LOCATION subtitle repeats name.** Should show parent location. Minor.
- **Codex CHARACTER role prefix in description.** Data pipeline fix needed.
- **Bestiary auto-entry on first kill.** See HF-bestiary above.
- **NPC species in DialogueBar.** Shows on new games only (pre-23.5A saves lack species_id).
- **LootList.tsx** consumes --loot-quality-uncommon alias (green) — verify in PR-12v.

### Infrastructure
- **OneDrive sync race (recurring).** Staged-as-you-go for CombatMode files.
- **Webpack cache large string warning (dev only).** "Serializing big strings (231kiB)" — world bible JSON
  likely cause. Dev-mode performance only, no production impact. Low priority.
