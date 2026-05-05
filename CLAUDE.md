# Project: Endless Worlds RPG — Master Context

**Version:** 7.1
**Status:** Active Development — World Generation Redesign
**Objective:** To create a truly endless, fully-fledged AI-driven RPG engine — text and SVG based — with persistent worlds, real mechanics, and emergent storytelling. Genre-agnostic, infinitely replayable.

---

## 🔄 Current Status (Read This First)

**Current Phase:** Day 19B — World Bible Redesign
**Local Dev Port:** 3000
**Stack:** Next.js 14 / Tailwind / shadcn/ui / Supabase / Claude API / Stripe / Vercel
**GitHub Repo:** atomictim/endless-worlds-rpg

| Phase | Title | Status |
| --- | --- | --- |
| 1–14 | Phase 1 MVP | ✅ Complete |
| 15–18 | Dialogue, UI, World Graph, Systems Audit | ✅ Complete |
| 19A | World Consistency Document | ✅ Complete |
| 19B | World Bible Redesign | 🔄 In Progress |
| 19C | Ambient Object System | ⏳ Pending |
| 19D | Regional Bible (Phase 2) | ⏳ Pending |
| 19E | Narrator Constraints + Highlight Overhaul | ⏳ Pending |
| 19F | Three-Tier Map Component | ⏳ Pending |
| 20+ | Combat, Skills, Background | ⏳ Pending |

**Active genres:** Fantasy, Cyberpunk, Horror/Lovecraftian, Space Opera, Post-Apocalyptic
**⚠️ Noir has been removed. Do not reference it anywhere in the codebase.**

### Day 19A Deliverables (commit 08322b6 — 86/86 tests, clean build)
- WorldLandmark, WorldFaction, WorldConsistencyDocument types added to types/game.ts
- Metadata.world_consistency?: WorldConsistencyDocument
- /api/game/generate-wcd route — POST, retry logic, strict validation (5 landmarks, 3 factions, 6 rules)
- formatWcdBlock() helper in prompt-builder.ts
- WCD prepended to narrator system prompt as first block
- /api/game/narrate/route.ts accepts world_consistency, falls back to masterState
- narrateAction() accepts optional WCD
- useGameLoop passes metadata.world_consistency to every narrate call
- generate-world-seed accepts WCD, prepends WCD block to seed prompt
- world-seed-generator.ts client wrapper accepts WCD
- apply-world-seed persists WCD to metadata.world_consistency AND world_consistency jsonb column
- /app/game/new/page.tsx — 4-step wizard: Creating character → Establishing world laws → Generating your world → Establishing world facts
- 009_world_generation.sql documented (already applied)

---

## 🏗️ Architecture Redesign — Why

The previous approach asked the AI to generate structured game data during live gameplay narration. This caused persistent bugs: location names changing mid-session, NPCs disappearing, duplicate assets, inconsistent highlights. The root cause is architectural — language models are excellent narrators but fundamentally unreliable as live data generators.

**The new approach separates AI involvement into two distinct phases:**

1. **Generation phase** (before first player action): AI generates all world content into strict validated JSON. Content is locked as permanent game assets.
2. **Narration phase** (during gameplay): AI describes what already exists. It never creates, never names, never generates.

**Full architecture documented in:** /docs/world-generation-architecture.md

---

## 🌍 New World Generation Architecture

### Four Layers

**Layer 0 — World Consistency Document (WCD) ✅**
Generated once. Never modified. Injected into EVERY AI call.
Contains: world name, landmarks, factions, world rules, grid bounds.
Stored in: game_sessions.world_consistency

**Layer 1 — World Bible (Phase 1) 🔄**
Generated from WCD context. Starting region fully detailed + outlines of 3-5 adjacent regions + main quest.
Stored in: game_sessions.world_bible

**Layer 2 — Regional Bible (Phase 2) ⏳**
Generated on first approach to a new region. Background pre-generation on exit discovery.
Expands a RegionOutline into full RegionBible constrained by WCD.

**Layer 3 — Narrator ⏳**
Receives WCD + locked location/NPC data. Describes only. Hard rules enforced in prompt.

### Location Hierarchy

```
Region (e.g. "Thornwick Crossing area")
└── Settlement Node (arrival point — town square, main street)
    ├── Notable Sub-location 1 (Korven's Inn)
    ├── Notable Sub-location 2 (Sylanna's Glass Emporium)
    ├── Notable Sub-location 3 (The Ashflow Forge)
    └── [ambient grey blocks — non-notable buildings, not generated]
```

Notable sub-locations per settlement: 3-6
NPCs per sub-location: 1-3 (usually 1-2)
Tier 1 objects per sub-location: 3-5

### Three-Tier Object System

**Tier 1 — AI-generated, tracked, highlighted**
Named in LocationDefinition.objects. Highlighted in story feed. Meaningful interactions.

**Tier 2 — Code-generated from templates**
Every location type has a built-in ambient object library.
Instant template responses. No AI call. Never highlighted.
Defined in: /lib/game/ambient-objects.ts

**Tier 3 — Narrator handles**
Brief narrator call with ambient instruction. No game state change. DnD freedom layer.

### NPC Rules (Simplified)
- Every NPC has a real name assigned at generation time — permanent
- name_known is always true for newly generated NPCs
- Narrator introduces atmospherically then names in same paragraph
- No reveal pipeline. No placeholder names. Ever.

### Three-Tier Map System

**Tier 1 — World Map:** 40x40 grid, WCD landmarks as diamonds, scrollable
**Tier 2 — Regional Map:** One region, node squares, NPC dots, exit arrows
**Tier 3 — Local Map:** Settlement layout, code-generated, grey filler blocks, NPC dots at home_location_id

NPC movement: Static at home_location_id. No pathfinding.

---

## ⚡ FOUNDATIONAL RULES (Read Before Every Session)

### 1. World Assets Are Permanent
Write-once constitution. ignoreDuplicates: true. AI generates once, engine owns forever.

### 2. Movement Is Graph-Based
Move classifier: GRAPH_NAVIGATE / INTERNAL_DESCRIBE / ZONE_EXPAND / WORLD_EXPLORE.
current_node_id is single source of truth.

### 3. Location Is Authoritative State
current_node_id saved immediately on real moves. INTERNAL_DESCRIBE does NOT update location.

### 4. Actions Are Permitted By Default
Player can try anything. Tier 1 → rich AI response. Tier 2 → template. Tier 3 → brief narrator ambient.

### 5. Objects Mentioned Exist
Tier 1 objects highlighted and interactable. Tier 2 and 3 get ambient responses. Nothing ever disappears.

### 6. Dialogue Is Consistent
Narrator receives ONLY the responding character. Option tone is authoritative. Badge always matches check.

### 7. The AI Has Exactly Three Roles
**Generator (Phase 1+2 only):** Creates WCD, WorldBible, RegionBibles. Locked permanently after generation.
**Bridge:** Describes outcomes. Uses only locked asset names. Never invents.
**Thread:** Plants quest breadcrumbs. Never forces or blocks.

### 8. WCD Is Absolute Law
Injected first into every AI call. Nothing can contradict it.

### 9. Failed Checks = Evasion Only
Failed stat check = NPC is guarded or unhelpful. NEVER means NPC left or object doesn't exist.

### 10. Highlights Are Exact Tier 1 Matches
Only Tier 1 objects, NPC names, connected location names. Exact string match only.

---

## 🗺️ World Graph Architecture

WorldNode: id, name, type, zone_id, is_expandable, connections[], npc_ids[], asset_id, discovered, map_position, category?

Move Classification: GRAPH_NAVIGATE / INTERNAL_DESCRIBE / ZONE_EXPAND / WORLD_EXPLORE
TYPE_KEYWORDS covers all 5 genres.

NPC Placement:
- Pre-seeded: assigned to nodes at world-bible time
- Dynamic: added to currentNode.npc_ids on first encounter
- Shown as static dots at home_location_id on Local Map

---

## 🎭 NPC Dialogue System
- Narrator receives ONLY active NPC (RESPONDING CHARACTER block)
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

Narrator outputs: text only. Game code derives all mechanics.

For DIALOGUE: WCD → RESPONDING CHARACTER → Location (atmosphere + Tier 1 objects) → Player state → VERBOSITY
For non-DIALOGUE: WCD → NPCS PRESENT → Location → Player state → VERBOSITY

Hard narrator rules (all prompts):
1. Use EXACT stored names for locations, NPCs, objects
2. Only name Tier 1 objects in descriptions
3. Failed checks = evasion, never absence
4. Write only from RESPONDING CHARACTER
5. WCD is absolute truth

---

## Implementation Sequence

### 19A — World Consistency Document ✅ (commit 08322b6)
### 19B — World Bible Redesign 🔄
- Full type hierarchy: WorldBible, RegionBible, LocationDefinition, NPCDefinition, LocationObject
- Location hierarchy: settlement node + 3-6 notable sub-locations
- Replace generateWorldSeed with generateWorldBible
- Real names for all NPCs — remove placeholder system entirely
- applyWorldBible writes all assets and graph nodes
- Progressive loading: WCD → WorldBible → apply → start

### 19C — Ambient Object System
- /lib/game/ambient-objects.ts — Tier 2 library, all location types, all 5 genres
- Tier 2: instant template response
- Tier 3: short narrator ambient call
- Nothing ever disappears or didn't exist

### 19D — Regional Bible (Phase 2)
- generateRegionalBible replaces stub generator
- Background pre-generation on exit discovery
- WCD + existing region summary as context

### 19E — Narrator Constraints + Highlight Overhaul
- Hard narrator rules in ALL system prompts
- Highlight rebuilt: exact Tier 1 match only
- Remove NPC reveal pipeline entirely

### 19F — Three-Tier Map Component
- /components/game/WorldMap.tsx
- Tier 1/2/3 map views, breadcrumb nav, toggleable sidebar

---

## Supabase Tables (post-009 — all applied ✅)
- profiles, game_sessions (+world_seed, +world_graph, +world_consistency, +world_bible)
- world_states (+current_node_id), log_books, characters
- npcs, art_cache (unused), world_assets (+svg_content unused), codex
- Migrations 001-009 all applied

---

## Core Philosophy

- AI generates content once, engine owns it forever
- WCD is the constitution — injected everywhere, never contradicted
- Three-layer generation: WCD → WorldBible → RegionBible
- Three object tiers: Tier 1 (AI, tracked) / Tier 2 (templates) / Tier 3 (narrator ambient)
- Narrator describes, never generates — hard rules enforced
- Names are permanent from birth — no reveal pipeline
- Highlights are exact Tier 1 matches only
- Failed checks = evasion only
- Three-tier map: World / Regional / Local
- NPC movement: static at home_location_id
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

Future genres: Western, Pirate, Superhero, Dark Fantasy, Steampunk

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

*Last updated: Session 58 — V7.1: Day 19A complete. WCD type, route, injection. 4-step wizard. Day 19B starting.*
