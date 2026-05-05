# Project: Endless Worlds RPG — Master Context

**Version:** 5.7
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

### Latest Fixes (NPC key prefix + location normalization)
- `findNpcInRegistry`: prefix-strip fallback — looks up both `character_X` and `X` forms
- `useGameLoop` step 7g: npcRegistryKey always `normalizeAssetId(CHARACTER, name)` — canonical `character_<slug>` form stored in `currentDialogueNpcKey`
- Seeding existence check uses `findNpcInRegistry` (honors all prefix variants)
- `codex.ts`: `toSlug()`, `stripArticles()`, `normalizeLocationId()` helpers added
- `normalizeAssetId` for LOCATION strips articles: "The Tavern" → "location_tavern"
- `resolveMove`: destination normalized via `normalizeLocationId` before writing `current_location_id`
- Two-channel match log: `[GameLoop/7d] two-channel check:` now logs on every reveal
- Confirmed: narrator now correctly outputs `revealed_npc_names` with proper asset_ids

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
MOVE always succeeds. `current_location_id` normalized via `normalizeLocationId()`.

### 3. Location Is Authoritative State
`current_location_id` always correct. Normalized slug. Saved immediately on MOVE.

### 4. Actions Are Permitted By Default
Plausible actions always attempted. Narrator describes outcomes only.

### 5. Objects Mentioned Exist
EXAMINE/INTERACT resolver confirms object_confirmed=true. Prepended as first narrator fact.

### 6. Dialogue Is Consistent
All dialogue identical pipeline. NPC name passed directly. Stat checks fire from tone. All appear in feed AND logbook.

### 7. The AI Has Exactly Three Roles
**Generator:** Creates assets on first encounter. Immutable after.
**Bridge:** Describes results of player actions. Never speaks for the player or invents history.
**Thread:** Plants subtle story breadcrumbs. Never forces or blocks.

---

## 🎮 Game System Architecture

**NPC interaction model (authoritative sources):**
- Constitution → `world_assets` (locked on first meeting)
- Trust score → `npc_registry` (seeded at 50, keyed by `normalizeAssetId(CHARACTER, name)`)
- Registry key → always full `character_<slug>` form via `normalizeAssetId`
- `findNpcInRegistry` handles both prefixed and unprefixed lookups
- Disposition → `getNpcDisposition(trustScore ?? 50)` — always renders
- Name → updates modal via two-channel match (name OR key)
- locationAssets → loaded on page mount AND late-loaded fallback

**Location ID model:**
- All `current_location_id` values are normalized slugs via `normalizeLocationId()`
- Articles stripped: "The Wanderer's Rest" → "wanderers_rest"
- Consistent across narrator output, codex entries, and world_assets

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
- seedNpcRegistry() on first encounter, immediately patches store
- findNpcInRegistry() handles prefixed/unprefixed key variants
- currentDialogueNpcKey always full `character_<slug>` canonical form
- All 4 stat checks fire (CHA/STR/PER/INT), appear in feed + logbook
- Disposition badge always renders (🟡 Neutral fallback)
- Name reveal: narrator outputs correctly, two-channel match with full canonical keys
- SPA navigation preserves dialogue

## 🕵️ NPC Identity System
- name_known=false for CHARACTER. revealed_npc_names MANDATORY.

## 💎 Item Value System (Day 16)
Every item: sell value + lore blurb + optional dialogue unlock. Merchant NPCs.

## 🎒 Character Background System (Phase 3)
Full background/traits. Affects NPC reactions, starting state, faction rep.

---

## Narrator Architecture

**Pure interpreter of game state.**
- `revealed_npc_names` MANDATORY FIRST field
- YOUR ROLE block — three jobs, player blank-slate enforced
- ACTIVE NPC CONTEXT for all DIALOGUE
- Tier 1/2/3 response lengths by action type
- log_summary: 12-word max terse fragment

---

## Immediate Persistence Architecture
- Log entries + recent_messages: after every narrative action
- World state (normalized location ID): after every MOVE or flag change
- npc_registry: immediately patched to store on seed
- locationAssets: loaded on page mount + late-loaded fallback
- Full state: every 10 actions
- clearSessionState() on session switch, clearTransientState() on SPA nav

---

## Planned Systems

| System | When | Description |
| --- | --- | --- |
| NPC Trading + Item Value | Day 16 | Merchants, buy/sell, item value + lore blurbs |
| Main Narrative Thread | Day 17-18 | World Seed, main quest, breadcrumbs |
| Combat System | Day 19 | Turn-based, enemy AI, loot |
| Skills & Abilities | Day 20 | Skill trees, attribute thresholds |
| Character Background | Phase 3 | Traits, history, faction rep |
| Art Engine Overhaul | Phase 3 (Day 25+) | Templates + CC0 sprites |

---

## Core Philosophy

- **Hybrid Authority:** Code = Truth, AI = pure interpreter
- **AI has 3 roles only:** Generator → Bridge → Thread
- **Player is blank slate:** AI never speaks for them or invents history
- **NPC state from game state:** canonical keys, registry always seeded
- **Location IDs normalized:** articles stripped, consistent slugs
- World Assets permanent, Movement absolute, Objects exist
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

*Last updated: Session 48 — V5.7: NPC key prefix canonical, location ID normalization, name reveal confirmed working. Day 16 starting.*
