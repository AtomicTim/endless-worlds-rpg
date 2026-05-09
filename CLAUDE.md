# Project: Endless Worlds RPG — Master Context

**Version:** 8.34
**Status:** 🎉 Day 20 Combat COMPLETE — Polish Round (Prompt 4) Next
**Objective:** A text-based RPG that generates a unique world for every playthrough. Genre-agnostic, infinitely replayable, CRPG depth.

**Reference:** /docs/architecture-spec.md — The definitive source for all Domain 1 vs Domain 2 decisions. /docs/combat-spec.md — The authoritative source for combat system design.

---

## 🔄 Current Status (Read This First)

**Current Phase:** Day 20 Combat is fully playable end-to-end. All three combat prompts merged: data foundation (1024287), resolver + triggers + turn loop (a4e5975), navigation regression fix (25ff111), and combat UI + narration + bestiary + preamble (abf73e6). 173/173 tests passing. Polish Round (Prompt 4) is next, bundling four visual UX issues.
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
| **20 — Combat Prompt 3/3 (abf73e6)** | **Combat mode UI + narration + bestiary codex + new-game string fix** | ✅ **Complete** |
| Polish Round (Prompt 4) | Settlement card label, tier auto-switch, NPC dialogue contrast, tier-aware nav button colors | ⏳ Next |
| Map Visual Rework | Dedicated session | ⏳ Deferred (post-Prompt-4) |
| 21 | Container + Loot | ⏳ Pending |
| 22 | Skills + Leveling | ⏳ Pending |
| 23 | Main Quest Thread | ⏳ Pending |

**Active genres:** Fantasy, Cyberpunk, Horror/Lovecraftian, Space Opera, Post-Apocalyptic
**⚠️ Noir removed. Genre renderers restored (pickModule re-enabled).**

### Combat Day 20 — Prompt 3/3: UI + Narrator + Bestiary + Preamble (commit abf73e6 — 173/173 tests, clean build)

**Authoritative spec:** /docs/combat-spec.md.

**Task 1 — CSS color tokens + animation keyframes (`app/globals.css`):**
- Seven combat color variables: `--combat-player` (#7ab8c8 teal), `--combat-enemy` (#e87c6d warm red), `--combat-player-crit` (#3b82a8 deeper blue), `--combat-enemy-crit` (#c0392b blood red), `--combat-victory` (#7dbb8e mossy green), `--combat-defeat` (#a93226 dark red), `--combat-flee` (#a8a29c dusty grey-tan).
- New `@keyframes combat-portrait-shake` (4 oscillations / 400ms / ~6px amplitude) plus `.combat-portrait-shake` utility class.

**Task 2 — `/components/game/CombatMode/`:**
- `CombatMode.tsx` — top panel. Side-by-side: player on the LEFT half, vertical divider, enemies tiled on the RIGHT half. Header reads `⚔ Combat — Round N` with a "Your turn" / "Enemy turn..." state pill. Manages inline target-picker + use-item modal + transient `shakeMap` for crit portrait shakes.
- `CombatantRow.tsx` — single column. Discriminated union over `isPlayer` so the same component handles `PlayerState` (health/max_health) and `CombatEnemyInstance` (current_hp/max_hp). Crown ♛ + bold name when `is_boss`.
- `PortraitSlot.tsx` — reserved square slot (~128px target), single-letter glyph placeholder. `portraitUrl` prop wired so real portraits drop in without layout change. Boss border = accent gold; player = teal; targetable enemy = crit-red glow.
- `HPBar.tsx` — 300ms width transition. Color thresholds: ≥50% pass, 20-50% item-yellow, <20% fail. Bosses get 6px bar (vs 4px standard).
- `ActionBar.tsx` — Attack / Defend / Use Item / Flee. Plain text labels. Disabled when not player turn or while engine resolving. Use Item disabled when no consumables.
- `TargetPicker.tsx` — inline hint banner ("► Select a target") + Cancel button + Escape handler. Targeting via `isTargetable` prop on each enemy CombatantRow.
- `UseItemPicker.tsx` — modal listing `ItemType.CONSUMABLE` rows. Esc + click-outside dismiss.

**Task 3 — Page integration (`app/game/page.tsx`):**
- `useCombat()` plumbed alongside `useGameLoop()`. `inCombat = activeCombat?.active === true`.
- When in combat: NavigationBar + InputBar hidden, CombatMode panel renders in their place.
- CombatMode `min-height: min(33vh, 360px)` so StoryFeed (flex-1) shrinks above but stays scrollable.
- Right-side tabs (Map / Codex / Character) untouched.

**Task 4 — Story-feed combat events (`StoryFeed.tsx`):**
- COMBAT message branch reads new metadata (`event_type`, `actor`, `outcome`) for per-event styling.
- Routine player action → teal-blue, italic, ⚔ prefix.
- Routine enemy action → warm red, italic, ⚔ prefix.
- Crit → bold weight, darker color (player or enemy variant).
- Victory / Defeat / Flee success → 1.5× size, bold, full-width line in respective color.
- Templated narration in `lib/game/combat-narration/templates.ts`. `renderRoutineCombatEvent(event, ctx)` returns string for routine events, null for dramatic (signaling caller to fetch LLM prose).
- Variant selection deterministic via `Math.imul(timestamp, 2654435761)` hash — re-renders never change phrasing.
- `useCombat.submitCombatAction` walks engine-emitted events in order: pushes templated lines synchronously, dramatic events through `/api/game/narrate-combat` before pushing. `isResolving` flag stays true until all narration lands; ActionBar disables.

**Task 5 — Combat narrator API (`app/api/game/narrate-combat/route.ts`):**
- Auth-gated. Body: `{ event, combat_context, genre }`.
- Genre-specific tone primer (Fantasy = blood-and-steel, Cyber = servos-and-blood, Horror = dread-physical, Space = vacuum-physics, Apoc = gritty-survival).
- System prompt enforces: no interior monologue, no inventing damage numbers, 1 sentence default / 2-3 only for crit/kill/victory/defeat/flee_success/combat_start.
- Model: `claude-sonnet-4-5`, max_tokens: 250.
- Graceful fallback strings per event type so combat keeps flowing if API blips.

**Task 6 — Bestiary codex (`lib/game/codex.ts` + useGameLoop):**
- `writeBestiaryEntry(sessionId, enemy, locId, locName)` wraps `saveCodexEntry` to write a BESTIARY entry with description block: enemy flavor + `HP: <min>-<max>` + `Damage: <die>` + `First seen: <location>`.
- Wired into encounter trigger (useGameLoop step 7c-3): on `combat_start`, deduplicates by enemy id and writes one entry per unique enemy.
- Surfaces `✦ <name> added to codex` toast when `created === true`. Repeat encounters silent (`created === false`).

**Task 7 — New-game preamble (`page.tsx` + `StoryFeed.tsx`):**
- When `recent_messages.length === 0` (genuinely fresh session): writes existing locator line, then a soft second message `"Your adventure begins. What will you do first?"` with `metadata.isFreshGamePreamble = true`.
- StoryFeed special-cases the flag and renders italic, low-opacity serif at 14px so it reads as an invitation rather than a system event.

**Task 8 — Animations:**
- HP bar: 300ms ease-out width transition (CSS, fires on prop change automatically).
- Crit portrait shake: parent CombatMode watches `combat.combat_log` for new `outcome === "crit"` events and writes target into transient `shakeMap`. CombatantRow reads its `shake` prop and applies `.combat-portrait-shake` on PortraitSlot. 400ms timeout clears.

**Task 9 — Tests (24 new, 173 total passing):**
- `templates.test.ts` (19 tests): every routine event type with damage/heal interpolation, determinism check, variance smoke test, all dramatic types return null.
- `codex-bestiary.test.ts` (5 tests): Supabase client mocked, `writeBestiaryEntry` writes correct shape, repeat encounter resolves to `created: false`.
- Component tests intentionally skipped: project's jest is configured `testEnvironment: "node"` with no jsdom/RTL setup. Adding RTL infrastructure is a separate task. The fragile logic (combat math, state transitions, encounter triggers, templating, bestiary writes) is fully covered; CombatMode is orchestration over those covered pieces.

**Build impact:** `/game` route 96.1 → 104 kB. New `/api/game/narrate-combat` route in build table. Build, tsc, and 173 jest tests all green.

### Prompt 2.5 — Navigation Fix (commit 25ff111 — 149/149 tests, clean build)

**Root cause confirmed:** Hyphenated region names like "The Chain-Keeps Borderland" slugify in `toSlug` to `the_chainkeeps_borderland` — the hyphen is stripped without becoming an underscore. The canonical graph node id is `the_chain_keeps_borderland`. So the directHit fallback in `resolveMove` misses, `classifyMove` falls through to `WORLD_EXPLORE`, and step 4d's `shouldExpandRegion` fires, re-running apply-regional-bible against an already-applied bible.

Could fix `toSlug` itself but high-blast-radius. Targeted fix lives at the consumers of the move classification.

**Fix 1 — useGameLoop step 4d reclassification:** If matched id is already in `metadata.region_bibles` AND graph node has `discovered: true`, log `[navigateTo] known region — reclassified as GRAPH_NAVIGATE`, reroute current_node_id, refresh assets, fall through to step 5 without calling apply-regional-bible. Patched `arrivedAt` to read from `updatedState` (post-reclassification).

**Fix 2 — apply-regional-bible idempotence guard:** If bible registered AND every location in graph, return 200 with `skipped: true`.

**Fix 3 — preserve `discovered` on re-apply:** `mergeNodePreservingDiscovered` enforces this.

**Architecture extraction — `lib/game/region-expansion-guard.ts`:** Three pure helpers (`isRegionAlreadyExpanded`, `isApplyRegionalBibleRedundant`, `mergeNodePreservingDiscovered`).

**Tests:** 16 new in `region-expansion-guard.test.ts`. 149 total.

### Combat Day 20 — Prompt 2/3: Resolver + Triggers + Turn Loop (commit a4e5975 — 133/133 tests, clean build)

**Task 1 — Combat state in types/game.ts:**
- New `CombatEnemyInstance`, `CombatEvent`, `CombatState` interfaces.
- `MasterState` extended with optional `combat`, `last_settlement_hub_id`, `navigation_trail`. Combat slice dismissed entirely on victory/defeat/flee.

**Task 2 — `/lib/game/combat-resolver.ts` (pure math, RNG injected):**
- `rollD20`, `rollDamageDie`, `maxDamageDie`, `rollEnemyHP`, `rollInitiative`.
- `resolveAttack` — full §5.2 logic: nat-1 fumble, nat-20 crit, hit_total ≥ target_dc, min-1 damage clamp, killed_target flag.
- `resolveDefend` + `applyDefendDamageReduction` — half damage min 1.
- `resolveFlee` — average AGI of LIVING enemies.
- `resolveUseItem` — heals 1d8+4 capped at max.

**Task 3 — Encounter trigger in useGameLoop step 7c-3:**
- `shouldRollEncounter`, `resolveEnemyLookup` (4-layer fall-through), `rollEncounter`, `rollEncounterWithPlayer` wrapper.

**Task 4 — Turn loop in `/lib/game/combat-engine.ts`:**
- `executePlayerAction`, `advanceEnemyTurn`, `checkVictory`, `checkDefeat`, `handleVictory`, `handleDefeat`, `handleFleeSuccess`.

**Task 5 — Tracking in step 7c-2:** `navigation_trail` (last 5), `last_settlement_hub_id` updates on settlement hub arrivals.

**Task 6 — Console combat logger** (TEMPORARY — V8.34 replaced with story-feed rendering).

**Task 7 — Dev override:** `window.__forceEncounter("fantasy_goblin", "fantasy_skeleton")`.

**Task 8 — 61 new tests, 133 total.**

### Combat Day 20 — Prompt 1/3: Data Foundation (commit 1024287 — 72/72 tests, clean build)

**Task 1 — Enemy types in types/game.ts:**
- New `Enemy` interface (combat-spec §6.2).
- `LocationDefinition` + `WorldNode` extended with optional encounter fields.
- `RegionBible.enemies`, `RegionOutline.enemies`, `Metadata.region_bibles`.

**Task 2 — Bestiary files:**
- `/lib/game/bestiary/fantasy.ts` — 14 entries.
- `cyber.ts`, `horror.ts`, `space.ts`, `apoc.ts` — 3 placeholders each.
- `index.ts` — `getGenreBestiary`, `findGenreEnemy`.

**Task 3-5 — WorldBible + RegionBible LLM prompt extensions + apply persistence with validate-don't-500.**

**Task 6 — `/lib/game/loot/stub-drops.ts` — 25-50% gold + 5% potion.**

**Task 7 — 29 new tests, 72 total.**

### Region / Resilience Round (commit 87c89a3 — 43/43 tests, clean build)

**Fix 1 — Region tier description from parent region for any node** via `parentRegionId` chain walk.
**Fix 2 — Map defaults to Local tier on startup.**
**Fix 3 — Landmark highlight color flipped to mint.**
**Fix 4 — New region wires origin region symmetrically into adjacent-region connections.**
**Fix 5 — RegionBible stub fallback** on JSON parse failure.

### Polish Round (commit b7032f9 — 43/43 tests, clean build)

**Fix 1 — Tier-aware highlight colors** (region lavender vs location sky-blue).
**Fix 2 — NPC quoted speech in warm cream italic, weight 600.**
**Fix 3 — Region zone retains adjacent-region cards on return.**
**Fix 4 — React key-prop-spread warning silenced.**

### Targeted Fix Round (commit dc5bcd8 — 43/43 tests, clean build)

**Fix 1 — apply-regional-bible 500** (collision-check NPE guarded with isValidPos).
**Fix 2 — Region zone description populates correctly.**

### Regression Fix Round (commit 75a7cd4 — 43/43 tests, clean build)

**Fix A1 — Cache hit preserves post-arrival pipeline.**
**Fix A2 — Sub-location nav cards back-to-hub only.**
**Fix B1 — Map text/icons larger.**
**Fix B2 — `?` underline removed.**
**Fix B3 — Description sourcing per map tier.**

### Bug Fix Round (commit 57b0300 — 43/43 tests, clean build)

**Fix 1 — Highlight nav uses node id, not display name.**
**Fix 2 — Discovered flag safety net at end of step 7.**
**Fix 3 — Section header on cross-node navigation.**

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
                       guard (V8.33), combat UI (V8.34), bestiary codex
                       (V8.34), loot resolver (pending Day 21) — pure code
Domain 2 (Content):    WCD, WorldBible (with enemies + encounter tagging),
                       RegionBible (same), NPCs, items, bestiary — frozen

AI during gameplay:
  ✅ Arrival narration  — first visit only, cached permanently after
  ✅ Dialogue options   — built by code, AI writes response only
  ✅ Action narration   — 1-4 sentences
  ✅ NPC not present    — hardcoded "X isn't here"
  ✅ Combat round narration — dramatic events only (crit/kill/victory/
                              defeat/flee/combat_start), 1-2 sentences,
                              genre-specific tone primer (V8.34)
  ⏳ Container search   — pending Container+Loot system
```

### Combat System ✅ COMPLETE (V8.31 + V8.32 + V8.34)
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

UI LAYER (V8.34):
  /components/game/CombatMode/ — CombatMode, CombatantRow, PortraitSlot,
    HPBar, ActionBar, TargetPicker, UseItemPicker.
  Side-by-side layout: player left, divider, enemies right.
  Action bar bottom-full-width. Portrait slots reserved for ~128px.
  Story feed combat events with per-event styling.
  HP bar 300ms transition. Crit portrait shake 400ms.

NARRATION LAYER (V8.34):
  /api/game/narrate-combat — genre-specific tone primer.
  Templated routine events (no API call) + LLM dramatic events.
  Deterministic variant selection by event timestamp hash.

BESTIARY CODEX (V8.34):
  writeBestiaryEntry on combat_start (deduplicated by enemy.id).
  Description: flavor + HP range + damage die + first-seen location.

DEV TOOLS (V8.32):
  window.__forceEncounter("enemy_id", ...) — dev-only override.
```

### Region Expansion Guard ✅ (V8.33)
```
/lib/game/region-expansion-guard.ts — pure helpers, two callers:

isRegionAlreadyExpanded / isApplyRegionalBibleRedundant /
mergeNodePreservingDiscovered.

ROOT CAUSE FIXED IN V8.33:
toSlug() strips hyphens — the Region Expansion Guard works AROUND
this slug bug. Fixing toSlug itself is high-blast-radius.
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

Region trigger reclassification (V8.33):
- Step 4d checks isRegionAlreadyExpanded BEFORE expanding
- Known region → GRAPH_NAVIGATE, no apply-regional-bible call

Combat trigger:
- Step 7c-3: shouldRollEncounter on every arrival
- last_settlement_hub_id + navigation_trail update on every arrival
- arrivedAt sourced from updatedState (post-reclassification)
- combat_start writes bestiary codex entries (V8.34)
```

### Map Description Sourcing ✅ (V8.27, hardened V8.28, generalized V8.30)
```
World tier  → wcd.world_description
Region tier → currentRegion.atmosphere (resolved from parent region zone
              asset for ANY node within the region)
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
This is a dedicated visual polish round bundling four small UX issues. Each is independent — no architecture dependencies. Best done together now that Combat is stable.
- **Settlement hub card on new region arrival reads as back-from-settlement.** Functional but visually misleading. Card-typing issue in NavigationBar's region-zone D2 branch — needs to distinguish "settlement hub of CURRENT region" (deeper-into card) from "place player just left" (back card). Confirmed still present through V8.33 playtesting.
- **Map does not auto-switch tiers on cross-region arrival.** Initial-mount default works (V8.30) but doesn't re-fire on cross-zone arrival.
- **NPC dialogue text needs higher contrast.** `.ew-said` doesn't read distinctly enough from surrounding ink-2 prose.
- **Tier-aware nav button colors (NEW request V8.33).** Each card type currently looks identical regardless of destination tier. Region cards, dungeon cards, settlement cards, and sub-location cards each get distinct visual treatment. Distinct color per tier matching existing highlight tokens.

**Map visual rework (dedicated session, post-Prompt-4):**
- Per-node decorative shelf line under every node. Cleanup needed.
- Connection lines pass through node icons instead of terminating at edges.
- Overall sizing and visual hierarchy still cramped.
- Map label collision: World/Region tier labels overlap.
- Whole-renderer redesign needed.

**Component test infrastructure (V8.34 deferral):**
- Project jest configured `testEnvironment: "node"` — no jsdom/RTL setup.
- CombatMode UI logic covered indirectly via fully-tested combat math/state/templating layers; orchestration is the gap.
- Adding RTL infrastructure is a separate task — not blocking, queue when test coverage on UI components becomes critical.

**Other deferred:**
- NPC highlight color (orange) too similar to item highlight (yellow) in Fantasy
- Hub node not added to codex on first arrival to new region
- Step 7 individual branches: confirm each sets `discovered: true` (relying on Fix 2 safety net)
- Starting region nodes lack `grid_position` — masked by V8.28 isValidPos guard.
- Behavior dispatch beyond flavor text deferred (combat-spec §6.3) — every enemy just attacks the player every turn.
- `toSlug` strips hyphens — masked by V8.33 region-expansion-guard.

---

## 🏗️ Architecture

### The Two Domains ✅
**Domain 1 (Engine — pure code):** Navigation, stat checks, dialogue option generation, combat resolver + turn loop + encounter triggers (V8.32), region expansion guard (V8.33), combat UI + narrator + bestiary (V8.34), loot resolver (pending Day 21).
**Domain 2 (Content Library — frozen):** WCD, locations, NPCs, items, loot tables, main quest, bestiary, region enemies.

### Generation Model ✅
RegionBible: claude-haiku-4-5-20251001, max_tokens: 7000. Stub fallback. Idempotent on re-apply.
WorldBible: claude-sonnet-4-5, max_tokens: 10000. Includes enemies + encounter tagging.
WCD includes `world_description`.
Combat narrator: claude-sonnet-4-5, max_tokens: 250. Genre tone primer per call.

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
38. Combat narration is selective: routine events (regular hits/misses, defends, item uses, failed flees) use code-templated lines via `renderRoutineCombatEvent` — NO API call. Dramatic events (combat_start, crit, kill, victory, defeat, successful flee) call /api/game/narrate-combat for 1-2 sentence LLM prose. Variant selection deterministic via timestamp hash. (V8.34)
39. CombatMode is the bottom-strip swap when `master_state.combat?.active === true`. NavigationBar + InputBar hide; CombatMode renders in their place at min-height: min(33vh, 360px). Story feed (flex-1) shrinks above but remains scrollable. Right-side tabs untouched. (V8.34)
40. Each combatant row reserves a portrait slot (~128px). Day 20: single-letter glyph placeholder. portraitUrl prop accepts real images later without layout change. (V8.34)
41. Bestiary codex entries write on `combat_start` events, deduplicated by enemy.id. Description block: flavor + HP range + damage die + first-seen location. No AGI/STR mods, no defeat counter. (V8.34)
42. New game preamble: `recent_messages.length === 0` triggers "Your adventure begins. What will you do first?" with isFreshGamePreamble flag. StoryFeed renders italic, low-opacity serif at 14px. (V8.34)

---

## Narrator Prompt Order ✅

DIALOGUE: WCD → HARD RULES → RESPONDING CHARACTER → CLOSED CONTEXT (selected knowledge) → TIER 1 OBJECTS → WORLD ASSETS → SCENE → VERBOSITY
non-DIALOGUE: WCD → HARD RULES → NPCS PRESENT → TIER 1 OBJECTS → CONNECTED LOCATIONS → WORLD ASSETS → SCENE → VERBOSITY
COMBAT (V8.34): GENRE TONE PRIMER → COMBAT EVENT (mechanical truth) → HARD RULES (no monologue, no inventing damage) → 1-2 sentence response

Region zone: inject settlement hub + region_locations with compass direction.
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
| Behavior dispatch | Future combat-depth pass | Enemies use behavior_flavor mechanically (target weakest, focus, retreat at low HP) |
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

*Last updated: V8.34 — 🎉 Day 20 Combat COMPLETE end-to-end (commit abf73e6). Combat Mode UI (CombatMode + 6 child components, side-by-side layout, ~128px portrait slots reserved, HP bar + crit shake animations), templated routine events + LLM dramatic narration via /api/game/narrate-combat, bestiary codex entries on combat_start (deduplicated by enemy.id), new-game preamble fix ("Your adventure begins. What will you do first?"). 173/173 tests passing. /game route 96 → 104 kB. Foundational rules 38-42 added. Polish Round (Prompt 4) up next: settlement card label, tier auto-switch, NPC dialogue contrast, tier-aware nav button colors.*
