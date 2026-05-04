# Project: Endless Worlds RPG — Master Context

**Version:** 3.6
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
| Pre-Day 13 fixes | Codex dedup, dialogue color, SVG→world asset link | ✅ Complete |
| 13 | Log Book & Save System | 🔄 In Progress |
| 14 | MVP Playtest & Bug Fix | ⏳ Pending |

**Active genres:** Fantasy, Cyberpunk, Horror/Lovecraftian, Space Opera, Post-Apocalyptic
**⚠️ Noir has been removed. Do not reference it anywhere in the codebase.**

### Supabase Tables (all applied ✅)
- `profiles`, `game_sessions`, `characters`, `world_states`, `log_books`, `npcs`, `subscriptions`, `community_templates`, `user_preferences`
- `art_cache` — SVG art per location+session
- `world_assets` — immutable entity constitutions + svg_content column
- `codex` — lore encyclopedia entries

---

## ⚡ FOUNDATIONAL RULES (Read Before Every Session)

### 1. World Assets Are Permanent
Every significant entity the Narrator introduces becomes an immutable game asset. Named locations, characters, factions, creatures, unique items — locked on first introduction. Stored in `world_assets` table. Injected into every relevant Narrator call as hard facts. Constitution is write-once — `ignoreDuplicates: true`. SVG art backfilled via `updateWorldAssetSvg()` separately — never touches constitution.

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

## SVG Art Engine — Future Improvement Options (Phase 3)

Current SVG generation is functional but visually rough. Options deferred to Phase 3 (Day 25+):
- **Option A:** Richer prompts (~30-40% improvement, still blocky)
- **Option B:** SVG template system (consistent composition, medium effort)
- **Option C:** External image API — Replicate/Stability AI (~$0.002-0.005/image, dramatic quality improvement)
- **Option D:** Pre-made CC0 sprite library (zero cost, polished, less unique)
- **Recommended for launch:** Option B + D combined. Deferred to Phase 3.

---

## Key Deliverables Log

### Pre-Day 13 Fixes (confirmed on main)
- `lib/game/codex.ts`: normalizeAssetId() — canonical slug from category+name, applied to all saves
- `components/game/StoryFeed.tsx`: DIALOGUE type renders in --color-accent with left border, italic, NPC name bolded
- `prompt-builder.ts`: DIALOGUE FORMATTING instruction — narrator outputs "NPC: 'speech'" pattern
- `types/game.ts`: WorldAsset.svg_content?: string
- `lib/game/codex.ts`: updateWorldAssetSvg() — targeted update, never touches constitution
- `SceneArt.tsx`: backfills svg_content after art generated
- `codex/page.tsx`: LOCATION detail modal renders SVG art
- `supabase/migrations/005_world_assets_svg.sql` — applied ✅

### Day 13.5 (confirmed on main)
- world_assets + codex tables, asset constitution injection, codex browser page

### Location Fix — LocationStatus PRESENT/ARRIVING, narratorState always fresh
### Patch B — CONTAINER, SVG art engine, dialogue prefix
### Patch A — Narrator redesign, POI, InteractionPopover, fast-path

---

## Narrator Architecture

- **Tier 1** (2-3 sentences): PRESENT repeated actions, USE_ITEM, simple CUSTOM
- **Tier 2** (4-6 sentences): EXAMINE, ATTACK, INTERACT, DIALOGUE, first NPC
- **Tier 3** (80-120 words): ARRIVING at NEW location, major story moments
- GOLDEN RULE: honor player action, yes-and
- LOCATION RULE: state authoritative, history is backstory
- ACTION RULE: plausible actions always attempted
- WORLD ASSET RULE: constitutions injected as immutable facts
- DIALOGUE FORMAT: "NPC Name: 'speech'" pattern
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
| Log Book + Save System | Day 13 | LogBook sidebar, dashboard, Save & Exit |
| MVP Playtest | Day 14 | Full playtest, bug fixes, Phase 1 complete |
| NPC Dialogue system | Day 15 | Full conversation mode, Charisma gates |
| NPC Trading | Day 16 | Merchant NPCs, buy/sell UI |
| Art Engine Overhaul | Phase 3 (Day 25+) | Template + CC0 sprite approach |

---

## 1. Core Philosophy

- **Hybrid Authority Model:** Code is Source of Truth. AI is the Narrator.
- **World Assets are permanent.** Write-once constitutions + separate SVG backfill.
- **Movement is absolute.** Players always arrive.
- **Location is authoritative state.** current_location_id is always correct.
- **Actions are permitted by default.** Narrator describes, never gatekeeps.
- **SVG Pixel Art + Text.** Async, cached. Art engine overhaul Phase 3.
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

*Last updated: Session 27 — V3.6: All pre-Day 13 fixes complete. Migration 005 applied. Day 13 starting.*
