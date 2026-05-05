# Project: Endless Worlds RPG — Master Context

**Version:** 6.0
**Status:** Active Development — Phase 2 In Progress
**Objective:** To create a truly endless, fully-fledged AI-driven RPG engine — text and SVG based — with persistent worlds, real mechanics, and emergent storytelling. Genre-agnostic, infinitely replayable.

---

## 🔄 Current Status (Read This First)

**Current Day:** Day 18 — Main Narrative Thread
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
| 18 | Main Narrative Thread | 🔄 In Progress |
| 19+ | Combat, Skills, Factions | ⏳ Pending |

**Active genres:** Fantasy, Cyberpunk, Horror/Lovecraftian, Space Opera, Post-Apocalyptic
**⚠️ Noir has been removed. Do not reference it anywhere in the codebase.**

### Day 17 Deliverables (commit a27de24 — 86/86 tests, clean build)
- `SeedLocation`, `SeedNPC`, `SeedQuest`, `SeedFaction`, `WorldSeed` types
- `Metadata.world_seed?` in MasterState
- `/api/game/generate-world-seed` — separate Sonnet call, genre-specific fallback seeds
- `/api/game/apply-world-seed` — writes world_assets for all SeedLocations + SeedNPCs (name_known: true)
- `/app/game/new` — progressive loading: "Creating character..." → "Generating your world..." → "Establishing world facts..."
- `/api/game/generate-location-stub` + `location-stub-generator.ts` — lightweight Claude call for new areas
- `useGameLoop` step 7: MOVE_SUCCESS to unknown location → stub → saveWorldAsset (write-once) → refresh locationAssets
- `prompt-builder`: WORLD FACTS block prepended (world name, tagline, factions, known locations)
- Current location's asset always first in ESTABLISHED WORLD ASSETS
- `supabase/migrations/007_world_seed.sql` — applied ✅

### Small Fixes (commit a27de24)
- MOVE/non-dialogue actions now reliably call clearDialogueOptions()
- InventoryPanel slot tooltips show "Worth: N [Currency]"

---

## 🎮 The Three-Layer World Model

**Layer 1 — World Seed (Day 17 ✅):**
- Generated at game start via separate Claude call before player's first action
- Starting location, 2-3 connected locations, 3 key NPCs (names known from start)
- Main quest with 5 breadcrumbs, 2 factions
- All pre-seeded as world_assets before narrator ever runs
- Fallback hardcoded seeds per genre if generation fails

**Layer 2 — Location Stub Generator (Day 17 ✅):**
- Fires on MOVE_SUCCESS to unknown location
- Generates structural stub (id, name, type, description) before narrator runs
- Locked as world_asset immediately — narrator describes, never invents name

**Layer 3 — Game Engine:**
- Stat checks, dice, outcomes, currency, inventory, flags, trust scores

---

## ⚡ FOUNDATIONAL RULES (Read Before Every Session)

### 1. World Assets Are Permanent
Write-once constitution. `ignoreDuplicates: true`. SVG backfilled separately.

### 2. Movement Is Absolute
MOVE always succeeds. `current_location_id` normalized via `normalizeLocationId()`.

### 3. Location Is Authoritative State
`current_location_id` always correct. Normalized slug. Saved immediately on MOVE.

### 4. Actions Are Permitted By Default
Plausible actions always attempted. Narrator describes outcomes only.

### 5. Objects Mentioned Exist
EXAMINE/INTERACT resolver confirms object_confirmed=true. Prepended as first narrator fact.

### 6. Dialogue Is Consistent
All dialogue identical pipeline. Tone → stat check (game code). Badge shows real player stat.

### 7. The AI Has Exactly Three Roles
**Generator:** Invents sensory detail within World Seed guardrails. Locked immediately.
**Bridge:** Describes mechanical outcomes as narrative prose. Never decides outcomes.
**Thread:** Plants quest breadcrumbs from SeedQuest. Never forces or blocks.

---

## 🌱 World Seed System (Complete)

**At game start:** `generateWorldSeed()` → `applyWorldSeed()` → world_assets pre-populated
**On MOVE to new area:** `generateLocationStub()` → `saveWorldAsset()` → narrator receives as fact
**Narrator receives:** WORLD FACTS block + ESTABLISHED WORLD ASSETS (current location first)
**Result:** Narrator describes, never invents names — double codex entries eliminated

---

## 🎭 NPC Dialogue System (Complete)
- Tone → stat check (game code only)
- `getToneBadge` shows player's actual current stat
- `justRevealedName` prevents step 7g from overwriting step 7d reveal
- `clearDialogueOptions()` on MOVE and all non-dialogue actions
- `getWorldAssetsForLocation` uses client-side filtering

## 💰 Trading System (Day 16 — Complete)
- Merchant keyword detection → `trade_available` → `items_for_sale`
- TradeModal: Buy at full value, Sell at 50%
- Item values by rarity. Tooltip shows "Worth: N [Currency]"

---

## Narrator Architecture

**Narrator outputs: text + simple values. Game code derives: all mechanics.**

Prompt structure (in order):
1. WORLD FACTS block (world name, tagline, factions, known locations)
2. ESTABLISHED WORLD ASSETS (current location first, then others)
3. PLAYER STATE header (authoritative location, status)
4. SCENE CONTEXT (ARRIVING/PRESENT)
5. Resolution context, character stats, equipped loadout, recent log

---

## Immediate Persistence Architecture
- Log entries + recent_messages: after every narrative action
- World state: after every MOVE or flag change
- npc_registry: immediately patched to store on seed
- locationAssets: client-side filtered, loaded on mount + late-loaded fallback
- world_seed: stored in game_sessions.world_seed column
- Full state: every 10 actions

---

## Planned Systems

| System | When | Description |
| --- | --- | --- |
| Main Narrative Thread | Day 18 | Breadcrumb injection, quest progress tracking, win conditions |
| Combat System | Day 19 | Turn-based, enemy AI, loot |
| Skills & Abilities | Day 20 | Skill trees, attribute thresholds |
| Character Background | Phase 3 | Traits, history, faction rep |
| Art Engine Overhaul | Phase 3 (Day 25+) | Templates + CC0 sprites |

---

## Supabase Tables (all applied ✅)
- `profiles`, `game_sessions` (+world_seed column), `characters`, `world_states`, `log_books`, `npcs`, `subscriptions`, `community_templates`, `user_preferences`
- `art_cache`, `world_assets` (+svg_content, +name_known), `codex`
- Migrations 001-007 all applied

---

## Core Philosophy

- **Hybrid Authority:** Code = Truth, AI = narrator of code-owned facts
- **Three-layer model:** World Seed → AI detail (within guardrails) → permanent lock → narrator describes
- **Narrator outputs text+simple values only**
- **World Seed pre-seeds structure; AI fills sensory detail; engine locks everything**
- World Assets permanent, Movement absolute, Objects exist
- Truly endless — procedurally generated at every layer

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

*Last updated: Session 51 — V6.0: Day 17 complete. World Seed system, location stub generator, migration 007 applied. Day 18 starting.*
