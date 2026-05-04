# Project: Endless Worlds RPG — Master Context

**Version:** 5.1
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
| 15.5 | Dialogue consistency architecture | ✅ Complete |
| Dialogue fixes | NPC persistence, stat check display, logbook content | ✅ Complete |
| 16 | NPC Trading + Item Value | 🔄 In Progress |
| 17-18 | Main Narrative Thread | ⏳ Pending |
| 19+ | Combat, Skills, Factions | ⏳ Pending |

**Active genres:** Fantasy, Cyberpunk, Horror/Lovecraftian, Space Opera, Post-Apocalyptic
**⚠️ Noir has been removed. Do not reference it anywhere in the codebase.**

### Dialogue Fixes (commit 5e6f879)
- `effectiveNpcName` fallback to `currentDialogueNpc` when primary_target is null — NPC name/portrait persists across option clicks
- `resolveDialogue()` now always sets roll/modifier/total/difficulty/success/stat_checked on check path — `buildRollFeedback()` never returns null for stat checks
- LogBook dialogue entry priority: log_summary → last quoted string (Array.from matchAll) → first sentence fallback
- Console breadcrumb: `[resolveDialogue] stat check:` for verification

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
EXAMINE/INTERACT resolver confirms object_confirmed=true. Prepended as first narrator fact.

### 6. Dialogue Is Consistent
All dialogue — clicked option OR typed freely — identical pipeline. No hard gates. Tone classified → stat check applied → NPC constitution + trust injected into narrator.

---

## Location State Machine

```
PRESENT  — in current location. lastNarrativeText = "CURRENT SCENE CONTEXT"
ARRIVING — just moved here. lastNarrativeText = "DEPARTED SCENE (backstory)"
```

---

## 🎯 Main Narrative Thread (Day 17-18)
Hidden World Seed: conflict + goal + 3-5 breadcrumbs + opening hook. Sealed in metadata.main_quest.

## 🎭 NPC Dialogue System (Complete)
- Tone classification: friendly/persuasive/deceptive/intimidating/curious/neutral
- Trust-scaled difficulty: hostile=15, neutral=12, friendly=9, allied=6
- effectiveNpcName fallback ensures NPC context persists across all dialogue turns
- Stat check: roll/modifier/total always set, buildRollFeedback never bails
- Roll line appears in feed before narrator response
- Disposition badge: 🔴/🟠/🟡/🟢/✨ reactive to trust_changes
- No hard gates — stat badge shows risk, all options clickable
- Modal inline, collapses to bar, portrait persists

## 🕵️ NPC Identity System
- name_known=false for CHARACTER. revealed_npc_names pipeline.

## 💎 Item Value System (Day 16 — IN PROGRESS)
Every item: sell value + lore blurb + optional dialogue unlock. Merchant NPCs.

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
- WORLD ASSET + ACTIVE NPC CONTEXT: injected when stat_checked
- log_summary: 12-word max terse fragment (priority for logbook)

---

## Immediate Persistence Architecture
- Log entries + recent_messages: after every narrative action
- World state: after every MOVE or flag change
- Full state: every 10 actions
- Session isolation: clearSessionState() before every session load

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
- Dialogue consistent: same pipeline regardless of input method
- Immediate persistence: location + flags + logs after every action
- Session isolation: clearSessionState() before every session load
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

*Last updated: Session 42 — V5.1: Dialogue fixes complete. NPC persistence, stat check display, logbook content. Day 16 starting.*
