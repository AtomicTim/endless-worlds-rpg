# Project: Endless Worlds RPG — Master Context

**Version:** 8.16
**Status:** Active Development — Map Navigation Complete, Architecture Hardening Next
**Objective:** A text-based RPG that generates a unique world for every playthrough. Genre-agnostic, infinitely replayable, CRPG depth.

**Reference:** /docs/architecture-spec.md — The definitive source for all Domain 1 vs Domain 2 decisions.

---

## 🔄 Current Status (Read This First)

**Current Phase:** Architecture hardening (Domain 1/2 separation) → restore genre renderers → Combat System
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
| Architecture Hardening | Domain 1/2 separation, caching, gate | ⏳ Next |
| Genre renderers restored | After architecture confirmed | ⏳ Pending |
| 20 | Combat System | ⏳ Pending |

**Active genres:** Fantasy, Cyberpunk, Horror/Lovecraftian, Space Opera, Post-Apocalyptic
**⚠️ Noir has been removed.**

### Map Navigation Round 2 (commit 840f355 — 43/43 tests, clean build)

**Fix 1 — PAD 80→60:** Better balance between inward clearance and usable map space.

**Fix 2 — Region map clicks navigate:** handleSelectNode Tier 2 non-expandable nodes now call onNavigate + switch to Tier 3. handleSelectExit Tier 2 calls onNavigate (triggers RegionBible expansion) — gives desktop users region-to-region travel via exit arrows.

**Fix 3 — Adjacent region cards: directly adjacent only:** NavigationBar walks up to player's geographic region node and builds adjRegionIds from its connections. Only regions in that set get ◆ cards — no cross-world jumping.

**Fix 4 — Undiscovered region empty state:** When activeTier === 2 && payload.nodes.length === 0, renders ◇ UNDISCOVERED TERRITORY + "Travel here to reveal what lies within." instead of empty grid.

**Fix 5 — Dialogue modal: compact bottom panel:** position: fixed, bottom: 0, maxHeight: 48vh, border-radius: 12px 12px 0 0. Compact 52px NPC header row. Options list scrolls internally. Footer (free-type + walk away) always visible. Desktop: maxWidth 640px, centered.

**Fix 6 — Region zone return card:** When isAtRegionZone, settlement hub surfaced as ← Return card. Connection loop guards updated accordingly.

**Fix 7 — RegionBible expansion logging:** navigateTo logs when adjacent region detected and triggering expansion.

### World Map — Design Decision ✅
World map is **purely informational**. No navigation from it. Clicking a region shows its Region map (preview). Travel between regions happens via:
- Region map exit arrows (desktop — Fix 2)
- ◆ nav bar cards (mobile + desktop)

### Known issues (shelved — address after architecture hardening)
- Duplicate codex writes: two paths (7b + 7c-1) fire for same location
- NPC codex written on arrival (before speaking)
- React key-prop-spread warnings in LocationSpan/ItemSpan/NpcSpan

---

## 🏗️ Architecture

### The Two Domains (Must Never Touch)
**Domain 1 (Engine — pure code):** World graph, player state, combat, quests, map, navigation, dialogue option generation, stat checks, container registry, loot resolution. AI cannot touch it.

**Domain 2 (Content Library — frozen after generation):** WCD, locations, NPCs, items, loot tables, main quest, region outlines. Once frozen, never changed by AI.

### AI During Gameplay (Narration Only)
1. Location arrival description — first visit only, cached permanently after
2. NPC dialogue responses — closed context, code determines topic + check result
3. Action narration — 1-4 sentences, cached after first examine
4. Container search narration — 1 sentence only when item found
5. Region zone arrival — first visit only, cached

### Pending Architecture Items (implement before combat)

**A — Location arrival descriptions cached permanently**
Currently AI is called every session load for arrival narration. Should write result to world_assets on first visit and serve the cached version on all subsequent visits. No AI call on re-visit.

**B — Free text validation gate**
Before any AI call, code must check in order:
1. Movement intent → hardcoded "Use the navigation bar" (DONE ✅)
2. NPC not at current location → hardcoded "[Name] isn't here" (needs confirmation)
3. Container not in registry → future (after container system)
4. Repeat examine of same Tier 1 object → canned response (DONE ✅)

**C — Dialogue options generated by code from NPC knowledge array**
AI currently generates options freely. Code should build them from NPC asset:
- Always: [Farewell] [Free type]
- If merchant: [Browse wares] → openTrade() directly, no AI
- For each topic in NPC.knowledge[]: [Ask about: {topic}]
- If quest_relevance=key + quest flag: [Quest option]
- If trust < 30: limited options
AI only writes response text, not the option list.

**Design decision for C — CONFIRMED: Option B**
WorldBible generates knowledge items as `{topic, content}` pairs going forward.
Full sentence strings used as fallback label for existing saves (auto-truncate to first 5 words).
New worlds get proper topic labels. AI receives `content` as closed context.

### Navigation Model ✅
```
Text MOVE → hardcoded message — ZERO AI CALL
navigateTo(nodeId): NavigationBar cards, map clicks, highlight clicks

Travel flow:
  Sub-location → Return card → Settlement hub
  Settlement hub → ↑ EXIT TO [REGION] button → Geographic Region zone
  Region zone → nav cards / region map clicks → standalones / ← settlement
  Region zone → ◆ adjacent region cards / region map exit arrows → new region
  Adjacent region → RegionBible expansion → new region settlement

World map: informational only. No navigation from it.
```

### Map System ✅
```
COORDINATE SYSTEM: Hub at {0,0}. Sub-locations ±5 (organic/diagonal).
  Region_locations 8-15 units. Adjacent regions 18-35 units.
  Frozen at generation. PAD=60.

TIER DEFINITIONS:
  Local  = hub + sub_locations (BFS). Disabled/redirects when at region zone.
  Region = settlement + region_locations. Node clicks navigate. Exit arrows navigate.
  World  = is_expandable === true only. Informational only — no navigation.

LOCAL exit: button above SVG → navigates to parent region zone.
Region undiscovered: ◇ UNDISCOVERED TERRITORY message when nodes.length === 0.
DEBUG MODE ACTIVE in index.tsx. TO RESTORE: uncomment pickModule dispatcher.
```

### Geographic Hierarchy ✅
```
World
└── Geographic Region (is_expandable=true, persistent explorable zone)
    ├── Settlement (is_settlement_node=true, is_expandable=false)
    │   └── Sub-location (type=sub_location, zone_id=settlement)
    ├── Standalone location (type=zone, is_expandable=false)
    │   └── Back-connection to settlement GUARANTEED
    └── Adjacent regions (is_expandable=true, undiscovered)
        └── Navigable via ◆ nav cards or region map exit arrows only
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
| Architecture Hardening | NOW | Arrival caching, free text gate, code-gen dialogue options (Option B) |
| Genre renderers restored | After arch confirmed | Uncomment pickModule in index.tsx |
| Codex dedup fix | After arch | Two-path duplicate write cleanup |
| Combat System | Day 20 | Turn-based, code resolves, AI narrates |
| Container + Loot | Day 21 | Registry, loot tables, search flow |
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

*Last updated: Session 83 — V8.16: Map navigation complete. PAD=60, region map node/exit clicks navigate, adjacent-only region cards, undiscovered state, dialogue bottom panel, region zone return card, RegionBible expansion logging. World map informational only. Architecture hardening (A/B/C with Option B for knowledge pairs) queued next.*
