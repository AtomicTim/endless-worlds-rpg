# Project: Endless Worlds RPG — Master Context

**Version:** 7.8
**Status:** Active Development — Gameplay Stabilization Complete
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
| 20 | Combat System | ⏳ Pending |
| 21+ | Skills, Background, Factions | ⏳ Pending |

**Active genres:** Fantasy, Cyberpunk, Horror/Lovecraftian, Space Opera, Post-Apocalyptic
**⚠️ Noir has been removed. Do not reference it anywhere in the codebase.**

### Gameplay Stabilization (commit 55f25e6 — 86/86 tests, clean build)
Full 21-issue audit implemented. See /docs/audit-report-gameplay-loop.md for details.

**Issue B** — logic-resolver.ts: intimidating unconditionally rolls STR (dropped the STR≥10 guard)
**Issue J** — useGameLoop: roll-feedback log only warns when stat_checked set but roll missing
**Issue A** — ID normalization (root cause of 29% of all issues):
- codex.ts: removed stripArticles from normalizeLocationId + normalizeAssetId(LOCATION)
- getWorldAssetsForLocation: raw↔stripped fallback for old save backward compat
- logic-resolver.ts: if target slug matches graph node id directly → GRAPH_NAVIGATE (never overwrite canonical ID)
- page.tsx: raw current_location_id used for starting-location lookup (no normalizeLocationId call)
**Area 1** — WorldBible settlement node structure:
- generate-world-bible: skeleton rewritten — first location is type:settlement hub, tavern is sub-location with parent_location_id. Hard rule added forbidding building-as-settlement-node
- apply-world-bible: validation pass coerces building-typed settlement nodes to type:settlement
**Issues C/G/H/P** — NPC resolution cluster (useGameLoop):
- Step 2b-2 extended: pin-to-node-NPC fires when primary_target set but doesn't match any CHARACTER asset (Case 2)
- Step 5 DIALOGUE filter: falls back to filtering CHARACTERs by currentNode.npc_ids when name matching fails
- Step 7g: fourth fallback picks first CHARACTER from currentNode.npc_ids when name-based lookups fail
**Issue F** — prompt-builder: TIER 1 OBJECTS block has imperative wording + exact wrong/right examples + NPC names imperative. Applies on both DIALOGUE and non-DIALOGUE turns.
**Issue E** — generate-regional-bible: maxDuration=300, dynamic=force-dynamic, max_tokens 3000→2000, tight skeleton prompt (1 hub + 2 sub-locations + 3 NPCs)
**Issues K/M** — Graph persistence:
- apply-regional-bible: persists master_state + world_graph after merging new region
- New patchWorldGraph in lib/game/state-persistence.ts
- world-state route accepts optional worldGraph field
- saveWorldGraphAsync called after step 4d, step 7-B, step 7b-2
**Issue L/Area 2** — npc_ids validation: build validNpcIds set from bible.npcs[].id, filter each loc.npc_ids, re-stitch via home_location_id when node ends up with zero valid ids. Applied in both apply routes.
**Cleanup (N, T, U, Q, I)**:
- N: points_of_interest removed from narrator schema, parser, prompt (saves 50-150 tokens/response)
- T: pre-generation hint matching requires "to the north" / "northward" not bare "north"
- U: CHARACTER asset pass-through scoped to same session_id
- Q: npcRegistryKey prefers actual asset.id over re-derived slug
- I: recent_messages log clarified with explicit cap

---

## 🏗️ Architecture — Complete ✅

### Four Layers ✅
**Layer 0 — WCD** — world_consistency jsonb, formatWcdBlock() injected first in all AI calls
**Layer 1 — WorldBible** — world_bible jsonb, settlement hub + sub-locations + NPCs + outlines + main quest
**Layer 2 — RegionBible** — on-demand, maxDuration=300, background pre-generation, deduplication cache
**Layer 3 — Narrator** — YOUR ROLE HARD RULES, TIER 1 OBJECTS verbatim imperative, NPCS PRESENT from graph npc_ids

### Three-Tier Object System ✅
**Tier 1** — AI LocationObjects → key_landmarks → exact highlight → EXAMINE
**Tier 2** — ambient-objects.ts (27 types, all genres) → instant response → no narrator
**Tier 3** — narrator ambient instruction → 1-2 sentences → nothing disappears

### Location Hierarchy ✅
```
Region
└── Settlement Node (type:settlement, town square/crossroads — NEVER a building)
    ├── Sub-location (is_interior: true, e.g. The Lowered Gaze tavern)
    ├── Sub-location (is_interior: true, e.g. Covenant Market)
    └── [non-notable — grey filler blocks on Local Map]
```

### NPC Rules ✅
Real name from birth. name_known always true. No reveal pipeline.
Narrator: use exact NPC names verbatim from NPCS PRESENT.
Graph node npc_ids validated against bible.npcs[].id at apply time.

### Highlight System ✅
Exact whole-word match against key_landmarks (verbatim), NPC names, connected location names, WCD landmarks.
Narrator instructed: use exact names verbatim — wrong/right examples in prompt.

### Three-Tier Map ✅
Tier 1 World / Tier 2 Regional / Tier 3 Local. Toggleable sidebar. Breadcrumb nav.

### Graph Persistence ✅
world_graph persisted: after regional apply, after ZONE_EXPAND, after npc_ids update.
apply-regional-bible persists master_state + world_graph to Supabase.

---

## ⚡ FOUNDATIONAL RULES (Read Before Every Session)

### 1. World Assets Are Permanent
Write-once. ignoreDuplicates: true. AI generates once, engine owns forever.

### 2. Movement Is Graph-Based
GRAPH_NAVIGATE / INTERNAL_DESCRIBE / ZONE_EXPAND / WORLD_EXPLORE. current_node_id is truth.
Location IDs are canonical as generated by WorldBible — never normalize by stripping articles.

### 3. Location Is Authoritative State
current_node_id saved immediately on real moves. INTERNAL_DESCRIBE does NOT update location.

### 4. Actions Are Permitted By Default
Tier 1 → rich AI. Tier 2 → template. Tier 3 → brief ambient. Nothing disappears.

### 5. Objects Mentioned Exist
Nothing ever disappears or "didn't exist." Failed checks = evasion, never absence.

### 6. Dialogue Is Consistent
RESPONDING CHARACTER only. Option tone authoritative. Badge always matches check.
Primary target resolved from graph node.npc_ids — placeholder descriptors redirect to real NPC.
intimidating → STR (unconditional). aggressive → STR. curious → PER. deceptive → CHA+2. persuasive → CHA.

### 7. The AI Has Exactly Three Roles
Generator (Phase 1+2 only) → Bridge (describe only, exact names) → Thread (breadcrumbs)

### 8. WCD Is Absolute Law
Injected first into every AI call. Nothing can contradict it.

### 9. Failed Checks = Evasion Only
NEVER means NPC left or object doesn't exist.

### 10. Highlights Are Exact Tier 1 Matches
Tier 1 objects, NPC names, connected location names, WCD landmarks. Exact whole-word match only.
Narrator instructed to use exact names verbatim.

---

## 🎭 NPC Dialogue System ✅
- RESPONDING CHARACTER only for DIALOGUE (full roster never sent to narrator)
- Placeholder target (e.g. "solitary figure") redirected to real WorldBible NPC via step 2b-2
- Option tone flows modal → submitAction(forcedTone) → resolver
- intimidating always STR, no CHA fallback
- Badge always matches the check that fires
- No reveal pipeline — real names from birth
- Failed checks = evasion, never absence
- npc_ids validated at apply time, re-stitched via home_location_id

## 💰 Trading System (Day 16) ✅
## 🎨 UI System (Direction 3) ✅

---

## Narrator Architecture ✅

For DIALOGUE: WCD → YOUR ROLE HARD RULES → RESPONDING CHARACTER → TIER 1 OBJECTS (verbatim imperative) → ESTABLISHED WORLD ASSETS → SCENE CONTEXT → VERBOSITY
For non-DIALOGUE: WCD → YOUR ROLE HARD RULES → NPCS PRESENT (graph npc_ids only) → TIER 1 OBJECTS (verbatim imperative) → ESTABLISHED WORLD ASSETS → SCENE CONTEXT → VERBOSITY

Hard rules: exact names verbatim, Tier 1 objects only, failed=evasion, RESPONDING CHARACTER for DIALOGUE, WCD absolute, no invented NPCs.
points_of_interest REMOVED from narrator schema (saves 50-150 tokens per response).

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
- world_states: +current_node_id. Migrations 001-009.
- world-state route: accepts optional worldGraph for graph persistence

---

## Core Philosophy
- AI generates content once, engine owns it forever
- WCD is the constitution — injected everywhere, never contradicted
- Settlement node = public hub (square/crossroads) — NEVER a building
- Location IDs are canonical — never strip article prefixes
- Three object tiers: Tier 1 (AI, verbatim names) / Tier 2 (templates) / Tier 3 (ambient)
- Narrator describes with exact names, never generates
- Names permanent from birth — no reveal pipeline
- Highlights are exact Tier 1 matches only
- Failed checks = evasion only
- Graph persisted after every mutation, not just on auto-save
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

*Last updated: Session 65 — V7.8: Full gameplay stabilization. 21-issue audit implemented. ID normalization, NPC resolution, settlement hub structure, graph persistence, stat checks, narrator exact names. Ready for testing then Day 20.*
