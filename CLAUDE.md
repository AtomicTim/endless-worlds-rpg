# Project: Endless Worlds RPG — Master Context

**Version:** 8.7
**Status:** Active Development — Full UI Redesign Complete
**Objective:** A text-based RPG that generates a unique world for every playthrough. Genre-agnostic, infinitely replayable, CRPG depth.

**Reference:** /docs/architecture-spec.md — The definitive source for all Domain 1 vs Domain 2 decisions.

---

## 🔄 Current Status (Read This First)

**Current Phase:** Test the new UI → then Combat System
**Local Dev Port:** 3000
**Stack:** Next.js 14 / Tailwind / shadcn/ui / Supabase / Claude API / Stripe / Vercel
**GitHub Repo:** atomictim/endless-worlds-rpg

| Phase | Title | Status |
| --- | --- | --- |
| 1–18 | MVP, Dialogue, UI, Graph, Audit | ✅ Complete |
| 19A–19F | World Generation Architecture | ✅ Complete |
| Gameplay Audit | 21-issue audit + stabilization | ✅ Complete |
| Navigation Redesign | UI-driven movement, mobile-first | ✅ Complete |
| Map + UX Rounds 1-3 | Overhaul, readability, inline dialogue | ✅ Complete |
| Navigation + NPC fixes | Back-links, NPC codex, stakes difficulty | ✅ Complete |
| Trade + Dialogue + Arrival | No-check trade, NPC switch, arrival header | ✅ Complete |
| Architecture Hardening | MOVE text removed, zone_id, haiku model | ✅ Complete |
| Full UI Redesign | Design tokens, SVG maps, 3-col layout | ✅ Complete |
| 20 | Combat System | ⏳ Next |
| Container + Loot | Registry, loot tables, search flow | ⏳ Pending |
| 21+ | Skills, Background, Factions | ⏳ Pending |

**Active genres:** Fantasy, Cyberpunk, Horror/Lovecraftian, Space Opera, Post-Apocalyptic
**⚠️ Noir has been removed.**

### Full UI Redesign (commit 2fccd5e — 86/86 tests, clean build)

**Step 1 — Design tokens:**
All tokens from /design/styles.css ported to app/globals.css. Genre primaries, surfaces (bg-0..bg-3), inks (ink-1..ink-5), highlights (hl-loc/item/landmark/pass/fail), font stacks (Cormorant Garamond / Inter Tight / JetBrains Mono), utility classes (ew-vellum, ew-grain, ew-stipple, ew-fog, ew-pulse, ew-link-*, ew-said, ew-divider, ew-scroll). Legacy aliases preserved.

**Step 2 — data-genre mechanism:**
genreSlug() maps Genre enum → fantasy/cyber/horror/space/apoc. GameLayout writes slug to data-genre on root div. All [data-genre] CSS selectors apply globally.

**Step 3 — Inline text components (StoryComponents.tsx):**
wrapQuotes, Said, NarrativeBlock, SceneDivider, NPCSpeech, StatPill, LocationSpan, NpcSpan, ItemSpan, LandmarkSpan.

**Step 4 — StoryFeed rebuilt:**
parseStatCheck() drives StatPill rendering. Scene dividers for arrivals. Design-correct typography (serif prose, mono chrome).

**Step 5 — Map renderers (/components/game/map/renderers/):**
primitives.tsx: paper/ink/star/salvage/black-ink backings + glyphs with prefixed gradient IDs. One renderer per genre × 3 tiers. GenreMap dispatcher. project() helper maps WorldNode.map_position into 0–320 SVG viewBox. All 15 genre×tier combinations implemented.

**Step 6 — WorldMap.tsx rewritten:**
MapSidebar shell (◆ MAP header, WORLD/REGION/LOCAL tier switcher with SVG icons, square map area, location info panel with NPCs and landmarks). buildRendererPayload() projects graph data. buildLocationInfo() resolves WCD/WorldAsset constitutions into panel.

**Step 7 — GameLayout.tsx redesigned:**
Wordmark with globe SVG, genre badge, MAP/CODEX/Save/avatar pill header chrome. Three-column desktop (map sidebar 320px / story feed flex-1 / character panel 280px). Single-column mobile. Bottom-sheet map on mobile.

**Step 8 — NavigationBar.tsx:**
md:hidden on desktop (map sidebar handles navigation). Mobile: NavCard design (28px SVG icon, name + type, VISITED/HERE chips). Return-card, landmark-card, outline-fallback preserved.

**Step 9 — DialogueModal.tsx redrawn:**
56px avatar, ◆ IN CONVERSATION header, italic serif NPC name, mood/role/location chips in mono. Options as serif italic rows with stat badges and tone-coloured left border. Dashed inline free-text input. Mono "walk away" link. Merchant trade button preserved.

**Step 10 — Verified:** tsc clean, 86/86 tests, next build clean.

---

## 🏗️ Architecture — See /docs/architecture-spec.md

### The Two Domains
**Domain 1 (Engine — pure code):** World graph, player state, combat, quests, map, navigation, dialogue option generation, stat checks, container registry, loot resolution.

**Domain 2 (Content Library — frozen after generation):** WCD, locations, NPCs, items, loot tables, main quest, region outlines.

**The AI during gameplay:** Narration only. Location arrivals (cached after first visit), NPC dialogue responses, action narration (1-4 sentences), container search narration (1 sentence). Never touches state.

### Geographic Hierarchy ✅
```
World
└── Geographic Region (Tier 1 block)
    ├── Settlement (Tier 2 node, is_settlement_node=true)
    │   ├── Sub-location (Tier 3 block, zone_id = settlement id)
    │   └── Sub-location
    ├── Standalone location (Tier 2 node, zone_id = region id)
    │   └── Back-connection to settlement GUARANTEED at apply time
    └── [Adjacent region exits — WCD landmarks navigable via ◆ cards]
```

### Navigation Model ✅
```
Text MOVE → hardcoded "Use the navigation bar" — ZERO AI CALL
navigateTo(nodeId): NavigationBar cards, WorldMap clicks, highlight clicks
NavigationBar: desktop = md:hidden | mobile = NavCard row with icons
Return card: graph-search for sibling settlement by zone_id
RegionBible expansion: navigateTo(adjacentRegionId) only
```

### Map System ✅
```
Tier 1 — World: geographic regions as styled SVG blocks by genre
Tier 2 — Region: settlement + standalone locations side by side
Tier 3 — Local: sub-locations, current node pulsing
All 5 genres × 3 tiers = 15 distinct SVG renderers
project() maps WorldNode.map_position → 0–320 viewBox coords
```

### UI Design System ✅
```
Fonts: Cormorant Garamond (serif prose) / Inter Tight (sans chrome) / JetBrains Mono (labels)
Surfaces: bg-0 #0a0907 → bg-3 #211c16 (warm near-black)
Genre accent: --accent via [data-genre] CSS attribute
Highlights: hl-loc #7dd3fc / hl-item #f59e0b / hl-landmark #c4b5fd / hl-pass #a3e635 / hl-fail #f87171
Design files: /design/ folder in repo
```

### Generation Model ✅
```
Zone 1 (current region): Fully concrete. All assets frozen.
Zone 2 (1-2 hops): Named + outlined. Pre-generates when player is 1 hop away.
Zone 3 (3+ hops, WCD landmarks): Name + position only. Visible on map.
```

### Model Selection ✅
- WCD + WorldBible: claude-sonnet-4-5
- RegionBible: claude-haiku-4-5-20251001
- Live narration: claude-sonnet-4-5

---

## ⚡ FOUNDATIONAL RULES

### 1. World Assets Are Permanent. Write-once.
### 2. Navigation Is UI-Only. Text MOVE → hardcoded. navigateTo() is the only navigation.
### 3. Location Is Authoritative State. current_node_id saved on navigateTo.
### 4. Actions Are Permitted By Default. Tier 1→AI. Tier 2→template. Tier 3→ambient.
### 5. Objects Mentioned Exist. Failed checks = evasion, never absence.
### 6. Dialogue Is Consistent. Closed context. Failed check = no info. Trade = no check.
### 7. AI Has Exactly Three Roles. Generator → Bridge (exact names) → Thread (breadcrumbs).
### 8. WCD Is Absolute Law.
### 9. Failed Checks = Evasion Only. Never reveals locations, people, secrets.
### 10. Highlights Are Exact Tier 1 Matches. LOCATION→navigateTo. NPC→DIALOGUE. ITEM→EXAMINE. LANDMARK→info.

---

## Narrator Prompt Order ✅

DIALOGUE: WCD → HARD RULES → RESPONDING CHARACTER → TIER 1 OBJECTS → WORLD ASSETS → SCENE CONTEXT → VERBOSITY
non-DIALOGUE: WCD → HARD RULES → NPCS PRESENT → TIER 1 OBJECTS → CONNECTED LOCATIONS → WORLD ASSETS → SCENE CONTEXT → VERBOSITY

Verbosity (STRICTLY ENFORCED):
- terse: 2/3/4 sentences, ≤12 words each
- standard: 3-4/4-5/5-7
- rich: 5-7/6-8/8-12

---

## Planned Systems

| System | When | Description |
| --- | --- | --- |
| Combat System | Day 20 | Turn-based, code resolves, AI narrates |
| Container + Loot | Day 21 | Registry, loot tables, search flow |
| Skills + Leveling | Day 22 | XP, stat points, level gates |
| Main Quest Thread | Day 23 | Breadcrumb injection, quest tracking UI |
| Dynamic Pricing | Discuss | Haggling check → price_override flag |
| Lore System | Later | Codex entry updates with new info |
| NPC dots clickable | Later | Map info panel quick interact |
| Art System | Phase 3 | Static pixel art + Replicate API |

---

## Supabase Tables (all applied ✅)
Migrations 001-009. game_sessions: +world_graph, +world_consistency, +world_bible.
world_states: +current_node_id. world-state route accepts worldGraph.

---

## Tech Stack

| Layer | Tool |
| --- | --- |
| Frontend | Next.js 14 (App Router) |
| Styling | Tailwind CSS + shadcn/ui + custom design tokens |
| Database | Supabase |
| AI (world gen + narration) | claude-sonnet-4-5 |
| AI (RegionBible) | claude-haiku-4-5-20251001 |
| Payments | Stripe |
| Deploy | Vercel |
| Audio | Howler.js |
| State | Zustand |

---

## Genre Definitions

| Genre | data-genre | Primary | Currency | HP |
| --- | --- | --- | --- | --- |
| Fantasy | fantasy | #f59e0b amber | Gold | HP |
| Cyberpunk | cyber | #22d3ee cyan | Credits | Integrity |
| Horror/Lovecraftian | horror | #84cc16 acid green | None | HP + Sanity |
| Space Opera | space | #a855f7 purple | Stellar Units | Hull Integrity |
| Post-Apocalyptic | apoc | #ea580c rust | Caps | HP |

---

## Monetization

| Feature | Free | Adventurer ($6.99) | Legend ($14.99) |
| --- | --- | --- | --- |
| Genres | Fantasy | All 5 | All 5 + future |
| Save Slots | 1 | 3 | Unlimited |
| AI Actions/Day | 50 | Unlimited | Unlimited |
| Priority Speed | ❌ | ❌ | ✅ |

---

## Platform: PWA Only. Manifest Day 35.

## Workflow
**Claude.ai owns all CLAUDE.md updates.**
Claude Code pushes → git pull + restart → report → confirm → next prompt.
**All architecture decisions defer to /docs/architecture-spec.md.**

---

*Last updated: Session 74 — V8.7: Full UI redesign. Design tokens, data-genre mechanism, StoryComponents, StoryFeed rebuilt, 15 SVG map renderers (5 genres × 3 tiers), MapSidebar rewrite, 3-column GameLayout, mobile NavBar, DialogueModal redesign.*
