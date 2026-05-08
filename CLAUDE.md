# Project: Endless Worlds RPG — Master Context

**Version:** 8.30
**Status:** Active Development — Movement Track Frozen, Combat System Next
**Objective:** A text-based RPG that generates a unique world for every playthrough. Genre-agnostic, infinitely replayable, CRPG depth.

**Reference:** /docs/architecture-spec.md — The definitive source for all Domain 1 vs Domain 2 decisions.

---

## 🔄 Current Status (Read This First)

**Current Phase:** Movement track is functional end-to-end (multi-region travel, descriptions, dialogue, cache pipeline all working). Three minor polish items deferred to bundle with combat work. → combat system (Day 20).
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
| **Movement Track** | **Verified end-to-end through multi-region playtest** | ✅ **FROZEN — minor polish bundled into combat round** |
| 20 | Combat System | ⏳ Next |
| Map Visual Rework | Dedicated session | ⏳ Deferred (post-combat) |
| 21 | Container + Loot | ⏳ Pending |
| 22 | Skills + Leveling | ⏳ Pending |
| 23 | Main Quest Thread | ⏳ Pending |

**Active genres:** Fantasy, Cyberpunk, Horror/Lovecraftian, Space Opera, Post-Apocalyptic
**⚠️ Noir removed. Genre renderers restored (pickModule re-enabled).**

### Region / Resilience Round (commit 87c89a3 — 43/43 tests, clean build)

**Fix 1 — Region tier description resolves from parent region for any node:**
- `lib/game/codex.ts` — `getWorldAssetsForLocation` now accepts an optional `parentRegionId`. The filter includes assets whose `first_seen_location === parentRegionId`, so the geographic region zone asset (e.g. `location_the_rustveil_commons`) is pulled into `locationAssets` even when the player is at a settlement hub or sub-location.
- `app/game/page.tsx` + `hooks/useGameLoop.ts` — both call sites that load assets on arrival now compute the root zone id by walking the `zone_id` chain and pass it as `parentRegionId`.
- `WorldMap.tsx::firstAtmosphere` already looked up by `a.id === "location_${regionId}"` — now the asset is actually present in `locationAssets` for it to find. Region tier description renders from any node in the region, not just from the region zone itself.

**Fix 2 — Map defaults to Local tier on startup:**
- `WorldMap.tsx::chooseInitialTier()` — final return value flipped from `2` (Region) → `3` (Local). Region zones keep the `2` default since LOCAL view doesn't apply there. Everything else (settlement hubs, dungeons, sub-locations) opens on Local tier.
- User's manual tier choice is not overridden mid-session.

**Fix 3 — Landmark highlight color distinct from region:**
- `app/globals.css` — `--hl-landmark` flipped from `#c4b5fd` (lavender, same as regions) → `#94d8b8` (soft mint).
- Region names = lavender, WCD landmarks = soft mint. Visually distinct at a glance.

**Fix 4 — New region lists origin region as adjacent travelable:**
- `apply-regional-bible/route.ts` — before creating the new region zone node, resolves `originRegionZoneId` by walking the zone chain of `originNodeId`. Adds it to `regionConnections` (new region → origin). Step 6 also adds the new region zone to the origin's connections (origin → new region, supports 3rd-region depth).
- `NavigationBar.tsx` D2 branch — when at the starting region uses `wb.adjacent_regions` (unchanged from V8.29). When at an expanded region, reads `current.connections` and lists any `is_expandable=true, zone_id=self` nodes as peer cards — picks up the origin region zone wired in by the route fix above.
- Symmetric region travel: forward AND back work from any region, including the third hop.

**Fix 5 — RegionBible stub fallback on JSON parse failure:**
- `generate-regional-bible/route.ts` — `max_tokens` 3500 → 6000 to reduce truncation rate. Prompt includes "Keep total response under 5000 tokens. Be concise." directive.
- On double-parse-failure: returns `200 { bible: stubBible, stub: true }` with a minimal but valid RegionBible (hub + tavern + 1 NPC + back-exit) instead of 500. Console logs `[RegionBible] Returning stub fallback` warning for observability.
- Player can always traverse into a region. Sparse content is better than a hard wall.

### Polish Round (commit b7032f9 — 43/43 tests, clean build)

**Fix 1 — Tier-aware highlight colors (region vs location):**
- New `--hl-region: #c4b5fd` token + `.ew-link-region` CSS rule.
- New `RegionSpan` component in `components/game/StoryComponents.tsx:135-141` (mirror of LocationSpan with the lavender token).
- `HighlightCandidate` / `HighlightMatch` types carry `isRegion` flag. `lib/game/highlights.ts:90-159` flags every region-tier graph node + every WorldBible adjacent region, so region names highlight even when the player is far from them.
- `components/game/StoryFeed.tsx:422-451` branches LOCATION → RegionSpan when `isRegion === true`.
- Region names like "The Drift Barrens" now render lavender; sub-locations like "Carrion Anchorage" stay sky-blue. Both navigate via existing display-name → id resolver.

**Fix 2 — NPC quoted speech in warm cream italic, weight 600:**
- `--hl-said: #e8d5b0` defined explicitly at `:root` (was an inline fallback before).
- `.ew-said` weight bumped 500 → 600 so quoted speech reads clearly distinct from surrounding ink-2 narrator prose in `NPCSpeech` bodies.
- Resolves the regression where Morrow Kellsix-style dialogue read identically to narrator prose.

**Fix 3 — Region zone retains adjacent-region cards on return:**
- NavigationBar D2 branch dropped the `current.connections.includes(r.id)` filter — apply-regional-bible's step 6 strips that link after expansion, which was causing already-expanded regions to disappear from the card list.
- Now iterates every `world_bible.adjacent_regions` entry, skips self, classifies by graph state: discovered → `◆ peer-known REGION`; absent or undiscovered → `◇ peer-unknown UNDISCOVERED REGION`.
- `navigateTo`'s `isUndiscoveredRegion` tightened to require either no graph node or an expandable-but-undiscovered placeholder. The "Venturing into unknown territory..." message no longer fires on every return visit to an already-expanded region.

**Fix 4 — React key-prop-spread warning silenced:**
- `components/game/StoryFeed.tsx:422-451` separates `key` from the rest of props before the JSX spread, killing the React `"key prop being spread into JSX"` console warning on every story feed render.
- Cosmetic only — no behavior change. Console is now clean of span-render warnings.

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
  Region zone    → ← back + ◆ known + ◇ undiscovered + adjacent regions (V8.29)
  Dungeon        → ← back to region zone ONLY
  New region     → lands at region zone (not settlement hub)

Region zone D2 card builder:
- At starting region: iterates wb.adjacent_regions
- At expanded region: reads current.connections, lists is_expandable
  zone_id=self nodes as peer cards (V8.30)
- Forward AND back direction symmetric across any region depth
```

### Map Description Sourcing ✅ (V8.27, hardened V8.28, generalized V8.30)
```
World tier  → wcd.world_description (2-3 sentence world summary, never changes)
Region tier → currentRegion.atmosphere (region-specific prose)
              Resolved from parent region zone asset for ANY node
              within that region (not just from the region zone)
              via parentRegionId chain walk (V8.30).
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

Map tier default on mount: Local for non-region-zone nodes, Region
for region zone nodes (V8.30). User's manual tier choice not
overridden mid-session.

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

NPC quoted speech: rendered via .ew-said class — #e8d5b0 warm cream,
italic, weight 600 (V8.29). Pending higher-contrast pass — see
"Wrap-up Polish" in Known Issues.
```

### RegionBible Resilience ✅ (V8.30)
```
Model: claude-haiku-4-5-20251001
max_tokens: 6000 (bumped from 3500)
Prompt: includes "Keep total response under 5000 tokens. Be concise."

Failure modes:
- First parse fail → retry once
- Retry parse fail → return 200 with stub bible (hub + tavern + 1 NPC
  + back-exit). Player can still traverse. Console warns
  [RegionBible] Returning stub fallback for observability.

Player is never blocked from traversal by an LLM JSON malformation.
```

### Known issues

**Wrap-up Polish (bundle into Combat round or post-combat polish round):**
These are minor visual/UX issues identified in the V8.30 multi-region playtest. Movement is functional with these in place — they don't block combat work and can be cleaned up alongside the Combat round at minimal extra cost.

- **Settlement hub card on new region arrival reads as back-from-settlement.** When player arrives at a new region zone via expansion, the nav card pointing to the settlement hub renders with the same visual treatment as a "you just came from here" card. Functionally works (clicks land correctly at the hub), but visually misleading on a fresh region. Likely a card-typing issue in NavigationBar's region-zone D2 branch — needs to distinguish "settlement hub of CURRENT region" (deeper-into card) from "place player just left" (back card).
- **Map does not auto-switch tiers on cross-region arrival.** V8.30 Fix 2 set the initial-mount tier default but does not re-apply on arrival at a new region zone or new settlement hub. Should auto-flip to the appropriate tier on each cross-zone arrival, while still respecting in-session manual tier choices for same-zone navigation.
- **NPC dialogue text needs higher contrast.** Current `.ew-said` (#e8d5b0 warm cream, italic, weight 600 from V8.29) doesn't read distinctly enough from surrounding ink-2 narrator prose in playtest. Pick a more contrasting color or add a subtle background tint / left-border accent to make NPC speech pop visually.

**Map visual rework (dedicated session, post-combat):**
- Per-node decorative shelf line under every node (visible under both discovered and undiscovered) — looks like an underline but is a separate SVG element. Cleanup needed across all renderers.
- Connection lines pass through node icons instead of terminating at icon edges — endpoint geometry / z-order issue.
- Overall sizing and visual hierarchy still feels cramped relative to panel size even after V8.27 bumps.
- Map label collision: World/Region tier labels overlap visibly when nodes are close together. Needs label placement / collision avoidance pass.
- Whole-renderer redesign needed: decoration cleanup, line-endpoint geometry, sizing pass, current-node emphasis, label collision.

**Other deferred:**
- NPC highlight color (orange) too similar to item highlight (yellow) in Fantasy
- Hub node not added to codex on first arrival to new region
- Step 7 individual branches: confirm each branch sets `discovered: true` (currently relying on Fix 2 safety net)
- Starting region nodes consistently lack `grid_position` — currently masked by V8.28 isValidPos guard with `console.warn`. Worth investigating data path at world generation eventually so the warn stops firing on every new region apply.

---

## 🏗️ Architecture

### The Two Domains ✅
**Domain 1 (Engine — pure code):** Navigation, stat checks, dialogue option generation, combat (pending), loot resolution (pending).
**Domain 2 (Content Library — frozen):** WCD, locations, NPCs, items, loot tables, main quest.

### Generation Model ✅
RegionBible: claude-haiku-4-5-20251001, max_tokens: 6000 (V8.30). Stub fallback on double-parse-failure.
WorldBible: claude-sonnet-4-5, 8000 tokens.
WCD now includes `world_description` (2-3 sentence world summary).
Knowledge format: `{topic, content}` pairs. Legacy string → auto-converted.
Region zone assets: constitution.physical_description AND constitution.atmosphere both populated from same source (V8.28).

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

Underline strip: textDecoration="none" + style on every <text> across
all renderers (V8.27).

Collision check on apply-regional-bible: isValidPos guards prevent
NPE from malformed grid_position entries (V8.28).

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
11. Highlight clicks resolve display-name → node id before navigateTo. Never pass display names. (V8.26)
12. Every successful arrival flips `discovered = true` at end of step 7. (V8.26)
13. Cache hit on ARRIVING synthesizes a `narratorResponse` and falls through. AI API bypassed; downstream pipeline (current_node_id update, panel/nav/map refresh, codex, log, persist) runs unchanged. (V8.27 — supersedes V8.26 mini-pipeline approach)
14. Map description sourcing: World = `wcd.world_description`, Region = `currentRegion.atmosphere`, Local = `currentLocation.atmosphere`. No cross-tier bleed. (V8.27)
15. Region zone assets always populate both `constitution.physical_description` AND `constitution.atmosphere` from the same source prose. WorldMap prefers whichever has trimmed content. (V8.28)
16. Collision-check loops over expandable node positions must guard each entry with `isValidPos`. Malformed entries are skipped + warned, never dereferenced. (V8.28)
17. Story feed location highlights are tier-aware: region-tier names use `--hl-region` (lavender), settlement/sub-location names use `--hl-loc` (sky-blue), WCD landmarks use `--hl-landmark` (mint). HighlightCandidate carries `isRegion` flag. (V8.29, V8.30 mint landmarks)
18. Region zone D2 card builder iterates every `world_bible.adjacent_regions` at the starting region; at expanded regions, reads `current.connections` for is_expandable peer-region nodes. Already-expanded regions stay travelable, including back to origin. (V8.29 + V8.30)
19. Span dispatch in StoryFeed separates `key` from spread props before JSX. Never spread an object containing `key` into a component. (V8.29)
20. Region tier description resolves from parent region zone asset for any node in that region. `getWorldAssetsForLocation` accepts `parentRegionId` so the asset is in scope regardless of player position within the region. (V8.30)
21. Map tier defaults to Local on initial mount for any non-region-zone node. Region zone nodes default to Region tier. User's manual tier choice never overridden mid-session. (V8.30)
22. New region creation always wires the origin region into the new region's connections AND vice versa, so adjacent-region travel is symmetric across any region depth. (V8.30)
23. RegionBible parse failure must never block the player. Double-parse-failure returns 200 with a stub bible (hub + tavern + 1 NPC + back-exit) and a console warning. (V8.30)

---

## Narrator Prompt Order ✅

DIALOGUE: WCD → HARD RULES → RESPONDING CHARACTER → CLOSED CONTEXT (selected knowledge) → TIER 1 OBJECTS → WORLD ASSETS → SCENE → VERBOSITY
non-DIALOGUE: WCD → HARD RULES → NPCS PRESENT → TIER 1 OBJECTS → CONNECTED LOCATIONS → WORLD ASSETS → SCENE → VERBOSITY

Region zone: inject settlement hub (labeled "settlement") + region_locations with compass direction.
Verbosity: terse | standard | rich

---

## Story Feed Colors ✅
```
Narrator prose:        var(--ink-1)
NPC quoted speech:     #e8d5b0 warm cream, italic, weight 600 (--hl-said)
                       — pending higher-contrast pass per V8.30 playtest
Player actions:        #7ab8c8 teal-blue, 12px mono italic
Item highlights:       #e8c547 yellow (--hl-item)
Region highlights:     #c4b5fd lavender (--hl-region)  — Tier 2 / region zones
Location highlights:   #7dd3fc sky blue (--hl-loc)     — Tier 3 settlements/sub-locations
Landmark highlights:   #94d8b8 soft mint (--hl-landmark) — WCD-known landmarks (V8.30)
NPC highlights:        var(--accent) orange (too similar to item yellow — future fix)
```

---

## Planned Systems

| System | When | Description |
| --- | --- | --- |
| Combat System | NOW (Day 20) | Turn-based, code resolves, AI narrates. Bundle Wrap-up Polish (3 items). |
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

---

*Last updated: V8.30 — Movement track frozen after end-to-end multi-region playtest. Three minor polish items (settlement card label on new region arrival, tier auto-switch on cross-zone arrival, NPC dialogue contrast bump) deferred to bundle with Combat round. Combat system (Day 20) up next.*
