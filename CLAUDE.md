# Project: Endless Worlds RPG — Master Context

**Version:** 8.11
**Status:** Active Development — Real Coordinate Map Layout Complete
**Objective:** A text-based RPG that generates a unique world for every playthrough. Genre-agnostic, infinitely replayable, CRPG depth.

**Reference:** /docs/architecture-spec.md — The definitive source for all Domain 1 vs Domain 2 decisions.

---

## 🔄 Current Status (Read This First)

**Current Phase:** Test map → Combat System
**Local Dev Port:** 3000
**Stack:** Next.js 14 / Tailwind / shadcn/ui / Supabase / Claude API / Stripe / Vercel
**GitHub Repo:** atomictim/endless-worlds-rpg

| Phase | Title | Status |
| --- | --- | --- |
| 1–18 | MVP through Systems Audit | ✅ Complete |
| 19A–19F | World Generation Architecture | ✅ Complete |
| Gameplay + Navigation Audit | 21 issues + stabilization | ✅ Complete |
| UX Rounds 1-3 | Readability, dialogue, stat rules | ✅ Complete |
| Nav + NPC + Difficulty fixes | Back-links, codex, stakes | ✅ Complete |
| Trade + Dialogue + Arrival | No-check trade, NPC switch | ✅ Complete |
| Architecture Hardening | MOVE text removed, haiku model | ✅ Complete |
| Full UI Redesign | Design tokens, 15 SVG map renderers, layout | ✅ Complete |
| Map Fix + UI Polish Rounds 1-2 | Building glyphs, BFS discovery, codex | ✅ Complete |
| Map Overhaul — Real Coordinate Layout | fitToViewBox, skeleton fix, dedup | ✅ Complete |
| 20 | Combat System | ⏳ Next |
| Container + Loot | Registry, loot tables, search flow | ⏳ Pending |
| 21+ | Skills, Background, Factions | ⏳ Pending |

**Active genres:** Fantasy, Cyberpunk, Horror/Lovecraftian, Space Opera, Post-Apocalyptic
**⚠️ Noir has been removed.**

### Map Overhaul — Real Coordinate Layout (commit 525ea30 — 86/86 tests, clean build)

**Fix 1 — WorldBible skeleton coordinate system (generate-world-bible/route.ts):**
Added COORDINATE SYSTEM instruction block: settlement hub always at {0,0}, sub-locations within ±2 of hub, region landmarks 2–4 units out, adjacent regions 5–10 units. Skeleton examples fixed: tavern moved from {0,0} (collision with hub) → {-1,0}, smithy added at {0,1}, fourth sub-location at {0,-1}, region_landmark at {3,2}, adjacent region grid_centre at {6,0}. Every location must have a unique (x,y). Now generates 1 settlement + 4 sub-locations.

**Fix 2 — deduplicatePositions (apply-world-bible/route.ts):**
New helper groups graph nodes by serialized (x,y), keeps first node at original position, spirals subsequent collisions through cardinal then diagonal offsets. Runs immediately before WorldGraph assembly so persisted graph always has unique coordinates regardless of AI output.

**Fix 3 — fitToViewBox (WorldMap.tsx):**
Replaced topologyLayout() entirely with fitToViewBox(). Computes bounding box of all nodes with map_position, enforces MIN_RANGE=3 floor on both axes, scales linearly into padded viewBox (PAD=44). Nodes without coords fall back to centroid circle. All three tier builders (world/region/local) now call fitToViewBox(candidates) after existing discovery logic. BFS discovery for local tier preserved. Positions are stable across navigation — clicking a node never reshuffles layout. Removed topologyLayout, RING_R, ring BFS, local PAD=48. connectionPairs() kept for edge deduplication.

---

## 🏗️ Architecture — See /docs/architecture-spec.md

### The Two Domains
**Domain 1 (Engine — pure code):** World graph, player state, combat, quests, map, navigation, dialogue, stat checks, container registry, loot resolution.
**Domain 2 (Content Library — frozen after generation):** WCD, locations, NPCs, items, loot tables, main quest, region outlines.
**AI during gameplay:** Narration only. Arrivals (cached), NPC dialogue, action narration (1-4 sentences), container search (1 sentence). Never touches state.

### Geographic Hierarchy ✅
```
World
└── Geographic Region (Tier 1 block)
    ├── Settlement (Tier 2 node, is_settlement_node=true)
    │   ├── Sub-location (Tier 3 block)
    │   │   └── BFS-discovered via connection graph, not zone_id alone
    │   └── Sub-location
    ├── Standalone location (Tier 2 node, zone_id = region id)
    │   └── Back-connection to settlement GUARANTEED at apply time
    └── [Adjacent region exits — WCD landmarks via ◆ cards]
```

### Map System ✅
```
Coordinate system: shared world space, integers
  Hub always at {0,0}. Sub-locations cluster ±2 of hub.
  Region landmarks 2-4 units out. Adjacent regions 5-10 units.
  Frozen at WorldBible generation. Never changes.

Layout engine: fitToViewBox()
  - Reads actual map_position (grid_position) from WorldGraph nodes
  - Computes bounding box, enforces MIN_RANGE=3
  - Scales linearly into padded viewBox (PAD=44, VIEW=320)
  - Stable: same positions every render — no reshuffling on navigate
  - Fallback: nodes missing map_position fan in centroid circle

Tier 3 — Local: hub + sub-locations in real coordinates
  Discovery: BFS from hub through connection graph
  Fallback: include all sub_location nodes if only hub found
  Exits: connections leaving included set at map edges

Tier 2 — Region: settlement + standalones at real coordinates
Tier 1 — World: all zone nodes at real grid_centre coordinates

Building glyphs (Fantasy only, by ambient_type):
  inn/tavern → inn | smithy/forge → forge+chimney
  market_stall → awning | temple_shrine → arch
  guild_hall/garrison → keep | well/fountain → well
  stable → stable | dungeon/ruin/barrow → ruin
  Other genres: Cyber=squares, Space=rooms, Apoc=sheds, Horror=daggers

SVG pulse: transformBox: "fill-box" + transformOrigin: "center"
Info panel: ◆ INTERACT buttons → submitAction("examine [name]")
```

### UI Design System ✅
```
Fonts: Cormorant Garamond / Inter Tight / JetBrains Mono
Surfaces: bg-0 #0a0907 → bg-3 #211c16
Genre accent: --accent via [data-genre] attribute
Highlights:
  hl-loc #7dd3fc solid underline     → LOCATION
  accent solid underline              → NPC
  hl-item #e8c547 dashed underline   → ITEM
  hl-landmark #c4b5fd dashed         → LANDMARK
  hl-pass #a3e635 / hl-fail #f87171 → stat checks
```

### Codex Rules ✅
- Location: writes on first ARRIVING (step 7c-1, threshold ≥1)
- Location: also writes on first NPC interaction (step 7g, takes priority)
- NPC: writes on first player dialogue
- codex_loc_{id} flag prevents duplicate writes

### Navigation Model ✅
Text MOVE → hardcoded message. navigateTo(nodeId) only.
NavigationBar: desktop = hidden | mobile = NavCard row.
Return card: graph-search sibling settlement by zone_id.

### Generation Model ✅
Zone 1: Fully concrete. Zone 2: Outlined. Zone 3: Name+position.
RegionBible: claude-haiku-4-5-20251001, 1200 tokens.

---

## ⚡ FOUNDATIONAL RULES

1. World Assets Are Permanent. Write-once.
2. Navigation Is UI-Only. Text MOVE → hardcoded. navigateTo() only.
3. Location Is Authoritative State. current_node_id on navigateTo.
4. Actions Permitted By Default. Tier 1→AI. Tier 2→template. Tier 3→ambient.
5. Objects Mentioned Exist. Failed checks = evasion, never absence.
6. Dialogue Consistent. Closed context. Failed check = no info. Trade = no check.
7. AI Three Roles Only. Generator → Bridge → Thread.
8. WCD Is Absolute Law.
9. Failed Checks = Evasion Only.
10. Highlights Are Exact Tier 1 Matches.

---

## Narrator Prompt Order ✅

DIALOGUE: WCD → HARD RULES → RESPONDING CHARACTER → TIER 1 OBJECTS → WORLD ASSETS → SCENE CONTEXT → VERBOSITY
non-DIALOGUE: WCD → HARD RULES → NPCS PRESENT → TIER 1 OBJECTS → CONNECTED LOCATIONS → WORLD ASSETS → SCENE CONTEXT → VERBOSITY

Verbosity: terse (2/3/4 sentences ≤12 words) | standard (3-4/4-5/5-7) | rich (5-7/6-8/8-12)

---

## Planned Systems

| System | When | Description |
| --- | --- | --- |
| Combat System | Day 20 | Turn-based, code resolves, AI narrates |
| Container + Loot | Day 21 | Registry, loot tables, search flow |
| Skills + Leveling | Day 22 | XP, stat points, level gates |
| Main Quest Thread | Day 23 | Breadcrumb injection, quest tracking UI |
| Dynamic Pricing | Discuss | Haggling → price_override flag |
| Art System | Phase 3 | Static pixel art + Replicate API |

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

## Platform: PWA Only. Manifest Day 35.

## Workflow
**Claude.ai owns all CLAUDE.md updates.**
Claude Code pushes → git pull + restart → report → confirm → next prompt.
**All architecture decisions defer to /docs/architecture-spec.md.**

---

*Last updated: Session 78 — V8.11: Real coordinate map layout (fitToViewBox), WorldBible skeleton coordinate fix, position deduplication in apply-world-bible.*
