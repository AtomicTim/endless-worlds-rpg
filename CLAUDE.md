# Project: Endless Worlds RPG — Master Context

**Version:** 5.5
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
| 15.5 | Dialogue consistency + integrity patch | ✅ Complete |
| All dialogue fixes | Registry, stat checks, disposition, SPA nav, name reveal | ✅ Complete |
| 16 | NPC Trading + Item Value | 🔄 In Progress |
| 17-18 | Main Narrative Thread | ⏳ Pending |
| 19+ | Combat, Skills, Factions | ⏳ Pending |

**Active genres:** Fantasy, Cyberpunk, Horror/Lovecraftian, Space Opera, Post-Apocalyptic
**⚠️ Noir has been removed. Do not reference it anywhere in the codebase.**

### Final Dialogue Fixes (commit e8b684e)
- Modal name reveal: two-channel match (placeholder name OR registry key) — robust against race conditions
- Stat check rolls: step 3b moved below step 4 so updatedState exists — rolls go to feed AND logbook as COMBAT entry
- STR/PER/INT checks: all fields set correctly (stat_checked lowercase, roll, modifier, total, difficulty, success)
- curious tone now fires Perception check (was no-op)
- Verification log: `[resolveDialogue] stat check fields:` prints all fields for console confirmation

### Dialogue System — Complete Stat Check Matrix
| Tone | Stat | Notes |
| --- | --- | --- |
| persuasive | CHA | charisma_check=true also set |
| deceptive | CHA | +2 difficulty vs persuasive |
| intimidating | STR | falls back to CHA if STR < 10 |
| curious | PER | investigative speech |
| friendly/neutral | none | no check |

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
All dialogue identical pipeline. NPC name passed directly. Stat checks always fire from tone. All checks appear in feed AND logbook.

### 7. The AI Has Exactly Three Roles
**Generator:** Creates assets on first encounter. Immutable after.
**Bridge:** Describes results of player actions. Never speaks for the player or invents history.
**Thread:** Plants subtle story breadcrumbs. Never forces or blocks.

---

## 🎮 Game System Architecture

**NPC interaction model (authoritative sources):**
- Constitution → `world_assets` (locked on first meeting)
- Trust score → `npc_registry` (seeded at 50 on first dialogue, updated by trust_changes)
- Disposition → `getNpcDisposition(trustScore ?? 50)` — always renders
- Name → `world_assets.name` (updates in modal via two-channel reveal match)
- Registry key → `normalizeAssetId(CHARACTER, name)`
- Stat checks → resolver sets all fields; feed + logbook COMBAT entry

---

## 🔮 Future Systems

### Character Background System (Phase 3)
Background traits in player_state, injected into narrator. Affects NPC reactions, rep.

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
- NPC name passed directly, never re-extracted
- seedNpcRegistry() on first encounter, findNpcInRegistry() multi-strategy lookup
- All 4 stat checks fire (CHA/STR/PER/INT), appear in feed + logbook
- Disposition badge always renders (🟡 Neutral fallback)
- Name reveal updates modal via two-channel match
- SPA navigation preserves dialogue (clearTransientState vs clearSessionState)
- ACTIVE NPC CONTEXT injected for all dialogue

## 🕵️ NPC Identity System
- name_known=false for CHARACTER. revealed_npc_names. Modal updates on reveal.

## 💎 Item Value System (Day 16)
Every item: sell value + lore blurb + optional dialogue unlock. Merchant NPCs.

## 🎒 Character Background System (Phase 3)
Full background/traits. Affects NPC reactions, starting state, faction rep.

---

## SVG Art Engine — Future (Phase 3)
Option B (templates) + D (CC0 sprites). Deferred to Day 25+.

---

## Narrator Architecture

**Pure interpreter of game state.**
- YOUR ROLE block FIRST — three jobs, player blank-slate enforced
- ACTIVE NPC CONTEXT (constitution + trust from npc_registry) for all DIALOGUE
- Tier 1/2/3 response lengths by action type
- log_summary: 12-word max terse fragment

---

## Immediate Persistence Architecture
- Log entries + recent_messages: after every narrative action
- World state: after every MOVE or flag change
- Full state: every 10 actions
- clearSessionState() on session switch, clearTransientState() on SPA nav

---

## Planned Systems

| System | When | Description |
| --- | --- | --- |
| NPC Trading + Item Value | Day 16 | Merchants, buy/sell, item value + lore blurbs |
| Main Narrative Thread | Day 17-18 | World Seed, main quest, breadcrumbs |
| Combat System | Day 19 | Turn-based combat, enemy AI, loot |
| Skills & Abilities | Day 20 | Skill trees, attribute thresholds |
| Character Background | Phase 3 | Traits, history, faction rep |
| Art Engine Overhaul | Phase 3 (Day 25+) | Templates + CC0 sprites |

---

## Core Philosophy

- **Hybrid Authority:** Code = Truth, AI = pure interpreter
- **AI has 3 roles only:** Generator → Bridge → Thread
- **Player is blank slate:** AI never speaks for them or invents history
- **NPC state from game state:** npc_registry always seeded, authoritative
- World Assets permanent, Movement absolute, Objects exist
- Dialogue consistent: all stat checks fire, all appear in feed + logbook
- Immediate persistence after every relevant action
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

*Last updated: Session 46 — V5.5: All dialogue fixes complete. Stat checks in feed+logbook, name reveal robust, curious→PER. Day 16 starting.*
