# Project: Endless Worlds RPG — Master Context

**Version:** 2.2
**Status:** Active Development
**Objective:** To create a genre-agnostic, AI-driven RPG engine that combines hard-coded game logic with dynamic LLM storytelling and ASCII visuals.

---

## 🔄 Current Status (Read This First)

**Current Day:** Day 10 — Full Game Loop
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
| 10 | Full Game Loop | 🔄 In Progress |
| 11 | Character Sheet UI (Live) | ⏳ Pending |
| 12 | Inventory System | ⏳ Pending |
| 13 | Log Book & Save System | ⏳ Pending |
| 14 | MVP Playtest & Bug Fix | ⏳ Pending |

**Active genres:** Fantasy, Cyberpunk, Horror/Lovecraftian, Space Opera, Post-Apocalyptic
**⚠️ Noir has been removed. Do not reference it anywhere in the codebase.**

### Key Deliverables Per Day (confirmed on main)
- **Day 5:** types/game.ts, state-factory, state-utils, genre-config, state-persistence, app/api/game/state/route.ts
- **Day 6:** app/game/new/page.tsx (4-step wizard), app/game/page.tsx (session redirect)
- **Day 7:** app/api/game/parse-intent/route.ts, lib/game/intent-parser.ts, lib/game/prompt-builder.ts
- **Day 8:** lib/game/logic-resolver.ts, lib/game/dice.ts — 51/51 tests passing
- **Day 9:** app/api/game/narrate/route.ts (streaming), lib/game/narrator.ts, prompt-builder updated with narrator prompts and sound IDs. Both API routes return 401 unauthenticated. tsc clean.

### Important Local Dev Notes
- After Claude Code pushes to GitHub, always run `git pull` locally then restart the dev server
- @anthropic-ai/sdk is required — run `npm install @anthropic-ai/sdk` if not present
- Windows PowerShell: use `Invoke-WebRequest` instead of `curl -X`
- `npx tsc --noEmit` with blank output = pass (no errors)

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

**Post-Apocalyptic:**
- Resource scarcity: ammo/food/water tracked alongside HP
- Fallout-inspired: dark humor, moral ambiguity, faction politics

**Future genres to add post-launch:** Western, Pirate/Age of Sail, Superhero, Dark Fantasy, Steampunk

---

## 9. Platform & Distribution Decision

**Endless Worlds RPG is a PWA (Progressive Web App). This is a final decision.**

- Zero friction distribution — players click a URL and play instantly
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
2. Run `git pull` locally then restart the dev server
3. Come to **Claude.ai** and say "Day X is done"
4. Claude.ai reads repo, updates CLAUDE.md, gives test checklist
5. You test and confirm — Claude.ai gives the next day's prompt
6. Paste prompt into Claude Code and repeat

### Important: Claude.ai owns all CLAUDE.md updates
Claude Code should NOT update CLAUDE.md.

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

*Last updated: Session 13 — Day 9 complete (streaming narrator, 401 verified, tsc clean), Day 10 starting*
