# Project: Endless Worlds RPG — Master Context

**Version:** 8.3
**Status:** Active Development — UX Polish Round 3 Complete
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
| UX Round 3 | Map crash, inline dialogue, player text, stat rule, trade button | ✅ Complete |
| UI Design Session | Claude Design — modern/retro visual overhaul | ⏳ Next |
| 20 | Combat System | ⏳ Pending |
| 21+ | Skills, Background, Factions | ⏳ Pending |

**Active genres:** Fantasy, Cyberpunk, Horror/Lovecraftian, Space Opera, Post-Apocalyptic
**⚠️ Noir has been removed. Do not reference it anywhere in the codebase.**

### UX Round 3 (commit f5e9237 — 43/43 tests, clean build)

**Fix 1** — Map crash: hasValidMapPosition() helper. All tiers skip nodes with missing/non-numeric map_position.
**Fix 2** — Current location pulse: Tier 3 current node has pulsing amber border via CSS animation.
**Fix 3** — Inline dialogue free-text: DialogueModal has inline input with Send button. Stays open. Esc/blur dismisses.
**Fix 4** — Player dialogue in feed: Echoed as NARRATIVE with isPlayerDialogue: true. Muted green italic before NPC response.
**Fix 5** — Failed stat check rule: Named locations/people/secrets NEVER revealed on failed check. Wrong/right examples in prompt.
**Fix 6** — Codex dedup notifications: saveCodexEntry returns { created: boolean }. Notification only fires when created: true.
**Fix 7** — Repeat examine canned: examinedObjects: string[] in store. Second EXAMINE of same Tier 1 landmark → instant "You find nothing new." No AI call.
**Fix 8** — Contextual loading wired: loadingText prop on StoryFeed from processingStep. Shows "Speaking with X...", "Examining Y...", etc.
**Fix 9** — Merchant trade button: 💰 Trade in DialogueModal footer when NPC role contains merchant/trader/vendor/shopkeeper. Always accessible.
**Fix 10** — RegionBible content: Every location needs purpose. Sub-locations: 1-2 NPCs + 2 objects. Standalone: ≥1 NPC + 2 objects. max_tokens 1500→2200.
**Fix 11** — Verbosity strict: All blocks have "(STRICTLY ENFORCED)" + "This length rule overrides all other instructions."

---

## 🏗️ Architecture — Complete ✅

### Four Layers ✅
**Layer 0 — WCD** — world_consistency jsonb, formatWcdBlock() first in all AI calls
**Layer 1 — WorldBible** — geographic region + settlement + sub-locations + region_locations + main quest
**Layer 2 — RegionBible** — on-demand via navigateTo, 2200 tokens, content required (≥1 NPC per location)
**Layer 3 — Narrator** — YOUR ROLE HARD RULES (incl. stat check failure rule), TIER 1 OBJECTS verbatim, NPCS PRESENT

### Geographic Hierarchy ✅
```
World
└── Geographic Region (e.g. "The Rust Flats") — Tier 1 block
    ├── Settlement (e.g. "Filter Mark") — Tier 2 node
    │   ├── Sub-location (INN, MKT, FRG etc.) — Tier 3 block
    │   └── Sub-location
    ├── Standalone location (dungeon/wilderness) — Tier 2 node, ≥1 NPC
    └── [Adjacent region exits]
```

### Three-Tier Map ✅
```
Tier 1 — Geographic regions. WCD landmark ◆ with tooltips.
          Click region → Tier 2. Null-guard on map_position.
Tier 2 — Settlement + standalone locations within region.
          Click settlement → Tier 3.
Tier 3 — Sub-locations. 72px blocks, type abbr, pulse on current node.
          Location info panel below.
```

### Navigation Model ✅
Text input → DIALOGUE / EXAMINE / INTERACT / CUSTOM only (MOVE → INTERNAL_DESCRIBE)
navigateTo(nodeId): NavigationBar, WorldMap, highlight clicks, adjacent region expansion.

### Three-Tier Object System ✅
Tier 1 → exact highlight → EXAMINE (canned response on repeat)
Tier 2 → instant template → no narrator
Tier 3 → narrator ambient → 1-2 sentences

### Dialogue System ✅
- Inline free-text input within DialogueModal (no external InputBar routing)
- Player dialogue echoed in feed before NPC response
- 💰 Trade button in footer for merchant NPCs
- Dialogue closes when trade opens, restores when trade closes
- RESPONDING CHARACTER only, badge matches check
- Failed check → evasion/deflection ONLY, never reveals information

### NPC Rules ✅
Real name from birth. Codex only on first player interaction.
Codex dedup — notification only fires for genuinely new entries.
Repeat examine returns instant canned response.

---

## ⚡ FOUNDATIONAL RULES (Read Before Every Session)

### 1. World Assets Are Permanent
Write-once. ignoreDuplicates: true.

### 2. Navigation Is UI-Driven
MOVE from text → INTERNAL_DESCRIBE. navigateTo(nodeId) only real navigation.

### 3. Location Is Authoritative State
current_node_id saved on real navigateTo. IDs canonical.

### 4. Actions Are Permitted By Default
Tier 1→AI (canned on repeat). Tier 2→template. Tier 3→ambient.

### 5. Objects Mentioned Exist
Nothing disappears. Failed checks = evasion, never absence.

### 6. Dialogue Is Consistent
RESPONDING CHARACTER only. Badge matches check.
Failed check → no information revealed ever.
intimidating→STR. curious→PER. deceptive→CHA+2. persuasive→CHA.

### 7. The AI Has Exactly Three Roles
Generator (Phase 1+2 only) → Bridge (exact names) → Thread (breadcrumbs)

### 8. WCD Is Absolute Law

### 9. Failed Checks = Evasion Only
NEVER reveals named locations, people, factions, or secrets.

### 10. Highlights Are Exact Tier 1 Matches
LOCATION blue+underline→navigateTo. NPC genre+underline→DIALOGUE.
ITEM amber+underline→EXAMINE. LANDMARK violet+underline→info.

---

## 🎭 NPC/Dialogue ✅ | 💰 Trading ✅ | 🎨 Direction 3 UI ✅ | 🗺️ Three-Tier Map ✅

---

## Narrator Architecture ✅

DIALOGUE: WCD → HARD RULES → RESPONDING CHARACTER → TIER 1 OBJECTS → WORLD ASSETS → SCENE CONTEXT → VERBOSITY
non-DIALOGUE: WCD → HARD RULES → NPCS PRESENT → TIER 1 OBJECTS → CONNECTED LOCATIONS → WORLD ASSETS → SCENE CONTEXT → VERBOSITY

Verbosity (STRICTLY ENFORCED — overrides all other instructions):
- terse: 2/3/4 sentences, ≤12 words each
- standard: 3-4/4-5/5-7 sentences
- rich: 5-7/6-8/8-12 sentences

---

## Pending Discussions

**Dynamic pricing:** When STR/CHA check passes on price objection, write session flag price_override_[item_id]. TradeModal reads it. Needs: floor price, persistence rules, single-attempt limit. To discuss before implementing.

---

## Planned Systems

| System | When | Description |
| --- | --- | --- |
| UI Design Session | Next | Claude Design — full visual overhaul |
| Dynamic pricing | Discuss | Haggling check → price_override flag |
| Combat System | Day 20 | Turn-based, structured UI |
| Object Types | Day 20 | landmark/container/item/mechanism/document |
| Skills & Abilities | Day 21 | Skill trees, attribute thresholds |
| Main Narrative Thread | Day 22 | Breadcrumb injection from WorldBible |
| Lore System | Later | Codex entry updates |
| Item Interaction Depth | Later | Searching barrels/crates for loot |
| NPC dots clickable in map | Later | Quick interact from map panel |
| Art System | Phase 3 | Static pixel art + Replicate API |

---

## Supabase Tables (all applied ✅)
- game_sessions: +world_seed, +world_graph, +world_consistency, +world_bible
- world_states: +current_node_id. world-state route accepts worldGraph.
- Migrations 001-009.

---

## Core Philosophy
- AI generates content once, engine owns it forever
- Geographic region ≠ settlement — region is landscape, settlement is town
- Navigation is UI-driven — text for actions only
- Failed stat checks never reveal information
- Codex only on first player interaction
- Repeat examine returns instant canned response
- Every generated location must have content (NPCs + interactable objects)
- Merchant dialogue has dedicated 💰 Trade button
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

*Last updated: Session 70 — V8.3: UX Round 3. Map crash null guard, current node pulse, inline dialogue, player text in feed, failed stat check rule, codex dedup, repeat examine canned, contextual loading wired, merchant trade button, RegionBible content requirement, verbosity strict enforcement.*
