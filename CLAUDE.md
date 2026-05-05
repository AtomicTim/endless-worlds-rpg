# Project: Endless Worlds RPG — Master Context

**Version:** 6.5
**Status:** Active Development — Phase 2 In Progress
**Objective:** To create a truly endless, fully-fledged AI-driven RPG engine — text and SVG based — with persistent worlds, real mechanics, and emergent storytelling. Genre-agnostic, infinitely replayable.

---

## 🔄 Current Status (Read This First)

**Current Day:** Day 19 — Main Narrative Thread + Combat System
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
| Systems Audit | 14 root-cause fixes across NPC/graph/asset pipeline | ✅ Complete |
| 19 | Main Narrative Thread + Combat System | 🔄 In Progress |
| 20+ | Skills, Factions, Background | ⏳ Pending |

**Active genres:** Fantasy, Cyberpunk, Horror/Lovecraftian, Space Opera, Post-Apocalyptic
**⚠️ Noir has been removed. Do not reference it anywhere in the codebase.**

### Systems Audit (commit db6e1c2 — 86/86 tests, clean build)
Full audit of 14 root-cause issues. See /docs/audit-report-dialogue-systems.md

**Fix J** — new_npcs are first-class world_assets: new step 7b-2 saves CHARACTER world_asset for every new_npc, patches locationAssets, merges registry. Step 8 block deleted.

**Fix D** — discovered NPCs added to currentNode.npc_ids: `addNpcToCurrentNode` helper in state-utils. Called from step 7b (CHARACTER codex_entries) and step 7b-2 (new_npcs).

**Fix C** — name_known guard in step 7d: hard-skips reveals targeting name_known === true assets. Pre-seeded NPCs are immune to narrator name overwrites.

**Fix I** — no synthetic asset_id: reveal loop logs and skips when no real matchedAsset resolves. Fourth fallback tries normalizeAssetId(activeNpcName).

**Fix A** — DIALOGUE narrator gets only the active NPC: step 5 filters locationAssets to active NPC's CHARACTER asset + all non-CHARACTER assets. prompt-builder suppresses NPCS PRESENT on DIALOGUE. ACTIVE NPC CONTEXT is the single source.

**Fix B** — option tone flows modal → loop → resolver: DialogueModal.handleOption passes tone. submitAction accepts options.tone, applies TONE_MAP (aggressive→intimidating). Badge always matches the check that fires. clear() removed from handleOption — step 7g owns modal lifecycle.

**Fix E+F** — pin primary_target from node NPCs: step 2b-2. Exactly one NPC at node → pin to them. Multiple NPCs + currentDialogueNpc in npc_ids → pin to active. Free-typed dialogue is now deterministic.

**Fix K** — single canonical tone heuristic: new `lib/game/dialogue-tone.ts` exporting inferToneFromSpeech + DialogueTone. Both parse-intent route and resolver import it. Local duplicates deleted.

**Fix L** — WORLD_EXPLORE node renamed to stub.name: stub callback patches world_graph.nodes[id].name via setMasterState. Graph and world_asset agree on identity.

**Fix M** — step 2c comment refreshed: reframed as defensive sweep for stale-store edge cases.

**Fix N** — codex write order fixed: 7b-2 runs BEFORE 7d/7g, so reveal lookups and codex writes find freshly-saved new_npcs in locationAssets.

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

**NPC Placement (authoritative):**
- Pre-seeded NPCs: assigned to nodes at world-seed time via npc_ids
- Dynamic NPCs: added to currentNode.npc_ids on first encounter (step 7b-2 + addNpcToCurrentNode)
- Narrator receives ONLY the active NPC's constitution for DIALOGUE actions
- narrator cannot invent NPCs not in the RESPONDING CHARACTER block

---

## ⚡ FOUNDATIONAL RULES (Read Before Every Session)

### 1. World Assets Are Permanent
Write-once constitution. `ignoreDuplicates: true`. svg_content kept but unused.

### 2. Movement Is Graph-Based
Move classifier runs before resolver. `current_node_id` is single source of truth.

### 3. Location Is Authoritative State
`current_node_id` saved immediately on real moves. INTERNAL_DESCRIBE does NOT update location.

### 4. Actions Are Permitted By Default
Plausible actions always attempted. Narrator describes outcomes only.

### 5. Objects Mentioned Exist
EXAMINE/INTERACT resolver confirms object_confirmed=true.

### 6. Dialogue Is Consistent
- Narrator receives ONLY the active NPC for DIALOGUE (single RESPONDING CHARACTER block)
- Active NPC determined by game code: options.npcName → currentDialogueNpc → primary_target → graph node (single NPC)
- Option tone is authoritative — passes through to resolver via forcedTone
- Pre-seeded NPC names are immutable (name_known guard)
- Every NPC (pre-seeded or dynamic) is in their node's npc_ids

### 7. The AI Has Exactly Three Roles
**Generator:** Invents content within World Seed guardrails. Locked immediately.
**Bridge:** Describes outcomes as the RESPONDING CHARACTER only. Never invents NPCs or speaks for player.
**Thread:** Plants quest breadcrumbs. Never forces or blocks.

---

## 🌱 World Generation System

**At game start:** generateWorldSeed() → applyWorldSeed() → world_assets + WorldGraph pre-populated
**On MOVE:** classifyMove() → GRAPH_NAVIGATE / ZONE_EXPAND / WORLD_EXPLORE
**On first NPC dialogue:** seedNpcRegistry() + codex entry + addNpcToCurrentNode()
**new_npcs:** saved as world_assets in step 7b-2 BEFORE step 7g/7d runs

---

## 🎭 NPC Dialogue System (Audited and Fixed)
- Narrator gets EXACTLY ONE active NPC for DIALOGUE — no roster
- Option tone flows modal → submitAction(forcedTone) → resolver
- Badge always matches the check that fires
- Pre-seeded NPC names immune to narrator reveals (name_known guard)
- Dynamic NPCs added to graph node npc_ids on first encounter
- Free-typed dialogue pinned to node NPC when deterministic
- clear() removed from DialogueModal.handleOption — step 7g owns lifecycle

## 💰 Trading System (Day 16 — Complete)
- Merchant keyword detection → trade_available → items_for_sale
- TradeModal: Buy full value, Sell 50%
- Currency label from getGenreColors — genre-accurate everywhere

## 🎨 UI System (Direction 3 — Complete)
- genre-ui.ts: getGenreColors(genre) — single source of truth
- StoryFeed: arrival headers, NPC quote-blocks, stat-check receipts
- DialogueModal: accent-bar buttons by tone, stat badge matches resolver
- VerbosityToggle: Terse / Standard / Rich in header

---

## Narrator Architecture

**Narrator outputs: text + simple values. Game code derives: all mechanics.**

For DIALOGUE actions:
- locationAssets filtered to: active NPC CHARACTER asset + all non-CHARACTER assets
- RESPONDING CHARACTER block replaces NPCS PRESENT
- Narrator writes ONLY from the named responding character

For non-DIALOGUE actions:
- Full locationAssets passed (NPCS PRESENT block active)

Prompt structure (in order):
1. WORLD FACTS block
2. NPCS PRESENT (non-DIALOGUE) OR RESPONDING CHARACTER (DIALOGUE)
3. ESTABLISHED WORLD ASSETS (current location first)
4. PLAYER STATE header
5. SCENE CONTEXT (move_type, ARRIVING/PRESENT)
6. VERBOSITY block (last)

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

Tone mapping (option → ParsedAction): aggressive → intimidating, others pass through.
Single canonical heuristic: lib/game/dialogue-tone.ts (used by both parse-intent and resolver).

---

## Immediate Persistence Architecture
- Log entries + recent_messages: after every narrative action
- World state + current_node_id: after every real MOVE
- world_graph: after every node creation, discovery, or npc_ids update
- npc_registry: immediately patched to store on seed
- new_npcs: saved as world_assets in step 7b-2 before step 7g
- locationAssets: loaded by node asset_id — deterministic
- Full state: every 10 actions

---

## Planned Systems

| System | When | Description |
| --- | --- | --- |
| Main Narrative Thread | Day 19 | Breadcrumb injection from world seed, quest progress |
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
- **Narrator isolation:** DIALOGUE gets exactly one NPC — never a roster
- **Option tone is authoritative:** badge always matches what fires
- **Pre-seeded names are immutable:** name_known guard enforced
- **Dynamic NPCs are first-class:** world_asset + npc_ids + codex on first encounter
- **Three-layer model:** World Seed → AI detail → permanent lock → narrator describes
- **Narrator outputs text + simple values only**
- **Genre-aware UI:** all colors, labels, currency from GENRE_CONFIGS via genre-ui.ts

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

*Last updated: Session 56 — V6.5: Systems audit complete. 14 root-cause fixes. NPC isolation, graph npc_ids, tone passthrough, name_known guard, new_npcs as world_assets. Day 19 starting.*
