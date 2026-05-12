# Project: Endless Worlds RPG — Master Context

**Version:** 8.56
**Status:** Nav card fix COMPLETE (commit e29a3c0, 491/491) — Day 23A Part 2 NEXT
**Objective:** A text-based RPG that generates a unique world for every playthrough. Genre-agnostic, infinitely replayable, CRPG depth.

**References:** /docs/architecture-spec.md · /docs/combat-spec.md · /docs/quest-system-spec.md · /docs/genre-reference.md · /docs/project-log.md

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
- **V8.56 — jest baseline = 491.** See rule 91.

---

## 📋 Strategic Trajectory Notes

> **Full trajectory notes, round history, future feature ideas, and open questions live in `/docs/project-log.md`.** Quest system design spec lives in `/docs/quest-system-spec.md`. This section is a summary only.

### Sequence

1–11. ~~Polish through vertical slice playtest~~ ✅
12a. ~~Generation Pipeline Polish (43cb43f)~~ ✅
12b. ~~Day 23A Part 1 — Data Foundation (7424776)~~ ✅
12b.5. ~~Day 23A Part 1.5 — Schema Fix (e6d5c29)~~ ✅
12b.6. ~~Nav card fix — nodeTypeLabel, peer regression tests (e29a3c0)~~ ✅
12c. **Day 23A Part 2 — Runtime + UI** ⏳ NEXT
13. Day 23B — Quest Schema + Data Structures
14. Day 23C — Quest Discovery + Journal UI
15. Day 23D — Side Quest Generation
15a. Day 23.5 — Character Creation Rework
16. Merchant Trading Foundation round
17. Combat UX & Flow Polish round
18. Mobile Combat Layout round
19. Day 24 — Multiplayer Foundation
20. Day 25 — Customization Layer
21. Genre Session — sub-genre expansion
22. Day 20.5 — Verbal Action (deferred)
23. Day 20.6 — Encounter Avoidance / Stealth (deferred)

### Key open questions

- XP threshold tuning — revisit after more playtest data.
- Death stash / recovery mechanic — design decision needed (see project-log.md).
- Character creation rework — design questions in project-log.md Day 23.5 section.
- Nav card disappearance after dungeon visit — buildCards confirmed clean; likely malformed graph node. If it persists post-Part-2, share master_state.world_graph.nodes dump.
- Nav card color differentiation for node types — deferred discussion (all non-dungeon region_locations still burnt-copper for now).

---

## 🔄 Current Status (Read This First)

**Current Phase:** Nav card fix complete (e29a3c0, 491/491). Day 23A Part 2 runtime + UI is next.
**Stack:** Next.js 14 / Tailwind / shadcn/ui / Supabase / Claude API / Stripe / Vercel · **Repo:** atomictim/endless-worlds-rpg

| Phase | Title | Status |
| --- | --- | --- |
| 1–11 | MVP through vertical slice playtest | ✅ Complete |
| Gen pipeline (43cb43f) | RegionBible dedup, post-apply burst, WB/RB prompt trim | ✅ Complete |
| Day 23A pt 1 (7424776) | Types, prompts, apply routes, pure helper libs, 30 tests | ✅ Complete |
| Day 23A pt 1.5 (e6d5c29) | Schema fix: skeleton + enforcement + diagnostic logging | ✅ Complete |
| Nav card fix (e29a3c0) | nodeTypeLabel helper, typeLabel fallback chain, peer regression tests | ✅ Complete |
| **Day 23A pt 2** | **useGameLoop dungeon entry/nav, NavigationBar room cards, lock UI, 3-tier breadcrumb** | ⏳ **NEXT** |
| Day 23B | Quest schema + data structures + world intro template | ⏳ |
| Day 23C | Quest discovery + Morrowind journal UI | ⏳ |
| Day 23D | Side quest generation | ⏳ |
| Day 23.5 | Character creation rework | ⏳ |
| Merchant Trading Foundation | Persistent merchant inventory, buy/sell | ⏳ |
| Combat UX & Flow Polish | HP timing + hit/miss + flee-fail + death summary/stash | ⏳ Post-Day-23 |
| Mobile Combat Layout | Stacked portrait layout at narrow viewport | ⏳ |
| Day 24 | Multiplayer Foundation | ⏳ Pre-launch |
| Day 25 | Customization Layer | ⏳ Pre-launch toward end |
| Genre Session | Sub-genre expansion | ⏳ Post-Day-25 |
| Skills System / Verbal Action / Stealth | Deferred systems | ⏳ Deferred |

**Active genres:** Fantasy, Cyberpunk, Horror/Lovecraftian, Space Opera, Post-Apocalyptic. 5 classes per genre (25 total).

### Known issues

**HP bar timing — DEFERRED:** Bundled with Combat UX Polish.

**No equip/unequip during combat — INTENTIONAL (rule 63):** Day 20.5 scope item.

**Nav card peer disappearance after dungeon return — UNRESOLVED:** buildCards confirmed correct via 3 regression tests. Likely malformed graph node flags (is_expandable: true or wrong zone_id on dungeon node). If it reproduces post-Part-2, share master_state.world_graph.nodes for the affected region to pinpoint.

**Nav card colors for non-dungeon region_locations — DEFERRED:** All non-dungeon node types still use burnt-copper. Color differentiation discussion pending.

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
42. New game preamble: `recent_messages.length === 0` triggers "Your adventure begins. What will you do first?" (V8.34) — replaced by world opening intro in Day 23B.
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
63. Inventory Use button during combat routes through `submitCombatAction`. Equip/Unequip/Read/Search/Drop buttons HIDDEN during combat. INTERIM until Day 20.5. (V8.39)
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
82. **jest baseline history.** Original V8.45 count of 762 inflated by worktrees double-counting; corrected to 393. Day 22 +59 → 452. Combat rebalance +2 → 454. Day 23A pt 1 +30 → 484. Nav card fix +7 → **491**. See rule 91. (V8.47–V8.56)
83. **Loot never auto-credits.** `handleVictory` pushes XP-only; all drops go to `MasterState.floor_loot[]`. Player must explicitly SEARCH REMAINS or TAKE / TAKE ALL. (V8.47)
84. **Container search is engine-resolved, zero LLM calls.** `resolveInteract` detects `type === "container"` → `resolveLoot()` → `FloorLootEntry` → templated beat. Engine guarantees ≥1 container per combat-eligible node. (V8.47)
85. **Currency and inventory cap are canonical constants.** `lib/game/currency.ts` · `lib/game/constants.ts` → `INVENTORY_CAP = 20`. Never hardcode. (V8.47)
86. **Revisit suppression.** On ARRIVING at `discovered === true`: emit "You return to {name}." only. Spawn settlement starts `discovered: true`. (V8.48)
87. **Object highlight popup uses context-aware action labels.** CONTAINER → "Search". ITEM POI → "Examine". Navigation-like labels → Close only. "Pick up" NEVER appears for LocationObject interactions. (V8.48)
88. **`resolveUseItem` resolves heal by effect, not by id.** (1) `item_effect?.heal` finite positive → flat heal. (2) `BASIC_HEALTH_POTION_ID` → 1d8+4. (3) Otherwise → no-op. (V8.49)
89. **Archetype system in `lib/game/archetypes.ts`.** 25 classes. `buildStartingAttributes(background)` sets stats: STAT_BASE=2, primary +2, secondary +1. (V8.50)
90. **Level-up flow is post-combat, player-driven.** LevelUpModal opens after combat slice clears. Auto-gains + 5-button free stat picker. STAT_XP mid-combat auto-applies to archetype primary. (V8.50)
91. **jest baseline = 491 (V8.56).** Nav card fix added 7 tests (484→491). 491 is the authoritative count going forward. (V8.50 + V8.51 + V8.54 + V8.56)
92. **Ability modifier formula calibrated for 2-10 stat range.** Both `abilityMod` and `getAttributeModifier` use `Math.floor((score - 2) / 2)`. These MUST always match. CharacterSheet pip bar uses `value/2` (min 1). (V8.51)
93. **Enemy stat budgets enforced at two layers.** Static bestiaries: tier-1 agi_mod ≤1, hp min ≤8. Bible prompts: ENEMY STAT BUDGET block with NEVER constraints. (V8.51)
94. **RegionBibleCache in-flight dedup via promise map.** `inFlight` is `Map<string, Promise<RegionBible | null>>`. `awaitRegionalBible` resolves: (1) cache hit; (2) await in-flight promise; (3) null → live fetch. (V8.53)
95. **Post-apply pregeneration burst.** After `apply-world-bible` succeeds, wizard fires `pregenerateRegionalBible()` for all adjacent_regions (fire-and-forget). WorldBible NOT split — quest coherence requires single creative act. (V8.53)
96. **Dungeon data layer in two pure modules.** `lib/game/dungeon-validation.ts` wired into both apply routes. `lib/game/dungeon-navigation.ts`: 14 pure functions for all dungeon runtime + UI. (V8.54)
97. **LLM generation prompt skeleton anchors output count and structure.** Instructions alone cannot override the skeleton. When adding required fields or changing expected counts: (1) update skeleton, (2) add enforcement block, (3) add diagnostic logging. Skeleton is ground truth. (V8.55)
98. **Nav card type label derives from `node_type` via `nodeTypeLabel()`.** NODE_TYPE_LABEL map: settlement_hub→SETTLEMENT, outpost→OUTPOST, wilderness→WILDERNESS, dungeon→DUNGEON, landmark→LANDMARK, abandoned_settlement→RUINS. `typeLabel()` fallback chain: REGION (self-zoned expandable) → nodeTypeLabel(node_type) → SETTLEMENT (is_settlement_node, no node_type) → category.toUpperCase(). Nav card peer disappearance after dungeon return confirmed NOT in buildCards (3 regression tests added as guard). If bug persists, share master_state.world_graph.nodes for affected region — likely malformed is_expandable or zone_id on the dungeon node. (V8.56)

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
| NPC quoted speech | #f0c060 italic weight 600 | --hl-said |
| Player actions (out-of-combat) | #7ab8c8 teal-blue 12px mono italic | — |
| Item highlights | #e8c547 yellow | --hl-item |
| Region highlights | #c4b5fd lavender | --hl-region |
| Location highlights | #7dd3fc sky-blue | --hl-loc |
| Sub-location / Landmark | #94d8b8 mint | --hl-sublocation / --hl-landmark |
| Dungeon | #b45309 burnt-copper | --hl-dungeon |
| NPC highlights | var(--accent) orange | — |
| Level-up beat | --hl-pass green (centered) | — |
| Combat routine player/enemy | #7ab8c8 teal / #e87c6d warm red | --combat-player / --combat-enemy |
| Combat crits | #3b82a8 deeper blue / #c0392b blood red BOLD | --combat-player-crit / --combat-enemy-crit |
| Combat outcomes | #7dbb8e victory / #a93226 defeat / #a8a29c flee | — |
| Encounter banner | #f4a07a light coral | --combat-encounter-banner |
| Roll detail suffix | 10px dim mono 0.6 opacity (D&D format) | --combat-roll-detail |
| Floating damage | 28px (36px crit) mono bold, 1100ms fade, staggered | — |
| Resolution destination | 12px italic serif 0.75 opacity | --combat-resolution-destination |

---

## Tech Stack · Classes · Monetization

| Layer | Tool |
| --- | --- |
| Frontend | Next.js 14 (App Router) |
| Styling | Tailwind + shadcn/ui + design tokens |
| Database | Supabase (migrations 001-009) |
| AI (world gen + narration + combat) | claude-sonnet-4-5 |
| AI (RegionBible) | claude-haiku-4-5-20251001 |
| Payments | Stripe · Deploy: Vercel · Audio: Howler.js · State: Zustand |

| Genre | Primary Color | Currency | HP | Classes (5) |
| --- | --- | --- | --- | --- |
| Fantasy | #f59e0b amber | Gold | HP | Knight · Rogue · Mage · Ranger · Herald |
| Cyberpunk | #22d3ee cyan | Credits | Integrity | Netrunner · Fixer · Street Samurai · Enforcer · Ghost |
| Horror | #84cc16 acid green | Marks | HP + Sanity | Investigator · Cultist · Survivor · Phantom · Medium |
| Space Opera | #a855f7 purple | Stellar Units | Hull Integrity | Commander · Pilot · Engineer · Marine · Recon |
| Post-Apoc | #ea580c rust | Caps | HP | Scavenger · Raider · Medic · Runner · Demagogue |

*Sub-genre expansion deferred to Genre Session post-Day-25.*

| Feature | Free | Adventurer ($6.99) | Legend ($14.99) |
| --- | --- | --- | --- |
| Genres | Fantasy | All 5 | All 5 + future |
| Save Slots | 1 | 3 | Unlimited |
| AI Actions/Day | 50 | Unlimited | Unlimited |
| Priority Speed | ❌ | ❌ | ✅ |

---

## Workflow

Claude.ai owns all CLAUDE.md updates. Round flow: Claude Code pushes → Tim reports commit + tests → Claude.ai updates docs → Tim verifies → next prompt.

**Update routing:** New rules or status changes → CLAUDE.md. Trajectory notes, round history, future features, design captures → `/docs/project-log.md`. Quest system design → `/docs/quest-system-spec.md`.

**Protocols:** Origin/main baseline check (rule 76) as step 1 · Investigation-before-patching (V8.40). **`npx jest` (no pattern) = authoritative full-suite test count. Baseline = 491 (rule 91).**

**Authority:** Architecture → /docs/architecture-spec.md · Combat → /docs/combat-spec.md · Quest system → /docs/quest-system-spec.md · Vision/scope → Game Vision · Strategic/sequencing → /docs/project-log.md.
