# Project: Endless Worlds RPG — Master Context

**Version:** 3.9
**Status:** Active Development — MVP Core Loop Complete
**Objective:** To create a truly endless, fully-fledged AI-driven RPG engine — text and SVG based — with persistent worlds, real mechanics, and emergent storytelling. Genre-agnostic, infinitely replayable.

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
| Pre-Day 13 fixes A+B | All codex, dialogue, SVG, identity fixes | ✅ Complete |
| NPC name reveal fix | revealed_npc_names pipeline, badge logic | ✅ Complete |
| 13 | Log Book & Save System | 🔄 In Progress |
| 14 | MVP Playtest & Bug Fix | ⏳ Pending |

**Active genres:** Fantasy, Cyberpunk, Horror/Lovecraftian, Space Opera, Post-Apocalyptic
**⚠️ Noir has been removed. Do not reference it anywhere in the codebase.**

### Supabase Tables (all applied ✅)
- `profiles`, `game_sessions`, `characters`, `world_states`, `log_books`, `npcs`, `subscriptions`, `community_templates`, `user_preferences`
- `art_cache` — SVG art per location+session
- `world_assets` — constitutions + svg_content + name_known
- `codex` — lore encyclopedia entries

---

## ⚡ FOUNDATIONAL RULES (Read Before Every Session)

### 1. World Assets Are Permanent
Every significant entity the Narrator introduces becomes an immutable game asset. Named locations, characters, factions, creatures, unique items — locked on first introduction. Stored in `world_assets` table. Injected into every relevant Narrator call as hard facts. Constitution is write-once — `ignoreDuplicates: true`. SVG art backfilled via `updateWorldAssetSvg()` separately.

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

## 🎯 Main Narrative Thread (Day 17-18)

Every new campaign generates a hidden **World Seed**:
- Central conflict/threat, goal state, 3-5 organic breadcrumbs, opening hook
- Stored in metadata.main_quest (sealed from player)
- Narrator plants clues naturally — player can follow or free-roam
- Win conditions: narrative resolution, faction victory, survival, discovery

---

## 🎭 NPC Dialogue Window + Portraits (Day 15)

- SVG portrait (FRONT_PORTRAIT) generated on first NPC encounter, async
- Dedicated dialogue modal: portrait + name/placeholder + dialogue + 3-4 response options + free input
- Portrait cached in world_assets.svg_content
- Name/portrait updates when true identity revealed

---

## 🕵️ NPC Identity System

- `name_known: boolean` on world_assets (false for CHARACTER by default)
- `looksLikePlaceholder(name)` — 60-word set of descriptor/role words
- Auto-promotes to `name_known=true` if name contains no placeholder words
- `revealed_npc_names` in NarratorResponse — narrator outputs when name learned
- Step 7d in useGameLoop: calls `updateAssetNameRevealed()` + patches Zustand store
- Codex badge: "?" + "Identity Unknown" only when name_known=false AND looksLikePlaceholder()

---

## SVG Art Engine — Future Improvement Options (Phase 3)

- **Option A:** Richer prompts | **Option B:** SVG templates | **Option C:** External API (~$0.002-0.005/img) | **Option D:** CC0 sprite library
- **Recommended:** Option B + D combined. Deferred to Phase 3 (Day 25+).

---

## Key Deliverables Log

### NPC Name Reveal Fix (confirmed on main)
- `types/game.ts`: NarratorResponse.revealed_npc_names
- `narrator.ts`: parseNarratorResponse extracts revealed_npc_names
- `prompt-builder.ts`: revealed_npc_names in JSON schema + NPC NAMES instructions
- `useGameLoop.ts`: step 7d — updateAssetNameRevealed + Zustand optimistic patch
- `codex.ts`: looksLikePlaceholder(name), auto-promotes name_known for proper names
- `codex/page.tsx`: badge requires name_known=false AND looksLikePlaceholder()

### Pre-Day 13 Fixes A+B (confirmed on main)
- normalizeAssetId, dialogue text parsing, SVG backfill with debug, name_known field
- Migrations 005 + 006 applied

### Day 13.5 — world_assets + codex tables, constitution injection, codex browser
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
- DIALOGUE FORMAT: "NPC Name: 'speech'" — quoted speech in accent/italic, prose normal
- NPC NAMES: placeholder until introduced, revealed_npc_names signals reveal
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
| MVP Playtest | Day 14 | Full playtest, Phase 1 complete |
| NPC Dialogue + Portraits | Day 15 | Dialogue modal, SVG portraits, identity reveal |
| NPC Trading | Day 16 | Merchant NPCs, buy/sell UI |
| Main Narrative Thread | Day 17-18 | World Seed, main quest, breadcrumbs, win conditions |
| Art Engine Overhaul | Phase 3 (Day 25+) | Template + CC0 sprite approach |

---

## 1. Core Philosophy

- **Hybrid Authority Model:** Code is Source of Truth. AI is the Narrator.
- **World Assets are permanent.** Write-once constitutions + SVG + identity reveal.
- **Movement is absolute.** Players always arrive.
- **Location is authoritative state.** current_location_id is always correct.
- **Actions are permitted by default.** Narrator describes, never gatekeeps.
- **The world has a purpose.** Every campaign has a hidden main quest thread.
- **SVG Pixel Art + Text.** Async, cached. Art engine overhaul Phase 3.
- **Truly endless.** AI generates content on demand. The world grows with every session.
- **Endless Versatility.** Genre Wrappers. Launch genres: Fantasy, Cyberpunk, Horror/Lovecraftian, Space Opera, Post-Apocalyptic.

---

## 2. Technical Architecture

### A. The Master State

| Module | Responsibility |
| --- | --- |
| **Metadata** | Genre, tone, difficulty, main_quest (sealed) |
| **Player State** | HP, resources, attributes, inventory |
| **World State** | Flags, location_id, location_status |
| **Log Book** | Story beats and lore |
| **NPC Registry** | Per-NPC memory, trust scores, name_known |

### B. The Game Loop
1. **Intent Parser** → ParsedAction (AI, or instant for dialogue/fast-path)
2. **Logic Resolver** → ResolutionResult + location_status (no AI)
3. **narratorState** = updatedState merged with world_state delta
4. **Narrator** → story + POI + codex_entries + revealed_npc_names (AI)
5. **Asset saves** → fire-and-forget to world_assets + codex tables
6. **Name reveals** → updateAssetNameRevealed + Zustand patch (step 7d)
7. **Art Engine** → SVG async (AI, cached) — non-blocking

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

*Last updated: Session 30 — V3.9: NPC name reveal pipeline complete. Day 13 ready.*
