# Project: Endless Worlds RPG — Master Context

**Version:** 2.8
**Status:** Active Development — MVP Core Loop Complete
**Objective:** To create a genre-agnostic, AI-driven RPG engine that combines hard-coded game logic with dynamic LLM storytelling and ASCII visuals.

---

## 🔄 Current Status (Read This First)

**Current Day:** Day 13 — Log Book & Save System
**Local Dev Port:** 3000
**Stack:** Next.js 14 / Tailwind / shadcn/ui / Supabase / Claude API / Stripe / Vercel
**GitHub Repo:** atomictim/endless-worlds-rpg

| Day | Title | Status |
| --- | --- | --- |
| 1 | Project Scaffold | ✅ Complete |
| 2 | Supabase Schema & Database | ✅ Complete |
| 3 | Authentication System | ✅ Complete |
| 4 | Core Layout & UI Shell | ✅ Complete |
| 5 | Master State JSON Architecture | ✅ Complete |
| 6 | Character Creation Flow | ✅ Complete |
| 7 | Intent Parser | ✅ Complete |
| 8 | Logic Resolution Engine | ✅ Complete |
| 9 | The Narrator | ✅ Complete |
| 10 | Full Game Loop | ✅ Complete — GAME IS PLAYABLE |
| 11 | Character Sheet UI (Live) | ✅ Complete |
| 12 | Inventory System | ✅ Complete |
| 13 | Log Book & Save System | 🔄 In Progress |
| 14 | MVP Playtest & Bug Fix | ⏳ Pending |

**Active genres:** Fantasy, Cyberpunk, Horror/Lovecraftian, Space Opera, Post-Apocalyptic
**⚠️ Noir has been removed. Do not reference it anywhere in the codebase.**

### Key Deliverables Per Day (confirmed on main)
- **Day 5:** types/game.ts, state-factory, state-utils, genre-config, state-persistence, app/api/game/state/route.ts
- **Day 6:** app/game/new/page.tsx (4-step wizard), app/game/page.tsx (session redirect)
- **Day 7:** app/api/game/parse-intent/route.ts, lib/game/intent-parser.ts, lib/game/prompt-builder.ts
- **Day 8:** lib/game/logic-resolver.ts, lib/game/dice.ts — 51/51 tests passing
- **Day 9:** app/api/game/narrate/route.ts (streaming), lib/game/narrator.ts, narrator prompts
- **Day 10:** lib/stores/game-store.ts, hooks/useGameLoop.ts — full loop wired and playable
- **Day 11:** Live CharacterSheet, roll feedback in feed, ASCII art prompt tightened
- **Day 12:** Full inventory system — equip/unequip, drag-drop, per-type buttons, item acquisition pipeline
- **Pre-Day 13 fixes:**
  - Fast-path system (action-classifier.ts) — equip/unequip/drop/read bypass Narrator entirely
  - getDirectAction() bypasses Intent Parser for instant actions
  - Narrative context continuity: lastNarrativeText in game store, passed to every Narrator call via prompt-builder. 5 log entries (up from 3). WORLD CONTINUITY + PREVIOUS NARRATIVE blocks in system/user prompts
  - Spinner double-gated: isProcessing && !!processingStep — fast-path never triggers loading UI
  - Original content only policy in all narrator prompts

### Narrative Continuity Architecture
The AI holds NO state between calls. Continuity is maintained by:
- `log_book.entries` (last 5 passed to every Narrator call) — stored in Supabase
- `world_state.flags` — every meaningful world change — stored in Supabase
- `world_state.current_location_id` + `visited_locations` — stored in Supabase
- `npc_registry` — NPC memory snippets — stored in Supabase
- `lastNarrativeText` — most recent narrative text — stored in Zustand game store
- Day 28 adds session summary compression for long-running games

### Action Classification Policy
- **FAST PATH** (zero AI calls, instant, no loading indicator): equip, unequip, drop, read lore
- **NARRATIVE PATH** (full AI): MOVE, ATTACK, INTERACT, EXAMINE, DIALOGUE, USE_ITEM(CONSUMABLE)

### Original Content Policy
Narrator prompt prohibits: Star Wars, Star Trek, Marvel, DC, LotR, Harry Potter, Dune, Mass Effect, and all recognizable IP.

### ASCII Art Policy
Words allowed as in-world content (signs, labels). NOT allowed as substitutes for block-character visuals.

### ⚠️ Dev Environment Notes
- Claude Code shells export ANTHROPIC_API_KEY="" — always start dev server from your own terminal
- After Claude Code pushes, run `git pull` + restart YOUR dev server
- Windows PowerShell: use `Invoke-WebRequest` not `curl -X`
- `npx tsc --noEmit` blank = pass

### Branch Policy
Always work on main. No feature branches. Push directly to main.

---

## 1. Core Philosophy

- **The Hybrid Authority Model:** The Code is the "Source of Truth." The AI is the "Narrator."
- **Zero-Image Visuals:** ASCII/ANSI art only.
- **Endless Versatility:** Genre Wrappers. Launch genres: Fantasy, Cyberpunk, Horror/Lovecraftian, Space Opera, Post-Apocalyptic.

---

## 2. Technical Architecture

### A. The Master State (JSON)

| Module | Responsibility |
| --- | --- |
| **Metadata** | Genre, tone, difficulty |
| **Player State** | HP, resources, attributes, inventory |
| **World State** | Flags and location IDs |
| **Log Book** | Story beats and discovered lore |
| **NPC Registry** | Per-NPC memory, trust scores |

### B. The Two-Pass AI Loop
1. **Intent Parser** → structured ParsedAction JSON
2. **Logic Resolver** → deterministic ResolutionResult (no AI)
3. **Narrator** → story text + ASCII art + items_acquired

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

## 4. ASCII Visual Strategy

- Block Elements (█▓▒░) for depth, CSS ANSI coloring
- Visual Seed per location — Day 25 caches in Supabase
- Palettes: Fantasy (amber/green), Cyberpunk (cyan/magenta), Horror (sickly green/purple), Space Opera (purple/silver), Post-Apocalyptic (rust/ash)

---

## 5. Implementation Roadmap

| Phase | Days | Goal |
| --- | --- | --- |
| **0 — Foundation** | 1–4 | Scaffold |
| **1 — MVP Core Loop** | 5–14 | Playable game |
| **2 — Logic Engine** | 15–24 | Combat, skills, NPCs |
| **3 — World & Visuals** | 25–34 | ASCII art, genre wrappers, sound |
| **4 — Monetization** | 35–42 | Stripe, tiers |
| **5 — Polish & Launch** | 43–45 | Security, analytics, deploy |

---

## 6. Monetization Model

| Feature | Free | Adventurer ($6.99/mo) | Legend ($14.99/mo) |
| --- | --- | --- | --- |
| Genres | Fantasy only | All 5 | All 5 + future |
| Save Slots | 1 | 3 | Unlimited |
| AI Actions/Day | 50 | Unlimited | Unlimited |
| ASCII Art | Basic | Enhanced | Enhanced + Custom |
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

*Last updated: Session 19 — Narrative continuity fix complete (lastNarrativeText, 5 log entries, WORLD CONTINUITY prompt). Spinner double-gated. Day 13 prompt ready.*
