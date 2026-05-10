# Project: Endless Worlds RPG — Master Context

**Version:** 8.37
**Status:** Day 20 Combat COMPLETE + 20.1/20.2/20.3 polish landed — Day 20.4 (Combat Polish 3) in flight
**Objective:** A text-based RPG that generates a unique world for every playthrough. Genre-agnostic, infinitely replayable, CRPG depth.

**Reference:** /docs/architecture-spec.md — The definitive source for all Domain 1 vs Domain 2 decisions. /docs/combat-spec.md — The authoritative source for combat system design.

---

## 🎮 Game Vision

The north-star scenario this entire project is being built for:

> **Tim and his wife (or a friend) are sitting in the living room on a Saturday night. One of them says "let's play." Both pull out phones, tap a website, pick a genre, name a character. Within a couple minutes they're in a brand-new world neither has seen before — a quest waiting, NPCs to meet, dungeons to crawl, lore to discover. They play for an hour or two and walk away having had a real D&D-style adventure.**

This scenario drives every design decision. If a feature makes that scenario *better*, it's worth building. If it doesn't, it's polish or scope creep.

### What this game IS

- **A pickup D&D-style RPG.** Sit down, play in a few minutes, walk away when you're done. Like ordering a pizza vs cooking dinner.
- **Procedurally generated every game.** No two playthroughs share a world. Quest line, locations, NPCs, lore, win condition — all generated fresh.
- **AI-narrated with D&D-style prose.** Descriptions that hit home. The kind of language a good DM would use, not flat database text.
- **CRPG-depth mechanics.** Real stat checks, inventory, leveling, gear, combat math — not just choose-your-own-adventure clicking.
- **Multiple play styles supported simultaneously.** The game does not railroad. The same world can be:
  - **Long quest playthrough** — follow the breadcrumbs, beat the win condition, hours of play
  - **Speedrun-the-end** — figure out the win condition fast and rush it
  - **Pure exploration** — wander regions, see what's out there, no quest pressure
  - **Settlement-focused** — grind levels, talk to NPCs, develop the character
  - **Lifestyle/job grind** (eventual) — become the best blacksmith / scholar / merchant in the realm; affects how the world reacts to you
  - **Mixed** — switch modes mid-session
- **Mobile-first accessible.** Designed for phone screens, fast-loading, runs on web. The phone in your pocket IS the game console.
- **Multiplayer eventually** (post-MVP). Two phones, one shared world, take turns or play simultaneously.
- **User-customizable worlds eventually** (post-MVP). Player can guide AI on world themes — "haunted Victorian England" / "post-apocalyptic Mars colony" / "kingdom of warring deities" — beyond the fixed genre presets.

### What this game IS NOT

- **Not Baldur's Gate.** No 80-hour campaigns. No mouse-and-keyboard required. No tactical combat with positioning grids. The complexity should be in narrative depth and character growth, not in interface complexity.
- **Not a CYOA / interactive fiction tool.** Real mechanics matter — dice, stats, gear, levels, consequences. The AI is a narrator, not the entire game system.
- **Not a long-term commitment to a single character.** Worlds are disposable; characters are disposable. The replayability is from running NEW playthroughs, not from grinding one to max level.
- **Not a tabletop replacement.** It complements physical D&D — it's the option for when you DON'T have a DM, four hours, and a kitchen table.
- **Not a hardcore strategy game.** Combat should feel impactful and tactical-ish, but the goal is dramatic narrative beats with mechanical weight, not min-maxing.

### Competitive positioning

> **"Baldur's Gate depth without Baldur's Gate overhead. D&D feel without needing a DM."**

The market gap this fills: there is no easy, fast, accessible way to have a D&D-style adventure on a phone with a friend. Existing options force a tradeoff:
- Real D&D → needs DM, prep, hours, table
- Baldur's Gate / Pillars / similar CRPGs → desktop, complex UI, long campaigns, single-player
- Choose-your-own-adventure apps → no real mechanics, no replayability
- AI Dungeon and clones → no structured RPG layer, easy to break, no real game
- Tabletop simulators / Roll20 → still need a DM and party

This game wins by being structured-but-light, AI-narrated-but-mechanically-grounded, mobile-first, multiplayer-aware, and replayable by design.

### Design principles derived from this vision

These should guide ALL feature decisions. When in doubt, check the principle.

1. **Pickup-friendly.** Time from "let's play" to "playing" must stay short. World gen, character creation, first-action latency — all within the patience window of "we just sat down."
2. **Mobile-first viewport.** Every UI is verified on phone-width before desktop polish. Combat panel, nav, story feed, modals — all phone-readable first.
3. **Multiple play styles supported.** No system should force one playstyle. Settlements need self-contained content (jobs, NPCs, training) so settlement-focus players can ignore the main quest. Quest must be optional, not gating. Exploration must be rewarded (codex entries, lore, hidden locations) without quest reasons.
4. **Procedural variety > authored depth.** Lean on AI generation for breadth (different worlds every time) and code structure for reliability (mechanics work consistently across all worlds). Hand-authored content should be content templates and rules, not specific story content.
5. **Multiplayer-aware architecture.** Decisions made now should not preclude 2-4 player co-op. Specifically: deterministic combat (RNG injected ✓), serializable state (✓), event-driven UI (✓), party-of-N character schema (currently single-player; will need extension), turn-syncing infrastructure (will need Supabase realtime channels).
6. **Customization-aware architecture.** WCD generation prompts and genre system should be designed so user-supplied themes / constraints can plug in later without a rewrite.
7. **D&D-style narration is the soul.** Combat narration, arrival narration, dramatic moments — they need to feel like a good DM is describing them. Tone, weight, specificity matter. Generic "you attack the goblin and hit" is failure; "your blade catches the goblin's collarbone with a wet crunch" is the bar.
8. **Death must matter.** Defeat costs something real (HP, currency, XP rollback). Settlements as checkpoints become a deliberate mechanic, not a forgettable formality. (V8.36 cross-region defeat-teleport behavior is part of this.)

---

## 🎯 Project Roles & Working Mode

**Vision & Creative Direction:** Tim (the user). Drives game vision, design intent, feature priority, what the game IS at its core. First-time game developer, building the type of game he's always wanted to play and that doesn't currently exist.

**Senior Engineering / Tech Direction:** Claude.ai (this assistant). Translates vision into architecture, flags scope/risk/feasibility concerns, suggests alternatives, recommends sequencing based on game-production patterns. Has explicit license to push back when:
- Something is premature given current foundations
- A cleaner / more reliable approach exists that Tim hasn't considered
- Scope is drifting in a way that risks future-proofing
- Critical-path systems are being skipped for polish features

While ultimately deferring to creative-director call on vision questions. Creative input from Claude.ai is welcome too, not just engineering pushback.

**Implementation:** Claude Code (local Sonnet agent on Tim's machine). Executes round-by-round prompts written by Claude.ai based on Tim's direction.

**Decision flow:**
1. Tim describes what he wants
2. Claude.ai assesses: is this the right thing right now? Is there a better way? Does it create future problems? Does it serve the Game Vision?
3. Claude.ai responds with feasibility analysis, alternative approaches if relevant, recommended sequencing if scope concerns exist
4. Tim makes the creative-director call (override or accept the recommendation)
5. Claude.ai writes the prompt for Claude Code with locked decisions and explicit don't-touch boundaries
6. Claude Code implements; Tim verifies; Claude.ai updates CLAUDE.md

**This means:** Tim's instinct to do something a particular way is an opening position, not a final decision, until Claude.ai has weighed in. Tim retains full override authority but expects pushback when warranted. Strategic discussions get captured in the Strategic Trajectory Notes section below for future Claude sessions to inherit.

---

## 📋 Strategic Trajectory Notes

Living section. Captures meta-discussions about project direction, sequencing concerns, recommended pivots, and architectural debates that don't fit in feature documentation. New Claude sessions should read this for current strategic context before proposing prompts.

### V8.37 — Combat scope drift assessment + recommended sequencing

Day 20 was originally scoped as a single combat prompt. It expanded to seven commits (1, 2, 2.5, 3, 20.1, 20.2, 20.3, with 20.4 in flight). Each round was justified individually but cumulatively this represents heavy investment in combat polish ahead of the systems combat depends on (loot, leveling, quest).

**Concern:** Continued combat polish risks tuning combat math around level-1 starter equipment forever. Real difficulty calibration only happens after loot tables (Day 21) and leveling (Day 22) land. Tim has already encountered this — fights against high-AGI regional enemies that require flee, with no path to grow past it.

**Recommended sequence after Day 20.4 lands (CONFIRMED V8.37):**
1. **Polish Round (Prompt 4)** — clear visible UX debt (nav grouping, tier colors, settlement card label, tier auto-switch, NPC dialogue contrast). Bundle mobile-viewport QA pass.
2. **Day 21 — Container + Loot** — real loot tables, dungeon containers, merchant inventories. Combat balance solves itself when better gear drops.
3. **Day 22 — Skills + Leveling** — XP gates, stat points, level gates, special combat abilities.
4. **Vertical slice playtest** — full game start → main-quest progression → win condition (with placeholder content where needed). Surface integration issues before adding more features.
5. **Day 23 — Main Quest Thread** — informed by playtest insights.
6. **Day 20.5 — Verbal Action / Taunt** — DEFERRED. Mechanic shines more when stats/gear matter.

**Tim confirmed this sequence in V8.37.** Verbal action is officially deferred to post-Day-22.

### V8.37 — Vision capture

Tim laid out the full game vision in detail (captured in 🎮 Game Vision section above). Key new additions to engineering awareness:
- **Mobile-first** is a hard requirement, not aspirational. Polish Round should bundle mobile-viewport QA pass.
- **Multiplayer is in scope** (post-MVP). Architecture decisions in Day 21-23 should not preclude 2-4 player co-op. Specifically watch: party-of-N character schema (currently single-player), turn-syncing infrastructure (currently single-client).
- **Customization layer is in scope** (post-MVP). Genre system might evolve from fixed-5 to "preset + user modifiers." World gen prompts should be designed so user-supplied themes can plug in.
- **Lifestyle skills / jobs system** is part of the long-term vision. Day 22 leveling design should consider: do we lay foundations for lifestyle skills (XP per skill domain — combat / crafting / social) now, or scope leveling as combat-stats-only first and add skill domains later? Open question.

**World generation perf concern (V8.37):** 35s WCD + 120s WorldBible = 2.5min from "let's play" to "playable." Borderline for the pickup-play scenario, especially before multiplayer where two players watch the same loading screen. NOT urgent for single-player MVP but flagged as a future perf budget item. Possible mitigations: parallel WCD/WorldBible generation, faster model for sub-content, pre-warmed world pool background-generated.

### Open strategic questions / future discussions

- **Multiplayer timing.** Pre-launch or post-launch v2? Affects whether Day 25-ish is a multiplayer foundation round or whether we ship single-player first and add multiplayer later. Tim to decide before Day 22.
- **Customization layer timing.** Pre-launch or post-launch v2? Affects how generalized world generation needs to be in Day 21+. Tim to decide before Day 23.
- **Skills/jobs system depth at Day 22.** Combat-stat-only leveling first (faster), or lifestyle-skill foundations now (more work, sets up bigger vision)? Tim to decide before Day 22.
- **External playtest timing.** When does the first "stranger plays the game" playtest happen? Likely best post-Day-22 or post-Day-23.
- **Difficulty tuning model.** Once leveling lands, does combat need a difficulty toggle (easy / standard / hard), or should world tier handle this implicitly via region depth?
- **Random travel encounters** (per combat-spec §3 deferral). Currently slated post-Day-21; might fit better as part of Day 22 or Day 23 depending on quest design (don't want random encounters interrupting quest breadcrumbs).
- **Verbal action redundancy risk.** If Day 22 leveling adds a Charisma skill tree with active abilities (intimidate, persuade, etc.), the verbal-action types might need reconciling with skill abilities.
- **NPC behavior dispatch** (combat-spec §6.3 deferral). Currently every enemy just attacks the player. Behavior dispatch (target weakest, focus, retreat at low HP, summon) is queued for "future combat-depth pass."
- **Map visual rework.** Pure visual debt; deferred to its own session. Not critical-path.

---

## 🔄 Current Status (Read This First)

**Current Phase:** Day 20 Combat fully playable end-to-end with proper pacing, equipment, initiative kickoff, and dramatic two-line crit/resolution rendering. Day 20.4 (floating damage numbers + inline roll details + defeat teleport fix) currently in flight. Combat input is currently blocked with a system message during fights.
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
| 20.3 — Combat Polish 2 (732e944) | Full-width separators, item use locked to buttons, CRITICAL HIT banner, victory/defeat/escaped two-line render, prose suppression on victory-killing-blow | ✅ Complete |
| **20.4 — Combat Polish 3** | **Floating damage numbers over portraits + inline roll details in story-feed events + defeat teleport fix (init last_settlement_hub_id at spawn, cross-region teleport to last settlement, "You wake at X in Y" templated message line)** | ⏳ **In flight** |
| Polish Round (Prompt 4) | Movement-direction grouped nav cards + tier color-coding + settlement card label + tier auto-switch + NPC dialogue contrast + mobile-viewport QA bundle | ⏳ Confirmed next post-20.4 |
| 21 | Container + Loot — registry, loot tables, dungeon sub-levels, real loot beyond stub | ⏳ Confirmed after Polish Round |
| 22 | Skills + Leveling — XP, stat points, level gates, special combat abilities | ⏳ Confirmed after Day 21 |
| Vertical slice playtest | Full game start → win condition with placeholder content where needed | ⏳ Confirmed before Day 23 |
| 23 | Main Quest Thread — breadcrumb injection, quest tracking | ⏳ Confirmed post-playtest |
| 20.5 — Verbal Action System | Chat input hijack: taunt / distract / intimidate via LLM judging + charisma check + status effects (DESIGN LOCKED, deferred to post-Day-22 per V8.37) | ⏳ Deferred post-Day-22 |
| Map Visual Rework | Dedicated session | ⏳ Deferred (no critical-path dependency) |

**Active genres:** Fantasy, Cyberpunk, Horror/Lovecraftian, Space Opera, Post-Apocalyptic
**⚠️ Noir removed. Genre renderers restored (pickModule re-enabled).**

### Day 20.3 — Combat Polish 2 (commit 732e944 — 233/233 tests, clean build)

Six-task polish round resolving story-feed rendering issues from V8.36 playtest + locking down combat input integrity.

**Task 1 — Full-width turn separators:** New flex-based CSS in globals.css. StoryFeed strips the V8.35 dash decoration from `round_start` / `player_turn_start` / `enemy_phase_start` and renders rule-line ── label ── rule-line spanning full story-panel width.

**Task 2 — Lock item use to buttons:** `templates.ts::renderUseItem` produces `"You use Basic Health Potion. Restored 8 HP."` (was "+N HP."). `useGameLoop.submitAction` early-bails on `combat.active` with system message `"Combat input is disabled — use the action buttons."` `forceMoveToNode` allowed through (defeat/flee teleports). INTERIM until Day 20.5 verbal action.

**Task 3 — CRITICAL HIT banner (two-line render):** New `renderCritBanner(event)` in templates.ts. `useCombat::projectCombatEventsToFeed` intercepts crit events: pushes templated banner FIRST (instant), then fetches LLM prose. Both styled with same actor-derived color (player blue / enemy red).

**Task 4 — Suppress crit/kill prose on victory:** New `planEventSuppression(events)` pure helper. When victory present: kill events dropped entirely, last crit before victory has prose suppressed (banner only). Crit-kill→victory now produces 1 LLM call (was 3). Defeat batches untouched.

**Task 5 — Victory/Defeat/Escaped two-line banner:** New `renderResolutionBanner(event)`. Mono 18px bold uppercase banner + serif italic 13px ≤20-word LLM prose, both centered. `narrate-combat` resolution events: max_tokens 250→120, prompt enforces "ONE sentence, max 20 words."

**Tests:** 17 new (templates +8, combat-suppression +9). 233 total.
**Build impact:** `/game` route 106 kB unchanged.

### Day 20.2 — Combat Hotfix + Inventory Stats (commit bf3871e — 216/216 tests, clean build)

ROOT CAUSE: `executePlayerAction` was the only place enemy turns auto-advance; if `rollInitiative` seated an enemy at `turn_order[0]`, permanent deadlock.

**Engine fix:** Extracted enemy-turn loop into shared `advanceUntilPlayerTurnOrEnd`. New `kickoffCombatIfEnemyFirst` runs enemy phase when player doesn't have initiative.

**Hook fix:** New `kickoffCombat()` async fn. useEffect watches `masterState.combat.encounter_id + active`, fires kickoff with double-fire guard via `useRef<Set<string>>`. setDisplayPhase("enemy") fires synchronously so no "Your turn" flash.

**Inventory cards:** `combatStatsLine(item)` helper: `"Damage: 1d6"` / `"Armor: +2"` (always renders, including +0) / `"Heal: 1d8+4"` (canonical potion) or `"Heal: N"` (flat). EQUIPPED pill (--hl-pass green) on detail panel.

**Tests:** 7 new. 216 total. `/game` 105 → 106 kB.

### Day 20.1 — Combat Polish (commit 1215bb6 — 209/209 tests, clean build)

Starting equipment auto-equipped + combat-functional via new `lib/game/starting-equipment.ts` module (15 backgrounds × full equip + 2× potion each); encounter banner templated; turn boundary separators (`player_turn_start` / `enemy_phase_start` events emitted by combat-engine; `round_start` events now correctly returned in events array — latent bug fix); pacing delays 800/500/800ms; header pill `displayPhase` decoupled from `current_turn_index`.

36 new tests, 209 total. `/game` 104 → 105 kB.

### Combat Day 20 — Prompt 3/3 (commit abf73e6 — 173/173 tests, clean build)

Combat mode UI (CombatMode + 6 child components, side-by-side layout, ~128px portrait slots reserved); templated routine + LLM dramatic narration via `/api/game/narrate-combat`; bestiary codex on `combat_start` (deduplicated by `enemy.id`); new-game preamble; HP bar 300ms transition + crit portrait shake 400ms. 24 new tests. `/game` 96 → 104 kB.

### Combat Day 20 — Earlier rounds (foundation)
- **Prompt 2.5 Nav Fix (25ff111):** hyphenated region names slugify wrong → idempotent `apply-regional-bible` + `region-expansion-guard` helpers. 16 new tests, 149 total.
- **Prompt 2/3 (a4e5975):** Combat state types, combat-resolver (pure math), encounter trigger in step 7c-3, turn loop. 61 new tests, 133 total.
- **Prompt 1/3 (1024287):** Enemy interface, bestiary files, WorldBible/RegionBible LLM extensions, validate-don't-500. 29 new tests, 72 total.

### Pre-Combat (movement track)
- **Region/Resilience Round (87c89a3):** region tier description from parent for any node; map defaults to Local; landmark color flipped to mint; new region wires origin symmetrically; RegionBible stub fallback.
- **Polish Round (b7032f9):** tier-aware highlight colors; NPC speech warm cream italic 600.
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
  ⏳ Container search   — pending Container+Loot system (Day 21)
  ⏳ Verbal action      — DEFERRED post-Day-22 per V8.37 trajectory note
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
  Full-width turn separators (V8.37).
  CRITICAL HIT banner two-line (V8.37).
  Victory/Defeat/Escaped two-line centered (V8.37).

INPUT GATING (V8.37):
  ActionBar buttons are the ONLY combat input path.
  useGameLoop.submitAction early-bails on combat.active with system
  message "Combat input is disabled — use the action buttons."
  INTERIM until Day 20.5 (deferred post-Day-22) lands verbal action.

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
  planEventSuppression(events) pure helper pre-scans batches.

PACING (V8.35):
  ENEMY_PHASE_DELAY_MS = 800 / PLAYER_TURN_DELAY_MS = 800 /
  ENEMY_TURN_GAP_MS = 500.

UI INDICATORS (V8.35):
  CombatMode header pill — 11px bold uppercase mono. displayPhase
  decoupled from current_turn_index.

BESTIARY CODEX (V8.34):
  writeBestiaryEntry on combat_start (deduplicated by enemy.id).

STARTING EQUIPMENT (V8.35):
  /lib/game/starting-equipment.ts — 15 backgrounds, all equipped.

INVENTORY DISPLAY (V8.36):
  Damage/Armor/Heal stat lines + EQUIPPED pill on detail panel.

DEV TOOLS (V8.32):
  window.__forceEncounter("enemy_id", ...) — dev-only override.
```

### Region Expansion Guard ✅ (V8.33)
`/lib/game/region-expansion-guard.ts` — pure helpers. ROOT CAUSE: toSlug() strips hyphens. Guard works AROUND this.

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
Option list built by code from NPC.knowledge[]. AI writes response text only. NPC quoted speech `.ew-said` class — pending higher-contrast pass in Polish Round.

### RegionBible Resilience ✅ (V8.30, extended V8.31, idempotent V8.33)
Model: claude-haiku-4-5-20251001, max_tokens: 7000. Stub fallback. Idempotent.

### WorldBible Resilience ✅ (V8.31)
Model: claude-sonnet-4-5, max_tokens: 10000. validateEnemy/validateEnemies/scrubEncounterRoster — warn-don't-500.

### Known issues

**Day 20.4 — Combat Polish 3 (IN FLIGHT):**
- Floating damage numbers over targeted combatant's portrait (28px bold, animated 1100ms float-fade, +prefix on heal, larger on crit, no animation on miss/fumble/defend/flee)
- Roll detail surfaced on CombatEvent (rolls field with d20/d20_modifier/target_dc/damage_die/damage_die_roll/crit_max_damage/str_modifier)
- Inline roll breakdown in templated story-feed events (subtle dim mono suffix: "(d20: 17 vs 12 | 1d6+2)")
- Defeat teleport fix: initialize last_settlement_hub_id at game spawn in apply-world-bible, cross-region teleport to last visited settlement (soulslike model — death is meaningful), templated "You wake at <Settlement> in <Region>." info line below resolution prose
- Flee success destination message: "You break to <Node>." templated line below flee prose

**Polish Round (Prompt 4) — design locked V8.36, confirmed next:**
- Movement-direction grouped nav cards (BACK / DEEPER / PEER / UNDISCOVERED rows)
- Tier color-coding within each group (region lavender, settlement sky-blue, sub-location mint, dungeon new color)
- Settlement hub card on new region arrival reads as back-from-settlement — card-typing fix
- Map does not auto-switch tiers on cross-region arrival
- NPC dialogue text needs higher contrast (.ew-said too close to ink-2)
- **Mobile-viewport QA pass** — verify combat panel, nav, story feed, modals all phone-readable (V8.37 vision addition)

**Day 20.5 — Verbal Action System (DEFERRED post-Day-22):**
Replaces the V8.37 "Combat input is disabled" interim block.
- Player types verbal action during combat → `/api/game/parse-combat-verbal-action` LLM judges quality (poor/decent/good/brilliant), target enemy, type (taunt/distract/intimidate/non_combat)
- Engine resolves: 1d20 + charisma_mod + quality_mod vs 10 + target.agi_mod
- On success applies status_effect to target enemy for next round only:
  - **Taunt**: target's next attack auto-targets player (+2 hit you, +2 AGI defense vs them)
  - **Distract**: target's next attack -2 hit, -2 damage
  - **Intimidate**: target loses next turn entirely; brilliant roll → 10% flee chance
- Spammable (one per turn). Failure = turn forfeit.
- New CombatEvent type `verbal_action`. New `CombatEnemyInstance.status_effect` field.

**Map visual rework (dedicated session):**
- Per-node decorative shelf line cleanup; connection line endpoint geometry; sizing/visual hierarchy; label collision.

**Component test infrastructure (V8.34 deferral):**
- jest is `testEnvironment: "node"` — no jsdom/RTL setup. Adding RTL is a separate task.

**Pacing tuning (V8.35 watchpoint):**
- 800/500/800ms delays may need adjustment after extended playtest.

**World gen perf (V8.37 vision flag):**
- 35s WCD + 120s WorldBible = 2.5min "let's play" → "playable." Borderline for pickup-play scenario, especially pre-multiplayer. Possible mitigations: parallel WCD/WorldBible, faster sub-content model, pre-warmed pool.

**Other deferred:**
- NPC highlight color (orange) too similar to item highlight (yellow) in Fantasy.
- Hub node not added to codex on first arrival to new region.
- Step 7 individual branches: confirm each sets `discovered: true` (relying on safety net).
- Starting region nodes lack `grid_position` — masked by V8.28 isValidPos guard.
- Behavior dispatch beyond flavor text deferred (combat-spec §6.3) — every enemy attacks the player. Future combat-depth pass.
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
Genre renderers active (pickModule enabled). PAD=76. Tier switcher. Initial tier on mount: Local (V8.30). ⚠️ Tier auto-switch on cross-zone arrival pending — Polish Round. ⚠️ Map visual rework deferred to dedicated post-Polish-Round session.

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
30. last_settlement_hub_id and navigation_trail update on every successful arrival in step 7c-2. Initialized at game spawn in apply-world-bible (V8.38, was V8.32 deferral). (V8.32)
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
52. Combat input is button-only when combat is active. `useGameLoop.submitAction` early-bails on `combat.active` with system message. INTERIM until Day 20.5 (DEFERRED post-Day-22) replaces with verbal action handling. forceMoveToNode allowed through (defeat/flee teleports). (V8.37)
53. Use Item is templated only — never LLM. Format: `"You use <item>. Restored N HP."` with damage 0/null dropping the heal suffix. (V8.37)
54. Crit events render as TWO lines: templated `"⚔ CRITICAL HIT — N damage."` banner first (instant, mono 13px bold uppercase), then LLM crit prose. Both styled with same actor-derived color. (V8.37)
55. `planEventSuppression(events)` pre-scans event batches before story-feed projection. When victory is present: all kill events dropped entirely from feed; last crit before victory has prose suppressed (banner renders, no LLM call). Reduces a crit-kill→victory from 3 LLM calls to 1. Defeat batches intentionally untouched. (V8.37)
56. Resolution events (victory/defeat/flee_success) render as two-line centered block: banner word + shortened LLM prose. narrate-combat uses max_tokens 120 with "ONE sentence, max 20 words" hint for resolutions; crit/kill keep 250. (V8.37)

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
**All vision/scope decisions defer to 🎮 Game Vision section above.**
**All strategic / sequencing decisions captured in 📋 Strategic Trajectory Notes section above.**

---

*Last updated: V8.37 (docs-only update, second pass) — Added 🎮 Game Vision section capturing the full pickup-D&D-on-phones north-star scenario, what the game IS / IS NOT, competitive positioning ("BG depth without BG overhead"), and 8 design principles derived from vision (pickup-friendly, mobile-first, multi-playstyle, procedural variety, multiplayer-aware, customization-aware, D&D-style narration as soul, death must matter). Strategic Trajectory Notes extended with vision capture entry flagging mobile-first hard requirement, multiplayer architecture awareness, customization layer awareness, world-gen perf concern (2.5min "let's play" → "playable" borderline). Tim confirmed sequencing: Polish Round → Day 21 Loot → Day 22 Leveling → playtest → Day 23 Quest → Day 20.5 Verbal Action deferred. Polish Round scope expanded to include mobile-viewport QA bundle.*
