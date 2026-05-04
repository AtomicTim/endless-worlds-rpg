# Project: Endless Worlds RPG — Master Context

**Version:** 3.5
**Status:** Active Development — MVP Core Loop Complete
**Objective:** To create a genre-agnostic, AI-driven RPG engine that combines hard-coded game logic with dynamic LLM storytelling and ASCII visuals.

---

## 🔄 Current Status (Read This First)

**Current Day:** Day 13 — Log Book & Save System
**Local Dev Port:** 3000
**Stack:** Next.js 14 / Tailwind / shadcn/ui / Supabase / Claude API / Stripe / Vercel
**GitHub Repo:** atomictim/endless-worlds-rpg

| Day | Title | Status |
| --- | --- | --- |
| 1–12 | Foundation through Inventory | ✅ Complete |
| Patch A | Narrator redesign, POI system | ✅ Complete |
| Patch B | CONTAINER items, SVG art engine, dialogue prefix | ✅ Complete |
| Location fix | State machine, ARRIVING/PRESENT, action authority | ✅ Complete |
| Day 13.5 | World Asset System + Lore Codex | ✅ Complete |
| Pre-Day 13 fixes | Codex deduplication, dialogue color, SVG→world asset link | ⏳ Pending before Day 13 |
| 13 | Log Book & Save System | ⏳ Pending |
| 14 | MVP Playtest & Bug Fix | ⏳ Pending |

**Active genres:** Fantasy, Cyberpunk, Horror/Lovecraftian, Space Opera, Post-Apocalyptic
**⚠️ Noir has been removed. Do not reference it anywhere in the codebase.**

### Supabase Tables (all applied)
- `profiles`, `game_sessions`, `characters`, `world_states`, `log_books`, `npcs`, `subscriptions`, `community_templates`, `user_preferences`
- `art_cache` — SVG art per location+session ✅
- `world_assets` — immutable entity constitutions ✅
- `codex` — lore encyclopedia entries ✅
- `world_assets.svg_content` column — ⏳ migration 005 pending (pre-Day 13 fix)

---

## ⚡ FOUNDATIONAL RULES (Read Before Every Session)

### 1. World Assets Are Permanent
Every significant entity the Narrator introduces becomes an immutable game asset. Named locations, characters, factions, creatures, unique items — locked on first introduction. Stored in `world_assets` table. Injected into every relevant Narrator call as hard facts. Constitution is write-once — `ignoreDuplicates: true` on all saves.

### 2. Movement Is Absolute
MOVE actions always succeed. Only valid block: world flag `<location_id>_locked: true`. `resolveMove()` always returns MOVE_SUCCESS with `location_status: ARRIVING`.

### 3. Location Is Authoritative State
`current_location_id` is the single source of truth. Narrator never infers location from history. Every narrator call receives `══ PLAYER STATE ══` header with explicit ARRIVING/PRESENT status.

### 4. Actions Are Permitted By Default
Plausible actions always attempted. Narrator describes outcomes, never gatekeeps. Only hard physics/logic blocks are valid. Logic Resolver handles success/failure — not the Narrator.

---

## Location State Machine

```
PRESENT  — acting within current location. lastNarrativeText = "CURRENT SCENE CONTEXT"
ARRIVING — just moved here. lastNarrativeText = "DEPARTED SCENE (backstory)"

Every resolver sets location_status in state_delta.
narratorState always merges world_state delta before narrator call.
```

---

## Known Issues & Pending Fixes (pre-Day 13)

### 1. Duplicate codex entries for same character
- **Cause:** Narrator generates different asset_id slugs for the same entity across calls
- **Fix:** normalizeAssetId() function — CHARACTER always "character_[name_slug]", never role-based
- **Status:** ⏳ Pending

### 2. Dialogue text color
- **Fix:** DIALOGUE messages render in --color-accent with left border, NPC name bolded
- **Status:** ⏳ Pending

### 3. SVG linked to world assets
- **Fix:** svg_content column on world_assets (migration 005), art linked on save, shown in codex detail modal
- **Status:** ⏳ Pending (migration file generated, not yet run)

---

## SVG Art Engine — Future Improvement Options (Phase 3)

The current SVG generation produces structurally valid but visually rough output. Options for improvement, to be evaluated in Phase 3 (Day 25+):

**Option A: Richer generation prompts** — More specific spatial instructions. Low effort, ~30-40% quality improvement. Still has "random blocks" feel.

**Option B: SVG template system** — Pre-built scene templates with correct composition. AI fills color/detail variations. Consistent structure, less unique per location. Medium effort.

**Option C: External image generation API** — Replicate or Stability AI for real pixel art sprites. Dramatically better quality. ~$0.002-0.005 per image. External dependency.

**Option D: Pre-made CC0 sprite library** — Map location types to curated free pixel art assets. Zero generation cost, instant load, polished look. Less unique per world but very consistent.

**Recommended approach for launch:** Option B + D combined — template system with CC0 sprite library for common scene types, SVG generator as fallback. Deferred to Phase 3.

---

## Key Deliverables Log

### Day 13.5 (confirmed on main — 43/43 tests, build clean)
- `types/game.ts`: AssetCategory enum, WorldAsset interface, WorldAssetConstitution
- `lib/game/codex.ts`: saveWorldAsset (write-once), saveCodexEntry, getWorldAssetsForLocation
- `supabase/migrations/003_world_assets.sql` — applied ✅
- `supabase/migrations/004_codex.sql` — applied ✅
- `game-store.ts`: locationAssets store + setLocationAssets
- `useGameLoop.ts`: fire-and-forget asset/codex saves, post-ARRIVING locationAssets refresh
- `prompt-builder.ts`: ESTABLISHED WORLD ASSETS section, WORLD ASSET CONSTITUTION instruction
- `app/game/codex/page.tsx`: full codex browser — tabs, cards, detail modal
- `GameLayout`: 📖 Codex button in navbar

### Location Fix (confirmed on main)
- LocationStatus enum: PRESENT | ARRIVING
- Every resolver sets location_status, MOVE sets ARRIVING
- narratorState always fresh before narrator call

### Patch B — CONTAINER items, SVG art engine, dialogue prefix
### Patch A — Narrator redesign, POI system, InteractionPopover, fast-path

---

## Narrator Architecture

- **Tier 1** (2-3 sentences): PRESENT repeated actions, USE_ITEM, simple CUSTOM
- **Tier 2** (4-6 sentences): EXAMINE, ATTACK, INTERACT, DIALOGUE, first NPC
- **Tier 3** (80-120 words): ARRIVING at NEW location, major story moments
- GOLDEN RULE: honor player action, yes-and
- LOCATION RULE: state authoritative, history is backstory
- ACTION RULE: plausible actions always attempted
- WORLD ASSET RULE: constitutions injected as immutable facts
- Narrator never generates art

---

## Action Classification Policy

- **FAST PATH** (zero AI, instant): equip, unequip, drop, read lore
- **NARRATIVE PATH**: MOVE, ATTACK, INTERACT, EXAMINE, DIALOGUE, USE_ITEM(CONSUMABLE), search CONTAINER
- **DIALOGUE**: quoted text → instant DIALOGUE, no AI call
- **MOVE**: always MOVE_SUCCESS, sets ARRIVING, narrator describes arrival

---

## Planned Systems

| System | When | Description |
| --- | --- | --- |
| Codex dedup + dialogue color + SVG link | Pre-Day 13 | normalizeAssetId, accent dialogue, svg_content column |
| Log Book + Save System | Day 13 | LogBook sidebar, dashboard, Save & Exit |
| MVP Playtest | Day 14 | Full playtest, bug fixes, Phase 1 complete |
| NPC Dialogue system | Day 15 | Full conversation mode, Charisma gates |
| NPC Trading | Day 16 | Merchant NPCs, buy/sell UI |
| Art Engine Overhaul | Phase 3 (Day 25+) | Template + CC0 sprite approach |

---

## 1. Core Philosophy

- **Hybrid Authority Model:** Code is Source of Truth. AI is the Narrator.
- **World Assets are permanent.** Write-once constitutions, injected as facts.
- **Movement is absolute.** Players always arrive.
- **Location is authoritative state.** current_location_id is always correct.
- **Actions are permitted by default.** Narrator describes, never gatekeeps.
- **SVG Pixel Art + Text.** Async, cached per location. Art engine overhaul in Phase 3.
- **Endless Versatility.** Genre Wrappers. Launch genres: Fantasy, Cyberpunk, Horror/Lovecraftian, Space Opera, Post-Apocalyptic.

---

## 2. Technical Architecture

### A. The Master State

| Module | Responsibility |
| --- | --- |
| **Metadata** | Genre, tone, difficulty |
| **Player State** | HP, resources, attributes, inventory |
| **World State** | Flags, location_id, location_status |
| **Log Book** | Story beats and lore |
| **NPC Registry** | Per-NPC memory, trust scores |

### B. The Game Loop
1. **Intent Parser** → ParsedAction (AI, or instant for dialogue/fast-path)
2. **Logic Resolver** → ResolutionResult + location_status (no AI)
3. **narratorState** = updatedState merged with world_state delta
4. **Narrator** → story + POI + codex_entries (AI, sees correct location + world assets)
5. **Asset saves** → fire-and-forget to world_assets + codex tables
6. **Art Engine** → SVG async (AI, cached) — non-blocking

---

## 3. Tech Stack

| Layer | Tool |
| --- | --- |
| Frontend | Next.js 14 (App Router) |
| Styling | Tailwind CSS + shadcn/ui |
| Database | Supabase |
| AI Engine | Claude API (claude-sonnet-4-20250514) |
| Payments | Stripe |
| Deployment | Vercel |
| Audio | Howler.js |
| State | Zustand |

---

## 4. Genre Definitions (Final — No Noir)

| Genre | Tone | Palette | Currency | HP Label |
| --- | --- | --- | --- | --- |
| **Fantasy** | Epic, mythic | Amber/green | Gold | HP |
| **Cyberpunk** | Terse, neon-soaked | Cyan/magenta | Credits | Integrity |
| **Horror/Lovecraftian** | Cosmic dread | Sickly green/purple | None | Sanity+HP |
| **Space Opera** | Grand, operatic | Purple/silver | Stellar Units | Hull Integrity |
| **Post-Apocalyptic** | Bleak, dark humor | Rust/ash | Caps | HP |

**Horror:** Dual HP+Sanity. 0 Sanity = game over.
**Post-Apoc:** Ammo/food/water tracked alongside HP.
**Future genres:** Western, Pirate, Superhero, Dark Fantasy, Steampunk

---

## 5. Monetization

| Feature | Free | Adventurer ($6.99/mo) | Legend ($14.99/mo) |
| --- | --- | --- | --- |
| Genres | Fantasy only | All 5 | All 5 + future |
| Save Slots | 1 | 3 | Unlimited |
| AI Actions/Day | 50 | Unlimited | Unlimited |
| Art Generation | Basic SVG | Enhanced SVG | Enhanced + Custom |
| Community Templates | Browse | Browse + Play | Create + Share |
| Export Log Book | ❌ | ✅ | ✅ |
| Priority AI Speed | ❌ | ❌ | ✅ |

---

## 6. Platform: PWA Only
Final. No Electron, no Steam. PWA manifest Day 35.

---

## 7. Development Workflow

**Claude.ai owns all CLAUDE.md updates. Claude Code must not modify CLAUDE.md.**

Workflow: Claude Code pushes → `git pull` + restart own server → report to Claude.ai → checklist → confirm → next prompt.

---

## 8. Reference Links
- Supabase: https://supabase.com/dashboard
- Anthropic Console: https://console.anthropic.com
- Vercel: https://vercel.com/dashboard
- Stripe: https://dashboard.stripe.com

---

*Last updated: Session 26 — V3.5: SVG art improvement options noted for Phase 3. Pre-Day 13 fixes documented. Calling it a day.*
