# Project: Endless Worlds RPG — Master Context

**Version:** 7.3
**Status:** Active Development — World Generation Redesign
**Objective:** To create a truly endless, fully-fledged AI-driven RPG engine — text and SVG based — with persistent worlds, real mechanics, and emergent storytelling. Genre-agnostic, infinitely replayable.

---

## 🔄 Current Status (Read This First)

**Current Phase:** Day 19D — Regional Bible (Phase 2)
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
| 19D | Regional Bible (Phase 2) | 🔄 In Progress |
| 19E | Narrator Constraints + Highlight Overhaul | ⏳ Pending |
| 19F | Three-Tier Map Component | ⏳ Pending |
| 20+ | Combat, Skills, Background | ⏳ Pending |

**Active genres:** Fantasy, Cyberpunk, Horror/Lovecraftian, Space Opera, Post-Apocalyptic
**⚠️ Noir has been removed. Do not reference it anywhere in the codebase.**

### Day 19C Deliverables (commit 4e7ab6f — 86/86 tests, clean build)
- /lib/game/ambient-objects.ts — 27 ambient_type keys, all 5 genres, findAmbientResponse(), AMBIENT_TYPES
- WorldAssetConstitution.ambient_type added to types/game.ts
- apply-world-bible writes ambient_type to location world_asset constitution
- useGameLoop step 4c — Tier 2 short-circuit for EXAMINE/INTERACT (no narrator call, instant response)
- prompt-builder — Tier 1 vs Tier 3 split: key_landmarks get object pinning, others get ambient instruction

---

## 🏗️ Architecture Overview

**Full architecture:** /docs/world-generation-architecture.md

### Four Layers
**Layer 0 — WCD ✅** — world_consistency jsonb, injected first in all AI calls
**Layer 1 — WorldBible ✅** — world_bible jsonb, starting region + outlines + main quest
**Layer 2 — RegionBible 🔄** — on-demand, background pre-generation on exit discovery
**Layer 3 — Narrator ⏳** — hard rules enforced, exact Tier 1 references only

### Three-Tier Object System
**Tier 1 ✅** — AI-generated LocationObjects, tracked world_assets, highlighted in feed
**Tier 2 ✅** — ambient-objects.ts templates, instant response, never highlighted, no narrator
**Tier 3 ✅** — narrator ambient instruction, 1-2 sentences, nothing disappears

### Location Hierarchy
```
Region → Settlement Node → Notable Sub-locations (3-6)
       → Adjacent Region Outlines (undiscovered)
```
Notable sub-locations: 3-6 per settlement. NPCs: 1-3 per sub-location. Tier 1 objects: 3-5 per sub-location.

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

Hard rules: exact names, Tier 1 objects only, failed checks = evasion, RESPONDING CHARACTER only, WCD absolute.

---

## Implementation Sequence

### 19A ✅ — WCD type, generate-wcd, injection (commit 08322b6)
### 19B ✅ — WorldBible types, generate-world-bible, apply-world-bible, 5-step wizard (commit d5b41b0)
### 19C ✅ — Ambient Object System, 27 types, Tier 2/3 routing (commit 4e7ab6f)
### 19D 🔄 — Regional Bible (Phase 2)
- /api/game/generate-regional-bible — WCD-seeded, expands RegionOutline to RegionBible
- /api/game/apply-regional-bible — writes all locations, NPCs, objects as world_assets, extends WorldGraph
- Background pre-generation: fires when player discovers a region exit
- "Entering [region_name]..." loading indicator if player crosses before generation completes
- Replaces old stub generator for WORLD_EXPLORE moves

### 19E — Narrator Constraints + Highlight Overhaul
- Hard narrator rules in ALL system prompts
- Highlight rebuilt: exact Tier 1 match only
- Remove NPC reveal pipeline entirely

### 19F — Three-Tier Map Component
- /components/game/WorldMap.tsx — Tier 1/2/3 views, breadcrumb nav, toggleable sidebar

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

*Last updated: Session 60 — V7.3: Day 19C complete. Ambient Object System, 27 types, Tier 2/3 routing. Day 19D starting.*
