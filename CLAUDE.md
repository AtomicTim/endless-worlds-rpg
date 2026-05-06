# Project: Endless Worlds RPG — Master Context

**Version:** 8.4
**Status:** Active Development — Navigation + NPC + Difficulty Fixes Complete
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
| Navigation + NPC + Difficulty | Back-links, WCD nav, NPC codex/descriptors, stakes difficulty | ✅ Complete |
| UI Design Session | Claude Design — modern/retro visual overhaul | ⏳ Next |
| 20 | Combat System | ⏳ Pending |
| 21+ | Skills, Background, Factions | ⏳ Pending |

**Active genres:** Fantasy, Cyberpunk, Horror/Lovecraftian, Space Opera, Post-Apocalyptic
**⚠️ Noir has been removed. Do not reference it anywhere in the codebase.**

### Navigation + NPC + Difficulty (commits 353666f + 1828bd9 + 9a67990 — 43/43 tests)

**Fix 1a — region_location back-connections:**
apply-world-bible + apply-regional-bible: every region_location node unconditionally includes the settlement node id in connections. Settlement node connections include every region_location id. Symmetric edges guaranteed.

**Fix 1b — NavigationBar return card:**
When player is at a region_location, a leftmost "← [Settlement Name]" card appears pointing to the sibling settlement zone. Skipped if settlement is already in resolved connections.

**Fix 2 — WCD landmarks navigable:**
Landmarks with known_by === 'everyone' matched to adjacent_regions by id/name. Show as golden ◆ nav cards. Tap triggers RegionBible expansion. Tier 1 diamond buttons call onSelectRegion for matched landmarks.

**Fix 3 — Tier 2 exit arrows filtered:**
Only shows arrows where target is type=zone, not sub_location, in a different zone_id. Internal settlement→sub-location edges no longer appear as exits.

**Fix 4 — NPC codex id fallback:**
Step 7g lookup: exact id → character_${key} → key without character_ → name → normalized name → node npc_ids. findNpcInRegistry gained normalization reconciliation (strips character_ prefix before comparison).

**Fix 5 — Descriptor → role NPC targeting:**
matchDescriptorToNpc() helper with DESCRIPTOR_ROLES map. "the boy" → acolyte/apprentice/youth. "stranger"/"figure" match sole NPC when alone. Step 2b-2 tries descriptor matching before active-conversation fallback.

**Fix 6 — Info panel NPC dedup:**
LocationInfoPanel dedupes both npc_ids (seenIds Set) and display names (seenNames Set). Single loop, no double renders.

**Fix 7 — Contextual stat check difficulty:**
stakesBonusForIntent() in logic-resolver.ts. Public info: -2. Sensitive (location of, who is): +2. Personal/intimate: +3. Dangerous secrets (traitor/spy/conspiracy): +4. Clamps [6, 18]. Applied only when stat check fires. Dangerous tested before sensitive to avoid downgrade. Debug log shows full breakdown.

---

## 🏗️ Architecture — Complete ✅

### Four Layers ✅
**Layer 0 — WCD** — world_consistency jsonb, formatWcdBlock() first in all AI calls
**Layer 1 — WorldBible** — geographic region + settlement + sub-locations + region_locations + main quest
**Layer 2 — RegionBible** — on-demand via navigateTo, 2200 tokens, content required (≥1 NPC per location)
**Layer 3 — Narrator** — YOUR ROLE HARD RULES, TIER 1 OBJECTS verbatim, NPCS PRESENT, stat check failure rule

### Geographic Hierarchy ✅
```
World
└── Geographic Region (e.g. "The Rust Flats") — Tier 1 block
    ├── Settlement (e.g. "Filter Mark") — Tier 2 node
    │   ├── Sub-location (INN, MKT, FRG etc.) — Tier 3 block
    │   └── Sub-location
    ├── Standalone location (dungeon/wilderness) — Tier 2 node, ≥1 NPC
    │   └── Back-connection to settlement guaranteed
    └── [Adjacent region exits — WCD landmarks navigable via ◆ cards]
```

### Navigation Model ✅
```
Text input → DIALOGUE / EXAMINE / INTERACT / CUSTOM only (MOVE → INTERNAL_DESCRIBE)
NavigationBar: connection cards + ← Return card for region_locations + ◆ WCD landmark cards
WorldMap: Tier 1 landmark diamonds clickable when matched to adjacent_region
Tier 2: exit arrows only for cross-zone connections (not internal sub-locations)
```

### Dialogue System ✅
- Inline free-text within DialogueModal
- Player dialogue echoed in feed
- 💰 Trade button for merchants
- Failed check → evasion only, never reveals information
- Descriptor targets ("the boy") matched to NPC by role

### Stat Check Difficulty ✅
- Base difficulty from NPC trust score (difficultyForTrust)
- Stakes bonus from intent analysis (stakesBonusForIntent)
- Public info: -2 | Neutral: 0 | Sensitive: +2 | Personal: +3 | Dangerous: +4
- Tone modifiers: deceptive +2 (on top of base+stakes)
- Final clamp: [6, 18]

### NPC Rules ✅
Real name from birth. Codex only on first player interaction.
id fallback chain: exact → character_ prefix → name → node npc_ids.
Descriptor → role matching ("the boy" → acolyte/apprentice).
Info panel deduped by id and name.

---

## ⚡ FOUNDATIONAL RULES (Read Before Every Session)

### 1. World Assets Are Permanent
Write-once. ignoreDuplicates: true.

### 2. Navigation Is UI-Driven
MOVE from text → INTERNAL_DESCRIBE. navigateTo(nodeId) only real navigation.
region_locations always have back-connection to settlement.
WCD landmarks reachable via ◆ cards when matched to adjacent_regions.

### 3. Location Is Authoritative State
current_node_id saved on real navigateTo. IDs canonical.

### 4. Actions Are Permitted By Default
Tier 1→AI (canned on repeat). Tier 2→template. Tier 3→ambient.

### 5. Objects Mentioned Exist
Nothing disappears. Failed checks = evasion, never absence.

### 6. Dialogue Is Consistent
RESPONDING CHARACTER only. Badge matches check.
Failed check → no information revealed ever.
Difficulty = trust base + stakes bonus + tone modifier, clamped [6,18].

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

Verbosity (STRICTLY ENFORCED):
- terse: 2/3/4 sentences, ≤12 words each
- standard: 3-4/4-5/5-7 sentences
- rich: 5-7/6-8/8-12 sentences

---

## Pending Discussions

**Dynamic pricing:** When STR/CHA check passes on price objection, write session flag price_override_[item_id]. TradeModal reads it. Needs: floor price, persistence rules, single-attempt limit.

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
- region_locations always back-connected to settlement
- WCD landmarks reachable via adjacent_region matching
- Failed stat checks never reveal information — difficulty scales by stakes
- Codex only on first player interaction, NPC id fallback chain
- Every generated location must have content (NPCs + interactable objects)
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

*Last updated: Session 71 — V8.4: Navigation back-links, WCD landmark nav cards, Tier 2 exit filter, NPC codex id fallback, descriptor→role matching, info panel dedup, contextual difficulty by stakes.*
