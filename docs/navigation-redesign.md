# Navigation Redesign — UI-Driven Movement

## The Problem

Free-text navigation is architecturally incompatible with a persistent world graph.
Patterns cannot cover infinite player phrasings. Every misclassification creates
a phantom location or corrupts world state permanently.

## The Solution

Navigation moves to explicit UI controls. Free text is reserved for actions
(dialogue, examine, interact, combat) which are stateless and recoverable.

---

## Navigation Channels

### Channel 1 — Highlighted Text Links
When the narrator mentions a connected location name, it is highlighted
(blue-grey, LOCATION type). Clicking it fires GRAPH_NAVIGATE directly.
This already works — no changes needed.

### Channel 2 — Navigation Bar (NEW)
A persistent bar just above the input field showing all connected locations
the player can navigate to from their current position.

Each card shows:
- Location name
- Location type icon (🏠 inn, ⚒ forge, 🏛 civic, 🌲 wilderness, etc.)
- Visited indicator (dim if unvisited, brighter if visited)
- Tap/click fires GRAPH_NAVIGATE to that location

On mobile: horizontally scrollable row of cards, minimum 44px height.
On desktop: same row, less prominent since map and highlights are also available.

Cards are built from currentNode.connections → resolved WorldNode names.
Only shows connections where the node exists in the world graph.
Adjacent undiscovered regions show as "→ [Region Name]" with a discovery icon.

### Channel 3 — Map Navigation
Local Map (Tier 3): clicking any visible sub-location block fires GRAPH_NAVIGATE.
Regional Map (Tier 2): clicking a node in the current region fires GRAPH_NAVIGATE.
World Map (Tier 1): clicking an adjacent undiscovered region fires RegionBible expansion.

Map is a bottom sheet on mobile (swipe up or tap map button).
Map button stays visible in the header at all times.

---

## What Happens When Player Types Movement

If the player types "go to the inn" or "head north" or "walk to the market":
- The game detects movement intent (existing MOVE detection in intent parser)
- Instead of routing through move classifier, routes to INTERNAL_DESCRIBE
- Narrator responds with atmospheric description of what is visible from
  current position, including connected location names (highlighted)
- Navigation Bar remains visible showing actual options
- No world state changes. No new nodes created.

The narrator response for movement-typed-as-text should say something like:
"You glance toward [The Sodden Threshold] to the north, its warm light
visible through the rain. [Verin's Wares] sits to the west..." with
those names highlighted and clickable.

The game never says "you can't do that" — it just describes what you see
and lets the player choose via the navigation bar or highlighted text.

---

## WORLD_EXPLORE — Map-Only

WORLD_EXPLORE no longer fires from text input under any circumstances.
It only fires when:
- Player taps a "→ [Region Name]" card in the Navigation Bar
  (adjacent undiscovered region)
- Player clicks an undiscovered region on the World Map
- Player clicks an exit arrow in the Regional Map

The stub generator is removed from the text-input pipeline entirely.
Stub generator remains as a fallback only when RegionBible fails.

---

## Mobile Map — Bottom Sheet

The current sidebar map panel becomes a bottom sheet on mobile:
- Map button in header (always visible)
- Tap opens a bottom sheet sliding up from the bottom
- Sheet height: 60% of viewport
- Three tier tabs at top of sheet: 🌍 World / 🗺 Region / 📍 Local
- Default tier on open: Local (most useful for navigation)
- Swipe down or tap X to close

Local Map changes for mobile:
- Sub-location blocks: minimum 56px height, 100% readable labels
- Current location: pulsing amber border, clearly marked
- Connected locations: slightly brighter than unvisited
- Exit arrows: full-width labeled buttons at map edges ("→ Kethralmar Approach")
- NPC dots: 8px minimum, genre-colored

On desktop the sidebar panel remains unchanged.

---

## Navigation Bar Component

File: /components/game/NavigationBar.tsx

Props:
- masterState: MasterState
- worldGraph: WorldGraph
- onNavigate: (locationId: string) => void

Behavior:
- Reads currentNode.connections from worldGraph
- Resolves each connection ID to WorldNode
- Renders horizontally scrollable row of NavigationCard components
- Scrollable on mobile (overflow-x: auto, snap scrolling)
- Positioned between story feed and input bar

NavigationCard:
- Location name (truncated at 20 chars)
- Type icon based on node.category
- Visited indicator (node.discovered)
- Tap fires onNavigate(node.id) which calls submitAction with a
  special navigation command that bypasses text parsing and fires
  GRAPH_NAVIGATE directly

Empty state: if no connections, hide the bar entirely.

Adjacent undiscovered regions (from world_bible.adjacent_regions):
- Show as cards with "→" prefix and discovery icon
- Tap triggers RegionBible expansion
- Visually distinct (dashed border, slightly dimmer)

---

## Input Bar Changes

Remove movement-related placeholder text.
New placeholder: "Talk to someone, examine something, or take action..."

If the player types something the intent parser classifies as MOVE:
- Short-circuit before narrateAction
- Post a NARRATIVE message: the narrator describes what's visible with
  highlighted connected location names
- Scroll the Navigation Bar into view if hidden
- Do NOT call the move classifier. Do NOT fire WORLD_EXPLORE.

---

## Object Interaction Types (separate from navigation)

LocationObject needs an object_type field to determine available actions:

```typescript
type LocationObjectType =
  | 'landmark'    // Examine only — monuments, architecture, environmental
  | 'container'   // Search — chests, bags, crates
  | 'item'        // Pick up — loose objects the player can take
  | 'mechanism'   // Use/interact — doors, levers, locks
  | 'document'    // Read — notices, books, letters
  | 'person'      // Talk to — ambient persons (not WorldBible NPCs)

Actions by type:
  landmark:   [Examine]
  container:  [Search]
  item:       [Examine, Take]
  mechanism:  [Use, Examine]
  document:   [Read, Examine]
  person:     [Talk To, Examine] — routes to INTERNAL_DESCRIBE, not NPC dialogue
```

Highlighted objects in story text show their action on click:
  - landmark → EXAMINE fires
  - item → shows mini menu: [Examine] [Take]
  - mechanism → USE fires
  - document → READ fires

This replaces the current "Pick Up" showing on everything.

---

## Implementation Order

1. NavigationBar component — reads graph connections, shows location cards
2. Wire NavigationBar above input in GameLayout
3. Mobile map → bottom sheet
4. Short-circuit MOVE intent in submitAction → INTERNAL_DESCRIBE narrator call
5. Remove WORLD_EXPLORE from text pipeline
6. Add object_type to LocationObject schema and WorldBible generation
7. Update highlight click behavior per object type
