# Project: Endless Worlds RPG — Master Context

**Version:** 1.2
**Status:** Active Development
**Objective:** To create a genre-agnostic, AI-driven RPG engine that combines hard-coded game logic with dynamic LLM storytelling and ASCII visuals.

---

## 1. Core Philosophy

- **The Hybrid Authority Model:** The Code (Game Logic) is the "Source of Truth" for stats, inventory, and world flags. The AI is the "Narrator" and "Visualizer" that interprets intent and provides flavor.

- **Zero-Image Visuals:** All environmental and character representation is handled via advanced ASCII/ANSI art, optimized for mobile and web views.

- **Endless Versatility:** The engine must support multiple genres (Fantasy, Cyberpunk, Noir, Space Opera) by swapping a metadata "Genre Wrapper."

---

## 2. Technical Architecture

### A. The Master State (JSON)

The persistent state of the game, stored in Supabase and passed to the AI to maintain context.

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
- Genre-specific color palettes: Fantasy (amber/green), Cyberpunk (neon blue/magenta), Noir (sepia/grey), Space Opera (purple/silver).

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

The full day-by-day plan is in the companion document: **Endless_Worlds_RPG_Master_Dev_Plan.md**

---

## 6. Monetization Model

| Feature | Free | Adventurer ($6.99/mo) | Legend ($14.99/mo) |
| --- | --- | --- | --- |
| Genres | Fantasy only | All 4 genres | All 4 + future genres |
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

## 8. Development Workflow

### The Ideal Setup

This project uses a three-tool workflow where each tool has a distinct role:

| Tool | Role | When to Use |
| --- | --- | --- |
| **Claude Code** (CLI) | Builder — writes files, installs packages, runs commands, pushes to GitHub | All actual coding and execution |
| **Cursor** | Viewer/Reviewer — see the code, make small manual edits, review Claude Code's output | Reviewing, minor edits, reading the codebase |
| **Claude.ai (this project)** | Strategist — architecture decisions, planning, debugging logic, generating prompts | Planning sessions, complex problem-solving, updating this document |

### Day-to-Day Workflow

1. **Open this project in Claude.ai** to review what the current day's goal is (from the Dev Plan)
2. **Open Claude Code** in your terminal inside the project folder (`claude` command)
3. **Paste the day's session prompt** (from the Dev Plan) into Claude Code
4. Claude Code writes all files, runs installs, starts the dev server, and commits to GitHub
5. **Open Cursor** alongside the terminal to review the generated code
6. **Test the milestone** described in the Dev Plan before moving to the next day
7. Claude Code commits and pushes to GitHub at end of session

### Installing Claude Code

```bash
npm install -g @anthropic-ai/claude-code
```

Then navigate to your project folder and run:

```bash
claude
```

Claude Code will have full access to your files, terminal, and Git.

### Starting a Claude Code Session

Always begin each Claude Code session with this context block so it knows where it is in the project:

```
I'm building Endless Worlds RPG — an AI-driven genre-agnostic RPG engine.
Tech stack: Next.js 14, Tailwind, shadcn/ui, Supabase, Claude API, Stripe, Vercel.
Today is Day [X]: [Day Title from Dev Plan].
Here is what already exists: [brief summary of completed days].
[Paste the full day entry from the Dev Plan here]
```

### GitHub Workflow

- Commit at the end of every working day
- Branch naming: `day-01-foundation`, `day-05-master-state`, etc.
- Main branch always holds the last stable, tested state
- Never push directly to main mid-session

### When to Use Claude.ai vs Claude Code

**Use Claude.ai (this project) when:**
- Planning the next phase or revising the roadmap
- Debugging a complex logic or architecture problem
- Making decisions about monetization, UX, or strategy
- Updating this project context document
- Getting a "session prompt" written for Claude Code

**Use Claude Code when:**
- Writing any actual code
- Installing packages
- Running the dev server
- Committing and pushing to GitHub
- Fixing bugs identified during testing

### Keeping This Document Updated

After any major architectural decision or strategic change, return to this Claude.ai project and say:
> "Update the project context to reflect [decision/change]."

Claude will revise this document so it always reflects the current state of the project.

---

## 9. Reference Links

- Dev Plan: **Endless_Worlds_RPG_Master_Dev_Plan.md** (companion document)
- Supabase Dashboard: https://supabase.com/dashboard
- Anthropic Console: https://console.anthropic.com
- Vercel Dashboard: https://vercel.com/dashboard
- Stripe Dashboard: https://dashboard.stripe.com
- Claude Code Docs: https://docs.anthropic.com/en/docs/claude-code

---

*Last updated: Session 2 — Workflow established, V3 context created*