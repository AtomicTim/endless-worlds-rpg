# Project: Endless Worlds RPG — Master Context

**Version:** 8.59
**Status:** Day 23B Part 1 COMPLETE (commit d06db6f, 510/510) — verify generation then dispatch Part 2
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
- **V8.59 — jest baseline = 510.** See rule 91.

---

## 📋 Strategic Trajectory Notes

> **Full trajectory notes, round history, future feature ideas, and open questions live in `/docs/project-log.md`.** Quest system design spec lives in `/docs/quest-system-spec.md`. This section is a summary only.

### Sequence

1–11. ~~Polish through vertical slice playtest~~ ✅
12a–12c. ~~Day 23A — World Structure, dungeons, location variety (all parts + fixes)~~ ✅
13a. ~~Day 23B Part 1 — Quest data foundation (d06db6f)~~ ✅
13b. **Day 23B Part 2 — Quest discovery + world intro display** ⏳ NEXT (after generation verified)
14. Day 23C — Morrowind Journal UI
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
- Nav card peer disappearance after dungeon return — share world_graph.nodes dump if it reproduces.
- Nav card color differentiation for node types — deferred.

---

## 🔄 Current Status (Read This First)

**Current Phase:** Day 23B pt1 complete (d06db6f, 510/510). Generate a world and confirm `main_quest: {archetype}, 4 breadcrumbs` in server console before dispatching Part 2.
**Stack:** Next.js 14 / Tailwind / shadcn/ui / Supabase / Claude API / Stripe / Vercel · **Repo:** AtomicTim/endless-worlds-rpg

| Phase | Title | Status |
| --- | --- | --- |
| 1–11 | MVP through vertical slice playtest | ✅ Complete |
| Gen pipeline + Day 23A (all parts) | World structure, dungeons, location variety, UX fixes | ✅ Complete |
| Dungeon UX fixes (54c5895) | Nav cards, narrator context, key unlock text path, direct-heal | ✅ Complete |
| Day 23B pt 1 (d06db6f) | Quest types, WCD archetype, WorldBible quest schema, world intro template, RegionBible breadcrumb context | ✅ Complete |
| **Day 23B pt 2** | **Quest discovery triggers, world intro display, Act 1 breadcrumb wiring** | ⏳ **NEXT** |
| Day 23C | Morrowind journal UI | ⏳ |
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

**Nav card peer disappearance — UNRESOLVED:** buildCards confirmed correct. Likely malformed graph node.

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
42. New game preamble: `recent_messages.length === 0` triggers "Your adventure begins. What will you do first?" unless `metadata.world_intro` is set. World intro display wired in Day 23B pt2. (V8.34 + V8.59)
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
53. Use Item is templated only. Format: `"You use <item>. Restored N HP."` Out-of-combat healing consumables direct-dispatch via `handleDirectConsumeItem`. (V8.37 + V8.58)
54. Crit events render as TWO lines: templated banner first (instant), then LLM crit prose. (V8.37)
55. `planEventSuppression(events)` pre-scans event batches. When victory present: kill events dropped, last crit before victory has prose suppressed. (V8.37)
56. Resolution events render as two-line centered block: banner + ≤20-word LLM prose. max_tokens 120. (V8.37)
57. CombatEvent.rolls field populates on every event with damage/d20/heal outcome. (V8.38)
58. Inline roll suffix renders subtle parenthetical breakdown via `{primary, rolls}` return shape from templates. (V8.38)
59. Floating damage numbers fire on hit/crit/heal events ONLY. (V8.38 + V8.39)
60. Defeat teleport — `last_settlement_hub_id` initialized at game spawn. handleDefeat uses 3-tier fallback chain. (V8.38)
61. Resolution events (defeat / flee_success) carry destination payload. Victory does NOT get destination line. (V8.38)
62. `rolls.d20` stores RAW d20 value (1-20). `target_dc` wrapped in `Math.round()` for display. (V8.39)
63. Inventory Use button during combat routes through `submitCombatAction`. Equip/Unequip/Read/Search/Drop buttons HIDDEN during combat. INTERIM until Day 20.5. (V8.39)
64. Floating damage entry routing uses explicit `switch(event.type)`. (V8.39)
65. Settlement-hub detection in step 7c-2 uses `is_settlement_node === true` predicate ONLY. (V8.39)
66. Floating damage emission lives INSIDE `projectCombatEventsToFeed` (useCombat), called AFTER pacing sleeps. (V8.40)
67. Multi-host floating damage uses `computeFloatStartDelay` pure helper. 300ms increments. (V8.40)
68. Roll display format is D&D-style: `(d20: 17, +2 → 19 vs 12 | 1d6+2)` hits, `(d20: 1)` fumbles, `(d20: 20 | ...)` crits, `(1d8: 4 +4 = 8)` heals. (V8.40)
69. Codex is rendered as `CodexModal` overlay (z-50, ESC + backdrop + X close). (V8.40)
70. **CSS containment lesson:** `overflow-x/y: auto` clips absolutely-positioned children. Use `overflow: visible` on containers hosting them. (V8.40)
71. **Integration tests required for routing helpers and lookup keys.** (V8.40)
72. Nav cards group by movement direction: BACK / DEEPER / PEER / UNDISCOVERED. Pure-function `lib/game/nav-cards.ts` owns `buildCards` + `groupCardsByDirection`. 140px mini-columns (max 2 tall). (V8.41–V8.45)
73. Nav card tier color via `tierOfNode`. Region → lavender · Settlement → sky-blue · Sub-location → mint · Dungeon → burnt-copper. (V8.41)
74. Cross-region BACK targets previous region's settlement hub. (V8.41)
75. WorldMap cross-region → Region tier. Superseded by rule 81. (V8.41 → V8.44)
76. **Origin/main baseline check:** Claude Code MUST run `git fetch origin && git log origin/main --oneline -5` as step 1. (V8.41)
77. **RegionBible prompt template MUST distinguish settlement_id from region_id.** (V8.42)
78. **Apply-regional-bible heal-on-apply:** `splitConflatedRegionSettlement(bible)` runs at step 0d. (V8.42)
79. **Prompt-template hardcoded structural IDs are a recurring bug class.** (V8.42)
80. **Nav card dedup at region zone.** DEEPER suppresses settlement card if it matches BACK destination. (V8.43–V8.44)
81. **Map tier auto-switch fires on every node arrival.** Region zone → tier 2, everything else → tier 1. (V8.43–V8.44)
82. **jest baseline history.** 393→452→454→484→491→499→**510** (+11 quest-threads tests). See rule 91. (V8.47–V8.59)
83. **Loot never auto-credits.** All drops go to `MasterState.floor_loot[]`. (V8.47)
84. **Container search is engine-resolved, zero LLM calls.** (V8.47)
85. **Currency and inventory cap are canonical constants.** `INVENTORY_CAP = 20`. (V8.47)
86. **Revisit suppression.** `discovered === true` → "You return to {name}." only. (V8.48)
87. **Object highlight popup context-aware labels.** CONTAINER → "Search". ITEM POI → "Examine". (V8.48)
88. **`resolveUseItem` resolves heal by effect, not by id.** (V8.49)
89. **Archetype system in `lib/game/archetypes.ts`.** 25 classes. STAT_BASE=2, primary +2, secondary +1. (V8.50)
90. **Level-up flow is post-combat, player-driven.** LevelUpModal + 5-button picker. (V8.50)
91. **jest baseline = 510 (V8.59).** Day 23B pt1 added 11 quest-threads tests (499→510). 510 is the authoritative count going forward. (V8.59)
92. **Ability modifier: `Math.floor((score - 2) / 2)`.** Both `abilityMod` and `getAttributeModifier` MUST match. (V8.51)
93. **Enemy stat budgets: tier-1 agi_mod ≤1, hp min ≤8.** Bible prompts include ENEMY STAT BUDGET block. (V8.51)
94. **RegionBibleCache in-flight dedup via promise map.** (V8.53)
95. **Post-apply pregeneration burst.** Wizard fires all adjacent_regions immediately. WorldBible NOT split. (V8.53)
96. **Dungeon data layer in two pure modules.** `dungeon-validation.ts` + `dungeon-navigation.ts`. (V8.54)
97. **LLM generation prompt skeleton anchors output.** Update skeleton + enforcement + logging together. (V8.55)
98. **Nav card type label via `nodeTypeLabel()`.** settlement_hub→SETTLEMENT · outpost→OUTPOST · wilderness→WILDERNESS · dungeon→DUNGEON · landmark→LANDMARK · abandoned_settlement→RUINS. (V8.56)
99. **Dungeon runtime in `hooks/useDungeonRuntime.ts`.** Separate hook. initDungeonState on arrival; re-fire guarded by useRef; "The dungeon falls silent." on boss clear. (V8.57)
100. **Room navigation semantics.** First-visit encounter; revisit suppresses description + encounter. Zero LLM cost. BACK from entrance → region zone; BACK from non-entrance → entrance. dungeon_state persists. (V8.57)
101. **DungeonLockPopover.** Locked boss card → popover: hint + [USE key] + [FORCE STR ≥ 6] + Close. (V8.57)
102. **Dungeon narrator context.** Inside dungeon: CURRENT ROOM injected, inventory stripped, connected locations = adjacent rooms only. Key items: NO USE button — text path (DUNGEON_KEY_USE) or nav card popover only. Out-of-combat healing: direct-dispatch. (V8.58)
103. **Quest schema types in `types/game.ts`. (V8.59)** QuestArchetype (6 values: ancient_awakening, power_vacuum, corruption, forbidden_knowledge, sacrifice, the_return), FinaleType, QuestStatus, QuestFaction, QuestBreadcrumb, QuestResolution, MainQuest, SideQuest, QuestEntry, QuestThreads. MasterState.quest_threads? and Metadata.world_intro? added. LocationObject + NPCDefinition gained quest_breadcrumb_id?. Legacy MainQuest fields replaced. WorldBible.main_quest now includes world_intro_template.
104. **WCD generates main quest seed; WorldBible expands it. (V8.59)** WCD: archetype (1 of 6), threat_description, 2-3 factions (defenders/exploiters/deniers), finale_type. WorldBible emits: title, 4 breadcrumbs (act 1 fixed, acts 2/3 floating, climax fixed), 2 resolutions, world_intro_template. apply-world-bible calls initializeQuestThreads(bible), logs: `[apply-world-bible] main_quest: {archetype}, {N} breadcrumbs, finale: {finale_type}, factions: {N}, intro length: {N}`.
105. **World intro template + RegionBible breadcrumb seeding. (V8.59)** world_intro_template: 3-part second-person (world now / who you are / opening moment). Uses {name}/{class} placeholders. resolveWorldIntro stores resolved text in metadata.world_intro. Display deferred to 23B pt2. RegionBible receives first unanchored act-2/3 breadcrumb; apply-regional-bible stamps anchor_location_id on match.

---

## Narrator Prompt Order

DIALOGUE: WCD → HARD RULES → RESPONDING CHARACTER → CLOSED CONTEXT → TIER 1 OBJECTS → WORLD ASSETS → SCENE → VERBOSITY
non-DIALOGUE: WCD → HARD RULES → NPCS PRESENT → TIER 1 OBJECTS → CONNECTED LOCATIONS → WORLD ASSETS → SCENE → VERBOSITY
DUNGEON ROOM: WCD → HARD RULES → CURRENT ROOM → OBJECTS IN ROOM → ADJACENT ROOMS → SCENE → VERBOSITY (no inventory, no settlement)
COMBAT: GENRE TONE PRIMER → COMBAT EVENT → HARD RULES → length hint

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

**Update routing:** New rules or status changes → CLAUDE.md. Trajectory notes, round history, future features → `/docs/project-log.md`. Quest system design → `/docs/quest-system-spec.md`.

**Protocols:** Origin/main baseline check (rule 76) as step 1 · Investigation-before-patching (V8.40). **`npx jest` = authoritative full-suite test count. Baseline = 510 (rule 91).**

**Note:** Remote URL updated to `https://github.com/AtomicTim/endless-worlds-rpg.git` (capitalized). Run `git remote set-url origin https://github.com/AtomicTim/endless-worlds-rpg.git` to silence redirect warnings.

**Authority:** Architecture → /docs/architecture-spec.md · Combat → /docs/combat-spec.md · Quest system → /docs/quest-system-spec.md · Vision/scope → Game Vision · Strategic/sequencing → /docs/project-log.md.
