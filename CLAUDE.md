# Project: Endless Worlds RPG — Master Context

**Version:** 8.24
**Status:** Active Development — Adjacent Region Travel Stabilized, Architecture Hardening Next
**Objective:** A text-based RPG that generates a unique world for every playthrough. Genre-agnostic, infinitely replayable, CRPG depth.

**Reference:** /docs/architecture-spec.md — The definitive source for all Domain 1 vs Domain 2 decisions.

---

## 🔄 Current Status (Read This First)

**Current Phase:** Test adjacent region travel → architecture hardening → genre renderers
**Local Dev Port:** 3000
**Stack:** Next.js 14 / Tailwind / shadcn/ui / Supabase / Claude API / Stripe / Vercel
**GitHub Repo:** atomictim/endless-worlds-rpg

| Phase | Title | Status |
| --- | --- | --- |
| 1–18 | MVP through Systems Audit | ✅ Complete |
| 19A–19F | World Generation Architecture | ✅ Complete |
| Gameplay + Navigation Audit | 21 issues + stabilization | ✅ Complete |
| UX Rounds 1-3 + Nav/NPC/Difficulty | Readability, dialogue, stat rules | ✅ Complete |
| Trade + Dialogue + Architecture | No-check trade, haiku model | ✅ Complete |
| Full UI Redesign | Design tokens, 15 SVG map renderers | ✅ Complete |
| Map Overhaul + Debug Mode | fitToViewBox, tiers, coordinate ranges | ✅ Complete |
| Regional Zone Traversal + Polish | Exit button, region zone, navigation | ✅ Complete |
| Session 84 Bug Fixes | 7 map/nav fixes + Bug 2 diagnostics | ✅ Complete |
| RegionBible 500 + Header Fixes | max_tokens, page header, node type | ✅ Complete |
| Nav Bar Refactor + Map Visual-Only | Typed cards, map stripped of navigation | ✅ Complete |
| Nav UX Polish Round 1 | Panel labels, visited badges, routing, breadcrumb | ✅ Complete |
| Nav UX Polish Round 2 | 10 fixes: colors, cards, NPC buttons, narration | ✅ Complete |
| Dialogue Modal Inline | In-flow in story feed, minimize, no fixed overlay | ✅ Complete |
| Adjacent Region Travel | End-to-end flow fixed, Bug 2 zone_id fixed | ✅ Complete |
| RegionBible Stabilization | max_tokens 3500, failure recovery | ✅ Complete |
| Architecture Hardening | Domain 1/2 separation, caching, gate | ⏳ Next |
| Genre renderers restored | After architecture confirmed | ⏳ Pending |
| 20 | Combat System | ⏳ Pending |

**Active genres:** Fantasy, Cyberpunk, Horror/Lovecraftian, Space Opera, Post-Apocalyptic
**⚠️ Noir has been removed.**

### RegionBible Stabilization (commit 076763a — 43/43 tests, clean build)

**Fix 1 — max_tokens 2000→3500:** JSON was clipping at ~1740 tokens. 3500 leaves comfortable headroom for all region sizes.

**Fix 2 — Failure recovery:** Captured `previousNodeId = fromId` before expansion. `expansionFailed` flag covers all failure paths (generate/apply non-2xx, throw, missing fields). On failure: restores `current_location_id` / `current_node_id` / `world_graph.current_node_id` via `setMasterState`, posts "The road to {region} is impassable. You turn back.", clears `generatingRegionId`, sets processing false, returns early. Narrator never runs on empty placeholder.

### Adjacent Region Travel Flow ✅
```
1. Player at region zone → ◇ card appears for undiscovered adjacent region
2. Click ◇ → "Venturing into unknown territory..." + all cards disabled
3. generate-regional-bible (haiku, max_tokens:3500) → builds RegionBible JSON
4. apply-regional-bible → extends world graph, correct zone_ids via expected_region_id
5. Player lands at new settlement hub → arrival narration fires
6. Region/Local map update via setMasterState

ON FAILURE: player restored to previousNodeId + "impassable road" message.
```

### Navigation Rules ✅ (Complete)
```
Map = PURELY VISUAL. All navigation via nav bar cards only.

Card grammar (left to right):
  [← BACK]  [→ DEEPER...]  [↑ EXIT]  [◆ PEER...]  [◇ UNDISCOVERED...]

Routing rules:
  Sub-location   → ← back to hub ONLY
  Settlement hub → → deeper + ↑ exit to region zone
  Region zone    → ← back + ◆ known + ◇ undiscovered adjacent
  Dungeon        → ← back to region zone ONLY

◇ card → generates new region (3500 token budget) → lands at new settlement.
Generation failure → restore to previous node, no stuck state.
```

### Known issues (shelved — address after architecture hardening)
- Duplicate codex writes: two paths (7b + 7c-1) fire for same location
- NPC highlight color (orange) too similar to item highlight (yellow) in Fantasy
- React key-prop-spread warnings in LocationSpan/ItemSpan/NpcSpan
- After successful region generation: Region map may show "undiscovered" until nav card used (map tier state not auto-switching)

---

## 🏗️ Architecture

### The Two Domains (Must Never Touch)
**Domain 1 (Engine — pure code):** World graph, player state, combat, quests, map, navigation, dialogue option generation, stat checks, container registry, loot resolution.

**Domain 2 (Content Library — frozen after generation):** WCD, locations, NPCs, items, loot tables, main quest, region outlines.

### AI During Gameplay (Narration Only)
1. Location arrival description — first visit only, cached permanently after (PENDING — Architecture item A)
2. NPC dialogue responses — closed context, code determines topic + check result
3. Action narration — 1-4 sentences
4. Container search narration — 1 sentence only when item found

### Pending Architecture Items (implement next)

**A — Location arrival descriptions cached permanently**
Currently AI is called on every session load for arrival narration. Fix: write result to `world_assets` on first visit, serve cached on all subsequent visits. No AI call on re-visit. This also fixes the duplicate codex write bug (Bug 9) since the asset check gates everything.

**B — Free text validation gate** ✅ DONE
NPC not at location → hardcoded "[Name] isn't here."

**C — Dialogue options generated by code from NPC knowledge array**
Option B confirmed: WorldBible generates `{topic, content}` pairs. Code builds option list from NPC asset. AI writes response text only.

### Map System ✅ (Visual Only)
```
PAD=76. Tier switcher works. Current node highlighted.
World tier: CURRENT LOCATION eyebrow hidden, full info panel otherwise.
DEBUG MODE ACTIVE in index.tsx. TO RESTORE: uncomment pickModule.
```

### Generation Model ✅
RegionBible: claude-haiku-4-5-20251001, max_tokens: 3500.
WorldBible: claude-sonnet-4-5, 8000 tokens.

---

## ⚡ FOUNDATIONAL RULES

1. World Assets Are Permanent. Write-once.
2. Navigation Is Nav Bar Only. Map is visual only.
3. Location Is Authoritative State. current_node_id on navigateTo.
4. Actions Permitted By Default.
5. Objects Mentioned Exist. Failed checks = evasion.
6. Dialogue Consistent. Failed check = no info. Trade = no check.
7. AI Three Roles Only. Generator → Bridge → Thread.
8. WCD Is Absolute Law.
9. Failed Checks = Evasion Only.
10. Highlights Are Exact Tier 1 Matches.

---

## Narrator Prompt Order ✅

DIALOGUE: WCD → HARD RULES → RESPONDING CHARACTER → TIER 1 OBJECTS → WORLD ASSETS → SCENE → VERBOSITY
non-DIALOGUE: WCD → HARD RULES → NPCS PRESENT → TIER 1 OBJECTS → CONNECTED LOCATIONS → WORLD ASSETS → SCENE → VERBOSITY

Region zone special case: inject settlement hub (labeled "settlement") + region_locations with compass direction.

Verbosity: terse | standard | rich

---

## Story Feed Colors ✅
```
Narrator prose:      var(--ink-1)
NPC quoted speech:   #e8d5b0 warm cream, italic
Player actions:      #7ab8c8 teal-blue, 12px mono italic
Item highlights:     #e8c547 yellow (hl-item)
Location highlights: #7dd3fc sky blue (hl-loc)
NPC highlights:      var(--accent) orange — too similar to item yellow in Fantasy (future fix)
```

---

## Planned Systems

| System | When | Description |
| --- | --- | --- |
| Architecture Hardening | NOW | Arrival caching (item A), code-gen dialogue options (item C) |
| Genre renderers restored | After arch | Uncomment pickModule |
| Codex dedup fix | Covered by item A | Two-path duplicate write cleanup |
| Combat System | Day 20 | Turn-based, code resolves, AI narrates |
| Container + Loot | Day 21 | Registry, loot tables, dungeon sub-levels |
| Skills + Leveling | Day 22 | XP, stat points, level gates |
| Main Quest Thread | Day 23 | Breadcrumb injection, quest tracking |
| Random Events | After combat | Region zone + travel encounters |

---

## Tech Stack

| Layer | Tool |
| --- | --- |
| Frontend | Next.js 14 (App Router) |
| Styling | Tailwind + shadcn/ui + design tokens |
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

## Workflow
**Claude.ai owns all CLAUDE.md updates.**
Claude Code pushes → git pull + restart → report → confirm → next prompt.
**All architecture decisions defer to /docs/architecture-spec.md.**

---

*Last updated: Session 89 — V8.24: RegionBible max_tokens 3500, failure recovery (restore previous node). Adjacent region travel flow complete. Architecture hardening (items A + C) next.*
