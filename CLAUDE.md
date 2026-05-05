# Project: Endless Worlds RPG — Master Context

**Version:** 6.3
**Status:** Active Development — Phase 2 In Progress
**Objective:** To create a truly endless, fully-fledged AI-driven RPG engine — text and SVG based — with persistent worlds, real mechanics, and emergent storytelling. Genre-agnostic, infinitely replayable.

---

## 🔄 Current Status (Read This First)

**Current Day:** Day 18 — Main Narrative Thread + Verbosity + Feed Visuals
**Local Dev Port:** 3000
**Stack:** Next.js 14 / Tailwind / shadcn/ui / Supabase / Claude API / Stripe / Vercel
**GitHub Repo:** atomictim/endless-worlds-rpg

| Day | Title | Status |
| --- | --- | --- |
| 1–14 | Phase 1 MVP | ✅ Complete |
| 15 | NPC Dialogue + Portraits | ✅ Complete |
| 15.5 | Dialogue consistency + integrity patch | ✅ Complete |
| Narrator simplification | Text+tone only, game code derives mechanics | ✅ Complete |
| 16 | NPC Trading + Item Value | ✅ Complete |
| 17 | World Seed + Location Stub Generator | ✅ Complete |
| World Graph | Persistent connected location graph | ✅ Complete |
| 18 | Narrative Thread + Verbosity + Feed Visuals | 🔄 In Progress |
| 19+ | Combat, Skills, Factions | ⏳ Pending |

**Active genres:** Fantasy, Cyberpunk, Horror/Lovecraftian, Space Opera, Post-Apocalyptic
**⚠️ Noir has been removed. Do not reference it anywhere in the codebase.**

### World Graph Architecture (commit 1434ec0 — 86/86 tests, clean build)

**The core problem it solves:** Location fragmentation, duplicate codex entries, NPC dialogue jumping, sub-area spawning new worlds.

**How it works:**
- World Seed generates a fully-connected graph with explicit node IDs, connections, map positions, and NPC assignments
- Every location is a `WorldNode` with permanent ID, connections[], npc_ids[], and map_position
- Move classifier categorizes every MOVE before the resolver runs:
  - `GRAPH_NAVIGATE` — known connection, instant deterministic navigation
  - `INTERNAL_DESCRIBE` — sub-area language ("go to the bar"), no location change
  - `ZONE_EXPAND` — new sub-area within expandable zone, creates child node
  - `WORLD_EXPLORE` — genuinely new territory, creates new zone node
- NPCs are assigned to graph nodes — narrator receives NPCS PRESENT block, cannot invent extras
- Legacy fallback for old saves (no graph) with log warning

**Migrations applied:** 008_world_graph.sql ✅
- `game_sessions.world_graph jsonb`
- `world_states.current_node_id text`

### Two-Table Model (enforced)
- `world_assets` = narrator's bible — pre-seeded, AI constitution source
- `codex` = player's journal — written on first encounter only

---

## 🗺️ World Graph Architecture

**WorldNode:**
```
id, name, type (zone|sub_location), zone_id,
is_expandable, connections[], npc_ids[], item_ids[],
asset_id, discovered, map_position {x,y}
```

**Move Classification (move-classifier.ts):**
```
GRAPH_NAVIGATE   → known connection, load node assets directly
INTERNAL_DESCRIBE → in-room sub-area, narrator describes, no move
ZONE_EXPAND      → new child node within expandable zone
WORLD_EXPLORE    → new zone, bidirectional connection added
```

**NPC Placement:**
- NPCs assigned to graph nodes at seed time
- Narrator receives exact NPC list for current node
- Dialogue context anchors to node's NPC list
- No NPC invented outside the node's assigned list

**Map (Future):**
- graph.nodes have map_position {x,y}
- Discovered nodes fill in procedurally as player explores
- Enables fog-of-war map in Phase 3

---

## ⚡ FOUNDATIONAL RULES (Read Before Every Session)

### 1. World Assets Are Permanent
Write-once constitution. `ignoreDuplicates: true`. SVG backfilled separately.

### 2. Movement Is Graph-Based
MOVE always succeeds. Move classifier determines type before resolver runs.
`current_node_id` is the single source of truth for player location.

### 3. Location Is Authoritative State
`current_node_id` always correct. Saved immediately on real moves.
`INTERNAL_DESCRIBE` moves do NOT update location.

### 4. Actions Are Permitted By Default
Plausible actions always attempted. Narrator describes outcomes only.

### 5. Objects Mentioned Exist
EXAMINE/INTERACT resolver confirms object_confirmed=true.

### 6. Dialogue Is Consistent
NPC context anchored to current graph node's npc_ids.
Tone → stat check (game code). Badge shows real player stat.

### 7. The AI Has Exactly Three Roles
**Generator:** Invents sensory detail within World Seed guardrails. Locked immediately.
**Bridge:** Describes mechanical outcomes. Never decides outcomes or invents NPCs.
**Thread:** Plants quest breadcrumbs. Never forces or blocks.

---

## 🌱 World Generation System

**At game start:**
1. `generateWorldSeed()` — AI generates world skeleton with connections, positions, NPC assignments
2. `applyWorldSeed()` — writes world_assets + builds WorldGraph + sets starting node
3. World is fully navigable before player's first action

**On MOVE:**
- `classifyMove()` runs first — determines GRAPH_NAVIGATE / INTERNAL_DESCRIBE / ZONE_EXPAND / WORLD_EXPLORE
- GRAPH_NAVIGATE: load node assets by ID — deterministic, no ambiguity
- ZONE_EXPAND: create sub_location node, link to parent zone
- WORLD_EXPLORE: AI generates new zone node, add to graph bidirectionally
- INTERNAL_DESCRIBE: narrator describes sub-area, location unchanged

**On first NPC dialogue:**
- `seedNpcRegistry()` — creates registry entry
- Codex entry written from world_asset constitution

---

## 🎭 NPC Dialogue System (Complete)
- NPCs assigned to graph nodes — narrator cannot invent extras
- Tone → stat check (game code only), badge shows real player stat
- justRevealedName prevents step 7g overwriting step 7d reveal
- clearDialogueOptions() on real moves and non-dialogue actions
- NPC context switch when primary_target differs from currentDialogueNpc

## 💰 Trading System (Day 16 — Complete)
- Merchant keyword detection → trade_available → items_for_sale
- TradeModal: Buy full value, Sell 50%. Null-safe.

---

## Narrator Architecture

**Narrator outputs: text + simple values. Game code derives: all mechanics.**

Prompt structure (in order):
1. WORLD FACTS block (world name, tagline, factions)
2. NPCS PRESENT AT THIS LOCATION (from graph node npc_ids)
3. ESTABLISHED WORLD ASSETS (current location first)
4. PLAYER STATE header
5. SCENE CONTEXT (move_type, ARRIVING/PRESENT)
6. Resolution context, stats, loadout, recent log

---

## Immediate Persistence Architecture
- Log entries + recent_messages: after every narrative action
- World state + current_node_id: after every real MOVE
- world_graph: after every node creation or discovery
- npc_registry: immediately patched to store on seed
- locationAssets: loaded by node asset_id — deterministic
- Full state: every 10 actions

---

## Planned Systems

| System | When | Description |
| --- | --- | --- |
| Narrative Thread + Verbosity + Feed Visuals | Day 18 | Breadcrumbs, verbosity toggle, visual overhaul |
| Combat System | Day 19 | Turn-based, enemy AI, loot |
| Skills & Abilities | Day 20 | Skill trees, attribute thresholds |
| Character Background | Phase 3 | Traits, history, faction rep |
| Procedural Map | Phase 3 | Graph nodes → fog-of-war map |
| Art Engine Overhaul | Phase 3 (Day 25+) | Templates + CC0 sprites |

---

## Supabase Tables (all applied ✅)
- `profiles`, `game_sessions` (+world_seed, +world_graph), `characters`
- `world_states` (+current_node_id), `log_books`, `npcs`
- `subscriptions`, `community_templates`, `user_preferences`
- `art_cache`, `world_assets` (+svg_content, +name_known), `codex`
- Migrations 001-008 all applied

---

## Core Philosophy

- **Hybrid Authority:** Code = Truth, AI = narrator of code-owned facts
- **World Graph:** persistent connected nodes, deterministic navigation
- **AI generates content once, engine owns it forever**
- **Move classifier:** GRAPH_NAVIGATE / INTERNAL_DESCRIBE / ZONE_EXPAND / WORLD_EXPLORE
- **NPCs belong to nodes** — never invented by narrator
- **Narrator outputs text + simple values only**
- **Codex populates through play, never pre-populated**
- Truly endless — graph grows as player explores

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

| Genre | Tone | Palette | Currency | HP |
| --- | --- | --- | --- | --- |
| Fantasy | Epic, mythic | Amber/green | Gold | HP |
| Cyberpunk | Terse, neon | Cyan/magenta | Credits | Integrity |
| Horror/Lovecraftian | Cosmic dread | Green/purple | None | Sanity+HP |
| Space Opera | Grand, operatic | Purple/silver | Stellar Units | Hull Integrity |
| Post-Apocalyptic | Bleak, dark humor | Rust/ash | Caps | HP |

Future genres: Western, Pirate, Superhero, Dark Fantasy, Steampunk

---

## Monetization

| Feature | Free | Adventurer ($6.99) | Legend ($14.99) |
| --- | --- | --- | --- |
| Genres | Fantasy | All 5 | All 5 + future |
| Save Slots | 1 | 3 | Unlimited |
| AI Actions/Day | 50 | Unlimited | Unlimited |
| Art | Basic SVG | Enhanced | Enhanced + Custom |
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

*Last updated: Session 54 — V6.3: World Graph architecture complete. Migration 008 applied. Day 18 starting.*
