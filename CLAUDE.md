# Project: Endless Worlds RPG — Master Context

**Version:** 8.41
**Status:** Polish Round 4a COMPLETE — Polish Round 4b (Mobile QA) Next
**Objective:** A text-based RPG that generates a unique world for every playthrough. Genre-agnostic, infinitely replayable, CRPG depth.

**Reference:** /docs/architecture-spec.md — Domain 1 vs Domain 2 decisions. /docs/combat-spec.md — Combat system design. /docs/css-containment-audit.md — V8.40 audit of overflow + absolutely-positioned descendants.

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

**Investigation-before-patching protocol (V8.40):** When Claude.ai writes a prompt with a root-cause hypothesis, Claude Code investigates and validates/invalidates the hypothesis BEFORE writing the patch. V8.40 demonstrated value (CSS containment vs hypothesized field-name drift).

**Origin/main baseline check (V8.41):** As the first step of every prompt, Claude Code runs `git fetch origin && git log origin/main --oneline -5` to verify the working state matches origin HEAD. Polish Round 4a surfaced a 28-commit drift where Claude Code was patching against V8.28 while origin was V8.40 — caught mid-round and re-baselined cleanly, but the cost is non-trivial. Adding this 2-second check at prompt-start prevents the issue.

---

## 📋 Strategic Trajectory Notes

Living section. Captures meta-discussions about project direction, sequencing, recommended pivots, architectural debates. New Claude sessions read this for current strategic context.

### V8.41 — Workflow: baseline drift + audit results + Combat UX queue

**Baseline drift incident.** During Polish Round 4a, Claude Code started implementing against V8.28 (local branch state). Origin/main was at V8.40 — 28 commits ahead. Caught mid-round during a code reference check, reset to V8.40, rewrote the round against current infrastructure cleanly. Cost: ~half a round of throwaway work, plus extra cognitive load for re-baselining.

**Test count note:** Claude Code reported "275 V8.40 baseline" while V8.40 had actually shipped 321 tests per the Day 20.4.2 summary. Likely an artifact of the re-baseline (intermediate state during reset). The actual landing state (297 = 275 + 22 new) is what `jest pass` validates, but the doc's running test count may be slightly off from origin/main. Test counts in this doc are reference values, not authoritative. Source of truth = jest output at last commit.

**Mitigation in place:** Prompt preamble now mandates `git fetch origin && git log origin/main --oneline -5` as step 1 before any read/patch work. Documented in Working Mode section.

**CSS containment audit result (V8.41 / Polish 4a).** `/docs/css-containment-audit.md` produced. **Zero active clipping risks** beyond the V8.40 enemy-row fix that's already landed. 5 future candidates flagged for when those features get touched: PortraitSlot status badges, StoryFeed inline tooltips, TradeModal +/- gold floats, GameLayout mobile rail tooltips, WorldMap edge tooltips. These are tracking items, not bugs.

**Combat UX & Flow Polish Queue (NEW deferred bucket).** Tim flagged three "feel" issues from V8.40 playtest that don't fit cleanly into any current round. Captured as a dedicated polish bucket to address after Day 23 (once core systems land):
1. **Hit vs miss visual differentiation in story feed.** Currently same ⚔ prefix, same color. Need at-a-glance distinguishability. Likely: hits keep ⚔, misses get a different glyph (∅, ✗) + slightly dimmer color.
2. **Miss feedback over portrait.** Small white "0" or "—" floating number on miss so something visually registers per action, not just on hits/heals. Reuses existing float system.
3. **Combat flow pacing — flee-fail → death sequence.** Too abrupt. Player clicks flee, takes a beat, then defeat screen with no clear "your flee failed" moment to absorb. Needs explicit pause + visual marker between flee fail and enemy phase resolving.

Scope: probably one focused round, post-Day-23. Not critical-path.

### V8.40 — Lesson learned: CSS / non-canonical fields with implicit side effects

The Day 20.4.1 floating-damage targeting fix appeared to land cleanly, but Day 20.4.2 playtest revealed player-attack numbers were STILL not appearing. Claude.ai hypothesized field-name drift (`event.target` vs `event.target_id`). Claude Code investigated first, confirmed `target` was canonical everywhere, then found the real bug: the enemy-side row container had `overflowX: "auto"` set, which **per W3C spec automatically promotes `overflow-y` to `auto`**, which silently clipped absolutely-positioned floating numbers extending above the portrait's top edge.

**This is the V8.39 lesson in a different flavor:**
- V8.39: defensive overcheck (`category === "settlement_hub"`) caused the bug it was preventing.
- V8.40: unrelated CSS property (`overflowX: auto`) silently sabotaged a feature it had no business touching.

**Shared pattern:** CSS / non-canonical fields with **implicit side effects** that surface only under specific conditions. Unit tests can't catch these. **Mitigation:** integration tests at the boundary where real components meet real data. Codified in rules 70-71.

### V8.39 — Lesson: defensive overcheck caused the V8.38 bug

The Day 20.4 defeat respawn bug was attributed to spawn-init writing the wrong field. Real root cause was a `category === "settlement_hub"` fallback alongside the canonical `is_settlement_node === true` check, added in Day 20.1 as defensive code. WorldBible's hard-coded `starting_region.type = "settlement_hub"` gets copied to region zones' `category`, so every region-zone arrival was being mis-classified as a settlement hub.

**Foundational lesson:** Defensive overchecks ("set this AND that") can become positive bugs when "and that" matches things it shouldn't. Canonical field = single source of truth; fallbacks need stronger justification than "just in case." Codified in rule 65.

### V8.38 — Three strategic decisions LOCKED

**Decision 1: Multiplayer = PRE-LAUNCH** (active requirement, not passive constraint). Dedicated Day 24 phase. Day 21/22/23 design must actively support party-of-N.

**Decision 2: Customization layer = PRE-LAUNCH but towards end.** Day 25 phase. User-supplied theme prompts plumbed into world gen. 1-2 day session estimate.

**Decision 3: Day 22 skills = FOUNDATIONS NOW** (middle path). Skill domain enum (Combat / Crafting / Social / Exploration). Combat domain wired, others stubbed. Schema supports lifestyle skills for Day 24+ addition.

### V8.37 — Combat scope drift assessment + recommended sequencing

Day 20 expanded from one prompt to ten commits. Heavy combat investment but combat is the foundation.

**Confirmed sequence (V8.37 + V8.38 + V8.41 amendments):**
1. **Polish Round 4a** ✅ (24ac19c) — UX debt landed
2. **Polish Round 4b** ⏳ NEXT — mobile-viewport QA pass (split out per V8.41)
3. **Day 21 — Container + Loot** (multiplayer-aware)
4. **Day 22 — Skills + Leveling** (multiplayer-aware + lifestyle skill foundations)
5. **Vertical slice playtest**
6. **Day 23 — Main Quest Thread** (multiplayer-aware)
7. **Combat UX & Flow Polish round** (V8.41 queue: hit/miss differentiation, miss float, flee-fail pacing)
8. **Day 24 — Multiplayer Foundation**
9. **Day 25 — Customization Layer**
10. **Day 20.5 — Verbal Action / Taunt** — DEFERRED to last

### Open strategic questions

- **External playtest timing.** Likely best post-Day-22 or post-Day-23.
- **Difficulty tuning model.** Toggle vs implicit world-tier scaling?
- **Random travel encounters** (combat-spec §3 deferral). Slate post-Day-21? Or fold into Day 22/23?
- **Verbal action redundancy risk.** If Day 22 adds Charisma skill tree, verbal action types may need reconciling.
- **NPC behavior dispatch** (combat-spec §6.3 deferral). Future combat-depth pass.
- **Map visual rework.** Pure visual debt; deferred dedicated session.
- **Defensive overcheck audit (V8.39 lesson).** Look for similar `category === X` / `type === X` fallbacks alongside canonical boolean fields.
- **CSS containment audit results (V8.40 + V8.41).** Active audit doc at `/docs/css-containment-audit.md`. 0 active risks, 5 future candidates flagged for when those features get touched.
- **Integration test coverage audit (V8.40 lesson).** Routing helpers, lookup keys, and similar wiring points should have integration tests against real data.

---

## 🔄 Current Status (Read This First)

**Current Phase:** Day 20 Combat fully complete through 20.4.2. Polish Round 4a (nav grouping + tier colors + cross-region card fix + map auto-switch + .ew-said contrast + CSS audit) landed in commit 24ac19c. Polish Round 4b (mobile-viewport QA pass) is next.
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
| 20.4 — Combat Polish 3 (fc508f3) | Floating damage numbers + inline roll details + defeat teleport groundwork | ✅ Complete |
| 20.4.1 — Combat Hotfix (c67f2c0) | Floating damage routing switch + inventory Use during combat + flee DC format + defeat respawn settlement-detection fix | ✅ Complete |
| 20.4.2 — Combat Hotfix 2 (f17c221) | Floating damage CSS clip fix + stagger + emission synced to feed pacing + codex modal + D&D-style roll display | ✅ Complete |
| **Polish Round 4a (24ac19c)** | **Movement-direction grouped nav cards + tier color-coding + cross-region BACK card fix + map tier auto-switch + .ew-said contrast bump + CSS containment audit doc** | ✅ **Complete** |
| Polish Round 4b | Mobile-viewport QA pass — combat panel, nav, story feed, modals, inventory, codex, map all phone-readable | ⏳ NEXT |
| Day 21 | Container + Loot — registry, loot tables, dungeon containers, per-character inventory rules | ⏳ After 4b |
| Day 22 | Skills + Leveling — XP, stat points, level gates + skill domain foundations | ⏳ After Day 21 |
| Vertical slice playtest | Full game start → win condition with placeholder content | ⏳ Before Day 23 |
| Day 23 | Main Quest Thread — breadcrumb injection, quest tracking | ⏳ Post-playtest |
| Combat UX & Flow Polish | Hit/miss differentiation + miss float + flee-fail pacing (V8.41 queue) | ⏳ Post-Day-23 |
| Day 24 | Multiplayer Foundation — party schema, Supabase realtime, turn-sync, shared feed, loot/quest decision rules | ⏳ Pre-launch |
| Day 25 | Customization Layer — user-supplied theme prompts, presets, genre-theme interaction | ⏳ Pre-launch toward end |
| Day 20.5 | Verbal Action System — chat input hijack: taunt/distract/intimidate | ⏳ Deferred to last (post-Day-25) |
| Map Visual Rework | Dedicated session | ⏳ Deferred |

**Active genres:** Fantasy, Cyberpunk, Horror/Lovecraftian, Space Opera, Post-Apocalyptic. Noir removed.

### Polish Round 4a (commit 24ac19c — 297/297 tests, /game stable)

Six-task UX debt round. Heads-up: Claude Code re-baselined mid-round after detecting local branch was 28 commits behind origin/main. Re-baselined to V8.40 cleanly, rewrote against current infrastructure. Mitigation in place for V8.41+ (origin baseline check in prompt preamble).

**Task 1 — Movement-direction grouped nav cards:**
- Extracted `buildCards` + `groupCardsByDirection` from NavigationBar into pure-function `lib/game/nav-cards.ts`. Unit-testable.
- NavigationBar renders 4 rows: BACK / DEEPER / PEER / UNDISCOVERED. Italic-serif labels. EXIT cards fold into BACK group at the grouping step. Empty groups omitted.

**Task 2 — Tier color-coding:**
- Added `--hl-sublocation` and `--hl-dungeon` design tokens.
- Each `Card` carries a `tier` field set by `tierOfNode` predicate. Card border, leading arrow, title, and badge border pick up tier color. Background stays neutral.
- Region lavender (--hl-region), Settlement sky-blue (--hl-loc), Sub-location mint (--hl-sublocation NEW), Dungeon burnt-copper (--hl-dungeon NEW).

**Task 3a — Cross-region BACK card label:**
- INVESTIGATION-FIRST per V8.40 protocol: V8.32 already tracks `masterState.navigation_trail` (last 5 visited node ids).
- `buildCards` now consults `trail[-2]`: if it resolves to a node in a different region, the BACK card targets that previous region's settlement hub instead of the new region's unvisited settlement.
- No useGameLoop or game-store changes needed — leveraged existing infrastructure.

**Task 3b — Map tier auto-switch on cross-region arrival:**
- `components/game/WorldMap.tsx` cross-region useEffect now forces tier=2 (Region) on cross-region arrival.
- Same-region moves leave tier alone (preserves manual tier choice).

**Task 4 — .ew-said contrast bump:**
- `--hl-said: #e8d5b0 → #f4e8c8`. Weight 600 italic stays.
- Brighter cream reads more distinctly against `--bg-0` without needing optional border-left.

**Task 5 — CSS containment audit:**
- `/docs/css-containment-audit.md` audits every overflow declaration + absolutely-positioned descendant.
- **0 active risks.** Flags 5 future candidates: PortraitSlot status badges, StoryFeed inline tooltips, TradeModal +/- gold floats, GameLayout mobile rail tooltips, WorldMap edge tooltips. Doc-only — no fixes applied.

**Task 6 — Tests (22 new):**
- `lib/game/__tests__/nav-cards.test.ts` covers `groupCardsByDirection`, `directionOfCard`, `tierOfNode`, `previousNodeIdFromTrail`, `isCrossRegionArrival`, and the cross-region BACK card assertion from Task 3a.

### Day 20.4.2 — Combat Hotfix 2 (commit f17c221)

Five-bug round. CSS containment clip fix (overflow:visible on enemy row, real bug — hypothesized field-name drift was wrong). Multi-host stagger via `computeFloatStartDelay`. Emission lifted into `useCombat::projectCombatEventsToFeed` synced with feed pacing. Codex modal overlay preserves combat panel. D&D-style roll display with explicit modifier math. Integration test suite wiring real combat-resolver → engine → makeFloatingEntry. Foundational rules 66-71.

### Day 20.4.1 — Combat Hotfix (commit c67f2c0)

Floating damage routing switch + inventory Use during combat + flee DC format + defeat respawn settlement-detection fix (category fallback removal — real root cause of V8.38 defeat bug). Foundational rules 62-65.

### Day 20.4 — Combat Polish 3 (commit fc508f3)
Roll details on CombatEvent + inline roll suffix + floating damage numbers + defeat teleport spawn-init + 3-tier fallback + destination messaging. Foundational rules 57-61.

### Day 20.3 — Combat Polish 2 (commit 732e944)
Full-width flex separators, button-only combat input, CRITICAL HIT two-line banner, planEventSuppression, Victory/Defeat/Escaped resolution two-line centered. Foundational rules 52-56.

### Day 20.2 — Combat Hotfix (commit bf3871e)
Initiative kickoff fix via shared `advanceUntilPlayerTurnOrEnd`. Inventory stats display + EQUIPPED pill. Foundational rules 49-51.

### Day 20.1 — Combat Polish (commit 1215bb6)
Starting equipment auto-equipped. Encounter banner templated. Turn separators emitted. Pacing delays. Header pill displayPhase. **Also introduced the `category === "settlement_hub"` fallback in step 7c-2 that caused the V8.38 defeat bug (removed V8.39).** Foundational rules 43-48.

### Combat Day 20 — Prompt 3/3 (abf73e6)
Combat mode UI. Templated routine + LLM dramatic narration. Bestiary codex. New-game preamble. HP bar transition + crit portrait shake. Foundational rules 38-42.

### Combat Day 20 — Earlier rounds (foundation)
Prompt 2.5 (region trigger reclassification, rules 34-37), Prompt 2 (resolver + turn loop, rules 28-33), Prompt 1 (data foundation, rules 24-27).

### Pre-Combat (movement track)
Region/Resilience Round (87c89a3), Polish Round (b7032f9), Targeted Fix (dc5bcd8), Regression Fix (75a7cd4), Bug Fix (57b0300), Architecture Hardening (57d27f3), 19A-19F generation phases. Foundational rules 1-23.

### Architecture Status ✅
```
Domain 1 (Engine):     World graph, navigation, stat checks, dialogue option
                       generation, combat (V8.32-V8.40), nav-cards module
                       (V8.41) for movement-grouped + tier-colored cards
                       with cross-region BACK trail awareness, map tier
                       auto-switch on cross-region arrival (V8.41), loot
                       resolver (Day 21) — pure code
Domain 2 (Content):    WCD, WorldBible, RegionBible, NPCs, items, bestiary,
                       starting-equipment loadouts — frozen

AI during gameplay:
  ✅ Arrival narration — first visit only, cached permanently
  ✅ Dialogue options  — built by code, AI writes response only
  ✅ Action narration  — 1-4 sentences (out-of-combat only)
  ✅ Combat narration  — selective dramatic events. Templated routine.
  ⏳ Container search  — pending Day 21
  ⏳ Verbal action     — DEFERRED to Day 20.5
```

### Combat System ✅ COMPLETE (V8.31 → V8.40)
All combat layers shipped. See foundational rules 24-71 for full coverage. Day 20.5 verbal action remains deferred to post-Day-25.

### Navigation System ✅ COMPLETE (V8.41)
```
NAV CARDS (V8.41):
  pure-function lib/game/nav-cards.ts owns buildCards + groupCardsByDirection.
  NavigationBar renders 4 rows: BACK / DEEPER / PEER / UNDISCOVERED.
  EXIT folds into BACK. Empty groups omitted. Italic-serif row labels.
  
TIER COLORS (V8.41):
  Card border, arrow, title, badge use tierOfNode color.
  Region lavender / Settlement sky-blue / Sub-location mint (NEW token) /
  Dungeon burnt-copper (NEW token).
  
CROSS-REGION BACK (V8.41):
  Uses masterState.navigation_trail[-2] (V8.32 infrastructure).
  Detects different region → targets previous region's settlement hub.
  
MAP TIER (V8.30 + V8.41):
  Initial mount: Local (V8.30).
  Cross-region arrival: forces tier=2 Region (V8.41).
  Same-region: leaves tier alone (preserves manual choice).
```

### Region Expansion Guard ✅ (V8.33)
`/lib/game/region-expansion-guard.ts` — works around toSlug() stripping hyphens.

### Map Description Sourcing ✅
World→wcd.world_description / Region→currentRegion.atmosphere (parent walk) / Local→currentLocation.atmosphere.

### NPC Dialogue System ✅
Options built by code. AI writes response only. `.ew-said` brightened to `#f4e8c8` (V8.41) for distinct contrast vs narrator prose.

### RegionBible / WorldBible Resilience ✅
RegionBible: haiku-4-5, max_tokens 7000, stub fallback, idempotent. WorldBible: sonnet-4-5, max_tokens 10000, validate-don't-500.

### Known issues

**Polish Round 4b — mobile-viewport QA pass, NEXT:**
- Phone-width (~380px) sweep across game layout, story feed, nav bar (with new 4-row grouping), combat panel, inventory detail, codex modal, world map at all tiers, forms/inputs (touch targets ≥44px).
- Report broken/clipped/unreadable items; fix obvious things inline; defer significant rework to dedicated rounds.
- Output: /docs/mobile-viewport-audit.md + inline fixes.

**Combat UX & Flow Polish Queue (V8.41 — post-Day-23):**
- Hit vs miss visual differentiation in story feed (different prefix glyph + dimmer color for misses).
- Miss feedback over portrait (small white "0" or "—" floating number).
- Combat flow pacing for flee-fail → death sequence (explicit pause + visual marker).

**Day 20.5 — Verbal Action (deferred to last):** Chat input hijack with LLM judging + charisma check + status_effects.

**CSS containment future candidates (V8.40-V8.41 audit, address when those features get touched):** PortraitSlot status badges, StoryFeed inline tooltips, TradeModal +/- gold floats, GameLayout mobile rail tooltips, WorldMap edge tooltips. See `/docs/css-containment-audit.md`.

**Other deferred:** Map visual rework, RTL component test infra, pacing tuning watchpoint, world-gen perf, NPC color overlap, hub codex, grid_position, behavior dispatch, toSlug bug, combat balance pre-Day-21/22.

---

## 🏗️ Architecture

### The Two Domains ✅
**Domain 1 (Engine — pure code):** Navigation, stat checks, dialogue option generation, combat resolver + turn loop + triggers (V8.32), region expansion guard (V8.33), combat UI + narrator + bestiary (V8.34), separators + pacing + starting equipment (V8.35), initiative kickoff + inventory stats (V8.36), resolution banners + suppression (V8.37), roll detail + inline suffix + floating damage + defeat resilience + destination messaging (V8.38), routing hardening + settlement detection canonical-only + inventory Use combat path (V8.39), CSS containment fix + float stagger + emission synced to feed + codex modal + D&D roll display (V8.40), nav-cards module + tier colors + cross-region BACK trail awareness + map tier auto-switch (V8.41), loot resolver (Day 21).
**Domain 2 (Content Library — frozen):** WCD, locations, NPCs, items, loot tables, main quest, bestiary, region enemies, starting equipment loadouts.

### Generation Model ✅
RegionBible: haiku-4-5, max_tokens 7000. WorldBible: sonnet-4-5, max_tokens 10000. WCD includes `world_description`. Combat narrator: sonnet-4-5.

### Map System ✅
Genre renderers active. PAD=76. Tier switcher. Initial tier on mount: Local (V8.30). Cross-region arrival forces tier=2 Region (V8.41). ⚠️ Visual rework still pending dedicated session.

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
65. **Settlement-hub detection in step 7c-2 uses `is_settlement_node === true` predicate ONLY.** Category fallback was a Day 20.1 defensive overcheck that misrouted region zones. **Foundational lesson: defensive overchecks alongside canonical fields can become positive bugs.** (V8.39)
66. Floating damage emission lives INSIDE `projectCombatEventsToFeed` (useCombat), called AFTER pacing sleeps so visible float pops at the same instant as its matching feed line. CombatMode is a pure renderer for the `floatingByActor` prop. (V8.40)
67. Multi-host floating damage uses `computeFloatStartDelay` pure helper. 300ms increments when entries land on same host within window. `animation-fill-mode: both` so 0% keyframe holds during delay. (V8.40)
68. Roll display format is D&D-style with explicit modifier math: `(d20: 17, +2 → 19 vs 12 | 1d6+2)` for hits, `(d20: 1)` for fumbles (skip mod), `(d20: 20 | 6 (max) + 3 (1d6) + 2)` for crits (skip vs DC), `(1d8: 4 +4 = 8)` for heals. (V8.40)
69. Codex is rendered as `CodexModal` overlay (z-50, ESC + backdrop + X close) toggled by `codexModalOpen` in game store. Combat panel remains mounted underneath. `/game/codex` route preserved for direct URL access. (V8.40)
70. **CSS containment lesson: absolutely-positioned children CAN be clipped by ancestor `overflow-x: auto` or `overflow-y: auto`.** Per W3C spec, setting either overflow axis to a non-`visible` value promotes the OTHER axis to `auto`. Any container hosting absolutely-positioned children needs explicit `overflow: visible` if children extend outside the box. (V8.40)
71. **Integration tests required for routing helpers and lookup keys.** Unit tests against fake events can pass while real-data wiring is broken. Routing points need integration tests against real combat-resolver / engine / data sources. (V8.40)
72. Nav cards group by movement direction into 4 rows: BACK / DEEPER / PEER / UNDISCOVERED. EXIT folds into BACK at the grouping step. Empty groups omitted. Pure-function `lib/game/nav-cards.ts` owns `buildCards` + `groupCardsByDirection`. Italic-serif row labels render only when row has cards. (V8.41)
73. Nav card tier color via `tierOfNode` predicate. Applies to border, leading arrow, title, badge border. Region → `--hl-region` lavender. Settlement → `--hl-loc` sky-blue. Sub-location → `--hl-sublocation` mint (NEW V8.41). Dungeon → `--hl-dungeon` burnt-copper (NEW V8.41). Background stays neutral. (V8.41)
74. Cross-region BACK card consults `masterState.navigation_trail[-2]` (V8.32 infrastructure). If previous node resolves to a different region, BACK card targets that region's settlement hub instead of the new region's unvisited settlement. Surfaces correctly in NavigationBar via `buildCards` output. (V8.41)
75. WorldMap forces map tier=2 (Region) on cross-region arrival via useEffect. Same-region moves leave tier alone — preserves manual tier choice. Combines with rule 21 (initial Local tier on mount) for full tier-switching behavior. (V8.41)
76. **Origin/main baseline check (V8.41):** Claude Code MUST run `git fetch origin && git log origin/main --oneline -5` as the first step of every prompt to verify working state matches origin HEAD. Polish Round 4a surfaced a 28-commit drift between local branch and origin/main. This 2-second check prevents wasted-work re-baselines. (V8.41 workflow rule)

---

## Narrator Prompt Order ✅

DIALOGUE: WCD → HARD RULES → RESPONDING CHARACTER → CLOSED CONTEXT → TIER 1 OBJECTS → WORLD ASSETS → SCENE → VERBOSITY
non-DIALOGUE: WCD → HARD RULES → NPCS PRESENT → TIER 1 OBJECTS → CONNECTED LOCATIONS → WORLD ASSETS → SCENE → VERBOSITY
COMBAT: GENRE TONE PRIMER → COMBAT EVENT (mechanical truth) → HARD RULES → length hint per event tier (resolutions ≤20 words, crit/kill 2-3 sentences)

---

## Story Feed Colors ✅
```
Narrator prose:        var(--ink-1)
NPC quoted speech:     #f4e8c8 brighter cream (V8.41), italic, weight 600 (--hl-said)
Player actions:        #7ab8c8 teal-blue, 12px mono italic (out-of-combat)
Item highlights:       #e8c547 yellow (--hl-item)
Region highlights:     #c4b5fd lavender (--hl-region)
Location highlights:   #7dd3fc sky blue (--hl-loc)
Sub-location:          #94d8b8 soft mint (--hl-sublocation NEW V8.41)
Dungeon:               #b45309 burnt copper (--hl-dungeon NEW V8.41)
Landmark highlights:   #94d8b8 soft mint (--hl-landmark)
NPC highlights:        var(--accent) orange

COMBAT colors and elements unchanged from V8.40 (rules 38-71).
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
**Origin/main baseline check (V8.41):** Claude Code runs `git fetch origin && git log origin/main --oneline -5` as step 1 of every prompt.
**Investigation-before-patching (V8.40):** When Claude.ai writes a prompt with a hypothesized root cause, Claude Code investigates and validates/invalidates the hypothesis BEFORE patching.
**All architecture decisions defer to /docs/architecture-spec.md.**
**All combat decisions defer to /docs/combat-spec.md.**
**All vision/scope decisions defer to 🎮 Game Vision section above.**
**All strategic / sequencing decisions captured in 📋 Strategic Trajectory Notes section above.**

---

*Last updated: V8.41 — Polish Round 4a (commit 24ac19c, 297/297 tests, /game stable): movement-direction grouped nav cards (BACK/DEEPER/PEER/UNDISCOVERED rows via pure-function nav-cards.ts module, EXIT folds into BACK, empty groups omitted) + tier color-coding (--hl-sublocation + --hl-dungeon new tokens, applied to border/arrow/title/badge) + cross-region BACK card uses navigation_trail[-2] from V8.32 infrastructure + WorldMap forces tier=2 Region on cross-region arrival + .ew-said brightened #e8d5b0 → #f4e8c8 + CSS containment audit doc (0 active risks, 5 future candidates flagged). Foundational rules 72-76 added including origin/main baseline check workflow rule (responding to V8.41 baseline-drift incident). Combat UX & Flow Polish queue captured for post-Day-23 (hit/miss differentiation, miss float, flee-fail pacing). Polish Round 4b (mobile-viewport QA pass) is NEXT.*
