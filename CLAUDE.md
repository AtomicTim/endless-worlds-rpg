# Project: Endless Worlds RPG — Master Context

**Version:** 7.5
**Status:** Active Development — World Generation Redesign
**Objective:** To create a truly endless, fully-fledged AI-driven RPG engine — text and SVG based — with persistent worlds, real mechanics, and emergent storytelling. Genre-agnostic, infinitely replayable.

---

## 🔄 Current Status (Read This First)

**Current Phase:** Day 19F — Three-Tier Map Component
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
| 19F | Three-Tier Map Component | 🔄 In Progress |
| 20+ | Combat, Skills, Background | ⏳ Pending |

**Active genres:** Fantasy, Cyberpunk, Horror/Lovecraftian, Space Opera, Post-Apocalyptic
**⚠️ Noir has been removed. Do not reference it anywhere in the codebase.**

### Day 19E Deliverables (commit 3fdf5f6 — 86/86 tests, clean build)
- prompt-builder: YOUR ROLE AND HARD RULES block (5 subsections A-E) immediately after WCD block
- TIER 1 OBJECTS block injected into user prompt from key_landmarks
- NPCS PRESENT tightened: graph-resolved only, "ONLY characters available", empty-roster fallback
- /lib/game/highlights.ts (new): buildExactHighlights() + findExactHighlights() — whole-word, longest-phrase, overlap-drop
- StoryFeed: exact highlight matching replaces old POI substring scanner
- poi-colors.ts + InteractionPopover: LANDMARK type added (muted gold, info-only popover)
- NarratorResponse.revealed_npc_names removed from types + narrator parser
- useGameLoop step 7d (165 lines) deleted — reveal pipeline gone
- codex.ts: updateAssetNameRevealed() deleted
- codex page: identityUnknown always false, LOCATION assets only

---

## 🏗️ Architecture — Complete

### Four Layers ✅
**Layer 0 — WCD** — world_consistency jsonb, injected first in all AI calls
**Layer 1 — WorldBible** — world_bible jsonb, starting region + outlines + main quest
**Layer 2 — RegionBible** — on-demand, background pre-generation, deduplication cache
**Layer 3 — Narrator** — hard rules enforced, exact Tier 1 references, no reveal pipeline

### Three-Tier Object System ✅
**Tier 1** — AI-generated LocationObjects, key_landmarks, highlighted exact-match
**Tier 2** — ambient-objects.ts (27 types, all genres), instant response, no narrator
**Tier 3** — narrator ambient instruction, 1-2 sentences, nothing disappears

### Highlight System ✅
- buildExactHighlights(): Tier 1 objects (ITEM), NPCs in npc_ids (NPC), connected nodes (LOCATION), WCD landmarks (LANDMARK)
- findExactHighlights(): whole-word case-insensitive, longer phrase wins, no overlaps
- Click behavior: ITEM→EXAMINE, NPC→DIALOGUE, LOCATION→MOVE, LANDMARK→info popover

### NPC Rules ✅
Real name from birth. name_known always true. No reveal pipeline. No placeholders.

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

## 🗺️ Three-Tier Map System (Day 19F)

**Tier 1 — World Map (40x40 grid):**
Viewport centered on player, scrollable. WCD landmarks as diamond markers before discovery.
Region blocks colored by type. Current region pulsing.

**Tier 2 — Regional Map:**
One region. Nodes as colored squares. NPC dots at home locations. Exit arrows.

**Tier 3 — Local Map:**
Settlement/dungeon layout. Code-generated positioning. Notable sub-locations as colored blocks.
Non-notable buildings as small grey filler blocks. NPCs as static dots at home_location_id.

Breadcrumb nav: World > Region > Location. Default tier by context.
Toggleable sidebar panel in game header.

**Map colors by location type (all genres):**
settlement_hub/tavern: #1d4ed8 blue | market/shop: #a16207 amber | smithy/workshop: #7c2d12 dark red
wilderness: #15803d green | dungeon: #6b7280 grey | stronghold: #7c2d12 dark red
port/docks: #0e7490 teal | ruin: #78716c stone
Cyberpunk: bar #831843 | corp #1e1b4b | slum #78350f | data-hub #0e7490
Space Opera: station #4c1d95 | ship #1e3a5f | colony #14532d
Horror: mansion #1f2937 | asylum #374151
Post-Apoc: shelter #7f1d1d | wasteland #92400e

---

## 🎭 NPC Dialogue System ✅
- RESPONDING CHARACTER block only for DIALOGUE
- Option tone: modal → submitAction(forcedTone) → resolver
- Badge always matches check. Real names from birth.
- Failed checks = evasion, never absence.

## 💰 Trading System (Day 16) ✅
## 🎨 UI System (Direction 3) ✅

---

## Narrator Architecture ✅

For DIALOGUE: WCD → YOUR ROLE HARD RULES → RESPONDING CHARACTER → TIER 1 OBJECTS → ESTABLISHED WORLD ASSETS → SCENE CONTEXT → VERBOSITY
For non-DIALOGUE: WCD → YOUR ROLE HARD RULES → NPCS PRESENT → TIER 1 OBJECTS → ESTABLISHED WORLD ASSETS → SCENE CONTEXT → VERBOSITY

Hard rules: exact names, Tier 1 only, failed=evasion, RESPONDING CHARACTER only, WCD absolute, no invented NPCs/objects.

---

## Implementation Sequence

### 19A ✅ — WCD (08322b6)
### 19B ✅ — WorldBible types + routes + wizard (d5b41b0)
### 19C ✅ — Ambient Object System (4e7ab6f)
### 19D ✅ — RegionBible + cache + WORLD_EXPLORE (bd9dbe3)
### 19E ✅ — Narrator hard rules + exact highlights + reveal pipeline removed (3fdf5f6)
### 19F 🔄 — Three-Tier Map Component
- /components/game/WorldMap.tsx
- Tier 1: WCD grid, landmark diamonds, region blocks, scrollable
- Tier 2: region nodes, NPC dots at home, exit arrows
- Tier 3: code-generated local layout, grey filler blocks, NPC dots
- Breadcrumb navigation, toggleable sidebar
- Real-time updates on discovery

---

## Supabase Tables (all applied ✅)
- game_sessions: +world_seed, +world_graph, +world_consistency, +world_bible
- world_states: +current_node_id. Migrations 001-009.

---

## Core Philosophy
- AI generates content once, engine owns it forever
- WCD is the constitution — injected everywhere, never contradicted
- Three object tiers: AI / templates / ambient narrator
- Narrator describes, never generates — hard rules enforced
- Names permanent from birth — no reveal pipeline
- Highlights exact Tier 1 matches only
- Failed checks = evasion only
- Three-tier map: World / Regional / Local
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

*Last updated: Session 62 — V7.5: Day 19E complete. Narrator hard rules, exact highlights, reveal pipeline removed. Day 19F starting.*
