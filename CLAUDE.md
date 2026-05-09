# Project: Endless Worlds RPG — Master Context

**Version:** 8.36
**Status:** Day 20 Combat COMPLETE + 20.1 Polish + 20.2 Hotfix landed — Polish Round (Prompt 4) Next
**Objective:** A text-based RPG that generates a unique world for every playthrough. Genre-agnostic, infinitely replayable, CRPG depth.

**Reference:** /docs/architecture-spec.md — The definitive source for all Domain 1 vs Domain 2 decisions. /docs/combat-spec.md — The authoritative source for combat system design.

---

## 🔄 Current Status (Read This First)

**Current Phase:** Day 20 Combat fully playable end-to-end with proper pacing, equipment, AND initiative kickoff. Inventory cards now surface combat stats. Polish Round (Prompt 4) is next, bundling four visual UX issues unrelated to combat (with new card-grouping design from V8.36 input).
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
| 20.1 — Combat Polish (1215bb6) | Starting equipment, encounter banner, turn separators, pacing delays, header pill | ✅ Complete |
| **20.2 — Combat Hotfix (bf3871e)** | **Initiative kickoff fix + inventory stats display** | ✅ **Complete** |
| Polish Round (Prompt 4) | Movement-direction grouped nav cards, tier color-coding, settlement card label, tier auto-switch, NPC dialogue contrast | ⏳ Next |
| Map Visual Rework | Dedicated session | ⏳ Deferred (post-Prompt-4) |
| 21 | Container + Loot | ⏳ Pending |
| 22 | Skills + Leveling | ⏳ Pending |
| 23 | Main Quest Thread | ⏳ Pending |

**Active genres:** Fantasy, Cyberpunk, Horror/Lovecraftian, Space Opera, Post-Apocalyptic
**⚠️ Noir removed. Genre renderers restored (pickModule re-enabled).**

### Day 20.2 — Combat Hotfix + Inventory Stats (commit bf3871e — 216/216 tests, clean build)

Two-issue hotfix round closing the V8.35 gap where combat could deadlock on enemy initiative AND equipped gear was invisible from the inventory view.

**Task 1 — Enemy-wins-initiative deadlock fix:**

ROOT CAUSE: `executePlayerAction`'s while-loop is the only place enemy turns auto-advance. ActionBar gates on `isPlayerTurn`. If `rollInitiative` seats an enemy at `turn_order[0]`, the player can't act → no enemy loop fires → permanent deadlock. Reproducible on a forced single high-AGI enemy (e.g. `__forceEncounter("apoc_feral_scavenger")`).

ENGINE FIX (`lib/game/combat-engine.ts`):
- Extracted the enemy-turn loop + defend-buff clear into a new exported pure function `advanceUntilPlayerTurnOrEnd`. Same loop semantics; returns `PlayerActionResult`. `executePlayerAction` now calls it instead of inlining the loop.
- New exported `kickoffCombatIfEnemyFirst({ state, player, world_genre, last_settlement_hub_id, rng })`:
  - No-op when player has initiative (referentially identical state, empty events)
  - Otherwise emits `enemy_phase_start` (so feed gets the same separator framing as a regular post-action enemy phase), runs `advanceUntilPlayerTurnOrEnd`, then emits `player_turn_start` when control returns
  - Propagates resolution payload (defeat in kickoff phase) exactly like `executePlayerAction`

HOOK FIX (`hooks/useCombat.ts`):
- New `kickoffCombat()` async function — mirrors `submitCombatAction`'s flow: `setIsResolving(true)` → engine call → `applyCombatResult` → `projectCombatEventsToFeed` (so all V8.35 pacing delays / banner / displayPhase logic applies) → resync displayPhase → `setIsResolving(false)`. Read-and-bail when player has initiative.
- New `useEffect` watches `masterState.combat.encounter_id` + `active`. When fresh combat lands with enemy initiative AND not already kicked off (tracked via `useRef<Set<string>>`), calls `setDisplayPhase("enemy")` synchronously (no "Your turn" flash) and fires `kickoffCombat`.
- Race the prompt flagged is benign: `useGameLoop` step 7c-3 splices combat into `updatedState`, step 10's `setMasterState` commits, the `useEffect` re-renders and only THEN reads from the store. No microtask plumbing needed; React event loop already orders things correctly. (Doc'd in code comment.)

**Task 2 — Inventory cards now show combat stats:**

`components/game/sidebar/InventoryPanel.tsx` (the actual component rendering inventory rows + detail panel — there's no separate `CharacterSheet/InventoryTab.tsx`):
- New `combatStatsLine(item)` helper. Returns:
  - `"Damage: 1d6"` for WEAPON with `effect.damage_die`
  - `"Armor: +2"` for ARMOR with `effect.armor_bonus` (renders `+0` explicitly so mage robes show as armor with no bonus rather than "missing data")
  - `"Heal: 1d8+4"` for canonical `consumable_basic_health_potion` id (the dice shape `resolveUseItem` actually rolls)
  - `"Heal: N"` for other consumables with a flat `effect.heal` number
  - `null` for KEY / LORE / CONTAINER (no stat line)
- Stats line lives between Description and Stat Bonuses in the detail panel — font-mono, `--hl-item` (yellow), text-[10px]. Visible without dominating.
- New "Equipped" pill rendered next to rarity label when `selectedItem.equipped === true`. Small uppercase tracker, `--hl-pass` green tint with matching border at 18%/50% opacity. Equip/unequip button below already exists; the pill is the at-a-glance indicator.
- Did NOT add row-level Equip buttons — V8.35 already has them in the detail panel; pack-row buttons would clutter the small icon grid.

**Tests (7 new, 216 total passing):**
- `combat-flow.test.ts` (+7): kickoffCombatIfEnemyFirst no-op when player has initiative; runs enemy phase and returns control; emits enemy_phase_start → enemy_attack → player_turn_start ordering; propagates defeat resolution on KO during kickoff (no spurious player_turn_start); multi-enemy turn order resolves in initiative order; advanceUntilPlayerTurnOrEnd returns immediately when already at player's turn; clears `player_defending` when control returns.
- All 5 prior combat-flow tests + 19 prior combat-resolver/trigger tests still pass — the refactor preserves external behavior.

**Build impact:** `/game` route 105 → 106 kB. Build, tsc, and 216 jest tests all green.

### Day 20.1 — Combat Polish (commit 1215bb6 — 209/209 tests, clean build)

Five-task polish round that closes the gap between V8.34's "combat works mechanically" and "combat plays well." Five-task scope: starting equipment fix + encounter banner + turn separators + pacing delays + header pill prominence.

**Task 1 — Starting equipment auto-equipped + combat-functional:**
- New `lib/game/starting-equipment.ts` module extracted from `app/api/game/new/route.ts`. Next.js App Router routes can only export HTTP handlers + a small whitelist of config symbols, so `buildStartingInventory` / `buildItem` couldn't live in the route file.
- Each background ships a `StartingItem[]` array. Every loadout includes:
  - Equipped weapon with `effect.damage_die` (1d4–1d8 by class)
  - Equipped armor with `effect.armor_bonus` (0–2 by class)
  - 2× health potion stacked under canonical `consumable_basic_health_potion` id
  - Class-flavor lore/key item where appropriate
- 15 backgrounds covered (3 per genre × 5 genres). Examples: Knight = Iron Sword 1d6 + Chainmail +2 + 2× potion; Rogue = Dagger 1d4 + Leather +1 + Lockpicks + 2× potion; Street Samurai = Katana 1d8 + Reinforced Jacket +1 + 2× stim.
- Closes the V8.34 gap where every character fought bare-fisted at 1d4 with 0 armor regardless of class.

**Task 2 — Encounter start banner (templated, not LLM):**
- Added `--combat-encounter-banner: #f4a07a;` (light coral) to globals.css.
- `templates.ts::renderRoutineCombatEvent` now handles `combat_start`. Format: 1 enemy: `"You encounter X at <loc>."`; 2 enemies: `"... X and Y at <loc>."`; 3+ Oxford comma chain.
- Removed `combat_start` from useCombat's `isDramaticEvent` set (no LLM call).
- useGameLoop step 7c-3 renders the banner directly. StoryFeed.tsx adds 15px bold italic, light-coral, center-aligned styling with thin coral rules.

**Task 3 — Turn boundary separators (BG-style):**
- `CombatEvent.type` extended with `"player_turn_start"` and `"enemy_phase_start"`.
- combat-engine emits these at phase transitions (NOT on victory/defeat/flee).
- Templates: `"─── Your turn ───"` / `"─── Enemies' turn ───"` / `"─── Round N ───"`. StoryFeed renders 11px italic 0.55 opacity center-aligned.
- Also fixed latent bug: `advanced.events` (round_start) wasn't returned in events array.

**Task 4 — Pacing delays:**
- `ENEMY_PHASE_DELAY_MS = 800`, `PLAYER_TURN_DELAY_MS = 800`, `ENEMY_TURN_GAP_MS = 500`.
- No delay before routine player events. LLM events get API latency.

**Task 5 — Header pill prominence:**
- `displayPhase` decoupled from `current_turn_index`, flips ahead of feed at transitions, 200ms transition.

**Tests:** 36 new (templates 13, combat-flow 5, starting-equipment 18). 209 total. `/game` 104 → 105 kB.

### Combat Day 20 — Prompt 3/3: UI + Narrator + Bestiary + Preamble (commit abf73e6 — 173/173 tests, clean build)

**Task 1 — CSS color tokens + animation keyframes:** Seven combat color variables. New `@keyframes combat-portrait-shake` (4 oscillations / 400ms / ~6px).

**Task 2 — `/components/game/CombatMode/`:** CombatMode (side-by-side player LEFT, divider, enemies RIGHT), CombatantRow (discriminated union over isPlayer, crown ♛ for boss), PortraitSlot (~128px reserved with portraitUrl prop wired), HPBar (300ms transition), ActionBar, TargetPicker, UseItemPicker.

**Task 3 — Page integration:** `useCombat()` plumbed alongside `useGameLoop()`. CombatMode replaces NavigationBar + InputBar at `min-height: min(33vh, 360px)`.

**Task 4 — Story-feed combat events:** Per-event styling. Templated routine via `renderRoutineCombatEvent`, dramatic via `/api/game/narrate-combat`. Variant selection deterministic.

**Task 5 — Combat narrator API:** Auth-gated. Genre tone primer. Hard rules: no monologue, no inventing damage, 1-2 sentences. Model: `claude-sonnet-4-5`, max_tokens 250.

**Task 6 — Bestiary codex:** `writeBestiaryEntry` on `combat_start`, deduplicated by `enemy.id`.

**Task 7 — New-game preamble:** `recent_messages.length === 0` triggers `"Your adventure begins. What will you do first?"`.

**Task 8 — Animations:** HP bar 300ms transition. Crit portrait shake 400ms via transient `shakeMap`.

**Task 9 — 24 new tests, 173 total.**

### Prompt 2.5 — Navigation Fix (commit 25ff111 — 149/149 tests, clean build)

Hyphenated region names slugify wrong → directHit fallback misses → apply-regional-bible re-fires. Architecture extraction: `lib/game/region-expansion-guard.ts` with three pure helpers. Step 4d reclassifies known regions as GRAPH_NAVIGATE. apply-regional-bible idempotent. Discovered preserved on re-apply. 16 new tests.

### Combat Day 20 — Prompt 2/3: Resolver + Triggers + Turn Loop (commit a4e5975 — 133/133 tests, clean build)

Combat state types, combat-resolver (pure math), encounter trigger in step 7c-3, turn loop, navigation_trail tracking, console logger (replaced V8.34), dev override. 61 new tests.

### Combat Day 20 — Prompt 1/3: Data Foundation (commit 1024287 — 72/72 tests, clean build)

Enemy interface, bestiary files (Fantasy 14, others 3 each), WorldBible/RegionBible LLM extensions, validate-don't-500, stub loot drops. 29 new tests.

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
                       separators + pacing (V8.35), initiative kickoff
                       (V8.36), inventory stats display (V8.36), loot
                       resolver (pending Day 21) — pure code
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

### Combat System ✅ COMPLETE (V8.31 + V8.32 + V8.34 + V8.35 + V8.36)
```
DATA LAYER (V8.31):
  Enemy interface, two-tier bestiary, encounter tagging, stub loot drops.

RESOLVER LAYER (V8.32):
  /lib/game/combat-resolver.ts — pure math, RNG injected.
  d20 hit/dmg/init/flee/use_item.

TRIGGER LAYER (V8.32):
  shouldRollEncounter / resolveEnemyLookup / rollEncounter.

TURN LOOP (V8.32, separators V8.35, kickoff V8.36):
  /lib/game/combat-engine.ts — full action resolution + auto-advance.
  Shared advanceUntilPlayerTurnOrEnd helper used by both
  executePlayerAction (post-action) and kickoffCombatIfEnemyFirst
  (combat-start when enemy has initiative).
  Emits player_turn_start + enemy_phase_start at phase transitions.

INITIATIVE KICKOFF (V8.36):
  kickoffCombatIfEnemyFirst — when turn_order[0] !== PLAYER, runs the
  enemy phase before player gets control. Uses shared
  advanceUntilPlayerTurnOrEnd helper. Emits enemy_phase_start +
  player_turn_start to frame the kickoff phase in the feed.
  useCombat.kickoffCombat fires from a useEffect watching
  masterState.combat.encounter_id + active. Tracked via
  useRef<Set<string>> to prevent double-fire. setDisplayPhase("enemy")
  fires synchronously so no "Your turn" flash on enemy-first encounters.

STATE TRACKING (V8.32):
  master_state.combat / last_settlement_hub_id / navigation_trail.

UI LAYER (V8.34):
  /components/game/CombatMode/ — CombatMode, CombatantRow, PortraitSlot,
    HPBar, ActionBar, TargetPicker, UseItemPicker.

NARRATION LAYER (V8.34, refined V8.35):
  /api/game/narrate-combat — genre-specific tone primer.
  Templated: combat_start (V8.35), player_turn_start, enemy_phase_start,
             round_start, all routine events.
  LLM dramatic: crit, kill, victory, defeat, flee_success.

PACING (V8.35):
  ENEMY_PHASE_DELAY_MS = 800 / PLAYER_TURN_DELAY_MS = 800 /
  ENEMY_TURN_GAP_MS = 500. No delay before routine player events.

UI INDICATORS (V8.35):
  CombatMode header pill — 11px bold uppercase mono. displayPhase
  decoupled from current_turn_index.

BESTIARY CODEX (V8.34):
  writeBestiaryEntry on combat_start (deduplicated by enemy.id).

STARTING EQUIPMENT (V8.35):
  /lib/game/starting-equipment.ts — 15 backgrounds, all equipped.
  Knight = Iron Sword 1d6 + Chainmail +2 + 2x potion.

INVENTORY DISPLAY (V8.36):
  components/game/sidebar/InventoryPanel.tsx surfaces combat stats:
  WEAPON → "Damage: 1d6", ARMOR → "Armor: +2", CONSUMABLE →
  "Heal: 1d8+4" (canonical potion) or "Heal: N" (flat). KEY/LORE
  show no stat line. EQUIPPED pill (--hl-pass green) on detail panel.

DEV TOOLS (V8.32):
  window.__forceEncounter("enemy_id", ...) — dev-only override.
```

### Region Expansion Guard ✅ (V8.33)
```
/lib/game/region-expansion-guard.ts — pure helpers, two callers:
isRegionAlreadyExpanded / isApplyRegionalBibleRedundant /
mergeNodePreservingDiscovered.

ROOT CAUSE: toSlug() strips hyphens. Guard works AROUND this.
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
- kickoffCombat fires from useEffect when enemy has initiative (V8.36)
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

**Prompt 4 — Polish Round (NEXT — design locked V8.36):**
Dedicated visual polish round bundling four small UX issues plus the new card-grouping design. Each independent — no architecture dependencies. Best done together now that Combat is stable.
- **Movement-direction grouped nav cards (NEW V8.36).** Nav bar groups cards into rows by movement direction: BACK / DEEPER / PEER / UNDISCOVERED. Empty groups don't render. Group labels light/optional. Tier color-coding (next bullet) layers on top within each group — direction tells where, color tells what kind of place.
- **Tier-aware nav button colors (V8.33 request).** Each card type gets a distinct visual treatment by destination tier. Region cards (lavender), settlement cards (sky-blue), sub-location cards (mint), dungeon cards (new color). Layered with movement-direction grouping above.
- **Settlement hub card on new region arrival reads as back-from-settlement.** Functional but visually misleading. Card-typing issue in NavigationBar's region-zone D2 branch — needs to distinguish "settlement hub of CURRENT region" (deeper-into card) from "place player just left" (back card). Confirmed still present through V8.36 playtesting.
- **Map does not auto-switch tiers on cross-region arrival.** Initial-mount default works (V8.30) but doesn't re-fire on cross-zone arrival.
- **NPC dialogue text needs higher contrast.** `.ew-said` doesn't read distinctly enough from surrounding ink-2 prose.

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
- 800ms / 500ms / 800ms delays are tuned guesses. May need adjustment after extended playtest.

**Other deferred:**
- NPC highlight color (orange) too similar to item highlight (yellow) in Fantasy.
- Hub node not added to codex on first arrival to new region.
- Step 7 individual branches: confirm each sets `discovered: true` (relying on Fix 2 safety net).
- Starting region nodes lack `grid_position` — masked by V8.28 isValidPos guard.
- Behavior dispatch beyond flavor text deferred (combat-spec §6.3) — every enemy just attacks the player every turn.
- `toSlug` strips hyphens — masked by V8.33 region-expansion-guard.
- Combat balance at character level 1 vs regional enemies is intentionally punishing pre-Day-21 (Container + Loot adds better gear) and pre-Day-22 (leveling adds stat growth).

---

## 🏗️ Architecture

### The Two Domains ✅
**Domain 1 (Engine — pure code):** Navigation, stat checks, dialogue option generation, combat resolver + turn loop + encounter triggers (V8.32), region expansion guard (V8.33), combat UI + narrator + bestiary (V8.34), turn separators + pacing + starting equipment module (V8.35), initiative kickoff + inventory stats display (V8.36), loot resolver (pending Day 21).
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
49. Enemy-turn loop logic is shared via `advanceUntilPlayerTurnOrEnd` (combat-engine.ts). Both `executePlayerAction` (post-action auto-advance) and `kickoffCombatIfEnemyFirst` (combat-start when enemy has initiative) call it. Single source of truth for the loop. (V8.36)
50. When combat starts with `turn_order[0] !== PLAYER`, the initial enemy phase MUST fire before UI hands control to the player. `useCombat` watches `masterState.combat.encounter_id + active` via useEffect, fires `kickoffCombat` on fresh enemy-initiative encounters. Tracked via `useRef<Set<string>>` to prevent double-fire. setDisplayPhase("enemy") fires synchronously so no "Your turn" flash. (V8.36)
51. Inventory detail panel surfaces combat stats: WEAPON → `Damage: <die>`, ARMOR → `Armor: +<bonus>` (always rendered, including +0), CONSUMABLE → `Heal: 1d8+4` (canonical potion id) or `Heal: N` (flat). KEY/LORE/CONTAINER show no stat line. EQUIPPED pill renders next to rarity when `selectedItem.equipped === true`. (V8.36)

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
| Polish Round (Prompt 4) | NEXT | Movement-direction grouped nav cards + tier color-coding, settlement card label, tier auto-switch, NPC dialogue contrast |
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

*Last updated: V8.36 — Day 20.2 Combat Hotfix (commit bf3871e): enemy-wins-initiative deadlock fixed via `kickoffCombatIfEnemyFirst` + shared `advanceUntilPlayerTurnOrEnd` refactor; useCombat fires kickoff via useEffect on fresh enemy-initiative encounters with double-fire guard; inventory detail panel now shows Damage/Armor/Heal stat line + EQUIPPED pill. 216/216 tests passing. /game route 105 → 106 kB. Foundational rules 49-51 added. Polish Round (Prompt 4) up next with V8.36 design lock-in: movement-direction grouped nav cards (BACK/DEEPER/PEER/UNDISCOVERED rows) + tier color-coding within each group + settlement card label + tier auto-switch + NPC dialogue contrast.*
