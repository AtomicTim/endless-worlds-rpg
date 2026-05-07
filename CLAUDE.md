# Project: Endless Worlds RPG — Master Context

**Version:** 8.17
**Status:** Active Development — Map Bug Fixes Complete, Bug 2 Investigation Active
**Objective:** A text-based RPG that generates a unique world for every playthrough. Genre-agnostic, infinitely replayable, CRPG depth.

**Reference:** /docs/architecture-spec.md — The definitive source for all Domain 1 vs Domain 2 decisions.

---

## 🔄 Current Status (Read This First)

**Current Phase:** Bug 2 investigation (zone_id corruption) → architecture hardening → genre renderers → Combat
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
| Regional Zone Traversal + Polish | Exit button, region zone, navigation | ✅ Complete |
| Session 84 Bug Fixes | 7 map/nav fixes + Bug 2 diagnostics | ✅ Complete |
| Bug 2 Investigation | zone_id corruption — logs needed | ⏳ Active |
| Architecture Hardening | Domain 1/2 separation, caching, gate | ⏳ Pending |
| Genre renderers restored | After architecture confirmed | ⏳ Pending |
| 20 | Combat System | ⏳ Pending |

**Active genres:** Fantasy, Cyberpunk, Horror/Lovecraftian, Space Opera, Post-Apocalyptic
**⚠️ Noir has been removed.**

### Session 84 Bug Fixes (commit 0c65a6d — 43/43 tests, clean build)

**Fix 1 (Bug 5):** handleSelectNode + handleSelectExit early-return when nodeId === current_node_id. navigateTo defensive guard. DebugMap suppresses cursor/click on isCurrent nodes.

**Fix 2 (Bug 1):** buildLocalTier fallback gated on `is_settlement_node === true` + zone_id filter (own children only). isAtNonSettlementZone flag disables LOCAL tab for dungeons/wilderness. buildRendererPayload Tier 3 redirects to buildRegionTier for both region zones and non-settlement zones.

**Fix 3 (Bug 3):** buildLocationInfo new branches: `REGION · N EXITS` panel for region zones, category-typed panel for standalone zones — both fire before the Tier 3 fallthrough.

**Fix 4 (Bug 6):** chooseInitialTier: geographic region zone returns Tier 2, not Tier 3.

**Fix 5 (Bug 8):** NavigationBar connection loop skips `id === current.id` and `id === current_node_id` defensively.

**Fix 6 (Bug 4):** PAD 60 → 76 in WorldMap.tsx, types.ts, DebugMap.tsx.

**Fix 7 (Bug 7):** Module-level lastArrivalNodeId ref in useGameLoop.ts. Duplicate ◆ NAME section headers suppressed when target === previously emitted arrival node.

**Fix 8 (Bug 2 diagnostic):** Logging added to apply-regional-bible (zone_id assignment), regional-bible-cache (READ/WRITE with keys), useGameLoop (RegionBible expansion target).

### Bug 2 — zone_id corruption (UNDER INVESTIGATION)
**Symptom:** Nodes in a newly-generated region get zone_id pointing at the wrong region. Region map for newly-discovered areas shows incorrect parent. Dungeon connections point to correct region but zone_id points elsewhere.

**Root cause candidates:**
1. `regional-bible-cache.ts` cache key mismatch — cache key might use origin region ID instead of destination region ID, causing stale bible hit
2. `matchedOutline.id` in useGameLoop.ts diverges from `bible.id` in the cached entry, causing zone_id to be stamped with wrong region

**To diagnose:** Generate a fresh world → travel to the region zone → navigate to an adjacent region → paste the `[apply-regional-bible]`, `[RegionBibleCache]`, and `[navigateTo]` server console logs here.

**Fix NOT yet written** — needs log analysis first.

### Known issues (shelved — address after Bug 2 + architecture hardening)
- Duplicate codex writes: two paths (7b + 7c-1) fire for same location (Bug 9)
- Arrival asset queries fire repeatedly without cache (Bug 10 / Architecture item A)
- React key-prop-spread warnings in LocationSpan/ItemSpan/NpcSpan

---

## 🏗️ Architecture

### The Two Domains (Must Never Touch)
**Domain 1 (Engine — pure code):** World graph, player state, combat, quests, map, navigation, dialogue option generation, stat checks, container registry, loot resolution. AI cannot touch it.

**Domain 2 (Content Library — frozen after generation):** WCD, locations, NPCs, items, loot tables, main quest, region outlines. Once frozen, never changed by AI.

### AI During Gameplay (Narration Only)
1. Location arrival description — first visit only, cached permanently after (pending architecture hardening)
2. NPC dialogue responses — closed context, code determines topic + check result
3. Action narration — 1-4 sentences, cached after first examine
4. Container search narration — 1 sentence only when item found
5. Region zone arrival — first visit only, cached

### Pending Architecture Items (after Bug 2 fixed)

**A — Location arrival descriptions cached permanently**
Write result to world_assets on first visit, serve cached on re-visit. No AI call on re-visit.

**B — Free text validation gate**
NPC not at current location → hardcoded "[Name] isn't here" (other gates already done).

**C — Dialogue options generated by code from NPC knowledge array**
Option B confirmed: WorldBible generates `{topic, content}` pairs. Code builds option list. AI writes response text only.

### Navigation Model ✅
```
Text MOVE → hardcoded — ZERO AI CALL
Travel flow:
  Sub-location → Return card → Settlement hub
  Settlement hub → ↑ EXIT TO [REGION] button → Region zone
  Region zone → nav cards / region map clicks → standalones / settlement / adjacent
  Adjacent region → RegionBible expansion → new settlement
World map: informational only.
```

### Map System ✅
```
PAD=76. COORDINATE SYSTEM: Hub {0,0}, sub-locations ±5, region_locations 8-15, adjacent 18-35.

TIER DEFINITIONS:
  Local  = hub + sub_locations (BFS). Disabled at region zones AND non-settlement zones.
  Region = settlement + region_locations. Redirected to for region zones + standalone zones.
  World  = is_expandable only. Informational.

Current node: unclickable everywhere (handleSelectNode, handleSelectExit, navigateTo guards).
Local tab: disabled when isAtRegionZone OR isAtNonSettlementZone.
Section headers: deduplicated via lastArrivalNodeId ref.
DEBUG MODE ACTIVE in index.tsx. TO RESTORE: uncomment pickModule dispatcher.
```

### Geographic Hierarchy ✅
```
World
└── Geographic Region (is_expandable=true, persistent explorable zone)
    ├── Settlement (is_settlement_node=true)
    │   └── Sub-location (type=sub_location)
    ├── Standalone location (type=zone, is_expandable=false) — dungeon/wilderness
    │   └── No sub-locations yet (dungeon levels planned for Container+Loot phase)
    └── Adjacent regions (is_expandable=true, undiscovered)
```

### Generation Model ✅
Zone 1: Concrete. Zone 2: Outlined. Zone 3: Name+position.
RegionBible: claude-haiku-4-5-20251001, 1200 tokens.
WorldBible: claude-sonnet-4-5, 8000 tokens.

---

## ⚡ FOUNDATIONAL RULES

1. World Assets Are Permanent. Write-once.
2. Navigation Is UI-Only. Text MOVE → hardcoded.
3. Location Is Authoritative State. current_node_id on navigateTo.
4. Actions Permitted By Default. Tier 1→AI. Tier 2→template. Tier 3→ambient.
5. Objects Mentioned Exist. Failed checks = evasion, never absence.
6. Dialogue Consistent. Failed check = no info. Trade = no check.
7. AI Three Roles Only. Generator → Bridge → Thread.
8. WCD Is Absolute Law.
9. Failed Checks = Evasion Only.
10. Highlights Are Exact Tier 1 Matches.

---

## Narrator Prompt Order ✅

DIALOGUE: WCD → HARD RULES → RESPONDING CHARACTER → TIER 1 OBJECTS → WORLD ASSETS → SCENE → VERBOSITY
non-DIALOGUE: WCD → HARD RULES → NPCS PRESENT → TIER 1 OBJECTS → CONNECTED LOCATIONS → WORLD ASSETS → SCENE → VERBOSITY

Verbosity: terse (2/3/4 sentences ≤12 words) | standard (3-4/4-5/5-7) | rich (5-7/6-8/8-12)

---

## Planned Systems

| System | When | Description |
| --- | --- | --- |
| Bug 2 Fix | NOW | zone_id corruption — after log analysis |
| Architecture Hardening | After Bug 2 | Arrival caching, NPC gate, code-gen dialogue options |
| Genre renderers restored | After arch | Uncomment pickModule in index.tsx |
| Codex dedup fix | After arch | Two-path duplicate write cleanup |
| Combat System | Day 20 | Turn-based, code resolves, AI narrates |
| Container + Loot | Day 21 | Registry, loot tables, dungeon sub-levels |
| Skills + Leveling | Day 22 | XP, stat points, level gates |
| Main Quest Thread | Day 23 | Breadcrumb injection, quest tracking |
| Random Events | After combat | Region zone + travel encounters |

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
Claude Code pushes → git pull + restart → report → confirm → next prompt.
**All architecture decisions defer to /docs/architecture-spec.md.**

---

*Last updated: Session 84 — V8.17: 7 map/nav fixes (current node no-op, local fallback settlement-only, region zone label, chooseInitialTier, nav self-loop, PAD=76, duplicate header guard). Bug 2 diagnostic logging active — needs server log analysis before fix.*
