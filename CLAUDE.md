# Project: Endless Worlds RPG — Master Context

**Version:** 3.3
**Status:** Active Development — MVP Core Loop Complete
**Objective:** To create a genre-agnostic, AI-driven RPG engine that combines hard-coded game logic with dynamic LLM storytelling and ASCII visuals.

---

## 🔄 Current Status (Read This First)

**Current Day:** Day 13.5 — World Asset System + Lore Codex
**Local Dev Port:** 3000
**Stack:** Next.js 14 / Tailwind / shadcn/ui / Supabase / Claude API / Stripe / Vercel
**GitHub Repo:** atomictim/endless-worlds-rpg

| Day | Title | Status |
| --- | --- | --- |
| 1–12 | Foundation through Inventory | ✅ Complete |
| Patch A | Narrator redesign, POI system | ✅ Complete |
| Patch B | CONTAINER items, SVG art engine, dialogue prefix | ✅ Complete |
| Location fix | State machine, ARRIVING/PRESENT, action authority | ✅ Complete |
| Day 13.5 | World Asset System + Lore Codex | 🔄 In Progress |
| 13 | Log Book & Save System | ⏳ Pending |
| 14 | MVP Playtest & Bug Fix | ⏳ Pending |

**Active genres:** Fantasy, Cyberpunk, Horror/Lovecraftian, Space Opera, Post-Apocalyptic
**⚠️ Noir has been removed. Do not reference it anywhere in the codebase.**

---

## ⚡ FOUNDATIONAL RULES (Read Before Every Session)

### 1. World Assets Are Permanent
Every significant entity the Narrator introduces becomes an immutable game asset. Named locations, characters, factions, creatures, unique items — all locked on first introduction with a constitution that never changes unless the story explicitly changes it. Stored in world_assets Supabase table (Day 13.5). Injected into every relevant Narrator call as hard facts.

### 2. Movement Is Absolute
MOVE actions always succeed. The only valid block is a world flag `<location_id>_locked: true`. Distance and danger are journey flavor, never blockers. `resolveMove()` always returns MOVE_SUCCESS with `location_status: ARRIVING`.

### 3. Location Is Authoritative State
`current_location_id` in world_state is the single source of truth for player location. The Narrator must never infer location from narrative history. The PLAYER STATE header in every narrator prompt makes this unambiguous.

### 4. Actions Are Permitted By Default
If an action is physically plausible at the current location, the player can attempt it. The Narrator describes what happens — it does not decide if the player is allowed to try. The only valid blocks are hard physics/logic (locked door without key, can't fly without wings). All other actions succeed or fail through the Logic Resolver, not the Narrator.

---

## Location State Machine

```
LocationStatus enum: PRESENT | ARRIVING

PRESENT  — player is here, taking actions within this location
           Narrator: picks up contextually, doesn't re-describe whole scene
           lastNarrativeText labeled: "CURRENT SCENE CONTEXT"

ARRIVING — player just moved here this turn (MOVE action)
           Narrator: describes journey + first impressions
           lastNarrativeText labeled: "DEPARTED SCENE (backstory)"

Every resolver sets location_status in state_delta:
- MOVE_SUCCESS → ARRIVING + new current_location_id
- All other actions → PRESENT

narratorState always receives merged world_state before narrator call
```

---

## Key Deliverables Log

### Location Fix (confirmed on main — 43/43 tests, build clean)
- `types/game.ts`: LocationStatus enum, WorldState.location_status, StateDelta type
- `state-factory.ts`: location_status: PRESENT as default
- `logic-resolver.ts`: full rewrite — every resolver sets PRESENT, MOVE sets ARRIVING
- `useGameLoop.ts`: narratorState merges world_state delta before every narrator call
- `prompt-builder.ts`: LOCATION & ACTION AUTHORITY (5 rules), ══ PLAYER STATE ══ header, conditional ARRIVING/PRESENT framing

### Patch B (confirmed on main)
- CONTAINER item type, search mechanic, already-searched state
- SVG art engine: /api/game/generate-art, scene_type detection, async fade-in
- art_cache Supabase table (UNIQUE per location_id+session_id) — applied
- Dialogue prefix: quoted text → instant DIALOGUE, 💬 UI

### Patch A (confirmed on main)
- Narrator: GOLDEN RULE, RESPONSE TIERS, END OF RESPONSE RULE, POI, CODEX
- StoryFeed: clickable POI highlights, InteractionPopover
- Fast-path: equip/unequip/drop/read — zero AI, startTransition

---

## Narrator Architecture

- **Tier 1** (2-3 sentences): PRESENT repeated actions, USE_ITEM, simple CUSTOM
- **Tier 2** (4-6 sentences): EXAMINE, ATTACK, INTERACT, DIALOGUE, first NPC
- **Tier 3** (80-120 words): ARRIVING at NEW location, major story moments
- GOLDEN RULE: honor player action, yes-and
- LOCATION RULE: state is authoritative, history is backstory not constraint
- ACTION RULE: plausible actions always attempted, narrator describes outcome
- Narrator never generates art

---

## Action Classification Policy

- **FAST PATH** (zero AI, instant): equip, unequip, drop, read lore
- **NARRATIVE PATH**: MOVE, ATTACK, INTERACT, EXAMINE, DIALOGUE, USE_ITEM(CONSUMABLE), search CONTAINER
- **DIALOGUE**: quoted text → instant DIALOGUE, no AI call
- **MOVE**: always MOVE_SUCCESS, sets ARRIVING, narrator describes arrival

---

## SVG Art Engine

- Route: /api/game/generate-art — fires async after MOVE, never blocks
- Scene types: TOP_DOWN_TOWN, SIDE_VIEW_INTERIOR, FRONT_PORTRAIT, ISOMETRIC_WIDE
- Cached in Supabase art_cache + Zustand artCache

---

## Planned Systems

| System | When | Description |
| --- | --- | --- |
| World Asset persistence | Day 13.5 | world_assets table, constitution injection |
| Lore Codex page | Day 13.5 | Full encyclopedia UI per campaign |
| Log Book + Save System | Day 13 | LogBook sidebar, dashboard, Save & Exit |
| NPC Dialogue system | Day 15 | Full conversation mode, Charisma gates |
| NPC Trading | Day 16 | Merchant NPCs, buy/sell UI |

---

## 1. Core Philosophy

- **Hybrid Authority Model:** Code is Source of Truth. AI is the Narrator.
- **World Assets are permanent.** Immutable game assets from first introduction.
- **Movement is absolute.** Players always arrive. Distance is flavor.
- **Location is authoritative state.** current_location_id is always correct.
- **Actions are permitted by default.** Narrator describes outcomes, never gatekeeps.
- **SVG Pixel Art + Text.** Async art engine, cached per location.
- **Endless Versatility.** Genre Wrappers. Launch genres: Fantasy, Cyberpunk, Horror/Lovecraftian, Space Opera, Post-Apocalyptic.

---

## 2. Technical Architecture

### A. The Master State

| Module | Responsibility |
| --- | --- |
| **Metadata** | Genre, tone, difficulty |
| **Player State** | HP, resources, attributes, inventory |
| **World State** | Flags, location_id, location_status, world assets |
| **Log Book** | Story beats and lore |
| **NPC Registry** | Per-NPC memory, trust scores |

### B. The Game Loop
1. **Intent Parser** → ParsedAction (AI, or instant for dialogue/fast-path)
2. **Logic Resolver** → ResolutionResult + location_status (no AI)
3. **narratorState** = updatedState merged with world_state delta (always fresh)
4. **Narrator** → story + POI + codex_entries (AI, sees correct location)
5. **Art Engine** → SVG async (AI, cached) — non-blocking

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

*Last updated: Session 24 — V3.3: Location state machine complete. 4 foundational rules. Day 13.5 starting.*
