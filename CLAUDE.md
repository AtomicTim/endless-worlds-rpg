# Project: Endless Worlds RPG — Master Context

**Version:** 8.0
**Status:** Active Development — Navigation Redesign Complete
**Objective:** To create a truly endless, fully-fledged AI-driven RPG engine — text and SVG based — with persistent worlds, real mechanics, and emergent storytelling. Genre-agnostic, infinitely replayable.

---

## 🔄 Current Status (Read This First)

**Current Phase:** Testing navigation redesign, then Day 20 — Combat System
**Local Dev Port:** 3000
**Stack:** Next.js 14 / Tailwind / shadcn/ui / Supabase / Claude API / Stripe / Vercel
**GitHub Repo:** atomictim/endless-worlds-rpg

| Phase | Title | Status |
| --- | --- | --- |
| 1–14 | Phase 1 MVP | ✅ Complete |
| 15–18 | Dialogue, UI, World Graph, Systems Audit | ✅ Complete |
| 19A–19F | World Generation Architecture | ✅ Complete |
| Gameplay Audit | 21-issue audit + full stabilization | ✅ Complete |
| Navigation Redesign | UI-driven movement, mobile-first | ✅ Complete |
| 20 | Combat System | ⏳ Pending |
| 21+ | Skills, Background, Factions | ⏳ Pending |

**Active genres:** Fantasy, Cyberpunk, Horror/Lovecraftian, Space Opera, Post-Apocalyptic
**⚠️ Noir has been removed. Do not reference it anywhere in the codebase.**

### Navigation Redesign (commit affc1a1 — 86/86 tests, clean build)
Full spec: /docs/navigation-redesign.md

**Core change:** Free-text navigation is disabled. When the player types movement text, the game intercepts it and routes to INTERNAL_DESCRIBE — the narrator describes what is visible from the current location. Navigation happens through explicit UI only.

**MOVE intercept (useGameLoop.ts):**
parsedAction.action_type === MOVE → short-circuit before resolveAction → build synthetic DESCRIBE_SUCCESS resolution → call narrator with INTERNAL_DESCRIBE context. No move classifier. No WORLD_EXPLORE. No stub generator from text input.

**navigateTo(nodeId) function:**
Separate function from submitAction. Takes a raw node ID. Fires GRAPH_NAVIGATE directly for known connections. Triggers RegionBible expansion for adjacent undiscovered regions. Used by NavigationBar, WorldMap clicks, and highlight link clicks. Never called from text parsing.

**NavigationBar component (/components/game/NavigationBar.tsx):**
Horizontal scrollable row of cards above InputBar. Reads currentNode.connections from worldGraph. Also shows adjacent undiscovered region cards from world_bible.adjacent_regions. Each card: location name, type icon, visited dot. Min height 52px (touch target). Tap calls onNavigate(nodeId) → navigateTo. Empty state: hidden.

**Mobile map → bottom sheet:**
Viewport < 768px: map opens as bottom sheet (65vh, rounded top corners, drag handle, backdrop, X button). Tap backdrop or X to close. Default tier on open: Local (Tier 3). Desktop: sidebar panel unchanged. Map button: 44px min touch target on mobile.

**Highlight clicks → navigateTo:**
LOCATION highlights now carry nodeId in HighlightCandidate. Clicking a LOCATION highlight calls navigateTo(nodeId) directly — no text parsing, no submitAction.

**WorldMap clicks → navigateTo:**
WorldMap.onNavigate now takes nodeId. All three tier components pass raw node IDs. No "go to X" text string.

**InputBar:**
Placeholder: "Talk, examine, or take action..." Font size 16px (prevents iOS auto-zoom). Min height 52px.

**Local Map (Tier 3) mobile:**
Sub-location blocks: min 56px height. Exit buttons: full-width 44px pill buttons labeled "→ [Region Name]".

---

## 🏗️ Architecture — Complete ✅

### Four Layers ✅
**Layer 0 — WCD** — world_consistency jsonb, formatWcdBlock() first in all AI calls
**Layer 1 — WorldBible** — world_bible jsonb, settlement hub + sub-locations + NPCs + outlines + main quest
**Layer 2 — RegionBible** — on-demand via navigateTo only (never from text), background pre-generation
**Layer 3 — Narrator** — YOUR ROLE HARD RULES, TIER 1 OBJECTS verbatim, NPCS PRESENT, CONNECTED LOCATIONS

### Navigation Model ✅
```
Text input → DIALOGUE / EXAMINE / INTERACT / CUSTOM only
           → MOVE intercepted → INTERNAL_DESCRIBE (narrator describes visible locations)

NavigationBar card click → navigateTo(nodeId) → GRAPH_NAVIGATE
WorldMap node click → navigateTo(nodeId) → GRAPH_NAVIGATE
Highlighted location text click → navigateTo(nodeId) → GRAPH_NAVIGATE
Adjacent region card click → navigateTo(regionId) → RegionBible expansion
```

### Three-Tier Object System ✅
**Tier 1** — AI LocationObjects → key_landmarks → exact highlight → EXAMINE
**Tier 2** — ambient-objects.ts (27 types) → instant response → no narrator
**Tier 3** — narrator ambient → 1-2 sentences → nothing disappears

### Location Hierarchy ✅
Settlement Node (town square) → Sub-locations (interior) → [grey filler on map]
Connection IDs validated at apply time.

### NPC Rules ✅
Real name from birth. Pre-loaded before narrator on ARRIVING.
Placeholder targets redirect to real WorldBible NPC.
"Walk up to person" → INTERNAL_DESCRIBE.

### Mobile-First ✅
NavigationBar: 52px cards, horizontal scroll, always visible.
Map: bottom sheet on mobile (<768px), sidebar on desktop.
InputBar: 16px font, 52px height.
All touch targets: 44px minimum.

---

## ⚡ FOUNDATIONAL RULES (Read Before Every Session)

### 1. World Assets Are Permanent
Write-once. ignoreDuplicates: true. AI generates once, engine owns forever.

### 2. Navigation Is UI-Driven
MOVE actions from text input → INTERNAL_DESCRIBE only.
Real navigation via navigateTo(nodeId): NavigationBar, WorldMap, highlight clicks.
WORLD_EXPLORE and RegionBible expansion via navigateTo only — never from text parsing.

### 3. Location Is Authoritative State
current_node_id saved immediately on real navigateTo moves.
Location IDs canonical — never strip article prefixes.

### 4. Actions Are Permitted By Default
Text input: DIALOGUE / EXAMINE / INTERACT / CUSTOM.
Tier 1 → rich AI. Tier 2 → template. Tier 3 → brief ambient.

### 5. Objects Mentioned Exist
Nothing ever disappears. Failed checks = evasion, never absence.

### 6. Dialogue Is Consistent
RESPONDING CHARACTER only. Badge matches check.
intimidating → STR. curious → PER. deceptive → CHA+2. persuasive → CHA.

### 7. The AI Has Exactly Three Roles
Generator (Phase 1+2 only) → Bridge (describe only) → Thread (breadcrumbs)

### 8. WCD Is Absolute Law
Injected first into every AI call. Nothing can contradict it.

### 9. Failed Checks = Evasion Only
NEVER means NPC left or object doesn't exist.

### 10. Highlights Are Exact Tier 1 Matches
Objects → EXAMINE. NPCs → DIALOGUE. Locations → navigateTo(nodeId). WCD landmarks → info.

---

## 🎭 NPC Dialogue System ✅
- RESPONDING CHARACTER only. Placeholder → real NPC via step 2b-2.
- Option tone → resolver. Badge matches check. Real names from birth.
- Failed checks = evasion. Assets pre-loaded before narrator on ARRIVING.

## 💰 Trading System (Day 16) ✅
## 🎨 UI System (Direction 3) ✅
## 🗺️ Three-Tier Map ✅ — bottom sheet on mobile

---

## Narrator Architecture ✅

For DIALOGUE: WCD → HARD RULES → RESPONDING CHARACTER → TIER 1 OBJECTS → WORLD ASSETS → SCENE CONTEXT → VERBOSITY
For non-DIALOGUE: WCD → HARD RULES → NPCS PRESENT → TIER 1 OBJECTS → CONNECTED LOCATIONS → WORLD ASSETS → SCENE CONTEXT → VERBOSITY

Verbosity: terse (2/3/4 sentences) / standard (3-4/4-5/5-7) / rich (5-7/6-8/8-12). Block last.

---

## Planned Systems

| System | When | Description |
| --- | --- | --- |
| Combat System | Day 20 | Turn-based, structured UI (not free text) |
| Skills & Abilities | Day 21 | Skill trees, attribute thresholds |
| Main Narrative Thread | Day 22 | Breadcrumb injection from WorldBible |
| Object Types | Day 20 | landmark/container/item/mechanism/document — distinct actions |
| Art System | Phase 3 | Static pixel art library + Replicate API |

---

## Supabase Tables (all applied ✅)
- game_sessions: +world_seed, +world_graph, +world_consistency, +world_bible
- world_states: +current_node_id. world-state route accepts worldGraph.
- Migrations 001-009.

---

## Core Philosophy
- AI generates content once, engine owns it forever
- Navigation is UI-driven — text input for actions only
- WCD is the constitution — injected everywhere, never contradicted
- Settlement node = public hub — never a building
- Location IDs canonical — never strip article prefixes
- Assets pre-loaded before narrator on ARRIVING
- Three object tiers: Tier 1 (AI) / Tier 2 (templates) / Tier 3 (ambient)
- Narrator describes with exact names, never generates
- Mobile-first: 44px touch targets, bottom sheet map, 52px nav cards

---

## Tech Stack

| Layer | Tool |
| --- | --- |
| Frontend | Next.js 14 (App Router) |
| Styling | Tailwind CSS + shadcn/ui |
| Database | Supabase |
| AI | Claude API (claude-sonnet-4-5) |
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

*Last updated: Session 67 — V8.0: Navigation redesign complete. UI-driven movement. NavigationBar. Mobile bottom sheet map. MOVE intercepted → INTERNAL_DESCRIBE. navigateTo bypasses text parsing. 44px touch targets throughout.*
