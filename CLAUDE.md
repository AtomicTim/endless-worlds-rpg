# Project: Endless Worlds RPG — Master Context

**Version:** 7.4
**Status:** Active Development — World Generation Redesign
**Objective:** To create a truly endless, fully-fledged AI-driven RPG engine — text and SVG based — with persistent worlds, real mechanics, and emergent storytelling. Genre-agnostic, infinitely replayable.

---

## 🔄 Current Status (Read This First)

**Current Phase:** Day 19E — Narrator Constraints + Highlight Overhaul
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
| 19E | Narrator Constraints + Highlight Overhaul | 🔄 In Progress |
| 19F | Three-Tier Map Component | ⏳ Pending |
| 20+ | Combat, Skills, Background | ⏳ Pending |

**Active genres:** Fantasy, Cyberpunk, Horror/Lovecraftian, Space Opera, Post-Apocalyptic
**⚠️ Noir has been removed. Do not reference it anywhere in the codebase.**

### Day 19D Deliverables (commit bd9dbe3 — 86/86 tests, clean build)
- /api/game/generate-regional-bible — WCD-seeded, scales from RegionOutline, real-name NPCs, ambient_type tags, return-direction wired
- /api/game/apply-regional-bible — mirrors apply-world-bible, extends WorldGraph, strips placeholder outline node, bidirectional connections
- /lib/game/regional-bible-cache.ts — module-level cache keyed by sessionId__outlineId, in-flight deduplication, matchRegionOutline 3-pass fuzzy matcher
- Metadata.world_bible added to types/game.ts
- apply-world-bible mirrors WorldBible into metadata.world_bible
- useGameLoop step 4d — WORLD_EXPLORE uses RegionBible (generate + apply), falls back to stub generator on miss
- useGameLoop step 6b — background pre-generation scans narrative text for direction tokens + region names
- clearSessionState calls invalidateRegionalBibleCache()

---

## 🏗️ Architecture Overview

**Full architecture:** /docs/world-generation-architecture.md

### Four Layers
**Layer 0 — WCD ✅** — world_consistency jsonb, injected first in all AI calls
**Layer 1 — WorldBible ✅** — world_bible jsonb, starting region + outlines + main quest
**Layer 2 — RegionBible ✅** — on-demand with background pre-generation, cache with deduplication
**Layer 3 — Narrator 🔄** — hard rules enforced, exact Tier 1 references only

### Three-Tier Object System
**Tier 1 ✅** — AI-generated LocationObjects, tracked world_assets, highlighted in feed
**Tier 2 ✅** — ambient-objects.ts templates (27 types, all genres), instant response, no narrator
**Tier 3 ✅** — narrator ambient instruction, 1-2 sentences, nothing disappears

### Location Hierarchy
```
Region → Settlement Node → Notable Sub-locations (3-6)
       → Adjacent Region Outlines (undiscovered, pre-generated in background)
```

### NPC Rules
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
Only Tier 1 object names, NPC names, connected location names. Exact string match only.

---

## 🎭 NPC Dialogue System
- Narrator receives ONLY active NPC (RESPONDING CHARACTER block)
- Option tone: modal → submitAction(forcedTone) → resolver
- Badge always matches the check that fires
- No reveal pipeline — real names from birth
- Failed checks = evasion, never absence

## 💰 Trading System (Day 16) — Complete
## 🎨 UI System (Direction 3) — Complete

---

## Narrator Architecture

For DIALOGUE: WCD → RESPONDING CHARACTER → Location (atmosphere + Tier 1 objects) → Player state → VERBOSITY
For non-DIALOGUE: WCD → NPCS PRESENT → Location → Player state → VERBOSITY

Hard narrator rules (enforced in ALL prompts):
1. Use EXACT stored names for locations, NPCs, objects
2. Only name Tier 1 objects (from key_landmarks) in descriptions
3. Failed checks = evasion, never absence or disappearance
4. Write only from RESPONDING CHARACTER for DIALOGUE
5. WCD is absolute truth — never contradict it

---

## Implementation Sequence

### 19A ✅ — WCD (commit 08322b6)
### 19B ✅ — WorldBible types + routes + wizard (commit d5b41b0)
### 19C ✅ — Ambient Object System, Tier 2/3 routing (commit 4e7ab6f)
### 19D ✅ — RegionBible routes + cache + WORLD_EXPLORE (commit bd9dbe3)
### 19E 🔄 — Narrator Constraints + Highlight Overhaul
- Hard narrator rules enforced in ALL system prompts (not just some)
- Narrator receives current location's key_landmarks as exact object name list
- Highlight rebuilt: exact match against Tier 1 object names, NPC names, connected location names
- NPC reveal pipeline removed entirely (name_known always true for new NPCs)
- Narrator told: do not introduce named NPCs not in NPCS PRESENT block

### 19F — Three-Tier Map Component
- /components/game/WorldMap.tsx — Tier 1/2/3 views, breadcrumb nav, toggleable sidebar
- WCD landmarks as diamonds on World Map even before discovery
- NPC dots at home_location_id on Local Map

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
- Names are permanent from birth — no reveal pipeline
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
Claude Code pushes → git pull + restart → report → confirm → next prompt.

## Reference Links
- Supabase: https://supabase.com/dashboard
- Anthropic: https://console.anthropic.com
- Vercel: https://vercel.com/dashboard
- Stripe: https://dashboard.stripe.com

---

*Last updated: Session 61 — V7.4: Day 19D complete. RegionBible routes, background pre-generation cache. Day 19E starting.*
