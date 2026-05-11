# Project: Endless Worlds RPG — Master Context

**Version:** 8.39
**Status:** Day 20 Combat COMPLETE through 20.4.1 hotfix — Polish Round (Prompt 4) Next
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
  - **Lifestyle/job grind** — become the best blacksmith / scholar / merchant in the realm; affects how the world reacts to you
  - **Mixed** — switch modes mid-session
- **Mobile-first accessible.** Designed for phone screens, fast-loading, runs on web. The phone in your pocket IS the game console.
- **Multiplayer (PRE-LAUNCH per V8.38).** Two phones, one shared world, take turns or play simultaneously. Active requirement, not just future-proofing.
- **User-customizable worlds (PRE-LAUNCH per V8.38).** Player can guide AI on world themes — "haunted Victorian England" / "post-apocalyptic Mars colony" / "kingdom of warring deities" — beyond the fixed genre presets. Slot near end of pre-launch sequence.

### What this game IS NOT

- **Not Baldur's Gate.** No 80-hour campaigns. No mouse-and-keyboard required. No tactical combat with positioning grids. The complexity should be in narrative depth and character growth, not in interface complexity.
- **Not a CYOA / interactive fiction tool.** Real mechanics matter — dice, stats, gear, levels, consequences. The AI is a narrator, not the entire game system.
- **Not a long-term commitment to a single character.** Worlds are disposable; characters are disposable. The replayability is from running NEW playthroughs, not from grinding one to max level.
- **Not a tabletop replacement.** It complements physical D&D — it's the option for when you DON'T have a DM, four hours, and a kitchen table.
- **Not a hardcore strategy game.** Combat should feel impactful and tactical-ish, but the goal is dramatic narrative beats with mechanical weight, not min-maxing.

### Competitive positioning

> **"Baldur's Gate depth without Baldur's Gate overhead. D&D feel without needing a DM."**

The market gap this fills: there is no easy, fast, accessible way to have a D&D-style adventure on a phone with a friend. Existing options force a tradeoff (real D&D needs DM/prep/table; CRPGs are desktop and long; CYOA apps lack mechanics; AI Dungeon clones lack structure). This game wins by being structured-but-light, AI-narrated-but-mechanically-grounded, mobile-first, multiplayer-aware, replayable by design.

### Design principles

1. **Pickup-friendly.** Time from "let's play" to "playing" must stay short.
2. **Mobile-first viewport.** Every UI verified on phone-width before desktop polish.
3. **Multiple play styles supported.** No system forces one playstyle. Quest is optional, exploration is rewarded.
4. **Procedural variety > authored depth.** Lean on AI for breadth, code for reliability.
5. **Multiplayer-aware architecture (PRE-LAUNCH).** Day 21-23 actively support party-of-N. Day 24 wires the multiplayer layer.
6. **Customization-aware architecture (PRE-LAUNCH).** World gen prompts designed so user-supplied themes plug in. Day 25 wires the customization layer.
7. **D&D-style narration is the soul.** Combat narration, arrival narration — feel like a good DM is describing them.
8. **Death must matter.** Defeat costs HP, currency, XP rollback. Settlements are deliberate checkpoints (V8.36 cross-region teleport per soulslike model).

---

## 🎯 Project Roles & Working Mode

**Vision & Creative Direction:** Tim (the user). Drives game vision, design intent, feature priority. First-time game developer, building a game that doesn't currently exist.

**Senior Engineering / Tech Direction:** Claude.ai (this assistant). Translates vision into architecture, flags scope/risk/feasibility, suggests alternatives, recommends sequencing. Has explicit license to push back when:
- Something is premature given current foundations
- A cleaner approach exists Tim hasn't considered
- Scope is drifting in a way that risks future-proofing
- Critical-path systems are being skipped for polish features

Defers to creative-director call on vision questions. Creative input from Claude.ai is welcome too.

**Implementation:** Claude Code (local Sonnet agent). Executes round-by-round prompts.

**Decision flow:** Tim describes → Claude.ai assesses (right thing, right way, right time) → Tim decides → Claude.ai writes prompt with locked decisions → Claude Code implements → Tim verifies → Claude.ai updates CLAUDE.md.

**This means:** Tim's instinct is an opening position, not a final decision, until Claude.ai has weighed in. Tim retains full override authority but expects pushback when warranted. Strategic discussions captured in 📋 Strategic Trajectory Notes below.

---

## 📋 Strategic Trajectory Notes

Living section. Captures meta-discussions about project direction, sequencing, recommended pivots, architectural debates. New Claude sessions read this for current strategic context before proposing prompts.

### V8.39 — Lesson learned: defensive overcheck caused the V8.38 bug

The Day 20.4 defeat respawn bug ("You wake at <region>" instead of "<settlement>") was attributed to spawn-init writing the wrong field. The actual root cause, found in Day 20.4.1, was a **defensive overcheck** added in Day 20.1: step 7c-2's settlement-hub detection had a `category === "settlement_hub"` fallback alongside the canonical `is_settlement_node === true` check. WorldBible's `starting_region.type` is hard-coded to `"settlement_hub"`, which apply-world-bible step 4c copies onto the geographic region zone's `category`. Every region-zone arrival was therefore being identified as a settlement hub and overwriting `last_settlement_hub_id` with the region id.

**Foundational lesson:** Defensive overchecks ("set this AND that") can become positive bugs when the "and that" clause matches things it shouldn't. The canonical field (`is_settlement_node`) is the single source of truth; fallbacks need stronger justification than "just in case."

Codified in foundational rule 65.

### V8.38 — Three strategic decisions LOCKED

**Decision 1: Multiplayer = PRE-LAUNCH (NOT post-launch v2).**
This shifts from "passive constraint" to "active requirement." Day 21/22/23 design must actively support 2-4 player co-op (party-friendly schemas, no single-player assumptions baked in), with a dedicated **Day 24 — Multiplayer Foundation** phase between Day 23 (Quest) and launch prep.

Day 24 scope (preliminary):
- Party-of-N character schema (current single-character → party array)
- Supabase realtime channels for state sync across clients
- Turn-syncing infrastructure (lock-when-not-your-turn, skip-on-disconnect)
- Shared story feed (one DM narrating to all players)
- Loot/quest decision rules (round-robin loot? vote on quest decisions? first-to-trigger?)
- Session ownership / invite model

Concrete impacts on upcoming phases:
- **Day 21 Loot:** drops need "who gets it?" rules. Inventory per-character. Merchant transactions per-character.
- **Day 22 Leveling:** XP per-character to alive participants. Skills per-character.
- **Day 23 Quest:** quest state shared. Breadcrumbs visible to all. Decisions: anyone? vote? first-to-trigger?
- **Combat:** party initiative includes all. Action gating per active player.
- **Save model:** session = party array of characters, not single character.

**Decision 2: Customization layer = PRE-LAUNCH but towards end.**
User-supplied theme prompts ("haunted Victorian England", etc.) plumbed into world generation. **Day 25 — Customization Layer** post-Day-24, pre-launch.

Difficulty assessment: 1-2 day session. Manageable but not trivial. Real risk is content coherence across all generation phases — Sonnet handles thematic guidance well but needs playtest iterations.

**Decision 3: Day 22 skills = FOUNDATIONS NOW (middle path).**
Lay groundwork for lifestyle skill system without full depth. Skill domain enum (Combat / Crafting / Social / Exploration), each skill has level / XP / max_level, Combat domain fully wired with real XP hooks, other domains schema exists but hooks stubbed. Data model supports lifestyle skills cleanly when Day 24+ adds them.

### V8.37 — Combat scope drift assessment + recommended sequencing

Day 20 expanded from one prompt to nine commits (1, 2, 2.5, 3, 20.1, 20.2, 20.3, 20.4, 20.4.1). Each justified individually but cumulatively heavy combat investment ahead of dependent systems.

**Confirmed sequence (V8.37 + V8.38 amendments):**
1. **Polish Round (Prompt 4)** — clear UX debt + mobile-viewport QA bundle
2. **Day 21 — Container + Loot** (multiplayer-aware: per-character inventory, drop rules)
3. **Day 22 — Skills + Leveling** (multiplayer-aware: per-character XP/skills; foundations for lifestyle skills)
4. **Vertical slice playtest** — full game start → win condition with placeholders
5. **Day 23 — Main Quest Thread** (multiplayer-aware: shared quest state)
6. **Day 24 — Multiplayer Foundation** (NEW per V8.38)
7. **Day 25 — Customization Layer** (NEW per V8.38)
8. **Day 20.5 — Verbal Action / Taunt** — DEFERRED to last; mechanic shines after stats/gear matter

### Vision capture (V8.37 → V8.38)

- **Mobile-first** is hard requirement. Polish Round bundles mobile QA pass.
- **Multiplayer pre-launch** is active requirement (V8.38).
- **Customization pre-launch** is active requirement (V8.38).
- **Lifestyle skills** foundation in Day 22 (V8.38).

**World gen perf concern:** 35s WCD + 120s WorldBible = 2.5min "let's play" → "playable." Borderline for pickup-play, especially pre-multiplayer. Mitigations TBD: parallel WCD/WorldBible generation, faster sub-content model, pre-warmed pool. NOT urgent for single-player MVP.

### Open strategic questions

- **External playtest timing.** Likely best post-Day-22 or post-Day-23.
- **Difficulty tuning model.** Toggle (easy/standard/hard) vs implicit world-tier scaling?
- **Random travel encounters** (combat-spec §3 deferral). Slate post-Day-21? Or fold into Day 22/23?
- **Verbal action redundancy risk.** If Day 22 adds Charisma skill tree, verbal action types may need reconciling.
- **NPC behavior dispatch** (combat-spec §6.3 deferral). Future combat-depth pass.
- **Map visual rework.** Pure visual debt; deferred dedicated session.
- **Other defensive overchecks worth auditing.** Per V8.39 lesson, look for similar `category === X` or `type === X` fallbacks alongside canonical boolean fields. Candidates: combat-state classification, region-zone vs sub-location distinction, NPC home-location resolution.

---

## 🔄 Current Status (Read This First)

**Current Phase:** Day 20 Combat fully complete through Polish 3 + 20.4.1 hotfix. Combat input is button-only during fights (V8.37 interim, replaced by Day 20.5 verbal action much later). Polish Round (Prompt 4) is next, bundling visible UX debt + mobile-viewport QA.
**Local Dev Port:** 3000
**Stack:** Next.js 14 / Tailwind / shadcn/ui / Supabase / Claude API / Stripe / Vercel
**GitHub Repo:** atomictim/endless-worlds-rpg

| Phase | Title | Status |
| --- | --- | --- |
| 1–18 | MVP through Systems Audit | ✅ Complete |
| 19A–19F | World Generation Architecture | ✅ Complete |
| Movement Track | Verified end-to-end | ✅ FROZEN |
| Combat Spec | /docs/combat-spec.md design doc | ✅ Frozen |
| 20 — Combat Prompt 1/3 (1024287) | Data foundation | ✅ Complete |
| 20 — Combat Prompt 2/3 (a4e5975) | Resolver + triggers + turn loop | ✅ Complete |
| 20 — Prompt 2.5 Nav Fix (25ff111) | Region trigger reclassification | ✅ Complete |
| 20 — Combat Prompt 3/3 (abf73e6) | Combat UI + narration + bestiary | ✅ Complete |
| 20.1 — Combat Polish (1215bb6) | Starting equipment + encounter banner + turn separators + pacing | ✅ Complete |
| 20.2 — Combat Hotfix (bf3871e) | Initiative kickoff fix + inventory stats | ✅ Complete |
| 20.3 — Combat Polish 2 (732e944) | Full-width separators + button-only combat input + CRITICAL HIT banner + resolution two-line render + planEventSuppression | ✅ Complete |
| 20.4 — Combat Polish 3 (fc508f3) | Floating damage numbers + inline roll details + defeat teleport fix | ✅ Complete |
| **20.4.1 — Combat Hotfix (c67f2c0)** | **Floating damage target routing fix + inventory Use during combat + flee DC format/raw d20 + defeat respawn settlement-detection fix (category fallback removal — the REAL root cause of V8.38 defeat bug)** | ✅ **Complete** |
| Polish Round (Prompt 4) | Movement-direction grouped nav cards + tier color-coding + settlement card label + tier auto-switch + NPC dialogue contrast + mobile-viewport QA bundle | ⏳ NEXT |
| Day 21 | Container + Loot — registry, loot tables, dungeon containers, per-character inventory rules (multiplayer-aware) | ⏳ After Polish Round |
| Day 22 | Skills + Leveling — XP, stat points, level gates + skill domain foundations (Combat wired, others stubbed) per V8.38 | ⏳ After Day 21 |
| Vertical slice playtest | Full game start → win condition with placeholder content | ⏳ Before Day 23 |
| Day 23 | Main Quest Thread — breadcrumb injection, quest tracking (multiplayer-aware: shared quest state) | ⏳ Post-playtest |
| Day 24 | Multiplayer Foundation — party schema, Supabase realtime, turn-sync, shared feed, loot/quest decision rules | ⏳ Pre-launch (V8.38 lock) |
| Day 25 | Customization Layer — user-supplied theme prompts, theme presets, genre-theme interaction | ⏳ Pre-launch toward end (V8.38 lock) |
| Day 20.5 | Verbal Action System — chat input hijack: taunt/distract/intimidate via LLM judging + charisma check | ⏳ Deferred to last (post-Day-25) |
| Map Visual Rework | Dedicated session | ⏳ Deferred (no critical-path dependency) |

**Active genres:** Fantasy, Cyberpunk, Horror/Lovecraftian, Space Opera, Post-Apocalyptic
**⚠️ Noir removed. Genre renderers restored (pickModule re-enabled).**

### Day 20.4.1 — Combat Hotfix (commit c67f2c0 — 261/261 tests, /game 108 kB unchanged)

Five-bug hotfix round resolving Day 20.4 playtest issues. All bugs were wiring/data issues, not new features. Notable: the defeat respawn bug had a deeper root cause than V8.38 hypothesized.

**Task 1 — Floating damage routing (CombatMode.tsx):**
- Rewrote `makeFloatingEntry` as explicit `switch (event.type)` with one branch per type. No more conditional fallback that could misroute when actor/target shows up empty.
- `player_attack` hit/crit → host = `event.target` (the targeted enemy's instance_id), color combat-player(-crit). Hit shows damage_die_roll; crit shows TOTAL damage.
- `enemy_attack` hit/crit → host = `PLAYER_ID`, color combat-enemy(-crit).
- `use_item` heal → host = `PLAYER_ID`, color hl-pass green, CSS `+` prefix.
- Everything else (defend, miss, fumble, flee_attempt, kill, victory, defeat, phase events, combat_start) → null.
- Defensive guard: a `player_attack` whose `target === PLAYER_ID` (corrupted event) returns null instead of putting an attack float on the player's own portrait.
- Exported the function so the new test suite can hit it directly.

**Task 2 — Inventory Use button during combat (InventoryPanel.tsx):**
- Imports `useCombat`, reads `state.combat?.active === true` from the store.
- CONSUMABLE Use button now branches:
  - In combat → `submitCombatAction({ action: "use_item", item_id: selectedItem.id })`. Combat-engine consumes a turn properly, drains events through projection pipeline, heal floating-number animates over player portrait.
  - Out of combat → existing `onSubmit("use ...")` path.
- Disable state extended to honor `combatResolving` so player can't double-tap mid-drain.
- Equip / Unequip / Read / Search / Drop buttons HIDDEN during combat (would all hit the V8.37 input gate and fail; combat resolution doesn't expose mid-fight gear swap or container search anyway).
- Selection clears on submit either way.

**Task 3 — Flee DC formatting + raw d20 display (templates.ts):**
- `buildRollsSuffix` now displays the RAW `r.d20` value (1-20), not `r.d20 + r.d20_modifier` (which produced `d20: 0` when low rolls hit negative AGI mods).
- `target_dc` wrapped in `Math.round()` for display. Flee DC averages enemy AGI mods and can land on `10.666...`; the raw float still drives the engine's pass/fail check, but the player sees a clean integer.
- Verified `resolveFlee` and `resolveAttack` both store RAW d20 in `rolls.d20` (already correct from Day 20.4 — no change needed).

**Task 4 — Defeat respawn at settlement (REAL root cause found):**
- ROOT CAUSE: step 7c-2's predicate matched `arrivedNode?.category === "settlement_hub"` as a fallback for `is_settlement_node`. The WorldBible prompt template hard-codes `starting_region.type` to `"settlement_hub"`, which apply-world-bible step 4c copies onto the geographic region zone's category. So every region-zone arrival was setting `last_settlement_hub_id` to the region id. When defeat fired, handleDefeat returned the region zone — which is exactly the V8.37+V8.38 bug ("You wake at <region>" instead of "<settlement> in <region>").
- FIX: dropped the category fallback. `is_settlement_node === true` is reliably set by both apply-world-bible and apply-regional-bible on settlement nodes; the category fallback was a Day 20.1 defensive overcheck that ended up causing this bug.
- Added the diagnostic log line in apply-world-bible (deferred from V8.38 prompt):
  ```
  [apply-world-bible] Set current_location_id: oathwatch_crossing
  [apply-world-bible] Set last_settlement_hub_id: oathwatch_crossing
  ```
- Both lines fire on every fresh game; mismatch surfaces the bug. Spawn-init already wrote `startingNodeId` (the settlement id) correctly from V8.38 — no change to that value.

**Task 5 — Tests (18 new, 261 total):**
- `floating-damage.test.ts` (+13): per-event-type routing — `player_attack` hit/crit hosts on enemy id (with explicit `not.toBe(PLAYER_ID)` assertion); `enemy_attack` hit/crit hosts on PLAYER; `use_item` heal hosts on PLAYER with hl-pass green; null for miss/fumble/defend/flee/phase/victory/defeat/kill/combat_start; null for empty target; null for self-targeted `player_attack` (defensive).
- `templates.test.ts` (+5): raw d20 display on hit (14 not 16), miss (5 not 7), fumble (1 not 0 even with negative mod); flee DC 10.666... rounds to 11; flee DC 10.4 rounds down to 10.

### Day 20.4 — Combat Polish 3 (commit fc508f3 — 243/243 tests)

Five-task polish round resolving V8.37 playtest issues + closing the defeat-teleport bug at the (hypothesized at the time) root cause:
- **Roll details on CombatEvent:** New `CombatEventRolls` interface populated on every event with damage/d20/heal outcome.
- **Inline roll suffix in templated events:** Return shape `{primary, rolls}` from templates. CSS `.combat-roll-detail` (10px dim mono, 0.6 opacity).
- **Floating damage numbers over portraits:** 28px regular, 36px crit, +prefix on heal, 1100ms float-fade animation. (Targeting bug introduced here — fixed in 20.4.1.)
- **Defeat teleport spawn-init + 3-tier fallback + destination messaging:** `last_settlement_hub_id` initialized at game spawn; handleDefeat 3-tier fallback chain (settlement → world_bible.starting_region.settlement_id → origin_node_id); templated "You wake at X in Y" line. (Settlement-detection bug found later — fixed in 20.4.1.)

### Day 20.3 — Combat Polish 2 (commit 732e944 — 233/233 tests)
Six-task round: full-width flex turn separators, item use locked to buttons, CRITICAL HIT two-line banner, planEventSuppression saves crit/kill prose on victory-killing-blow, Victory/Defeat/Escaped two-line centered banner with ≤20-word LLM prose. /game 106 kB.

### Day 20.2 — Combat Hotfix + Inventory Stats (commit bf3871e — 216/216 tests)
Initiative kickoff fix via shared `advanceUntilPlayerTurnOrEnd` + `kickoffCombatIfEnemyFirst` + useEffect-driven kickoff trigger with double-fire guard. Inventory cards show Damage/Armor/Heal stats + EQUIPPED pill. /game 105→106 kB.

### Day 20.1 — Combat Polish (commit 1215bb6 — 209/209 tests)
Starting equipment auto-equipped via new `lib/game/starting-equipment.ts` module; encounter banner templated; turn boundary separators emitted by combat-engine; pacing delays 800/500/800ms; header pill displayPhase decoupled from current_turn_index. /game 104→105 kB. **Also: introduced the `category === "settlement_hub"` fallback in step 7c-2 that caused the V8.38 defeat bug, found and removed in 20.4.1.**

### Combat Day 20 — Prompt 3/3 (commit abf73e6 — 173/173 tests)
Combat mode UI (CombatMode + 6 child components, side-by-side layout); templated routine + LLM dramatic narration via `/api/game/narrate-combat`; bestiary codex on combat_start; new-game preamble; HP bar 300ms transition + crit portrait shake 400ms. /game 96→104 kB.

### Combat Day 20 — Earlier rounds (foundation)
- **Prompt 2.5 Nav Fix (25ff111):** idempotent apply-regional-bible + region-expansion-guard helpers. 16 new tests, 149 total.
- **Prompt 2/3 (a4e5975):** combat-resolver (pure math), encounter trigger in step 7c-3, turn loop. 61 new tests, 133 total.
- **Prompt 1/3 (1024287):** Enemy interface, bestiary files, WorldBible/RegionBible LLM extensions. 29 new tests, 72 total.

### Pre-Combat (movement track)
- **Region/Resilience Round (87c89a3), Polish Round (b7032f9), Targeted Fix (dc5bcd8), Regression Fix (75a7cd4), Bug Fix (57b0300), Architecture Hardening (57d27f3), 19A-19F generation phases.**

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
                       (V8.37), roll detail surfacing + inline roll
                       suffix + floating damage numbers (target routing
                       hardened V8.39) + defeat resilience (3-tier
                       fallback + cross-region teleport, settlement
                       detection hardened V8.39) + destination messaging
                       (V8.38) + inventory Use combat path (V8.39), loot
                       resolver (pending Day 21) — pure code
Domain 2 (Content):    WCD, WorldBible (with enemies + encounter tagging),
                       RegionBible (same), NPCs, items, bestiary,
                       starting-equipment loadouts (V8.35) — frozen

AI during gameplay:
  ✅ Arrival narration  — first visit only, cached permanently after
  ✅ Dialogue options   — built by code, AI writes response only
  ✅ Action narration   — 1-4 sentences (out-of-combat only)
  ✅ NPC not present    — hardcoded "X isn't here"
  ✅ Combat narration   — selective dramatic events (crit / kill / victory /
                          defeat / flee_success). Genre tone primer.
                          Templated: combat_start, use_item, separators,
                          CRITICAL HIT banner, resolution banners,
                          inline roll suffix, destination messages.
  ⏳ Container search   — pending Container+Loot (Day 21)
  ⏳ Verbal action      — DEFERRED to Day 20.5 (post-Day-25)
```

### Combat System ✅ COMPLETE (V8.31 → V8.39)
```
DATA LAYER (V8.31):     Enemy interface, two-tier bestiary, encounter
                        tagging, stub loot drops.

RESOLVER LAYER (V8.32 + V8.38 rolls + V8.39 raw d20 storage):
                        /lib/game/combat-resolver.ts — pure math, RNG
                        injected. Result.rolls populated on every outcome.
                        rolls.d20 stores RAW d20 (1-20), not total.

TRIGGER LAYER (V8.32):  shouldRollEncounter / resolveEnemyLookup /
                        rollEncounter.

TURN LOOP (V8.32, separators V8.35, kickoff V8.36):
                        /lib/game/combat-engine.ts — full action
                        resolution + auto-advance.

INITIATIVE KICKOFF (V8.36):
                        kickoffCombatIfEnemyFirst when turn_order[0] !==
                        PLAYER.

UI LAYER (V8.34, refined V8.37/V8.38/V8.39):
                        Side-by-side layout. Per-event styling.
                        Full-width turn separators (V8.37).
                        CRITICAL HIT two-line render (V8.37).
                        Victory/Defeat/Escaped two-line centered (V8.37).
                        Inline roll detail suffix on every event (V8.38).
                        Floating damage numbers over TARGET portraits
                        (V8.38, target routing hardened V8.39).
                        Destination message line on defeat/flee (V8.38).
                        Inventory Use button routes through combat path
                        when combat active (V8.39).

INPUT GATING (V8.37):   ActionBar buttons + Inventory Use button (V8.39)
                        are the input paths. useGameLoop.submitAction
                        early-bails on combat.active. Inventory Use during
                        combat routes through submitCombatAction (V8.39).
                        INTERIM until Day 20.5.

NARRATION LAYER (V8.34, refined V8.35/V8.37):
                        Templated: combat_start, use_item, separators,
                        CRITICAL HIT banner, resolution banners, all
                        routine events. LLM dramatic: crit / kill /
                        victory / defeat / flee_success.

EVENT SUPPRESSION (V8.37):
                        planEventSuppression(events) pre-scans batches.

DEFEAT RESILIENCE (V8.38 + V8.39):
                        last_settlement_hub_id initialized at game
                        spawn. handleDefeat 3-tier fallback chain.
                        Cross-region teleport intentional per soulslike
                        model. Step 7c-2 settlement detection uses
                        is_settlement_node === true ONLY (V8.39 — category
                        fallback caused V8.38 bug, removed).

ROLL DETAIL DISPLAY (V8.38 + V8.39):
                        buildRollsSuffix displays RAW d20 (V8.39).
                        target_dc wrapped in Math.round() (V8.39).

PACING (V8.35):         800/800/500ms transition delays.

UI INDICATORS (V8.35):  CombatMode header pill displayPhase decoupled
                        from current_turn_index.

BESTIARY CODEX (V8.34): writeBestiaryEntry on combat_start.

STARTING EQUIPMENT (V8.35):
                        15 backgrounds, all equipped at game start.

INVENTORY DISPLAY (V8.36):
                        Damage/Armor/Heal lines + EQUIPPED pill.
                        Use button routes through combat path during
                        combat (V8.39).

DEV TOOLS (V8.32):      window.__forceEncounter("enemy_id", ...).
```

### Region Expansion Guard ✅ (V8.33)
`/lib/game/region-expansion-guard.ts` — pure helpers. ROOT CAUSE: toSlug() strips hyphens. Guard works AROUND.

### Navigation Rules ✅ (Complete)
Map = visual only. Card grammar: BACK / DEEPER / EXIT / PEER / UNDISCOVERED. Region trigger reclassification (V8.33). Combat trigger step 7c-3. last_settlement_hub_id + navigation_trail update on every arrival via `is_settlement_node === true` predicate ONLY (V8.39), initialized at spawn (V8.38).

### Map Description Sourcing ✅
World→wcd.world_description / Region→currentRegion.atmosphere (parent walk) / Local→currentLocation.atmosphere.

### NPC Dialogue System ✅
Options built by code. AI writes response only. `.ew-said` contrast pending Polish Round.

### RegionBible Resilience ✅
claude-haiku-4-5-20251001, max_tokens 7000. Stub fallback. Idempotent.

### WorldBible Resilience ✅
claude-sonnet-4-5, max_tokens 10000. validateEnemy/validateEnemies/scrubEncounterRoster — warn-don't-500.

### Known issues

**Polish Round (Prompt 4) — design locked V8.36 + V8.37, NEXT:**
- Movement-direction grouped nav cards (BACK / DEEPER / PEER / UNDISCOVERED rows)
- Tier color-coding within each group (region lavender, settlement sky-blue, sub-location mint, dungeon new color)
- Settlement hub card on new region arrival reads as back-from-settlement — card-typing fix
- Map does not auto-switch tiers on cross-region arrival
- NPC dialogue text needs higher contrast (.ew-said too close to ink-2)
- **Mobile-viewport QA pass** — verify combat panel, nav, story feed, modals all phone-readable

**Day 20.5 — Verbal Action (deferred to last):**
Replaces "Combat input is disabled" interim. Player types verbal action → LLM judges quality → 1d20 + charisma_mod + quality_mod vs 10 + target.agi_mod → status_effect (taunt/distract/intimidate, 1-round duration).

**Floating number stagger (deferred polish):** Overlapping numbers from rapid-fire enemy phases stack on top of each other. Future polish: horizontal offset stagger or vertical queue.

**Other deferred:** Map visual rework, RTL component test infra, pacing tuning watchpoint, world-gen perf, NPC color overlap, hub codex, grid_position, behavior dispatch, toSlug bug, combat balance pre-Day-21/22.

---

## 🏗️ Architecture

### The Two Domains ✅
**Domain 1 (Engine — pure code):** Navigation, stat checks, dialogue option generation, combat resolver + turn loop + triggers (V8.32), region expansion guard (V8.33), combat UI + narrator + bestiary (V8.34), separators + pacing + starting equipment module (V8.35), initiative kickoff + inventory stats (V8.36), full-width separators + crit banner + suppression + resolution banner (V8.37), roll detail surfacing + inline roll suffix + floating damage numbers + defeat resilience + destination messaging (V8.38), floating-damage target routing + inventory Use combat path + raw d20 display + settlement-detection canonical-only (V8.39), loot resolver (Day 21).
**Domain 2 (Content Library — frozen):** WCD, locations, NPCs, items, loot tables, main quest, bestiary, region enemies, starting equipment loadouts (V8.35).

### Generation Model ✅
RegionBible: claude-haiku-4-5-20251001, max_tokens 7000. Idempotent.
WorldBible: claude-sonnet-4-5, max_tokens 10000. Includes enemies + encounter tagging.
WCD includes `world_description`.
Combat narrator: claude-sonnet-4-5. max_tokens 250 crit/kill, 120 resolutions.

### Map System ✅
Genre renderers active (pickModule enabled). PAD=76. Tier switcher. Initial tier on mount: Local (V8.30). ⚠️ Tier auto-switch on cross-zone arrival pending — Polish Round. ⚠️ Visual rework deferred to dedicated session.

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
30. last_settlement_hub_id and navigation_trail update on every successful arrival in step 7c-2. INITIALIZED AT GAME SPAWN in apply-world-bible (V8.38). (V8.32 + V8.38)
31. pre_combat_xp captured at encounter start. Defeat handler restores player.xp = pre_combat_xp. (V8.32)
32. Encounter trigger is in step 7c-3. Activates only when shouldRollEncounter passes. (V8.32)
33. Enemy behavior on Day 20 is hardcoded "attack the player" regardless of behavior_flavor field. (V8.32)
34. Returning to a region whose bible is in metadata.region_bibles AND whose graph node is discovered is GRAPH_NAVIGATE, not WORLD_EXPLORE. (V8.33)
35. apply-regional-bible is idempotent: skipped: true when redundant. (V8.33)
36. mergeNodePreservingDiscovered preserves discovered: true on re-apply. (V8.33)
37. arrivedAt in step 7c reads from updatedState (post-reclassification). (V8.33)
38. Combat narration is selective: routine events templated (no API call); dramatic events call /api/game/narrate-combat. Variant selection deterministic via timestamp hash. (V8.34, refined V8.35: combat_start templated; refined V8.37: crit prose suppressed when victory follows)
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
50. When combat starts with `turn_order[0] !== PLAYER`, the initial enemy phase MUST fire before UI hands control to the player via `kickoffCombat` from useEffect. Tracked via useRef Set. (V8.36)
51. Inventory detail panel surfaces combat stats: WEAPON Damage, ARMOR Armor (always renders, including +0), CONSUMABLE Heal. EQUIPPED pill on detail panel. (V8.36)
52. Combat input is button-only when combat is active. submitAction early-bails on combat.active with system message. INTERIM until Day 20.5. (V8.37)
53. Use Item is templated only. Format: `"You use <item>. Restored N HP."` (V8.37)
54. Crit events render as TWO lines: templated banner first (instant), then LLM crit prose. (V8.37)
55. `planEventSuppression(events)` pre-scans event batches. When victory present: kill events dropped, last crit before victory has prose suppressed. (V8.37)
56. Resolution events render as two-line centered block: banner + ≤20-word LLM prose. max_tokens 120 for resolutions. (V8.37)
57. CombatEvent.rolls field populates on every event with damage/d20/heal outcome. Pure data extension. (V8.38)
58. Inline roll suffix renders subtle parenthetical breakdown via `{primary, rolls}` return shape from templates. CSS `.combat-roll-detail` (10px dim mono, 0.6 opacity). (V8.38)
59. Floating damage numbers fire on hit/crit/heal events ONLY. Routing via explicit `switch(event.type)`: player_attack hosts on `event.target` (enemy), enemy_attack/use_item host on `PLAYER_ID`. Self-targeted player_attack returns null defensively. setTimeout(1100ms) cleanup. (V8.38 + V8.39 target routing hardened)
60. Defeat teleport — `last_settlement_hub_id` is initialized at game spawn in apply-world-bible. handleDefeat uses 3-tier fallback chain. Cross-region teleport intentional per soulslike model. (V8.38)
61. Resolution events (defeat / flee_success) carry destination payload. StoryFeed renders templated info line below LLM prose. Victory does NOT get destination line. (V8.38)
62. `rolls.d20` stores RAW d20 value (1-20), not total post-modifier. `buildRollsSuffix` displays raw d20 + integer DC. `target_dc` wrapped in `Math.round()` for display since flee DC averages can be fractional. Pass/fail logic still uses internal total — display-only formatting. (V8.39)
63. Inventory Use button during combat routes through `submitCombatAction({ action: "use_item", ... })`, NOT `submitAction`. Equip / Unequip / Read / Search / Drop buttons are HIDDEN during combat (combat resolver doesn't expose mid-fight gear swap). Disable state honors `combatResolving` to prevent double-tap mid-drain. (V8.39)
64. Floating damage entry routing uses explicit `switch(event.type)` not conditional fallback. Misroute prevented by defensive `player_attack target === PLAYER_ID` guard returning null. (V8.39 — codifies the V8.38 bug fix)
65. **Settlement-hub detection in step 7c-2 uses `is_settlement_node === true` predicate ONLY.** The `category === "settlement_hub"` fallback was a Day 20.1 defensive overcheck that misrouted region zones (WorldBible hard-codes `starting_region.type = "settlement_hub"`, copied to region zone's `category`). Removed in V8.39. **Foundational lesson: defensive overchecks alongside canonical fields can become positive bugs. Audit similar fallback patterns elsewhere.** (V8.39)

---

## Narrator Prompt Order ✅

DIALOGUE: WCD → HARD RULES → RESPONDING CHARACTER → CLOSED CONTEXT → TIER 1 OBJECTS → WORLD ASSETS → SCENE → VERBOSITY
non-DIALOGUE: WCD → HARD RULES → NPCS PRESENT → TIER 1 OBJECTS → CONNECTED LOCATIONS → WORLD ASSETS → SCENE → VERBOSITY
COMBAT: GENRE TONE PRIMER → COMBAT EVENT (mechanical truth) → HARD RULES → length hint per event tier (resolutions ≤20 words, crit/kill 2-3 sentences)

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

COMBAT:
  Routine player:          #7ab8c8 teal (--combat-player)
  Routine enemy:           #e87c6d warm red (--combat-enemy)
  Player crit:             #3b82a8 deeper blue, BOLD (--combat-player-crit)
  Enemy crit:              #c0392b blood red, BOLD (--combat-enemy-crit)
  Victory:                 #7dbb8e mossy green (--combat-victory)
  Defeat:                  #a93226 dark red (--combat-defeat)
  Flee:                    #a8a29c grey-tan (--combat-flee)
  Encounter banner:        #f4a07a light coral (--combat-encounter-banner)

V8.37 elements:
  Turn separators:         flex-width, label between flanking rules
  Crit banner line:        mono 13px bold uppercase, actor-derived color
  Resolution banner:       mono 18px bold uppercase, centered
  Resolution prose:        serif italic 13px, centered

V8.38 elements:
  Roll detail suffix:      10px dim mono, 0.6 opacity (--combat-roll-detail)
  Floating damage:         28px mono bold (36px crit), 1100ms float-fade
  Resolution destination:  12px italic serif, 0.75 opacity
                           (--combat-resolution-destination)
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

*Last updated: V8.39 — Day 20.4.1 Combat Hotfix (commit c67f2c0): floating damage target routing fix (switch-based, defensive self-target guard), inventory Use button during combat routes through submitCombatAction (Equip/Unequip/Read/Search/Drop hidden), flee DC formatting (Math.round) + raw d20 display, defeat respawn settlement-detection bug found and fixed at REAL root cause (step 7c-2 category fallback removed — the V8.38 spawn-init was already correct, but the category fallback in step 7c-2 was overwriting last_settlement_hub_id with region id on every region-zone arrival). Foundational rules 62-65 added including the lesson on defensive overchecks. 261/261 tests passing. /game route 108 kB unchanged. Polish Round (Prompt 4) is next.*
