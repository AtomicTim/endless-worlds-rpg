# Project: Endless Worlds RPG — Master Context

**Version:** 8.32
**Status:** Active Development — Combat Day 20 Prompt 2/3 (Resolver + Triggers + Turn Loop) Complete
**Objective:** A text-based RPG that generates a unique world for every playthrough. Genre-agnostic, infinitely replayable, CRPG depth.

**Reference:** /docs/architecture-spec.md — The definitive source for all Domain 1 vs Domain 2 decisions. /docs/combat-spec.md — The authoritative source for combat system design.

---

## 🔄 Current Status (Read This First)

**Current Phase:** Combat Day 20 Prompt 2/3 complete. Combat is fully testable from console + state inspection. Combat Mode UI (Prompt 3) up next — that's when combat becomes visually playable.
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
| **20 — Combat Prompt 2/3 (a4e5975)** | **Resolver + encounter triggers + turn loop** | ✅ **Complete** |
| 20 — Combat Prompt 3/3 | Combat mode UI + narration integration | ⏳ Next |
| Map Visual Rework | Dedicated session | ⏳ Deferred (post-combat) |
| 21 | Container + Loot | ⏳ Pending |
| 22 | Skills + Leveling | ⏳ Pending |
| 23 | Main Quest Thread | ⏳ Pending |

**Active genres:** Fantasy, Cyberpunk, Horror/Lovecraftian, Space Opera, Post-Apocalyptic
**⚠️ Noir removed. Genre renderers restored (pickModule re-enabled).**

### Combat Day 20 — Prompt 2/3: Resolver + Triggers + Turn Loop (commit a4e5975 — 133/133 tests, clean build)

**Authoritative spec:** /docs/combat-spec.md (locked at V8.30 design pass).

**Task 1 — Combat state in types/game.ts:**
- New `CombatEnemyInstance` interface — runtime-spawned enemy with rolled HP, alive flag, instance_id (e.g. `fantasy_goblin_1`), all Enemy fields copied at spawn time.
- New `CombatEvent` interface (combat-spec §10) — type, timestamp, actor, target, outcome, damage_dealt, remaining_target_hp, weapon_or_item, context_note. Drives Prompt 3 narration.
- New `CombatState` interface — active flag, encounter_id, enemies[], turn_order (PLAYER + instance ids), current_turn_index, round_number, player_defending, combat_log[], origin_node_id, pre_combat_xp.
- `MasterState` extended with optional `combat`, `last_settlement_hub_id`, `navigation_trail`. Combat slice is dismissed entirely on victory/defeat/flee — no leftovers.

**Task 2 — `/lib/game/combat-resolver.ts` (pure math, RNG injected):**
- `rollD20`, `rollDamageDie`, `maxDamageDie`, `rollEnemyHP`, `rollInitiative` per spec §5.
- `resolveAttack` — full §5.2 logic: nat-1 fumble, nat-20 crit (max die + 1d(die) + str_mod), `hit_total >= target_dc`, min-1 damage clamp on hits, `killed_target` flag.
- `resolveDefend` + `applyDefendDamageReduction` — half damage rounded down, min 1.
- `resolveFlee` — average AGI of LIVING enemies; ignores dead.
- `resolveUseItem` — heals 1d8+4 capped at max; unknown items no-op.

**Task 3 — Encounter trigger in useGameLoop step 7c-3:**
- `shouldRollEncounter(node, currentCombat?)` — chance>0 ∧ roster nonempty ∧ no active combat.
- `resolveEnemyLookup` — genre bestiary first, then current region, then any other RegionBible (via metadata.region_bibles), then adjacent_region outlines (§6.1 layered fall-through).
- `rollEncounter` — encounter_chance roll, weighted 1d4 count for normal rooms (50/30/15/5), full-roster spawn for boss rooms, per-spawn HP roll, initiative + combat_start event.
- `rollEncounterWithPlayer` wrapper supplies real player AGI to initiative.

**Task 4 — Turn loop in `/lib/game/combat-engine.ts`:**
- `executePlayerAction` — resolves attack/defend/use_item/flee, applies damage, advances turn, auto-resolves enemy turns until next player turn or combat ends.
- `advanceEnemyTurn` — every enemy attacks the player (§6.3 simplification); honors defend buff (half damage + 2 AGI bonus); routes to `handleDefeat` on KO.
- `checkVictory` / `checkDefeat` predicates.
- `handleVictory` — sums xp_value across defeated enemies, calls `rollStubDrops` per kill, awards currency to genre's resources key + xp + items.
- `handleDefeat` — §9: HP→50%, currency→90% of genre key, XP→pre_combat_xp, teleport to last_settlement_hub_id ?? origin_node_id.
- `handleFleeSuccess` — return to navigation_trail[len-2] or fall back to origin_node_id.

**Task 5 — Tracking in useGameLoop step 7c-2:**
- On every ARRIVING: `navigation_trail` keeps last 5 node ids; `last_settlement_hub_id` updates when arriving at a settlement hub. Both ride on master_state alongside the existing fields.

**Task 6 — Console combat logger:**
- `logCombatEvent` prints each CombatEvent as a single line: `[Combat] type | actor=… target=… outcome=… damage=… hp_remaining=… note=…`.
- Higher-level `[Combat] Encounter triggered:`, `[Combat] Victory!`, `[Combat] Defeat. Returning to …`, `[Combat] Fled.` markers fire at resolution boundaries.
- TEMPORARY — Prompt 3 will replace with story-feed rendering.

**Task 7 — Dev-only test override:**
- `window.__forceEncounter("fantasy_goblin", "fantasy_skeleton")` registers at module load (gated on `process.env.NODE_ENV === "development"`).
- Queues a one-shot roster that the next arrival's encounter trigger consumes via `consumeForcedEncounter()`, bypassing both encounter_chance and the weighted count distribution.
- Invaluable for manual testing without RNG dependence.

**Task 8 — Tests (61 new, 133 total passing):**
- `combat-resolver.test.ts` — d20 range, all 7 damage dice ranges, maxDamageDie values, initiative ordering + ties, attack hit/miss/crit/fumble/min-1-clamp/target_dc/killed_target, flee success/failure/dead-enemy filtering, use_item heal/cap/unknown.
- `combat-trigger.test.ts` — shouldRollEncounter all branches, enemy lookup across all 4 layers, chance gating, force override bypass, boss-room full roster, weighted regular count, unresolvable id warnings, all-unresolvable cancellation, encounter_id/origin/pre_combat_xp, combat_start event.
- `combat-flow.test.ts` — encounter→attack→victory end-to-end with XP awarded, defeat path with HP/XP/gold reset + teleport, flee success with trail rollback, flee fallback to origin, flee failure with turn forfeit, defend halves enemy damage and clears buff, full rollEncounter→executePlayerAction round trip.

**Build impact:** /game route grew 91.9 kB → 96.1 kB. Build, tsc, and 133 jest tests all green.

**Untouched per blast-radius guard:** all UI components, story feed rendering, narrator pipeline, CombatMode component (doesn't exist yet — Prompt 3).

### Combat Day 20 — Prompt 1/3: Data Foundation (commit 1024287 — 72/72 tests, clean build)

**Task 1 — Enemy types in types/game.ts:**
- New `Enemy` interface (combat-spec §6.2): id, name, description, hp_range, agi_mod, str_mod, damage_die, armor_bonus, xp_value, loot_table_id, is_boss, behavior_flavor.
- `LocationDefinition` extended with optional `encounter_chance`, `encounter_roster`, `is_boss_room` (§3 / §6.7).
- `WorldNode` mirrors the same three encounter fields so combat triggers (Prompt 2) read straight from the graph.
- `RegionBible.enemies?: Enemy[]` and `RegionOutline.enemies?: Enemy[]` added.
- `Metadata.region_bibles?: Record<string, RegionBible>` added — accumulates expanded RegionBibles so combat triggers can resolve enemies for any region.

**Task 2 — Bestiary files:**
- `/lib/game/bestiary/fantasy.ts` — all 14 entries from spec §6.4 verbatim (giant rat → dragon whelp). Stats, dice, xp, armor match the table. Descriptions are 1 sentence each. `is_boss: false` on all 14. `loot_table_id` follows `<id>_loot` stub pattern.
- `/lib/game/bestiary/cyber.ts`, `horror.ts`, `space.ts`, `apoc.ts` — 3 placeholder enemies each, themed appropriately.
- `/lib/game/bestiary/index.ts` — `getGenreBestiary(genre)` and `findGenreEnemy(genre, id)` helpers. Returns `[]` for unknown genres.

**Task 3 — WorldBible LLM prompt extension:**
- Added `enemies` array to `starting_region` template (3-5) and to each `adjacent_region` outline template (1-2).
- New "DAY 20 COMBAT" instruction block + "ENCOUNTER TAGGING" block with worked example.
- max_tokens bumped 8000 → 10000.

**Task 4 — apply-world-bible persistence:**
- New `validateEnemy` / `validateEnemies` helpers. Warn-don't-500 on malformed entries.
- New `scrubEncounterRoster` helper that strips ids unresolvable against (genre bestiary ∪ region enemies ∪ adjacent-region outline enemies).
- Encounter fields mirrored onto every `WorldNode` in steps 4a (settlement-side) and 4b (region_locations).
- WorldBible enemies live inside the `world_bible` jsonb blob — no schema migration.

**Task 5 — RegionBible parity:**
- Same prompt extensions for region-themed enemies + encounter tagging.
- Same validate-enemy + scrub-roster helpers in apply, mirrored onto graph nodes.
- New `master_state.metadata.region_bibles[regionId]` accumulator.
- max_tokens bumped 6000 → 7000.
- Stub fallback bible includes `enemies: []` (combat falls through to genre bestiary on stub regions).

**Task 6 — Stub loot drops:**
- `/lib/game/loot/stub-drops.ts` — `rollStubDrops(enemy, rng?)` returns `{ gold, items }`.
- 25-50% gold drop chance scaled by xp_value. Gold = 1d6 + xp/10. 5% chance of `consumable_basic_health_potion`.

**Task 7 — Tests:** 29 new, 72 total passing.

### Region / Resilience Round (commit 87c89a3 — 43/43 tests, clean build)

**Fix 1 — Region tier description resolves from parent region for any node:**
- `lib/game/codex.ts` — `getWorldAssetsForLocation` now accepts an optional `parentRegionId`. The filter includes assets whose `first_seen_location === parentRegionId`, so the geographic region zone asset (e.g. `location_the_rustveil_commons`) is pulled into `locationAssets` even when the player is at a settlement hub or sub-location.
- `app/game/page.tsx` + `hooks/useGameLoop.ts` — both call sites that load assets on arrival now compute the root zone id by walking the `zone_id` chain and pass it as `parentRegionId`.

**Fix 2 — Map defaults to Local tier on startup:**
- `WorldMap.tsx::chooseInitialTier()` — final return value flipped from `2` (Region) → `3` (Local). Region zones keep `2` since LOCAL view doesn't apply there.

**Fix 3 — Landmark highlight color distinct from region:**
- `--hl-landmark` flipped from `#c4b5fd` → `#94d8b8` (soft mint).

**Fix 4 — New region lists origin region as adjacent travelable:**
- `apply-regional-bible/route.ts` — wires origin region symmetrically into adjacent-region connections at apply time.
- `NavigationBar.tsx` D2 branch — at expanded regions reads `current.connections` and lists is_expandable peer-region nodes.

**Fix 5 — RegionBible stub fallback on JSON parse failure:**
- `generate-regional-bible/route.ts` — max_tokens 3500 → 6000. On double-parse-failure: returns 200 with stub bible.

### Polish Round (commit b7032f9 — 43/43 tests, clean build)

**Fix 1 — Tier-aware highlight colors (region vs location):**
- New `--hl-region: #c4b5fd` token + `.ew-link-region` CSS rule.
- New `RegionSpan` component. `HighlightCandidate` carries `isRegion` flag.

**Fix 2 — NPC quoted speech in warm cream italic, weight 600:**
- `--hl-said: #e8d5b0` defined explicitly. `.ew-said` weight bumped 500 → 600.

**Fix 3 — Region zone retains adjacent-region cards on return:**
- NavigationBar D2 branch dropped the `current.connections.includes(r.id)` filter.
- `navigateTo`'s `isUndiscoveredRegion` tightened.

**Fix 4 — React key-prop-spread warning silenced:**
- `components/game/StoryFeed.tsx:422-451` separates `key` from spread props.

### Targeted Fix Round (commit dc5bcd8 — 43/43 tests, clean build)

**Fix 1 — apply-regional-bible 500 (collision-check NPE):**
`apply-regional-bible/route.ts:507-606` — Added `isValidPos` type guard at three points so the world-map overlap nudge can never dereference `.x` on an undefined entry.

**Fix 2 — Region zone description populates correctly (three layers):**
- `regionZoneToAsset` writes BOTH `constitution.physical_description` AND `constitution.atmosphere`.
- Region-zone upsert drops `ignoreDuplicates`.
- Single-tier branch: when `region.id === settlement.id`, overwrite step-3 prose with `starting_region.atmosphere`.
- `WorldMap.tsx::firstAtmosphere` prefers whichever has trimmed content.

### Regression Fix Round (commit 75a7cd4 — 43/43 tests, clean build)

**Fix A1 — Cache hit preserves post-arrival pipeline:**
`useGameLoop.ts:1465-1511` — Replaced early-return mini-pipeline with synthesized `narratorResponse`. Steps 5/6/7 run unchanged.

**Fix A2 — Sub-location nav cards back-to-hub only (auto-resolved by A1).**

**Fix B1 — Map text and icons visually larger:**
All 5 genre renderers bumped: titles 11-15 → 16-22, subtitles 7-10 → 13, node labels 7-11 → 14-18, exit labels 7-10 → 14.

**Fix B2 — `?` underline removed across all renderers and tiers.**

**Fix B3 — Description sourcing per map tier:**
World tier `wcd.world_description`, Region tier from current region, Local tier from current location. World tagline removed.

### Bug Fix Round (commit 57b0300 — 43/43 tests, clean build)

**Fix 1 — Highlight nav uses node id, not display name.**
**Fix 2 — Discovered flag safety net at end of step 7.**
**Fix 3 — Section header on cross-node navigation.**
**Fix 4 — Map text size pass (superseded by V8.27 Fix B1).**
**Fix 5 — Map "?" glyph underline removed (Fantasy only — superseded by V8.27 Fix B2).**
**Fix 6 — Cache hit skips arrival narrator (refined by V8.27 Fix A1).**

### Architecture Hardening (commit 57d27f3 — 43/43 tests, clean build)

**Change 1 — Land at region zone after generation.**
**Change 2 — World map overlap fix (hardened in V8.28 Fix 1).**
**Change 3 — Write-once arrival cache + codex dedup.**
**Change 4 — Code-built dialogue options.**
**Change 5 — Genre renderers restored.**

### Architecture Status ✅
```
Domain 1 (Engine):     World graph, navigation, stat checks, dialogue option
                       generation, combat resolver (V8.32), combat turn loop
                       (V8.32), encounter triggers (V8.32), loot resolver
                       (pending Day 21) — pure code
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
  Enemy interface (combat-spec §6.2)
  Two-tier bestiary: hand-authored genre + LLM region-specific
  Fantasy bestiary: 14 entries fully populated
  Other 4 genres: 3 placeholder entries each
  Encounter tagging on combat-eligible nodes (encounter_chance + roster)
  Stub loot drops: 25-50% gold, 5% basic health potion

RESOLVER LAYER (V8.32):
  /lib/game/combat-resolver.ts — pure math, RNG injected
  rollD20 / rollDamageDie / maxDamageDie / rollEnemyHP / rollInitiative
  resolveAttack — d20+AGI vs 10+target.AGI+armor; nat-1 fumble; nat-20 crit
  resolveDefend — half damage rounded down, min 1
  resolveFlee — d20+AGI vs avg living-enemy AGI
  resolveUseItem — health potion 1d8+4 capped at max

TRIGGER LAYER (V8.32):
  shouldRollEncounter — chance>0 ∧ roster nonempty ∧ no active combat
  resolveEnemyLookup — bestiary → current region → other regions →
                       adjacent outlines (4-layer fall-through)
  rollEncounter — chance roll, weighted count, full-roster bosses
  rollEncounterWithPlayer wrapper for real-player AGI

TURN LOOP (V8.32):
  /lib/game/combat-engine.ts
  executePlayerAction — attack/defend/use_item/flee + auto-advance
                        enemy turns until next player turn or end
  advanceEnemyTurn — every enemy attacks player (§6.3 simplification)
  checkVictory / checkDefeat predicates
  handleVictory — XP award, stub loot, currency to genre key
  handleDefeat — §9: HP→50%, currency→90%, XP→pre_combat,
                 teleport to last_settlement_hub_id
  handleFleeSuccess — back to navigation_trail[-2] or origin_node_id

STATE TRACKING (V8.32):
  master_state.combat (CombatState, dismissed on resolve)
  master_state.last_settlement_hub_id (updated on settlement arrival)
  master_state.navigation_trail (last 5 node ids, for flee)
  pre_combat_xp captured at encounter start (forfeit on defeat)

DEV TOOLS (V8.32):
  window.__forceEncounter("enemy_id", ...) — dev-only override
  Console logger emits [Combat] event lines (TEMPORARY, Prompt 3
  replaces with story-feed rendering)
```

### Navigation Rules ✅ (Complete)
```
Map = PURELY VISUAL. Genre renderers active. All navigation via nav bar.

Card grammar: [← BACK] [→ DEEPER...] [↑ EXIT] [◆ PEER...] [◇ UNDISCOVERED...]

Routing:
  Sub-location   → ← back to hub ONLY
  Settlement hub → → deeper + ↑ exit to region zone
  Region zone    → ← back + ◆ known + ◇ undiscovered + adjacent regions (V8.29)
  Dungeon        → ← back to region zone ONLY
  New region     → lands at region zone (not settlement hub)

Region zone D2 card builder:
- At starting region: iterates wb.adjacent_regions
- At expanded region: reads current.connections, lists is_expandable
  zone_id=self nodes as peer cards (V8.30)
- Forward AND back direction symmetric across any region depth

Combat trigger (V8.32):
- Step 7c-3 in useGameLoop: shouldRollEncounter on every arrival
- If encounter rolls: combat state populates, normal action loop pauses
- last_settlement_hub_id + navigation_trail update on every arrival
```

### Map Description Sourcing ✅ (V8.27, hardened V8.28, generalized V8.30)
```
World tier  → wcd.world_description (2-3 sentence world summary, never changes)
Region tier → currentRegion.atmosphere (resolved from parent region zone
              asset for ANY node within the region)
Local tier  → currentLocation.atmosphere

Region zone asset:
  - constitution.physical_description AND constitution.atmosphere both written
  - WorldMap firstAtmosphere prefers whichever has trimmed content

Map tier default on mount: Local for non-region-zone nodes, Region for region
zone nodes. User's manual tier choice not overridden mid-session.

Legacy saves without world_description: fall back to wcd.atmosphere.
World tagline under world name: REMOVED (replaced with known/rumored count).
```

### NPC Dialogue System ✅
```
Option list: built by code from NPC.knowledge[] asset
  - Knowledge topics (up to 4, from {topic, content} pairs)
  - Browse wares (if merchant role)
  - Free type
  - Farewell

AI receives: selected knowledge content + stat check result
AI writes: response text only (not option list)

Knowledge format: {topic: "Short label", content: "Full sentence"}
Legacy format: plain string → auto-converted

NPC quoted speech: rendered via .ew-said class — #e8d5b0 warm cream,
italic, weight 600. Pending higher-contrast pass — see Wrap-up Polish.
```

### RegionBible Resilience ✅ (V8.30, extended V8.31)
```
Model: claude-haiku-4-5-20251001
max_tokens: 7000 (V8.31)
Prompt: "Keep total response under 5000 tokens. Be concise."

Failure modes:
- First parse fail → retry once
- Retry parse fail → return 200 with stub bible (hub + tavern + 1 NPC
  + back-exit + enemies: [])

Player is never blocked from traversal by an LLM JSON malformation.
```

### WorldBible Resilience ✅ (V8.31)
```
Model: claude-sonnet-4-5
max_tokens: 10000 (V8.31)

apply-world-bible validates:
  - validateEnemy / validateEnemies — warn-don't-500 on malformed entries
  - scrubEncounterRoster — strips unresolvable enemy ids from rosters
```

### Known issues

**Wrap-up Polish (bundle into Combat Prompt 3 or post-combat polish round):**
- **Settlement hub card on new region arrival reads as back-from-settlement.** Functional but visually misleading. Card-typing issue in NavigationBar's region-zone D2 branch.
- **Map does not auto-switch tiers on cross-region arrival.** Initial-mount default works (V8.30) but doesn't re-fire on cross-zone arrival.
- **NPC dialogue text needs higher contrast.** `.ew-said` doesn't read distinctly enough from surrounding ink-2 prose. Bump color or add background tint / left-border accent.

**Map visual rework (dedicated session, post-combat):**
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
- Behavior dispatch beyond flavor text deferred (combat-spec §6.3) — every enemy just attacks the player every turn until a future combat-depth pass.
- Combat console logger is TEMPORARY (V8.32) — Prompt 3 replaces with story-feed combat-event rendering.

---

## 🏗️ Architecture

### The Two Domains ✅
**Domain 1 (Engine — pure code):** Navigation, stat checks, dialogue option generation, combat resolver + turn loop + encounter triggers (V8.32), loot resolver (pending Day 21).
**Domain 2 (Content Library — frozen):** WCD, locations, NPCs, items, loot tables, main quest, bestiary, region enemies.

### Generation Model ✅
RegionBible: claude-haiku-4-5-20251001, max_tokens: 7000. Stub fallback on double-parse-failure. Includes 3-5 region enemies + encounter tagging.
WorldBible: claude-sonnet-4-5, max_tokens: 10000. Includes 3-5 starting-region enemies, 1-2 per adjacent-region outline, encounter tagging.
WCD includes `world_description` (2-3 sentence world summary).

### Map System ✅
```
Genre renderers active (pickModule enabled).
PAD=76. Tier switcher. Current node highlighted.
World tier: tagline removed; subtitle = "<n> known · <n> rumored" (V8.27).
Initial tier on mount: Local (V8.30).
New region nodes: collision-checked, nudged if overlap.

Text sizes (V8.27):
  Titles    16-22 SVG units
  Subtitles 13
  Node labels 14-18
  Exit labels 14
  Undiscovered glyph radii enlarged proportionally

Underline strip + isValidPos guards live across renderers.

⚠️ Map visual rework deferred to dedicated post-combat session.
⚠️ Tier auto-switch on cross-zone arrival pending — see Known Issues.
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
13. Cache hit on ARRIVING synthesizes a `narratorResponse` and falls through. AI API bypassed; downstream pipeline runs unchanged. (V8.27)
14. Map description sourcing: World/Region/Local — no cross-tier bleed. (V8.27)
15. Region zone assets always populate both `constitution.physical_description` AND `constitution.atmosphere` from the same source prose. (V8.28)
16. Collision-check loops over expandable node positions must guard each entry with `isValidPos`. (V8.28)
17. Story feed location highlights are tier-aware: region (lavender), location (sky-blue), landmark (mint). (V8.29, V8.30)
18. Region zone D2 card builder iterates adjacent_regions/connections without filtering by stripped links. (V8.29 + V8.30)
19. Span dispatch in StoryFeed separates `key` from spread props before JSX. (V8.29)
20. Region tier description resolves from parent region zone asset for any node in that region. (V8.30)
21. Map tier defaults to Local on initial mount for any non-region-zone node. (V8.30)
22. New region creation always wires the origin region symmetrically into adjacent-region connections. (V8.30)
23. RegionBible parse failure must never block the player. Stub fallback returns 200. (V8.30)
24. Enemy entries follow the Enemy interface in types/game.ts. Validation is warn-don't-500. (V8.31)
25. Encounter rosters reference enemy ids resolved via 4-layer fall-through (genre bestiary → current region → other RegionBibles → adjacent outlines). Unresolvable ids scrubbed at apply time. (V8.31)
26. metadata.region_bibles accumulates expanded RegionBibles by id so combat triggers resolve regional enemies for any region. (V8.31)
27. Combat system design defers to /docs/combat-spec.md. Any code change to combat updates the spec FIRST, code SECOND. (V8.31)
28. Combat math lives in `/lib/game/combat-resolver.ts`. All combat resolver functions take inputs and return outputs; no global state mutation. RNG is injected for testability, defaults to Math.random. (V8.32)
29. Combat turn loop lives in `/lib/game/combat-engine.ts`. Player action resolution auto-advances enemy turns until next player turn or combat ends. Defeat / victory / flee dismiss the combat state slice entirely. (V8.32)
30. last_settlement_hub_id and navigation_trail update on every successful arrival in step 7c-2. Defeat teleport uses last_settlement_hub_id with origin_node_id fallback. Flee uses navigation_trail[-2] with origin_node_id fallback. (V8.32)
31. pre_combat_xp captured at encounter start. Defeat handler restores player.xp = pre_combat_xp (XP gained during the fight is forfeit). (V8.32)
32. Encounter trigger is in step 7c-3. Activates only when shouldRollEncounter passes (chance > 0, roster non-empty, no active combat). (V8.32)
33. Enemy behavior on Day 20 is hardcoded "attack the player" regardless of behavior_flavor field. Flavor is for narrator only until a future combat-depth pass adds dispatch. (V8.32)

---

## Narrator Prompt Order ✅

DIALOGUE: WCD → HARD RULES → RESPONDING CHARACTER → CLOSED CONTEXT (selected knowledge) → TIER 1 OBJECTS → WORLD ASSETS → SCENE → VERBOSITY
non-DIALOGUE: WCD → HARD RULES → NPCS PRESENT → TIER 1 OBJECTS → CONNECTED LOCATIONS → WORLD ASSETS → SCENE → VERBOSITY

Region zone: inject settlement hub (labeled "settlement") + region_locations with compass direction.
Verbosity: terse | standard | rich

(Combat narration prompt order pending Prompt 3.)

---

## Story Feed Colors ✅
```
Narrator prose:        var(--ink-1)
NPC quoted speech:     #e8d5b0 warm cream, italic, weight 600 (--hl-said)
                       — pending higher-contrast pass per V8.30 playtest
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
| Combat Prompt 3/3 | NEXT | Combat mode UI + narration integration + victory/defeat handlers in UI + bundle Wrap-up Polish |
| Map Visual Rework | After combat | Dedicated session: decoration, geometry, sizing, hierarchy, label collision |
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

*Last updated: V8.32 — Combat Day 20 Prompt 2/3 (commit a4e5975): combat-resolver.ts (d20 hit/dmg/init/flee/use_item math), combat-engine.ts (turn loop, victory/defeat/flee handlers), encounter trigger in step 7c-3, last_settlement_hub_id + navigation_trail tracking, dev-only __forceEncounter override, console combat logger (temporary, replaced in Prompt 3). 133/133 tests passing. Combat Mode UI (Prompt 3) up next — that's when combat becomes visually playable.*
