# Project: Endless Worlds RPG — Master Context

**Version:** 8.28
**Status:** Active Development — Regional Travel + Region Description Fixes Complete, Map Visual Rework Deferred, Combat System Next
**Objective:** A text-based RPG that generates a unique world for every playthrough. Genre-agnostic, infinitely replayable, CRPG depth.

**Reference:** /docs/architecture-spec.md — The definitive source for all Domain 1 vs Domain 2 decisions.

---

## 🔄 Current Status (Read This First)

**Current Phase:** Targeted bug fixes complete → combat system (Day 20). Map visual rework queued for dedicated session post-combat.
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
| 20 | Combat System | ⏳ Next |
| Map Visual Rework | Dedicated session | ⏳ Deferred (post-combat) |
| 21 | Container + Loot | ⏳ Pending |
| 22 | Skills + Leveling | ⏳ Pending |
| 23 | Main Quest Thread | ⏳ Pending |

**Active genres:** Fantasy, Cyberpunk, Horror/Lovecraftian, Space Opera, Post-Apocalyptic
**⚠️ Noir removed. Genre renderers restored (pickModule re-enabled).**

### Targeted Fix Round (commit dc5bcd8 — 43/43 tests, clean build)

**Fix 1 — apply-regional-bible 500 (collision-check NPE):**
`apply-regional-bible/route.ts:507-606` — Added `isValidPos` type guard at three points so the world-map overlap nudge can never dereference `.x` on an undefined entry:
1. Gather time — skip and `console.warn` any expandable node missing a numeric x/y.
2. Inside `hasConflict` — defensive return-false on either side of the comparison.
3. `bibleNarrowed.grid_centre` — fall back to `{0,0}` (logged) if malformed.

Unblocks all new-region travel. Stack trace was `TypeError: Cannot read properties of undefined (reading 'x')` at line 450 — root cause was an expandable node with missing grid_position making it into the collision iterator.

**Fix 2 — Region zone description populates correctly (three layers):**
- `regionZoneToAsset` in `apply-world-bible/route.ts:144-173` and `apply-regional-bible/route.ts:142-172` now writes BOTH `constitution.physical_description` AND `constitution.atmosphere` from the same source prose.
- Region-zone upsert in both apply routes drops `ignoreDuplicates` so re-applied bibles refresh stale prose. Diagnostic logs (`atmosphereLen`, 80-char preview) make a blank panel traceable to either an empty `bible.atmosphere` or an upsert error.
- New single-tier branch in `apply-world-bible:693-738`: when `region.id === settlement.id`, step 3 was writing the settlement's interior-hub atmosphere into the shared asset — now overwrites with `starting_region.atmosphere` so the Region map shows landscape prose instead of "Outdoor hub description".
- `WorldMap.tsx::firstAtmosphere` now prefers whichever of `physical_description` / `atmosphere` has actual trimmed content, so legacy rows (only one populated) and future variants both resolve, and empty strings no longer render as a stray empty paragraph.

### Regression Fix Round (commit 75a7cd4 — 43/43 tests, clean build)

**Fix A1 — Cache hit preserves post-arrival pipeline:**
`useGameLoop.ts:1465-1511` — Replaced the prior early-return mini-pipeline with a synthesized `narratorResponse` object (cached text + empty arrays). Steps 5/6/7 run unchanged, so step 7-A's GRAPH_NAVIGATE branch updates `world_graph.current_node_id` — which NavigationBar, WorldMap, and the info panel all read. AI narrator API call still bypassed (Fix 6 goal preserved). The previous mini-pipeline's emit/discovered/codex/log/persist work is now handled by the existing pipeline naturally.

**Fix A2 — Sub-location nav cards back-to-hub only (auto-resolved by A1):**
NavigationBar's `buildCards` already restricts `isAtSubLocation` to back-only. The exit-to-region cards visible from sub-locations (Morrow's Provisions case) were a symptom of stale `world_graph.current_node_id` after cache-hit moves — A1's fall-through propagates the new current node id properly, so the existing card builder logic now sees the right state.

**Fix B1 — Map text and icons visually larger:**
All 5 genre renderers (Fantasy, Cyber, Space, Apoc, Horror) bumped to readable SVG-unit values: titles 11-15 → 16-22, subtitles 7-10 → 13, node labels 7-11 → 14-18, exit labels 7-10 → 14, undiscovered glyph radii enlarged proportionally. DebugMap unchanged.

**Fix B2 — `?` underline removed across all renderers and tiers:**
Every `<text>` element across every renderer (labels, exits, "?" glyph, undiscovered placeholders) now carries the SVG attribute `textDecoration="none"` AND `style={{ textDecoration: "none", textDecorationLine: "none" }}` to override any inherited underline regardless of which form the browser respects. Replaces the Fantasy-only fix from V8.26.

**Fix B3 — Description sourcing per map tier:**
- New optional field `world_description` in `types/game.ts:281-287` — 2-3 sentence world summary. `generate-wcd` prompt requests it; legacy saves fall back to `wcd.atmosphere`.
- Tier 1 (World) panel renders full `world_description` (no first-sentence extract).
- Tier 2 (Region) and Tier 3 (Local) on region zone drop the WCD fallback so world prose can't bleed into region/local panels.
- `components/game/WorldMap.tsx:1187-1202` — region zone description reads `constitution.physical_description` first (where `regionZoneToAsset` writes), then `atmosphere`.
- `components/game/WorldMap.tsx:807-820` — world tagline removed from subtitle, replaced with `<n> known · <n> rumored` summary count.

### Bug Fix Round (commit 57b0300 — 43/43 tests, clean build)

**Fix 1 — Highlight nav uses node id, not display name:**
`useGameLoop.ts:2832-2871` — `navigateTo(rawId)` resolves a display-name input to its canonical node id (via `graph.nodes` name match, then `adjacent_regions` fallback) before validating. Bails with a warning if nothing resolves. Eliminates the WORLD_EXPLORE mis-fire that occurred when story-feed highlights passed display names like "Rust-Watch Highlands" instead of ids like `rust_watch_highlands`.

**Fix 2 — Discovered flag safety net:**
`useGameLoop.ts:2036-2065` — Generic safety-net flip of `discovered = true` at the end of step 7's move dispatch. Every successful arrival ends with the destination marked discovered regardless of which branch handled the move. Backstop, not root cause — if `discovered: false` shows up later in saved state for clearly-visited nodes, individual step 7 branches are the suspect.

**Fix 3 — Section header on cross-node navigation:**
`useGameLoop.ts:2880-2887` — `navigateTo` resets `lastArrivalNodeId = null` whenever the requested nodeId differs from the current one. Same-node re-triggers stay suppressed (no duplicate ◈ headers), legit cross-node moves always emit a fresh header. Fixes the missing header on dungeon → region zone return.

**Fix 4 — Map text size pass (superseded by V8.27 Fix B1):**
Initial bump to 11/10/10 SVG-units was insufficient at the rendered viewBox scale. See V8.27 Fix B1 for final sizes.

**Fix 5 — Map "?" glyph underline removed (Fantasy only — superseded by V8.27 Fix B2):**
Initial fix only covered FantasyMap. See V8.27 Fix B2 for cross-renderer fix.

**Fix 6 — Cache hit skips arrival narrator (refined by V8.27 Fix A1):**
Original implementation used an early-return mini-pipeline that bypassed downstream state updates (broke current location panel, nav cards, map auto-switch). V8.27 Fix A1 retains the goal (zero narrator API call on cache hit) but lets the rest of the pipeline run.

### Architecture Hardening (commit 57d27f3 — 43/43 tests, clean build)

**Change 1 — Land at region zone after generation:**
`apply-regional-bible` computes `regionZoneId` and sets it as current node. `useGameLoop` step 4d uses `matchedOutline.id` as landing target. Settlement reachable via ← BACK from region zone.

**Change 2 — World map overlap fix:**
`apply-regional-bible` gathers existing is_expandable positions, runs 20-unit collision check, nudges by 12 (wrap at +80 → -40, y+=12) up to 50 iterations. (Hardened in V8.28 Fix 1 — see above.)

**Change 3 — Write-once arrival cache + codex dedup (Bug 9 fixed):**
Step 5 reads `physical_description` from world_asset before narrator call. On cache hit → synthesizes minimal narratorResponse, skips AI entirely. `codexWrittenBy7b` flag gates 7c-1 fallback — codex entry written exactly once per location.

**Change 4 — Code-built dialogue options:**
- Types: `DialogueOption.type|content`, `NPCKnowledgeItem`, `WorldAssetConstitution.knowledge[]`
- WorldBible + RegionBible prompts request `{topic, content}` knowledge pairs
- `apply-world-bible` + `apply-regional-bible` normalize knowledge array (legacy string fallback)
- `buildDialogueOptions()` in useGameLoop builds from NPC asset: knowledge topics + trade + free-type + farewell
- `CLOSED CONTEXT — SELECTED KNOWLEDGE` block in prompt-builder gives narrator exactly the selected knowledge item
- DialogueModal dispatches by option.type (trade/free/farewell/knowledge)
- AI no longer generates option list — only writes response text

**Change 5 — Genre renderers restored:**
`pickModule` dispatcher re-enabled in index.tsx. DebugMap import dropped. All 5 renderers (Fantasy/Cyber/Space/Apoc/Horror) compile cleanly.

### Architecture Status ✅
```
Domain 1 (Engine):     World graph, navigation, stat checks, dialogue option
                       generation, combat (pending), loot (pending) — pure code
Domain 2 (Content):    WCD, WorldBible, RegionBible, NPCs, items — frozen

AI during gameplay:
  ✅ Arrival narration  — first visit only, cached permanently after
  ✅ Dialogue options   — built by code, AI writes response only
  ✅ Action narration   — 1-4 sentences
  ✅ NPC not present    — hardcoded "X isn't here"
  ⏳ Container search  — pending Container+Loot system
```

### Navigation Rules ✅ (Complete)
```
Map = PURELY VISUAL. Genre renderers active. All navigation via nav bar.

Card grammar: [← BACK] [→ DEEPER...] [↑ EXIT] [◆ PEER...] [◇ UNDISCOVERED...]

Routing:
  Sub-location   → ← back to hub ONLY
  Settlement hub → → deeper + ↑ exit to region zone
  Region zone    → ← back + ◆ known + ◇ undiscovered
  Dungeon        → ← back to region zone ONLY
  New region     → lands at region zone (not settlement hub)
```

### Map Description Sourcing ✅ (V8.27, hardened V8.28)
```
World tier  → wcd.world_description (2-3 sentence world summary, never changes)
Region tier → currentRegion.atmosphere (region-specific prose)
Local tier  → currentLocation.atmosphere (location-specific prose)

Region zone asset:
  - constitution.physical_description AND constitution.atmosphere
    both written from same prose source (V8.28)
  - WorldMap firstAtmosphere prefers whichever has trimmed content
  - Legacy single-tier worlds (region.id === settlement.id):
    apply-world-bible overwrites step-3 settlement prose with
    starting_region.atmosphere so Region map shows landscape prose
    not interior-hub prose

Apply routes drop ignoreDuplicates on region-zone upserts so
re-applied bibles refresh stale prose (V8.28).

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
Legacy format: plain string → auto-converted to {topic: first-5-words, content: string}
```

### Known issues (deferred to post-combat / map visual rework)

**Map visual rework (dedicated session, post-combat):**
- Per-node decorative shelf line under every node (visible under both discovered and undiscovered) — looks like an underline but is a separate SVG element. Cleanup needed across all renderers.
- Connection lines pass through node icons instead of terminating at icon edges — endpoint geometry / z-order issue.
- Overall sizing and visual hierarchy still feels cramped relative to panel size even after V8.27 bumps.
- Whole-renderer redesign needed: decoration cleanup, line-endpoint geometry, sizing pass, current-node emphasis.

**Other deferred:**
- NPC highlight color (orange) too similar to item highlight (yellow) in Fantasy
- React key-prop-spread warnings in LocationSpan/ItemSpan/NpcSpan/LandmarkSpan
- Hub node not added to codex on first arrival to new region
- Step 7 individual branches: confirm each branch sets `discovered: true` (currently relying on Fix 2 safety net)

---

## 🏗️ Architecture

### The Two Domains ✅
**Domain 1 (Engine — pure code):** Navigation, stat checks, dialogue option generation, combat (pending), loot resolution (pending).
**Domain 2 (Content Library — frozen):** WCD, locations, NPCs, items, loot tables, main quest.

### Generation Model ✅
RegionBible: claude-haiku-4-5-20251001, max_tokens: 3500.
WorldBible: claude-sonnet-4-5, 8000 tokens.
WCD now includes `world_description` (2-3 sentence world summary).
Knowledge format: `{topic, content}` pairs. Legacy string → auto-converted.
Region zone assets: constitution.physical_description AND constitution.atmosphere both populated from same source (V8.28).

### Map System ✅
```
Genre renderers active (pickModule enabled).
PAD=76. Tier switcher. Current node highlighted.
World tier: tagline removed; subtitle = "<n> known · <n> rumored" (V8.27).
New region nodes: collision-checked, nudged if overlap.

Text sizes (V8.27):
  Titles    16-22 SVG units
  Subtitles 13
  Node labels 14-18
  Exit labels 14
  Undiscovered glyph radii enlarged proportionally

Underline strip: textDecoration="none" + style on every <text> across
all renderers (V8.27).

Collision check on apply-regional-bible: isValidPos guards prevent
NPE from malformed grid_position entries (V8.28).

⚠️ Map visual rework deferred to dedicated post-combat session.
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
11. Highlight clicks resolve display-name → node id before navigateTo. Never pass display names. (V8.26)
12. Every successful arrival flips `discovered = true` at end of step 7. (V8.26)
13. Cache hit on ARRIVING synthesizes a `narratorResponse` and falls through. AI API bypassed; downstream pipeline (current_node_id update, panel/nav/map refresh, codex, log, persist) runs unchanged. (V8.27 — supersedes V8.26 mini-pipeline approach)
14. Map description sourcing: World = `wcd.world_description`, Region = `currentRegion.atmosphere`, Local = `currentLocation.atmosphere`. No cross-tier bleed. (V8.27)
15. Region zone assets always populate both `constitution.physical_description` AND `constitution.atmosphere` from the same source prose. WorldMap prefers whichever has trimmed content. (V8.28)
16. Collision-check loops over expandable node positions must guard each entry with `isValidPos`. Malformed entries are skipped + warned, never dereferenced. (V8.28)

---

## Narrator Prompt Order ✅

DIALOGUE: WCD → HARD RULES → RESPONDING CHARACTER → CLOSED CONTEXT (selected knowledge) → TIER 1 OBJECTS → WORLD ASSETS → SCENE → VERBOSITY
non-DIALOGUE: WCD → HARD RULES → NPCS PRESENT → TIER 1 OBJECTS → CONNECTED LOCATIONS → WORLD ASSETS → SCENE → VERBOSITY

Region zone: inject settlement hub (labeled "settlement") + region_locations with compass direction.
Verbosity: terse | standard | rich

---

## Story Feed Colors ✅
```
Narrator prose:      var(--ink-1)
NPC quoted speech:   #e8d5b0 warm cream, italic
Player actions:      #7ab8c8 teal-blue, 12px mono italic
Item highlights:     #e8c547 yellow
Location highlights: #7dd3fc sky blue (underline intentional, retained)
NPC highlights:      var(--accent) orange (too similar to item yellow — future fix)
```

---

## Planned Systems

| System | When | Description |
| --- | --- | --- |
| Combat System | NOW (Day 20) | Turn-based, code resolves, AI narrates |
| Map Visual Rework | After combat | Dedicated session: decoration cleanup, line geometry, sizing, hierarchy |
| Container + Loot | Day 21 | Registry, loot tables, dungeon sub-levels |
| Skills + Leveling | Day 22 | XP, stat points, level gates |
| Main Quest Thread | Day 23 | Breadcrumb injection, quest tracking |
| Random Events | After combat | Region zone + travel encounters |
| Genre UI polish | Post-systems | NPC color, key-prop warnings |

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

---

*Last updated: V8.28 — Targeted fix round (commit dc5bcd8): apply-regional-bible 500 fixed via isValidPos guards on collision check, region zone description populates correctly across world bible + region bible apply paths (both physical_description and atmosphere fields written, single-tier overwrite, ignoreDuplicates dropped, WorldMap firstAtmosphere prefers populated field). Map visual rework queued for dedicated session post-combat. Combat system (Day 20) up next.*
