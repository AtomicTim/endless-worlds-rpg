# Project: Endless Worlds RPG — Master Context

**Version:** 3.1
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
| Day 13.5 | World Asset System + Lore Codex | 🔄 In Progress |
| 13 | Log Book & Save System | ⏳ Pending |
| 14 | MVP Playtest & Bug Fix | ⏳ Pending |

**Active genres:** Fantasy, Cyberpunk, Horror/Lovecraftian, Space Opera, Post-Apocalyptic
**⚠️ Noir has been removed. Do not reference it anywhere in the codebase.**

---

## ⚡ FOUNDATIONAL RULE — WORLD ASSETS (Read Before Every Session)

**Every significant thing the Narrator introduces is a World Asset.**

When the game introduces a new location, character, faction, creature, or item of note, that entity becomes a permanent game asset with immutable core characteristics. Think of it exactly like a video game asset — once a town is created with specific attributes, those attributes are locked into that world forever unless something in the story explicitly changes them.

**This is the most important rule in the entire codebase.**

### What makes a World Asset:
- Any named location (town, building, region, planet, district)
- Any named character or NPC
- Any named faction or organization
- Any unique or legendary item
- Any named creature or enemy type
- Any significant lore element (historical event, legend, document)

### What gets locked on first introduction:
- **Locations:** name, physical description, atmosphere, size, faction affiliation, key landmarks, available services
- **Characters:** name, appearance, personality, role, faction, speech patterns, relationship to player at first meeting
- **Factions:** name, ideology, appearance/uniform, relationship to other factions, territory
- **Creatures:** name, appearance, behavior, habitat, threat level

### What CAN change (story-driven only):
- NPC relationship/trust with player
- Location state if explicitly destroyed/rebuilt/captured in story
- Faction standing based on player actions
- Character knowledge over time

### How this is enforced in code:
- Narrator outputs `codex_entries` with asset constitution on first introduction
- Saved to `world_assets` Supabase table (Day 13.5)
- Injected back into Narrator prompt as immutable facts on subsequent calls
- Narrator system prompt: "World assets listed below are established facts. Never contradict them."

---

## Key Deliverables Log

### Patch B (confirmed on main — next build passing)
- `types/game.ts`: CONTAINER added to ItemType, Item.searched, Item.contains
- `logic-resolver.ts`: CONTAINER branch — marks searched=true, passes container_search context
- `prompt-builder.ts`: CONTAINER SEARCH instruction injected when container_search=true
- `InventoryPanel.tsx`: CONTAINER shows "Search"/"Drop", "Empty" badge when searched
- `app/api/game/generate-art/route.ts`: SVG art generation, cache lookup by location_id+session_id
- `supabase/migrations/002_art_cache.sql`: art_cache table with composite UNIQUE(location_id, session_id) — **APPLIED to Supabase**
- `lib/game/art-generator.ts`: scene_type detection, per-genre SVG prompts, SVG sanitizer
- `components/game/SceneArt.tsx`: async art display, fade-in, Zustand art cache
- `game-store.ts`: artCache Record<string,string>, setArtCache()
- `app/game/page.tsx`: fires async art generation after MOVE actions
- `lib/game/intent-parser.ts`: detectDialogue() — quoted input → DIALOGUE, no AI call
- `parse-intent/route.ts`: dialogueMode bypass returns DIALOGUE action instantly
- `InputBar.tsx`: accent border + 💬 icon + "Speak" button when in quote mode

### Patch A (confirmed on main)
- Narrator redesigned: ROLE, GOLDEN RULE, RESPONSE TIERS, END OF RESPONSE RULE, POI, CODEX, IP guard
- StoryFeed: clickable POI highlights, InteractionPopover (desktop card / mobile sheet)
- Fast-path: equip/unequip/drop/read — zero AI calls, startTransition, no spinner

### Pre-Patch fixes
- Narrative continuity: lastNarrativeText + 5 log entries in every Narrator call
- Original content only policy in all narrator prompts

---

## Narrator Architecture

- **Tier 1** (2-3 sentences): repeated actions, USE_ITEM, simple CUSTOM
- **Tier 2** (4-6 sentences): EXAMINE, ATTACK, INTERACT, DIALOGUE, first NPC
- **Tier 3** (80-120 words): NEW location, major story moments
- GOLDEN RULE: honor player action, yes-and, hard logic blocks only
- END OF RESPONSE: weave 2-3 interactables into final sentences
- Narrator never generates art — separate art engine handles this

---

## Action Classification Policy

- **FAST PATH** (zero AI, instant): equip, unequip, drop, read lore
- **NARRATIVE PATH**: MOVE, ATTACK, INTERACT, EXAMINE, DIALOGUE, USE_ITEM(CONSUMABLE), search CONTAINER
- **DIALOGUE DETECTION**: quoted text ("...") → instant DIALOGUE, no intent parser AI call

---

## Points of Interest System

- Types: LOCATION | NPC | CONTAINER | ITEM | HAZARD
- Highlighted in StoryFeed with type-specific colors
- Clicking → InteractionPopover with contextual action buttons
- Desktop: floating card; Mobile: bottom sheet

---

## SVG Art Engine

- Route: /api/game/generate-art
- Async — fires after MOVE, never blocks narrative
- Scene types: TOP_DOWN_TOWN, SIDE_VIEW_INTERIOR, FRONT_PORTRAIT, ISOMETRIC_WIDE
- Cached in Supabase art_cache (UNIQUE per location_id+session_id)
- In-memory cache in Zustand artCache
- SVG sanitizer strips script/text/image/event handlers
- Art fades in over 0.5s when ready

---

## Planned Systems (upcoming)

| System | When | Description |
| --- | --- | --- |
| World Asset persistence | Day 13.5 | world_assets Supabase table, constitution injection into narrator |
| Lore Codex page | Day 13.5 | Full encyclopedia UI per campaign |
| Log Book + Save System | Day 13 | LogBook sidebar, dashboard, Save & Exit |
| NPC Dialogue system | Day 15 | Full conversation mode, Charisma gates |
| NPC Trading | Day 16 | Merchant NPCs, buy/sell UI |

---

## 1. Core Philosophy

- **The Hybrid Authority Model:** The Code is the "Source of Truth." The AI is the "Narrator."
- **World Assets are permanent.** Every significant entity introduced is an immutable game asset.
- **SVG Pixel Art + Text:** Async art engine, cached per location.
- **Endless Versatility:** Genre Wrappers. Launch genres: Fantasy, Cyberpunk, Horror/Lovecraftian, Space Opera, Post-Apocalyptic.

---

## 2. Technical Architecture

### A. The Master State (JSON)

| Module | Responsibility |
| --- | --- |
| **Metadata** | Genre, tone, difficulty |
| **Player State** | HP, resources, attributes, inventory |
| **World State** | Flags, location IDs, world assets |
| **Log Book** | Story beats and lore |
| **NPC Registry** | Per-NPC memory, trust scores |

### B. The Game Loop
1. **Intent Parser** → ParsedAction (AI, or instant for dialogue/fast-path)
2. **Logic Resolver** → ResolutionResult (no AI)
3. **Narrator** → story + POI + codex_entries (AI)
4. **Art Engine** → SVG async (AI, cached) — non-blocking

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

## 5. Monetization Model

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

*Last updated: Session 22 — Patch B complete. art_cache migration applied to Supabase. Day 13.5 starting.*
