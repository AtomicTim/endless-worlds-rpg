# Project: Endless Worlds RPG — Master Context

**Version:** 8.35
**Status:** Day 20 Combat COMPLETE + Combat Polish landed — Polish Round (Prompt 4) Next
**Objective:** A text-based RPG that generates a unique world for every playthrough. Genre-agnostic, infinitely replayable, CRPG depth.

**Reference:** /docs/architecture-spec.md — The definitive source for all Domain 1 vs Domain 2 decisions. /docs/combat-spec.md — The authoritative source for combat system design.

---

## 🔄 Current Status (Read This First)

**Current Phase:** Day 20 Combat fully playable end-to-end with proper pacing and equipment. Knight feels like a knight from turn one. Polish Round (Prompt 4) is next, bundling four visual UX issues unrelated to combat.
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
| 20 — Combat Prompt 3/3 (abf73e6) | Combat mode UI + narration + bestiary codex + new-game string fix | ✅ Complete |
| **20.1 — Combat Polish (1215bb6)** | **Starting equipment, encounter banner, turn separators, pacing delays, header pill** | ✅ **Complete** |
| Polish Round (Prompt 4) | Settlement card label, tier auto-switch, NPC dialogue contrast, tier-aware nav button colors | ⏳ Next |
| Map Visual Rework | Dedicated session | ⏳ Deferred (post-Prompt-4) |
| 21 | Container + Loot | ⏳ Pending |
| 22 | Skills + Leveling | ⏳ Pending |
| 23 | Main Quest Thread | ⏳ Pending |

**Active genres:** Fantasy, Cyberpunk, Horror/Lovecraftian, Space Opera, Post-Apocalyptic
**⚠️ Noir removed. Genre renderers restored (pickModule re-enabled).**

### Day 20.1 — Combat Polish (commit 1215bb6 — 209/209 tests, clean build)

Five-task polish round that closes the gap between V8.34's "combat works mechanically" and "combat plays well." Five-task scope: starting equipment fix + encounter banner + turn separators + pacing delays + header pill prominence.

**Task 1 — Starting equipment auto-equipped + combat-functional:**
- New `lib/game/starting-equipment.ts` module extracted from `app/api/game/new/route.ts`. Next.js App Router routes can only export HTTP handlers + a small whitelist of config symbols, so `buildStartingInventory` / `buildItem` couldn't live in the route file.
- Each background ships a `StartingItem[]` array. Every loadout includes:
  - Equipped weapon with `effect.damage_die` (1d4–1d8 by class)
  - Equipped armor with `effect.armor_bonus` (0–2 by class)
  - 2× health potion stacked under canonical `consumable_basic_health_potion` id (so `resolveUseItem` returns the 1d8+4 heal)
  - Class-flavor lore/key item where appropriate (lockpicks, spell tome, command badge, etc.)
- 15 backgrounds covered (3 per genre × 5 genres). Examples: Knight = Iron Sword 1d6 + Chainmail +2 + 2× potion; Rogue = Dagger 1d4 + Leather +1 + Lockpicks + 2× potion; Street Samurai = Katana 1d8 + Reinforced Jacket +1 + 2× stim.
- Closes the V8.34 gap where every character fought bare-fisted at 1d4 with 0 armor regardless of class because starting items lacked `equipped: true` and `effect.damage_die`.

**Task 2 — Encounter start banner (templated, not LLM):**
- Added `--combat-encounter-banner: #f4a07a;` (light coral) to globals.css.
- `templates.ts::renderRoutineCombatEvent` now handles `combat_start` with `enemyNames` + optional `locationName` context. Format:
  - 1 enemy: `"You encounter X at <loc>."`
  - 2 enemies: `"You encounter X and Y at <loc>."`
  - 3+ enemies: Oxford-comma chain `"You encounter X, Y, and Z at <loc>."`
  - No location: drops `at <loc>` suffix
- Removed `combat_start` from useCombat's `isDramaticEvent` set (no more LLM call for it).
- useGameLoop step 7c-3 (encounter trigger) renders the templated banner directly when combat starts — `combat_start` lives in `combat.combat_log` but is never part of an `executePlayerAction` batch, so the regular useCombat drain wouldn't see it.
- StoryFeed.tsx adds a `combat_start` styling branch: 15px bold italic, light-coral, center-aligned, with thin 35%-opacity rules above and below.

**Task 3 — Turn boundary separators (BG-style):**
- `CombatEvent.type` extended with `"player_turn_start"` and `"enemy_phase_start"`.
- `combat-engine.ts::executePlayerAction` now:
  - Emits `enemy_phase_start` after `advanceTurn()` runs and the next combatant is an enemy AND combat hasn't ended
  - Emits `player_turn_start` after the enemy loop completes IFF an enemy phase actually fired AND control returned to the player AND combat didn't end (no separator on victory/defeat/flee)
- Also fixed a latent bug: `advanced.events` (which carries `round_start`) wasn't being pushed into the returned events array — only into `combat_log`. Now both.
- Templates: `player_turn_start` → `"─── Your turn ───"`, `enemy_phase_start` → `"─── Enemies' turn ───"`, `round_start` → `"─── Round N ───"` (using `roundNumber` from context).
- StoryFeed.tsx renders all three separator types as 11px italic, 0.55 opacity, center-aligned, no ⚔ prefix.

**Task 4 — Pacing delays at turn transitions:**
- Constants in `useCombat.ts`: `ENEMY_PHASE_DELAY_MS = 800`, `PLAYER_TURN_DELAY_MS = 800`, `ENEMY_TURN_GAP_MS = 500`.
- `projectCombatEventsToFeed` sleeps 800ms before pushing `enemy_phase_start`, 800ms before pushing `player_turn_start`, 500ms between successive distinct enemy actors during the enemy phase.
- No delay before routine player events — instant feedback when the player clicks.
- LLM events get their existing API latency as the delay; no extra sleep on top.
- `isResolving` stays true for the full drain so ActionBar is disabled the whole time — no double-tap during pacing.

**Task 5 — Header pill prominence:**
- `useCombat` exposes a `displayPhase: "player" | "enemy"` decoupled from `combat.current_turn_index`. Set BEFORE each pacing sleep so the pill flips ahead of the feed at phase transitions. Resynced to engine's authoritative index after the drain ends.
- CombatMode header pill: 11px bold uppercase mono, 0.24em letter-spacing, padded box with tinted background (combat-player/combat-enemy mixed 28% into bg-2), 1px colored border, 200ms ease-out transition on background/border/color.
- Fallback to engine's index when `displayPhase` is omitted (defensive against future callers).

**Tests (36 new, 209 total passing):**
- `templates.test.ts` (+13): `combat_start` with 1/2/3+/4+ enemies × with/without location, empty/whitespace location handling, no-names defensive default, `player_turn_start` separator, `enemy_phase_start` separator, `round_start` with and without round number.
- `combat-flow.test.ts` (+5): turn-separator emission ordering, victory/defeat/flee-success paths emit no separators (combat ended).
- `starting-equipment.test.ts` (+18): every genre × background (15 combos) verified for equipped weapon with valid damage_die, equipped armor with non-negative armor_bonus, ≥1 consumable; potion id stability; buildItem stable-id + UUID paths; stackable defaults; quantity defaults; unknown background returns empty payload.

**Build impact:** `/game` route 104 → 105 kB. Build, tsc, and 209 jest tests all green.

### Combat Day 20 — Prompt 3/3: UI + Narrator + Bestiary + Preamble (commit abf73e6 — 173/173 tests, clean build)

**Task 1 — CSS color tokens + animation keyframes:**
- Seven combat color variables (`--combat-player`, `--combat-enemy`, `--combat-player-crit`, `--combat-enemy-crit`, `--combat-victory`, `--combat-defeat`, `--combat-flee`).
- New `@keyframes combat-portrait-shake` (4 oscillations / 400ms / ~6px) plus `.combat-portrait-shake` utility.

**Task 2 — `/components/game/CombatMode/`:**
- `CombatMode.tsx` — top panel. Side-by-side: player LEFT, divider, enemies RIGHT. Header pill + `shakeMap` for crits.
- `CombatantRow.tsx` — single column. Discriminated union over `isPlayer`. Crown ♛ + bold name when `is_boss`.
- `PortraitSlot.tsx` — reserved square ~128px with `portraitUrl` prop wired for future image swap.
- `HPBar.tsx` — 300ms width transition, color thresholds.
- `ActionBar.tsx` — Attack/Defend/Use Item/Flee. Plain text labels.
- `TargetPicker.tsx` — inline hint banner + Esc handler.
- `UseItemPicker.tsx` — modal listing CONSUMABLE rows.

**Task 3 — Page integration:** `useCombat()` plumbed alongside `useGameLoop()`. CombatMode replaces NavigationBar + InputBar at `min-height: min(33vh, 360px)`.

**Task 4 — Story-feed combat events:** Per-event styling by `event_type`/`actor`/`outcome`. Templated routine events via `renderRoutineCombatEvent`, dramatic events via `/api/game/narrate-combat`. Variant selection deterministic via timestamp hash.

**Task 5 — Combat narrator API (`/api/game/narrate-combat`):** Auth-gated. Genre-specific tone primer (Fantasy = blood-and-steel, etc.). Hard rules: no monologue, no inventing damage, 1-2 sentences. Model: `claude-sonnet-4-5`, max_tokens 250.

**Task 6 — Bestiary codex:** `writeBestiaryEntry` on `combat_start`, deduplicated by `enemy.id`. Description: flavor + HP range + damage die + first-seen location.

**Task 7 — New-game preamble:** `recent_messages.length === 0` → `"Your adventure begins. What will you do first?"` rendered as `isFreshGamePreamble` italic low-opacity serif.

**Task 8 — Animations:** HP bar 300ms transition, crit portrait shake 400ms via transient `shakeMap`.

**Task 9 — 24 new tests, 173 total passing.**

### Prompt 2.5 — Navigation Fix (commit 25ff111 — 149/149 tests, clean build)

Hyphenated region names (`"The Chain-Keeps Borderland"`) slugify to `the_chainkeeps_borderland` while canonical id is `the_chain_keeps_borderland`. directHit fallback misses, classifyMove returns WORLD_EXPLORE, apply-regional-bible re-fires.

**Architecture extraction:** `lib/game/region-expansion-guard.ts` with three pure helpers (`isRegionAlreadyExpanded`, `isApplyRegionalBibleRedundant`, `mergeNodePreservingDiscovered`).

**Fix 1 — Step 4d reclassification:** Known region = GRAPH_NAVIGATE, not WORLD_EXPLORE.
**Fix 2 — Idempotence guard:** redundant apply returns 200 with `skipped: true`.
**Fix 3 — Preserve discovered on re-apply.**
**`arrivedAt` patched** to read from `updatedState` (post-reclassification).

**Tests:** 16 new, 149 total.

### Combat Day 20 — Prompt 2/3: Resolver + Triggers + Turn Loop (commit a4e5975 — 133/133 tests, clean build)

**Task 1 — Combat state in types/game.ts:** `CombatEnemyInstance`, `CombatEvent`, `CombatState` interfaces. `MasterState` extended with `combat`, `last_settlement_hub_id`, `navigation_trail`.

**Task 2 — `/lib/game/combat-resolver.ts` (pure math):** d20 hit/dmg/init/flee/use_item.

**Task 3 — Encounter trigger in step 7c-3:** `shouldRollEncounter`, `resolveEnemyLookup` (4-layer fall-through), `rollEncounter`.

**Task 4 — Turn loop in `/lib/game/combat-engine.ts`:** `executePlayerAction`, `advanceEnemyTurn`, victory/defeat/flee handlers.

**Task 5 — Tracking in step 7c-2:** `navigation_trail` (last 5), `last_settlement_hub_id`.

**Task 6 — Console combat logger** (replaced in V8.34 with story-feed rendering).

**Task 7 — Dev override:** `window.__forceEncounter`.

**Task 8 — 61 new tests, 133 total.**

### Combat Day 20 — Prompt 1/3: Data Foundation (commit 1024287 — 72/72 tests, clean build)

**Task 1 — Enemy types in types/game.ts.**
**Task 2 — Bestiary files** (Fantasy 14 entries, others 3 placeholders each).
**Task 3-5 — WorldBible + RegionBible LLM prompt extensions + apply persistence with validate-don't-500.**
**Task 6 — Stub loot drops.**
**Task 7 — 29 new tests, 72 total.**

### Region / Resilience Round (commit 87c89a3 — 43/43 tests)
Region tier description from parent for any node; map defaults to Local; landmark color flipped to mint; new region wires origin symmetrically; RegionBible stub fallback.

### Polish Round (commit b7032f9 — 43/43 tests)
Tier-aware highlight colors; NPC speech warm cream italic 600; region zone retains adjacent cards on return; React key-prop-spread silenced.

### Targeted Fix Round (commit dc5bcd8 — 43/43 tests)
apply-regional-bible 500 NPE guarded; region zone description populates correctly.

### Regression Fix Round (commit 75a7cd4 — 43/43 tests)
Cache hit pipeline; sub-location nav cards back-to-hub only; map text/icons larger; `?` underline removed; description sourcing per tier.

### Bug Fix Round (commit 57b0300 — 43/43 tests)
Highlight nav uses node id; discovered safety net; section header on cross-node nav.

### Architecture Hardening (commit 57d27f3 — 43/43 tests)
Land at region zone after generation; world map overlap fix; write-once arrival cache + codex dedup; code-built dialogue options; genre renderers restored.

### Architecture Status ✅
```
Domain 1 (Engine):     World graph, navigation, stat checks, dialogue option
                       generation, combat resolver (V8.32), combat turn loop
                       (V8.32), encounter triggers (V8.32), region expansion
                       guard (V8.33), combat UI (V8.34), bestiary codex
                       (V8.34), starting equipment module (V8.35), turn
                       separators + pacing (V8.35), loot resolver (pending
                       Day 21) — pure code
Domain 2 (Content):    WCD, WorldBible (with enemies + encounter tagging),
                       RegionBible (same), NPCs, items, bestiary,
                       starting-equipment loadouts (V8.35) — frozen

AI during gameplay:
  ✅ Arrival narration  — first visit only, cached permanently after
  ✅ Dialogue options   — built by code, AI writes response only
  ✅ Action narration   — 1-4 sentences
  ✅ NPC not present    — hardcoded "X isn't here"
  ✅ Combat round narration — dramatic events ONLY (crit, kill, victory,
                              defeat, flee_success), 1-2 sentences,
                              genre-specific tone primer.
                              combat_start moved to templated (V8.35)
  ⏳ Container search   — pending Container+Loot system
```

### Combat System ✅ COMPLETE (V8.31 + V8.32 + V8.34 + V8.35)
```
DATA LAYER (V8.31):
  Enemy interface, two-tier bestiary, encounter tagging, stub loot drops.

RESOLVER LAYER (V8.32):
  /lib/game/combat-resolver.ts — pure math, RNG injected.
  d20 hit/dmg/init/flee/use_item.

TRIGGER LAYER (V8.32):
  shouldRollEncounter / resolveEnemyLookup / rollEncounter.

TURN LOOP (V8.32, separators V8.35):
  /lib/game/combat-engine.ts — full action resolution + auto-advance.
  Emits player_turn_start + enemy_phase_start at phase transitions.
  round_start now correctly returned in events array (V8.35 bug fix).

STATE TRACKING (V8.32):
  master_state.combat / last_settlement_hub_id / navigation_trail.

UI LAYER (V8.34):
  /components/game/CombatMode/ — CombatMode, CombatantRow, PortraitSlot,
    HPBar, ActionBar, TargetPicker, UseItemPicker.
  Side-by-side layout: player left, divider, enemies right.
  Story feed combat events with per-event styling.
  HP bar 300ms transition. Crit portrait shake 400ms.

NARRATION LAYER (V8.34, refined V8.35):
  /api/game/narrate-combat — genre-specific tone primer.
  Templated: combat_start (V8.35), player_turn_start, enemy_phase_start,
             round_start, all routine events.
  LLM dramatic: crit, kill, victory, defeat, flee_success.
  Deterministic variant selection by event timestamp hash.

PACING (V8.35):
  ENEMY_PHASE_DELAY_MS = 800 (before "Enemies' turn" separator)
  PLAYER_TURN_DELAY_MS = 800 (before "Your turn" separator)
  ENEMY_TURN_GAP_MS = 500 (between successive distinct enemy actors)
  No delay before routine player events.

UI INDICATORS (V8.35):
  CombatMode header pill — 11px bold uppercase mono, 0.24em spacing,
  tinted background (combat-player/combat-enemy 28% into bg-2),
  1px colored border, 200ms transition.
  displayPhase decoupled from current_turn_index — flips ahead of feed
  at phase transitions. Authoritatively resynced after drain.

BESTIARY CODEX (V8.34):
  writeBestiaryEntry on combat_start (deduplicated by enemy.id).
  Description: flavor + HP range + damage die + first-seen location.

STARTING EQUIPMENT (V8.35):
  /lib/game/starting-equipment.ts — extracted from new-game route.
  15 backgrounds (3 per genre × 5 genres). Each ships:
    - Equipped weapon with effect.damage_die (1d4-1d8 by class)
    - Equipped armor with effect.armor_bonus (0-2 by class)
    - 2x basic health potion
    - Class-flavor lore/key item where appropriate
  Knight = Iron Sword 1d6 + Chainmail +2 + 2x potion.
  Combat resolver reads from inventory; no fallback to fists at game start.

DEV TOOLS (V8.32):
  window.__forceEncounter("enemy_id", ...) — dev-only override.
```

### Region Expansion Guard ✅ (V8.33)
```
/lib/game/region-expansion-guard.ts — pure helpers, two callers:

isRegionAlreadyExpanded / isApplyRegionalBibleRedundant /
mergeNodePreservingDiscovered.

ROOT CAUSE: toSlug() strips hyphens. Guard works AROUND this. Fixing
toSlug itself is high-blast-radius.
```

### Navigation Rules ✅ (Complete)
```
Map = PURELY VISUAL. Genre renderers active. All navigation via nav bar.

Card grammar: [← BACK] [→ DEEPER...] [↑ EXIT] [◆ PEER...] [◇ UNDISCOVERED...]

Region trigger reclassification (V8.33):
- Step 4d checks isRegionAlreadyExpanded BEFORE expanding
- Known region → GRAPH_NAVIGATE, no apply-regional-bible call

Combat trigger:
- Step 7c-3: shouldRollEncounter on every arrival
- last_settlement_hub_id + navigation_trail update on every arrival
- arrivedAt sourced from updatedState (post-reclassification)
- combat_start writes bestiary codex entries (V8.34)
- combat_start renders templated banner directly from useGameLoop (V8.35)
```

### Map Description Sourcing ✅ (V8.27, hardened V8.28, generalized V8.30)
```
World tier  → wcd.world_description
Region tier → currentRegion.atmosphere (via parentRegionId chain walk)
Local tier  → currentLocation.atmosphere
```

### NPC Dialogue System ✅
```
Option list: built by code from NPC.knowledge[] asset
AI writes: response text only
NPC quoted speech: .ew-said class — pending higher-contrast pass in Prompt 4.
```

### RegionBible Resilience ✅ (V8.30, extended V8.31, idempotent V8.33)
```
Model: claude-haiku-4-5-20251001, max_tokens: 7000.
Stub fallback. Idempotent on re-apply.
```

### WorldBible Resilience ✅ (V8.31)
```
Model: claude-sonnet-4-5, max_tokens: 10000.
validateEnemy / validateEnemies / scrubEncounterRoster — warn-don't-500.
```

### Known issues

**Prompt 4 — Polish Round (NEXT):**
Dedicated visual polish round bundling four small UX issues. Each independent — no architecture dependencies. Best done together now that Combat is stable.
- **Settlement hub card on new region arrival reads as back-from-settlement.** Functional but visually misleading. Card-typing issue in NavigationBar's region-zone D2 branch — needs to distinguish "settlement hub of CURRENT region" (deeper-into card) from "place player just left" (back card). Confirmed still present through V8.35 playtesting.
- **Map does not auto-switch tiers on cross-region arrival.** Initial-mount default works (V8.30) but doesn't re-fire on cross-zone arrival.
- **NPC dialogue text needs higher contrast.** `.ew-said` doesn't read distinctly enough from surrounding ink-2 prose.
- **Tier-aware nav button colors (V8.33 request).** Each card type currently looks identical regardless of destination tier. Region cards, dungeon cards, settlement cards, and sub-location cards each get distinct visual treatment. Distinct color per tier matching existing highlight tokens.

**Map visual rework (dedicated session, post-Prompt-4):**
- Per-node decorative shelf line under every node. Cleanup needed.
- Connection lines pass through node icons instead of terminating at edges.
- Overall sizing and visual hierarchy still cramped.
- Map label collision: World/Region tier labels overlap.
- Whole-renderer redesign needed.

**Component test infrastructure (V8.34 deferral):**
- Project jest configured `testEnvironment: "node"` — no jsdom/RTL setup.
- Adding RTL infrastructure is a separate task — not blocking.

**Pacing tuning (V8.35 watchpoint):**
- 800ms / 500ms / 800ms delays are tuned guesses. May need adjustment after extended playtest. Halving in a one-line follow-up is trivial if too slow.

**Other deferred:**
- NPC highlight color (orange) too similar to item highlight (yellow) in Fantasy.
- Hub node not added to codex on first arrival to new region.
- Step 7 individual branches: confirm each sets `discovered: true` (relying on Fix 2 safety net).
- Starting region nodes lack `grid_position` — masked by V8.28 isValidPos guard.
- Behavior dispatch beyond flavor text deferred (combat-spec §6.3) — every enemy just attacks the player every turn.
- `toSlug` strips hyphens — masked by V8.33 region-expansion-guard.
- Combat balance at character level 1 vs regional enemies is intentionally punishing pre-Day-21 (Container + Loot adds better gear) and pre-Day-22 (leveling adds stat growth). Two regional enemies + starter equipment = "fight or flee" decision, not "win easily."

---

## 🏗️ Architecture

### The Two Domains ✅
**Domain 1 (Engine — pure code):** Navigation, stat checks, dialogue option generation, combat resolver + turn loop + encounter triggers (V8.32), region expansion guard (V8.33), combat UI + narrator + bestiary (V8.34), turn separators + pacing + starting equipment module (V8.35), loot resolver (pending Day 21).
**Domain 2 (Content Library — frozen):** WCD, locations, NPCs, items, loot tables, main quest, bestiary, region enemies, starting equipment loadouts (V8.35).

### Generation Model ✅
RegionBible: claude-haiku-4-5-20251001, max_tokens: 7000. Stub fallback. Idempotent on re-apply.
WorldBible: claude-sonnet-4-5, max_tokens: 10000. Includes enemies + encounter tagging.
WCD includes `world_description`.
Combat narrator: claude-sonnet-4-5, max_tokens: 250. Genre tone primer per call. Dramatic events only (V8.35).

### Map System ✅
```
Genre renderers active (pickModule enabled).
PAD=76. Tier switcher. Current node highlighted.
Initial tier on mount: Local (V8.30).

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
15. Region zone assets always populate both `constitution.physical_description` AND `constitution.atmosphere` from same source prose. (V8.28)
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
34. Returning to a region whose bible is in metadata.region_bibles AND whose graph node is discovered is GRAPH_NAVIGATE, not WORLD_EXPLORE. (V8.33)
35. apply-regional-bible is idempotent: skipped: true when redundant. (V8.33)
36. mergeNodePreservingDiscovered preserves discovered: true on re-apply. (V8.33)
37. arrivedAt in step 7c reads from updatedState (post-reclassification). (V8.33)
38. Combat narration is selective: routine events use code-templated lines (no API call); dramatic events (crit, kill, victory, defeat, flee_success) call /api/game/narrate-combat. Variant selection deterministic via timestamp hash. (V8.34, refined V8.35: combat_start now templated)
39. CombatMode is the bottom-strip swap when `master_state.combat?.active === true`. NavigationBar + InputBar hide; CombatMode renders at min-height: min(33vh, 360px). Story feed shrinks above but remains scrollable. (V8.34)
40. Each combatant row reserves a portrait slot (~128px). Day 20: single-letter glyph placeholder. portraitUrl prop accepts real images later without layout change. (V8.34)
41. Bestiary codex entries write on `combat_start`, deduplicated by enemy.id. Description: flavor + HP range + damage die + first-seen location. (V8.34)
42. New game preamble: `recent_messages.length === 0` triggers "Your adventure begins. What will you do first?" with isFreshGamePreamble flag. (V8.34)
43. Starting equipment lives in `lib/game/starting-equipment.ts` as a separate module. Next.js App Router routes can only export HTTP handlers + a small whitelist; helpers like `buildStartingInventory` and `buildItem` cannot live in route files. (V8.35)
44. Every starting weapon ships with `equipped: true` AND `effect.damage_die` populated. Every starting armor ships with `equipped: true` AND `effect.armor_bonus` populated. The combat-engine's `weaponDamageDie()` and `playerArmorBonus()` resolve real values immediately at game start; no character is ever fighting fists at game start. (V8.35)
45. `combat_start` is templated, not LLM-narrated. Renders directly from useGameLoop step 7c-3 since the event lives in `combat.combat_log` but is never part of an `executePlayerAction` batch. (V8.35)
46. `player_turn_start` and `enemy_phase_start` events are emitted by combat-engine at phase transitions and rendered as separator lines in the story feed. They do NOT emit when combat ends in victory/defeat/flee. (V8.35)
47. Pacing delays at turn transitions: 800ms before `enemy_phase_start`, 800ms before `player_turn_start`, 500ms between successive distinct enemy actors. No delay before routine player events — instant feedback when player clicks. LLM events get their existing API latency as the delay. (V8.35)
48. CombatMode header pill `displayPhase` is decoupled from `combat.current_turn_index` and flips ahead of feed at phase transitions for visual responsiveness. Authoritatively resynced after drain. The pill — not the feed — is the canonical turn indicator. (V8.35)

---

## Narrator Prompt Order ✅

DIALOGUE: WCD → HARD RULES → RESPONDING CHARACTER → CLOSED CONTEXT (selected knowledge) → TIER 1 OBJECTS → WORLD ASSETS → SCENE → VERBOSITY
non-DIALOGUE: WCD → HARD RULES → NPCS PRESENT → TIER 1 OBJECTS → CONNECTED LOCATIONS → WORLD ASSETS → SCENE → VERBOSITY
COMBAT (V8.34): GENRE TONE PRIMER → COMBAT EVENT (mechanical truth) → HARD RULES → 1-2 sentence response

Verbosity: terse | standard | rich (combat narration is always 1-2 sentences regardless)

---

## Story Feed Colors ✅
```
Narrator prose:        var(--ink-1)
NPC quoted speech:     #e8d5b0 warm cream, italic, weight 600 (--hl-said)
Player actions:        #7ab8c8 teal-blue, 12px mono italic (out-of-combat)
Item highlights:       #e8c547 yellow (--hl-item)
Region highlights:     #c4b5fd lavender (--hl-region)
Location highlights:   #7dd3fc sky blue (--hl-loc)
Landmark highlights:   #94d8b8 soft mint (--hl-landmark)
NPC highlights:        var(--accent) orange

COMBAT (V8.34):
  Routine player action:   #7ab8c8 teal (--combat-player)
  Routine enemy action:    #e87c6d warm red (--combat-enemy)
  Player crit:             #3b82a8 deeper blue, BOLD (--combat-player-crit)
  Enemy crit:              #c0392b blood red, BOLD (--combat-enemy-crit)
  Victory (1.5x bold):     #7dbb8e mossy green (--combat-victory)
  Defeat (1.5x bold):      #a93226 dark red (--combat-defeat)
  Flee success (1.5x):     #a8a29c grey-tan (--combat-flee)

COMBAT (V8.35):
  Encounter banner:        #f4a07a light coral (--combat-encounter-banner)
                           15px bold italic, center-aligned, thin coral
                           rules above and below
  Turn separators:         11px italic, 0.55 opacity --ink-2,
                           center-aligned, no ⚔ prefix
                           ("─── Your turn ───" / "─── Enemies' turn ───" /
                            "─── Round N ───")
```

---

## Planned Systems

| System | When | Description |
| --- | --- | --- |
| Polish Round (Prompt 4) | NEXT | Settlement card label, tier auto-switch, NPC dialogue contrast, tier-aware nav button colors |
| Map Visual Rework | After Prompt 4 | Dedicated session: decoration, geometry, sizing, hierarchy, label collision |
| Container + Loot | Day 21 | Registry, loot tables, dungeon sub-levels, real loot beyond stub |
| Skills + Leveling | Day 22 | XP, stat points, level gates, special combat abilities |
| Main Quest Thread | Day 23 | Breadcrumb injection, quest tracking |
| Random Events | After Day 21 | Region zone + travel encounters (per combat-spec §3 deferral) |
| Player-initiated combat | After Day 21 | "Attack X" intent classifier path |
| Behavior dispatch | Future combat-depth pass | Enemies use behavior_flavor mechanically |
| Component test infra (RTL) | When UI test coverage critical | jsdom + React Testing Library setup |
| Genre UI polish | Post-systems | NPC color overlap with item yellow |

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
**Claude.ai owns all CLAUDE.md updates.**
Claude Code pushes → user reports commit + test results → Claude.ai updates CLAUDE.md + provides testing checklist → user verifies → next prompt.
**All architecture decisions defer to /docs/architecture-spec.md.**
**All combat decisions defer to /docs/combat-spec.md.**

---

*Last updated: V8.35 — Day 20.1 Combat Polish (commit 1215bb6): starting-equipment module extraction with 15 fully-equipped backgrounds, encounter banner template (no more LLM call for combat_start), turn boundary separators (player_turn_start + enemy_phase_start) emitted by engine, pacing delays 800/500/800ms, header pill displayPhase decoupled with 200ms color transition. 209/209 tests passing. /game route 104 → 105 kB. Foundational rules 43-48 added. Polish Round (Prompt 4) up next: settlement card label, tier auto-switch, NPC dialogue contrast, tier-aware nav button colors.*
