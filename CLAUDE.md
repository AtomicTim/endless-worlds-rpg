# Project: Endless Worlds RPG — Master Context

**Version:** 4.3
**Status:** Active Development — Phase 1 MVP Nearly Complete
**Objective:** To create a truly endless, fully-fledged AI-driven RPG engine — text and SVG based — with persistent worlds, real mechanics, and emergent storytelling. Genre-agnostic, infinitely replayable.

---

## 🔄 Current Status (Read This First)

**Current Day:** Day 14 — MVP Playtest & Bug Fix
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
| 13 | Log Book & Save System | ✅ Complete |
| LogBook fixes | Persistence via Zustand, log_summary, improved formats | ✅ Complete |
| 14 | MVP Playtest & Bug Fix | 🔄 In Progress |

**Active genres:** Fantasy, Cyberpunk, Horror/Lovecraftian, Space Opera, Post-Apocalyptic
**⚠️ Noir has been removed. Do not reference it anywhere in the codebase.**

### Supabase Tables (all applied ✅)
- `profiles`, `game_sessions`, `characters`, `world_states`, `log_books`, `npcs`, `subscriptions`, `community_templates`, `user_preferences`
- `art_cache` — SVG art per location+session
- `world_assets` — constitutions + svg_content + name_known
- `codex` — lore encyclopedia entries

### LogBook Architecture (post-fix)
- `persistedLogEntries` in Zustand — survives SPA navigation
- `addPersistedLogEntry()` — appends, keeps last 100
- `mergePersistedLogEntries()` — seeds from DB on hard refresh without overwriting live entries
- `LogBook.tsx` reads from `persistedLogEntries`, not masterState
- `log_summary` in NarratorResponse — 12-word max terse journal fragment
- Entry formats: STORY=log_summary, DIALOGUE=first quoted speech, COMBAT=compact roll line, DISCOVERY="Found: X (Rarity)"

---

## ⚡ FOUNDATIONAL RULES (Read Before Every Session)

### 1. World Assets Are Permanent
Every significant entity introduced becomes an immutable game asset. Write-once constitution. `ignoreDuplicates: true`.

### 2. Movement Is Absolute
MOVE always succeeds. Only block: world flag `<location_id>_locked: true`.

### 3. Location Is Authoritative State
`current_location_id` is always correct. Never inferred from narrative.

### 4. Actions Are Permitted By Default
Plausible actions always attempted. Narrator describes outcomes only.

### 5. Objects Mentioned Exist
If narrator described it, player can interact with it. Includes journals, books, notes, signs, documents. Narrator CANNOT retroactively un-create anything.

---

## Location State Machine

```
PRESENT  — acting in current location. lastNarrativeText = "CURRENT SCENE CONTEXT"
ARRIVING — just moved here. lastNarrativeText = "DEPARTED SCENE (backstory)"
```

---

## 🎯 Main Narrative Thread (Day 17-18)
Hidden World Seed: conflict + goal + 3-5 breadcrumbs + opening hook. Sealed in metadata.main_quest.

## 🎭 NPC Dialogue Window + Portraits (Day 15)
SVG FRONT_PORTRAIT async on first encounter. Dialogue modal with portrait + options + free input.

## 🕵️ NPC Identity System
name_known=false for CHARACTER. looksLikePlaceholder() 2+ word match. revealed_npc_names pipeline.

## 💎 Item Value System (Day 16)
Every item has sell value + lore blurb + optional dialogue unlock.

## ⚠️ Known Narrator Issue
Occasional LORE object blocking. Monitor during Day 14 playtest.

---

## SVG Art Engine — Future (Phase 3)
Option B (templates) + D (CC0 sprites). Deferred to Day 25+.

---

## Narrator Architecture

- **Tier 1** (2-3 sentences): PRESENT repeated, USE_ITEM, simple CUSTOM
- **Tier 2** (4-6 sentences): EXAMINE, ATTACK, INTERACT, DIALOGUE, first NPC
- **Tier 3** (80-120 words): ARRIVING at NEW location, major moments
- GOLDEN RULE: honor action, yes-and
- MOVE: always arrives
- EXAMINE/INTERACT/READ: always resolves, includes readable objects
- WORLD ASSET: constitutions as facts
- DIALOGUE: "NPC: 'speech'" quoted in accent/italic
- log_summary: 12-word max terse fragment, no "You/I/explored"

---

## Action Classification

- **FAST PATH**: equip, unequip, drop, read lore
- **NARRATIVE PATH**: MOVE, ATTACK, INTERACT, EXAMINE, DIALOGUE, USE_ITEM(CONSUMABLE), search CONTAINER
- **DIALOGUE**: quoted → instant, no AI
- **MOVE**: always MOVE_SUCCESS
- **EXAMINE/INTERACT/READ**: always resolves

---

## Planned Systems

| System | When | Description |
| --- | --- | --- |
| MVP Playtest | Day 14 | Full playtest, bug list, Phase 1 complete |
| NPC Dialogue + Portraits | Day 15 | Dialogue modal, SVG portraits, identity |
| NPC Trading + Item Value | Day 16 | Merchants, buy/sell, item value + lore blurbs |
| Main Narrative Thread | Day 17-18 | World Seed, main quest, breadcrumbs |
| Art Engine Overhaul | Phase 3 (Day 25+) | Templates + CC0 sprites |

---

## Core Philosophy

- Hybrid Authority: Code = Truth, AI = Narrator
- World Assets permanent, Movement absolute, Objects mentioned exist
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

*Last updated: Session 34 — V4.3: LogBook persistence + quality fixes complete. Day 14 playtest starting.*
