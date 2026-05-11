# Project: Endless Worlds RPG — Master Context

**Version:** 8.42
**Status:** Day 20.4.3 Region Expansion Hotfix COMPLETE (commit 60501c8) — Polish Round 4c (nav columns) NEXT
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
- **Not a long-term single-character commitment.** Replayability comes from NEW playthroughs.
- **Not a tabletop replacement.** Complements physical D&D for when you don't have DM/time/table.
- **Not a hardcore strategy game.** Dramatic narrative beats with mechanical weight, not min-maxing.

### Competitive positioning

> **"Baldur's Gate depth without Baldur's Gate overhead. D&D feel without needing a DM."**

The market gap: there is no easy, fast, accessible way to have a D&D-style adventure on a phone with a friend. Existing options force tradeoffs (real D&D needs DM/prep/table; CRPGs are desktop and long; CYOA apps lack mechanics; AI Dungeon clones lack structure). This game wins by being structured-but-light, AI-narrated-but-mechanically-grounded, mobile-first, multiplayer-aware, replayable by design.

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

**Senior Engineering / Tech Direction:** Claude.ai. Translates vision into architecture, flags scope/risk/feasibility, suggests alternatives, recommends sequencing. Has explicit license to push back on premature/risky/scope-drifting/critical-path-skipping decisions. Defers to creative-director call on vision.

**Implementation:** Claude Code (local Sonnet agent).

**Decision flow:** Tim describes → Claude.ai assesses → Tim decides → Claude.ai writes prompt → Claude Code implements → Tim verifies → Claude.ai updates CLAUDE.md.

**Per-prompt protocols (cumulative):**
- **V8.40 — Investigation-before-patching.** When prompt has a root-cause hypothesis, Claude Code validates/invalidates BEFORE patching. (V8.40 proved value: CSS containment vs hypothesized field-name drift. V8.42 proved value: prompt-template hardcoded id vs hypothesized apply-step bug.)
- **V8.41 — Origin/main baseline check.** Step 1 of every prompt: `git fetch origin && git log origin/main --oneline -5`. Verify local matches origin HEAD.

---

## 📋 Strategic Trajectory Notes

Living section. Captures meta-discussions about project direction, sequencing, recommended pivots, architectural debates. New Claude sessions read this for current strategic context.

### Future Feature Ideas (captured, not yet slotted)

Design ideas captured during development that don't fit the current sequence. Items here are NOT in the locked sequence — they need slot assignment when their dependencies land.

**Encounter Avoidance / Stealth System (V8.41 capture):**

When a random encounter would trigger, the engine could roll player PER (and/or AGI, and/or future stealth skill from Day 22) against an enemy detection DC. On SUCCESS, pre-combat options menu:
- Avoid — continue past the enemy without combat
- Pre-emptive ability — cast spell, throw item, environmental trick before combat begins
- Sneak attack — combat triggers with first-strike advantage / surprise damage
- Environmental interaction — collapse rubble, light a fire, alter terrain
- Engage normally — player chooses to fight from awareness

On FAIL, combat triggers normally per V8.32 pipeline.

*Dependencies:* Day 22 skills (stealth domain), combat-spec §3 random-encounter pipeline, PER/AGI (exists).
*Strategic fit:* Sits alongside Day 20.5 Verbal Action as "Combat Alternatives." Different pipeline stages — verbal affects combat-in-progress; stealth affects combat-pre-trigger.
*Vision alignment:* Supports exploration + speedrun playstyles. Multi-style is design principle #3.
*Tentative slot:* Day 20.6, post-Day-25. Or fold into combat-spec §3 refinement.
*Open questions:* DC scaling (per-enemy/region/tier?). Boss/ambush immunity? XP for avoidance? Surprise round on fail?
*Design risk to address at slot time:* Must not punish combat-built characters — even low-PER should sometimes succeed (Skyrim-Sneak model: anyone can use it, specialists do it better).

### V8.42 — The bug pattern recurred a THIRD time: prompt-template hardcoded IDs

Day 20.4.3 found the third instance of the same root-cause pattern:
- V8.39: WorldBible prompt hardcoded `starting_region.type = "settlement_hub"` → category-fallback bug in step 7c-2.
- V8.40: enemy-row container had `overflowX: auto` → silent clip of floating numbers.
- V8.42: RegionBible prompt hardcoded `locations[0].id = "${outline.id}"` → region/settlement ID collision in apply-regional-bible.

**The pattern:** Hardcoded values in generation prompts or non-canonical CSS / data fields create structural collisions that surface much later as cascade UI bugs.

**Why the V8.39 audit missed V8.42:** That audit was scoped to defensive overchecks in application code (`category === X` fallbacks alongside boolean fields). The V8.42 bug was in the GENERATION prompt itself — a different surface. The audit needs broader scope.

**Expanded audit scope (for whenever this gets prioritized):**
1. Application-code defensive overchecks (V8.39 original) — `category === X` / `type === X` fallbacks alongside canonical fields.
2. Prompt-template hardcoded structural IDs (V8.42 NEW) — any place a generation prompt hardcodes an id/type/category that should be distinct. Sweep all `app/api/game/generate-*/route.ts` for template literals embedding `${outline.id}`, `${region.id}`, etc. in id positions where collision is possible.
3. CSS containment chain (V8.40) — `/docs/css-containment-audit.md` covers this, 0 active risks, 5 future candidates.

**Mitigation in place (V8.42):** Claude Code's fix added TWO layers — corrected the prompt template AND added `splitConflatedRegionSettlement` heal-on-apply guard for cached/legacy bibles. This pattern (template fix + apply-step safety net) is now the model for prompt-template bugs: fix forward AND heal legacy data. Codified in rules 77-78.

### V8.41 — Workflow lessons + Combat UX Polish Queue

**Baseline drift:** Polish Round 4a hit a 28-commit drift between Claude Code's local branch (V8.28) and origin/main (V8.40). Caught mid-round, rebased clean. Mitigation: origin baseline check as step 1 of every prompt (rule 76).

**Test counts in this doc are reference values, not authoritative.** Source of truth = jest output at last commit. Re-baselines can produce intermediate states that throw off the running count.

**Combat UX & Flow Polish Queue (post-Day-23):**
1. Hit vs miss visual differentiation in story feed (different glyph + dimmer color for misses).
2. Miss feedback over portrait (small white "0" or "—" floating number).
3. Combat flow pacing for flee-fail → death (explicit pause + visual marker).

### V8.40 + V8.39 — Bug lessons (now generalized into V8.42 pattern note above)

Original details preserved in foundational rules 65 (V8.39 defensive overcheck), 70 (V8.40 CSS containment), 71 (V8.40 integration testing). The V8.42 trajectory note above generalizes both into the shared pattern.

### V8.38 — Three strategic decisions LOCKED

**Multiplayer = PRE-LAUNCH** (active requirement). Day 24 phase. Day 21-23 must actively support party-of-N.
**Customization layer = PRE-LAUNCH** but toward end. Day 25 phase. User-supplied theme prompts.
**Day 22 skills = FOUNDATIONS NOW** (middle path). Skill domain enum (Combat / Crafting / Social / Exploration). Combat domain wired; others stubbed.

### Sequence (latest revision)

1. ~~Polish Round 4a (24ac19c)~~ ✅
2. ~~Day 20.4.3 Region Expansion Hotfix (60501c8)~~ ✅
3. **Polish Round 4c** ⏳ NEXT — nav cards into 4 horizontal column blocks (prompt staged)
4. Polish Round 4b — mobile-viewport QA pass
5. Day 21 — Container + Loot (multiplayer-aware)
6. Day 22 — Skills + Leveling (multiplayer-aware + lifestyle skill foundations)
7. Vertical slice playtest
8. Day 23 — Main Quest Thread
9. Combat UX & Flow Polish round (V8.41 queue)
10. Day 24 — Multiplayer Foundation
11. Day 25 — Customization Layer
12. Day 20.5 — Verbal Action — deferred to last
13. Day 20.6 — Encounter Avoidance / Stealth — Combat Alternatives bucket with 20.5

### Open strategic questions

- External playtest timing (post-Day-22 or post-Day-23 likely).
- Difficulty tuning model — toggle vs implicit world-tier scaling.
- Random travel encounters (combat-spec §3 deferral) — slate post-Day-21 or fold into Day 22/23. Intersects with Day 20.6 stealth idea.
- Verbal action redundancy risk (Day 20.5 vs Day 22 Charisma skill tree). Same question for Day 20.6 stealth vs PER/AGI/stealth skill.
- NPC behavior dispatch (combat-spec §6.3 deferral).
- Map visual rework — dedicated session, deferred.
- **Audit queue (V8.42 expanded):** defensive overchecks in app code (V8.39), prompt-template hardcoded structural IDs (V8.42 NEW), integration test coverage gaps (V8.40).

### Doc efficiency strategy (V8.42)

CLAUDE.md is reaching the size where full-doc rewrites per round are slow. **Step 1 applied this round:** compressed historical Day 20.X sections from multi-line summaries to one-liner round-history table. The foundational rules carry the technical content; round summaries were redundant scaffolding. **Step 2 (proposed, when a quiet round allows):** externalize Foundational Rules to `/docs/foundational-rules.md` as append-only. CLAUDE.md becomes active index + status + trajectory only. Diminishing returns past that.

---

## 🔄 Current Status (Read This First)

**Current Phase:** Day 20.4.3 Region Expansion Hotfix landed (commit 60501c8). Polish Round 4c (nav cards into 4 horizontal column blocks) is next, prompt staged.
**Local Dev Port:** 3000 · **Stack:** Next.js 14 / Tailwind / shadcn/ui / Supabase / Claude API / Stripe / Vercel · **GitHub Repo:** atomictim/endless-worlds-rpg

| Phase | Title | Status |
| --- | --- | --- |
| 1–18 | MVP through Systems Audit | ✅ Complete |
| 19A–19F | World Generation Architecture | ✅ Complete |
| Movement Track | Verified end-to-end | ✅ FROZEN |
| Combat Spec | /docs/combat-spec.md design doc | ✅ Frozen |
| Combat era (Days 20 through 20.4.2) | Data + resolver + UI + narration + polish + hotfixes | ✅ Complete (see round history below + rules 24-71) |
| Polish 4a (24ac19c) | Nav grouping + tier colors + cross-region BACK + map auto-switch + .ew-said + CSS audit | ✅ Complete |
| **20.4.3 (60501c8)** | **Region Expansion Hotfix — prompt template + splitConflatedRegionSettlement heal-on-apply** | ✅ **Complete** |
| **Polish 4c** | **Nav cards into 4 horizontal column blocks with mobile horizontal scroll** | ⏳ **NEXT** |
| Polish 4b | Mobile-viewport QA pass (audit doc + inline fixes + deferred-rework list) | ⏳ After 4c |
| Day 21 | Container + Loot — multiplayer-aware | ⏳ After 4b |
| Day 22 | Skills + Leveling — multiplayer-aware + lifestyle skill foundations | ⏳ After Day 21 |
| Vertical slice playtest | Full game start → win condition with placeholders | ⏳ Before Day 23 |
| Day 23 | Main Quest Thread — multiplayer-aware shared quest state | ⏳ Post-playtest |
| Combat UX & Flow Polish | Hit/miss differentiation + miss float + flee-fail pacing | ⏳ Post-Day-23 |
| Day 24 | Multiplayer Foundation | ⏳ Pre-launch |
| Day 25 | Customization Layer | ⏳ Pre-launch toward end |
| Day 20.5 | Verbal Action System | ⏳ Deferred (Combat Alternatives) |
| Day 20.6 | Encounter Avoidance / Stealth | ⏳ Deferred (Combat Alternatives) |
| Map Visual Rework | Dedicated session | ⏳ Deferred |

**Active genres:** Fantasy, Cyberpunk, Horror/Lovecraftian, Space Opera, Post-Apocalyptic. Noir removed.

### Day 20.4.3 — Region Expansion Hotfix (commit 60501c8 — 306/306 tests, /game 109 kB unchanged)

**Root cause (3rd recurrence of V8.39 rule 65's pattern, this time in a different surface):** `generate-regional-bible`'s prompt template hardcoded `locations[0].id = "${outline.id}"`, producing bibles where `region.id === settlement.id`. `apply-regional-bible`'s `isSameAsSettlement` branch then collapsed them into a single graph node carrying the SETTLEMENT's name. UI cascade: top header showed region name (region scope), map title + sidebar + nav card showed settlement name (settlement scope) — same node, conflicting display contexts.

**Fix architecture — two layers so cached + fresh bibles both heal:**
1. **Prompt template** — distinct `settlementSlug = ${outline.id}_settlement`. Explicit "REGION vs SETTLEMENT IDS" guidance block. Every cross-reference (`parent_location_id`, `connections`, `region_locations.connections`, `exits.from_location_id`) points at `settlementSlug`.
2. **`splitConflatedRegionSettlement(bible)` pure helper** in `lib/game/region-expansion-guard.ts` — detects collapse, renames settlement location id, stamps `bible.settlement_id`/`settlement_name`, re-points sub-locations + region_locations + NPCs (`home_location_id`) + exits (`from_location_id`) in place. Wired into `apply-regional-bible` step 0d so cached/legacy bibles heal on apply.
3. **Diagnostic logs** (V8.39 style) — `Created region zone <id> name:`, `Created settlement <id> name: parent:`, plus split-applied / no-op WARNs.

**Tests:** 9 new jest cases in region-expansion-guard tests covering idempotence, name preservation, sub-location/region_locations/NPC/exit re-pointing, `bible.settlement_id` honor + synthesized-fallback paths. Pure-helper module per V8.40 rule 71.

**Save-migration:** existing already-applied collapsed regions stay broken — apply-step idempotence guard short-circuits before split runs. Recovery: fresh game, OR manually delete `master_state.metadata.region_bibles[<region_id>]` + the affected graph node and re-navigate.

### Round history (compressed; details in foundational rules + git log)

| Commit | Round | Foundational rules |
| --- | --- | --- |
| 24ac19c | Polish 4a — nav grouping/tiers/cross-region BACK/map auto-switch/.ew-said/CSS audit | 72-76 |
| f17c221 | 20.4.2 — float CSS clip + stagger + sync to feed + codex modal + D&D roll format | 66-71 |
| c67f2c0 | 20.4.1 — float routing + inventory-Use during combat + flee DC + defeat respawn (category fallback removal) | 62-65 |
| fc508f3 | 20.4 — rolls field + inline suffix + floats introduced + defeat teleport groundwork | 57-61 |
| 732e944 | 20.3 — flex separators + button-only input + crit banner + suppression + resolution 2-line | 52-56 |
| bf3871e | 20.2 — initiative kickoff + inventory stats | 49-51 |
| 1215bb6 | 20.1 — starting equipment + encounter banner + pacing (also introduced the V8.39-fixed category bug) | 43-48 |
| abf73e6 | 20 Prompt 3/3 — combat mode UI + narrator + bestiary | 38-42 |
| 25ff111 | 20 Prompt 2.5 — nav fix + region trigger reclassification | 34-37 |
| a4e5975 | 20 Prompt 2/3 — combat-resolver + turn loop + encounter trigger | 28-33 |
| 1024287 | 20 Prompt 1/3 — Enemy interface + bestiary + WorldBible/RegionBible extensions | 24-27 |
| 87c89a3 + earlier | Pre-combat (region/resilience, polish, targeted/regression/bug fixes, architecture hardening, 19A-19F gen phases) | 1-23 |

### Architecture & system status

**Domain 1 (Engine — pure code):** Navigation + nav-cards module (V8.41) + cross-region BACK trail awareness + map tier auto-switch · combat-resolver + engine + triggers (V8.32-V8.40) · CSS containment fix + float stagger + emission synced to feed + codex modal + D&D roll display (V8.40) · region expansion guard + `splitConflatedRegionSettlement` heal-on-apply (V8.42) · loot resolver (Day 21).

**Domain 2 (Content Library — frozen):** WCD, WorldBible, RegionBible, NPCs, items, loot tables, bestiary, region enemies, starting equipment loadouts.

**AI during gameplay:**
- ✅ Arrival narration — first visit only, cached permanently
- ✅ Dialogue options built by code, AI writes response only
- ✅ Action narration — 1-4 sentences, out-of-combat only
- ✅ Combat narration — selective dramatic events. Templated routine.
- ⏳ Container search — pending Day 21
- ⏳ Verbal action — Day 20.5 deferred
- ⏳ Stealth/avoidance — Day 20.6 deferred (V8.41 capture)

**Generation models:** RegionBible: haiku-4-5, max_tokens 7000, stub fallback, idempotent, distinct settlement/region IDs per V8.42 rule 77. WorldBible: sonnet-4-5, max_tokens 10000, validate-don't-500. WCD: includes `world_description`. Combat narrator: sonnet-4-5.

**Map system:** Genre renderers active. PAD=76. Tier switcher. Initial tier: Local on mount. Cross-region arrival forces tier=2 Region (V8.41). Visual rework still pending dedicated session.

**Region Expansion Guard (V8.33 + V8.42):** Works around toSlug() stripping hyphens. V8.42 added `splitConflatedRegionSettlement` for heal-on-apply of collapsed region/settlement bibles.

**NPC Dialogue:** Options built by code. AI writes response only. `.ew-said` brightened to `#f4e8c8` (V8.41) for distinct contrast.

### Known issues

**Polish Round 4c — NEXT:** Nav cards relaid into 4 horizontal column blocks (BACK | DEEPER | PEER | UNDISCOVERED side-by-side, each in visually contained block with column label on top, cards stacked vertically inside). Mobile: horizontal scroll inside nav strip per V8.40 rule 70. Pure functions in nav-cards.ts unchanged — presentation layer only.

**Polish Round 4b — after 4c:** Mobile-viewport QA pass. Phone-width (~380px) sweep across all major surfaces. Audit doc + inline fixes + deferred-rework list. Combat panel likely needs dedicated mobile-layout round.

**Combat UX & Flow Polish (post-Day-23):** Hit/miss differentiation, miss float, flee-fail pacing.

**Day 20.5 + 20.6 (Combat Alternatives, post-Day-25):** Verbal Action + Encounter Avoidance.

**CSS containment future candidates (V8.41 audit, address when those features get touched):** PortraitSlot status badges, StoryFeed inline tooltips, TradeModal gold floats, GameLayout mobile rail tooltips, WorldMap edge tooltips. See `/docs/css-containment-audit.md`.

**Other deferred:** Map visual rework, RTL component test infra, pacing tuning watchpoint, world-gen perf (35s WCD + 120s WorldBible borderline pickup-play), NPC color overlap, hub codex, grid_position, behavior dispatch, toSlug bug, combat balance pre-Day-21/22.

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
40. Each combatant row reserves a portrait slot (~128px). portraitUrl prop accepts real images later. (V8.34)
41. Bestiary codex entries write on `combat_start`, deduplicated by enemy.id. (V8.34)
42. New game preamble: `recent_messages.length === 0` triggers "Your adventure begins. What will you do first?" (V8.34)
43. Starting equipment lives in `lib/game/starting-equipment.ts` as separate module. (V8.35)
44. Every starting weapon ships with `equipped: true` AND `effect.damage_die`. Every starting armor ships with `equipped: true` AND `effect.armor_bonus`. (V8.35)
45. `combat_start` is templated, not LLM-narrated. (V8.35)
46. `player_turn_start` and `enemy_phase_start` events emitted by combat-engine at phase transitions. They do NOT emit when combat ends. (V8.35)
47. Pacing delays at turn transitions: 800ms before enemy_phase_start, 800ms before player_turn_start, 500ms between successive distinct enemy actors. (V8.35)
48. CombatMode header pill `displayPhase` is decoupled from `combat.current_turn_index` and flips ahead of feed. (V8.35)
49. Enemy-turn loop is shared via `advanceUntilPlayerTurnOrEnd`. Single source of truth. (V8.36)
50. When combat starts with `turn_order[0] !== PLAYER`, the initial enemy phase MUST fire via `kickoffCombat` from useEffect. Tracked via useRef Set. (V8.36)
51. Inventory detail panel surfaces combat stats: WEAPON Damage, ARMOR Armor (always renders, including +0), CONSUMABLE Heal. EQUIPPED pill. (V8.36)
52. Combat input is button-only when combat is active. submitAction early-bails. INTERIM until Day 20.5. (V8.37)
53. Use Item is templated only. Format: `"You use <item>. Restored N HP."` (V8.37)
54. Crit events render as TWO lines: templated banner first (instant), then LLM crit prose. (V8.37)
55. `planEventSuppression(events)` pre-scans event batches. When victory present: kill events dropped, last crit before victory has prose suppressed. (V8.37)
56. Resolution events render as two-line centered block: banner + ≤20-word LLM prose. max_tokens 120 for resolutions. (V8.37)
57. CombatEvent.rolls field populates on every event with damage/d20/heal outcome. (V8.38)
58. Inline roll suffix renders subtle parenthetical breakdown via `{primary, rolls}` return shape from templates. (V8.38)
59. Floating damage numbers fire on hit/crit/heal events ONLY. Routing via explicit `switch(event.type)`: player_attack hosts on `event.target`, enemy_attack/use_item host on `PLAYER_ID`. (V8.38 + V8.39)
60. Defeat teleport — `last_settlement_hub_id` initialized at game spawn. handleDefeat uses 3-tier fallback chain. Cross-region teleport per soulslike model. (V8.38)
61. Resolution events (defeat / flee_success) carry destination payload. StoryFeed renders templated info line below LLM prose. Victory does NOT get destination line. (V8.38)
62. `rolls.d20` stores RAW d20 value (1-20). `target_dc` wrapped in `Math.round()` for display. Pass/fail logic uses internal total. (V8.39)
63. Inventory Use button during combat routes through `submitCombatAction`, NOT `submitAction`. Equip/Unequip/Read/Search/Drop buttons HIDDEN during combat. (V8.39)
64. Floating damage entry routing uses explicit `switch(event.type)`. Defensive `player_attack target === PLAYER_ID` guard returns null. (V8.39)
65. **Settlement-hub detection in step 7c-2 uses `is_settlement_node === true` predicate ONLY.** Category fallback was a Day 20.1 defensive overcheck that misrouted region zones. **Defensive overchecks alongside canonical fields can become positive bugs.** (V8.39)
66. Floating damage emission lives INSIDE `projectCombatEventsToFeed` (useCombat), called AFTER pacing sleeps so visible float pops at the same instant as its matching feed line. CombatMode is a pure renderer for the `floatingByActor` prop. (V8.40)
67. Multi-host floating damage uses `computeFloatStartDelay` pure helper. 300ms increments when entries land on same host within window. `animation-fill-mode: both` so 0% keyframe holds during delay. (V8.40)
68. Roll display format is D&D-style with explicit modifier math: `(d20: 17, +2 → 19 vs 12 | 1d6+2)` for hits, `(d20: 1)` for fumbles (skip mod), `(d20: 20 | 6 (max) + 3 (1d6) + 2)` for crits (skip vs DC), `(1d8: 4 +4 = 8)` for heals. (V8.40)
69. Codex is rendered as `CodexModal` overlay (z-50, ESC + backdrop + X close) toggled by `codexModalOpen` in game store. Combat panel remains mounted underneath. `/game/codex` route preserved for direct URL access. (V8.40)
70. **CSS containment lesson: absolutely-positioned children CAN be clipped by ancestor `overflow-x: auto` or `overflow-y: auto`.** Per W3C spec, setting either overflow axis to a non-`visible` value promotes the OTHER axis to `auto`. Any container hosting absolutely-positioned children needs explicit `overflow: visible` if children extend outside the box. (V8.40)
71. **Integration tests required for routing helpers and lookup keys.** Unit tests against fake events can pass while real-data wiring is broken. Routing points need integration tests against real combat-resolver / engine / data sources. (V8.40)
72. Nav cards group by movement direction into 4 rows/columns: BACK / DEEPER / PEER / UNDISCOVERED. EXIT folds into BACK. Empty groups omitted. Pure-function `lib/game/nav-cards.ts` owns `buildCards` + `groupCardsByDirection`. Italic-serif labels render only when group has cards. (V8.41 — Polish 4c relays rows → columns; structural rule preserved)
73. Nav card tier color via `tierOfNode` predicate. Applies to border, leading arrow, title, badge border. Region → `--hl-region` lavender · Settlement → `--hl-loc` sky-blue · Sub-location → `--hl-sublocation` mint (NEW V8.41) · Dungeon → `--hl-dungeon` burnt-copper (NEW V8.41). Background stays neutral. (V8.41)
74. Cross-region BACK card consults `masterState.navigation_trail[-2]` (V8.32 infrastructure). If previous node resolves to a different region, BACK card targets that region's settlement hub instead of the new region's unvisited settlement. (V8.41)
75. WorldMap forces map tier=2 (Region) on cross-region arrival via useEffect. Same-region moves leave tier alone — preserves manual tier choice. Combines with rule 21 for full tier-switching behavior. (V8.41)
76. **Origin/main baseline check (V8.41 workflow rule):** Claude Code MUST run `git fetch origin && git log origin/main --oneline -5` as step 1 of every prompt. Prevents wasted-work re-baselines. (V8.41)
77. **RegionBible prompt template MUST distinguish settlement_id from region_id.** Use `settlementSlug = ${outline.id}_settlement` convention. Every cross-reference field (`parent_location_id`, `connections`, `region_locations.connections`, `exits.from_location_id`) points at `settlementSlug`, not at the region id. Prompt template must include explicit "REGION vs SETTLEMENT IDS" guidance block to ensure LLM doesn't collapse them. (V8.42)
78. **Apply-regional-bible heal-on-apply layer:** `splitConflatedRegionSettlement(bible)` pure helper in `lib/game/region-expansion-guard.ts` detects collapse where region.id === settlement.id, renames settlement location id, stamps `bible.settlement_id`/`settlement_name`, re-points sub-locations + region_locations + NPCs (`home_location_id`) + exits (`from_location_id`) in place. Runs at apply step 0d before idempotence check. Heals cached/legacy bibles so V8.41 playtest saves don't permanently break. (V8.42)
79. **Pattern lesson — prompt-template hardcoded structural IDs are a recurring bug class.** Third instance of the same root-cause shape (V8.39 starting_region.type, V8.40 CSS overflow, V8.42 locations[0].id). All three were values hardcoded at generation/spec time that should have been distinct but weren't, causing downstream cascade bugs at apply time. **Audit scope expansion (V8.42):** sweep `app/api/game/generate-*/route.ts` for template literals embedding `${outline.id}`, `${region.id}`, etc. in id positions where collision is possible. Companion to V8.39 audit (defensive overchecks in app code) — these two together cover both surfaces. (V8.42)

---

## Narrator Prompt Order

DIALOGUE: WCD → HARD RULES → RESPONDING CHARACTER → CLOSED CONTEXT → TIER 1 OBJECTS → WORLD ASSETS → SCENE → VERBOSITY
non-DIALOGUE: WCD → HARD RULES → NPCS PRESENT → TIER 1 OBJECTS → CONNECTED LOCATIONS → WORLD ASSETS → SCENE → VERBOSITY
COMBAT: GENRE TONE PRIMER → COMBAT EVENT (mechanical truth) → HARD RULES → length hint per event tier (resolutions ≤20 words, crit/kill 2-3 sentences)

---

## Story Feed Colors

| Use | Color | Token |
| --- | --- | --- |
| Narrator prose | var(--ink-1) | — |
| NPC quoted speech | #f4e8c8 (V8.41) italic weight 600 | --hl-said |
| Player actions (out-of-combat) | #7ab8c8 teal-blue 12px mono italic | — |
| Item highlights | #e8c547 yellow | --hl-item |
| Region highlights | #c4b5fd lavender | --hl-region |
| Location highlights | #7dd3fc sky-blue | --hl-loc |
| Sub-location (V8.41) | #94d8b8 mint | --hl-sublocation |
| Dungeon (V8.41) | #b45309 burnt-copper | --hl-dungeon |
| NPC highlights | var(--accent) orange | — |
| Combat routine player | #7ab8c8 teal | --combat-player |
| Combat routine enemy | #e87c6d warm red | --combat-enemy |
| Combat player crit | #3b82a8 deeper blue BOLD | --combat-player-crit |
| Combat enemy crit | #c0392b blood red BOLD | --combat-enemy-crit |
| Combat victory | #7dbb8e mossy green | --combat-victory |
| Combat defeat | #a93226 dark red | --combat-defeat |
| Combat flee | #a8a29c grey-tan | --combat-flee |
| Encounter banner | #f4a07a light coral | --combat-encounter-banner |
| Roll detail suffix (V8.40 D&D format) | 10px dim mono 0.6 opacity | --combat-roll-detail |
| Floating damage | 28px (36px crit) mono bold, 1100ms fade, staggered via animationDelay (V8.40) | — |
| Resolution destination | 12px italic serif 0.75 opacity | --combat-resolution-destination |

---

## Tech Stack

| Layer | Tool |
| --- | --- |
| Frontend | Next.js 14 (App Router) |
| Styling | Tailwind + shadcn/ui + design tokens |
| Database | Supabase (migrations 001-009) |
| AI (world gen + narration + combat narration) | claude-sonnet-4-5 |
| AI (RegionBible) | claude-haiku-4-5-20251001 |
| Payments | Stripe |
| Deploy | Vercel |
| Audio | Howler.js |
| State | Zustand |

---

## Genre Definitions

| Genre | data-genre | Primary | Currency | HP |
| --- | --- | --- | --- | --- |
| Fantasy | fantasy | #f59e0b amber | Gold | HP |
| Cyberpunk | cyber | #22d3ee cyan | Credits | Integrity |
| Horror/Lovecraftian | horror | #84cc16 acid green | None | HP + Sanity |
| Space Opera | space | #a855f7 purple | Stellar Units | Hull Integrity |
| Post-Apocalyptic | apoc | #ea580c rust | Caps | HP |

---

## Monetization

| Feature | Free | Adventurer ($6.99) | Legend ($14.99) |
| --- | --- | --- | --- |
| Genres | Fantasy | All 5 | All 5 + future |
| Save Slots | 1 | 3 | Unlimited |
| AI Actions/Day | 50 | Unlimited | Unlimited |
| Priority Speed | ❌ | ❌ | ✅ |

---

## Workflow

Claude.ai owns all CLAUDE.md updates. Round flow: Claude Code pushes → Tim reports commit + tests → Claude.ai updates CLAUDE.md + testing checklist → Tim verifies → next prompt.

**Per-prompt protocols (cumulative):**
- Origin/main baseline check (V8.41 rule 76): `git fetch origin && git log origin/main --oneline -5` as step 1.
- Investigation-before-patching (V8.40 protocol): validate root-cause hypothesis before patching.

**Authority hierarchy:**
- Architecture decisions defer to `/docs/architecture-spec.md`.
- Combat decisions defer to `/docs/combat-spec.md`.
- Vision/scope decisions defer to 🎮 Game Vision section.
- Strategic/sequencing decisions captured in 📋 Strategic Trajectory Notes.
- Round details = git commit messages + this doc's round-history table. No more "Last updated" footer — git is the source of truth for what changed when.
