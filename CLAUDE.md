# Project: Endless Worlds RPG — Master Context

**Version:** 8.13
**Status:** Active Development — Map Debug Mode (Ready for Fresh World Verification)
**Objective:** A text-based RPG that generates a unique world for every playthrough. Genre-agnostic, infinitely replayable, CRPG depth.

**Reference:** /docs/architecture-spec.md — The definitive source for all Domain 1 vs Domain 2 decisions.

---

## 🔄 Current Status (Read This First)

**Current Phase:** Generate fresh world → verify all 3 debug tiers → restore genre renderers → Combat System
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
| Map Overhaul — Real Coordinates | fitToViewBox, skeleton fix, dedup | ✅ Complete |
| Map Debug Mode + Data Fixes | Grid renderer, tier fix, coordinate ranges | ✅ Complete |
| Genre renderers restored | Pending fresh-world debug verification | ⏳ Next |
| 20 | Combat System | ⏳ Pending |

**Active genres:** Fantasy, Cyberpunk, Horror/Lovecraftian, Space Opera, Post-Apocalyptic
**⚠️ Noir has been removed.**

### Latest commits

**b7a7d33 — Settlement is_expandable fix + wider coordinate ranges (86/86, clean build)**

Fix 1 — Settlement is_expandable=false (apply-world-bible/route.ts step 4a):
Settlement hub (`is_settlement_node=true`) now gets `is_expandable: false` instead of `true`. Previously `!is_interior=true` made the settlement appear on the World tier filter alongside geographic regions. Now only geographic region zone (step 4c) and adjacent regions (step 4d) carry `is_expandable: true`. Added console.log confirming resolved value per location.

Fix 2 — Wider coordinate ranges + anti-cardinal placement (generate-world-bible/route.ts):
- Sub-locations: `±2` → `±5` on both axes
- region_location: `2-4 units` → `8-15 units` from hub
- Adjacent regions: `5-10 units` → `18-35 units`
- Added CRITICAL paragraph forbidding cardinal cross patterns, demanding diagonal/varied offsets ({-3,1}, {2,-2}, {1,4}, {-4,-1})
- Skeleton examples updated to match new ranges and demonstrate anti-cardinal rule

**f271f33 — Debug map mode: raw coordinate grid, tier fix, undiscovered nodes, zone click guard, exit label distribution**

### Known issues (shelved — address after map confirmed)
- Duplicate codex writes: two paths (7b + 7c-1) fire for same location
- NPC codex written on arrival (before speaking)
- React key-prop-spread warnings in LocationSpan/ItemSpan/NpcSpan

---

## 🏗️ Architecture

### Map System — Current State
```
COORDINATE SYSTEM (shared world space, integers):
  Hub always at {0,0}. Sub-locations cluster ±5 of hub (organic/diagonal).
  Region landmarks 8-15 units out. Adjacent regions 18-35 units.
  No cardinal cross patterns. Frozen at WorldBible generation.

LAYOUT ENGINE: fitToViewBox()
  Reads actual map_position from WorldGraph nodes.
  Bounding box + MIN_RANGE=3 + linear scale to PAD=44 viewBox.
  Stable: same positions every render.

TIER DEFINITIONS:
  Local  = hub + sub_locations (BFS from hub, zone_id match)
  Region = is_settlement_node + region_locations
           (zone_id === regionId, id !== regionId)
  World  = is_expandable === true only (geographic regions only —
           settlement nodes now correctly excluded)

DEBUG MODE ACTIVE: index.tsx routes all to DebugMap.tsx
  Genre renderers preserved, dispatcher commented out.
  TO RESTORE: uncomment pickModule dispatcher in
  components/game/map/renderers/index.tsx
```

### The Two Domains
**Domain 1 (Engine):** World graph, player state, combat, quests, map, navigation, dialogue, stat checks.
**Domain 2 (Content Library):** WCD, locations, NPCs, items, loot tables. Frozen after generation.
**AI during gameplay:** Narration only. Never touches state.

### Geographic Hierarchy ✅
```
World
└── Geographic Region (is_expandable=true, Tier 1)
    ├── Settlement (is_settlement_node=true, is_expandable=false, Tier 2)
    │   └── Sub-location (type=sub_location, Tier 3, zone_id=settlement)
    ├── Standalone location (type=zone, is_expandable=false, Tier 2)
    │   └── Back-connection to settlement GUARANTEED
    └── Adjacent regions (is_expandable=true, undiscovered)
```

### Codex Rules ✅
- Location: step 7c-1 first ARRIVING (threshold ≥1), idempotent via codex_loc_{id}
- Location: step 7g NPC interaction takes priority
- NPC: first dialogue only
- Duplicate write issue: shelved, fix after map confirmed

### Navigation Model ✅
Text MOVE → hardcoded. navigateTo(nodeId) only.
NavigationBar: desktop=hidden, mobile=NavCard row.
Zone nodes (is_expandable=true): show info panel, do NOT navigate.

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
| Genre renderers restored | After map verified | Uncomment pickModule in index.tsx |
| Codex dedup fix | After map | Two-path duplicate write cleanup |
| Combat System | Day 20 | Turn-based, code resolves, AI narrates |
| Container + Loot | Day 21 | Registry, loot tables, search flow |
| Skills + Leveling | Day 22 | XP, stat points, level gates |
| Main Quest Thread | Day 23 | Breadcrumb injection, quest tracking |

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

*Last updated: Session 80 — V8.13: Settlement is_expandable=false (World tier clean). Coordinate ranges expanded (sub-locations ±5, region_locations 8-15, adjacent regions 18-35). Anti-cardinal placement instruction added. Ready for fresh-world debug verification.*
