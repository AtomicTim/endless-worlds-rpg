# Project: Endless Worlds RPG — Master Context

**Version:** 1.7
**Status:** Active Development
**Objective:** To create a genre-agnostic, AI-driven RPG engine that combines hard-coded game logic with dynamic LLM storytelling and ASCII visuals.

---

## 🔄 Current Status (Read This First)

**Current Day:** Day 6 — Character Creation Flow
**Local Dev Port:** 3001
**Stack:** Next.js 14 / Tailwind / shadcn/ui / Supabase / Claude API / Stripe / Vercel
**GitHub Repo:** atomictim/endless-worlds-rpg

| Day | Title | Status |
| --- | --- | --- |
| 1 | Project Scaffold | ✅ Complete |
| 2 | Supabase Schema & Database | ✅ Complete |
| 3 | Authentication System | ✅ Complete |
| 4 | Core Layout & UI Shell | ✅ Complete |
| 5 | Master State JSON Architecture | ✅ Complete |
| 6 | Character Creation Flow | 🔄 In Progress |
| 7 | Intent Parser | ⏳ Pending |

**Active genres:** Fantasy, Cyberpunk, Horror/Lovecraftian, Space Opera, Post-Apocalyptic
**⚠️ Noir has been removed. Do not reference it anywhere in the codebase.**

### Day 5 Deliverables (confirmed on main)
- `types/game.ts` — full MasterState types, all 5 correct genres, no Noir
- `lib/game/state-factory.ts` — createNewMasterState() factory
- `lib/game/state-utils.ts` — all state utility functions
- `lib/game/genre-config.ts` — GenreConfig type + GENRE_CONFIGS for all 5 genres
- `lib/game/state-persistence.ts` — saveMasterState, loadMasterState, getActiveSessions
- `app/api/game/state/route.ts` — GET/POST API route with auth

### Branch Policy
Always work on main. Do not create feature branches. Commit and push directly to main at end of each day.

---

## 1. Core Philosophy

- **The Hybrid Authority Model:** The Code (Game Logic) is the "Source of Truth" for stats, inventory, and world flags. The AI is the "Narrator" and "Visualizer" that interprets intent and provides flavor.
- **Zero-Image Visuals:** All environmental and character representation is handled via advanced ASCII/ANSI art, optimized for mobile and web views.
- **Endless Versatility:** The engine must support multiple genres by swapping a metadata "Genre Wrapper." Launch genres: Fantasy, Cyberpunk, Horror/Lovecraftian, Space Opera, Post-Apocalyptic.

---

## 2. Technical Architecture

### A. The Master State (JSON)

| Module | Responsibility |
| --- | --- |
| **Metadata** | Stores genre, tone, and difficulty levels. |
| **Player State** | Hard numbers for Health, Resources, Attributes, and Inventory. |
| **World State** | Boolean flags (e.g., has_key_01: true) and current location IDs. |
| **Log Book** | A chronological array of major story beats and discovered lore. |
| **NPC Registry** | Per-NPC memory snippets, trust scores, and relationship history. |

### B. The Two-Pass AI Loop

- **The Intent Parser:** Translates player text into a structured JSON action.
- **Logic Resolution:** The code checks stats and updates the Master State.
- **The Narrator:** The AI receives the "Success/Failure" result and writes the story and ASCII art.

---

## 3. Tech Stack

| Layer | Tool | Why |
| --- | --- | --- |
| Frontend | Next.js 14 (App Router) | SSR, API routes, great DX |
| Styling | Tailwind CSS + shadcn/ui | Fast, consistent, dark-mode ready |
| Database | Supabase | Auth + Postgres + Realtime in one |
| AI Engine | Claude API (claude-sonnet-4-20250514) | Best narrative quality, JSON reliability |
| Payments | Stripe | Industry standard, great docs |
| Deployment | Vercel | Native Next.js, zero-config |
| Audio | Howler.js | Lightweight, cross-browser ambient audio |
| State (client) | Zustand | Simple, no boilerplate |

---

## 4. ASCII Visual Strategy

- Use **Block Elements** (█, ▓, ▒, ░) for depth and shading.
- Implement **CSS-based ANSI coloring** to make the "text-only" world vibrant.
- **The Visual Seed:** Store a unique seed for generated ASCII art per location to ensure consistent visuals on return visits.
- Genre-specific color palettes: Fantasy (amber/green), Cyberpunk (neon blue/magenta), Horror/Lovecraftian (sickly green/deep purple), Space Opera (purple/silver), Post-Apocalyptic (rust orange/ash grey).

---

## 5. Implementation Roadmap (Summary)

| Phase | Days | Goal |
| --- | --- | --- |
| **0 — Foundation** | 1–4 | Project scaffold, accounts, environment |
| **1 — MVP Core Loop** | 5–14 | Playable AI-driven game with basic mechanics |
| **2 — Logic Engine** | 15–24 | Full stat system, combat, inventory, NPC memory |
| **3 — World & Visuals** | 25–34 | ASCII art, genre wrappers, sound |
| **4 — Monetization** | 35–42 | Stripe, subscription tiers, token system |
| **5 — Polish & Launch** | 43–45 | UX, security, analytics, beta, production |

---

## 6. Monetization Model

| Feature | Free | Adventurer ($6.99/mo) | Legend ($14.99/mo) |
| --- | --- | --- | --- |
| Genres | Fantasy only | All 5 genres | All 5 + future genres |
| Save Slots | 1 | 3 | Unlimited |
| AI Actions/Day | 50 | Unlimited | Unlimited |
| ASCII Art | Basic | Enhanced | Enhanced + Custom |
| Community Templates | Browse only | Browse + Play | Create + Share |
| Export Log Book | ❌ | ✅ | ✅ |
| Priority AI Speed | ❌ | ❌ | ✅ |

---

## 7. Strategic Features

- **Stat-Based Dialogue:** Use hard-coded attributes (Charisma, Intelligence) to gate or unlock AI-generated dialogue options.
- **NPC Memory:** Individual context snippets per NPC tracking trust metrics and past interactions.
- **Ambient Soundscapes:** Audio engine triggered by a "Sound ID" output from the AI Narrator.
- **The Wildcard Mechanic:** Random world events injected every 5 player actions to make the world feel alive.
- **Community Templates:** Users share Master Context world files for others to play.

---

## 8. Genre Definitions (Launch Roster — Final)

**⚠️ Noir has been removed. The 5 launch genres are:**

| Genre | Tone | Color Palette | Currency | HP Label | Key Influences |
| --- | --- | --- | --- | --- | --- |
| **Fantasy** | Epic, mythic, high adventure | Amber / Forest green | Gold | HP | D&D, Elder Scrolls |
| **Cyberpunk** | Terse, gritty, neon-soaked | Neon cyan / Magenta | Credits | Integrity | Neuromancer, Blade Runner |
| **Horror/Lovecraftian** | Dread, cosmic horror, sanity-eroding | Sickly green / Deep purple | None (survival focused) | Sanity + HP | Lovecraft, Darkest Dungeon |
| **Space Opera** | Pulpy, grand-scale, operatic | Purple / Silver | Stellar Units | Hull Integrity | Mass Effect, Dune |
| **Post-Apocalyptic** | Bleak, dark-humored, survival | Rust orange / Ash grey | Caps | HP | Fallout, The Road |

### Genre-Specific Mechanics Notes

**Horror/Lovecraftian:**
- Dual-resource system: HP (physical) + Sanity (mental)
- Sanity depletes on encounters with cosmic entities, forbidden knowledge, and certain locations
- At 0 Sanity: character becomes erratic, dialogue options change, game over condition
- Narrator tone: slow dread, unreliable perception, cosmic indifference

**Post-Apocalyptic:**
- Fallout-inspired: dark humor, moral ambiguity, faction politics
- Resource scarcity: ammo/food/water tracked alongside HP
- Narrator tone: dry, world-weary, occasionally darkly funny

**Future genres to add post-launch:** Western, Pirate/Age of Sail, Superhero, Dark Fantasy, Steampunk

---

## 9. Platform & Distribution Decision

**Endless Worlds RPG is a PWA (Progressive Web App). This is a final decision.**

- Zero friction distribution — players click a URL and play instantly
- Core loop requires server calls anyway (Claude API) — no meaningful offline mode
- PWA install prompt gives native app feel on both mobile and desktop
- Multiplayer (post-launch) uses Supabase Realtime over websockets
- No Electron, no Steam, no Tauri — web-only
- PWA manifest and service worker added on Day 35

---

## 10. Development Workflow

### The Three-Tool Setup

| Tool | Role | When to Use |
| --- | --- | --- |
| **Claude Code** (CLI) | Builder — writes files, runs commands, pushes to GitHub | All actual coding and execution |
| **Cursor** | Viewer/Reviewer — review code, make small manual edits | Reviewing, minor edits, reading the codebase |
| **Claude.ai (this project)** | Strategist — architecture, planning, generating prompts, updating CLAUDE.md | Planning sessions, decisions, context updates |

### Day-to-Day Workflow

1. Claude Code completes the day's work and pushes to GitHub
2. Come to **Claude.ai** and say "Day X is done"
3. Claude.ai reads CLAUDE.md from GitHub, updates the progress log, gives the test checklist
4. You test and confirm — Claude.ai updates CLAUDE.md and gives the next day's prompt
5. Paste prompt into Claude Code and repeat

### Important: Claude.ai owns all CLAUDE.md updates
Claude Code should NOT update CLAUDE.md. All updates to this file are made by Claude.ai after each day is confirmed complete.

### Branch Policy
Always work directly on main. Do not create feature branches. Commit and push to main at the end of each session.

---

## 11. Reference Links

- Supabase Dashboard: https://supabase.com/dashboard
- Anthropic Console: https://console.anthropic.com
- Vercel Dashboard: https://vercel.com/dashboard
- Stripe Dashboard: https://dashboard.stripe.com
- Claude Code Docs: https://docs.anthropic.com/en/docs/claude-code

---

*Last updated: Session 8 — Day 5 verified complete on main, branch policy added, Day 6 starting*
