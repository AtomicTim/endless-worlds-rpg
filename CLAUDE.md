# Project: Endless Worlds RPG — Master Context

**Version:** 7.0
**Status:** Active Development — World Generation Redesign
**Objective:** To create a truly endless, fully-fledged AI-driven RPG engine — text and SVG based — with persistent worlds, real mechanics, and emergent storytelling. Genre-agnostic, infinitely replayable.

---

## 🔄 Current Status (Read This First)

**Current Phase:** World Generation Architecture Redesign
**Local Dev Port:** 3000
**Stack:** Next.js 14 / Tailwind / shadcn/ui / Supabase / Claude API / Stripe / Vercel
**GitHub Repo:** atomictim/endless-worlds-rpg

| Phase | Title | Status |
| --- | --- | --- |
| 1–14 | Phase 1 MVP | ✅ Complete |
| 15–18 | Dialogue, UI, World Graph, Systems Audit | ✅ Complete |
| 19A | World Consistency Document | 🔄 In Progress |
| 19B | World Bible Redesign | ⏳ Pending |
| 19C | Ambient Object System | ⏳ Pending |
| 19D | Regional Bible (Phase 2) | ⏳ Pending |
| 19E | Narrator Constraints + Highlight Overhaul | ⏳ Pending |
| 19F | Three-Tier Map Component | ⏳ Pending |
| 20+ | Combat, Skills, Background | ⏳ Pending |

**Active genres:** Fantasy, Cyberpunk, Horror/Lovecraftian, Space Opera, Post-Apocalyptic
**⚠️ Noir has been removed. Do not reference it anywhere in the codebase.**

---

## 🏗️ Architecture Redesign — Why

The previous approach asked the AI to generate structured game data during live gameplay narration. This caused persistent bugs: location names changing mid-session, NPCs disappearing, duplicate assets, inconsistent highlights. The root cause is architectural — language models are excellent narrators but fundamentally unreliable as live data generators.

**The new approach separates AI involvement into two distinct phases:**

1. **Generation phase** (before first player action): AI generates all world content into strict validated JSON. Content is locked as permanent game assets.
2. **Narration phase** (during gameplay): AI describes what already exists. It never creates, never names, never generates.

**Full architecture documented in:** `/docs/world-generation-architecture.md`

---

## 🌍 New World Generation Architecture

### Four Layers

**Layer 0 — World Consistency Document (WCD)**
Generated once at game start. Never modified. Injected into EVERY AI call.
Contains: world name, landmarks, factions, world rules, grid bounds.
Stored in: `game_sessions.world_consistency`

**Layer 1 — World Bible (Phase 1)**
Generated at game start from WCD context. Starting region fully detailed + outlines of 3-5 adjacent regions + main quest.
Stored in: `game_sessions.world_bible`

**Layer 2 — Regional Bible (Phase 2)**
Generated on player's first approach to a new region. Background pre-generation on exit discovery.
Expands a RegionOutline into a full RegionBible constrained by the WCD.

**Layer 3 — Narrator**
Receives WCD + locked location/NPC data. Describes only. Never generates. Hard rules enforced in prompt.

### Location Hierarchy

```
Region (e.g. "Thornwick Crossing area")
└── Settlement Node (arrival point — town square, main street)
    ├── Notable Sub-location 1 (Korven's Inn)
    ├── Notable Sub-location 2 (Sylanna's Glass Emporium)
    ├── Notable Sub-location 3 (The Ashflow Forge)
    └── [ambient grey blocks — non-notable buildings, not generated]
```

**Notable sub-locations per settlement:** 3-6
**NPCs per sub-location:** 1-3 (usually 1-2)
**Tier 1 objects per sub-location:** 3-5

### Three-Tier Object System

**Tier 1 — AI-generated, tracked, highlighted**
Named in LocationDefinition.objects. Highlighted in story feed. Meaningful interactions.

**Tier 2 — Code-generated from templates**
Every location type has a built-in ambient object library (fireplace, bar stools, anvil, etc.).
Instant template responses. No AI call. Never highlighted.
Defined in: `/lib/game/ambient-objects.ts`

**Tier 3 — Narrator handles**
Anything not in Tier 1 or 2. Brief narrator call with "nothing of particular note" instruction.
No game state change. DnD freedom layer.

### NPC Rules (Simplified)

- Every NPC has a real name assigned at generation time — permanent
- `name_known` is always `true` for newly generated NPCs
- Narrator introduces atmospherically then names in same paragraph
- Dialogue modal shows real name immediately
- **No reveal pipeline. No placeholder names. Ever.**

### Three-Tier Map System

**Tier 1 — World Map**
40x40 grid. Viewport centered on player, scrollable. WCD landmarks visible as diamond markers before discovery. Colored by region type.

**Tier 2 — Regional Map**
One region. Individual nodes as colored squares. NPC home dots. Exit arrows to adjacent regions.

**Tier 3 — Local Map**
Current settlement/dungeon layout. Code-generated positioning. Notable sub-locations as colored blocks. Non-notable buildings as small grey filler blocks. NPCs as static dots at their `home_location_id`.

**NPC movement:** Static at home_location_id. Shown as dots on Tier 3 local map. No pathfinding. Day/night schedules possible Phase 3+.

---

## ⚡ FOUNDATIONAL RULES (Read Before Every Session)

### 1. World Assets Are Permanent
Write-once constitution. `ignoreDuplicates: true`. AI generates once, engine owns forever.

### 2. Movement Is Graph-Based
Move classifier: GRAPH_NAVIGATE / INTERNAL_DESCRIBE / ZONE_EXPAND / WORLD_EXPLORE.
`current_node_id` is single source of truth.

### 3. Location Is Authoritative State
`current_node_id` saved immediately on real moves. INTERNAL_DESCRIBE does NOT update location.

### 4. Actions Are Permitted By Default
Player can try anything. Tier 1 → rich AI response. Tier 2 → template. Tier 3 → brief narrator ambient.

### 5. Objects Mentioned Exist
Tier 1 objects are highlighted and interactable. Tier 2 and 3 get appropriate ambient responses. Nothing ever disappears or "didn't exist."

### 6. Dialogue Is Consistent
Narrator receives ONLY the responding character. Option tone is authoritative. Badge always matches check that fires.

### 7. The AI Has Exactly Three Roles
**Generator (Phase 1+2 only):** Creates WCD, WorldBible, RegionBibles. Content is locked permanently after generation.
**Bridge:** Describes mechanical outcomes. Uses only locked asset names. Never invents.
**Thread:** Plants quest breadcrumbs from WorldBible. Never forces or blocks.

### 8. WCD Is Absolute Law
Injected first into every AI call. Nothing can contradict it. NPCs know WCD landmarks according to their knowledge level.

### 9. Failed Checks = Evasion Only
A failed stat check means the NPC is guarded or unhelpful. It NEVER means the NPC left or the object doesn't exist.

### 10. Highlights Are Exact Tier 1 Matches
Only Tier 1 objects, NPC names, and connected location names get highlighted. Exact string match only — no fuzzy scanning.

---

## 🗺️ World Graph Architecture

**WorldNode:** id, name, type, zone_id, is_expandable, connections[], npc_ids[], asset_id, discovered, map_position, category?

**Move Classification (move-classifier.ts):**
- GRAPH_NAVIGATE → known connection, deterministic
- INTERNAL_DESCRIBE → sub-area, no location change
- ZONE_EXPAND → new child node within expandable zone
- WORLD_EXPLORE → new zone, bidirectional connection

**TYPE_KEYWORDS covers all 5 genres.**

**NPC Placement:**
- Pre-seeded: assigned to nodes at world-bible time
- Dynamic: added to currentNode.npc_ids on first encounter
- All NPCs shown as static dots at home_location_id on Local Map

---

## 🎭 NPC Dialogue System
- Narrator receives ONLY the active NPC (RESPONDING CHARACTER block)
- Option tone flows modal → submitAction(forcedTone) → resolver
- Badge always matches the check that fires
- No reveal pipeline — real names from birth
- Failed checks = evasion, never absence

## 💰 Trading System (Day 16 — Complete)
- Merchant keyword detection → trade_available → items_for_sale
- TradeModal: Buy full value, Sell 50%
- Currency from getGenreColors — genre-accurate

## 🎨 UI System (Direction 3 — Complete)
- genre-ui.ts: getGenreColors(genre) — single source of truth
- StoryFeed: arrival headers, NPC quote-blocks, stat-check receipts
- DialogueModal: accent-bar buttons by tone, stat badge matches resolver
- VerbosityToggle: Terse / Standard / Rich in header

---

## Narrator Architecture

**Narrator outputs: text only. Game code derives all mechanics.**

For DIALOGUE:
- WCD (first)
- RESPONDING CHARACTER block (single NPC constitution + trust)
- Current LocationDefinition (atmosphere + Tier 1 objects list)
- Player state + recent history
- VERBOSITY block (last)

For non-DIALOGUE:
- WCD (first)
- NPCS PRESENT (from currentNode.npc_ids)
- Current LocationDefinition
- Player state + recent history
- VERBOSITY block (last)

**Hard narrator rules (all prompts):**
1. Use EXACT stored names for locations, NPCs, objects
2. Only name Tier 1 objects in descriptions
3. Failed checks = evasion, never absence
4. Write only from RESPONDING CHARACTER
5. WCD is absolute truth

---

## Implementation Sequence (19A → 19F)

### 19A — World Consistency Document
- `WorldConsistencyDocument` type
- `/api/game/generate-wcd` route
- Inject WCD first in ALL prompts
- `game_sessions.world_consistency` column (migration 009)

### 19B — World Bible Redesign
- Full type hierarchy: `WorldBible`, `RegionBible`, `LocationDefinition`, `NPCDefinition`
- Location hierarchy: settlement node + 3-6 notable sub-locations
- Replace `generateWorldSeed` with `generateWorldBible`
- Real names for all NPCs — remove placeholder system entirely
- `applyWorldBible` writes all assets and graph nodes
- Progressive loading: WCD → WorldBible → apply → start

### 19C — Ambient Object System
- `/lib/game/ambient-objects.ts` — Tier 2 library for all location types, all 5 genres
- Tier 2 interaction: instant template response
- Tier 3 interaction: short narrator call with ambient instruction
- Nothing ever "disappears" or "didn't exist"

### 19D — Regional Bible (Phase 2)
- `generateRegionalBible` replaces stub generator
- Background pre-generation on exit discovery
- "Entering [region_name]..." loading indicator
- WCD + existing region summary as context

### 19E — Narrator Constraints + Highlight Overhaul
- Hard narrator rules in ALL system prompts
- Highlight rebuilt: exact Tier 1 match only
- Remove NPC reveal pipeline entirely
- Route Tier 2 to template, Tier 3 to ambient narrator call

### 19F — Three-Tier Map Component
- `/components/game/WorldMap.tsx`
- Tier 1: WCD grid with landmark diamonds
- Tier 2: Region nodes, NPC dots at home locations
- Tier 3: Code-generated local layout, grey filler blocks
- Breadcrumb navigation, toggleable sidebar
- Real-time updates on discovery

---

## Database Cleanup (Before 19A)

Before starting 19A, truncate all game data tables to start fresh:
```sql
TRUNCATE TABLE world_states CASCADE;
TRUNCATE TABLE log_books CASCADE;
TRUNCATE TABLE world_assets CASCADE;
TRUNCATE TABLE codex CASCADE;
TRUNCATE TABLE game_sessions CASCADE;
TRUNCATE TABLE characters CASCADE;
TRUNCATE TABLE npcs CASCADE;
TRUNCATE TABLE art_cache CASCADE;
-- profiles and subscriptions: keep
```

---

## Supabase Migration 009

```sql
ALTER TABLE public.game_sessions
ADD COLUMN IF NOT EXISTS world_consistency jsonb;

ALTER TABLE public.game_sessions
ADD COLUMN IF NOT EXISTS world_bible jsonb;
```

---

## Supabase Tables (post-009)
- `profiles`, `game_sessions` (+world_seed, +world_graph, +world_consistency, +world_bible)
- `world_states` (+current_node_id), `log_books`, `characters`
- `npcs`, `art_cache` (unused), `world_assets` (+svg_content unused), `codex`
- Migrations 001-009

---

## Core Philosophy

- **AI generates content once, engine owns it forever**
- **WCD is the constitution — injected everywhere, never contradicted**
- **Three-layer generation: WCD → WorldBible → RegionBible**
- **Three object tiers: Tier 1 (AI, tracked) / Tier 2 (templates) / Tier 3 (narrator ambient)**
- **Narrator describes, never generates — hard rules enforced**
- **Names are permanent from birth — no reveal pipeline**
- **Highlights are exact Tier 1 matches only**
- **Failed checks = evasion only**
- **Three-tier map: World / Regional / Local**
- **NPC movement: static at home_location_id**
- **DnD freedom: player can try anything, engine routes appropriately**

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
Claude Code pushes → git pull + restart server → report to Claude.ai → checklist → confirm → next prompt.

## Reference Links
- Supabase: https://supabase.com/dashboard
- Anthropic: https://console.anthropic.com
- Vercel: https://vercel.com/dashboard
- Stripe: https://dashboard.stripe.com

---

*Last updated: Session 57 — V7.0: World generation architecture redesign. WCD + WorldBible + RegionBible. Three object tiers. Three-tier map. NPC static at home. Starting fresh. Implementation begins Day 19A.*
