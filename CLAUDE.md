# Project: Endless Worlds RPG — Master Context

**Version:** 8.10
**Status:** Active Development — Topology Map Layout Complete
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
| Map Overhaul — Topology Layout | graph-topology positioning, pulse fix | ✅ Complete |
| 20 | Combat System | ⏳ Next |
| Container + Loot | Registry, loot tables, search flow | ⏳ Pending |
| 21+ | Skills, Background, Factions | ⏳ Pending |

**Active genres:** Fantasy, Cyberpunk, Horror/Lovecraftian, Space Opera, Post-Apocalyptic
**⚠️ Noir has been removed.**

### Map Overhaul — Topology Layout (commit 6dfe18f — 86/86 tests, clean build)

**Fix 1 — Topology-based layout (WorldMap.tsx):**
Discarded map_position for visual layout entirely. New topologyLayout(nodes, connections, anchorId) puts anchor at viewBox centre (160,160), runs BFS through connection graph to assign ring numbers (graph-distance from anchor), places ring 1 evenly around centre, rings 2+ on a single outer radius. Both rings clamped to PAD=48 margin. connectionPairs() helper produces deduped Array<[string,string]> for each tier.
- Local tier: two-phase BFS discovery kept (zone_id seed → connection BFS → sub_location fallback). Anchor = player's current node or zone hub.
- Region tier: anchor = settlement node (is_settlement_node=true) falling back to region.id.
- World tier: anchor = findRootZoneId(current_node_id). Undiscovered hints float on outer ring.
Dead code removed: autoPositionNodes, hasMapPos, boundsFor, MIN_RANGE. project() and BoundsLike remain exported from types.ts.

**Fix 2 — SVG pulse drift (all genre renderers):**
Added transformBox: "fill-box" alongside transformOrigin: "center" on all ew-pulse elements across FantasyMap.tsx, CyberMap.tsx, SpaceMap.tsx, ApocMap.tsx, HorrorMap.tsx, primitives.tsx. 9 occurrences. Pulse ring now scales relative to element's own bounding box — no more drift toward top-left SVG corner.

**Fix 3 — TS3 compatibility:**
Replaced for...of over Map/Set with .forEach() callbacks (tsconfig target defaults to ES3 which can't iterate iterators directly).

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
Layout engine: topologyLayout() — graph-topology BFS positioning
  - Anchor node at centre (160,160)
  - Ring 1 (direct neighbours): evenly distributed circle around centre
  - Ring 2+ (further nodes): outer ring, clamped to PAD=48 margin
  - map_position values IGNORED for layout (unreliable from WorldBible)
  - connectionPairs() produces deduped edge list per tier

Tier 3 — Local: hub at centre, sub-locations in ring 1
  Discovery: zone_id seed → BFS admitting sub_locations/hub/shared-zone
  Fallback: include all sub_location nodes if only hub found
  Exits: connections leaving included set, labelled at map edge

Tier 2 — Region: settlement at centre, standalones in ring 1
  Anchor: is_settlement_node=true node

Tier 1 — World: current region at centre, adjacent in ring 1
  Anchor: findRootZoneId(current_node_id)
  Undiscovered: outer ring

Building glyphs (Fantasy only, by ambient_type):
  inn/tavern → inn silhouette | smithy/forge → forge+chimney
  market_stall → awning | temple_shrine → arch
  guild_hall/garrison → keep | well/fountain → well
  stable → stable | dungeon/ruin/barrow → ruin
  Other genres: Cyber=squares, Space=rooms, Apoc=sheds, Horror=daggers

SVG pulse: transformBox: "fill-box" + transformOrigin: "center" on all
  ew-pulse elements — prevents drift toward SVG viewport corner

Info panel: ◆ INTERACT items are buttons → submitAction("examine [name]")
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
- Both: codex_loc_{id} flag prevents duplicate writes

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

*Last updated: Session 77 — V8.10: Topology-based map layout (map_position abandoned), SVG pulse transformBox fix, TS3 forEach compatibility.*
