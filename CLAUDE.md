# Project: Endless Worlds RPG — Master Context

**Version:** 7.2
**Status:** Active Development — World Generation Redesign
**Objective:** To create a truly endless, fully-fledged AI-driven RPG engine — text and SVG based — with persistent worlds, real mechanics, and emergent storytelling. Genre-agnostic, infinitely replayable.

---

## 🔄 Current Status (Read This First)

**Current Phase:** Day 19C — Ambient Object System
**Local Dev Port:** 3000
**Stack:** Next.js 14 / Tailwind / shadcn/ui / Supabase / Claude API / Stripe / Vercel
**GitHub Repo:** atomictim/endless-worlds-rpg

| Phase | Title | Status |
| --- | --- | --- |
| 1–14 | Phase 1 MVP | ✅ Complete |
| 15–18 | Dialogue, UI, World Graph, Systems Audit | ✅ Complete |
| 19A | World Consistency Document | ✅ Complete |
| 19B | World Bible Redesign | ✅ Complete |
| 19C | Ambient Object System | 🔄 In Progress |
| 19D | Regional Bible (Phase 2) | ⏳ Pending |
| 19E | Narrator Constraints + Highlight Overhaul | ⏳ Pending |
| 19F | Three-Tier Map Component | ⏳ Pending |
| 20+ | Combat, Skills, Background | ⏳ Pending |

**Active genres:** Fantasy, Cyberpunk, Horror/Lovecraftian, Space Opera, Post-Apocalyptic
**⚠️ Noir has been removed. Do not reference it anywhere in the codebase.**

### Day 19B Deliverables (commit d5b41b0 — 86/86 tests, clean build)
- LocationObject, LocationDefinition, NPCDefinition, RegionExit, QuestBreadcrumb, MainQuest, RegionOutline, RegionBible, WorldBible types added
- Metadata.main_quest optional field added
- /api/game/generate-world-bible — POST, WCD-seeded, 4000 tokens, retry + validation
- /api/game/apply-world-bible — writes all locations, NPCs, objects as world_assets, builds WorldGraph, patches master_state
- /app/game/new/page.tsx — 5-step wizard using WorldBible flow
- Legacy WorldSeed routes preserved for old saves

---

## 🏗️ Architecture Overview

**Full architecture documented in:** /docs/world-generation-architecture.md

### Four Layers

**Layer 0 — WCD ✅** — world_consistency jsonb, injected into all AI calls
**Layer 1 — WorldBible ✅** — world_bible jsonb, starting region + adjacent outlines + main quest
**Layer 2 — RegionBible ⏳** — on-demand for new regions, background pre-generation
**Layer 3 — Narrator ⏳** — hard rules enforced, exact Tier 1 references only

### Three-Tier Object System

**Tier 1 — AI-generated (WorldBible):** LocationObject, tracked as world_assets, highlighted in feed, meaningful interactions. 3-5 per sub-location.

**Tier 2 — Code templates (ambient-objects.ts):** Every location type has a built-in library. Instant responses. Never highlighted. No AI call. No game state change.

**Tier 3 — Narrator ambient:** Brief narrator call for anything not in Tier 1 or 2. "Nothing of particular note." Never says object disappeared.

### Location Hierarchy

```
Region
└── Settlement Node (is_settlement_node: true)
    ├── Sub-location (is_interior: true, parent_location_id set)
    │   ├── Tier 1 objects (LocationObject[], highlighted)
    │   └── Tier 2 ambient (from ambient-objects.ts, never highlighted)
    └── [non-notable buildings = ambient grey blocks on Local Map]
```

### NPC Rules
- Real name from birth — no placeholders ever
- name_known always true for WorldBible NPCs
- Narrator introduces atmospherically then names in same paragraph
- No reveal pipeline

---

## ⚡ FOUNDATIONAL RULES (Read Before Every Session)

### 1. World Assets Are Permanent
Write-once. ignoreDuplicates: true. AI generates once, engine owns forever.

### 2. Movement Is Graph-Based
GRAPH_NAVIGATE / INTERNAL_DESCRIBE / ZONE_EXPAND / WORLD_EXPLORE.
current_node_id is single source of truth.

### 3. Location Is Authoritative State
current_node_id saved immediately on real moves. INTERNAL_DESCRIBE does NOT update location.

### 4. Actions Are Permitted By Default
Tier 1 → rich AI response. Tier 2 → template. Tier 3 → brief narrator ambient. Nothing disappears.

### 5. Objects Mentioned Exist
Nothing ever disappears or "didn't exist." Failed checks = evasion, never absence.

### 6. Dialogue Is Consistent
RESPONDING CHARACTER only. Option tone authoritative. Badge matches check. Real names from birth.

### 7. The AI Has Exactly Three Roles
Generator (Phase 1+2 only) → Bridge (describe only) → Thread (breadcrumbs)

### 8. WCD Is Absolute Law
Injected first into every AI call. Nothing can contradict it.

### 9. Failed Checks = Evasion Only
Failed check = NPC guarded/unhelpful. NEVER means NPC left or object doesn't exist.

### 10. Highlights Are Exact Tier 1 Matches
Only Tier 1 object names, NPC names, connected location names. Exact string match only.

---

## 🎭 NPC Dialogue System
- Narrator receives ONLY active NPC (RESPONDING CHARACTER block)
- Option tone: modal → submitAction(forcedTone) → resolver
- Badge always matches the check that fires
- No reveal pipeline — real names from birth
- Failed checks = evasion, never absence

## 💰 Trading System (Day 16)
- Merchant keyword → trade_available → items_for_sale
- TradeModal: Buy full / Sell 50%. Currency from getGenreColors.

## 🎨 UI System (Direction 3)
- genre-ui.ts: getGenreColors — single source of truth
- StoryFeed: arrival headers, NPC quote-blocks, stat-check receipts
- DialogueModal: accent-bar buttons, stat badge matches resolver
- VerbosityToggle: Terse / Standard / Rich

---

## Narrator Architecture

For DIALOGUE: WCD → RESPONDING CHARACTER → Location (atmosphere + Tier 1 objects) → Player state → VERBOSITY
For non-DIALOGUE: WCD → NPCS PRESENT → Location → Player state → VERBOSITY

Hard rules (all prompts):
1. Exact stored names for locations, NPCs, objects
2. Only name Tier 1 objects in descriptions
3. Failed checks = evasion, never absence
4. Write only from RESPONDING CHARACTER
5. WCD is absolute truth

---

## Implementation Sequence

### 19A ✅ — WCD type, generate-wcd route, injection
### 19B ✅ — WorldBible types, generate-world-bible, apply-world-bible, 5-step wizard
### 19C 🔄 — Ambient Object System
- /lib/game/ambient-objects.ts — Tier 2 library all location types all 5 genres
- Tier 2 router in useGameLoop — instant template response for known ambient objects
- Tier 3 router — short narrator ambient call for unknown objects
- Nothing ever disappears or "didn't exist"

### 19D — Regional Bible (Phase 2)
- generateRegionalBible replaces stub generator
- Background pre-generation on exit discovery

### 19E — Narrator Constraints + Highlight Overhaul
- Hard narrator rules in ALL system prompts
- Highlight rebuilt: exact Tier 1 match only
- Remove NPC reveal pipeline entirely

### 19F — Three-Tier Map Component
- /components/game/WorldMap.tsx
- Tier 1/2/3 views, breadcrumb nav, toggleable sidebar

---

## Supabase Tables (all applied ✅)
- game_sessions: +world_seed, +world_graph, +world_consistency, +world_bible
- world_states: +current_node_id
- Migrations 001-009 all applied

---

## Core Philosophy

- AI generates content once, engine owns it forever
- WCD is the constitution — injected everywhere, never contradicted
- Three-layer generation: WCD → WorldBible → RegionBible
- Three object tiers: Tier 1 (AI) / Tier 2 (templates) / Tier 3 (ambient narrator)
- Narrator describes, never generates
- Names are permanent from birth
- Highlights are exact Tier 1 matches only
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
Claude Code pushes → git pull + restart server → report to Claude.ai → checklist → confirm → next prompt.

## Reference Links
- Supabase: https://supabase.com/dashboard
- Anthropic: https://console.anthropic.com
- Vercel: https://vercel.com/dashboard
- Stripe: https://dashboard.stripe.com

---

*Last updated: Session 59 — V7.2: Day 19B complete. WorldBible types, generate-world-bible, apply-world-bible, 5-step wizard. Day 19C starting.*
