# Project: Endless Worlds RPG — Master Context

**Version:** 3.0
**Status:** Active Development — MVP Core Loop Complete
**Objective:** To create a genre-agnostic, AI-driven RPG engine that combines hard-coded game logic with dynamic LLM storytelling and ASCII visuals.

---

## 🔄 Current Status (Read This First)

**Current Day:** Patch B — CONTAINER Items + SVG Art Engine
**Local Dev Port:** 3000
**Stack:** Next.js 14 / Tailwind / shadcn/ui / Supabase / Claude API / Stripe / Vercel
**GitHub Repo:** atomictim/endless-worlds-rpg

| Day | Title | Status |
| --- | --- | --- |
| 1–12 | Foundation through Inventory | ✅ Complete |
| Patch A | Narrator redesign, POI system | ✅ Complete |
| Patch B | CONTAINER items, SVG art engine | 🔄 In Progress |
| Day 13.5 | World Asset System + Lore Codex | ⏳ Pending |
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
**Locations:** name, physical description, atmosphere, size, faction affiliation, key landmarks, available services
**Characters:** name, appearance, personality, role, faction, speech patterns, relationship to player at first meeting
**Factions:** name, ideology, appearance/uniform, relationship to other factions, territory
**Creatures:** name, appearance, behavior, habitat, threat level

### What CAN change (story-driven only):
- NPC relationship/trust with the player (changes through interaction)
- Location state if explicitly destroyed, rebuilt, or captured in the story
- Faction standing based on player actions
- Character knowledge (they learn things over time)

### How this is enforced in code:
- On first introduction, the Narrator outputs a `codex_entries` array with the asset's full constitution
- This gets saved to the `world_assets` table in Supabase (Day 13.5)
- On every subsequent Narrator call, relevant world assets for the current location are injected into the prompt as immutable facts
- The Narrator system prompt explicitly states: "World assets listed below are established facts. Never contradict, reinterpret, or change them unless a story event explicitly does so."

### Dialogue prefix system (coming in dialogue patch):
- Player text in "quotes" = dialogue/speech directed at nearby characters
- Plain text = actions and commands
- Intent Parser routes quoted text directly to DIALOGUE action type

---

## Key Deliverables Log

### Patch A (confirmed on main — next build passing)
- `types/game.ts`: PointOfInterest, CodexEntry interfaces; NarratorResponse with response_tier, points_of_interest, codex_entries
- `prompt-builder.ts`: Narrator redesigned — ROLE, GOLDEN RULE, RESPONSE TIERS, END OF RESPONSE RULE, POI, CODEX, IP guard
- `StoryFeed.tsx`: clickable highlighted POI text with type-specific colors
- `InteractionPopover.tsx`: desktop floating card / mobile bottom sheet with contextual action buttons
- `useGameLoop.ts`: POI in message metadata, codex stub, startTransition fast-path
- `lib/game/codex.ts`: stub for Day 13.5

### Pre-Patch A fixes
- Fast-path system (equip/unequip/drop/read bypass all AI — truly instant)
- Narrative continuity: lastNarrativeText + 5 log entries in every Narrator call
- Original content only policy
- Spinner double-gated: never shows for fast-path actions

---

## Narrator Architecture (post Patch A)

- **Tier 1** (2-3 sentences): repeated actions, USE_ITEM, simple CUSTOM
- **Tier 2** (4-6 sentences): EXAMINE, ATTACK, INTERACT, DIALOGUE, first NPC
- **Tier 3** (80-120 words): NEW location, major story moments
- GOLDEN RULE: honor player action, yes-and, hard logic blocks only
- END OF RESPONSE: weave 2-3 interactables into final sentences naturally
- Narrator never generates art — handled by separate art engine (Patch B)

---

## Action Classification Policy

- **FAST PATH** (zero AI, instant): equip, unequip, drop, read lore
- **NARRATIVE PATH**: MOVE, ATTACK, INTERACT, EXAMINE, DIALOGUE, USE_ITEM(CONSUMABLE)
- **DIALOGUE DETECTION** (coming): quoted text → DIALOGUE action type automatically

---

## Points of Interest System

- Types: LOCATION | NPC | CONTAINER | ITEM | HAZARD
- Highlighted in StoryFeed with type-specific colors
- Clicking → InteractionPopover with contextual action buttons
- Desktop: floating card; Mobile: bottom sheet

---

## Planned Systems (upcoming)

| System | When | Description |
| --- | --- | --- |
| World Asset persistence | Day 13.5 | Supabase world_assets table, asset constitution injection into narrator |
| Lore Codex page | Day 13.5 | Full encyclopedia UI per campaign |
| Dialogue prefix | After Patch B | Quoted text = speech, plain text = action |
| NPC Dialogue system | Day 15 (pulled forward) | Full conversation mode, Charisma gates, relationship consequences |
| NPC Trading | Day 16 | Merchant NPCs, buy/sell UI, genre currency |
| CONTAINER items | Patch B | Searchable objects with loot generation |
| SVG Art Engine | Patch B | Async per-location art, cached in Supabase |

---

## 1. Core Philosophy

- **The Hybrid Authority Model:** The Code is the "Source of Truth." The AI is the "Narrator."
- **World Assets are permanent.** Every significant entity introduced becomes an immutable game asset.
- **Zero-Image Visuals:** SVG pixel art (Patch B) + text, optimized for mobile and web.
- **Endless Versatility:** Genre Wrappers. Launch genres: Fantasy, Cyberpunk, Horror/Lovecraftian, Space Opera, Post-Apocalyptic.

---

## 2. Technical Architecture

### A. The Master State (JSON)

| Module | Responsibility |
| --- | --- |
| **Metadata** | Genre, tone, difficulty |
| **Player State** | HP, resources, attributes, inventory |
| **World State** | Flags, location IDs, world_assets |
| **Log Book** | Story beats and discovered lore |
| **NPC Registry** | Per-NPC memory, trust scores |

### B. The Game Loop
1. **Intent Parser** → ParsedAction JSON (AI)
2. **Logic Resolver** → ResolutionResult (no AI)
3. **Narrator** → story + POI + codex_entries (AI)
4. **Art Engine** → SVG scene async (AI, cached) [Patch B]

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

## 4. Visual Strategy

- **SVG Pixel Art**: async, cached per location in Supabase
- View by scene type: NPC/enemy = front portrait, town = top-down, interior = side-view, wilderness = isometric
- Genre color palettes applied to SVG output

---

## 5. Implementation Roadmap

| Phase | Days | Goal |
| --- | --- | --- |
| **0 — Foundation** | 1–4 | Scaffold |
| **1 — MVP Core Loop** | 5–14 | Playable game |
| **2 — Logic Engine** | 15–24 | Combat, NPCs, dialogue, trading |
| **3 — World & Visuals** | 25–34 | Art refinement, genre wrappers, sound |
| **4 — Monetization** | 35–42 | Stripe, tiers |
| **5 — Polish & Launch** | 43–45 | Security, analytics, deploy |

---

## 6. Monetization Model

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

## 7. Genre Definitions (Final — No Noir)

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

## 8. Platform: PWA Only
Final. No Electron, no Steam. PWA manifest Day 35.

---

## 9. Development Workflow

**Claude.ai owns all CLAUDE.md updates. Claude Code must not modify CLAUDE.md.**

| Tool | Role |
| --- | --- |
| Claude Code | Coding, commits, push |
| Cursor | Review, minor edits |
| Claude.ai | Strategy, prompts, CLAUDE.md |

Workflow: Claude Code pushes → `git pull` + restart own server → report to Claude.ai → checklist → confirm → next prompt.

---

## 10. Reference Links
- Supabase: https://supabase.com/dashboard
- Anthropic Console: https://console.anthropic.com
- Vercel: https://vercel.com/dashboard
- Stripe: https://dashboard.stripe.com

---

*Last updated: Session 21 — V3.0: World Asset rule added as foundational principle. Dialogue prefix system noted. NPC dialogue pulled to Day 15. Patch B starting.*
