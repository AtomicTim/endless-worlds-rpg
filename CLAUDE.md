# Project: Endless Worlds RPG — Master Context

**Version:** 4.1
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
| All pre-Day 13 fixes | Codex, dialogue, SVG, identity, name reveal, action authority | ✅ Complete |
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
Every significant entity the Narrator introduces becomes an immutable game asset. Locked on first introduction. Constitution is write-once. `ignoreDuplicates: true` on all saves.

### 2. Movement Is Absolute
MOVE actions always succeed. Only valid block: world flag `<location_id>_locked: true`.

### 3. Location Is Authoritative State
`current_location_id` is the single source of truth. Never inferred from narrative history.

### 4. Actions Are Permitted By Default
Plausible actions always attempted. Narrator describes outcomes, never gatekeeps.

### 5. Objects Mentioned Exist
If the narrator described something, it exists and the player can interact with it. Narrator CANNOT retroactively un-create objects. This includes readable objects like journals, books, notes, signs — if the narrator mentions a journal, the player can read it. EXAMINE/INTERACT/READ always resolves.

---

## Location State Machine

```
PRESENT  — acting in current location. lastNarrativeText = "CURRENT SCENE CONTEXT"
ARRIVING — just moved here. lastNarrativeText = "DEPARTED SCENE (backstory)"
```

---

## 🎯 Main Narrative Thread (Day 17-18)

- Hidden World Seed: conflict, goal, 3-5 breadcrumbs, opening hook
- Stored in metadata.main_quest (sealed)
- Narrator plants clues naturally
- Win conditions: resolution, faction victory, survival, discovery

---

## 🎭 NPC Dialogue Window + Portraits (Day 15)

- SVG FRONT_PORTRAIT on first NPC encounter (async)
- Dialogue modal: portrait + name + dialogue + 3-4 AI options + free input
- Portrait cached in world_assets.svg_content

---

## 🕵️ NPC Identity System

- `name_known` false for CHARACTER by default
- `looksLikePlaceholder(name)` — 2+ matching words from expanded set
- `revealed_npc_names` in NarratorResponse — asset_id copied verbatim from context
- `updateMessagesNpcName()` patches existing feed messages on reveal

---

## 💎 Item Value System (Day 16)

Every item, even seemingly minor ones, should have:
- A **sell value** in genre currency (even junk has scrap value)
- A **lore blurb** — one interesting sentence about its origin or nature
- Optional **dialogue unlock**: carrying certain items opens conversation options with NPCs
  (e.g. "I see you have a silver pendant..." → NPC recognizes it and reveals lore)
- Items don't need to be "useful" to be valuable — flavor items enrich the world

Implementation: Day 16 economy system. Narrator already generates item descriptions —
add `value: number` and ensure `description` is always interesting, never generic.

---

## ⚠️ Known Remaining Narrator Issue

Occasional instances of the narrator blocking LORE-type object interactions (journals,
books, notes) despite the "objects mentioned exist" rule. Prompt language to be tightened
in the next narrator prompt update — specifically adding LORE objects to the absolute rule.

---

## SVG Art Engine — Future Improvement Options (Phase 3)

- **Option A:** Richer prompts | **Option B:** SVG templates | **Option C:** External API | **Option D:** CC0 sprites
- **Recommended:** Option B + D. Deferred to Phase 3 (Day 25+).

---

## Key Deliverables Log

### All pre-Day 13 fixes (confirmed on main)
- normalizeAssetId, dialogue text parsing, SVG backfill, name_known, revealed_npc_names
- updateMessagesNpcName, asset_id fallback scan, looksLikePlaceholder expansion
- EXAMINE/INTERACT ABSOLUTE RULE in narrator prompt
- Migrations 001-006 all applied

### Day 13.5 — world_assets + codex, constitution injection, codex browser
### Location Fix — LocationStatus PRESENT/ARRIVING, narratorState always fresh
### Patch B — CONTAINER, SVG art engine, dialogue prefix
### Patch A — Narrator redesign, POI, InteractionPopover, fast-path

---

## Narrator Architecture

- **Tier 1** (2-3 sentences): PRESENT repeated actions, USE_ITEM, simple CUSTOM
- **Tier 2** (4-6 sentences): EXAMINE, ATTACK, INTERACT, DIALOGUE, first NPC
- **Tier 3** (80-120 words): ARRIVING at NEW location, major story moments
- GOLDEN RULE: honor player action, yes-and
- MOVE RULE: player always arrives
- EXAMINE/INTERACT/READ RULE: objects mentioned exist, always resolve — including journals, books, notes, signs
- LOCATION RULE: state authoritative
- WORLD ASSET RULE: constitutions injected as facts
- DIALOGUE FORMAT: "NPC: 'speech'" — quoted in accent/italic, prose normal
- NPC NAMES: asset_id copied verbatim from ESTABLISHED WORLD ASSETS
- Narrator never generates art

---

## Action Classification Policy

- **FAST PATH** (zero AI, instant): equip, unequip, drop, read lore
- **NARRATIVE PATH**: MOVE, ATTACK, INTERACT, EXAMINE, DIALOGUE, USE_ITEM(CONSUMABLE), search CONTAINER
- **DIALOGUE**: quoted text → instant DIALOGUE, no AI call
- **MOVE**: always MOVE_SUCCESS
- **EXAMINE/INTERACT/READ**: always resolves, narrator describes outcome

---

## Planned Systems

| System | When | Description |
| --- | --- | --- |
| Log Book + Save System | Day 13 | LogBook sidebar, dashboard, Save & Exit |
| MVP Playtest | Day 14 | Full playtest, Phase 1 complete |
| NPC Dialogue + Portraits | Day 15 | Dialogue modal, SVG portraits, identity reveal |
| NPC Trading + Item Value | Day 16 | Merchant NPCs, buy/sell, item value + lore blurbs |
| Main Narrative Thread | Day 17-18 | World Seed, main quest, breadcrumbs |
| Art Engine Overhaul | Phase 3 (Day 25+) | Template + CC0 sprite approach |

---

## 1. Core Philosophy

- **Hybrid Authority Model:** Code is Source of Truth. AI is the Narrator.
- **World Assets are permanent.** Write-once constitutions.
- **Movement is absolute.** Players always arrive.
- **Objects mentioned exist.** Narrator cannot un-create what it described. Includes readable objects.
- **Location is authoritative state.**
- **Actions are permitted by default.** Narrator describes, never gatekeeps.
- **Every item has value.** Even flavor items have worth and story.
- **The world has a purpose.** Every campaign has a hidden main quest.
- **Truly endless.** AI generates content on demand.

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
5. **Asset saves** → fire-and-forget
6. **Name reveals** → updateAssetNameRevealed + Zustand patches
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

*Last updated: Session 32 — V4.1: Item value system noted for Day 16. LORE object interaction issue noted. Day 13 starting now.*
