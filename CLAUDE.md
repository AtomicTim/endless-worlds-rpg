# Project: Endless Worlds RPG — Master Context

**Version:** 4.7
**Status:** Active Development — Phase 1 MVP COMPLETE
**Objective:** To create a truly endless, fully-fledged AI-driven RPG engine — text and SVG based — with persistent worlds, real mechanics, and emergent storytelling. Genre-agnostic, infinitely replayable.

---

## 🔄 Current Status (Read This First)

**Current Day:** Day 15 — NPC Dialogue System + Portraits
**Local Dev Port:** 3000
**Stack:** Next.js 14 / Tailwind / shadcn/ui / Supabase / Claude API / Stripe / Vercel
**GitHub Repo:** atomictim/endless-worlds-rpg

| Day | Title | Status |
| --- | --- | --- |
| 1–14 | Phase 1 MVP | ✅ COMPLETE |
| 15 | NPC Dialogue + Portraits | 🔄 In Progress |
| 16 | NPC Trading + Item Value | ⏳ Pending |
| 17-18 | Main Narrative Thread | ⏳ Pending |
| 19-24 | Phase 2 remaining | ⏳ Pending |

**Active genres:** Fantasy, Cyberpunk, Horror/Lovecraftian, Space Opera, Post-Apocalyptic
**⚠️ Noir has been removed. Do not reference it anywhere in the codebase.**

### Phase 1 Complete — What Works
- ✅ Full game loop: Intent Parser → Logic Resolver → Narrator
- ✅ Character creation (5 genres, 5 attributes, 3 backgrounds each)
- ✅ Location state machine (ARRIVING/PRESENT, always correct)
- ✅ World asset persistence (constitutions, SVG art, name_known)
- ✅ Lore codex (auto-populated, 6 categories, detail modals)
- ✅ NPC identity system (placeholders → name reveal pipeline)
- ✅ Inventory (equip/use/drop/search, CONTAINER items, item acquisition)
- ✅ LogBook (immediate persistence, newest-first, terse summaries)
- ✅ Story feed restoration (last 8 messages on resume/refresh)
- ✅ Immediate persistence: location + flags + logs saved after every action
- ✅ Save slots dashboard, Save & Exit, Continue
- ✅ POI system (clickable highlights, InteractionPopover)
- ✅ SVG art engine (async, cached per location+session)
- ✅ Dialogue prefix (quoted text → instant DIALOGUE)
- ✅ Fast-path actions (equip/drop/read — zero AI calls)
- ✅ Object existence guarantee (resolver confirms, narrator cannot deny)

### Supabase Tables (all applied ✅)
- `profiles`, `game_sessions`, `characters`, `world_states`, `log_books`, `npcs`, `subscriptions`, `community_templates`, `user_preferences`
- `art_cache`, `world_assets` (+ svg_content, name_known), `codex`

### Immediate Persistence Architecture
- Log entries: `POST /api/game/log-entries` after every narrative action
- World state: `POST /api/game/world-state` after every MOVE or flag change
- Recent messages: saved as part of LogBook patch
- Full state: every 10 actions (AUTO_SAVE_INTERVAL=10)

---

## ⚡ FOUNDATIONAL RULES (Read Before Every Session)

### 1. World Assets Are Permanent
Write-once constitution. `ignoreDuplicates: true`. SVG backfilled separately via updateWorldAssetSvg().

### 2. Movement Is Absolute
MOVE always succeeds. location_status: ARRIVING. World state saved immediately after every MOVE.

### 3. Location Is Authoritative State
`current_location_id` always correct. Saved immediately on MOVE. Never inferred from narrative.

### 4. Actions Are Permitted By Default
Plausible actions always attempted. Narrator describes outcomes, never gatekeeps.

### 5. Objects Mentioned Exist
EXAMINE/INTERACT resolver confirms object_confirmed=true at code level. Prepended as first fact to narrator. POI labels exact — no synonyms.

---

## Location State Machine

```
PRESENT  — in current location. lastNarrativeText = "CURRENT SCENE CONTEXT"
ARRIVING — just moved here. lastNarrativeText = "DEPARTED SCENE (backstory)"
World state saved immediately on ARRIVING.
```

---

## 🎯 Main Narrative Thread (Day 17-18)
Hidden World Seed: conflict + goal + 3-5 breadcrumbs + opening hook. Sealed in metadata.main_quest.
Narrator plants clues naturally. Player can follow or free-roam.
Win conditions: narrative resolution, faction victory, survival, discovery.

## 🎭 NPC Dialogue Window + Portraits (Day 15 — IN PROGRESS)
- SVG FRONT_PORTRAIT generated async on first NPC encounter
- Dedicated dialogue modal: portrait + name/placeholder + formatted dialogue + 3-4 AI response options + free input
- Portrait cached in world_assets.svg_content
- Charisma-gated response options
- Name/portrait update when identity revealed

## 🕵️ NPC Identity System
- name_known=false for CHARACTER by default
- looksLikePlaceholder() — 2+ matching words from expanded set
- revealed_npc_names in NarratorResponse — asset_id copied verbatim
- updateMessagesNpcName() patches existing feed messages on reveal
- updateAssetNameRevealed() updates world_assets + codex

## 💎 Item Value System (Day 16)
Every item: sell value + lore blurb + optional dialogue unlock.
Flavor items worth selling/discussing with NPCs.

## SVG Art Engine — Future (Phase 3)
Option B (templates) + D (CC0 sprites). Deferred to Day 25+.

---

## Narrator Architecture

- **Tier 1** (2-3 sentences): PRESENT repeated, USE_ITEM, simple CUSTOM
- **Tier 2** (4-6 sentences): EXAMINE, ATTACK, INTERACT, DIALOGUE, first NPC
- **Tier 3** (80-120 words): ARRIVING at NEW location, major moments
- GOLDEN RULE: honor action, yes-and
- MOVE: always arrives, world state saved immediately
- EXAMINE/INTERACT: object_confirmed prepended as first fact
- WORLD ASSET: constitutions injected as immutable facts
- DIALOGUE: "NPC: 'speech'" — quoted in accent/italic, prose normal
- NPC NAMES: asset_id copied verbatim from ESTABLISHED WORLD ASSETS
- log_summary: 12-word max terse fragment, no "You/I/explored"

---

## Action Classification

- **FAST PATH**: equip, unequip, drop, read lore (zero AI, instant)
- **NARRATIVE PATH**: MOVE, ATTACK, INTERACT, EXAMINE, DIALOGUE, USE_ITEM(CONSUMABLE), search CONTAINER
- **DIALOGUE**: quoted text → instant DIALOGUE, no AI call
- **MOVE**: always MOVE_SUCCESS + immediate world state save
- **EXAMINE/INTERACT**: always success=true + object_confirmed

---

## Planned Systems

| System | When | Description |
| --- | --- | --- |
| NPC Dialogue + Portraits | Day 15 | Dialogue modal, SVG portraits, Charisma gates |
| NPC Trading + Item Value | Day 16 | Merchants, buy/sell, item value + lore blurbs |
| Main Narrative Thread | Day 17-18 | World Seed, main quest, breadcrumbs, win conditions |
| Combat System | Day 19 | Turn-based combat, enemy AI, loot |
| Skills & Abilities | Day 20 | Skill trees, attribute thresholds, active/passive |
| Art Engine Overhaul | Phase 3 (Day 25+) | Templates + CC0 sprites |

---

## Core Philosophy

- Hybrid Authority: Code = Truth, AI = Narrator
- World Assets permanent, Movement absolute, Objects exist
- Immediate persistence: location + flags + logs saved after every relevant action
- Actions permitted by default, Location authoritative
- Every item has value, Every campaign has a purpose
- Truly endless — AI generates content on demand

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

*Last updated: Session 38 — V4.7: Phase 1 MVP COMPLETE. All persistence verified. Day 15 starting.*
