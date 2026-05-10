# Project: Endless Worlds RPG — Master Context

**Version:** 8.37
**Status:** Day 20 Combat COMPLETE + 20.1/20.2/20.3 polish landed — Day 20.4 (Verbal Action) Next
**Objective:** A text-based RPG that generates a unique world for every playthrough. Genre-agnostic, infinitely replayable, CRPG depth.

**Reference:** /docs/architecture-spec.md — The definitive source for all Domain 1 vs Domain 2 decisions. /docs/combat-spec.md — The authoritative source for combat system design.

---

## 🔄 Current Status (Read This First)

**Current Phase:** Day 20 Combat fully playable end-to-end with proper pacing, equipment, initiative kickoff, and dramatic two-line crit/resolution rendering. Combat input is currently blocked with a system message during fights — Day 20.4 will replace that block with the verbal action / taunt mechanic. Polish Round (Prompt 4) sits behind 20.4 in queue.
**Local Dev Port:** 3000
**Stack:** Next.js 14 / Tailwind / shadcn/ui / Supabase / Claude API / Stripe / Vercel
**GitHub Repo:** atomictim/endless-worlds-rpg

| Phase | Title | Status |
| --- | --- | --- |
| 1–18 | MVP through Systems Audit | ✅ Complete |
| 19A–19F | World Generation Architecture | ✅ Complete |
| Movement Track | Verified end-to-end | ✅ FROZEN |
| Combat Spec | /docs/combat-spec.md design doc | ✅ Frozen |
| 20 — Combat Prompt 1/3 (1024287) | Data foundation: enemy types, bestiary, encounter tagging | ✅ Complete |
| 20 — Combat Prompt 2/3 (a4e5975) | Resolver + encounter triggers + turn loop | ✅ Complete |
| 20 — Prompt 2.5 Nav Fix (25ff111) | Region trigger reclassification | ✅ Complete |
| 20 — Combat Prompt 3/3 (abf73e6) | Combat mode UI + narration + bestiary codex + new-game string fix | ✅ Complete |
| 20.1 — Combat Polish (1215bb6) | Starting equipment, encounter banner, turn separators, pacing, header pill | ✅ Complete |
| 20.2 — Combat Hotfix (bf3871e) | Initiative kickoff fix + inventory stats display | ✅ Complete |
| **20.3 — Combat Polish 2 (732e944)** | **Full-width separators, item use locked to buttons, CRITICAL HIT banner, victory/defeat/escaped two-line render, prose suppression on victory-killing-blow** | ✅ **Complete** |
| 20.4 — Verbal Action System | Chat input hijack: taunt / distract / intimidate via LLM judging + charisma check + status effects | ⏳ Next |
| Polish Round (Prompt 4) | Movement-direction grouped nav cards + tier color-coding + settlement card label + tier auto-switch + NPC dialogue contrast | ⏳ Queued post-20.4 |
| Map Visual Rework | Dedicated session | ⏳ Deferred (post-Prompt-4) |
| 21 | Container + Loot | ⏳ Pending |
| 22 | Skills + Leveling | ⏳ Pending |
| 23 | Main Quest Thread | ⏳ Pending |

**Active genres:** Fantasy, Cyberpunk, Horror/Lovecraftian, Space Opera, Post-Apocalyptic
**⚠️ Noir removed. Genre renderers restored (pickModule re-enabled).**

### Day 20.3 — Combat Polish 2 (commit 732e944 — 233/233 tests, clean build)

Six-task polish round resolving story-feed rendering issues from V8.36 playtest + locking down combat input integrity ahead of the Day 20.4 verbal action work.

**Task 1 — Full-width turn separators:**
- New CSS classes in globals.css: `.combat-turn-separator` (flex container), `.combat-turn-separator-line` (flex-1 rule lines), `.combat-turn-separator-label` (italic 11px serif, lowercase, low-opacity).
- StoryFeed.tsx combat branch for `round_start` / `player_turn_start` / `enemy_phase_start` strips the V8.35 `─── ` / ` ───` decoration from the templated string and renders flex-based: rule line ── label ── rule line, extending to full story-panel width.
- Templates kept the existing string format — StoryFeed handles the strip.

**Task 2 — Lock item use to buttons:**
- `templates.ts::renderUseItem` now produces `"You use Basic Health Potion. Restored 8 HP."` (was `"You drink ... +N HP."`). For non-heal consumables: `"You use Strange Trinket."`. Damage 0/null drops the suffix.
- `useGameLoop.ts::submitAction`: early bail when `state.combat?.active === true`. Pushes a SYSTEM message `"Combat input is disabled — use the action buttons."` with metadata `{ isCombatInputBlocked: true }` and returns before input echo, parser, resolver, or narrator runs. `forceMoveToNode` allowed through (defeat/flee teleports). No turn consumed, no enemy phase fires, no item consumed.
- This block is INTERIM. Day 20.4 will replace it with verbal action handling.

**Task 3 — CRITICAL HIT banner (two-line render):**
- New exported `renderCritBanner(event)` in templates.ts. Returns `"⚔ CRITICAL HIT — N damage."` when `damage_dealt > 0`, falls back to `"⚔ CRITICAL HIT."` for 0/null defensively.
- New CSS class `.combat-crit-banner` (mono 13px bold uppercase, 0.08em letter-spacing). Color injected via inline style.
- `useCombat::projectCombatEventsToFeed` intercepts `player_attack` / `enemy_attack` events with `outcome === "crit"`: pushes the templated banner FIRST (instant, `is_crit_banner: true` metadata), then fetches the LLM prose (`is_crit_prose: true`). Both styled with same actor-derived color.

**Task 4 — Suppress crit/kill prose on victory:**
- New exported pure function `planEventSuppression(events)` in useCombat.ts. Pre-scans events array. When `victory` event is present:
  - All `kill` events before it land in `skipEntirely` (dropped from feed entirely — victory banner says it all)
  - The LAST `crit` before it lands in `suppressProseAt` (banner renders, LLM prose call skipped)
- `projectCombatEventsToFeed` consults both sets per-event index. Crit-kill leading to victory now produces exactly ONE LLM call (the victory prose), down from three (crit + kill + victory) in V8.36.
- Defeat batches are intentionally untouched — no killing crit to dedupe with, the enemy crit prose still adds dramatic weight.

**Task 5 — Victory / Defeat / Escaped two-line banner:**
- New exported `renderResolutionBanner(event)` in templates.ts: `victory → "Victory"`, `defeat → "Defeat"`, `flee_success → "Escaped"`.
- New CSS classes: `.combat-resolution-block` (centered), `.combat-resolution-banner` (mono 18px bold uppercase 0.12em), `.combat-resolution-prose` (serif italic 13px). Color injected per resolution type.
- `useCombat` for resolution events: fetches the (now-shortened) LLM prose and pushes a SINGLE message that carries both the banner word in content AND the prose in metadata `resolution_prose`. StoryFeed renders as a two-line centered block — banner above, prose below, both colored.
- `narrate-combat` route updated:
  - Length hint for resolution events now `"Write ONE sentence, max 20 words. Punchy, not flowery."`
  - `max_tokens` reduced from 250 → 120 for resolution events
  - Crit/kill keep `"Write 2-3 sentences."` hint and 250 max_tokens for tier-3 dramatic budget
- Removed the old V8.34 isHero/isVictory/isDefeat/isFlee styling block in StoryFeed since those events now route through the dedicated two-line resolution banner branch above.

**Tests (17 new, 233 total passing):**
- `templates.test.ts` (+8): renderUseItem "Restored N HP" wording, no-heal fallback, zero-damage drops suffix; renderCritBanner damage interpolation, no-damage fallback; renderResolutionBanner victory/defeat/flee_success → correct words, null for non-resolution.
- `combat-suppression.test.ts` (+9): empty sets when no victory in batch; last-crit-before-victory marked for prose suppression; only the LAST crit (not earlier ones); kill events dropped when victory present; multiple kills all dropped; kills NOT skipped mid-fight (no victory); the dramatic crit-kill→victory case (one LLM call total); defeat batches intentionally untouched.

**Build impact:** `/game` route 106 kB unchanged. Build, tsc, and 233 jest tests all green.

### Day 20.2 — Combat Hotfix + Inventory Stats (commit bf3871e — 216/216 tests, clean build)

ROOT CAUSE: `executePlayerAction` was the only place enemy turns auto-advance; if `rollInitiative` seated an enemy at `turn_order[0]`, the player couldn't act → no enemy loop fires → permanent deadlock.

**Engine fix:** Extracted enemy-turn loop into shared `advanceUntilPlayerTurnOrEnd` (combat-engine.ts). New `kickoffCombatIfEnemyFirst` runs the enemy phase when player doesn't have initiative. Emits `enemy_phase_start` + `player_turn_start` for symmetry with regular post-action enemy phases. Propagates resolution payload (defeat in kickoff phase) exactly like `executePlayerAction`.

**Hook fix:** New `kickoffCombat()` async fn in useCombat. New useEffect watches `masterState.combat.encounter_id + active`. Fresh enemy-initiative encounter triggers `setDisplayPhase("enemy")` synchronously (no "Your turn" flash) + fires kickoffCombat. Tracked via `useRef<Set<string>>` to prevent double-fire.

**Inventory cards:** `components/game/sidebar/InventoryPanel.tsx` `combatStatsLine(item)` helper returns `"Damage: 1d6"` / `"Armor: +2"` (always renders, including +0) / `"Heal: 1d8+4"` (canonical potion) or `"Heal: N"` (flat). KEY/LORE/CONTAINER → null. EQUIPPED pill (--hl-pass green tint) renders next to rarity when `selectedItem.equipped === true`.

**Tests:** 7 new (combat-flow). 216 total. `/game` 105 → 106 kB.

### Day 20.1 — Combat Polish (commit 1215bb6 — 209/209 tests, clean build)

Five-task polish round closing the gap between V8.34's "combat works mechanically" and "combat plays well."
- Starting equipment auto-equipped + combat-functional via new `lib/game/starting-equipment.ts` module (15 backgrounds × full equip + 2× potion each)
- Encounter banner templated (no LLM call): `"You encounter X and Y at <Location>."` 15px bold italic light coral
- Turn boundary separators: `player_turn_start` / `enemy_phase_start` events emitted by combat-engine; `round_start` events now correctly returned in events array (latent bug fix)
- Pacing delays at turn transitions: 800/500/800ms
- Header pill `displayPhase` decoupled from `current_turn_index`, flips ahead of feed at transitions, 200ms color transition

36 new tests, 209 total. `/game` 104 → 105 kB.

### Combat Day 20 — Prompt 3/3 (commit abf73e6 — 173/173 tests, clean build)

Combat mode UI (CombatMode + 6 child components, side-by-side layout, ~128px portrait slots reserved for future images), templated routine events + LLM dramatic narration via `/api/game/narrate-combat`, bestiary codex entries on `combat_start` (deduplicated by `enemy.id`), new-game preamble `"Your adventure begins. What will you do first?"`, HP bar 300ms transition + crit portrait shake 400ms via transient `shakeMap`. 24 new tests. `/game` 96 → 104 kB.

### Combat Day 20 — Earlier rounds (foundation)

- **Prompt 2.5 Nav Fix (25ff111):** hyphenated region names slugify wrong → directHit fallback misses → idempotent `apply-regional-bible` + `region-expansion-guard` helpers + step 4d reclassification. 16 new tests, 149 total.
- **Prompt 2/3 (a4e5975):** Combat state types, combat-resolver (pure math), encounter trigger in step 7c-3, turn loop, navigation_trail tracking, dev override. 61 new tests, 133 total.
- **Prompt 1/3 (1024287):** Enemy interface, bestiary files (Fantasy 14 entries, others 3 placeholders each), WorldBible/RegionBible LLM extensions, validate-don't-500, stub loot drops. 29 new tests, 72 total.

### Pre-Combat (movement track)
- **Region/Resilience Round (87c89a3):** region tier description from parent for any node; map defaults to Local; landmark color flipped to mint; new region wires origin symmetrically; RegionBible stub fallback.
- **Polish Round (b7032f9):** tier-aware highlight colors; NPC speech warm cream italic 600; region zone retains adjacent cards on return.
- **Earlier rounds:** Targeted Fix (dc5bcd8), Regression Fix (75a7cd4), Bug Fix (57b0300), Architecture Hardening (57d27f3), and the 19A-19F generation phases.

### Architecture Status ✅
```
Domain 1 (Engine):     World graph, navigation, stat checks, dialogue option
                       generation, combat resolver (V8.32), combat turn loop
                       (V8.32), encounter triggers (V8.32), region expansion
                       guard (V8.33), combat UI (V8.34), bestiary codex
                       (V8.34), starting equipment module (V8.35), turn
                       separators + pacing (V8.35), initiative kickoff +
                       inventory stats (V8.36), full-width separators +
                       crit banner + suppression + resolution banner
                       (V8.37), loot resolver (pending Day 21) — pure code
Domain 2 (Content):    WCD, WorldBible (with enemies + encounter tagging),
                       RegionBible (same), NPCs, items, bestiary,
                       starting-equipment loadouts (V8.35) — frozen

AI during gameplay:
  ✅ Arrival narration  — first visit only, cached permanently after
  ✅ Dialogue options   — built by code, AI writes response only
  ✅ Action narration   — 1-4 sentences (out-of-combat only)
  ✅ NPC not present    — hardcoded "X isn't here"
  ✅ Combat round narration — selective dramatic events: crit (banner +
                              prose two-line, V8.37), kill (suppressed when
                              victory follows, V8.37), victory/defeat/
                              flee_success (banner + ≤20-word prose
                              centered two-line, V8.37). Genre tone primer.
                              combat_start templated (V8.35).
  ⏳ Container search   — pending Container+Loot system
  ⏳ Verbal action      — Day 20.4: chat input → taunt/distract/intimidate
                          via LLM judging + charisma check
```

### Combat System ✅ COMPLETE (V8.31 + V8.32 + V8.34 + V8.35 + V8.36 + V8.37)
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
  Shared advanceUntilPlayerTurnOrEnd helper (V8.36) used by both
  executePlayerAction and kickoffCombatIfEnemyFirst.

INITIATIVE KICKOFF (V8.36):
  kickoffCombatIfEnemyFirst — when turn_order[0] !== PLAYER, runs
  enemy phase before player gets control. useCombat.kickoffCombat
  fires from useEffect with double-fire guard.

UI LAYER (V8.34, refined V8.37):
  /components/game/CombatMode/ — CombatMode, CombatantRow, PortraitSlot,
    HPBar, ActionBar, TargetPicker, UseItemPicker.
  Side-by-side layout. Story feed combat events with per-event styling.
  Full-width turn separators (V8.37 — flex container, lines flank label).
  CRITICAL HIT banner two-line (V8.37 — banner instant + prose async).
  Victory/Defeat/Escaped two-line centered (V8.37 — banner + ≤20-word prose).

INPUT GATING (V8.37):
  ActionBar buttons are the ONLY combat input path during V8.37.
  useGameLoop.submitAction early-bails on combat.active with system
  message "Combat input is disabled — use the action buttons."
  INTERIM until Day 20.4 lands verbal action handling.

NARRATION LAYER (V8.34, refined V8.35 + V8.37):
  /api/game/narrate-combat — genre-specific tone primer.
  Templated: combat_start (V8.35), use_item (V8.37 with heal amount),
             round_start, player_turn_start, enemy_phase_start,
             CRITICAL HIT banner (V8.37), Victory/Defeat/Escaped
             banner (V8.37), all routine events.
  LLM dramatic: crit prose (suppressed when victory follows, V8.37),
                kill prose (dropped when victory follows, V8.37),
                victory/defeat/flee_success prose (≤20 words, V8.37).
  max_tokens: 250 for crit/kill, 120 for resolutions (V8.37).

EVENT SUPPRESSION (V8.37):
  planEventSuppression(events) pure helper pre-scans batches. When
  victory is present: all kill events dropped entirely, last crit
  before victory has prose suppressed (banner only). Reduces a
  crit-kill→victory from 3 LLM calls to 1.

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
  Damage/Armor/Heal stat lines + EQUIPPED pill on detail panel.

DEV TOOLS (V8.32):
  window.__forceEncounter("enemy_id", ...) — dev-only override.
```

### Region Expansion Guard ✅ (V8.33)
```
/lib/game/region-expansion-guard.ts — pure helpers, two callers.
ROOT CAUSE: toSlug() strips hyphens. Guard works AROUND this.
```

### Navigation Rules ✅ (Complete)
```
Map = PURELY VISUAL. Genre renderers active. All navigation via nav bar.

Card grammar: [← BACK] [→ DEEPER...] [↑ EXIT] [◆ PEER...] [◇ UNDISCOVERED...]

Region trigger reclassification (V8.33): known region → GRAPH_NAVIGATE.
Combat trigger (step 7c-3): shouldRollEncounter on every arrival.
last_settlement_hub_id + navigation_trail update on every arrival.
combat_start writes bestiary codex (V8.34) + renders templated banner (V8.35).
kickoffCombat fires from useEffect when enemy has initiative (V8.36).
Combat input blocked during fights with system message (V8.37 — interim).
```

### Map Description Sourcing ✅ (V8.27, hardened V8.28, generalized V8.30)
```
World tier  → wcd.world_description
Region tier → currentRegion.atmosphere (via parentRegionId chain walk)
Local tier  → currentLocation.atmosphere
```

### NPC Dialogue System ✅
```
Option list: built by code from NPC.knowledge[] asset.
AI writes: response text only.
NPC quoted speech: .ew-said class — pending higher-contrast pass in Prompt 4.
```

### RegionBible Resilience ✅ (V8.30, extended V8.31, idempotent V8.33)
Model: claude-haiku-4-5-20251001, max_tokens: 7000. Stub fallback. Idempotent on re-apply.

### WorldBible Resilience ✅ (V8.31)
Model: claude-sonnet-4-5, max_tokens: 10000. validateEnemy/validateEnemies/scrubEncounterRoster — warn-don't-500.

### Known issues

**Day 20.4 — Verbal Action System (NEXT — design locked V8.37):**
Replaces the V8.37 "Combat input is disabled" interim block with a real chat-input handling mechanic.
- Player types verbal action during combat → `/api/game/parse-combat-verbal-action` LLM judges quality (poor/decent/good/brilliant), target enemy, type (taunt/distract/intimidate/non_combat)
- Engine resolves: 1d20 + charisma_mod + quality_mod vs 10 + target.agi_mod
- On success applies `status_effect` to target enemy for next round only:
  - **Taunt**: target's next attack auto-targets player (+2 to hit you, +2 AGI defense vs them)
  - **Distract**: target's next attack -2 to hit, -2 to damage
  - **Intimidate**: target loses next turn entirely; brilliant roll → 10% flee chance
- Spammable (one per turn, no cooldown). Failure = turn forfeit. Non_combat (irrelevant input) = turn forfeit + templated "That's not going to help right now."
- New CombatEvent type `verbal_action`. New CombatEnemyInstance.status_effect field. Cleared at start of each round.
- Three-line story render: player quote echo + LLM reaction prose (italic light) + templated mechanical outcome.

**Polish Round (Prompt 4) — design locked V8.36, queued post-20.4:**
- **Movement-direction grouped nav cards.** Nav bar groups cards into rows by movement direction: BACK / DEEPER / PEER / UNDISCOVERED. Empty groups don't render. Group labels light/optional.
- **Tier color-coding within each group.** Region cards (lavender), settlement cards (sky-blue), sub-location cards (mint), dungeon cards (new color). Layered with movement-direction grouping.
- **Settlement hub card on new region arrival reads as back-from-settlement** — card-typing fix in NavigationBar's region-zone D2 branch.
- **Map does not auto-switch tiers on cross-region arrival.**
- **NPC dialogue text needs higher contrast.** `.ew-said` doesn't read distinctly enough.

**Map visual rework (dedicated session, post-Prompt-4):**
- Per-node decorative shelf line cleanup; connection line endpoint geometry; sizing/visual hierarchy; label collision.

**Component test infrastructure (V8.34 deferral):**
- jest is `testEnvironment: "node"` — no jsdom/RTL setup. Adding RTL is a separate task.

**Pacing tuning (V8.35 watchpoint):**
- 800/500/800ms delays may need adjustment after extended playtest.

**Other deferred:**
- NPC highlight color (orange) too similar to item highlight (yellow) in Fantasy.
- Hub node not added to codex on first arrival to new region.
- Step 7 individual branches: confirm each sets `discovered: true` (relying on safety net).
- Starting region nodes lack `grid_position` — masked by V8.28 isValidPos guard.
- Behavior dispatch beyond flavor text deferred (combat-spec §6.3) — every enemy attacks the player.
- `toSlug` strips hyphens — masked by V8.33 region-expansion-guard.
- Combat balance at character level 1 vs regional enemies is intentionally punishing pre-Day-21/Day-22.

---

## 🏗️ Architecture

### The Two Domains ✅
**Domain 1 (Engine — pure code):** Navigation, stat checks, dialogue option generation, combat resolver + turn loop + encounter triggers (V8.32), region expansion guard (V8.33), combat UI + narrator + bestiary (V8.34), turn separators + pacing + starting equipment module (V8.35), initiative kickoff + inventory stats display (V8.36), full-width separators + crit banner + suppression + resolution banner (V8.37), loot resolver (pending Day 21).
**Domain 2 (Content Library — frozen):** WCD, locations, NPCs, items, loot tables, main quest, bestiary, region enemies, starting equipment loadouts (V8.35).

### Generation Model ✅
RegionBible: claude-haiku-4-5-20251001, max_tokens 7000. Stub fallback. Idempotent.
WorldBible: claude-sonnet-4-5, max_tokens 10000. Includes enemies + encounter tagging.
WCD includes `world_description`.
Combat narrator: claude-sonnet-4-5. max_tokens 250 for crit/kill, 120 for resolutions (V8.37). Genre tone primer per call.

### Map System ✅
```
Genre renderers active (pickModule enabled). PAD=76. Tier switcher.
Initial tier on mount: Local (V8.30).
⚠️ Tier auto-switch on cross-zone arrival pending — Prompt 4.
⚠️ Map visual rework deferred to dedicated post-Prompt-4 session.
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
38. Combat narration is selective: routine events use code-templated lines (no API call); dramatic events call /api/game/narrate-combat. Variant selection deterministic via timestamp hash. (V8.34, refined V8.35: combat_start templated; refined V8.37: crit prose suppressed when victory follows)
39. CombatMode is the bottom-strip swap when `master_state.combat?.active === true`. NavigationBar + InputBar hide; CombatMode renders at min-height: min(33vh, 360px). Story feed shrinks above but remains scrollable. (V8.34)
40. Each combatant row reserves a portrait slot (~128px). Day 20: single-letter glyph placeholder. portraitUrl prop accepts real images later without layout change. (V8.34)
41. Bestiary codex entries write on `combat_start`, deduplicated by enemy.id. Description: flavor + HP range + damage die + first-seen location. (V8.34)
42. New game preamble: `recent_messages.length === 0` triggers "Your adventure begins. What will you do first?" with isFreshGamePreamble flag. (V8.34)
43. Starting equipment lives in `lib/game/starting-equipment.ts` as a separate module — Next.js App Router routes can only export HTTP handlers. (V8.35)
44. Every starting weapon ships with `equipped: true` AND `effect.damage_die`. Every starting armor ships with `equipped: true` AND `effect.armor_bonus`. (V8.35)
45. `combat_start` is templated, not LLM-narrated. Renders directly from useGameLoop step 7c-3. (V8.35)
46. `player_turn_start` and `enemy_phase_start` events emitted by combat-engine at phase transitions. They do NOT emit when combat ends in victory/defeat/flee. (V8.35)
47. Pacing delays at turn transitions: 800ms before `enemy_phase_start`, 800ms before `player_turn_start`, 500ms between successive distinct enemy actors. No delay before routine player events. (V8.35)
48. CombatMode header pill `displayPhase` is decoupled from `combat.current_turn_index` and flips ahead of feed at phase transitions. The pill — not the feed — is the canonical turn indicator. (V8.35)
49. Enemy-turn loop is shared via `advanceUntilPlayerTurnOrEnd` (combat-engine.ts). Both `executePlayerAction` and `kickoffCombatIfEnemyFirst` call it. Single source of truth. (V8.36)
50. When combat starts with `turn_order[0] !== PLAYER`, the initial enemy phase MUST fire before UI hands control to the player via `kickoffCombat` from useEffect. Tracked via `useRef<Set<string>>` to prevent double-fire. setDisplayPhase("enemy") fires synchronously so no "Your turn" flash. (V8.36)
51. Inventory detail panel surfaces combat stats: WEAPON → `Damage: <die>`, ARMOR → `Armor: +<bonus>` (always rendered, including +0), CONSUMABLE → `Heal: 1d8+4` or `Heal: N`. EQUIPPED pill renders next to rarity when `selectedItem.equipped === true`. (V8.36)
52. Combat input is button-only when combat is active. `useGameLoop.submitAction` early-bails on `combat.active` with system message "Combat input is disabled — use the action buttons." This is INTERIM (V8.37); Day 20.4 will replace the block with verbal action handling. forceMoveToNode is allowed through (defeat/flee teleports). (V8.37)
53. Use Item is templated only — never LLM. Format: `"You use <item>. Restored N HP."` with damage 0/null dropping the heal suffix. (V8.37)
54. Crit events render as TWO lines: templated `"⚔ CRITICAL HIT — N damage."` banner first (instant, mono 13px bold uppercase), then LLM crit prose. Both styled with same actor-derived color. (V8.37)
55. `planEventSuppression(events)` pre-scans event batches before story-feed projection. When victory is present: all kill events dropped entirely from feed; last crit before victory has prose suppressed (banner renders, no LLM call). Reduces a crit-kill→victory from 3 LLM calls to 1. Defeat batches intentionally untouched. (V8.37)
56. Resolution events (victory/defeat/flee_success) render as two-line centered block: banner word (Victory/Defeat/Escaped, mono 18px bold uppercase) + shortened LLM prose (serif italic 13px). narrate-combat uses max_tokens 120 with "ONE sentence, max 20 words" hint for resolutions; crit/kill keep 250 max_tokens. (V8.37)

---

## Narrator Prompt Order ✅

DIALOGUE: WCD → HARD RULES → RESPONDING CHARACTER → CLOSED CONTEXT (selected knowledge) → TIER 1 OBJECTS → WORLD ASSETS → SCENE → VERBOSITY
non-DIALOGUE: WCD → HARD RULES → NPCS PRESENT → TIER 1 OBJECTS → CONNECTED LOCATIONS → WORLD ASSETS → SCENE → VERBOSITY
COMBAT (V8.34, refined V8.37): GENRE TONE PRIMER → COMBAT EVENT (mechanical truth) → HARD RULES → length hint per event tier (resolutions ≤20 words, crit/kill 2-3 sentences)

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
  Victory color:           #7dbb8e mossy green (--combat-victory)
  Defeat color:            #a93226 dark red (--combat-defeat)
  Flee color:              #a8a29c grey-tan (--combat-flee)

COMBAT (V8.35):
  Encounter banner:        #f4a07a light coral (--combat-encounter-banner)
                           15px bold italic, center-aligned
  Turn separators:         11px italic, 0.55 opacity --ink-2

COMBAT (V8.37):
  Turn separators (UPGRADED): flex-width, label between flanking rules,
                              full story-panel width
  Crit banner line:          mono 13px bold uppercase, 0.08em letter-spacing,
                             actor-derived color
  Resolution banner:         mono 18px bold uppercase, 0.12em letter-spacing,
                             centered block; resolution color
  Resolution prose:          serif italic 13px, centered, resolution color
```

---

## Planned Systems

| System | When | Description |
| --- | --- | --- |
| Day 20.4 — Verbal Action | NEXT | Chat-input hijack: taunt/distract/intimidate via LLM judging + charisma + status_effects |
| Polish Round (Prompt 4) | After 20.4 | Movement-direction grouped nav cards + tier color-coding + settlement card label + tier auto-switch + NPC dialogue contrast |
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

*Last updated: V8.37 — Day 20.3 Combat Polish 2 (commit 732e944): full-width turn separators (flex-width with flanking rules), use_item locked to buttons with templated heal amount, combat input blocked during fights with system message (interim until Day 20.4), CRITICAL HIT banner two-line render (templated banner + LLM prose), planEventSuppression saves up to 2 LLM calls per crit-kill→victory, Victory/Defeat/Escaped two-line centered banner with ≤20-word prose. 233/233 tests passing. /game route 106 kB unchanged. Foundational rules 52-56 added. Day 20.4 (verbal action / taunt system) up next: chat-input hijack with LLM judging + charisma check + status_effects.*
