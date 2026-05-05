# Project: Endless Worlds RPG — Master Context

**Version:** 5.9
**Status:** Active Development — Phase 2 In Progress
**Objective:** To create a truly endless, fully-fledged AI-driven RPG engine — text and SVG based — with persistent worlds, real mechanics, and emergent storytelling. Genre-agnostic, infinitely replayable.

---

## 🔄 Current Status (Read This First)

**Current Day:** Day 17 — World Seed + Location Stub Generator
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
| 17 | World Seed + Location Stub Generator | 🔄 In Progress |
| 18 | Main Narrative Thread | ⏳ Pending |
| 19+ | Combat, Skills, Factions | ⏳ Pending |

**Active genres:** Fantasy, Cyberpunk, Horror/Lovecraftian, Space Opera, Post-Apocalyptic
**⚠️ Noir has been removed. Do not reference it anywhere in the codebase.**

### Day 16 Deliverables (commit 7062c74 — 86/86 tests, clean build)
- `Item.value?: number` — base sell value in genre currency
- `NarratorResponse.items_for_sale?: Item[]` — merchant inventory
- `prompt-builder`: items_acquired requires value field (rarity-scaled), TRADE INTERACTION block
- `logic-resolver`: merchant keyword detection → `trade_available` in narrative_context
- `game-store`: `currentTradeItems[]` + `setTradeItems`, cleared on session switch
- `TradeModal.tsx`: two-column inline modal — merchant wares (Buy) + player inventory (Sell at 50%)
- `InventoryPanel`: shows "Worth: N [Currency]" with 50% sell rate tooltip
- `buyItem` / `sellItem` callbacks in useGameLoop — currency check, inventory mutation, DISCOVERY log

### Bug Fixes (commit 7062c74)
- Step 7g no longer overwrites step 7d name reveal: `justRevealedName` local variable, 7g checks it first
- `getWorldAssetsForLocation`: client-side filtering replaces PostgREST `.or()` — handles apostrophes/spaces in slugs. Fetches all session assets, filters by exact + normalizeLocationId match.

---

## 🎮 The Three-Layer World Model

**Layer 1 — World Seed (Day 17):** Engine pre-generates macro facts at game start:
- Starting location with fixed name and key facts
- 2-3 key NPCs with names, roles, personalities — locked before player acts
- Overarching conflict, faction names, main quest hook
- On-demand stub generation for new areas as player explores

**Layer 2 — AI Asset Generation:** On first encounter, narrator invents within Layer 1 guardrails:
- Sensory detail, minor NPC details, room contents, item descriptions
- Immediately locked as permanent assets

**Layer 3 — Game Engine:** Owns all mechanical state:
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
**Generator:** Invents content on first encounter within World Seed guardrails. Locked immediately.
**Bridge:** Describes mechanical outcomes as narrative prose. Never decides outcomes.
**Thread:** Plants story breadcrumbs. Never forces or blocks.

---

## 🎭 NPC Dialogue System (Complete)
- Tone → stat check derived by game code (not narrator)
- `getToneBadge` shows player's actual current stat
- `justRevealedName` prevents step 7g from overwriting step 7d reveal
- `getWorldAssetsForLocation` uses client-side filtering — robust against slug variants

## 💰 Trading System (Day 16 — Complete)
- Merchant keyword detection → `trade_available` → narrator generates `items_for_sale`
- TradeModal: Buy at full value, Sell at 50%
- Item values: Common 5-15, Uncommon 20-50, Rare 100-300, Legendary 500+
- Currency display in CharacterSheet

## 🌱 World Seed System (Day 17 — IN PROGRESS)
- Generates world skeleton at game start before first player action
- On-demand stub generation for new areas
- Fixes: double codex entries, narrator name inconsistency, locationAssets always 0

---

## Narrator Architecture

**Narrator outputs: text + simple values. Game code derives: all mechanics.**
- Narrative text, log_summary, sound_id — narrator owned
- `{ true_name }` for name reveals — narrator outputs, game code maps to asset
- `{ id, text, tone }` for dialogue options — game code derives check and badge
- `items_for_sale` — narrator generates when trade_available=true
- Asset IDs, stat checks, difficulty, roll results — game code only

---

## Immediate Persistence Architecture
- Log entries + recent_messages: after every narrative action
- World state: after every MOVE or flag change
- npc_registry: immediately patched to store on seed
- locationAssets: client-side filtered, loaded on mount + late-loaded fallback
- Full state: every 10 actions
- clearSessionState() on session switch, clearTransientState() on SPA nav

---

## Planned Systems

| System | When | Description |
| --- | --- | --- |
| World Seed + Stub Generator | Day 17 | Pre-seed world, on-demand area generation |
| Main Narrative Thread | Day 18 | Main quest, breadcrumbs, win conditions |
| Combat System | Day 19 | Turn-based, enemy AI, loot |
| Skills & Abilities | Day 20 | Skill trees, attribute thresholds |
| Character Background | Phase 3 | Traits, history, faction rep |
| Art Engine Overhaul | Phase 3 (Day 25+) | Templates + CC0 sprites |

---

## Core Philosophy

- **Hybrid Authority:** Code = Truth, AI = narrator of code-owned facts
- **Three-layer model:** World Seed → AI detail → permanent lock → narrator describes
- **Narrator outputs text+simple values only — never structured game data**
- **AI generates within guardrails, engine enforces permanence**
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

*Last updated: Session 50 — V5.9: Day 16 complete. Trading system, item values, name reveal fix, locationAssets fix. Day 17 starting.*
