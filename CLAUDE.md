# Project: Endless Worlds RPG — Master Context

**Version:** 8.1
**Status:** Active Development — Map Overhaul + RegionBible Reduction Complete
**Objective:** To create a truly endless, fully-fledged AI-driven RPG engine — text and SVG based — with persistent worlds, real mechanics, and emergent storytelling. Genre-agnostic, infinitely replayable.

---

## 🔄 Current Status (Read This First)

**Current Phase:** Testing map overhaul, then Day 20 — Combat System
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
| Map Overhaul | Icon header, type abbr, decorations, info panel | ✅ Complete |
| 20 | Combat System | ⏳ Pending |
| 21+ | Skills, Background, Factions | ⏳ Pending |

**Active genres:** Fantasy, Cyberpunk, Horror/Lovecraftian, Space Opera, Post-Apocalyptic
**⚠️ Noir has been removed. Do not reference it anywhere in the codebase.**

### Map Overhaul + RegionBible (commit 4b9eb6c — 43/43 tests, clean build)

**1A — Header:** Reduced to `MAP` label + three icon-only tier toggles. Active = genre primary size-5. Inactive = muted size-4.

**1B — In-body tier label:** Two-line header inside map body: small-caps tier name + bold context name in genre primary. Separated from nodes by divider.
- Tier 1: "WORLD MAP" + world_name from WCD
- Tier 2: "REGION MAP" + current zone name
- Tier 3: "LOCAL MAP" + current node name (or region name if at settlement hub)

**1C — Auto selectedRegionId:** useEffect watches current_node_id. When zone changes, auto-updates selectedRegionId and snaps to Tier 3.

**1D — Type abbreviations:** New getNodeTypeAbbr() in map-colors.ts. 9px monospace 3-letter chip bottom-left of every Tier 3 block: INN/MKT/FRG/SHR/GLD/GAR/DNG/WLD/PRT/DAT/CRP/STN/SHP/WST/MNR/LOC etc. Names truncated at 14 chars. Blocks 56px → 72px.

**1E — Genre decorations:** New MapDecorations.tsx component. 5 fantasy / 3 cyberpunk / 3 horror / 3 space-opera / 3 post-apoc tiny SVG glyphs + generic compass-rose fallback. Fills every empty Tier 3 grid cell with 3-5 deterministic decorations (mulberry32 seeded by zoneId:gx:gy) at 18% genre-primary opacity.

**1F — Location info panel:** Docked below map nodes. Shows: current node name + type abbr + first-sentence atmosphere (2-line clamp) + NPC dot list + Tier 1 landmark chips (max 4 + overflow count).

**RegionBible skeleton reduction:**
- 1 hub + 1 sub-location + 2 NPCs + 1 object per location + 1 exit only
- No breadcrumbs in RegionBible (main quest breadcrumbs are in WorldBible)
- max_tokens 2000 → 1500

---

## 🏗️ Architecture — Complete ✅

### Four Layers ✅
**Layer 0 — WCD** — world_consistency jsonb, formatWcdBlock() first in all AI calls
**Layer 1 — WorldBible** — world_bible jsonb, settlement hub + sub-locations + NPCs + outlines + main quest
**Layer 2 — RegionBible** — on-demand via navigateTo only, 1 hub + 1 sub + 2 NPCs, 1500 tokens max
**Layer 3 — Narrator** — YOUR ROLE HARD RULES, TIER 1 OBJECTS verbatim, NPCS PRESENT, CONNECTED LOCATIONS

### Navigation Model ✅
```
Text input → DIALOGUE / EXAMINE / INTERACT / CUSTOM only
           → MOVE intercepted → INTERNAL_DESCRIBE

NavigationBar card → navigateTo(nodeId) → GRAPH_NAVIGATE
WorldMap click → navigateTo(nodeId) → GRAPH_NAVIGATE
Highlighted location click → navigateTo(nodeId) → GRAPH_NAVIGATE
Adjacent region card → navigateTo(regionId) → RegionBible expansion
```

### Map System ✅
```
Tier 1 — World Map: region blocks, WCD landmark diamonds, scrollable
Tier 2 — Region Map: nodes, SVG connections, NPC dots, exit arrows
Tier 3 — Local Map: 72px blocks, 3-letter type abbr, genre decorations,
          location info panel below
Auto-switches to Tier 3 when zone changes.
Bottom sheet on mobile (<768px). Sidebar on desktop.
```

### Location Hierarchy
```
Region (e.g. "Hollow Veil Outskirts")
└── Settlement Node (HUB — town square, crossroads — NEVER a building)
    ├── Sub-location (INN, MKT, FRG etc.)
    └── [genre decorations in empty grid cells]
```

### Three-Tier Object System ✅
Tier 1 (AI, tracked) → Tier 2 (templates, instant) → Tier 3 (narrator ambient)

### NPC Rules ✅
Real name from birth. Pre-loaded on ARRIVING. Placeholder → real NPC via step 2b-2.

### Mobile-First ✅
52px nav cards. 44px touch targets. Bottom sheet map. 16px input font.

---

## ⚡ FOUNDATIONAL RULES (Read Before Every Session)

### 1. World Assets Are Permanent
Write-once. ignoreDuplicates: true.

### 2. Navigation Is UI-Driven
MOVE from text → INTERNAL_DESCRIBE only.
navigateTo(nodeId): NavigationBar, WorldMap, highlight clicks.
WORLD_EXPLORE and RegionBible expansion via navigateTo only.

### 3. Location Is Authoritative State
current_node_id saved on real navigateTo moves. IDs canonical — no article stripping.

### 4. Actions Are Permitted By Default
Text: DIALOGUE / EXAMINE / INTERACT / CUSTOM. Tier 1→AI. Tier 2→template. Tier 3→ambient.

### 5. Objects Mentioned Exist
Nothing disappears. Failed checks = evasion, never absence.

### 6. Dialogue Is Consistent
RESPONDING CHARACTER only. Badge matches check.
intimidating→STR. curious→PER. deceptive→CHA+2. persuasive→CHA.

### 7. The AI Has Exactly Three Roles
Generator (Phase 1+2 only) → Bridge (describe only) → Thread (breadcrumbs)

### 8. WCD Is Absolute Law
Injected first. Nothing contradicts it.

### 9. Failed Checks = Evasion Only

### 10. Highlights Are Exact Tier 1 Matches
Objects→EXAMINE. NPCs→DIALOGUE. Locations→navigateTo(nodeId). WCD landmarks→info.

---

## 🎭 NPC Dialogue System ✅
- RESPONDING CHARACTER only. Step 2b-2 redirects placeholders to real WorldBible NPC.
- Badge always matches check. Real names from birth. Pre-loaded on ARRIVING.

## 💰 Trading System ✅ | 🎨 Direction 3 UI ✅ | 🗺️ Three-Tier Map ✅

---

## Narrator Architecture ✅

DIALOGUE: WCD → HARD RULES → RESPONDING CHARACTER → TIER 1 OBJECTS → WORLD ASSETS → SCENE CONTEXT → VERBOSITY
non-DIALOGUE: WCD → HARD RULES → NPCS PRESENT → TIER 1 OBJECTS → CONNECTED LOCATIONS → WORLD ASSETS → SCENE CONTEXT → VERBOSITY

Verbosity: terse (2/3/4 sentences, max 12 words each) / standard (3-4/4-5/5-7) / rich (5-7/6-8/8-12). Block last.

---

## Planned Systems

| System | When | Description |
| --- | --- | --- |
| Combat System | Day 20 | Turn-based, structured UI |
| Object Types | Day 20 | landmark/container/item/mechanism/document |
| Skills & Abilities | Day 21 | Skill trees, attribute thresholds |
| Main Narrative Thread | Day 22 | Breadcrumb injection from WorldBible |
| Lore System | Later | Codex entry updates with new information |
| Art System | Phase 3 | Static pixel art + Replicate API |

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
- Settlement node = public hub — NEVER a building
- Location IDs canonical — never strip article prefixes
- Assets pre-loaded before narrator on ARRIVING
- Three object tiers: Tier 1 (AI) / Tier 2 (templates) / Tier 3 (ambient)
- Narrator describes with exact names, never generates
- Mobile-first: 44px touch targets, bottom sheet map, 52px nav cards
- Map auto-switches to Tier 3 on zone change

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

*Last updated: Session 68 — V8.1: Map overhaul complete. Icon-only header, in-body tier labels, auto-zone-switch, type abbreviations, genre SVG decorations, location info panel. RegionBible skeleton 1+1 locations 2 NPCs 1500 tokens.*
