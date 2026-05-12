# Project: Endless Worlds RPG — Master Context

**Version:** 8.47
**Status:** Day 21 Container + Loot COMPLETE (commit a56940f) — Day 22 Skills + Leveling NEXT
**Objective:** A text-based RPG that generates a unique world for every playthrough. Genre-agnostic, infinitely replayable, CRPG depth.

**References:** /docs/architecture-spec.md · /docs/combat-spec.md · /docs/css-containment-audit.md · /docs/mobile-viewport-audit.md · /docs/genre-reference.md

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
- **V8.47 — jest baseline = 393.** See rule 82.

---

## 📋 Strategic Trajectory Notes

### Future Feature Ideas (captured, not yet slotted)

**Encounter Avoidance / Stealth System (V8.41 capture):**
Roll player PER/AGI/stealth-skill against enemy detection DC. On SUCCESS: Avoid / Pre-emptive ability / Sneak attack / Environmental interaction / Engage normally. On FAIL: combat triggers normally.
*Dependencies:* Day 22 skills (stealth domain). *Slot:* Day 20.6 alongside Day 20.5. *Design risk:* Skyrim-Sneak model — must not punish combat-built characters.

**EPIC/LEGENDARY Loot Reveal Animation (V8.46 capture):**
When a RARE or LEGENDARY item is found, trigger a full-screen overlay: item portrait fades in with animated border glow, name and description appear. Destiny exotic drop energy.
*Slot:* Post-Day-22 polish round. *Design note:* Only fires for RARE+; COMMON/UNCOMMON get the standard loot strip reveal.

**Genre Expansion + Sub-Genre System (V8.46 capture):**
Full genre reference captured in `/docs/genre-reference.md`. Fantasy splits into Light / Classic / Dark as the confirmed example. All other genres get the same sub-genre treatment.
*Slot:* Dedicated Genre Session post-Day-25. *Impact:* Genre enum + all genre-keyed tables need updating.

**Merchant Trading Foundation (V8.46 design decision):**
Existing merchant system is narrator-only with zero engine-side transaction logic. Needs: persistent merchant inventory per NPC, buy/sell pricing, gold deduction enforced by engine, Trade UI updated to real prices.
*Slot:* After Day 21 loot infrastructure is in play. Dedicated round.

### V8.47 — Day 21 findings + jest baseline correction

**Jest baseline correction (IMPORTANT):** V8.45 reported 762 as "first accurate full-suite count." This was WRONG — the `.claude/worktrees/` subtree was being double-counted by jest. Day 21's investigation found and fixed this: `jest.config.ts` now has `testPathIgnorePatterns` + `modulePathIgnorePatterns` excluding `.claude/`. **True baseline = 393.** All counts between V8.45 and V8.47 were inflated. 393 is the authoritative count going forward.

**Investigation findings pre-patch (V8.40 protocol):**
- `CombatEnemyInstance` already carries `loot_table_id` + `is_boss` — perfect for SEARCH REMAINS lookup with no bestiary roundtrip.
- `handleVictory` previously auto-rolled loot and mutated `player.resources` + `player.inventory` inline — required full refactor to "XP-only + pending manifest."
- `RegionBible` route had no normalize step — added one for loot fields + container guarantee.

**Architecture delivered:**
- 5 genre `LootPool`s: `lib/game/loot-tables/{fantasy,cyberpunk,horror,space,apoc}.ts`
- `WorldBible.world_loot_items[]` (Layer 2) + `RegionBible.region_loot_items[]` + `boss_drop_item` (Layer 3)
- `lib/game/loot-resolver.ts` — pure, RNG-injectable, normal vs boss paths
- `lib/game/floor-loot.ts` — pure transitions (applySearchRemains, applyTake, applyTakeGold, applyTakeAll, buildFloorLootView, pickRegionLootItemsForNode, pickBossDropItemForNode)
- `hooks/useFloorLoot.ts` — thin React wrapper over pure transitions
- `components/game/FloorLootStrip.tsx` — between StoryFeed and NavigationBar; SEARCH REMAINS / item pills / gold pill / TAKE ALL; disabled at INVENTORY_CAP with warning
- `lib/game/currency.ts` — canonical currencyKeyFor / currencyLabelFor (horror = "marks")
- `lib/game/constants.ts` — INVENTORY_CAP = 20
- `MasterState.floor_loot?: FloorLootEntry[]` — persists across navigation, auto-prunes when emptied
- Container guarantee: both WorldBible and RegionBible routes promote one `is_interactable` object to `type:"container"` in every combat-eligible node
- `/game` route: 109 kB → 117 kB (+8 kB for Day 21 modules)

### V8.46 — Polish Round 4b results + genre doc

Mobile QA: 7/10 surfaces pass. D (combat panel) MAJOR deferred — Mobile Combat Layout round. F/H minor deferred.
Genre reference: `/docs/genre-reference.md` created covering all brainstormed genres with mechanics, loot, enemies, UI identity.

### V8.44 — Polish 4c: pure module extraction applied proactively

`chooseTierForNode()` extracted to `lib/game/map-tier.ts` proactively (rule 71 without waiting for a bug).

### V8.42 — Third recurrence: prompt-template hardcoded ID bug

Audit scope: (1) defensive overchecks in app code, (2) prompt-template hardcoded structural IDs, (3) CSS containment.

### V8.41 — Workflow + Combat UX Polish Queue

**Combat UX & Flow Polish Queue (post-Day-23):** Hit/miss differentiation · Miss feedback over portrait · Flee-fail → death pacing.

### V8.38 — Three strategic decisions LOCKED

**Multiplayer = PRE-LAUNCH.** Day 24. **Customization = PRE-LAUNCH** toward end. Day 25. **Day 22 skills = FOUNDATIONS NOW.**

### Sequence

1–5. ~~Polish 4a through Nav mini-cols~~ ✅
6. ~~Polish 4b (4fe27e3)~~ ✅
7. ~~Day 21 Container + Loot (a56940f)~~ ✅
8. **Day 22 — Skills + Leveling** ⏳ NEXT
9. Vertical slice playtest
10. Day 23 — Main Quest Thread
11. Merchant Trading Foundation round
12. Combat UX & Flow Polish round
13. Mobile Combat Layout round (deferred from 4b)
14. Day 24 — Multiplayer Foundation
15. Day 25 — Customization Layer
16. Genre Session — sub-genre expansion
17. Day 20.5 — Verbal Action (deferred)
18. Day 20.6 — Encounter Avoidance / Stealth (deferred)

### Open strategic questions

- External playtest timing (post-Day-22 or post-Day-23).
- Difficulty tuning — toggle vs world-tier scaling.
- Random travel encounters (combat-spec §3).
- NPC behavior dispatch (combat-spec §6.3).
- Map visual rework — dedicated session, deferred.
- Audit queue: defensive overchecks, prompt-template hardcoded IDs, integration test coverage.
- Genre Session scope and timing (post-Day-25 standalone vs bundled with Day 25).

---

## 🔄 Current Status (Read This First)

**Current Phase:** Day 21 complete (commit a56940f, 393/393 tests — see rule 82). Day 22 Skills + Leveling is next.
**Stack:** Next.js 14 / Tailwind / shadcn/ui / Supabase / Claude API / Stripe / Vercel · **Repo:** atomictim/endless-worlds-rpg

| Phase | Title | Status |
| --- | --- | --- |
| 1–18 | MVP through Systems Audit | ✅ Complete |
| 19A–19F | World Generation Architecture | ✅ Complete |
| Movement Track | Verified end-to-end | ✅ FROZEN |
| Combat Spec | /docs/combat-spec.md | ✅ Frozen |
| Combat era (Days 20–20.4.2) | Data + resolver + UI + narration + polish + hotfixes | ✅ Complete |
| Polish era (4a–4b + hotfixes) | Nav grouping/columns/dedup + map tier + display fixes + mobile QA | ✅ Complete |
| Day 21 (a56940f) | Container + Loot — 3-layer loot architecture, SEARCH REMAINS, FloorLootStrip, containers, loot resolver | ✅ Complete |
| **Day 22** | **Skills + Leveling — skill domain foundations, stat-of-your-choice XP, STAT_XP wiring** | ⏳ **NEXT** |
| Vertical slice playtest | Full game start → win condition | ⏳ Before Day 23 |
| Day 23 | Main Quest Thread | ⏳ Post-playtest |
| Merchant Trading Foundation | Persistent merchant inventory, buy/sell, engine-enforced gold deduction | ⏳ After Day 21 loot in place |
| Combat UX & Flow Polish | Hit/miss differentiation + miss float + flee-fail pacing | ⏳ Post-Day-23 |
| Mobile Combat Layout | Stacked portrait layout at narrow viewport (4b deferred) | ⏳ After Combat UX Polish |
| Day 24 | Multiplayer Foundation | ⏳ Pre-launch |
| Day 25 | Customization Layer | ⏳ Pre-launch toward end |
| Genre Session | Sub-genre expansion (see /docs/genre-reference.md) | ⏳ Post-Day-25 |
| Day 20.5 | Verbal Action System | ⏳ Deferred (Combat Alternatives) |
| Day 20.6 | Encounter Avoidance / Stealth | ⏳ Deferred (Combat Alternatives) |
| Map Visual Rework | Dedicated session | ⏳ Deferred |

**Active genres:** Fantasy, Cyberpunk, Horror/Lovecraftian, Space Opera, Post-Apocalyptic. Sub-genre expansion deferred to Genre Session.

### Day 21 (commit a56940f — 393/393 tests, /game 117 kB)

See V8.47 trajectory note above for full summary. Key facts for Claude Code reference:
- `MasterState.floor_loot?: FloorLootEntry[]` — new field, persists across navigation
- `INVENTORY_CAP = 20` in `lib/game/constants.ts`
- `currencyKeyFor(genre)` / `currencyLabelFor(genre)` in `lib/game/currency.ts`
- `LocationObject.type?: "container" | "fixture" | "lore" | "trigger"` — new optional field
- `ItemType` enum additions: VALUABLE, QUEST_ITEM (stub), STAT_XP
- `handleVictory` → XP-only + pending FloorLootEntry; no auto-loot

### Round history (compressed)

| Commit | Round | Rules |
| --- | --- | --- |
| a56940f | Day 21 — 3-layer loot, loot-resolver, FloorLootStrip, container flow, SEARCH REMAINS, currency.ts, constants.ts | 82-85 |
| ad82300 | WorldBible variety fix — remove biased named examples, uniqueness instruction | (rule 79 applied) |
| 4fe27e3 | Polish 4b — mobile audit + CodexModal close + ActionBar button sizing | — |
| 14252ac | Nav mini-cols — 2-row max, overflow wraps right, lone cards bottom-aligned | (rule 72 updated) |
| 198a757 | Polish 4c — column layout + nav dedup + map tier auto-switch expansion | 80-81 |
| e87b23a | 20.4.4 — settlement DEEPER card + story header display name + stitch guarantee | (80-81 defined) |
| 60501c8 | 20.4.3 — region expansion prompt template fix + splitConflatedRegionSettlement | 77-79 |
| 24ac19c | Polish 4a — nav grouping/tiers/cross-region BACK/map auto-switch/.ew-said/CSS audit | 72-76 |
| f17c221 | 20.4.2 — float CSS clip + stagger + sync to feed + codex modal + D&D roll format | 66-71 |
| c67f2c0 | 20.4.1 — float routing + inventory-Use + flee DC + defeat respawn fix | 62-65 |
| fc508f3 + 732e944 + bf3871e + 1215bb6 | 20.4 through 20.1 | 43-61 |
| abf73e6 + earlier | 20 Prompt 3 + foundation + pre-combat + 19A-19F | 1-42 |

### Architecture & system status

**Domain 1 (Engine — pure code):** Navigation + nav-cards (rules 72-81) + map-tier.ts + combat system (rules 24-71) + region expansion guard + loot system (rules 83-85): loot-resolver.ts · floor-loot.ts · loot-tables/ · FloorLootStrip · currency.ts · constants.ts.

**Domain 2 (Content Library — frozen):** WCD, WorldBible (+ world_loot_items[]), RegionBible (+ region_loot_items[] + boss_drop_item), NPCs, items, loot tables, bestiary, region enemies, starting equipment.

**AI during gameplay:** Arrival narration ✅ · Dialogue ✅ · Action narration ✅ · Combat narration ✅ · Container search ✅ (templated, zero LLM) · Verbal action ⏳ Day 20.5 · Stealth/avoidance ⏳ Day 20.6.

**Mobile readiness:** A/B/C/E/G/I/J surfaces PASS at 380px. D (combat panel) MAJOR deferred. F/H minor deferred.

### Known issues

**Merchant Trading Foundation (post-Day-21):** Existing narrator-only merchant system has no engine-side transaction logic. Dedicated round needed.

**Mobile Combat Layout — DEFERRED:** Combat panel breaks at 380px with 3+ enemies. Bundle with F/H minor touch target fixes.

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
65. Settlement-hub detection in step 7c-2 uses `is_settlement_node === true` predicate ONLY. Category fallback removed. (V8.39)
66. Floating damage emission lives INSIDE `projectCombatEventsToFeed` (useCombat), called AFTER pacing sleeps. CombatMode is a pure renderer for `floatingByActor`. (V8.40)
67. Multi-host floating damage uses `computeFloatStartDelay` pure helper. 300ms increments. `animation-fill-mode: both`. (V8.40)
68. Roll display format is D&D-style: `(d20: 17, +2 → 19 vs 12 | 1d6+2)` hits, `(d20: 1)` fumbles, `(d20: 20 | ...)` crits, `(1d8: 4 +4 = 8)` heals. (V8.40)
69. Codex is rendered as `CodexModal` overlay (z-50, ESC + backdrop + X close). Combat panel remains mounted underneath. (V8.40)
70. **CSS containment lesson:** `overflow-x/y: auto` on ancestors clips absolutely-positioned children. Use `overflow: visible` on containers hosting absolutely-positioned children extending outside the box. (V8.40)
71. **Integration tests required for routing helpers and lookup keys.** Unit tests against fake events can pass while real-data wiring is broken. (V8.40)
72. Nav cards group by movement direction: BACK / DEEPER / PEER / UNDISCOVERED. EXIT folds into BACK. Empty groups omitted. Pure-function `lib/game/nav-cards.ts` owns `buildCards` + `groupCardsByDirection`. NavigationBar renders each group as a row of 140px mini-columns (max 2 cards tall, `chunkArray(cards, 2)`), lone cards bottom-aligned (`justifyContent: flex-end`), group block auto-sizing. `.ew-nav-cols` handles mobile horizontal scroll. (V8.41 grouping · V8.44 column direction · V8.45 mini-col chunking)
73. Nav card tier color via `tierOfNode`. Region → `--hl-region` lavender · Settlement → `--hl-loc` sky-blue · Sub-location → `--hl-sublocation` mint · Dungeon → `--hl-dungeon` burnt-copper. Background stays neutral. (V8.41)
74. Cross-region BACK card consults `masterState.navigation_trail[-2]`. If previous node is a different region, BACK targets that region's settlement hub. **Intentional — BACK answers "how do I get back to where I came from?"** (V8.41)
75. WorldMap cross-region → Region tier (V8.41). Superseded for all arrivals by rule 81. (V8.41 → V8.44)
76. **Origin/main baseline check:** Claude Code MUST run `git fetch origin && git log origin/main --oneline -5` as step 1 of every prompt. (V8.41)
77. **RegionBible prompt template MUST distinguish settlement_id from region_id.** Use `settlementSlug = ${outline.id}_settlement`. Include explicit "REGION vs SETTLEMENT IDS" guidance block. (V8.42)
78. **Apply-regional-bible heal-on-apply:** `splitConflatedRegionSettlement(bible)` detects id collapse, renames settlement id, re-points sub-locations + NPCs + exits. Runs at step 0d. (V8.42)
79. **Prompt-template hardcoded structural IDs are a recurring bug class.** Audit `app/api/game/generate-*/route.ts` for `${outline.id}`, `${region.id}` etc. in id positions. (V8.42)
80. **Nav card dedup at region zone.** DEEPER isAtRegionZone branch checks `backCards[0]?.targetId`; suppresses DEEPER settlement card if it matches BACK destination. Cross-region: both emit. No trail: DEEPER suppressed. (V8.43 defined · V8.44 implemented)
81. **Map tier auto-switch fires on every node arrival.** `lib/game/map-tier.ts` `chooseTierForNode()`: region zone → tier 2, everything else → tier 1. WorldMap.tsx useEffect calls this on every arrival. (V8.43 defined · V8.44 implemented)
82. **jest true baseline = 393 (V8.47 correction).** V8.45 reported 762 due to stale `.claude/worktrees/` subtree being double-counted. Fixed in `jest.config.ts` via `testPathIgnorePatterns` + `modulePathIgnorePatterns` excluding `.claude/`. 393 is the authoritative full-suite count going forward. The `npx jest` (no pattern) protocol remains — just the expected number is now 393, not 762. (V8.47)
83. **Loot never auto-credits.** `handleVictory` pushes XP-only; all item/gold drops go to `MasterState.floor_loot[]` as `FloorLootEntry` (pending until SEARCH REMAINS resolves it). Player must explicitly SEARCH REMAINS (post-combat) or TAKE / TAKE ALL from FloorLootStrip. Gold goes to `player.resources` via `on_take_gold` only. Enables no-gold and no-loot playthroughs by design. (V8.47)
84. **Container search is engine-resolved, zero LLM calls.** `resolveInteract` detects `LocationObject.type === "container"` → calls `resolveLoot()` → pushes `FloorLootEntry` → templated story beat via `getSearchNarrative()`. Non-container `is_interactable` objects return `INTERACT_NON_CONTAINER` with object-type-specific empty template from `lib/game/container-templates.ts`. Already-searched containers return `CONTAINER_ALREADY_SEARCHED`. Engine guarantees ≥1 container per combat-eligible node at WorldBible/RegionBible apply time. (V8.47)
85. **Currency and inventory cap are canonical constants.** Currency key/label: `lib/game/currency.ts` → `currencyKeyFor(genre)` / `currencyLabelFor(genre)`. Horror genre currency = "marks". Inventory cap: `lib/game/constants.ts` → `INVENTORY_CAP = 20`. Never hardcode these values elsewhere. (V8.47)

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
| Sub-location / Landmark | #94d8b8 mint | --hl-sublocation / --hl-landmark |
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
| Horror/Lovecraftian (horror) | #84cc16 acid green | Marks | HP + Sanity |
| Space Opera (space) | #a855f7 purple | Stellar Units | Hull Integrity |
| Post-Apocalyptic (apoc) | #ea580c rust | Caps | HP |

*Sub-genre expansion deferred to Genre Session post-Day-25. See /docs/genre-reference.md.*

| Feature | Free | Adventurer ($6.99) | Legend ($14.99) |
| --- | --- | --- | --- |
| Genres | Fantasy | All 5 | All 5 + future |
| Save Slots | 1 | 3 | Unlimited |
| AI Actions/Day | 50 | Unlimited | Unlimited |
| Priority Speed | ❌ | ❌ | ✅ |

---

## Workflow

Claude.ai owns all CLAUDE.md updates. Round flow: Claude Code pushes → Tim reports commit + tests → Claude.ai updates CLAUDE.md → Tim verifies → next prompt.

**Protocols:** Origin/main baseline check (rule 76) as step 1 · Investigation-before-patching (V8.40). **`npx jest` (no pattern) = authoritative full-suite test count. True baseline = 393 (rule 82).**

**Authority:** Architecture → /docs/architecture-spec.md · Combat → /docs/combat-spec.md · Vision/scope → Game Vision · Strategic/sequencing → Trajectory Notes · Round details → git log + round-history table.
