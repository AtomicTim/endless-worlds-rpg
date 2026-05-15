# Endless Worlds RPG — Build Status
# Updated after every prompt. Claude.ai owns this file.
# CLAUDE.md is only rewritten when rules or architecture decisions change.

**CLAUDE.md version:** 8.84
**Last code commit:** b160ff4 (P8 — perks system)
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
| HF2 | Dungeon Enemy Spawn Fix | — | — | ⏳ QUEUE (run when slot opens) |
| P8 | Perks System | b160ff4 | 719 | ✅ |
| P9 | Professions Foundation | — | — | ⏳ Day 25 |
| P10 | Professions Crafting + XP + Milestones | — | — | ⏳ Day 25 |
| P11 | Professions Character Sheet UI | — | — | ⏳ Day 25 |

## UI Implementation Arc

| # | Prompt | Commit | Tests | Status |
|---|--------|--------|-------|--------|
| UI-1 | Design Token + Genre System | c7d0370 | 648 | ✅ |
| UI-2 | Top Bar | 463a593 | 678 | ✅ |
| UI-3 | Context Panel | 689d511 | 699 | ✅ |
| UI-4 | Story Panel Typography + Streaming | — | — | ⏳ IN PROGRESS |
| UI-5 | Navigation Cards | — | — | ⏳ |
| UI-6 | NPC Dialogue | — | — | ⏳ |
| UI-7 | Codex + Journal/Quests | — | — | ⏳ |
| UI-8 | Loot Flow | — | — | ⏳ |
| UI-9 | Character Panel | — | — | ⏳ (coordinate with P8) |
| UI-10 | Combat UI Overhaul | — | — | ⏳ (after HF2) |
| UI-11 | Transitions + Toast System | — | — | ⏳ |
| UI-12 | Character Creation Wizard | — | — | ⏳ |
| UI-13 | Main Menu + Save Slots | — | — | ⏳ |

## Known Gaps / Bugs

- **Dungeon enemy spawn failing (HF2).** RegionBible enemy IDs (e.g. the_seam_foothills_rockfall_sentinel)
  fail the 4-layer lookup in combat-engine — encounter silently cancelled. Dungeons must always have a
  chance to spawn. Fix: investigate ID resolution path + add generic fallback when all roster IDs fail.
- **Enemy-side status ticks not running (P7).** target_status lands on enemy.status_effects[] but
  engine only ticks player side. Follow-up after HF2.
- **Variant pools v2 deferred (P7).** 1 candidate per slot per class. Genre Session scope.
- **Object discovery per-flag missing (UI-3).** Objects shown on node.discovered === true. Flagged.
- **Perk gold/xp percent consumers not wired (P8).** perk_gold_bonus_pct and perk_xp_bonus_pct
  accumulate on PlayerState but loot resolver / handleVictory XP grant don't read them yet.
  Small follow-up to wire when convenient.

## Key Implementation Notes

**UI-1:** genreClassName() in lib/game/genre-slug.ts. data-genre + genre-X class both on root.
  --genre-accent-rgb added (UI-3). .ol-scan/.ol-grid/.ol-tex inert until surface opts in.
**UI-2:** Save & Exit preserved. Hamburger wired in UI-3.
**UI-3:** submitAction("talk to <name>") for NPCs, submitAction("<verb> the <name>") for objects.
  Loot taps stubbed (console.log) — UI-8 wires. findLocationDefinition() walks bibles directly.
**P7:** AbilityTemplate.effects added. LevelUpModal 2-step at L5/10/15. restCompleteSignal → modal.
**P8:** Perk effects on PlayerState as caches (perk_charge_bonus, perk_status_resist,
  perk_gold_bonus_pct, perk_xp_bonus_pct). applyPerkEffects does NOT push to player.perks —
  caller does, so passive perks are a true state-unchanged no-op. computeMaxCharges +
  maybeApplyEnemyStatus now consult perk caches. Gold/XP percentage consumers (loot
  resolver, handleVictory XP grant) not yet wired — values stored only.

## Manual Verification Pending

**P4:** Quest item gate — deflect without item, complete + consume with item, narrator silent.
**P5:** Status pill, DoT in feed, floating DoT number.
**P7:** ✅ Verified (abilities panel, damage, attunement modal, victory flow).

**P8:**
- Reach combat level 4 → confirm a perk-pick step appears AFTER the stat confirm, before the
  modal closes. Three perk cards visible with name, category badge, description.
- Confirm a stat-bonus perk (e.g. Relentless / Veteran's Eye) → confirm the named stat +1.
- Confirm a max_hp perk (Iron Skin) → confirm max HP and current HP each +4.
- Confirm a passive perk (Wayfarer, Quick Study, Battle Mage, Fortune's Favour) → no stat
  change visible; perk id appears in player.perks (Character sheet eventually).
- Reach level 5 → confirm slot-2 unlock step still fires (slot vs perk levels don't overlap;
  this is the disjoint-set sanity check).
- Take Momentum → enter combat → confirm ability charge totals show +1 vs baseline.
- Take Fireproof → fight a burning-capable enemy → confirm BURNING sometimes shrugged off
  after the enemy's roll passed (probabilistic, may need several attempts).

**P8 deferred wiring (NOT required for P8 — covered by gap below):**
- perk_gold_bonus_pct stored on PlayerState but loot resolver does not yet read it.
- perk_xp_bonus_pct stored on PlayerState but handleVictory does not yet apply it.
  (Both consumer hookups can land as a small follow-up patch.)
