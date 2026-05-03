# Project: Endless Worlds RPG — Master Context

**Version:** 2.4
**Status:** Active Development — MVP Core Loop Complete
**Objective:** To create a genre-agnostic, AI-driven RPG engine that combines hard-coded game logic with dynamic LLM storytelling and ASCII visuals.

---

## 🔄 Current Status (Read This First)

**Current Day:** Day 12 — Inventory System
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
| 12 | Inventory System | 🔄 In Progress |
| 13 | Log Book & Save System | ⏳ Pending |
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
- **Day 11:** Live CharacterSheet (real stats, animated health bar, genre-adaptive resources, attribute modifiers), live InventoryPanel (items from background, click tooltip, use button), roll feedback line in StoryFeed, ASCII art prompt tightened (no lazy word substitutes — scene-content words like signs/labels OK)

### ASCII Art Policy (established Day 11)
Words ARE allowed in ASCII art when they represent in-world content (signs, building labels, character position markers). Words are NOT allowed as substitutes for visual elements that should be drawn with block characters. The prompt in prompt-builder.ts reflects this.

### ⚠️ Important Dev Environment Notes
- Claude Code shells export ANTHROPIC_API_KEY="" to child processes — always start dev server from your own terminal, not from Claude Code
- After Claude Code pushes, run `git pull` locally then restart YOUR dev server
- Windows PowerShell: use `Invoke-WebRequest` instead of `curl -X`
- `npx tsc --noEmit` blank output = pass

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
- **The Visual Seed:** Store a unique seed per location — Day 25 will cache generated art in Supabase so revisited locations always show the same art.
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

- **Stat-Based Dialogue:** Charisma/Intelligence gate AI-generated dialogue options.
- **NPC Memory:** Per-NPC context snippets tracking trust and past interactions.
- **Ambient Soundscapes:** Audio engine triggered by sound_id from Narrator.
- **The Wildcard Mechanic:** Random world events every 5 player actions.
- **Community Templates:** Users share Master Context world files.

---

## 8. Genre Definitions (Launch Roster — Final)

**⚠️ Noir has been removed. The 5 launch genres are:**

| Genre | Tone | Color Palette | Currency | HP Label | Key Influences |
| --- | --- | --- | --- | --- | --- |
| **Fantasy** | Epic, mythic, high adventure | Amber / Forest green | Gold | HP | D&D, Elder Scrolls |
| **Cyberpunk** | Terse, gritty, neon-soaked | Neon cyan / Magenta | Credits | Integrity | Neuromancer, Blade Runner |
| **Horror/Lovecraftian** | Dread, cosmic horror, sanity-eroding | Sickly green / Deep purple | None | Sanity + HP | Lovecraft, Darkest Dungeon |
| **Space Opera** | Pulpy, grand-scale, operatic | Purple / Silver | Stellar Units | Hull Integrity | Mass Effect, Dune |
| **Post-Apocalyptic** | Bleak, dark-humored, survival | Rust orange / Ash grey | Caps | HP | Fallout, The Road |

### Genre-Specific Mechanics Notes

**Horror/Lovecraftian:** Dual HP+Sanity system. 0 Sanity = game over condition.
**Post-Apocalyptic:** Ammo/food/water tracked alongside HP and Caps.
**Future genres:** Western, Pirate/Age of Sail, Superhero, Dark Fantasy, Steampunk

---

## 9. Platform Decision

**PWA only. Final decision.** No Electron, no Steam, no Tauri. PWA manifest on Day 35.

---

## 10. Development Workflow

| Tool | Role |
| --- | --- |
| **Claude Code** | All coding, file writing, git commits |
| **Cursor** | Code review, minor manual edits |
| **Claude.ai** | Strategy, prompts, CLAUDE.md updates |

**Claude.ai owns all CLAUDE.md updates. Claude Code must not modify CLAUDE.md.**

Workflow: Claude Code pushes → git pull locally → restart own dev server → report to Claude.ai → get test checklist → confirm → get next prompt.

---

## 11. Reference Links

- Supabase: https://supabase.com/dashboard
- Anthropic Console: https://console.anthropic.com
- Vercel: https://vercel.com/dashboard
- Stripe: https://dashboard.stripe.com

---

*Last updated: Session 15 — Day 11 complete. ASCII art policy clarified. Day 12 starting.*
