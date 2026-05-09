# Project: Endless Worlds RPG — Master Context

**Version:** 8.33
**Status:** Active Development — Combat Prompt 3/3 Up Next, Polish Round (Prompt 4) Queued
**Objective:** A text-based RPG that generates a unique world for every playthrough. Genre-agnostic, infinitely replayable, CRPG depth.

**Reference:** /docs/architecture-spec.md — The definitive source for all Domain 1 vs Domain 2 decisions. /docs/combat-spec.md — The authoritative source for combat system design.

---

## 🔄 Current Status (Read This First)

**Current Phase:** Prompt 2.5 navigation fix complete. Combat foundation solid — encounters trigger, resolver works, navigation is clean. Combat Mode UI (Prompt 3/3) up next, with bestiary codex + new-game string fix bundled. Polish Round (Prompt 4) queued for after combat works visually.
**Local Dev Port:** 3000
**Stack:** Next.js 14 / Tailwind / shadcn/ui / Supabase / Claude API / Stripe / Vercel
**GitHub Repo:** atomictim/endless-worlds-rpg

| Phase | Title | Status |
| --- | --- | --- |
| 1–18 | MVP through Systems Audit | ✅ Complete |
| 19A–19F | World Generation Architecture | ✅ Complete |
| Gameplay + Navigation Audit | 21 issues + stabilization | ✅ Complete |
| UX Rounds 1-3 + Nav/NPC/Difficulty | Readability, dialogue, stat rules | ✅ Complete |
| Trade + Dialogue + Architecture | No-check trade, haiku model | ✅ Complete |
| Full UI Redesign | Design tokens, 15 SVG map renderers | ✅ Complete |
| Map Overhaul + Debug Mode | fitToViewBox, tiers, coordinate ranges | ✅ Complete |
| Regional Zone Traversal + Polish | Full nav refactor, typed cards | ✅ Complete |
| Session 84–89 Bug Fixes | Nav, map, RegionBible, zone_id, UX | ✅ Complete |
| Adjacent Region Travel | End-to-end flow, Bug 2 fixed | ✅ Complete |
| Architecture Hardening | Caching, codex dedup, code-built dialogue | ✅ Complete |
| Bug Fix Round (57b0300) | Highlight nav, discovered, headers, map polish | ✅ Complete |
| Regression Fix Round (75a7cd4) | Cache pipeline, map sizes, tier descriptions | ✅ Complete |
| Targeted Fix Round (dc5bcd8) | Region travel 500, region zone description | ✅ Complete |
| Polish Round (b7032f9) | Tier-aware highlight colors, NPC speech, region cards, key warnings | ✅ Complete |
| Region/Resilience Round (87c89a3) | Region desc from any node, default tier, landmark color, origin region card, RegionBible stub fallback | ✅ Complete |
| Movement Track | Verified end-to-end through multi-region playtest | ✅ FROZEN |
| Combat Spec | /docs/combat-spec.md design doc | ✅ Frozen |
| 20 — Combat Prompt 1/3 (1024287) | Data foundation: enemy types, bestiary, generation, encounter tagging | ✅ Complete |
| 20 — Combat Prompt 2/3 (a4e5975) | Resolver + encounter triggers + turn loop | ✅ Complete |
| 20 — Prompt 2.5 Nav Fix (25ff111) | Region trigger reclassification, idempotent apply, discovered preservation | ✅ Complete |
| **20 — Combat Prompt 3/3** | **Combat mode UI + narration + bestiary codex + new-game string fix** | ⏳ **Next** |
| Polish Round (Prompt 4) | Settlement card label, tier auto-switch, NPC dialogue contrast, tier-aware nav button colors | ⏳ Queued post-combat |
| Map Visual Rework | Dedicated session | ⏳ Deferred (post-Prompt-4) |
| 21 | Container + Loot | ⏳ Pending |
| 22 | Skills + Leveling | ⏳ Pending |
| 23 | Main Quest Thread | ⏳ Pending |

**Active genres:** Fantasy, Cyberpunk, Horror/Lovecraftian, Space Opera, Post-Apocalyptic
**⚠️ Noir removed. Genre renderers restored (pickModule re-enabled).**

### Prompt 2.5 — Navigation Fix (commit 25ff111 — 149/149 tests, clean build)

**Root cause confirmed:** Hyphenated region names like "The Chain-Keeps Borderland" slugify in `toSlug` to `the_chainkeeps_borderland` — the hyphen is stripped without becoming an underscore. The canonical graph node id is `the_chain_keeps_borderland`. So the directHit fallback in `resolveMove` (`graph.nodes[targetSlug]`) misses, `classifyMove` falls through to `WORLD_EXPLORE`, and step 4d's `shouldExpandRegion = moveTypeForRegion === "WORLD_EXPLORE"` fires, re-running apply-regional-bible against an already-applied bible.

Could fix `toSlug` itself but that's high-blast-radius. The targeted fix lives at the consumers of the move classification.

**Fix 1 — useGameLoop step 4d reclassification:**
After matching the outline, if the matched id is already in `metadata.region_bibles` AND its graph node has `discovered: true`, the region is already fully expanded. Step 4d:
- Logs `[navigateTo] known region — reclassified as GRAPH_NAVIGATE: { targetId, name }` instead of expanding region
- Reroutes `world_state.current_location_id`, `current_node_id`, `world_graph.current_node_id` to the canonical id
- Stamps `LocationStatus.ARRIVING`
- Refreshes locationAssets for the canonical region zone (with parent region id, per V8.30 Fix 1)
- Falls through to step 5 narration without calling apply-regional-bible

Also patched the downstream `arrivedAt` computation at step 7c — it now reads `updatedState.world_state.current_location_id` instead of `resolution.state_delta.world_state.current_location_id`, so the FIX 1 reclassification flows into asset reload, navigation_trail tracking, and the encounter trigger.

**Fix 2 — apply-regional-bible idempotence guard:**
At the top of the POST handler, before any work: if the bible is already in `metadata.region_bibles` AND every location is already in `world_graph.nodes`, log `Skipping redundant re-apply of <name> — already in master_state.` and return 200 with `skipped: true`.

**Fix 3 — preserve `discovered` on re-apply:**
At the merge step in apply-regional-bible (step 5), every newly-built node is run through `mergeNodePreservingDiscovered(existing, fresh)`.

**Architecture extraction — `lib/game/region-expansion-guard.ts`:**
Three pure helpers (`isRegionAlreadyExpanded`, `isApplyRegionalBibleRedundant`, `mergeNodePreservingDiscovered`), exported and consumed by both call sites.

**Tests:** 16 new in `region-expansion-guard.test.ts`. 149 total passing.

### Combat Day 20 — Prompt 2/3: Resolver + Triggers + Turn Loop (commit a4e5975 — 133/133 tests, clean build)

**Authoritative spec:** /docs/combat-spec.md (locked at V8.30 design pass).

**Task 1 — Combat state in types/game.ts:**
- New `CombatEnemyInstance`, `CombatEvent`, `CombatState` interfaces.
- `MasterState` extended with optional `combat`, `last_settlement_hub_id`, `navigation_trail`. Combat slice is dismissed entirely on victory/defeat/flee.

**Task 2 — `/lib/game/combat-resolver.ts` (pure math, RNG injected):**
- `rollD20`, `rollDamageDie`, `maxDamageDie`, `rollEnemyHP`, `rollInitiative`.
- `resolveAttack` — full §5.2 logic: nat-1 fumble, nat-20 crit (max die + 1d(die) + str_mod), `hit_total >= target_dc`, min-1 damage clamp, `killed_target` flag.
- `resolveDefend` + `applyDefendDamageReduction` — half damage rounded down, min 1.
- `resolveFlee` — average AGI of LIVING enemies; ignores dead.
- `resolveUseItem` — heals 1d8+4 capped at max; unknown items no-op.

**Task 3 — Encounter trigger in useGameLoop step 7c-3:**
- `shouldRollEncounter`, `resolveEnemyLookup` (4-layer fall-through), `rollEncounter`, `rollEncounterWithPlayer` wrapper.

**Task 4 — Turn loop in `/lib/game/combat-engine.ts`:**
- `executePlayerAction`, `advanceEnemyTurn`, `checkVictory`, `checkDefeat`, `handleVictory`, `handleDefeat`, `handleFleeSuccess`.

**Task 5 — Tracking in useGameLoop step 7c-2:**
- `navigation_trail` keeps last 5 node ids; `last_settlement_hub_id` updates on settlement hub arrivals.

**Task 6 — Console combat logger:** TEMPORARY — Prompt 3 will replace with story-feed rendering.

**Task 7 — Dev-only test override:** `window.__forceEncounter("fantasy_goblin", "fantasy_skeleton")` registers at module load.

**Task 8 — 61 new tests, 133 total passing.**

### Combat Day 20 — Prompt 1/3: Data Foundation (commit 1024287 — 72/72 tests, clean build)

**Task 1 — Enemy types in types/game.ts:**
- New `Enemy` interface (combat-spec §6.2).
- `LocationDefinition` + `WorldNode` extended with optional `encounter_chance`, `encounter_roster`, `is_boss_room`.
- `RegionBible.enemies` and `RegionOutline.enemies` arrays.
- `Metadata.region_bibles` accumulator.

**Task 2 — Bestiary files:**
- `/lib/game/bestiary/fantasy.ts` — 14 entries.
- `cyber.ts`, `horror.ts`, `space.ts`, `apoc.ts` — 3 placeholder entries each.
- `index.ts` — `getGenreBestiary`, `findGenreEnemy`.

**Task 3-5 — WorldBible + RegionBible LLM prompt extensions + apply persistence with validate-don't-500.**

**Task 6 — `/lib/game/loot/stub-drops.ts` — 25-50% gold + 5% potion.**

**Task 7 — 29 new tests, 72 total passing.**

### Region / Resilience Round (commit 87c89a3 — 43/43 tests, clean build)

**Fix 1 — Region tier description resolves from parent region for any node** via `parentRegionId` chain walk.
**Fix 2 — Map defaults to Local tier on startup.**
**Fix 3 — Landmark highlight color flipped to mint** to distinguish from region lavender.
**Fix 4 — New region wires origin region symmetrically into adjacent-region connections.**
**Fix 5 — RegionBible stub fallback** on JSON parse failure.

### Polish Round (commit b7032f9 — 43/43 tests, clean build)

**Fix 1 — Tier-aware highlight colors** (region lavender vs location sky-blue).
**Fix 2 — NPC quoted speech in warm cream italic, weight 600.**
**Fix 3 — Region zone retains adjacent-region cards on return.**
**Fix 4 — React key-prop-spread warning silenced** in StoryFeed.

### Targeted Fix Round (commit dc5bcd8 — 43/43 tests, clean build)

**Fix 1 — apply-regional-bible 500** (collision-check NPE guarded with isValidPos).
**Fix 2 — Region zone description populates correctly** across world bible + region bible apply paths.

### Regression Fix Round (commit 75a7cd4 — 43/43 tests, clean build)

**Fix A1 — Cache hit preserves post-arrival pipeline.**
**Fix A2 — Sub-location nav cards back-to-hub only.**
**Fix B1 — Map text and icons visually larger.**
**Fix B2 — `?` underline removed across all renderers and tiers.**
**Fix B3 — Description sourcing per map tier** (no cross-tier bleed).

### Bug Fix Round (commit 57b0300 — 43/43 tests, clean build)

**Fix 1 — Highlight nav uses node id, not display name.**
**Fix 2 — Discovered flag safety net at end of step 7.**
**Fix 3 — Section header on cross-node navigation.**
**Fix 4-6 — Various map polish fixes (some superseded by V8.27).**

### Architecture Hardening (commit 57d27f3 — 43/43 tests, clean build)

**Change 1 — Land at region zone after generation.**
**Change 2 — World map overlap fix.**
**Change 3 — Write-once arrival cache + codex dedup.**
**Change 4 — Code-built dialogue options.**
**Change 5 — Genre renderers restored.**

### Architecture Status ✅
```
Domain 1 (Engine):     World graph, navigation, stat checks, dialogue option
                       generation, combat resolver (V8.32), combat turn loop
                       (V8.32), encounter triggers (V8.32), region expansion
                       guard (V8.33), loot resolver (pending Day 21) — pure code
Domain 2 (Content):    WCD, WorldBible (with enemies + encounter tagging),
                       RegionBible (same), NPCs, items, bestiary — frozen

AI during gameplay:
  ✅ Arrival narration  — first visit only, cached permanently after
  ✅ Dialogue options   — built by code, AI writes response only
  ✅ Action narration   — 1-4 sentences
  ✅ NPC not present    — hardcoded "X isn't here"
  ⏳ Combat round narration — pending Prompt 3
  ⏳ Container search   — pending Container+Loot system
```

### Combat System ✅ (V8.31 + V8.32)
```
DATA LAYER (V8.31):
  Enemy interface, two-tier bestiary, encounter tagging, stub loot drops.

RESOLVER LAYER (V8.32):
  /lib/game/combat-resolver.ts — pure math, RNG injected.
  d20 hit/dmg/init/flee/use_item.

TRIGGER LAYER (V8.32):
  shouldRollEncounter / resolveEnemyLookup / rollEncounter.

TURN LOOP (V8.32):
  /lib/game/combat-engine.ts — full action resolution + auto-advance.

STATE TRACKING (V8.32):
  master_state.combat / last_settlement_hub_id / navigation_trail.

DEV TOOLS (V8.32):
  window.__forceEncounter("enemy_id", ...) — dev-only override.
  Console logger — TEMPORARY, Prompt 3 replaces with story-feed.
```

### Region Expansion Guard ✅ (V8.33)
```
/lib/game/region-expansion-guard.ts — pure helpers, two callers:

isRegionAlreadyExpanded / isApplyRegionalBibleRedundant /
mergeNodePreservingDiscovered.

ROOT CAUSE FIXED IN V8.33:
toSlug() strips hyphens from "The Chain-Keeps Borderland" →
"the_chainkeeps_borderland", but canonical id is
"the_chain_keeps_borderland". The Region Expansion Guard works
AROUND this slug bug. Fixing toSlug itself is high-blast-radius.
```

### Navigation Rules ✅ (Complete)
```
Map = PURELY VISUAL. Genre renderers active. All navigation via nav bar.

Card grammar: [← BACK] [→ DEEPER...] [↑ EXIT] [◆ PEER...] [◇ UNDISCOVERED...]

Routing:
  Sub-location   → ← back to hub ONLY
  Settlement hub → → deeper + ↑ exit to region zone
  Region zone    → ← back + ◆ known + ◇ undiscovered + adjacent regions
  Dungeon        → ← back to region zone ONLY
  New region     → lands at region zone (not settlement hub)

Region zone D2 card builder:
- At starting region: iterates wb.adjacent_regions
- At expanded region: reads current.connections, lists is_expandable
  zone_id=self nodes as peer cards

Region trigger reclassification (V8.33):
- Step 4d checks isRegionAlreadyExpanded BEFORE expanding
- Known region → GRAPH_NAVIGATE, no apply-regional-bible call

Combat trigger:
- Step 7c-3: shouldRollEncounter on every arrival
- last_settlement_hub_id + navigation_trail update on every arrival
- arrivedAt sourced from updatedState (post-reclassification)
```

### Map Description Sourcing ✅ (V8.27, hardened V8.28, generalized V8.30)
```
World tier  → wcd.world_description (2-3 sentence world summary)
Region tier → currentRegion.atmosphere (resolved from parent region zone
              asset for ANY node within the region)
Local tier  → currentLocation.atmosphere
```

### NPC Dialogue System ✅
```
Option list: built by code from NPC.knowledge[] asset
AI writes: response text only

NPC quoted speech: rendered via .ew-said class — #e8d5b0 warm cream,
italic, weight 600. Higher-contrast pass scheduled for Prompt 4 polish.
```

### RegionBible Resilience ✅ (V8.30, extended V8.31, idempotent V8.33)
```
Model: claude-haiku-4-5-20251001, max_tokens: 7000.
Stub fallback on double-parse-failure. Idempotent on re-apply.
```

### WorldBible Resilience ✅ (V8.31)
```
Model: claude-sonnet-4-5, max_tokens: 10000.
validateEnemy / validateEnemies / scrubEncounterRoster — warn-don't-500.
```

### Known issues

**Prompt 4 — Polish Round (queued for after Combat Prompt 3 lands):**
This is a dedicated visual polish round bundling all the small UX issues that don't belong in any of the major systems. Each item below is independent — no architecture dependencies — so they're best done together when the systems on either side (Combat) are stable.
- **Settlement hub card on new region arrival reads as back-from-settlement.** Functional but visually misleading. Card-typing issue in NavigationBar's region-zone D2 branch — needs to distinguish "settlement hub of CURRENT region" (deeper-into card) from "place player just left" (back card). Confirmed still present in V8.33.
- **Map does not auto-switch tiers on cross-region arrival.** Initial-mount default works (V8.30) but doesn't re-fire on cross-zone arrival.
- **NPC dialogue text needs higher contrast.** `.ew-said` doesn't read distinctly enough from surrounding ink-2 prose. Pick a more contrasting color or add a subtle background tint / left-border accent.
- **Tier-aware nav button colors (NEW request V8.33).** Each card type currently looks identical regardless of destination tier. Region cards, dungeon cards, settlement cards, and sub-location cards should each have a distinct visual treatment. For Prompt 4: distinct color per tier matching the existing highlight color tokens (region lavender, settlement sky-blue, dungeon a new color, etc). Style differentiation (icons, borders) deferred to a later visual pass.

**Map visual rework (dedicated session, post-Prompt-4):**
- Per-node decorative shelf line under every node — separate SVG element. Cleanup needed.
- Connection lines pass through node icons instead of terminating at icon edges.
- Overall sizing and visual hierarchy still cramped.
- Map label collision: World/Region tier labels overlap visibly.
- Whole-renderer redesign needed.

**Other deferred:**
- NPC highlight color (orange) too similar to item highlight (yellow) in Fantasy
- Hub node not added to codex on first arrival to new region
- Step 7 individual branches: confirm each sets `discovered: true` (relying on Fix 2 safety net)
- Starting region nodes lack `grid_position` — masked by V8.28 isValidPos guard.
- Behavior dispatch beyond flavor text deferred (combat-spec §6.3) — every enemy just attacks the player every turn.
- Combat console logger is TEMPORARY (V8.32) — Prompt 3 replaces with story-feed combat-event rendering.
- `toSlug` strips hyphens without converting to underscore — masked by V8.33 region-expansion-guard. Eventually worth fixing the normalizer itself.

---

## 🏗️ Architecture

### The Two Domains ✅
**Domain 1 (Engine — pure code):** Navigation, stat checks, dialogue option generation, combat resolver + turn loop + encounter triggers (V8.32), region expansion guard (V8.33), loot resolver (pending Day 21).
**Domain 2 (Content Library — frozen):** WCD, locations, NPCs, items, loot tables, main quest, bestiary, region enemies.

### Generation Model ✅
RegionBible: claude-haiku-4-5-20251001, max_tokens: 7000. Stub fallback. Idempotent on re-apply.
WorldBible: claude-sonnet-4-5, max_tokens: 10000. Includes enemies + encounter tagging.
WCD includes `world_description`.

### Map System ✅
```
Genre renderers active (pickModule enabled).
PAD=76. Tier switcher. Current node highlighted.

Initial tier on mount: Local (V8.30).
New region nodes: collision-checked, nudged if overlap.

⚠️ Map visual rework deferred to dedicated post-Prompt-4 session.
⚠️ Tier auto-switch on cross-zone arrival pending — Prompt 4.
```

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
15. Region zone assets always populate both `constitution.physical_description` AND `constitution.atmosphere` from the same source prose. (V8.28)
16. Collision-check loops over expandable node positions must guard each entry with `isValidPos`. (V8.28)
17. Story feed location highlights are tier-aware: region (lavender), location (sky-blue), landmark (mint). (V8.29, V8.30)
18. Region zone D2 card builder iterates adjacent_regions/connections without filtering by stripped links. (V8.29 + V8.30)
19. Span dispatch in StoryFeed separates `key` from spread props before JSX. (V8.29)
20. Region tier description resolves from parent region zone asset for any node in that region. (V8.30)
21. Map tier defaults to Local on initial mount for any non-region-zone node. (V8.30)
22. New region creation always wires the origin region symmetrically into adjacent-region connections. (V8.30)
23. RegionBible parse failure must never block the player. (V8.30)
24. Enemy entries follow the Enemy interface in types/game.ts. Validation is warn-don't-500. (V8.31)
25. Encounter rosters reference enemy ids resolved via 4-layer fall-through. Unresolvable ids scrubbed at apply time. (V8.31)
26. metadata.region_bibles accumulates expanded RegionBibles by id. (V8.31)
27. Combat system design defers to /docs/combat-spec.md. Spec FIRST, code SECOND. (V8.31)
28. Combat math lives in `/lib/game/combat-resolver.ts`. Pure functions, RNG injected. (V8.32)
29. Combat turn loop lives in `/lib/game/combat-engine.ts`. Defeat / victory / flee dismiss the combat state slice entirely. (V8.32)
30. last_settlement_hub_id and navigation_trail update on every successful arrival in step 7c-2. (V8.32)
31. pre_combat_xp captured at encounter start. Defeat handler restores player.xp = pre_combat_xp. (V8.32)
32. Encounter trigger is in step 7c-3. Activates only when shouldRollEncounter passes. (V8.32)
33. Enemy behavior on Day 20 is hardcoded "attack the player" regardless of behavior_flavor field. (V8.32)
34. Returning to a region whose bible is in metadata.region_bibles AND whose graph node is discovered is GRAPH_NAVIGATE, not WORLD_EXPLORE. Step 4d reclassifies via isRegionAlreadyExpanded. (V8.33)
35. apply-regional-bible is idempotent: if the bible is registered AND every location is present in world_graph.nodes, the route returns 200 with skipped: true and does NOT re-write nodes. (V8.33)
36. Re-applying a bible never overwrites discovered: true with discovered: false. mergeNodePreservingDiscovered enforces this on every node merge. (V8.33)
37. arrivedAt in step 7c reads from updatedState.world_state.current_location_id (post-reclassification), not from resolution.state_delta. (V8.33)

---

## Narrator Prompt Order ✅

DIALOGUE: WCD → HARD RULES → RESPONDING CHARACTER → CLOSED CONTEXT (selected knowledge) → TIER 1 OBJECTS → WORLD ASSETS → SCENE → VERBOSITY
non-DIALOGUE: WCD → HARD RULES → NPCS PRESENT → TIER 1 OBJECTS → CONNECTED LOCATIONS → WORLD ASSETS → SCENE → VERBOSITY

Region zone: inject settlement hub + region_locations with compass direction.
Verbosity: terse | standard | rich

(Combat narration prompt order pending Prompt 3.)

---

## Story Feed Colors ✅
```
Narrator prose:        var(--ink-1)
NPC quoted speech:     #e8d5b0 warm cream, italic, weight 600 (--hl-said)
Player actions:        #7ab8c8 teal-blue, 12px mono italic
Item highlights:       #e8c547 yellow (--hl-item)
Region highlights:     #c4b5fd lavender (--hl-region)
Location highlights:   #7dd3fc sky blue (--hl-loc)
Landmark highlights:   #94d8b8 soft mint (--hl-landmark)
NPC highlights:        var(--accent) orange
```

---

## Planned Systems

| System | When | Description |
| --- | --- | --- |
| Combat Prompt 3/3 | NEXT | Combat mode UI + AI narration + bestiary codex entries on encounter + new-game string fix |
| Polish Round (Prompt 4) | After Combat 3 | Settlement card label, tier auto-switch, NPC dialogue contrast, tier-aware nav button colors |
| Map Visual Rework | After Prompt 4 | Dedicated session: decoration, geometry, sizing, hierarchy, label collision |
| Container + Loot | Day 21 | Registry, loot tables, dungeon sub-levels |
| Skills + Leveling | Day 22 | XP, stat points, level gates |
| Main Quest Thread | Day 23 | Breadcrumb injection, quest tracking |
| Random Events | After combat | Region zone + travel encounters |
| Genre UI polish | Post-systems | NPC color overlap with item yellow |

---

## Tech Stack

| Layer | Tool |
| --- | --- |
| Frontend | Next.js 14 (App Router) |
| Styling | Tailwind + shadcn/ui + design tokens |
| Database | Supabase (migrations 001-009) |
| AI (world gen + narration) | claude-sonnet-4-5 |
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
**Claude.ai owns all CLAUDE.md updates.**
Claude Code pushes → user reports commit + test results → Claude.ai updates CLAUDE.md + provides testing checklist → user verifies → next prompt.
**All architecture decisions defer to /docs/architecture-spec.md.**
**All combat decisions defer to /docs/combat-spec.md.**

---

*Last updated: V8.33 — Planning update (no code change). Prompt 3 scope expanded to include bestiary codex entries on encounter and the "Resuming your adventure" → new-game string fix. Three V8.30 wrap-up polish items moved into a dedicated Polish Round (Prompt 4) queued for after Combat Prompt 3 lands; bundled with new tier-aware nav button color request from V8.33 playtest. Combat Prompt 3/3 up next: combat mode UI + narration + bestiary codex + new-game string fix.*
