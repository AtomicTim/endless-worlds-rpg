# World Generation Architecture

## Overview

Two-phase AI generation: creative world-building happens once before the player's first action. Live narration only describes what already exists.

---

## The Four Layers

**Layer 0 — WCD:** Generated once. Injected into every AI call. The world's constitution.
**Layer 1 — WorldBible:** Starting geographic region in full detail + adjacent region outlines + main quest.
**Layer 2 — RegionBible:** On-demand when player enters a new region. Constrained by WCD.
**Layer 3 — Narrator:** Describes only. Never invents. Hard rules enforced.

---

## Geographic Hierarchy

```
World
└── Geographic Region (e.g. "The Salt Plains")
    ├── Settlement (e.g. "Salt-Iron Crossing") — a named town/hub
    │   ├── Sub-location (e.g. "The Preserved Cup" — inn)
    │   ├── Sub-location (e.g. "Morrigan's Oddments" — shop)
    │   └── Sub-location (e.g. "The Bone Smithy" — forge)
    ├── Wilderness point (e.g. "The Collapsed Vault" — dungeon entrance)
    └── [Adjacent region borders]
```

**Critical distinction:**
- Geographic Region = named landscape area containing multiple locations
- Settlement = a specific town, hub, or inhabited place within the region
- Sub-locations = specific buildings/spaces inside a settlement

**WorldBible must generate:**
- `region_name`: geographic name (e.g. "The Salt Plains", "Rust Peaks Foothills")
- `settlement_name`: town name inside the region (e.g. "Salt-Iron Crossing")
- Settlement sub-locations (inn, shop, forge etc.)
- 1-2 additional standalone locations in the region (dungeon entrance, wilderness area, shrine)
- These additional locations are NOT inside the settlement — they're separate nodes in the geographic region

---

## Three-Tier Map

**Tier 1 — World Map:**
- Each block = one GEOGRAPHIC REGION (not a town)
- Shows the whole world: discovered regions + WCD landmark diamonds
- Clicking a region → goes to Tier 2 for that region
- Orange diamonds = WCD landmarks (famous places everyone knows about)
  - Tooltip shows: landmark name + public_description

**Tier 2 — Regional Map:**
- Shows all nodes WITHIN the selected geographic region
- Includes: the settlement, any dungeons/wilderness, region exits
- Multiple distinct nodes per region (not just one)
- Clicking a node → goes to Tier 3 for that node's settlement (or the node itself)
- Clicking a region exit arrow → triggers navigation/RegionBible expansion

**Tier 3 — Local Map:**
- Shows sub-locations INSIDE a specific settlement
- 72px blocks, 3-letter type abbreviation, genre decorations in empty cells
- Location info panel below showing atmosphere + NPCs + Tier 1 objects

**Navigation rules:**
- Clicking Tier 1 region → SET selectedRegionId, SWITCH to Tier 2 (never jump to Tier 3)
- Clicking Tier 2 node → if node is a settlement, SWITCH to Tier 3 for that settlement
- Clicking Tier 2 node that IS a settlement → navigate player there AND show Tier 3
- Auto-switch: when current_node_id changes zone, auto-update selectedRegionId and show Tier 3

---

## WorldBible Schema Changes

Add to RegionBible:
```typescript
interface RegionBible {
  id: string;              // geographic slug e.g. "salt_plains"
  name: string;           // geographic name e.g. "The Salt Plains"
  settlement_id: string;  // which location is the main settlement
  settlement_name: string; // display name of the town
  // ... existing fields
  region_locations: LocationDefinition[]; // locations NOT inside the settlement
  // (dungeons, wilderness points, shrines etc.)
}
```

In WorldGraph:
- Geographic region nodes have zone_id = their own ID (they ARE the zone)
- Settlement nodes have zone_id = geographic region ID
- Sub-locations have zone_id = settlement ID
- Region-level locations (dungeons, wilderness) have zone_id = geographic region ID

---

## RegionBible Generation

Minimal skeleton (1500 tokens max):
- 1 settlement hub (arrival point, NOT a building)
- 1 settlement sub-location (most important building)
- 1 standalone region location (dungeon entrance OR wilderness area)
- 2 NPCs total (1 at sub-location, 1 may be at region location)
- 1 Tier 1 object per location
- 1 exit back to origin

---

## Three-Tier Object System

**Tier 1 — AI-generated, tracked, highlighted:**
3-5 per sub-location. Named in LocationDefinition.objects. Exact name match for highlights.
Narrator MUST use exact names verbatim.

**Tier 2 — Code templates (ambient-objects.ts):**
27 types across all genres. Instant response. Never highlighted. No AI call.

**Tier 3 — Narrator ambient:**
Brief narrator call for anything not in Tier 1 or 2. "Nothing of particular note."
Never says object disappeared.

---

## Narrator Hard Rules

1. Use EXACT stored names for locations, NPCs, objects — verbatim
2. Only name Tier 1 objects in descriptions
3. Failed checks = evasion, never absence
4. Write only from RESPONDING CHARACTER for DIALOGUE
5. WCD is absolute truth — never contradict it
6. Settlement node is ALWAYS a public gathering space — never a specific building

---

## NPC Rules

- Real name from birth — no placeholders ever
- name_known always true for WorldBible/RegionBible NPCs
- Narrator introduces atmospherically then names immediately
- No reveal pipeline
- Codex entry ONLY written on actual player interaction (talk/examine)
- NOT written on room entry/discovery

---

## Key Files

- `/lib/game/prompt-builder.ts` — narrator prompts, WCD injection, TIER 1 OBJECTS
- `/lib/game/codex.ts` — world asset persistence, ID normalization
- `/lib/game/ambient-objects.ts` — Tier 2 template library
- `/lib/game/highlights.ts` — exact highlight matching
- `/lib/game/regional-bible-cache.ts` — RegionBible cache + matchRegionOutline
- `/lib/game/move-classifier.ts` — approach-person → INTERNAL_DESCRIBE
- `/lib/game/dialogue-tone.ts` — canonical tone heuristic
- `/lib/game/map-colors.ts` — MAP_NODE_COLORS, getNodeTypeAbbr
- `/components/game/NavigationBar.tsx` — UI-driven navigation cards
- `/components/game/WorldMap.tsx` — three-tier map container
- `/components/game/map/MapDecorations.tsx` — genre SVG decorations
- `/app/api/game/generate-wcd/route.ts` — WCD generation
- `/app/api/game/generate-world-bible/route.ts` — WorldBible generation
- `/app/api/game/apply-world-bible/route.ts` — writes assets + builds WorldGraph
- `/app/api/game/generate-regional-bible/route.ts` — on-demand region expansion
- `/app/api/game/apply-regional-bible/route.ts` — extends WorldGraph with new region
