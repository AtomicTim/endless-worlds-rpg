# Project: Endless Worlds RPG — Master Context

**Version:** 8.2
**Status:** Active Development — UX Fixes + Geographic Region Restructure Complete
**Objective:** To create a truly endless, fully-fledged AI-driven RPG engine — text and SVG based — with persistent worlds, real mechanics, and emergent storytelling. Genre-agnostic, infinitely replayable.

---

## 🔄 Current Status (Read This First)

**Current Phase:** Testing, then UI Design Session + Day 20 Combat
**Local Dev Port:** 3000
**Stack:** Next.js 14 / Tailwind / shadcn/ui / Supabase / Claude API / Stripe / Vercel
**GitHub Repo:** atomictim/endless-worlds-rpg

| Phase | Title | Status |
| --- | --- | --- |
| 1–14 | Phase 1 MVP | ✅ Complete |
| 15–18 | Dialogue, UI, World Graph, Systems Audit | ✅ Complete |
| 19A–19F | World Generation Architecture | ✅ Complete |
| Gameplay Audit | 21-issue audit + full stabilization | ✅ Complete |
| Navigation Redesign | UI-driven movement, mobile-first | ✅ Complete |
| Map Overhaul | Icon header, type abbr, decorations, info panel | ✅ Complete |
| UX Round 2 | Text readability, highlights, terse cap, geographic regions | ✅ Complete |
| UI Design Session | Claude Design — modern/retro visual overhaul | ⏳ Next |
| 20 | Combat System | ⏳ Pending |
| 21+ | Skills, Background, Factions | ⏳ Pending |

**Active genres:** Fantasy, Cyberpunk, Horror/Lovecraftian, Space Opera, Post-Apocalyptic
**⚠️ Noir has been removed. Do not reference it anywhere in the codebase.**

### UX Round 2 + Geographic Region Restructure (43/43 tests, clean build)

**Fix 1 — Text readability:** Narrative 14px / #b0bec5, dialogue #d0dce8, line-height 1.8, letter-spacing 0.01em.

**Fix 2 — Highlight colors:** LOCATION bright blue #60a5fa + underline. NPC genre primary + underline. ITEM amber #fbbf24 + underline. LANDMARK violet #a78bfa + underline. All hover-brighten.

**Fix 3 — Terse word cap:** Every sentence ≤12 words, no subordinate clauses, no atmospheric asides. Wrong/right examples in prompt.

**Fix 4 — Contextual loading text:** getLoadingText() helper. "Speaking with X...", "Examining Y...", "Entering [location]...", "Thinking..."

**Fix 5 — Nav bar scroll arrows:** ‹/› arrows on desktop only, hidden on mobile.

**Fix 6 — Merchant dialogue flow:** setTradeItems closes dialogue on open; restores lastDialogue* snapshot on close.

**Fix 7 — Codex on interaction only:** Removed auto-codex on ARRIVING. Location codex writes inside NPC seed branch in step 7g, gated by world_state.flags.codex_loc_<id>.

**Fix 8 — WCD landmark tooltips:** Tier 1 diamond hover shows name + public_description, Direction 3 styled.

**Fix 9 — Map tier navigation:** Tier 1 click → Tier 2 only. Auto-switch stays on current tier unless already at Tier 3.

**Fix 10-14 — Geographic region restructure:**
- RegionBible: +settlement_id, +settlement_name, +region_locations[]
- WorldBible prompt: geographic region name (landscape) + separate settlement_name + 1 standalone region_location (dungeon/wilderness)
- apply-world-bible: 3-tier graph — geographic zone → settlement zone → sub-locations. region_locations are siblings to the settlement in the geographic zone
- apply-regional-bible: same hierarchy
- Tier 2 filter: excludes sub_location nodes — shows town + dungeon side by side. findRootZoneId walks up zone chain

---

## 🏗️ Architecture — Complete ✅

### Four Layers ✅
**Layer 0 — WCD** — world_consistency jsonb, formatWcdBlock() first in all AI calls
**Layer 1 — WorldBible** — geographic region + settlement + sub-locations + standalone region_locations + main quest
**Layer 2 — RegionBible** — on-demand via navigateTo, 1500 tokens, 1 hub + 1 sub + 1 region_location + 2 NPCs
**Layer 3 — Narrator** — YOUR ROLE HARD RULES, TIER 1 OBJECTS verbatim, NPCS PRESENT, CONNECTED LOCATIONS

### Geographic Hierarchy ✅
```
World
└── Geographic Region (e.g. "The Salt Plains") — Tier 1 block
    ├── Settlement (e.g. "Salt-Iron Crossing") — Tier 2 node
    │   ├── Sub-location (INN, MKT, FRG etc.) — Tier 3 block
    │   └── Sub-location
    ├── Standalone location (e.g. "The Collapsed Vault") — Tier 2 node
    └── [Adjacent region exits]
```

- Region name = geographic area (landscape/territory name)
- Settlement name = town/hub within that area
- region_locations = dungeons, wilderness, shrines alongside the settlement
- Sub-locations = buildings inside the settlement

### Three-Tier Map ✅
```
Tier 1 — Geographic regions as blocks. WCD landmarks as ◆ with tooltips.
          Clicking a region → Tier 2 (never Tier 3 directly)
Tier 2 — Settlement + standalone locations within the region (side by side)
          Clicking a settlement node → Tier 3 for that settlement
Tier 3 — Sub-locations inside a settlement. 72px blocks, type abbr, decorations.
          Location info panel below (atmosphere + NPCs + Tier 1 objects)
Auto-switch: zone change → updates selectedRegionId, stays on current tier
unless already at Tier 3.
```

### Navigation Model ✅
```
Text input → DIALOGUE / EXAMINE / INTERACT / CUSTOM only
           → MOVE intercepted → INTERNAL_DESCRIBE

NavigationBar card → navigateTo(nodeId) → GRAPH_NAVIGATE
WorldMap click → navigateTo(nodeId) → GRAPH_NAVIGATE
Highlighted location click → navigateTo(nodeId) → GRAPH_NAVIGATE
Adjacent region card → navigateTo(regionId) → RegionBible expansion
```

### Three-Tier Object System ✅
Tier 1 (AI, tracked, highlighted) → Tier 2 (templates, instant) → Tier 3 (narrator ambient)

### NPC Rules ✅
Real name from birth. Pre-loaded on ARRIVING. Placeholder → real NPC via step 2b-2.
Codex entry only on first player interaction — not on room entry.

### Highlight Colors ✅
LOCATION: #60a5fa blue + underline → navigateTo(nodeId)
NPC: genre primary + underline → DIALOGUE
ITEM: #fbbf24 amber + underline → EXAMINE
LANDMARK: #a78bfa violet + underline → info tooltip

### Mobile-First ✅
52px nav cards with scroll arrows on desktop. 44px touch targets.
Bottom sheet map. 16px input font.

---

## ⚡ FOUNDATIONAL RULES (Read Before Every Session)

### 1. World Assets Are Permanent
Write-once. ignoreDuplicates: true. AI generates once, engine owns forever.

### 2. Navigation Is UI-Driven
MOVE from text → INTERNAL_DESCRIBE only.
navigateTo(nodeId): NavigationBar, WorldMap, highlight clicks.
WORLD_EXPLORE and RegionBible expansion via navigateTo only.

### 3. Location Is Authoritative State
current_node_id saved on real navigateTo moves. IDs canonical — no article stripping.

### 4. Actions Are Permitted By Default
Text: DIALOGUE / EXAMINE / INTERACT / CUSTOM. Tier 1→AI. Tier 2→template. Tier 3→ambient.

### 5. Objects Mentioned Exist
Nothing disappears. Failed checks = evasion, never absence.

### 6. Dialogue Is Consistent
RESPONDING CHARACTER only. Badge matches check.
intimidating→STR. curious→PER. deceptive→CHA+2. persuasive→CHA.
Dialogue closes when trade opens; restores when trade closes.

### 7. The AI Has Exactly Three Roles
Generator (Phase 1+2 only) → Bridge (describe only) → Thread (breadcrumbs)

### 8. WCD Is Absolute Law
Injected first. Nothing contradicts it.

### 9. Failed Checks = Evasion Only
NEVER means NPC left or object doesn't exist.

### 10. Highlights Are Exact Tier 1 Matches
Exact whole-word match. Colors distinct. Underlined. Hover-brightens.

---

## 🎭 NPC Dialogue System ✅
- RESPONDING CHARACTER only. Placeholder → real NPC via step 2b-2.
- Badge always matches check. Real names from birth.
- Codex only on first interaction (not on room entry).
- Dialogue restores after trade modal closes.

## 💰 Trading System ✅ | 🎨 Direction 3 UI ✅ | 🗺️ Three-Tier Map ✅

---

## Narrator Architecture ✅

DIALOGUE: WCD → HARD RULES → RESPONDING CHARACTER → TIER 1 OBJECTS → WORLD ASSETS → SCENE CONTEXT → VERBOSITY
non-DIALOGUE: WCD → HARD RULES → NPCS PRESENT → TIER 1 OBJECTS → CONNECTED LOCATIONS → WORLD ASSETS → SCENE CONTEXT → VERBOSITY

Verbosity: terse (2/3/4 sentences, ≤12 words each, no clauses) / standard (3-4/4-5/5-7) / rich (5-7/6-8/8-12). Block last.

---

## Planned Systems

| System | When | Description |
| --- | --- | --- |
| UI Design Session | Next | Claude Design — full visual overhaul |
| Combat System | Day 20 | Turn-based, structured UI |
| Object Types | Day 20 | landmark/container/item/mechanism/document |
| Skills & Abilities | Day 21 | Skill trees, attribute thresholds |
| Main Narrative Thread | Day 22 | Breadcrumb injection from WorldBible |
| Lore System | Later | Codex entry updates with new information |
| Item Interaction Depth | Later | Searching barrels/crates/desks for loot |
| NPC dots clickable in map info | Later | Quick interact from map panel |
| Art System | Phase 3 | Static pixel art + Replicate API |

---

## Supabase Tables (all applied ✅)
- game_sessions: +world_seed, +world_graph, +world_consistency, +world_bible
- world_states: +current_node_id. world-state route accepts worldGraph.
- Migrations 001-009.

---

## Core Philosophy
- AI generates content once, engine owns it forever
- Geographic region ≠ settlement name — region is landscape, settlement is town
- Navigation is UI-driven — text input for actions only
- WCD is the constitution — injected everywhere, never contradicted
- Settlement node = public hub — NEVER a building
- Location IDs canonical — never strip article prefixes
- Three object tiers: Tier 1 (AI) / Tier 2 (templates) / Tier 3 (ambient)
- Narrator describes with exact names, never generates
- Codex entries only on first player interaction
- Mobile-first: 44px touch targets, bottom sheet map, 52px nav cards

---

## Tech Stack

| Layer | Tool |
| --- | --- |
| Frontend | Next.js 14 (App Router) |
| Styling | Tailwind CSS + shadcn/ui |
| Database | Supabase |
| AI | Claude API (claude-sonnet-4-5) |
| Payments | Stripe |
| Deploy | Vercel |
| Audio | Howler.js |
| State | Zustand |

---

## Genre Definitions (Final — No Noir)

| Genre | Tone | Primary | Currency | HP |
| --- | --- | --- | --- | --- |
| Fantasy | Epic, mythic | #f59e0b amber | Gold | HP |
| Cyberpunk | Terse, neon | #22d3ee cyan | Credits | Integrity |
| Horror/Lovecraftian | Cosmic dread | #84cc16 acid green | None | HP + Sanity |
| Space Opera | Grand, operatic | #a855f7 purple | Stellar Units | Hull Integrity |
| Post-Apocalyptic | Bleak, dark humor | #ea580c rust | Caps | HP |

---

## Monetization

| Feature | Free | Adventurer ($6.99) | Legend ($14.99) |
| --- | --- | --- | --- |
| Genres | Fantasy | All 5 | All 5 + future |
| Save Slots | 1 | 3 | Unlimited |
| AI Actions/Day | 50 | Unlimited | Unlimited |
| Art | Placeholder | Static pixel art | Generated (Replicate) |
| Templates | Browse | Browse + Play | Create + Share |
| Export Log | ❌ | ✅ | ✅ |
| Priority Speed | ❌ | ❌ | ✅ |

---

## Platform: PWA Only. No Electron, no Steam. Manifest Day 35.

## Workflow
**Claude.ai owns all CLAUDE.md updates.**
Claude Code pushes → git pull + restart → report → confirm → next prompt.

## Reference Links
- Supabase: https://supabase.com/dashboard
- Anthropic: https://console.anthropic.com
- Vercel: https://vercel.com/dashboard
- Stripe: https://dashboard.stripe.com

---

*Last updated: Session 69 — V8.2: UX round 2 complete. Text readability, highlight colors, terse word cap, contextual loading, nav arrows, merchant dialogue flow, codex on interaction, landmark tooltips, map tier fix. Geographic region restructure: landscape name + town name + standalone region locations. Tier 2 shows town + dungeon side by side.*
