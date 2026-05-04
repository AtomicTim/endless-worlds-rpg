# Project: Endless Worlds RPG — Master Context

**Version:** 4.8
**Status:** Active Development — Phase 2 In Progress
**Objective:** To create a truly endless, fully-fledged AI-driven RPG engine — text and SVG based — with persistent worlds, real mechanics, and emergent storytelling. Genre-agnostic, infinitely replayable.

---

## 🔄 Current Status (Read This First)

**Current Day:** Day 16 — NPC Trading + Item Value System
**Local Dev Port:** 3000
**Stack:** Next.js 14 / Tailwind / shadcn/ui / Supabase / Claude API / Stripe / Vercel
**GitHub Repo:** atomictim/endless-worlds-rpg

| Day | Title | Status |
| --- | --- | --- |
| 1–14 | Phase 1 MVP | ✅ Complete |
| 15 | NPC Dialogue + Portraits | ✅ Complete |
| 16 | NPC Trading + Item Value | 🔄 In Progress |
| 17-18 | Main Narrative Thread | ⏳ Pending |
| 19+ | Combat, Skills, Factions | ⏳ Pending |

**Active genres:** Fantasy, Cyberpunk, Horror/Lovecraftian, Space Opera, Post-Apocalyptic
**⚠️ Noir has been removed. Do not reference it anywhere in the codebase.**

### Day 15 Deliverables (confirmed on main — commit 1d011b2)
- `lib/game/art-generator.ts`: generateNpcPortrait() — uses npc.id as art cache key
- `hooks/useGameLoop.ts`: portrait generation on DIALOGUE/new_npcs, live-updates modal
- `types/game.ts`: DialogueOption, trust_changes in NarratorResponse
- `lib/game/prompt-builder.ts`: DIALOGUE OPTIONS + TRUST CHANGES in narrator schema
- `lib/game/narrator.ts`: normalizeDialogueOption(), normalizeTrustChange() parsers
- `lib/stores/game-store.ts`: currentDialogueOptions, currentDialogueNpc, currentNpcPortrait
- `components/game/DialogueModal.tsx`: slides above InputBar, portrait left, options right, tone dots, CHA locks
- `components/game/InputBar.tsx`: forwardRef with InputBarHandle.focus()
- `lib/game/logic-resolver.ts`: resolveDialogue() — Charisma check with d20+CHA vs 12
- Trust system: trust_changes processed in step 7e, updateNPCTrust called

### Phase 1 Complete — What Works
- ✅ Full game loop, character creation, location state machine
- ✅ World asset persistence, lore codex, NPC identity system
- ✅ Inventory (equip/use/drop/search, CONTAINER items)
- ✅ LogBook (immediate persistence, terse summaries)
- ✅ Story feed restoration, immediate persistence for all state
- ✅ POI system, SVG art engine, dialogue prefix, fast-path actions
- ✅ Object existence guarantee (resolver confirms)
- ✅ NPC dialogue modal with portraits, response options, CHA gates, trust system

---

## ⚡ FOUNDATIONAL RULES (Read Before Every Session)

### 1. World Assets Are Permanent
Write-once constitution. `ignoreDuplicates: true`. SVG backfilled separately.

### 2. Movement Is Absolute
MOVE always succeeds. World state saved immediately after every MOVE.

### 3. Location Is Authoritative State
`current_location_id` always correct. Saved immediately on MOVE.

### 4. Actions Are Permitted By Default
Plausible actions always attempted. Narrator describes outcomes only.

### 5. Objects Mentioned Exist
EXAMINE/INTERACT resolver confirms object_confirmed=true. Prepended as first narrator fact. POI labels exact.

---

## Location State Machine

```
PRESENT  — in current location. lastNarrativeText = "CURRENT SCENE CONTEXT"
ARRIVING — just moved here. lastNarrativeText = "DEPARTED SCENE (backstory)"
```

---

## 🎯 Main Narrative Thread (Day 17-18)
Hidden World Seed: conflict + goal + 3-5 breadcrumbs + opening hook. Sealed in metadata.main_quest.

## 🎭 NPC Dialogue System (Day 15 — Complete)
- DialogueModal: slides above InputBar, portrait left, options right
- 3-4 AI-generated response options with tone dots + CHA locks
- Charisma check: d20 + CHA modifier vs 12 for persuade/intimidate/deceive
- Trust system: trust_changes in NarratorResponse, updateNPCTrust called
- Portrait: async FRONT_PORTRAIT SVG, cached in art_cache + world_assets

## 🕵️ NPC Identity System
- name_known=false for CHARACTER. looksLikePlaceholder() 2+ word match
- revealed_npc_names pipeline. updateMessagesNpcName patches feed.

## 💎 Item Value System (Day 16 — IN PROGRESS)
Every item: sell value + lore blurb + optional dialogue unlock.
Merchant NPCs with dynamic inventory. Buy/sell UI.

---

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
- WORLD ASSET: constitutions injected as facts
- DIALOGUE: response options + trust_changes in response
- CHARISMA CHECK: d20+CHA vs 12, outcome in narrative_context
- log_summary: 12-word max terse fragment

---

## Action Classification

- **FAST PATH**: equip, unequip, drop, read lore
- **NARRATIVE PATH**: MOVE, ATTACK, INTERACT, EXAMINE, DIALOGUE, USE_ITEM(CONSUMABLE), search CONTAINER
- **DIALOGUE**: quoted text → instant DIALOGUE, no AI call
- **MOVE**: always MOVE_SUCCESS + immediate world state save
- **EXAMINE/INTERACT**: always success=true + object_confirmed

---

## Planned Systems

| System | When | Description |
| --- | --- | --- |
| NPC Trading + Item Value | Day 16 | Merchants, buy/sell, item value + lore blurbs |
| Main Narrative Thread | Day 17-18 | World Seed, main quest, breadcrumbs |
| Combat System | Day 19 | Turn-based combat, enemy AI, loot |
| Skills & Abilities | Day 20 | Skill trees, attribute thresholds |
| Art Engine Overhaul | Phase 3 (Day 25+) | Templates + CC0 sprites |

---

## Core Philosophy

- Hybrid Authority: Code = Truth, AI = Narrator
- World Assets permanent, Movement absolute, Objects exist
- Immediate persistence: location + flags + logs after every action
- Actions permitted by default, Location authoritative
- Every item has value, Every campaign has a purpose
- Truly endless — AI generates on demand

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

*Last updated: Session 39 — V4.8: Day 15 complete (86/86 tests). NPC dialogue modal, portraits, CHA gates, trust system. Day 16 starting.*
