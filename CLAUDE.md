# Project: Endless Worlds RPG — Master Context

**Version:** 8.8
**Status:** Active Development — Map Fix + UI Polish Round 2 Complete
**Objective:** A text-based RPG that generates a unique world for every playthrough. Genre-agnostic, infinitely replayable, CRPG depth.

**Reference:** /docs/architecture-spec.md — The definitive source for all Domain 1 vs Domain 2 decisions.

---

## 🔄 Current Status (Read This First)

**Current Phase:** Test UI, then Combat System
**Local Dev Port:** 3000
**Stack:** Next.js 14 / Tailwind / shadcn/ui / Supabase / Claude API / Stripe / Vercel
**GitHub Repo:** atomictim/endless-worlds-rpg

| Phase | Title | Status |
| --- | --- | --- |
| 1–18 | MVP through Systems Audit | ✅ Complete |
| 19A–19F | World Generation Architecture | ✅ Complete |
| Gameplay + Navigation Audit | 21 issues + stabilization | ✅ Complete |
| UX Rounds 1-3 | Readability, dialogue, stat rules | ✅ Complete |
| Nav + NPC + Difficulty fixes | Back-links, codex, stakes | ✅ Complete |
| Trade + Dialogue + Arrival | No-check trade, NPC switch | ✅ Complete |
| Architecture Hardening | MOVE text removed, haiku model | ✅ Complete |
| Full UI Redesign | Design tokens, 15 SVG map renderers, layout | ✅ Complete |
| Map Fix + UI Polish Round 2 | Auto-position, building glyphs, color diff | ✅ Complete |
| 20 | Combat System | ⏳ Next |
| Container + Loot | Registry, loot tables, search flow | ⏳ Pending |
| 21+ | Skills, Background, Factions | ⏳ Pending |

**Active genres:** Fantasy, Cyberpunk, Horror/Lovecraftian, Space Opera, Post-Apocalyptic
**⚠️ Noir has been removed.**

### Map Fix + UI Polish Round 2 (commit 41cb80f — 86/86 tests, clean build)

**Fix 1 — Map auto-position (all genres):**
autoPositionNodes() projects nodes with valid map_position normally. Nodes missing map_position (or all at identical position) are arranged in a flattened circle around the centroid of positioned nodes. Replaces filter(hasMapPos) + boundsFor + project pattern in all three tier builders. Benefits all 5 genres × 3 tiers.

**Fix 2 — FantasyMap building-type glyphs:**
DrawBuilding component substring-matches node.category against ambient_type keywords from ambient-objects.ts. Distinct paper-style silhouettes for: inn/tavern, forge/smithy, market/stall, temple/shrine, guild/hall/garrison, well/fountain, stable, dungeon/ruin/vault. Falls back to generic two-house glyph. Replaces single TownGlyph-for-everything in LocalMap. LocalExits component adds ← name / name → italic-serif labels at viewBox edges. Other four genres unchanged (Cyber=squares, Space=rooms, Apoc=sheds, Horror=daggers — all intentionally uniform per design reference).

**Fix 3 — Highlight color differentiation:**
--hl-item: #f59e0b → #e8c547 (golden yellow, distinct from amber accent). .ew-link-npc solid underline, .ew-link-item dashed underline. NPC vs item now visually distinct at a glance.

**Fix 4 — Header compact:**
Removed LVL X · X/X HP sub-line from avatar pill. Initials and name remain.

**Fix 5 — Arrival card compact:**
SceneArt.tsx: compact horizontal strip (10px 16px padding, 20px name, no inner border, border-bottom only). Removed "— CURRENT LOCATION —" label.

**Fix 6 — Story feed width:**
Removed maxWidth: 640 from NarrativeBlock and NPCSpeech. Narrative font 15→16px. Container padding: px-4 py-4 md:px-8 md:py-6. Inner wrapper maxWidth removed.

**Fix 7 — Codex 2nd-visit fallback:**
Step 7c-1: ARRIVING increments codex_visits_{id} flag. On 2nd visit (≥2) with no codex_loc_{id}: writes location codex entry from physical_description/notes/atmosphere. NPC-interaction path still primary.

---

## 🏗️ Architecture — See /docs/architecture-spec.md

### The Two Domains
**Domain 1 (Engine — pure code):** World graph, player state, combat, quests, map, navigation, dialogue, stat checks, container registry, loot resolution.
**Domain 2 (Content Library — frozen after generation):** WCD, locations, NPCs, items, loot tables, main quest, region outlines.
**AI during gameplay:** Narration only. Arrivals (cached), NPC dialogue, action narration (1-4 sentences), container search (1 sentence). Never touches state.

### Geographic Hierarchy ✅
```
World
└── Geographic Region (Tier 1 block)
    ├── Settlement (Tier 2 node, is_settlement_node=true)
    │   ├── Sub-location (Tier 3 block, zone_id = settlement id)
    │   └── Sub-location
    ├── Standalone location (Tier 2 node, zone_id = region id)
    │   └── Back-connection to settlement GUARANTEED at apply time
    └── [Adjacent region exits — WCD landmarks via ◆ cards]
```

### Map System ✅
```
Tier 1 — World: geographic regions, WCD landmark ◆ diamonds
Tier 2 — Region: settlement + standalones side by side, cross-region exits
Tier 3 — Local: sub-locations, current node pulsing amber
autoPositionNodes(): projects graph nodes into 0–320 SVG viewBox;
  missing map_position nodes auto-arranged in circle around centroid
Building glyphs (Fantasy only, by ambient_type):
  inn/tavern → inn silhouette | smithy/forge → forge+chimney
  market_stall → awning | temple_shrine → arch
  guild_hall/garrison → crenelated keep | well/fountain → well
  stable → stable | dungeon/ruin/barrow → ruin fragment
  Other genres: Cyber=squares, Space=rooms, Apoc=sheds, Horror=daggers
```

### UI Design System ✅
```
Fonts: Cormorant Garamond (serif) / Inter Tight (sans) / JetBrains Mono (mono)
Surfaces: bg-0 #0a0907 → bg-3 #211c16
Genre accent: --accent via [data-genre] attribute
Highlights:
  hl-loc #7dd3fc (blue, solid underline)   → LOCATION
  accent (solid underline)                  → NPC
  hl-item #e8c547 (golden, dashed underline) → ITEM
  hl-landmark #c4b5fd (violet, dashed)      → LANDMARK
  hl-pass #a3e635 / hl-fail #f87171        → stat checks
Design files: /design/ folder
```

### Navigation Model ✅
Text MOVE → hardcoded message. navigateTo(nodeId) only real navigation.
NavigationBar: desktop = hidden | mobile = NavCard row.
Return card: graph-search sibling settlement by zone_id.

### Generation Model ✅
Zone 1 (current): Fully concrete. Zone 2 (1-2 hops): Outlined.
Zone 3 (3+): Name + position only. RegionBible: haiku model, 1200 tokens.

---

## ⚡ FOUNDATIONAL RULES

1. World Assets Are Permanent. Write-once.
2. Navigation Is UI-Only. Text MOVE → hardcoded. navigateTo() only.
3. Location Is Authoritative State. current_node_id on navigateTo.
4. Actions Permitted By Default. Tier 1→AI. Tier 2→template. Tier 3→ambient.
5. Objects Mentioned Exist. Failed checks = evasion, never absence.
6. Dialogue Consistent. Closed context. Failed check = no info. Trade = no check.
7. AI Three Roles Only. Generator → Bridge (exact names) → Thread.
8. WCD Is Absolute Law.
9. Failed Checks = Evasion Only. Never reveals secrets.
10. Highlights Are Exact Tier 1 Matches. Colors + underline style per type.

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
| Lore System | Later | Codex entry updates |
| NPC dots clickable | Later | Map info panel quick interact |
| Art System | Phase 3 | Static pixel art + Replicate API |

---

## Tech Stack

| Layer | Tool |
| --- | --- |
| Frontend | Next.js 14 (App Router) |
| Styling | Tailwind CSS + shadcn/ui + custom design tokens |
| Database | Supabase (migrations 001-009) |
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

*Last updated: Session 75 — V8.8: Map auto-position (all genres), Fantasy building-type glyphs by ambient_type, NPC/item color differentiation, compact header + arrival card, story feed width, codex 2nd-visit fallback.*
