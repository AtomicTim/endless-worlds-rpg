# Endless Worlds RPG — Build Status
# Updated after every prompt. Claude.ai owns this file exclusively.
# Claude Code does NOT update this file. One writer, no conflicts.

**CLAUDE.md version:** 8.84
**Last code commit:** c39bd91 (HF-ability-panel-targeting: keep panel open with armed ability state)
**jest baseline:** 854 (ui-foundation: 118/118)
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
| PR-10v | LevelUpModal.tsx | Tim's mockup (no PNG) | 2904962 | ✅ | ✅ |
| PR-11v-a | CombatMode cards + ActionBar + mobile layout | combat desktop.png | df4d593 | ✅ | ✅ |
| PR-11v-b | FloatingDamage arcs + crits + flee SVG + ability floats + Search the Remains + FloorLootStrip removed | health bar and damage numbers.png | 2561b6b | ✅ | ✅ |
| PR-11v-c | AbilityPanel redesign + ability story feed + target flow + EFFECTS key fix | ability_panel_expanded_mobile.png | 00fb461 | ✅ | ✅ |
| PR-11v-d | Damage type color system — shared module + enemy card type label | damage_type_colors.png | 9462b14 | — | ⏳ visual check pending |
| PR-11v-e | Narrate-combat API removed + phase separators + feed uplift + timing + HP sync | turn_resolution_timing.png | a358ccd | ✅ | ✅ |
| PR-12v | loot/* visual rework + FloorLootStrip.tsx delete | loot panel.png | — | — | ⏳ next |
| PR-13v | TradeModal.tsx | design ref only | — | — | ⏳ |
| PR-14v | AttunementModal.tsx | design ref only | — | — | ⏳ |
| PR-15v | InputBar.tsx + VerbosityToggle.tsx | design ref 17 | — | — | ⏳ |
| PR-16v | Save slots + Main Menu | save slots.png, genre select mobile.png | — | — | ⏳ |
| PR-17v | map/renderers/* | world map.png, region map.png, settlement map.png, dungeon map.png | — | — | ⏳ |
| MOBILE | Full mobile layout pass | all mobile mockups | — | — | ⏳ end |

---

## Pending HFs

**HF-bestiary:** On first kill -> saveCodexEntry(BESTIARY) with enemy stats. Idempotent gate.
**HF-world-bible-retry:** Retry creates new session UUID; GamePage stays bound to failed session.
**HF-encounter-roster:** RESOLVED at 5c097ef.
**HF-space-opera-token-cap:** RESOLVED at 8317ea4.
**HF-levelup-timing:** RESOLVED at 4654114.
**HF-dungeon-exit-destination:** RESOLVED at 4654114.
**HF-font-crimson:** RESOLVED at 1fb855f.
**HF-levelup-hp:** RESOLVED at a9dbe06.
**HF-damage-discrepancy:** RESOLVED at a9dbe06.
**HF-combat-double-entries:** Low priority. Some combat actions appear twice in story feed.
**HF-enemy-status-ticks:** Enemy-side DoT does not tick. Engine only ticks player_status_effects.
**HF-dungeon-exit-regen:** Not reproduced post-4654114. Monitor.

**HF-ability-panel-targeting:** RESOLVED at c39bd91.
- Damage/debuff tap: arms the card (panel stays open), highlights with 2px genre-accent border,
  charge line → "Choose Target →", non-armed cards dim to 0.5.
- Tap armed card or Cancel → disarms without closing panel.
- Tap enemy → ability fires, panel closes.
- Buff/heal flow (selectedSlot + "Use →") untouched.

**HF-player-hp-stagger:** RUNNING in parallel session. Queue-based approach — each enemy hit
calls onPlayerHpHit(hp_remaining) after its addMessage; CombatantRow drains a queue with
900ms delays per item. Heals snap immediately.

**HF-queued (remaining — address in order):**
1. Region shown as Settlement Hub in context panel label after dungeon exit
2. Dungeon encounters — always spawn on first visit; % chance only after first cleared
3. Settlement always shown as "back" even if not last visited
4. Defeat: full enemy turn completes, defeat modal with "Awaken at [settlement]" button

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
| P1-P8 | — | ✅ |
| HF2 | 13468a0 | ✅ |
| P9-P11 | — | ⏳ Day 25 |

---

## Workflow notes

- Claude.ai waits for Tim's final commit hash before writing PROMPT-LOG.md.
- Claude Code does NOT update PROMPT-LOG.md.
- Hash is always pulled from Claude Code results — no need to confirm separately.
- jest baseline is 854. Update any baseline references accordingly.
- --hl-said #f5f0e4 — do not revert.
- Equipped row: fixed-width columns (rarity 38px, stat 52px) — do not revert.
- Genre overlays removed from CharacterPanel + ContextPanel; retained in StoryFeed + modals.
- FONT: 'Crimson Text' hardcoded in --serif and tailwind serif. font-style: normal on .ew-serif.
  Italic ONLY on .ew-said, .combat-resolution-prose, .combat-turn-separator-label, .combat-resolution-destination.
- LevelUpModal gate: gateOpen → 1000ms delay → delayedOpen → isStatStepOpen.
- Level up: health = newMaxHealth (full restore) in level-resolver.ts.
- Damage event: actualDamageDealt = player.health - newHealth. Story text matches HP bar delta.
- AbilityPanel: damage/debuff tap → arm card (panel stays open, "Choose Target →") → tap enemy → fires + panel closes.
  Cancel clears armed state. Buff/heal: 1 click → selectedSlot → "Use →" confirm. Unchanged.
- AbilityPanel armed card: 2px genre-accent border, 0.5 opacity on non-armed cards, Cancel row.
- AbilityPanel card is <div role=button> not <button>.
- Player HP stagger: queue-based in CombatantRow. onPlayerHpHit per enemy hit → 900ms drop each.
- CombatMode cards: player flex 0 0 auto (200-260px), enemy scales by count.
- ActionBar: ew-sans title case 13px/700/0.05em, icons 24px, borderRadius 10px, label #d4c4a0.
- FloatingDamage: arcs, crits, CRIT label, #c84830 for all crits.
- Damage type colors: lib/game/damage-types.ts canonical. Holy #c8940a.
- Enemy status pills: combatant.status_effects. wcd threaded to enemy rows.
- region_bibles: applied_region_bible in step 4d merge. Additive.
- FloorLootStrip removed from render; file preserved for PR-12v cleanup.
- LootList in StoryFeed is canonical loot UI.
- WB: streaming + maxDuration=300. RB: streaming + RB_MAX_TOKENS 7000->9000.
- ABILITY EFFECTS KEY RULE: snake() converts apostrophes to _. Match EFFECTS keys exactly.
- Combat narration: narrate-combat API removed. Pre-rendered via templates.ts.
- Round separator: 12px, var(--ui-text-2), rule opacity 0.7.
- Combat timing: ENEMY_PHASE=1000, PLAYER_TURN=1000, ENEMY_GAP=600.
- Damage coloring: "N damage" bold on hit lines.
- Outcome badge: HIT / MISS / FUMBLE on attack lines.
- Dungeon exit destination: topology scan fallback in resolveDungeonExitTarget.
- Codex tabs: flex-wrap so all tabs visible.

## Known Gaps (post-UI-overhaul backlog)

### Gameplay bugs
- **Narrator streaming buffered (UI-4b).** Structural refactor needed.
- **Perk gold/xp consumers not wired (P8).** Small follow-up.
- **Enemy-side status ticks not running.** HF-enemy-status-ticks above.
- **Bug 2 — zone_id cache leak.** Defensive fix shipped. Root cause pending.
- **World-bible retry session binding.** HF-world-bible-retry above.
- **Combat entries firing twice.** Low priority.
- **Dungeon exit regen.** Not reproduced post-4654114. Monitor.
- **Dungeon first-visit always encounters.** See HF-queued.
- **Settlement always "back".** See HF-queued.
- **Defeat panel vanishes mid-turn.** Bundled with defeat screen overhaul.

### UI / design
- **FloorLootStrip.tsx orphaned.** Delete in PR-12v cleanup.
- **CharacterSheet.tsx + InventoryPanel.tsx orphaned.** Delete in cleanup pass.
- **Region shown as Settlement Hub after dungeon exit.** See HF-queued.
- **Perks section header in CharacterPanel** still dim.
- **Dialogue empty slots.** Render only real options.
- **Codex short_description.** First-sentence heuristic temporary.
- **Bestiary auto-entry on first kill.** HF-bestiary above.
- **Nav cards in dungeons** don't match style elsewhere.
- **Unexplored locations** should show location type.
- **Encounter / victory / defeat / flee screens** — full overhaul queued.
- **next/font Crimson_Text in layout.tsx** — remove in cleanup pass.

### Infrastructure
- **OneDrive sync race (recurring).** Staged-as-you-go for CombatMode files.
- **Webpack cache large string warning (dev only).** No production impact.
