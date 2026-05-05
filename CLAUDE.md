# Project: Endless Worlds RPG — Master Context

**Version:** 5.8
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
| Narrator simplification | Text+tone only, game code derives all mechanics | ✅ Complete |
| 16 | NPC Trading + Item Value | 🔄 In Progress |
| 17-18 | Main Narrative Thread + World Seed | ⏳ Pending |
| 19+ | Combat, Skills, Factions | ⏳ Pending |

**Active genres:** Fantasy, Cyberpunk, Horror/Lovecraftian, Space Opera, Post-Apocalyptic
**⚠️ Noir has been removed. Do not reference it anywhere in the codebase.**

### Narrator Simplification (commit a0fecc5 — 86/86 tests, clean build)

**The core architectural principle now enforced in code:**
The narrator outputs narrative text and simple values only.
The game engine derives all structured mechanics from those values.

Specific changes:
- `revealed_npc_names`: narrator outputs `{ true_name }` only — no asset_id
  - Game code derives asset_id via 3-step lookup: name match → constitution.true_name → active NPC fallback
- `dialogue_options`: removed `stat_check` entirely — narrator outputs `{ id, text, tone }` only
  - `getToneBadge(tone, attributes)` in DialogueModal derives badge from player's actual current stats
  - Badge shows real value: "💬 CHA 12" not narrator's guess
- `forcedStatCheck` removed entirely — tone classification is the single source of truth
- Modal timing fix: step 7d computes `activeNpcName` from `options?.npcName ?? gs.currentDialogueNpc ?? parsedAction.primary_target` — independent of store timing

### Dialogue System — Stat Check Matrix (tone → check, game code only)
| Tone | Stat | Notes |
| --- | --- | --- |
| persuasive | CHA | |
| deceptive | CHA | +2 difficulty |
| aggressive/intimidating | STR | falls back to CHA if STR < 10 |
| curious | PER | |
| friendly/neutral | none | no check |

---

## 🎮 The Three-Layer World Model

**Layer 1 — World Seed (Day 17-18):** Engine pre-generates macro facts before player arrives:
- Overarching conflict, factions, major settlements, main quest antagonist
- Planted as seeds — player discovers them, they were always there

**Layer 2 — AI Asset Generation (current):** On first encounter, narrator invents:
- Specific location details, NPC appearance/personality, item descriptions
- These are immediately locked as permanent game assets (write-once)
- AI stays within World Seed guardrails once those exist

**Layer 3 — Game Engine (always):** Owns all mechanical state:
- Stat checks, dice rolls, outcomes
- Trust scores, flags, inventory
- Location IDs, asset keys, relationships

The AI narrates Layer 1 and 2 facts. It never owns them.

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
All dialogue identical pipeline. Tone → stat check (game code). Badge shows real player stat.

### 7. The AI Has Exactly Three Roles
**Generator:** Invents content on first encounter. Locked immediately. Stays within seed guardrails.
**Bridge:** Describes mechanical outcomes as narrative prose. Never decides outcomes.
**Thread:** Plants story breadcrumbs. Never forces or blocks.

---

## 🎮 Game System Architecture

**NPC interaction model (authoritative sources):**
- Constitution → `world_assets` (locked on first meeting, AI-generated content)
- Trust score → `npc_registry` (seeded at 50, updated by trust_changes)
- Disposition → `getNpcDisposition(trustScore ?? 50)` — always renders
- Registry key → `normalizeAssetId(CHARACTER, name)` — canonical `character_<slug>`
- findNpcInRegistry → handles both prefixed/unprefixed variants
- Name reveal → step 7d computes key from action context, not store timing

**Location ID model:**
- Normalized slugs via `normalizeLocationId()` — articles stripped
- Consistent across narrator, codex, world_assets

---

## 🔮 Future Systems

### Character Background System (Phase 3)
Background traits in player_state, injected into narrator. Affects NPC reactions, rep.

### World Seed (Day 17-18)
Pre-generates macro world facts before player arrives. AI fills detail within those guardrails.

---

## Location State Machine

```
PRESENT  — in current location. lastNarrativeText = "CURRENT SCENE CONTEXT"
ARRIVING — just moved here. lastNarrativeText = "DEPARTED SCENE (backstory)"
```

---

## 🎭 NPC Dialogue System (Complete)
- Narrator outputs: narrative text + `{ id, text, tone }` options + `{ true_name }` reveals
- Game code derives: asset IDs, stat checks, badges, difficulty scaling
- Badge shows player's actual stat ("💬 CHA 12") — always accurate
- Modal timing: computes npcKey from action context, not store
- Disposition badge: always renders (🟡 Neutral fallback)
- SPA navigation preserves dialogue state

## 🕵️ NPC Identity System
- name_known=false for CHARACTER by default
- revealed_npc_names: `{ true_name }` only — game code finds matching asset

## 💎 Item Value System (Day 16)
Every item: sell value + lore blurb + optional dialogue unlock. Merchant NPCs.

---

## Narrator Architecture

**Narrator outputs: text + simple values. Game code derives: all mechanics.**

- Narrative text, log_summary, sound_id — narrator owned
- `{ true_name }` for name reveals — narrator outputs, game code maps to asset
- `{ id, text, tone }` for dialogue options — narrator outputs, game code derives check
- Asset IDs, stat checks, difficulty, roll results — game code only, never narrator
- YOUR ROLE block FIRST — three jobs, player blank-slate enforced
- ACTIVE NPC CONTEXT injected for all DIALOGUE (constitution + trust)
- Tier 1/2/3 response lengths by action type

---

## Immediate Persistence Architecture
- Log entries + recent_messages: after every narrative action
- World state: after every MOVE or flag change
- npc_registry: immediately patched to store on seed
- locationAssets: loaded on page mount + late-loaded fallback
- Full state: every 10 actions
- clearSessionState() on session switch, clearTransientState() on SPA nav

---

## Planned Systems

| System | When | Description |
| --- | --- | --- |
| NPC Trading + Item Value | Day 16 | Merchants, buy/sell, item value + lore blurbs |
| Main Narrative Thread + World Seed | Day 17-18 | Macro world facts, main quest, breadcrumbs |
| Combat System | Day 19 | Turn-based, enemy AI, loot |
| Skills & Abilities | Day 20 | Skill trees, attribute thresholds |
| Character Background | Phase 3 | Traits, history, faction rep |
| Art Engine Overhaul | Phase 3 (Day 25+) | Templates + CC0 sprites |

---

## Core Philosophy

- **Hybrid Authority:** Code = Truth, AI = narrator of code-owned facts
- **AI generates detail, engine generates structure**
- **World Seed → AI detail → permanent lock → narrator describes**
- **AI has 3 roles:** Generator (within guardrails) → Bridge → Thread
- **Player is blank slate:** AI never speaks for them or invents their history
- **Narrator outputs text + simple values only — never structured game data**
- World Assets permanent, Movement absolute, Objects exist
- Truly endless — procedurally generated at every layer

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

*Last updated: Session 49 — V5.8: Narrator simplification complete. Text+tone only. Game code derives all mechanics. Three-layer world model documented. Day 16 starting.*
