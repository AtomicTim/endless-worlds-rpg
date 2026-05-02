# Endless Worlds RPG

A genre-agnostic, AI-driven RPG engine that combines hard-coded game logic with dynamic LLM storytelling and ASCII/ANSI visuals.

## Tech Stack

| Layer | Tool |
|---|---|
| Frontend | Next.js 14 (App Router) |
| Styling | Tailwind CSS + shadcn/ui |
| Database | Supabase (Auth + Postgres + Realtime) |
| AI Engine | Claude API (`claude-sonnet-4-20250514`) |
| Payments | Stripe |
| Deployment | Vercel |
| Audio | Howler.js |
| Client State | Zustand |

## Folder Structure

```
/app
  /(auth)/login/         — Login page
  /(auth)/signup/        — Signup page
  /(marketing)/          — Public landing page (root route)
  /game/                 — Active game session
  /game/new/             — New game / character creation
  /dashboard/            — Player dashboard
  /admin/                — Admin panel
  globals.css            — Global styles + CSS variables
  layout.tsx             — Root layout (dark theme)

/components
  /game/                 — Game-specific UI components
  /ui/                   — shadcn/ui components
  /layout/               — Shared layout components

/lib
  supabase.ts            — Supabase browser + server clients
  stripe.ts              — Stripe client + plan definitions
  utils.ts               — cn() utility (clsx + tailwind-merge)
  /game/                 — Game logic helpers

/types
  game.ts                — MasterState, Player, NPC, AI loop types
  database.ts            — Supabase database types

/hooks                   — Custom React hooks
```

## Setup

1. **Clone and install**
   ```bash
   git clone <repo-url>
   cd endless-worlds-rpg
   npm install
   ```

2. **Configure environment variables**
   ```bash
   cp .env.local.template .env.local
   ```
   Fill in the values in `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL` — from Supabase project settings
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — from Supabase project settings
   - `SUPABASE_SERVICE_ROLE_KEY` — from Supabase project settings
   - `ANTHROPIC_API_KEY` — from console.anthropic.com
   - `STRIPE_SECRET_KEY` — from Stripe dashboard
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` — from Stripe dashboard
   - `STRIPE_WEBHOOK_SECRET` — from Stripe webhook settings

3. **Run development server**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000)

## Architecture

### The Hybrid Authority Model

- **Code** is the source of truth for stats, inventory, and world flags (MasterState in Supabase)
- **Claude AI** is the Narrator and Visualizer — it interprets player intent and generates story + ASCII art

### The Two-Pass AI Loop

1. **Intent Parser** — Translates player text into structured JSON action
2. **Logic Resolution** — Code validates stats and updates MasterState
3. **Narrator** — AI receives success/failure result and writes the story + ASCII art

### Genre System

Genres are swapped via CSS variables (`data-genre` attribute on root element):

| Genre | Primary Color | Accent |
|---|---|---|
| Fantasy | Amber | Green |
| Cyberpunk | Neon Blue | Magenta |
| Noir | Sepia | Grey |
| Space Opera | Purple | Silver |

## Development Roadmap

| Phase | Days | Goal |
|---|---|---|
| 0 — Foundation | 1–4 | Project scaffold, accounts, environment |
| 1 — MVP Core Loop | 5–14 | Playable AI-driven game with basic mechanics |
| 2 — Logic Engine | 15–24 | Full stat system, combat, inventory, NPC memory |
| 3 — World & Visuals | 25–34 | ASCII art, genre wrappers, sound |
| 4 — Monetization | 35–42 | Stripe, subscription tiers, token system |
| 5 — Polish & Launch | 43–45 | UX, security, analytics, beta, production |
