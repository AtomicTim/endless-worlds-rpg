# Project: Endless Worlds RPG — Master Context

**Version:** 8.45
**Status:** Nav 2-row mini-column layout COMPLETE (commit 14252ac) — Polish Round 4b (Mobile QA) NEXT
**Objective:** A text-based RPG that generates a unique world for every playthrough. Genre-agnostic, infinitely replayable, CRPG depth.

**References:** /docs/architecture-spec.md · /docs/combat-spec.md · /docs/css-containment-audit.md (V8.41, 0 active risks, 5 future candidates)

---

## 🎮 Game Vision

The north-star scenario this entire project is being built for:

> **Tim and his wife (or a friend) are sitting in the living room on a Saturday night. One of them says "let's play." Both pull out phones, tap a website, pick a genre, name a character. Within a couple minutes they're in a brand-new world neither has seen before — a quest waiting, NPCs to meet, dungeons to crawl, lore to discover. They play for an hour or two and walk away having had a real D&D-style adventure.**

This scenario drives every design decision. If a feature makes that scenario *better*, it's worth building. If it doesn't, it's polish or scope creep.

### What this game IS

- **A pickup D&D-style RPG.** Sit down, play in a few minutes, walk away when you're done.
- **Procedurally generated every game.** No two playthroughs share a world.
- **AI-narrated with D&D-style prose.** Descriptions that hit home like a good DM.
- **CRPG-depth mechanics.** Real stat checks, inventory, leveling, gear, combat math.
- **Multiple play styles supported simultaneously.** Long quest, speedrun, exploration, settlement-grind, lifestyle/job-grind (eventual), mixed.
- **Mobile-first accessible.** The phone in your pocket IS the game console.
- **Multiplayer (PRE-LAUNCH per V8.38).** Two phones, one shared world. Active requirement.
- **User-customizable worlds (PRE-LAUNCH per V8.38).** User-supplied theme prompts beyond fixed genre presets.

### What this game IS NOT

- **Not Baldur's Gate.** Complexity in narrative and growth, not interface.
- **Not a CYOA tool.** Real mechanics matter.
- **Not a long-term single-character commitment.** Replayability from NEW playthroughs.
- **Not a tabletop replacement.** Complements physical D&D.
- **Not a hardcore strategy game.** Dramatic narrative beats with mechanical weight, not min-maxing.

### Competitive positioning

> **"Baldur's Gate depth without Baldur's Gate overhead. D&D feel without needing a DM."**

### Design principles

1. **Pickup-friendly.** Time from "let's play" to "playing" must stay short.
2. **Mobile-first viewport.** Every UI verified on phone-width before desktop polish.
3. **Multiple play styles supported.** No system forces one playstyle.
4. **Procedural variety > authored depth.** Lean on AI for breadth, code for reliability.
5. **Multiplayer-aware architecture (PRE-LAUNCH).** Day 21-23 actively support party-of-N. Day 24 wires the multiplayer layer.
6. **Customization-aware architecture (PRE-LAUNCH).** Day 25 wires the customization layer.
7. **D&D-style narration is the soul.**
8. **Death must matter.** HP, currency, XP rollback. Settlements are deliberate checkpoints.

---

## 🎯 Project Roles & Working Mode

**Vision & Creative Direction:** Tim (the user). First-time game developer.

**Senior Engineering / Tech Direction:** Claude.ai. Translates vision into architecture, flags scope/risk/feasibility, pushes back on premature/risky/scope-drifting decisions. Defers to creative-director call on vision.

**Implementation:** Claude Code (local Sonnet agent).

**Decision flow:** Tim describes → Claude.ai assesses → Tim decides → Claude.ai writes prompt → Claude Code implements → Tim verifies → Claude.ai updates CLAUDE.md.

**Per-prompt protocols (cumulative):**
- **V8.40 — Investigation-before-patching.** Validate root-cause hypothesis BEFORE patching.
- **V8.41 — Origin/main baseline check.** Step 1 of every prompt: `git fetch origin && git log origin/main --oneline -5`.

---

## 📋 Strategic Trajectory Notes

### Future Feature Ideas (captured, not yet slotted)

**Encounter Avoidance / Stealth System (V8.41 capture):**
Roll player PER/AGI/stealth-skill against enemy detection DC. On SUCCESS: Avoid / Pre-emptive ability / Sneak attack / Environmental interaction / Engage normally. On FAIL: combat triggers normally.
*Dependencies:* Day 22 skills (stealth domain), combat-spec §3 pipeline. *Slot:* Day 20.6 alongside Day 20.5. *Design risk:* Skyrim-Sneak model — must not punish combat-built characters.

### V8.45 — Test count note

Commit 14252ac reported 762/762 tests vs V8.44's 338. NavigationBar.tsx-only change doesn't explain the jump. Most likely cause: prior rounds ran partial suites (e.g. `jest --testPathPattern nav`) and V8.45 ran the full suite. **Going forward, always run `npx jest` with no pattern flag as the baseline.** 762 is likely the actual project-wide total, which is healthy at this stage.

### V8.44 — Polish 4c: pure module extraction applied proactively

`chooseTierForNode()` extracted to `lib/game/map-tier.ts` proactively (rule 71 pattern without waiting for a bug to force it). Nav dedup via `backCards[0]?.targetId` check before DEEPER settlement emits.

### V8.43 — Nav design decisions locked

BACK showing previous region's settlement = intentional (rule 74 confirmed). Dedup rule 80 defined. Map tier intra-region rule 81 defined.

### V8.42 — Third recurrence: prompt-template hardcoded ID bug

Audit scope: (1) defensive overchecks in app code, (2) prompt-template hardcoded structural IDs (sweep `generate-*/route.ts`), (3) CSS containment (covered).

### V8.41 — Workflow lessons + Combat UX Polish Queue

Baseline drift mitigation: rule 76 origin baseline check. Test counts = reference values; `jest` output is authoritative.

**Combat UX & Flow Polish Queue (post-Day-23):** Hit/miss differentiation · Miss feedback over portrait · Flee-fail → death pacing.

### V8.38 — Three strategic decisions LOCKED

**Multiplayer = PRE-LAUNCH.** Day 24. **Customization = PRE-LAUNCH** toward end. Day 25. **Day 22 skills = FOUNDATIONS NOW.**

### Sequence

1. ~~Polish 4a (24ac19c)~~ ✅
2. ~~Day 20.4.3 (60501c8)~~ ✅
3. ~~Day 20.4.4 (e87b23a)~~ ✅
4. ~~Polish 4c (198a757)~~ ✅
5. ~~Nav 2-row mini-columns (14252ac)~~ ✅
6. **Polish 4b** ⏳ NEXT — mobile-viewport QA pass
7. Day 21 — Container + Loot (multiplayer-aware)
8. Day 22 — Skills + Leveling (foundations)
9. Vertical slice playtest
10. Day 23 — Main Quest Thread
11. Combat UX & Flow Polish round
12. Day 24 — Multiplayer Foundation
13. Day 25 — Customization Layer
14. Day 20.5 — Verbal Action (deferred)
15. Day 20.6 — Encounter Avoidance / Stealth (deferred)

### Open strategic questions

- External playtest timing (post-Day-22 or post-Day-23).
- Difficulty tuning — toggle vs world-tier scaling.
- Random travel encounters (combat-spec §3).
- NPC behavior dispatch (combat-spec §6.3).
- Map visual rework — dedicated session, deferred.
- Audit queue: defensive overchecks, prompt-template hardcoded IDs, integration test coverage.

---

## 🔄 Current Status (Read This First)

**Current Phase:** Nav 2-row mini-column layout complete (commit 14252ac, 762/762 full suite). Polish Round 4b (mobile-viewport QA pass) is next.
**Stack:** Next.js 14 / Tailwind / shadcn/ui / Supabase / Claude API / Stripe / Vercel · **Repo:** atomictim/endless-worlds-rpg

| Phase | Title | Status |
| --- | --- | --- |
| 1–18 | MVP through Systems Audit | ✅ Complete |
| 19A–19F | World Generation Architecture | ✅ Complete |
| Movement Track | Verified end-to-end | ✅ FROZEN |
| Combat Spec | /docs/combat-spec.md | ✅ Frozen |
| Combat era (Days 20–20.4.2) | Data + resolver + UI + narration + polish + hotfixes | ✅ Complete |
| Polish 4a (24ac19c) | Nav grouping + tier colors + cross-region BACK + map auto-switch + .ew-said + CSS audit | ✅ Complete |
| 20.4.3 (60501c8) | Region Expansion Hotfix — prompt template + splitConflatedRegionSettlement | ✅ Complete |
| 20.4.4 (e87b23a) | Nav/Display Hotfix — settlement DEEPER card + story header display name | ✅ Complete |
| Polish 4c (198a757) | Column layout + nav dedup (rule 80) + map tier auto-switch (rule 81) + mobile scroll | ✅ Complete |
| **Nav mini-cols (14252ac)** | **2-row max per mini-column, overflow wraps right, lone cards bottom-aligned** | ✅ **Complete** |
| **Polish 4b** | **Mobile-viewport QA pass — audit doc + inline fixes + deferred-rework list** | ⏳ **NEXT** |
| Day 21 | Container + Loot — multiplayer-aware | ⏳ After 4b |
| Day 22 | Skills + Leveling | ⏳ After Day 21 |
| Vertical slice playtest | Full game start → win condition | ⏳ Before Day 23 |
| Day 23 | Main Quest Thread | ⏳ Post-playtest |
| Combat UX & Flow Polish | Hit/miss differentiation + miss float + flee-fail pacing | ⏳ Post-Day-23 |
| Day 24 | Multiplayer Foundation | ⏳ Pre-launch |
| Day 25 | Customization Layer | ⏳ Pre-launch toward end |
| Day 20.5 | Verbal Action System | ⏳ Deferred (Combat Alternatives) |
| Day 20.6 | Encounter Avoidance / Stealth | ⏳ Deferred (Combat Alternatives) |
| Map Visual Rework | Dedicated session | ⏳ Deferred |

**Active genres:** Fantasy, Cyberpunk, Horror/Lovecraftian, Space Opera, Post-Apocalyptic. Noir removed.

### Nav mini-columns (commit 14252ac — 762/762 full suite)

`NavigationBar.tsx` only. `chunkArray<T>(arr, size)` helper splits cards into groups of 2. Within each group block, cards render as a flex row of mini-columns, each mini-column `flexDirection: column, justifyContent: flex-end, width: 140`. Lone cards sit at the bottom row. Group block now auto-sizes (removes fixed 156px width; 1 mini-col = 156px, 2 = 300px). `.ew-nav-cols` strip absorbs width via existing `overflow-x: auto`.

### Round history (compressed)

| Commit | Round | Rules |
| --- | --- | --- |
| 14252ac | Nav mini-cols — 2-row max, overflow wraps right, lone cards bottom-aligned | (rule 72 updated) |
| 198a757 | Polish 4c — column layout + nav dedup + map tier auto-switch expansion | 80-81 |
| e87b23a | 20.4.4 — settlement DEEPER card + story header display name + stitch guarantee | (80-81 defined) |
| 60501c8 | 20.4.3 — region expansion prompt template fix + splitConflatedRegionSettlement | 77-79 |
| 24ac19c | Polish 4a — nav grouping/tiers/cross-region BACK/map auto-switch/.ew-said/CSS audit | 72-76 |
| f17c221 | 20.4.2 — float CSS clip + stagger + sync to feed + codex modal + D&D roll format | 66-71 |
| c67f2c0 | 20.4.1 — float routing + inventory-Use + flee DC + defeat respawn fix | 62-65 |
| fc508f3 | 20.4 — rolls field + inline suffix + floats introduced + defeat teleport groundwork | 57-61 |
| 732e944 | 20.3 — flex separators + button-only input + crit banner + suppression + resolution | 52-56 |
| bf3871e + 1215bb6 | 20.2 + 20.1 — initiative kickoff, inventory stats, starting equipment, encounter banner | 43-51 |
| abf73e6 + earlier | 20 Prompt 3 + foundation + pre-combat + 19A-19F | 1-42 |

### Architecture & system status

**Domain 1 (Engine — pure code):** Navigation + nav-cards module (rules 72-81, 2-row mini-col layout V8.45) + map-tier.ts pure module (V8.44) · combat system (rules 24-71) · region expansion guard + splitConflatedRegionSettlement + region-graph-builder (V8.42-V8.43) · loot resolver (Day 21).

**Domain 2 (Content Library — frozen):** WCD, WorldBible, RegionBible, NPCs, items, loot tables, bestiary, region enemies, starting equipment loadouts.

**AI during gameplay:** Arrival narration ✅ · Dialogue ✅ · Action narration ✅ · Combat narration ✅ · Container search ⏳ Day 21 · Verbal action ⏳ Day 20.5 · Stealth/avoidance ⏳ Day 20.6.

**Generation models:** RegionBible: haiku-4-5, max_tokens 7000, distinct settlement/region IDs (rule 77). WorldBible: sonnet-4-5, max_tokens 10000. Combat narrator: sonnet-4-5.

**Map system:** `lib/game/map-tier.ts` `chooseTierForNode()` — region zone → Region tier, everything else → Local. Fires on every node arrival (rule 81). Initial mount: Local (rule 21). Visual rework pending.

**NPC Dialogue:** Options built by code. `.ew-said` = `#f4e8c8`.

### Known issues

**Polish Round 4b — NEXT:** Phone-width (~380px) QA pass. Discovery-and-triage. Output: `/docs/mobile-viewport-audit.md` + inline fixes. Combat panel almost certainly needs dedicated mobile-layout round.

**Combat UX & Flow Polish (post-Day-23):** Hit/miss differentiation · miss float · flee-fail pacing.

**Day 20.5 + 20.6 (post-Day-25):** Verbal Action + Encounter Avoidance.

**CSS containment future candidates:** PortraitSlot, StoryFeed tooltips, TradeModal floats, GameLayout rail tooltips, WorldMap edge tooltips.

**Other deferred:** Map visual rework, world-gen perf, NPC color overlap, hub codex, grid_position, behavior dispatch, toSlug bug, combat balance.

---

## ⚡ FOUNDATIONAL RULES

1. World Assets Are Permanent. Write-once.
2. Navigation Is Nav Bar Only. Map is visual only.
3. Location Is Authoritative State. current_node_id on navigateTo.
4. Actions Permitted By Default.
5. Objects Mentioned Exist. Failed checks = evasion.
6. Dialogue Consistent. Failed check = no info. Trade = no check.
7. AI Three Roles Only. Generator → Bridge → Thread.
8. WCD Is Absolute Law.
9. Failed Checks = Evasion Only.
10. Highlights Are Exact Tier 1 Matches.
11. Highlight clicks resolve display-name → node id before navigateTo. (V8.26)
12. Every successful arrival flips `discovered = true` at end of step 7. (V8.26)
13. Cache hit on ARRIVING synthesizes a `narratorResponse` and falls through. (V8.27)
14. Map description sourcing: World/Region/Local — no cross-tier bleed. (V8.27)
15. Region zone assets always populate both `constitution.physical_description` AND `constitution.atmosphere` from same source prose. (V8.28)
16. Collision-check loops over expandable node positions must guard each entry with `isValidPos`. (V8.28)
17. Story feed location highlights are tier-aware: region (lavender), location (sky-blue), landmark (mint). (V8.29, V8.30)
18. Region zone D2 card builder iterates adjacent_regions/connections without filtering by stripped links. (V8.29 + V8.30)
19. Span dispatch in StoryFeed separates `key` from spread props before JSX. (V8.29)
20. Region tier description resolves from parent region zone asset for any node in that region. (V8.30)
21. Map tier defaults to Local on initial mount for any non-region-zone node. (V8.30)
22. New region creation always wires the origin region symmetrically into adjacent-region connections. (V8.30)
23. RegionBible parse failure must never block the player. (V8.30)
24. Enemy entries follow the Enemy interface. Validation is warn-don't-500. (V8.31)
25. Encounter rosters reference enemy ids resolved via 4-layer fall-through. Unresolvable ids scrubbed at apply time. (V8.31)
26. metadata.region_bibles accumulates expanded RegionBibles by id. (V8.31)
27. Combat system design defers to /docs/combat-spec.md. Spec FIRST, code SECOND. (V8.31)
28. Combat math lives in `/lib/game/combat-resolver.ts`. Pure functions, RNG injected. (V8.32)
29. Combat turn loop lives in `/lib/game/combat-engine.ts`. Defeat / victory / flee dismiss the combat state slice entirely. (V8.32)
30. last_settlement_hub_id and navigation_trail update on every successful arrival in step 7c-2. INITIALIZED AT GAME SPAWN in apply-world-bible. (V8.32 + V8.38)
31. pre_combat_xp captured at encounter start. Defeat handler restores player.xp = pre_combat_xp. (V8.32)
32. Encounter trigger is in step 7c-3. (V8.32)
33. Enemy behavior on Day 20 is hardcoded "attack the player" regardless of behavior_flavor field. (V8.32)
34. Returning to a region whose bible is in metadata.region_bibles AND whose graph node is discovered is GRAPH_NAVIGATE, not WORLD_EXPLORE. (V8.33)
35. apply-regional-bible is idempotent: skipped: true when redundant. (V8.33)
36. mergeNodePreservingDiscovered preserves discovered: true on re-apply. (V8.33)
37. arrivedAt in step 7c reads from updatedState (post-reclassification). (V8.33)
38. Combat narration is selective: routine events templated; dramatic events call /api/game/narrate-combat. (V8.34, refined V8.35 + V8.37)
39. CombatMode is the bottom-strip swap when `master_state.combat?.active === true`. (V8.34)
40. Each combatant row reserves a portrait slot (~128px). (V8.34)
41. Bestiary codex entries write on `combat_start`, deduplicated by enemy.id. (V8.34)
42. New game preamble: `recent_messages.length === 0` triggers "Your adventure begins. What will you do first?" (V8.34)
43. Starting equipment lives in `lib/game/starting-equipment.ts` as separate module. (V8.35)
44. Every starting weapon ships with `equipped: true` AND `effect.damage_die`. Every starting armor ships with `equipped: true` AND `effect.armor_bonus`. (V8.35)
45. `combat_start` is templated, not LLM-narrated. (V8.35)
46. `player_turn_start` and `enemy_phase_start` events emitted by combat-engine at phase transitions. (V8.35)
47. Pacing delays: 800ms before enemy_phase_start, 800ms before player_turn_start, 500ms between successive distinct enemy actors. (V8.35)
48. CombatMode header pill `displayPhase` is decoupled from `combat.current_turn_index` and flips ahead of feed. (V8.35)
49. Enemy-turn loop is shared via `advanceUntilPlayerTurnOrEnd`. Single source of truth. (V8.36)
50. When combat starts with `turn_order[0] !== PLAYER`, the initial enemy phase MUST fire via `kickoffCombat` from useEffect. Tracked via useRef Set. (V8.36)
51. Inventory detail panel surfaces combat stats: WEAPON Damage, ARMOR Armor (including +0), CONSUMABLE Heal. EQUIPPED pill. (V8.36)
52. Combat input is button-only when combat is active. submitAction early-bails. INTERIM until Day 20.5. (V8.37)
53. Use Item is templated only. Format: `"You use <item>. Restored N HP."` (V8.37)
54. Crit events render as TWO lines: templated banner first (instant), then LLM crit prose. (V8.37)
55. `planEventSuppression(events)` pre-scans event batches. When victory present: kill events dropped, last crit before victory has prose suppressed. (V8.37)
56. Resolution events render as two-line centered block: banner + ≤20-word LLM prose. max_tokens 120. (V8.37)
57. CombatEvent.rolls field populates on every event with damage/d20/heal outcome. (V8.38)
58. Inline roll suffix renders subtle parenthetical breakdown via `{primary, rolls}` return shape from templates. (V8.38)
59. Floating damage numbers fire on hit/crit/heal events ONLY. Routing via explicit `switch(event.type)`: player_attack hosts on `event.target`, enemy_attack/use_item host on `PLAYER_ID`. (V8.38 + V8.39)
60. Defeat teleport — `last_settlement_hub_id` initialized at game spawn. handleDefeat uses 3-tier fallback chain. Cross-region teleport per soulslike model. (V8.38)
61. Resolution events (defeat / flee_success) carry destination payload. Victory does NOT get destination line. (V8.38)
62. `rolls.d20` stores RAW d20 value (1-20). `target_dc` wrapped in `Math.round()` for display. (V8.39)
63. Inventory Use button during combat routes through `submitCombatAction`. Equip/Unequip/Read/Search/Drop buttons HIDDEN during combat. (V8.39)
64. Floating damage entry routing uses explicit `switch(event.type)`. Defensive `player_attack target === PLAYER_ID` guard returns null. (V8.39)
65. Settlement-hub detection in step 7c-2 uses `is_settlement_node === true` predicate ONLY. Category fallback removed (V8.39 lesson). (V8.39)
66. Floating damage emission lives INSIDE `projectCombatEventsToFeed` (useCombat), called AFTER pacing sleeps. CombatMode is a pure renderer for `floatingByActor`. (V8.40)
67. Multi-host floating damage uses `computeFloatStartDelay` pure helper. 300ms increments. `animation-fill-mode: both`. (V8.40)
68. Roll display format is D&D-style: `(d20: 17, +2 → 19 vs 12 | 1d6+2)` hits, `(d20: 1)` fumbles, `(d20: 20 | ...)` crits, `(1d8: 4 +4 = 8)` heals. (V8.40)
69. Codex is rendered as `CodexModal` overlay (z-50, ESC + backdrop + X close). Combat panel remains mounted underneath. (V8.40)
70. **CSS containment lesson:** `overflow-x/y: auto` on ancestors clips absolutely-positioned children. Use `overflow: visible` on containers hosting absolutely-positioned children extending outside the box. (V8.40)
71. **Integration tests required for routing helpers and lookup keys.** Unit tests against fake events can pass while real-data wiring is broken. (V8.40)
72. Nav cards group by movement direction: BACK / DEEPER / PEER / UNDISCOVERED. EXIT folds into BACK. Empty groups omitted. Pure-function `lib/game/nav-cards.ts` owns `buildCards` + `groupCardsByDirection`. NavigationBar renders each group as a row of 140px mini-columns (max 2 cards tall, `chunkArray(cards, 2)`), lone cards bottom-aligned (`justifyContent: flex-end`), group block auto-sizing. `.ew-nav-cols` strip handles mobile horizontal scroll. (V8.41 grouping · V8.44 column direction · V8.45 mini-col chunking)
73. Nav card tier color via `tierOfNode`. Region → `--hl-region` lavender · Settlement → `--hl-loc` sky-blue · Sub-location → `--hl-sublocation` mint · Dungeon → `--hl-dungeon` burnt-copper. Background stays neutral. (V8.41)
74. Cross-region BACK card consults `masterState.navigation_trail[-2]`. If previous node is a different region, BACK targets that region's settlement hub. **Intentional — BACK answers "how do I get back to where I came from?"** (V8.41)
75. WorldMap cross-region arrival → Region tier (V8.41). Superseded for all arrivals by rule 81. (V8.41 → V8.44)
76. **Origin/main baseline check:** Claude Code MUST run `git fetch origin && git log origin/main --oneline -5` as step 1 of every prompt. (V8.41)
77. **RegionBible prompt template MUST distinguish settlement_id from region_id.** Use `settlementSlug = ${outline.id}_settlement`. Every cross-reference points at `settlementSlug`. Include explicit "REGION vs SETTLEMENT IDS" guidance block. (V8.42)
78. **Apply-regional-bible heal-on-apply:** `splitConflatedRegionSettlement(bible)` detects id collapse, renames settlement id, stamps settlement fields, re-points sub-locations + NPCs + exits. Runs at step 0d. (V8.42)
79. **Prompt-template hardcoded structural IDs are a recurring bug class.** Audit: sweep `app/api/game/generate-*/route.ts` for `${outline.id}`, `${region.id}` etc. in id positions where collision is possible. (V8.42)
80. **Nav card dedup at region zone.** DEEPER isAtRegionZone branch checks `backCards[0]?.targetId`; suppresses DEEPER settlement card if it matches BACK destination. Cross-region: both emit (different destinations). No trail: DEEPER suppressed. (V8.43 defined · V8.44 implemented)
81. **Map tier auto-switch fires on every node arrival.** `lib/game/map-tier.ts` `chooseTierForNode()`: region zone → tier 2 (Region), everything else → tier 1 (Local). WorldMap.tsx useEffect calls this on every arrival. Prevents Local-tab-shows-region-content and inverse. (V8.43 defined · V8.44 implemented)

---

## Narrator Prompt Order

DIALOGUE: WCD → HARD RULES → RESPONDING CHARACTER → CLOSED CONTEXT → TIER 1 OBJECTS → WORLD ASSETS → SCENE → VERBOSITY
non-DIALOGUE: WCD → HARD RULES → NPCS PRESENT → TIER 1 OBJECTS → CONNECTED LOCATIONS → WORLD ASSETS → SCENE → VERBOSITY
COMBAT: GENRE TONE PRIMER → COMBAT EVENT → HARD RULES → length hint (resolutions ≤20 words, crit/kill 2-3 sentences)

---

## Story Feed Colors

| Use | Color | Token |
| --- | --- | --- |
| Narrator prose | var(--ink-1) | — |
| NPC quoted speech | #f4e8c8 italic weight 600 | --hl-said |
| Player actions (out-of-combat) | #7ab8c8 teal-blue 12px mono italic | — |
| Item highlights | #e8c547 yellow | --hl-item |
| Region highlights | #c4b5fd lavender | --hl-region |
| Location highlights | #7dd3fc sky-blue | --hl-loc |
| Sub-location | #94d8b8 mint | --hl-sublocation |
| Dungeon | #b45309 burnt-copper | --hl-dungeon |
| NPC highlights | var(--accent) orange | — |
| Combat routine player/enemy | #7ab8c8 teal / #e87c6d warm red | --combat-player / --combat-enemy |
| Combat crits | #3b82a8 deeper blue / #c0392b blood red BOLD | --combat-player-crit / --combat-enemy-crit |
| Combat outcomes | #7dbb8e victory / #a93226 defeat / #a8a29c flee | — |
| Encounter banner | #f4a07a light coral | --combat-encounter-banner |
| Roll detail suffix | 10px dim mono 0.6 opacity (D&D format) | --combat-roll-detail |
| Floating damage | 28px (36px crit) mono bold, 1100ms fade, staggered | — |
| Resolution destination | 12px italic serif 0.75 opacity | --combat-resolution-destination |

---

## Tech Stack · Genre Definitions · Monetization

| Layer | Tool |
| --- | --- |
| Frontend | Next.js 14 (App Router) |
| Styling | Tailwind + shadcn/ui + design tokens |
| Database | Supabase (migrations 001-009) |
| AI (world gen + narration + combat) | claude-sonnet-4-5 |
| AI (RegionBible) | claude-haiku-4-5-20251001 |
| Payments | Stripe · Deploy: Vercel · Audio: Howler.js · State: Zustand |

| Genre | Primary | Currency | HP |
| --- | --- | --- | --- |
| Fantasy (fantasy) | #f59e0b amber | Gold | HP |
| Cyberpunk (cyber) | #22d3ee cyan | Credits | Integrity |
| Horror/Lovecraftian (horror) | #84cc16 acid green | None | HP + Sanity |
| Space Opera (space) | #a855f7 purple | Stellar Units | Hull Integrity |
| Post-Apocalyptic (apoc) | #ea580c rust | Caps | HP |

| Feature | Free | Adventurer ($6.99) | Legend ($14.99) |
| --- | --- | --- | --- |
| Genres | Fantasy | All 5 | All 5 + future |
| Save Slots | 1 | 3 | Unlimited |
| AI Actions/Day | 50 | Unlimited | Unlimited |
| Priority Speed | ❌ | ❌ | ✅ |

---

## Workflow

Claude.ai owns all CLAUDE.md updates. Round flow: Claude Code pushes → Tim reports commit + tests → Claude.ai updates CLAUDE.md → Tim verifies → next prompt.

**Protocols:** Origin/main baseline check (rule 76) as step 1 · Investigation-before-patching (V8.40). **`npx jest` (no pattern) = authoritative test count.**

**Authority:** Architecture → /docs/architecture-spec.md · Combat → /docs/combat-spec.md · Vision/scope → Game Vision · Strategic/sequencing → Trajectory Notes · Round details → git log + round-history table.
