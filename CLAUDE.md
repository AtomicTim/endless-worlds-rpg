# Project: Endless Worlds RPG — Master Context

**Version:** 8.40
**Status:** Day 20 Combat COMPLETE through 20.4.2 — Polish Round (Prompt 4) Next
**Objective:** A text-based RPG that generates a unique world for every playthrough. Genre-agnostic, infinitely replayable, CRPG depth.

**Reference:** /docs/architecture-spec.md — Domain 1 vs Domain 2 decisions. /docs/combat-spec.md — Combat system design.

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
- **Multiple play styles supported simultaneously.** The game does not railroad. Long quest, speedrun-the-end, pure exploration, settlement-focused grind, lifestyle/job grind (eventual), mixed.
- **Mobile-first accessible.** The phone in your pocket IS the game console.
- **Multiplayer (PRE-LAUNCH per V8.38).** Two phones, one shared world. Active requirement, not future-proofing.
- **User-customizable worlds (PRE-LAUNCH per V8.38).** Player can guide AI on world themes beyond fixed genre presets. Slot near end of pre-launch sequence.

### What this game IS NOT

- **Not Baldur's Gate.** Complexity in narrative and growth, not interface.
- **Not a CYOA / interactive fiction tool.** Real mechanics matter.
- **Not a long-term commitment to a single character.** Replayability is from NEW playthroughs, not maxing one character.
- **Not a tabletop replacement.** Complements physical D&D for when you don't have DM/time/table.
- **Not a hardcore strategy game.** Impactful combat, but goal is dramatic narrative beats with mechanical weight, not min-maxing.

### Competitive positioning

> **"Baldur's Gate depth without Baldur's Gate overhead. D&D feel without needing a DM."**

The market gap: there is no easy, fast, accessible way to have a D&D-style adventure on a phone with a friend. Existing options force a tradeoff (real D&D needs DM/prep/table; CRPGs are desktop and long; CYOA apps lack mechanics; AI Dungeon clones lack structure). This game wins by being structured-but-light, AI-narrated-but-mechanically-grounded, mobile-first, multiplayer-aware, replayable by design.

### Design principles

1. **Pickup-friendly.** Time from "let's play" to "playing" must stay short.
2. **Mobile-first viewport.** Every UI verified on phone-width before desktop polish.
3. **Multiple play styles supported.** No system forces one playstyle.
4. **Procedural variety > authored depth.** Lean on AI for breadth, code for reliability.
5. **Multiplayer-aware architecture (PRE-LAUNCH).** Day 21-23 actively support party-of-N. Day 24 wires the multiplayer layer.
6. **Customization-aware architecture (PRE-LAUNCH).** World gen prompts designed so user-supplied themes plug in. Day 25 wires the customization layer.
7. **D&D-style narration is the soul.** Tone, weight, specificity matter.
8. **Death must matter.** Defeat costs HP, currency, XP rollback. Settlements are deliberate checkpoints.

---

## 🎯 Project Roles & Working Mode

**Vision & Creative Direction:** Tim (the user). First-time game developer, building a game that doesn't currently exist.

**Senior Engineering / Tech Direction:** Claude.ai (this assistant). Translates vision into architecture, flags scope/risk/feasibility, suggests alternatives, recommends sequencing. Has explicit license to push back when:
- Something is premature given current foundations
- A cleaner approach exists Tim hasn't considered
- Scope is drifting in a way that risks future-proofing
- Critical-path systems are being skipped for polish features

Defers to creative-director call on vision. Creative input from Claude.ai is welcome.

**Implementation:** Claude Code (local Sonnet agent). Executes round-by-round prompts.

**Decision flow:** Tim describes → Claude.ai assesses → Tim decides → Claude.ai writes prompt with locked decisions → Claude Code implements → Tim verifies → Claude.ai updates CLAUDE.md.

**This means:** Tim's instinct is an opening position until Claude.ai has weighed in. Tim retains full override authority but expects pushback when warranted.

**Investigation-before-patching protocol (V8.40):** When Claude.ai writes a prompt with a root-cause hypothesis, Claude Code investigates and validates/invalidates the hypothesis BEFORE writing the patch. If hypothesis is wrong, find the real bug, then patch. V8.40 surfaced this when the floating-numbers bug Claude.ai blamed on field-name drift turned out to be CSS containment instead.

---

## 📋 Strategic Trajectory Notes

Living section. Captures meta-discussions about project direction, sequencing, recommended pivots, architectural debates. New Claude sessions read this for current strategic context.

### V8.40 — Lesson learned: CSS / non-canonical fields with implicit side effects

The Day 20.4.1 floating-damage targeting fix appeared to land cleanly, but Day 20.4.2 playtest revealed player-attack numbers were STILL not appearing. Claude.ai hypothesized field-name drift (`event.target` vs `event.target_id`). Claude Code investigated first, confirmed `target` was canonical everywhere, then found the real bug: the enemy-side row container had `overflowX: "auto"` set (probably to handle horizontal scroll for many enemies), which **per W3C spec automatically promotes `overflow-y` to `auto`**, which silently clipped absolutely-positioned floating numbers that extended above the portrait's top edge. The float was firing on the correct host, just getting clipped invisibly by an unrelated CSS rule.

**This is the V8.39 lesson in a different flavor:**
- V8.39: defensive overcheck (`category === "settlement_hub"` fallback alongside `is_settlement_node`) caused the bug it was preventing.
- V8.40: unrelated CSS property (`overflowX: auto`) silently sabotaged a feature it had no business touching.

**Shared pattern:** CSS / non-canonical fields with **implicit side effects** that surface only under specific conditions. Unit tests can't catch these because tests use synthetic events / synthetic DOM. The real environment is where they bite.

**Mitigation:** Integration tests at the boundary where real components meet real data. V8.40 added `floating-damage-integration.test.ts` wiring real combat-resolver → combat-engine → makeFloatingEntry. If `target` ever drifts to `target_id`, jest fails at test time, not in Tim's browser. Worth a project-wide audit of routing helpers and lookup keys for similar integration-test coverage.

Codified in foundational rules 70-71.

### V8.39 — Lesson: defensive overcheck caused the V8.38 bug

The Day 20.4 defeat respawn bug was attributed to spawn-init writing the wrong field. Real root cause was a `category === "settlement_hub"` fallback alongside the canonical `is_settlement_node === true` check, added in Day 20.1 as defensive code. WorldBible's hard-coded `starting_region.type = "settlement_hub"` gets copied to region zones' `category`, so every region-zone arrival was being mis-classified as a settlement hub.

**Foundational lesson:** Defensive overchecks ("set this AND that") can become positive bugs when "and that" matches things it shouldn't. Canonical field = single source of truth; fallbacks need stronger justification than "just in case." Codified in rule 65.

### V8.38 — Three strategic decisions LOCKED

**Decision 1: Multiplayer = PRE-LAUNCH (active requirement, not passive constraint).** Dedicated Day 24 phase. Day 21/22/23 design must actively support party-of-N. Impacts: loot drops need "who gets it" rules, XP per-character to alive participants, quest state shared, party initiative.

**Decision 2: Customization layer = PRE-LAUNCH but towards end.** Day 25 phase. User-supplied theme prompts plumbed into world gen. 1-2 day session estimate. Real risk is content coherence — needs playtest iterations.

**Decision 3: Day 22 skills = FOUNDATIONS NOW (middle path).** Skill domain enum (Combat / Crafting / Social / Exploration), each with level / XP / max_level. Combat domain wired with real XP hooks, others stubbed. Schema supports lifestyle skills cleanly for Day 24+ addition.

### V8.37 — Combat scope drift assessment + recommended sequencing

Day 20 expanded from one prompt to ten commits (1, 2, 2.5, 3, 20.1, 20.2, 20.3, 20.4, 20.4.1, 20.4.2). Floating damage alone took three rounds to land correctly. Heavy combat investment ahead of dependent systems, but combat is the foundation everything else hangs on, so this was necessary.

**Confirmed sequence (V8.37 + V8.38 amendments):**
1. **Polish Round (Prompt 4)** — UX debt + mobile-viewport QA bundle
2. **Day 21 — Container + Loot** (multiplayer-aware)
3. **Day 22 — Skills + Leveling** (multiplayer-aware + lifestyle skill foundations)
4. **Vertical slice playtest**
5. **Day 23 — Main Quest Thread** (multiplayer-aware)
6. **Day 24 — Multiplayer Foundation**
7. **Day 25 — Customization Layer**
8. **Day 20.5 — Verbal Action / Taunt** — DEFERRED to last

### Open strategic questions

- **External playtest timing.** Likely best post-Day-22 or post-Day-23.
- **Difficulty tuning model.** Toggle vs implicit world-tier scaling?
- **Random travel encounters** (combat-spec §3 deferral). Slate post-Day-21? Or fold into Day 22/23?
- **Verbal action redundancy risk.** If Day 22 adds Charisma skill tree, verbal action types may need reconciling.
- **NPC behavior dispatch** (combat-spec §6.3 deferral). Future combat-depth pass.
- **Map visual rework.** Pure visual debt; deferred dedicated session.
- **Defensive overcheck audit (V8.39 lesson).** Look for similar `category === X` / `type === X` fallbacks alongside canonical boolean fields.
- **CSS containment audit (V8.40 lesson).** Look for `overflow-x: auto` / `overflow-y: auto` on parent containers that host absolutely-positioned children — they silently clip. Candidates: combat panel wrapper, story feed scroll container, inventory grid, sidebar panels.
- **Integration test coverage audit (V8.40 lesson).** Routing helpers, lookup keys, and similar wiring points should have integration tests against real data, not just unit tests against fake events.

---

## 🔄 Current Status (Read This First)

**Current Phase:** Day 20 Combat fully complete through 20.4.2 hotfix. Floating damage numbers, codex modal, D&D-style roll display all working. Combat input is button-only (V8.37 interim, replaced by Day 20.5 verbal action much later). Polish Round (Prompt 4) is next.
**Local Dev Port:** 3000
**Stack:** Next.js 14 / Tailwind / shadcn/ui / Supabase / Claude API / Stripe / Vercel
**GitHub Repo:** atomictim/endless-worlds-rpg

| Phase | Title | Status |
| --- | --- | --- |
| 1–18 | MVP through Systems Audit | ✅ Complete |
| 19A–19F | World Generation Architecture | ✅ Complete |
| Movement Track | Verified end-to-end | ✅ FROZEN |
| Combat Spec | /docs/combat-spec.md design doc | ✅ Frozen |
| 20 — Combat Prompts 1-3 + 2.5 | Data foundation + resolver + UI + nav fix | ✅ Complete |
| 20.1 — Combat Polish (1215bb6) | Starting equipment + encounter banner + separators + pacing | ✅ Complete |
| 20.2 — Combat Hotfix (bf3871e) | Initiative kickoff fix + inventory stats | ✅ Complete |
| 20.3 — Combat Polish 2 (732e944) | Full-width separators + CRITICAL HIT banner + resolution two-line + planEventSuppression | ✅ Complete |
| 20.4 — Combat Polish 3 (fc508f3) | Floating damage numbers (introduced w/ targeting + clip bugs) + inline roll details + defeat teleport groundwork | ✅ Complete |
| 20.4.1 — Combat Hotfix (c67f2c0) | Floating damage routing switch + inventory Use during combat + flee DC format + defeat respawn settlement-detection fix (category fallback removal) | ✅ Complete |
| **20.4.2 — Combat Hotfix 2 (f17c221)** | **Floating damage CSS clip fix (overflow:visible on enemy row) + stagger via computeFloatStartDelay + emission synced to feed pacing in useCombat + codex modal overlay + D&D-style roll display (d20: 17, +2 → 19 vs 12 \| 1d6+2)** | ✅ **Complete** |
| Polish Round (Prompt 4) | Movement-direction grouped nav + tier color-coding + settlement card label + tier auto-switch + NPC dialogue contrast + mobile-viewport QA bundle | ⏳ NEXT |
| Day 21 | Container + Loot — registry, loot tables, dungeon containers, per-character inventory rules | ⏳ After Polish Round |
| Day 22 | Skills + Leveling — XP, stat points, level gates + skill domain foundations | ⏳ After Day 21 |
| Vertical slice playtest | Full game start → win condition with placeholder content | ⏳ Before Day 23 |
| Day 23 | Main Quest Thread — breadcrumb injection, quest tracking | ⏳ Post-playtest |
| Day 24 | Multiplayer Foundation — party schema, Supabase realtime, turn-sync, shared feed, loot/quest decision rules | ⏳ Pre-launch |
| Day 25 | Customization Layer — user-supplied theme prompts, presets, genre-theme interaction | ⏳ Pre-launch toward end |
| Day 20.5 | Verbal Action System — chat input hijack: taunt/distract/intimidate | ⏳ Deferred to last (post-Day-25) |
| Map Visual Rework | Dedicated session | ⏳ Deferred |

**Active genres:** Fantasy, Cyberpunk, Horror/Lovecraftian, Space Opera, Post-Apocalyptic. Noir removed.

### Day 20.4.2 — Combat Hotfix 2 (commit f17c221 — 321/321 tests, /game 109 kB)

Five-bug hotfix round. Notable: hypothesized root cause was wrong; real bug was CSS containment.

**Task 1 — Player-attack floats missing (CSS clip bug):**
- HYPOTHESIS (wrong): field-name drift `target` vs `target_id`.
- INVESTIGATION-FIRST: confirmed `target` is canonical everywhere. Bug was elsewhere.
- REAL ROOT CAUSE: enemy-side row container had `overflowX: "auto"`. Per W3C spec, setting either overflow-x or overflow-y to a non-`visible` value promotes the OTHER axis to `auto` automatically. This silently clipped absolutely-positioned floats extending above the portrait's top edge.
- FIX: `overflow: "visible"` on the enemy row container.
- DOCUMENTATION: top-of-file comments in CombatMode.tsx now document BOTH the CombatEvent field names used for routing AND the containing-block chain that floating numbers depend on.
- TEST: new `floating-damage-integration.test.ts` (5 tests) wires real combat-resolver → combat-engine → makeFloatingEntry. Field-name drift would now fail at test time, not in Tim's browser.

**Task 2 — Multi-enemy stack (sequential delay):**
- Multiple enemies attacking in one phase pixel-stacked floats on top of each other.
- New `computeFloatStartDelay` pure helper (exported, 7 unit tests). Tracks `lastEmittedAt: Record<host_id, timestamp>`. When pushing a new entry within 300ms of previous on same host, adds incremental delay.
- `FloatingDamageEntry` gained `start_delay` field. `FloatingDamage.tsx` applies as `animationDelay`. `globals.css` switched fill-mode `forwards` → `both` so 0% keyframe holds during delay window.
- setTimeout cleanup uses `1100ms + start_delay`.

**Task 3 — Floats fired ahead of feed pacing (timing desync):**
- V8.38/V8.39 emitted floats on store commit (immediate); story-feed lines used V8.35 pacing delays (800/500/800ms). Numbers flashed before their corresponding text.
- ARCHITECTURE CHANGE: lifted `floatingByActor` state and `emitFloat` lifecycle out of CombatMode into useCombat. `emitFloat` now called INSIDE `projectCombatEventsToFeed` AFTER the pacing sleeps — float and feed line appear at the same instant.
- CombatMode is now a pure renderer for the prop.

**Task 4 — Codex modal (don't unmount combat):**
- Codex was at `/game/codex` route. Navigating there unmounted CombatMode; returning to /game left combat state active but UI not restored.
- Extracted body to `components/game/CodexContent`. Added `components/game/CodexModal` (full-screen overlay, ESC + backdrop + X close, z-50 below z-60 entry-detail).
- `codexModalOpen` + `toggleCodexModal` added to game store. GameLayout's codex button toggles modal. `/game/codex` route still works for direct URL access.
- Codex route went 6.85 kB → 983 B after extraction.

**Task 5 — D&D-style roll display:**
- Rewrote `buildRollsSuffix`:
  - Hit: `(d20: 17, +2 → 19 vs 12 | 1d6+2)`
  - Miss: `(d20: 4, +2 → 6 vs 12)`
  - Negative mod: `(d20: 12, +(-2) → 10 vs 10)`
  - Fumble: `(d20: 1)` — skip mod, auto-outcome
  - Crit: `(d20: 20 | 6 (max) + 3 (1d6) + 2)` — skip vs DC, auto-outcome
  - Heal: `(1d8: 4 +4 = 8)`
- New `formatModifier` helper handles sign + parens for negatives.
- Players can now see the math when a high d20 still fails due to negative modifier.

**Tests:** 60 new (321 total), spanning new integration suite + stagger helper + D&D-format coverage.

### Day 20.4.1 — Combat Hotfix (commit c67f2c0 — 261/261 tests)

Five-bug round: floating damage routing switch (`event.target` for player_attack, `PLAYER_ID` for enemy/heal — fixed targeting AT THE WRONG LAYER, real bug was CSS clip found in 20.4.2), inventory Use during combat routes through `submitCombatAction` (Equip/Unequip/Read/Search/Drop hidden), flee DC `Math.round()` + raw d20 storage, defeat respawn settlement-detection bug found at REAL root cause (step 7c-2 `category === "settlement_hub"` fallback removed — was overwriting last_settlement_hub_id with region id).

### Day 20.4 — Combat Polish 3 (commit fc508f3 — 243/243 tests)
Roll details on CombatEvent + inline roll suffix + floating damage numbers (introduced with multiple bugs caught later) + defeat teleport spawn-init + 3-tier fallback + destination messaging.

### Day 20.3 — Combat Polish 2 (commit 732e944 — 233/233 tests)
Full-width flex separators, button-only combat input, CRITICAL HIT two-line banner, planEventSuppression, Victory/Defeat/Escaped resolution two-line centered.

### Day 20.2 — Combat Hotfix (commit bf3871e — 216/216 tests)
Initiative kickoff fix via shared `advanceUntilPlayerTurnOrEnd`. Inventory stats display + EQUIPPED pill.

### Day 20.1 — Combat Polish (commit 1215bb6 — 209/209 tests)
Starting equipment auto-equipped. Encounter banner templated. Turn separators emitted. Pacing delays. Header pill displayPhase. **Also introduced the `category === "settlement_hub"` fallback in step 7c-2 that caused the V8.38 defeat bug (removed V8.39).**

### Combat Day 20 — Prompt 3/3 (abf73e6 — 173/173 tests)
Combat mode UI (CombatMode + 6 child components). Templated routine + LLM dramatic narration. Bestiary codex. New-game preamble. HP bar transition + crit portrait shake.

### Combat Day 20 — Earlier rounds (foundation)
Prompt 2.5 (region trigger reclassification), Prompt 2 (resolver + turn loop), Prompt 1 (data foundation).

### Pre-Combat (movement track)
Region/Resilience Round (87c89a3), Polish Round (b7032f9), Targeted Fix (dc5bcd8), Regression Fix (75a7cd4), Bug Fix (57b0300), Architecture Hardening (57d27f3), 19A-19F generation phases.

### Architecture Status ✅
```
Domain 1 (Engine):     World graph, navigation, stat checks, dialogue option
                       generation, combat resolver (V8.32), turn loop (V8.32),
                       encounter triggers (V8.32), region expansion guard
                       (V8.33), combat UI + narrator + bestiary (V8.34),
                       separators + pacing + starting equipment module (V8.35),
                       initiative kickoff + inventory stats (V8.36),
                       resolution banners + suppression (V8.37), roll detail
                       surfacing + inline roll suffix + floating damage +
                       defeat resilience + destination messaging (V8.38),
                       routing hardening + settlement-detection canonical-only
                       + inventory Use combat path (V8.39), CSS containment
                       fix + float stagger + emission synced to feed pacing +
                       codex modal + D&D roll display (V8.40), loot resolver
                       (Day 21) — pure code
Domain 2 (Content):    WCD, WorldBible, RegionBible (with enemies), NPCs,
                       items, bestiary, starting-equipment loadouts — frozen

AI during gameplay:
  ✅ Arrival narration — first visit only, cached permanently
  ✅ Dialogue options  — built by code, AI writes response only
  ✅ Action narration  — 1-4 sentences (out-of-combat only)
  ✅ Combat narration  — selective dramatic events. Templated routine.
  ⏳ Container search  — pending Day 21
  ⏳ Verbal action     — DEFERRED to Day 20.5
```

### Combat System ✅ COMPLETE (V8.31 → V8.40)
```
DATA / RESOLVER / TRIGGER / TURN LOOP / INITIATIVE KICKOFF: V8.31-V8.36
UI LAYER (V8.34 → V8.40):
  Side-by-side layout. Per-event styling. Full-width turn separators.
  CRITICAL HIT two-line render. Victory/Defeat/Escaped two-line centered.
  Inline roll detail suffix (D&D-style format V8.40).
  Floating damage numbers — CSS clip fix V8.40 (overflow:visible on row),
  stagger via computeFloatStartDelay V8.40, emission synced to feed
  pacing in useCombat::projectCombatEventsToFeed V8.40.
  Destination message line on defeat/flee.
  Inventory Use button routes through combat path when combat active.
  Codex is modal overlay (V8.40), does NOT unmount combat panel.

INPUT GATING: ActionBar buttons + Inventory Use button only.
  useGameLoop.submitAction early-bails on combat.active.
  Inventory Use during combat routes through submitCombatAction.

NARRATION LAYER: Templated routine. LLM dramatic (crit/kill/victory/
  defeat/flee_success). max_tokens 250 dramatic, 120 resolutions.
  Crit prose suppressed when victory follows.

EVENT SUPPRESSION: planEventSuppression(events) pre-scans batches.

DEFEAT RESILIENCE: last_settlement_hub_id initialized at game spawn.
  3-tier fallback chain. Cross-region teleport per soulslike model.
  Step 7c-2 settlement detection via is_settlement_node === true ONLY.

ROLL DETAIL DISPLAY (V8.40):
  D&D-style: (d20: 17, +2 → 19 vs 12 | 1d6+2)
  formatModifier helper handles +N / +(-N) / +0.

PACING: 800/800/500ms transition delays. Float emission synced (V8.40).

UI INDICATORS: CombatMode header pill displayPhase decoupled.

BESTIARY CODEX: writeBestiaryEntry on combat_start.

STARTING EQUIPMENT: 15 backgrounds, all equipped at game start.

INVENTORY DISPLAY: Damage/Armor/Heal lines + EQUIPPED pill.

DEV TOOLS: window.__forceEncounter("enemy_id", ...).
```

### Region Expansion Guard ✅ (V8.33)
`/lib/game/region-expansion-guard.ts` — works around toSlug() stripping hyphens.

### Navigation Rules ✅
Map = visual only. Card grammar: BACK / DEEPER / EXIT / PEER / UNDISCOVERED. Combat trigger step 7c-3. `last_settlement_hub_id` updates on every successful arrival via `is_settlement_node === true` predicate ONLY (V8.39).

### Map Description Sourcing ✅
World→wcd.world_description / Region→currentRegion.atmosphere (parent walk) / Local→currentLocation.atmosphere.

### NPC Dialogue System ✅
Options built by code. AI writes response only. `.ew-said` contrast pending Polish Round.

### RegionBible / WorldBible Resilience ✅
RegionBible: haiku-4-5, max_tokens 7000, stub fallback, idempotent. WorldBible: sonnet-4-5, max_tokens 10000, validate-don't-500.

### Known issues

**Polish Round (Prompt 4) — design locked V8.36 + V8.37, NEXT:**
- Movement-direction grouped nav cards (BACK / DEEPER / PEER / UNDISCOVERED rows)
- Tier color-coding within each group (region lavender, settlement sky-blue, sub-location mint, dungeon new color)
- Settlement hub card on new region arrival reads as back-from-settlement — card-typing fix
- Map does not auto-switch tiers on cross-region arrival
- NPC dialogue text needs higher contrast (.ew-said too close to ink-2)
- **Mobile-viewport QA pass** — verify combat panel, nav, story feed, modals all phone-readable

**Day 20.5 — Verbal Action (deferred to last):** Chat input hijack with LLM judging + charisma check + status_effects.

**Other deferred:** Map visual rework, RTL component test infra, pacing tuning watchpoint, world-gen perf, NPC color overlap, hub codex, grid_position, behavior dispatch, toSlug bug, combat balance pre-Day-21/22.

---

## 🏗️ Architecture

### The Two Domains ✅
**Domain 1 (Engine — pure code):** Navigation, stat checks, dialogue option generation, combat resolver + turn loop + triggers (V8.32), region expansion guard (V8.33), combat UI + narrator + bestiary (V8.34), separators + pacing + starting equipment (V8.35), initiative kickoff + inventory stats (V8.36), resolution banners + suppression (V8.37), roll detail + inline suffix + floating damage + defeat resilience + destination messaging (V8.38), routing hardening + settlement detection canonical-only + inventory Use combat path (V8.39), CSS containment fix + float stagger + emission synced to feed + codex modal + D&D roll display (V8.40), loot resolver (Day 21).
**Domain 2 (Content Library — frozen):** WCD, locations, NPCs, items, loot tables, main quest, bestiary, region enemies, starting equipment loadouts.

### Generation Model ✅
RegionBible: haiku-4-5, max_tokens 7000. WorldBible: sonnet-4-5, max_tokens 10000. WCD includes `world_description`. Combat narrator: sonnet-4-5.

### Map System ✅
Genre renderers active. PAD=76. Tier switcher. Initial tier on mount: Local. ⚠️ Tier auto-switch + visual rework pending.

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
58. Inline roll suffix renders subtle parenthetical breakdown via `{primary, rolls}` return shape from templates. CSS `.combat-roll-detail` (10px dim mono, 0.6 opacity). (V8.38)
59. Floating damage numbers fire on hit/crit/heal events ONLY. Routing via explicit `switch(event.type)`: player_attack hosts on `event.target` (enemy), enemy_attack/use_item host on `PLAYER_ID`. Self-targeted player_attack returns null defensively. (V8.38 + V8.39)
60. Defeat teleport — `last_settlement_hub_id` is initialized at game spawn in apply-world-bible. handleDefeat uses 3-tier fallback chain. Cross-region teleport intentional per soulslike model. (V8.38)
61. Resolution events (defeat / flee_success) carry destination payload. StoryFeed renders templated info line below LLM prose. Victory does NOT get destination line. (V8.38)
62. `rolls.d20` stores RAW d20 value (1-20), not total post-modifier. `target_dc` wrapped in `Math.round()` for display. Pass/fail logic still uses internal total. (V8.39)
63. Inventory Use button during combat routes through `submitCombatAction`, NOT `submitAction`. Equip/Unequip/Read/Search/Drop buttons HIDDEN during combat. Disable state honors `combatResolving` to prevent double-tap mid-drain. (V8.39)
64. Floating damage entry routing uses explicit `switch(event.type)` not conditional fallback. Misroute prevented by defensive `player_attack target === PLAYER_ID` guard returning null. (V8.39)
65. **Settlement-hub detection in step 7c-2 uses `is_settlement_node === true` predicate ONLY.** Category fallback was a Day 20.1 defensive overcheck that misrouted region zones. **Foundational lesson: defensive overchecks alongside canonical fields can become positive bugs.** (V8.39)
66. Floating damage emission lives INSIDE `projectCombatEventsToFeed` (useCombat), called AFTER pacing sleeps so visible float pops at the same instant as its matching feed line. Was previously emitted on store commit, fired ahead of pacing. CombatMode is a pure renderer for the `floatingByActor` prop; state and lifecycle live in useCombat. (V8.40)
67. Multi-host floating damage uses `computeFloatStartDelay` pure helper. Tracks `lastEmittedAt: Record<host_id, timestamp>` and emits incremental delay (300ms increments) when entries land on same host within window. `FloatingDamageEntry.start_delay` applied as CSS `animationDelay`. `animation-fill-mode: both` so 0% keyframe holds during delay window. setTimeout cleanup uses `1100ms + start_delay`. (V8.40)
68. Roll display format is D&D-style with explicit modifier math: `(d20: 17, +2 → 19 vs 12 | 1d6+2)` for hits/misses, `(d20: 1)` for fumbles (skip mod), `(d20: 20 | 6 (max) + 3 (1d6) + 2)` for crits (skip vs DC), `(1d8: 4 +4 = 8)` for heals. `formatModifier` helper handles sign + parens for negatives. Supersedes V8.38 raw-d20-only format. (V8.40)
69. Codex is rendered as `CodexModal` overlay (z-50, ESC + backdrop + X close) toggled by `codexModalOpen` in game store. Combat panel remains mounted underneath. `/game/codex` route still works for direct URL access (CodexContent component is shared between modal and route). (V8.40)
70. **CSS containment lesson: absolutely-positioned children CAN be clipped by ancestor `overflow-x: auto` or `overflow-y: auto`.** Per W3C spec, setting either overflow axis to a non-`visible` value automatically promotes the OTHER axis to `auto`, which establishes a clipping context. Enemy-side row container must use `overflow: visible` to allow floating numbers to extend above portrait. **Audit similar patterns:** any container hosting absolutely-positioned children needs explicit `overflow: visible` if children extend outside the box. (V8.40)
71. **Integration tests required for routing helpers and lookup keys.** Unit tests against fake events can pass while real-data wiring is broken (V8.40 floating-damage clip bug had passing unit tests). `floating-damage-integration.test.ts` wires real combat-resolver → combat-engine → makeFloatingEntry. Similar coverage needed for other routing points (event handlers reading event fields, lookup keys for state collections). (V8.40)

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

V8.38/V8.40 elements:
  Roll detail suffix:      10px dim mono, 0.6 opacity (--combat-roll-detail)
                           D&D-style format V8.40
  Floating damage:         28px mono bold (36px crit), 1100ms float-fade
                           Stagger via animationDelay V8.40
                           Emitted synced with feed pacing V8.40
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
**Investigation-before-patching (V8.40):** When Claude.ai writes a prompt with a hypothesized root cause, Claude Code investigates and validates/invalidates the hypothesis BEFORE patching.
**All architecture decisions defer to /docs/architecture-spec.md.**
**All combat decisions defer to /docs/combat-spec.md.**
**All vision/scope decisions defer to 🎮 Game Vision section above.**
**All strategic / sequencing decisions captured in 📋 Strategic Trajectory Notes section above.**

---

*Last updated: V8.40 — Day 20.4.2 Combat Hotfix 2 (commit f17c221, 321/321 tests, /game 109 kB): floating damage CSS clip fix (overflow:visible on enemy row — real bug, not the hypothesized field-name drift) + multi-host stagger via computeFloatStartDelay + emission lifted into useCombat::projectCombatEventsToFeed synced with feed pacing + codex modal overlay preserves combat panel + D&D-style roll display with explicit modifier math. New integration test suite wires real combat-resolver → engine → makeFloatingEntry. Foundational rules 66-71 added including CSS containment lesson and integration-test requirement. Investigation-before-patching protocol added to workflow. Polish Round (Prompt 4) is next.*
