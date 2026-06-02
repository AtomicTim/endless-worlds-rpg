# Endless Worlds RPG — Build Status
# Updated after every prompt. Claude.ai owns this file exclusively.
# Claude Code does NOT update this file. One writer, no conflicts.

**CLAUDE.md version:** 8.84
**Last code commit:** a9dbe06 (HF: level up restores full HP + damage event matches actual HP delta)
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

## HF-font-crimson commit trail (fully resolved at 1fb855f)
- Root cause: tailwind.config.ts fontFamily.serif hardcoded to Cormorant Garamond
- Final state: Crimson Text upright everywhere except .ew-said + globals.css combat prose classes

---

## Pending HFs

**HF-bestiary:** On first kill -> saveCodexEntry(BESTIARY) with enemy stats. Idempotent gate.

**HF-world-bible-retry:** Retry creates new session UUID; GamePage stays bound to failed session.

**HF-encounter-roster:** RESOLVED at 5c097ef.
**HF-space-opera-token-cap:** RESOLVED at 8317ea4.
**HF-levelup-timing:** RESOLVED at 4654114.
**HF-dungeon-exit-destination:** RESOLVED at 4654114.
**HF-font-crimson:** RESOLVED at 1fb855f.

**HF-combat-double-entries:** Some combat actions appear twice in the story feed. Low priority.

**HF-enemy-status-ticks:** Enemy-side DoT does not tick. Engine only ticks player_status_effects.

**HF-dungeon-exit-regen:** Not reproduced post-4654114. Monitor.

**HF-levelup-hp:** RESOLVED at a9dbe06. applyLevelUp in level-resolver.ts now sets
health = newMaxHealth (full restore). Test updated to pin expect(slice.health).toBe(expectedMax).

**HF-damage-discrepancy:** RESOLVED at a9dbe06. advanceEnemyTurn in combat-engine.ts now
computes actualDamageDealt = player.health - newHealth after the HP write. event.damage_dealt
uses actualDamageDealt instead of the pre-clamp damage variable. Story text and HP bar delta
now agree exactly. Also handles overkill case correctly.

**HF-ability-panel-targeting:** IN PROGRESS (parallel session). AbilityPanel armed state —
panel stays open with chosen ability highlighted + "Choose Target →" while player selects enemy.

**HF-queued (remaining — address in order):**
1. Player HP stagger — multiple enemy hits should each queue separate 900ms delays
2. Region shown as Settlement Hub in context panel label after dungeon exit
3. Dungeon encounters — always spawn on first visit; % chance only after first cleared
4. Settlement always shown as "back" even if not last visited
5. Defeat: full enemy turn completes, defeat modal with "Awaken at [settlement]" button

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
  Do NOT use var(--font-crimson). next/font Crimson_Text in layout.tsx — remove in cleanup.
- LevelUpModal gate: gateOpen → 1000ms delay → delayedOpen → isStatStepOpen.
- Level up: health set to newMaxHealth (full restore) in level-resolver.ts. Do not revert.
- Damage event: actualDamageDealt = player.health - newHealth after HP write. Matches HP bar delta.
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
- AbilityPanel: damage/debuff -> 1 click arms ability (panel stays open, "Choose Target →") ->
  tap enemy fires action, panel closes. Buff/heal -> 1 click + "Use ->" confirm unchanged.
- AbilityPanel card is <div role=button> not <button>.
- Combat narration: narrate-combat API removed. Pre-rendered via templates.ts.
- Round separator: 12px, var(--ui-text-2), rule opacity 0.7.
- Combat timing: ENEMY_PHASE=1000, PLAYER_TURN=1000, ENEMY_GAP=600.
- Player HP bar: delayed 900ms on decrease. Heals immediate.
- Damage coloring: "N damage" bold on hit lines. Matches actual HP delta.
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
- **Combat entries firing twice.** HF-combat-double-entries above.
- **Dungeon exit regen.** Not reproduced post-4654114. Monitor.
- **Player HP stagger.** Multiple enemies queue separate delays. See HF-queued.
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
