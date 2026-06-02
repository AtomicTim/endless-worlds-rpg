# Endless Worlds RPG — Build Status
# Updated after every prompt. Claude.ai owns this file exclusively.
# Claude Code does NOT update this file. One writer, no conflicts.

**CLAUDE.md version:** 8.84
**Last code commit:** 693b25d (HF-font-crimson: replace ew-serif with Crimson Text)
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

## PR-11v-c commit trail (all by Claude.ai directly)
- fb4b4db — initial ship: AbilityPanel grid redesign + ability_used/ability_no_charges templates + StoryFeed branch
- f1d8409 — fix: ranger_hunter_s_arrow EFFECTS key mismatch (apostrophe -> underscore in snake()); diagnostic log removed
- 4fe585b — fix: card <button> -> <div role=button> (nested button HTML violation)
- 00fb461 — HF2: damage/debuff click -> direct to target picker; buff/heal retains 2-click "Use ->" confirm

---

## Pending HFs (post-UI-overhaul)

**HF-bestiary:** On first kill -> saveCodexEntry(BESTIARY) with enemy stats. Idempotent gate.

**HF-world-bible-retry:** Retry creates new session UUID; GamePage stays bound to failed session.

**HF-encounter-roster:** RESOLVED at 5c097ef.

**HF-space-opera-token-cap:** RESOLVED at 8317ea4.

**HF-combat-double-entries:** Some combat actions appear twice in the story feed. Low priority.

**HF-enemy-status-ticks:** Enemy-side DoT does not tick. Engine only ticks player_status_effects.

**HF-levelup-timing:** RESOLVED at 4654114 + 4654114 (1s delay).

**HF-dungeon-exit-destination:** RESOLVED at 4654114.

**HF-dungeon-exit-regen:** Not reproduced post-4654114. Monitor.

**HF-font-crimson:** RESOLVED at 693b25d. ew-serif now uses Crimson Text (upright, readable).
NOTE: 3 remaining var(--serif) usages in globals.css at lines 986/1015/1048 were left untouched.
If any visible text still renders in the old font, those lines need updating too.

**HF-queued (from Tim's session — address in order):**
1. Damage discrepancy: story line shows +1 vs HP bar (likely Iron Resolve passive reducing HP delta)
2. Level up fully restores player HP
3. Ability panel stays open on damage ability selection — panel highlights chosen ability,
   shows "choose target" state, closes only after enemy is tapped
4. Player HP stagger — multiple enemy hits should each queue a separate 900ms delay, not batch
5. Region shown as Settlement Hub in context panel label after dungeon exit (nav label bug)
6. Dungeon encounters — always spawn enemies on first visit; % chance only after first cleared
7. Settlement always shown as "back" even if not last visited
8. Defeat: full enemy turn completes before panel vanishes; defeat modal with "Awaken at [settlement]"
   button (bundle with victory/defeat/flee screen overhaul)

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
- ew-serif font: Crimson Text via next/font, var(--font-crimson). Upright, no italic default. Do not revert.
- var(--serif) still used in globals.css lines 986/1015/1048 — check if visible, update if needed.
- formatNodeType in CodexContent + ContextPanel — promote to shared util if third caller appears.
- Codex + Journal share same genre background palette and card visual language — keep consistent.
- LevelUpModal gate: gateOpen → 1000ms delay → delayedOpen → isStatStepOpen. Do not revert.
- CombatMode cards: player flex 0 0 auto (200-260px), enemy scales by count.
- ActionBar: ew-sans title case 13px/700/0.05em, icons 24px, borderRadius 10px, label color #d4c4a0.
- FloatingDamage: arcs left (enemy) / right (player/ability), 80/20 variety. Crits wide arc + 3 particles + CRIT label.
- Crit color: #c84830 red for both player and enemy crits. Non-crit hits use damage type color.
- Damage type colors: canonical source is lib/game/damage-types.ts. Do not re-inline.
- Holy: #c8940a amber gold (not #ffdc40).
- Enemy damage_die subtitle: colored by primary_damage_type; non-physical shows "· TYPE" label.
- Enemy status pills: StatusEffectPills on enemy cards via combatant.status_effects.
- region_bibles client state: populated via applied_region_bible in step 4d merge. Additive.
- FloorLootStrip removed from GamePage render; file preserved for PR-12v cleanup.
- LootList in StoryFeed is the canonical loot UI going forward.
- WB generation: streaming + maxDuration=300. RB generation: streaming + RB_MAX_TOKENS 7000->9000.
- ABILITY EFFECTS KEY RULE: snake() converts apostrophes to _. Match EFFECTS keys exactly.
- AbilityPanel: damage/debuff -> 1 click to target picker. Buff/heal -> 1 click + "Use ->" confirm.
- AbilityPanel card is <div role=button> not <button>.
- Combat narration: narrate-combat API removed. All text pre-rendered via templates.ts.
- Round separator: 12px, var(--ui-text-2), rule opacity 0.7.
- Combat timing: ENEMY_PHASE_DELAY_MS=1000, PLAYER_TURN_DELAY_MS=1000, ENEMY_TURN_GAP_MS=600.
- Player HP bar: delayed 900ms on decrease. Heals immediate.
- Damage coloring: "N damage" bold genre-accent (player) or #c84830 (enemy) on hit lines only.
- Outcome badge: HIT / MISS / FUMBLE on attack lines.
- Dungeon exit destination: resolveDungeonExitTarget uses zone_id chain then topology scan.
- Encounter / victory / defeat / flee screen overhaul: queued, includes defeat modal.

## Known Gaps (post-UI-overhaul backlog)

### Gameplay bugs
- **Narrator streaming buffered (UI-4b).** Structural refactor needed.
- **Perk gold/xp consumers not wired (P8).** Small follow-up.
- **Enemy-side status ticks not running.** See HF-enemy-status-ticks above.
- **Bug 2 — zone_id cache leak.** Defensive fix shipped. Root cause pending.
- **World-bible retry session binding.** See HF-world-bible-retry above.
- **Combat entries firing twice.** See HF-combat-double-entries above.
- **Dungeon exit regen.** Not reproduced post-4654114. Monitor.
- **Damage discrepancy +1.** Story line vs HP bar mismatch. See HF-queued above.
- **Level up HP restore.** Level up should fully restore HP. See HF-queued above.
- **Player HP stagger.** Multiple enemies should each queue separate 900ms delays. See HF-queued.
- **Dungeon first-visit always encounters.** Should always spawn on first visit. See HF-queued.
- **Settlement always "back".** Nav edge type issue. See HF-queued above.
- **Defeat panel vanishes mid-turn.** Bundled with defeat screen overhaul. See HF-queued.

### UI / design
- **FloorLootStrip.tsx orphaned.** Delete in PR-12v cleanup.
- **CharacterSheet.tsx + InventoryPanel.tsx orphaned.** Delete in cleanup pass.
- **Region shown as Settlement Hub after dungeon exit.** Nav label bug. See HF-queued above.
- **Ability panel stays open on damage selection.** See HF-queued above.
- **Perks section header in CharacterPanel** still dim.
- **Dialogue empty slots.** Render only real options.
- **Codex short_description.** First-sentence heuristic temporary.
- **Bestiary auto-entry on first kill.** See HF-bestiary above.
- **Nav cards in dungeons** don't match style elsewhere.
- **Unexplored locations** should show location type.
- **Encounter / victory / defeat / flee screens** — full overhaul queued.

### Infrastructure
- **OneDrive sync race (recurring).** Staged-as-you-go for CombatMode files.
- **Webpack cache large string warning (dev only).** No production impact.
