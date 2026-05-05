# Project: Endless Worlds RPG — Master Context

**Version:** 7.6
**Status:** Active Development — World Generation Redesign Complete
**Objective:** To create a truly endless, fully-fledged AI-driven RPG engine — text and SVG based — with persistent worlds, real mechanics, and emergent storytelling. Genre-agnostic, infinitely replayable.

---

## 🔄 Current Status (Read This First)

**Current Phase:** Testing 19A-19F, then Day 20 — Combat System
**Local Dev Port:** 3000
**Stack:** Next.js 14 / Tailwind / shadcn/ui / Supabase / Claude API / Stripe / Vercel
**GitHub Repo:** atomictim/endless-worlds-rpg

| Phase | Title | Status |
| --- | --- | --- |
| 1–14 | Phase 1 MVP | ✅ Complete |
| 15–18 | Dialogue, UI, World Graph, Systems Audit | ✅ Complete |
| 19A | World Consistency Document | ✅ Complete |
| 19B | World Bible Redesign | ✅ Complete |
| 19C | Ambient Object System | ✅ Complete |
| 19D | Regional Bible (Phase 2) | ✅ Complete |
| 19E | Narrator Constraints + Highlight Overhaul | ✅ Complete |
| 19F | Three-Tier Map Component | ✅ Complete |
| 20 | Combat System | ⏳ Pending |
| 21+ | Skills, Background, Factions | ⏳ Pending |

**Active genres:** Fantasy, Cyberpunk, Horror/Lovecraftian, Space Opera, Post-Apocalyptic
**⚠️ Noir has been removed. Do not reference it anywhere in the codebase.**

### Day 19F Deliverables (commit 41e4e7f — 86/86 tests, clean build, +7.4kB)
- /lib/game/map-colors.ts — 28 location types across all 5 genres, MAP_CURRENT_GLOW/UNDISCOVERED/LANDMARK/NPC_DOT constants, getNodeColor()
- /components/game/map/WorldMapTier1.tsx — 24px world grid, auto-pan to player zone, WCD landmark diamonds, undiscovered outlines, pulsing amber crosshair
- /components/game/map/WorldMapTier2.tsx — 48px regional view, SVG connection lines, NPC dots with overflow badge, exit arrows to adjacent regions
- /components/game/map/WorldMapTier3.tsx — 56px local layout, deterministic seeded jitter (mulberry32 PRNG), ambient grey filler blocks, region exit buttons
- /components/game/WorldMap.tsx — tier container, breadcrumb nav (World › Region › Node), 🌍/🗺/📍 tier buttons, auto-syncs on player move
- game-store: mapPanelOpen boolean + toggleMapPanel() + setMapPanelOpen(), cleared on clearSessionState
- GameLayout: map toggle button, left-side sliding panel (320px), mobile backdrop, desktop w-0 collapse
- app/game/page.tsx: WorldMap wired into mapPanel slot, null for legacy saves without world_graph

---

## 🏗️ Architecture — World Generation Complete ✅

### Four Layers ✅
**Layer 0 — WCD** — world_consistency jsonb, formatWcdBlock() injected first in all AI calls
**Layer 1 — WorldBible** — world_bible jsonb, starting region + outlines + main quest, 5-step wizard
**Layer 2 — RegionBible** — on-demand, deduplication cache, background pre-generation, matchRegionOutline 3-pass fuzzy
**Layer 3 — Narrator** — YOUR ROLE HARD RULES enforced, Tier 1 object injection, NPCS PRESENT from graph npc_ids

### Three-Tier Object System ✅
**Tier 1** — AI LocationObjects → key_landmarks → exact highlight → EXAMINE action
**Tier 2** — ambient-objects.ts (27 types, all genres) → instant response → no narrator, no highlight
**Tier 3** — narrator ambient instruction → 1-2 sentences → nothing disappears

### Highlight System ✅
- buildExactHighlights(): Tier 1 objects (ITEM/amber), NPCs in npc_ids (NPC/genre primary), connected nodes (LOCATION/blue-grey), WCD landmarks (LANDMARK/muted gold)
- findExactHighlights(): whole-word, longest-phrase-wins, no overlaps
- Click: ITEM→EXAMINE, NPC→DIALOGUE, LOCATION→MOVE, LANDMARK→info popover

### Three-Tier Map ✅
**Tier 1 — World:** 40x40 grid, WCD landmarks as ◆, region colored blocks, undiscovered outlines
**Tier 2 — Regional:** 48px nodes, SVG connections, NPC dots, exit arrows
**Tier 3 — Local:** 56px sub-locations, deterministic filler blocks, NPC dots at home_location_id
Breadcrumb nav, 🌍/🗺/📍 toggles, toggleable sidebar panel

### NPC Rules ✅
Real name from birth. name_known always true. No reveal pipeline. No placeholders. Introduce atmospherically then name in same paragraph.

---

## ⚡ FOUNDATIONAL RULES (Read Before Every Session)

### 1. World Assets Are Permanent
Write-once. ignoreDuplicates: true. AI generates once, engine owns forever.

### 2. Movement Is Graph-Based
GRAPH_NAVIGATE / INTERNAL_DESCRIBE / ZONE_EXPAND / WORLD_EXPLORE. current_node_id is truth.

### 3. Location Is Authoritative State
current_node_id saved immediately on real moves. INTERNAL_DESCRIBE does NOT update location.

### 4. Actions Are Permitted By Default
Tier 1 → rich AI. Tier 2 → template. Tier 3 → brief ambient. Nothing disappears.

### 5. Objects Mentioned Exist
Nothing ever disappears or "didn't exist." Failed checks = evasion, never absence.

### 6. Dialogue Is Consistent
RESPONDING CHARACTER only. Option tone authoritative. Badge matches check. Real names from birth.

### 7. The AI Has Exactly Three Roles
Generator (Phase 1+2 only) → Bridge (describe only) → Thread (breadcrumbs)

### 8. WCD Is Absolute Law
Injected first into every AI call. Nothing can contradict it.

### 9. Failed Checks = Evasion Only
NEVER means NPC left or object doesn't exist.

### 10. Highlights Are Exact Tier 1 Matches
Tier 1 objects, NPC names, connected location names, WCD landmarks. Exact whole-word match only.

---

## 🎭 NPC Dialogue System ✅
- RESPONDING CHARACTER only for DIALOGUE
- Option tone: modal → submitAction(forcedTone) → resolver
- Badge always matches check. Real names from birth.
- Failed checks = evasion, never absence.

## 💰 Trading System (Day 16) ✅
## 🎨 UI System (Direction 3) ✅

---

## Narrator Architecture ✅

Prompt order for DIALOGUE:
WCD → YOUR ROLE HARD RULES (5 sections A-E) → RESPONDING CHARACTER → TIER 1 OBJECTS → ESTABLISHED WORLD ASSETS → SCENE CONTEXT → VERBOSITY

Prompt order for non-DIALOGUE:
WCD → YOUR ROLE HARD RULES → NPCS PRESENT (graph npc_ids only) → TIER 1 OBJECTS → ESTABLISHED WORLD ASSETS → SCENE CONTEXT → VERBOSITY

Hard rules: exact names, Tier 1 only in descriptions, failed=evasion never absence, RESPONDING CHARACTER only, WCD absolute, no invented NPCs or objects.

---

## Planned Systems (Post-19F)

| System | When | Description |
| --- | --- | --- |
| Combat System | Day 20 | Turn-based, enemy AI, loot |
| Skills & Abilities | Day 21 | Skill trees, attribute thresholds |
| Main Narrative Thread | Day 22 | Breadcrumb injection from WorldBible |
| Character Background | Phase 3 | Traits, history, faction rep |
| Art System | Phase 3 | Static pixel art library + Replicate API |

---

## Supabase Tables (all applied ✅)
- game_sessions: +world_seed, +world_graph, +world_consistency, +world_bible
- world_states: +current_node_id. Migrations 001-009.

---

## Core Philosophy
- AI generates content once, engine owns it forever
- WCD is the constitution — injected everywhere, never contradicted
- Three-layer generation: WCD → WorldBible → RegionBible
- Three object tiers: Tier 1 (AI) / Tier 2 (templates) / Tier 3 (ambient narrator)
- Narrator describes, never generates
- Names permanent from birth — no reveal pipeline
- Highlights exact Tier 1 matches only
- Failed checks = evasion only
- Three-tier map: World / Regional / Local, toggleable sidebar
- DnD freedom: player can try anything, engine routes appropriately

---

## Tech Stack

| Layer | Tool |
| --- | --- |
| Frontend | Next.js 14 (App Router) |
| Styling | Tailwind CSS + shadcn/ui |
| Database | Supabase |
| AI | Claude API (claude-sonnet-4-20250514) |
| Payments | Stripe |
| Deploy | Vercel |
| Audio | Howler.js |
| State | Zustand |

---

## Genre Definitions (Final — No Noir)

| Genre | Tone | Primary | Currency | HP |
| --- | --- | --- | --- | --- |
| Fantasy | Epic, mythic | #f59e0b amber | Gold | HP |
| Cyberpunk | Terse, neon | #22d3ee cyan | Credits | Integrity |
| Horror/Lovecraftian | Cosmic dread | #84cc16 acid green | None | HP + Sanity |
| Space Opera | Grand, operatic | #a855f7 purple | Stellar Units | Hull Integrity |
| Post-Apocalyptic | Bleak, dark humor | #ea580c rust | Caps | HP |

---

## Monetization

| Feature | Free | Adventurer ($6.99) | Legend ($14.99) |
| --- | --- | --- | --- |
| Genres | Fantasy | All 5 | All 5 + future |
| Save Slots | 1 | 3 | Unlimited |
| AI Actions/Day | 50 | Unlimited | Unlimited |
| Art | Placeholder | Static pixel art | Generated (Replicate) |
| Templates | Browse | Browse + Play | Create + Share |
| Export Log | ❌ | ✅ | ✅ |
| Priority Speed | ❌ | ❌ | ✅ |

---

## Platform: PWA Only. No Electron, no Steam. Manifest Day 35.

## Workflow
**Claude.ai owns all CLAUDE.md updates.**
Claude Code pushes → git pull + restart → report → confirm → next prompt.

## Reference Links
- Supabase: https://supabase.com/dashboard
- Anthropic: https://console.anthropic.com
- Vercel: https://vercel.com/dashboard
- Stripe: https://dashboard.stripe.com

---

*Last updated: Session 63 — V7.6: Day 19F complete. Three-tier map, all 19A-19F done. Ready for testing then Day 20.*
