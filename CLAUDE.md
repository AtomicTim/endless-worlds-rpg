# Project: Endless Worlds RPG — Master Context

**Version:** 6.4
**Status:** Active Development — Phase 2 In Progress
**Objective:** To create a truly endless, fully-fledged AI-driven RPG engine — text and SVG based — with persistent worlds, real mechanics, and emergent storytelling. Genre-agnostic, infinitely replayable.

---

## 🔄 Current Status (Read This First)

**Current Day:** Day 19 — Combat System
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
| 18 | Graph fixes, verbosity, Direction 3 UI, art removal | ✅ Complete |
| 19 | Combat System | 🔄 In Progress |
| 20+ | Skills, Factions, Background | ⏳ Pending |

**Active genres:** Fantasy, Cyberpunk, Horror/Lovecraftian, Space Opera, Post-Apocalyptic
**⚠️ Noir has been removed. Do not reference it anywhere in the codebase.**

### Day 18 Deliverables (commits 0c86697 + 4df0c08)

**Graph fixes:**
- TYPE_KEYWORDS map covering all 5 genres — type-based GRAPH_NAVIGATE matching
- INTERNAL_DESCRIBE_PATTERNS expanded — vertical movement + interior areas all genres
- NPC location guard — clears dialogue when active NPC not at current node
- Empty-node narrator instruction — no invented characters when node has no NPCs
- Stat check hard validation in resolveDialogue + null-path logging in buildRollFeedback

**Verbosity toggle:**
- `verbosity: 'terse' | 'standard' | 'rich'` in game-store (localStorage-hydrated)
- RESPONSE LENGTH block appended to narrator system prompt
- VerbosityToggle component in GameLayout header (genre-primary active state)

**Direction 3 UI overhaul (all 5 genres):**
- `components/game/genre-ui.ts` — single source of truth for genre colors, currency, HP labels
- StoryFeed: arrival header (◈ Name with dividers), mono prose, NPC quote-blocks, stat-check receipts, system events
- DialogueModal: accent-bar option buttons (4px tone bar), stat badge right, NPC name in genre primary
- InventoryPanel, TradeModal, CharacterSheet: currency + HP labels from getGenreColors
- Horror null currency hides currency display entirely
- useGameLoop stamps metadata.locationName on MOVE_SUCCESS NARRATIVE messages

**Art system removed (commit 4df0c08):**
- art-generator.ts deleted
- /api/game/generate-art route deleted
- artCache and currentAsciiArt removed from game-store
- All [GameLoop/art] steps removed from useGameLoop
- updateWorldAssetSvg removed from codex.ts
- SceneArt.tsx replaced with genre-themed placeholder (location name + category)
- svg_content column and art_cache table kept in DB for future reimplementation

---

## 🎨 Art System (Removed — To Be Reimplemented)

SVG generation removed. SceneArt shows a placeholder panel with location name and type.
Future options: static pixel art asset library (CC0) + Replicate API for premium tier.
DB columns (svg_content, art_cache table) preserved for when art is reimplemented.
Do NOT re-add any AI-based SVG or ASCII art generation.

---

## 🗺️ World Graph Architecture

**WorldNode:** id, name, type, zone_id, is_expandable, connections[], npc_ids[], asset_id, discovered, map_position, category?

**Move Classification (move-classifier.ts):**
- GRAPH_NAVIGATE → name match OR type-keyword match (single connection) — deterministic
- INTERNAL_DESCRIBE → in-room/vertical sub-area, narrator describes, no location change
- ZONE_EXPAND → new child node within expandable zone
- WORLD_EXPLORE → new zone, bidirectional connection added

**TYPE_KEYWORDS covers all genres:**
- Fantasy: tavern, settlement, dungeon, stronghold, wilderness, market
- Cyberpunk: data-hub, corp-zone, slum, bar
- Space Opera: station, ship, colony
- Horror: mansion, street
- Post-Apocalyptic: shelter, wasteland

**NPC Placement:** NPCs assigned to graph nodes. Narrator receives NPCS PRESENT block. Cannot invent NPCs not in node.

---

## ⚡ FOUNDATIONAL RULES (Read Before Every Session)

### 1. World Assets Are Permanent
Write-once constitution. `ignoreDuplicates: true`.

### 2. Movement Is Graph-Based
Move classifier runs before resolver. `current_node_id` is single source of truth.

### 3. Location Is Authoritative State
`current_node_id` saved immediately on real moves. INTERNAL_DESCRIBE does NOT update location.

### 4. Actions Are Permitted By Default
Plausible actions always attempted. Narrator describes outcomes only.

### 5. Objects Mentioned Exist
EXAMINE/INTERACT resolver confirms object_confirmed=true.

### 6. Dialogue Is Consistent
NPC context anchored to current node's npc_ids. Tone → stat check (game code). Badge shows real stat. NPC cleared when player leaves node.

### 7. The AI Has Exactly Three Roles
**Generator:** Invents content within World Seed guardrails. Locked immediately.
**Bridge:** Describes outcomes. Never invents NPCs or speaks for player.
**Thread:** Plants quest breadcrumbs. Never forces or blocks.

---

## 🌱 World Generation System

**At game start:** generateWorldSeed() → applyWorldSeed() → world_assets + WorldGraph pre-populated
**On MOVE:** classifyMove() → GRAPH_NAVIGATE (deterministic) / ZONE_EXPAND / WORLD_EXPLORE
**On first NPC dialogue:** seedNpcRegistry() + codex entry from world_asset

---

## 🎭 NPC Dialogue System (Complete)
- NPCs assigned to graph nodes — narrator cannot invent extras
- Tone → stat check (game code only), badge shows real current stat
- NPC cleared from dialogue when player moves to node without them
- justRevealedName prevents step 7g overwriting step 7d reveal
- All stat check fields validated; null path logged

## 💰 Trading System (Day 16 — Complete)
- Merchant keyword detection → trade_available → items_for_sale
- TradeModal: Buy full value, Sell 50%
- Currency label from getGenreColors — genre-accurate everywhere

## 🎨 UI System (Direction 3 — Complete)
- genre-ui.ts: getGenreColors(genre) — single source of truth
- All accent colors, HP labels, currency labels derive from GENRE_CONFIGS
- StoryFeed: arrival headers, NPC quote-blocks, stat-check receipts, system events
- DialogueModal: accent-bar buttons by tone color
- VerbosityToggle: Terse / Standard / Rich in header

---

## Narrator Architecture

**Narrator outputs: text + simple values. Game code derives: all mechanics.**

Prompt structure (in order):
1. WORLD FACTS block
2. NPCS PRESENT AT THIS LOCATION (from graph node npc_ids)
3. ESTABLISHED WORLD ASSETS (current location first)
4. PLAYER STATE header
5. SCENE CONTEXT (move_type, ARRIVING/PRESENT)
6. VERBOSITY block (last — terse/standard/rich)

---

## Tone → Stat Check / Badge / Accent Bar Color
| Tone | Stat | Badge | Accent Bar |
| --- | --- | --- | --- |
| persuasive | CHA | 💬 CHA | purple #8844cc |
| deceptive | CHA +2 | 💬 CHA | yellow #aaaa22 |
| aggressive/intimidating | STR | 💪 STR | red #cc4422 |
| curious | PER | 👁 PER | blue #4488cc |
| friendly | none | none | green #22aa44 |
| neutral | none | none | slate #334455 |

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
| Combat System | Day 19 | Turn-based, enemy AI, loot |
| Skills & Abilities | Day 20 | Skill trees, attribute thresholds |
| Character Background | Phase 3 | Traits, history, faction rep |
| Procedural Map | Phase 3 | Graph nodes → fog-of-war map |
| Art System | Phase 3 | Static pixel art library + Replicate API premium |

---

## Supabase Tables (all applied ✅)
- `profiles`, `game_sessions` (+world_seed, +world_graph), `characters`
- `world_states` (+current_node_id), `log_books`, `npcs`
- `art_cache` (kept, unused), `world_assets` (+svg_content kept, unused), `codex`
- Migrations 001-008 all applied

---

## Core Philosophy

- **Hybrid Authority:** Code = Truth, AI = narrator of code-owned facts
- **World Graph:** persistent nodes, deterministic navigation, NPCs belong to nodes
- **Three-layer model:** World Seed → AI detail → permanent lock → narrator describes
- **Narrator outputs text + simple values only**
- **Genre-aware UI:** all colors, labels, currency from GENRE_CONFIGS via genre-ui.ts
- **Art deferred:** placeholder panel, DB columns preserved, clean reimplementation later

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

*Last updated: Session 55 — V6.4: Day 18 complete. Graph type matching, UI Direction 3 all genres, verbosity toggle, art system cleanly removed. Day 19 starting.*
