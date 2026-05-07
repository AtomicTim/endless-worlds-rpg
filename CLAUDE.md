# Project: Endless Worlds RPG — Master Context

**Version:** 8.9
**Status:** Active Development — Map BFS + Codex First Visit Complete
**Objective:** A text-based RPG that generates a unique world for every playthrough. Genre-agnostic, infinitely replayable, CRPG depth.

**Reference:** /docs/architecture-spec.md — The definitive source for all Domain 1 vs Domain 2 decisions.

---

## 🔄 Current Status (Read This First)

**Current Phase:** Test UI → Combat System
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
| Map Fix + UI Polish Rounds 1-2 | Auto-position, glyphs, BFS discovery | ✅ Complete |
| 20 | Combat System | ⏳ Next |
| Container + Loot | Registry, loot tables, search flow | ⏳ Pending |
| 21+ | Skills, Background, Factions | ⏳ Pending |

**Active genres:** Fantasy, Cyberpunk, Horror/Lovecraftian, Space Opera, Post-Apocalyptic
**⚠️ Noir has been removed.**

### Map BFS + Codex First Visit (commit 2a41a4d — 86/86 tests, clean build)

**Fix 1 — buildLocalTier BFS discovery:**
Replaced zone_id === zoneId filter with two-phase discovery. Seeds from any node with id or zone_id matching hub. BFS through connections admitting sub_locations / hub / shared-zone neighbours. Region-level neighbours stop the walk and become exits. Fallback: if still only hub, include all sub_location nodes in graph. Local view never empty.

**Fix 2 — autoPositionNodes minimum bounds spread:**
MIN_RANGE = 4 floor on both axes from boundsFor output. Prevents x-axis collapse to PAD=30 when all nodes share same x. Orbit radius capped at (VIEW - PAD*2)/2.2 so satellites stay inside viewBox. Imported PAD from renderer types.

**Fix 3 — Info panel interact items:**
onExamine?: (input: string) => void prop on WorldMap. ◆ INTERACT rows are now button elements that submit "examine [landmark]" through action pipeline. EXAMINE chip: flexShrink:0 instead of fixed width:56. Landmark name: minWidth:0, flex:1, overflow:hidden, textOverflow:ellipsis. Hover shows accent tint. Wired onExamine from page.tsx to submitAction.

**Fix 4 — Codex on first visit:**
Step 7c-1 threshold lowered from ≥2 to ≥1. Location codex entry writes on first ARRIVING. codex_loc_{id} flag keeps it idempotent. NPC-interaction path in step 7g still wins when it fires first.

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
    │   │   └── BFS-discovered via connection graph, not just zone_id
    │   └── Sub-location
    ├── Standalone location (Tier 2 node, zone_id = region id)
    │   └── Back-connection to settlement GUARANTEED at apply time
    └── [Adjacent region exits — WCD landmarks via ◆ cards]
```

### Map System ✅
```
Tier 1 — World: geographic regions, WCD landmark ◆ diamonds
Tier 2 — Region: settlement + standalones side by side, cross-region exits
Tier 3 — Local: sub-locations discovered via BFS from settlement hub
  - Seeds: id/zone_id match hub → BFS through connections
  - Admits: sub_locations + hub + shared-zone neighbours
  - Stops at: zone-level nodes (become exits instead)
  - Fallback: if only hub found, include all sub_location nodes

autoPositionNodes(): projects nodes into 0–320 SVG viewBox
  - MIN_RANGE=4 prevents axis collapse
  - Circle orbit radius capped at (VIEW-PAD*2)/2.2

Building glyphs (Fantasy only, by ambient_type):
  inn/tavern → inn | smithy/forge → forge+chimney
  market_stall → awning | temple_shrine → arch
  guild_hall/garrison → keep | well/fountain → well
  stable → stable | dungeon/ruin/barrow → ruin
  Other genres: Cyber=squares, Space=rooms, Apoc=sheds, Horror=daggers

Info panel: ◆ INTERACT items are clickable buttons → submitAction("examine [name]")
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

*Last updated: Session 76 — V8.9: Local map BFS node discovery, min bounds spread, info panel clickable examine, codex on first visit.*
