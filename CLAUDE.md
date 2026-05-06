# Project: Endless Worlds RPG — Master Context

**Version:** 7.9
**Status:** Active Development — Gameplay Stabilization Round 2
**Objective:** To create a truly endless, fully-fledged AI-driven RPG engine — text and SVG based — with persistent worlds, real mechanics, and emergent storytelling. Genre-agnostic, infinitely replayable.

---

## 🔄 Current Status (Read This First)

**Current Phase:** Testing stabilization, then Day 20 — Combat System
**Local Dev Port:** 3000
**Stack:** Next.js 14 / Tailwind / shadcn/ui / Supabase / Claude API / Stripe / Vercel
**GitHub Repo:** atomictim/endless-worlds-rpg

| Phase | Title | Status |
| --- | --- | --- |
| 1–14 | Phase 1 MVP | ✅ Complete |
| 15–18 | Dialogue, UI, World Graph, Systems Audit | ✅ Complete |
| 19A–19F | World Generation Architecture | ✅ Complete |
| Gameplay Audit | 21-issue audit + full stabilization | ✅ Complete |
| Stabilization Round 2 | Connection validation, pre-load, look-around, codex notify | ✅ Complete |
| 20 | Combat System | ⏳ Pending |
| 21+ | Skills, Background, Factions | ⏳ Pending |

**Active genres:** Fantasy, Cyberpunk, Horror/Lovecraftian, Space Opera, Post-Apocalyptic
**⚠️ Noir has been removed. Do not reference it anywhere in the codebase.**

### Stabilization Round 2 (commit bde032b — 86/86 tests, clean build)

**Fix 1 — WorldBible connection ID validation:**
apply-world-bible + apply-regional-bible: build validLocationIds set per region. Each location's connections[] filtered against it. Dropped IDs are warn-logged. apply-regional-bible set also includes existingGraph.nodes so the back-link to origin region survives. Prevents WORLD_EXPLORE duplicates from typo'd/aliased connection IDs.

**Fix 2 — Pre-load assets BEFORE narrator runs on ARRIVING:**
useGameLoop step 5: synchronous await getWorldAssetsForLocation() when location_status === ARRIVING before narrateAction call. NPCS PRESENT and TIER 1 OBJECTS now correctly populated on first visit. Step 7c fire-and-forget still runs for subsequent beats.

**Fix 3 — "Approach person" → INTERNAL_DESCRIBE:**
move-classifier.ts: walk up to / approach / step toward / move toward (the) (woman|man|figure|person|stranger|knight|guard|merchant|innkeeper|bartender|clerk|vendor) added to INTERNAL_DESCRIBE_PATTERNS. "Walk up to the knight" no longer creates a phantom location.

**Fix 4 — CONNECTED LOCATIONS block for look-around:**
prompt-builder.ts: when action is EXAMINE or inferred_intent matches surroundings|look around|take in|scan|survey, narrator user prompt appends CONNECTED LOCATIONS block built from currentNode.connections (each resolved to WorldNode.name) + NPCs at this location line. Narrator told to use exact names only.

**Fix 5 — Codex notifications in story feed:**
useGameLoop: store.addMessage("✦ [Name] added to codex") added after every codex save in step 7b (NOTABLE/MAJOR entries), step 7c (location on first arrival), step 7g (NPC on first dialogue). Styled as SYSTEM message — italic amber per Direction 3 UI.

**Fix 6 — Verbosity toggle measurable + verified:**
VerbosityToggle: console.log on click. useGameLoop: console.log before narrateAction. prompt-builder: console.log when verbosity block added. VERBOSITY_BLOCKS rewritten with concrete sentence caps: terse = max 2/3/4, standard = 3-4/4-5/5-7, rich = 5-7/6-8/8-12. Block appended LAST so caps are final instruction the model reads.

---

## 🏗️ Architecture — Complete ✅

### Four Layers ✅
**Layer 0 — WCD** — world_consistency jsonb, formatWcdBlock() injected first in all AI calls
**Layer 1 — WorldBible** — world_bible jsonb, settlement hub + sub-locations + NPCs + outlines + main quest
**Layer 2 — RegionBible** — on-demand, maxDuration=300, background pre-generation, deduplication cache
**Layer 3 — Narrator** — YOUR ROLE HARD RULES, TIER 1 OBJECTS verbatim imperative, NPCS PRESENT from graph npc_ids, CONNECTED LOCATIONS on look-around

### Three-Tier Object System ✅
**Tier 1** — AI LocationObjects → key_landmarks → exact highlight → EXAMINE
**Tier 2** — ambient-objects.ts (27 types, all genres) → instant response → no narrator
**Tier 3** — narrator ambient instruction → 1-2 sentences → nothing disappears

### Location Hierarchy ✅
```
Region
└── Settlement Node (type:settlement, town square/crossroads — NEVER a building)
    ├── Sub-location (is_interior: true)
    ├── Sub-location (is_interior: true)
    └── [non-notable — grey filler blocks on Local Map]
```
Connection IDs validated against location IDs at apply time. Bad IDs dropped and warn-logged.

### NPC Rules ✅
Real name from birth. name_known always true. No reveal pipeline.
Narrator: use exact NPC names verbatim. NPCs highlighted on first arrival (pre-load fix).
"Walk up to person" → INTERNAL_DESCRIBE, not MOVE.

### Narrator Prompt Order ✅
For DIALOGUE: WCD → HARD RULES → RESPONDING CHARACTER → TIER 1 OBJECTS → WORLD ASSETS → SCENE CONTEXT → VERBOSITY
For non-DIALOGUE: WCD → HARD RULES → NPCS PRESENT → TIER 1 OBJECTS → CONNECTED LOCATIONS (on look) → WORLD ASSETS → SCENE CONTEXT → VERBOSITY

### Verbosity ✅
- Terse: max 2 sentences routine / 3 NPC / 4 arrival
- Standard: 3-4 / 4-5 / 5-7
- Rich: 5-7 / 6-8 / 8-12
Block appended LAST in system prompt.

### Codex Notifications ✅
"✦ [Name] added to codex" SYSTEM message fires on: NOTABLE/MAJOR codex entry saves, location first arrival, NPC first dialogue.

---

## ⚡ FOUNDATIONAL RULES (Read Before Every Session)

### 1. World Assets Are Permanent
Write-once. ignoreDuplicates: true. AI generates once, engine owns forever.

### 2. Movement Is Graph-Based
GRAPH_NAVIGATE / INTERNAL_DESCRIBE / ZONE_EXPAND / WORLD_EXPLORE. current_node_id is truth.
Location IDs canonical — never strip article prefixes.
Connection IDs validated at apply time. "Walk up to person" → INTERNAL_DESCRIBE.

### 3. Location Is Authoritative State
current_node_id saved immediately on real moves. INTERNAL_DESCRIBE does NOT update location.

### 4. Actions Are Permitted By Default
Tier 1 → rich AI. Tier 2 → template. Tier 3 → brief ambient. Nothing disappears.

### 5. Objects Mentioned Exist
Nothing ever disappears or "didn't exist." Failed checks = evasion, never absence.

### 6. Dialogue Is Consistent
RESPONDING CHARACTER only. Option tone authoritative. Badge always matches check.
Placeholder descriptors redirect to real WorldBible NPC via step 2b-2.
intimidating → STR. aggressive → STR. curious → PER. deceptive → CHA+2. persuasive → CHA.

### 7. The AI Has Exactly Three Roles
Generator (Phase 1+2 only) → Bridge (describe only, exact names) → Thread (breadcrumbs)

### 8. WCD Is Absolute Law
Injected first into every AI call. Nothing can contradict it.

### 9. Failed Checks = Evasion Only
NEVER means NPC left or object doesn't exist.

### 10. Highlights Are Exact Tier 1 Matches
Tier 1 objects, NPC names, connected location names, WCD landmarks. Exact whole-word match.
Narrator instructed to use exact names verbatim.

---

## 🎭 NPC Dialogue System ✅
- Assets pre-loaded before narrator on ARRIVING — NPCs visible on first visit
- RESPONDING CHARACTER only for DIALOGUE
- Placeholder targets redirect to real WorldBible NPC via step 2b-2
- Option tone: modal → submitAction(forcedTone) → resolver
- intimidating always STR, no CHA fallback
- Badge always matches the check that fires
- No reveal pipeline — real names from birth
- Failed checks = evasion, never absence
- npc_ids validated + re-stitched at apply time

## 💰 Trading System (Day 16) ✅
## 🎨 UI System (Direction 3) ✅

---

## Planned Systems

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
- world_states: +current_node_id. world-state route accepts optional worldGraph.
- Migrations 001-009.

---

## Core Philosophy
- AI generates content once, engine owns it forever
- WCD is the constitution — injected everywhere, never contradicted
- Settlement node = public hub (square/crossroads) — NEVER a building
- Location IDs canonical — never strip article prefixes
- Connection IDs validated at apply time — no phantom locations from bad references
- Assets pre-loaded before narrator on ARRIVING — NPCs visible on first visit
- "Walk up to person" = INTERNAL_DESCRIBE, not MOVE
- Look-around receives CONNECTED LOCATIONS block with exact WorldBible names
- Codex notifications in feed on every new entry
- Verbosity has concrete sentence caps, appended last
- Three object tiers: Tier 1 (AI, verbatim) / Tier 2 (templates) / Tier 3 (ambient)
- Narrator describes with exact names, never generates
- Highlights are exact Tier 1 matches only
- Failed checks = evasion only
- Graph persisted after every mutation
- DnD freedom: player can try anything, engine routes appropriately

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

*Last updated: Session 66 — V7.9: Stabilization Round 2. Connection validation, pre-load assets on ARRIVING, approach-person INTERNAL_DESCRIBE, CONNECTED LOCATIONS on look-around, codex notifications, verbosity concrete caps.*
