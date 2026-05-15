# Endless Worlds RPG — UI Design Reference

**Version:** 2.1  
**Status:** Design complete, ready for implementation  
**Covers:** All designed UI surfaces as of May 2026

---

## 1. Design Philosophy

**The guiding aesthetic:** "Snappy, clean, modern game feel with aesthetics of classic D&D/RPG games that invoke wonder."

- Dark and warm, never cold or sterile
- Amber gold is the only saturated accent colour in the Fantasy genre — all other colours are muted, warm darks. This makes the accent feel precious and meaningful
- Georgia serif for all narrative text (prose, NPC speech, item descriptions)
- Clean system sans-serif for all UI chrome (labels, badges, buttons, stats)
- Every design decision should serve the "Saturday night on the couch" goal: a couple picks up their phones and is in a new world within 2 minutes

**The Hybrid Authority Model:** Code is the source of truth for all numbers (stats, HP, gold, inventory). The AI is the Narrator and Visualiser. The UI must never make the player feel like they're interacting with a spreadsheet.

---

## 2. Design System

### Colour Palette

```
Background primary:    #1c1a17  (very dark warm brown)
Background secondary:  #1e1b16
Background tertiary:   #141210  (top/bottom bars)
Background card:       #221e19  (combat cards, option cards)

Border default:        #2d2618
Border subtle:         #252018
Border strong:         #3a3020

Story prose:           #c0a878  (Georgia serif, warm amber)
NPC speech:            #f0c060  (brighter gold, italic)
UI text primary:       #e2cda0
UI text secondary:     #a08870
UI text muted:         #6a5530
UI text hint:          #5a4828

Fantasy accent:        #c4943a  (amber gold — primary)
HP green (healthy):    #4a8a4a → #5a9a5a
HP amber (hurt):       #a87830
HP orange (danger):    #c84830
HP red (critical):     #e03030
Combat hit (enemy):    #dd8888
Combat hit (player):   #c4a870
Dodge/miss:            #7a9ab0
```

### Genre Accent Colours

Each genre replaces `#c4943a` as the primary accent throughout the entire UI:

| Genre | Accent | Feel |
|-------|--------|------|
| Fantasy | `#c4943a` | Amber gold — the default |
| Cyberpunk | `#22d3ee` | Neon cyan |
| Horror | `#84cc16` | Acid green |
| Space Opera | `#a855f7` | Deep violet |
| Post-Apocalyptic | `#ea580c` | Rust orange |

Genre accent colour is applied to: logo/title, active tab highlights, primary button borders, NPC speaker labels, HP bars on enemy cards, the genre tag pill, and map accent elements.

### Typography

```
Narrative prose:     Georgia, serif, italic, 13–15px, line-height 1.78–1.82
NPC speech:          Georgia, serif, italic, 13px, genre accent colour, weight 500
UI labels:           System sans-serif, 7–9px, letter-spacing 0.1–0.18em, uppercase
Button labels:       System sans-serif, 8–9px, uppercase, letter-spacing 0.12em
Character names:     Georgia, serif, italic, varies by context
Stat numbers:        Monospace/tabular-nums, for anything numeric
```

### Spacing & Shape (Base — Fantasy)

- Border radius: 7–8px for cards, 20px for pills/badges, 50% for circles
- Card borders: 1px (default), 1.5–2px for selected state
- Padding: 8–14px card interior, 7–13px bars
- All interactive elements: minimum 44px touch target height on mobile

---

## 3. Genre Visual System

This is the most important implementation section. Every content surface in the game changes visual character per genre — not just the accent colour, but background atmosphere, card shape, texture overlays, and decorative elements.

### Implementation Approach

Apply a single class to the root game container: `genre-fantasy`, `genre-cyberpunk`, `genre-horror`, `genre-space`, `genre-postapoc`. All styling cascades via CSS. Do NOT apply genre styling per-component — one class on the root updates everything.

Recommended CSS custom properties pattern:

```css
.genre-fantasy {
  --card-bg: linear-gradient(160deg, #2e2010, #281b0e);
  --card-border: rgba(196,148,58,.28);
  --card-radius: 8px;
  --card-shadow: inset 0 1px 0 rgba(220,170,70,.14), 0 3px 8px rgba(0,0,0,.55);
  --content-bg: linear-gradient(180deg, #241a0a, #1c1308);
  --genre-accent: #c4943a;
}
.genre-cyberpunk {
  --card-bg: #060e12;
  --card-border: rgba(34,211,238,.17);
  --card-radius: 0px;
  --card-shadow: 0 0 14px rgba(34,211,238,.06);
  --content-bg: #040c0f;
  --genre-accent: #22d3ee;
}
/* etc. */
```

### Overlay System

Every scrollable content area contains three overlay divs (`position: absolute`, `inset: 0`, `pointer-events: none`, `z-index: 2`). Exactly one (or two for Horror) are shown per genre via CSS:

| Overlay | Genres | Effect |
|---------|--------|--------|
| `.ol-scan` | Cyberpunk | Horizontal CRT scanlines (`repeating-linear-gradient`, 4px repeat, ~2.5% cyan opacity) |
| `.ol-scan` | Horror | Static dot texture (`radial-gradient` dot pattern, 5px grid, ~20% opacity) |
| `.ol-scan` | Post-Apoc | Diagonal cross-hatch scratches (two `repeating-linear-gradient` at -55° and 35°, ~2.5% opacity) |
| `.ol-grid` | Space Opera | Purple holographic grid (`linear-gradient` lines, 26px × 26px, ~5% opacity) |
| `.ol-grid` | Horror | Green atmospheric fog (four `radial-gradient` ellipses at different positions, ~25–32% opacity) |
| `.ol-tex` | Fantasy | Warm amber candlelight glow (two `radial-gradient` ellipses, top glow ~16%, edge warmth ~7%) |

Horror uses BOTH `.ol-grid` (fog) AND `.ol-scan` (dots) simultaneously.

### Card Treatment Per Genre

| Genre | Radius | Border | Shadow | Decorative element |
|-------|--------|--------|--------|-----------------|
| Fantasy | 7–8px | `rgba(196,148,58,.28)` | Warm inner glow + 0 0 0 .5px outer ring | `✦` Unicode mark, top-right |
| Cyberpunk | 0px | `rgba(34,211,238,.17)` | Cyan outer glow | Hard corners, no decoration |
| Horror | 2px | `rgba(45,65,40,.32)` | Crushing inward shadow (inset 0 0 32px) | Near-invisible border |
| Space Opera | 3px | `rgba(168,85,247,.2)` | Purple outer glow + inner haze | `┌` `┘` corner brackets via `::before` / `::after` |
| Post-Apoc | 2px | `rgba(180,80,20,.25)` | Double border ring (`box-shadow: 0 0 0 1px`) | Rust-orange streak via `::before` (top edge, left-bleeding gradient) |

### Content Background Per Genre

| Genre | Background | Notes |
|-------|------------|-------|
| Fantasy | `linear-gradient(180deg, #241a0a, #1c1308)` | Noticeably warmer than dark phone chrome — visible parchment contrast |
| Cyberpunk | Flat `#040c0f` | No gradient — terminal screens are flat |
| Horror | Near-black `#060809` | Fog overlay provides all depth |
| Space Opera | `linear-gradient(180deg, #070520, #060412)` | Deep purple-black with grid overlay |
| Post-Apoc | `linear-gradient(180deg, #1a0e06, #130b04)` | Dark rust-brown, scratch overlay provides texture |

### Typography Per Genre (Labels and UI only — prose font never changes)

| Genre | UI labels / headers | Prose / narrative |
|-------|--------------------|-----------------|
| Fantasy | Georgia italic, `font-style: italic`, `text-transform: none`, `letter-spacing: .04em` | Georgia italic (unchanged) |
| Cyberpunk | `"Courier New", monospace`, `font-style: normal`, wider `letter-spacing` | Georgia italic (unchanged) |
| Horror | System sans-serif, `font-size: 6.5px`, minimal `letter-spacing` | Georgia italic (unchanged) |
| Space Opera | `system-ui, sans-serif`, `font-style: normal`, `letter-spacing: .14–.18em` | Georgia italic (unchanged) |
| Post-Apoc | System sans-serif, `letter-spacing: .18–.22em`, `font-size: 6.5px` | Georgia italic (unchanged) |

**Critical rule:** Narrative prose (story text, NPC speech, journal entries, quest descriptions) always uses Georgia serif italic regardless of genre. Only labels, section headers, and UI chrome change typeface. Changing prose fonts would require retroactive changes across the entire UI.

### Text Glow Per Genre

| Genre | Glow |
|-------|------|
| Fantasy | None — warmth comes from colour, not glow |
| Cyberpunk | `text-shadow: 0 0 8px rgba(34,211,238,.28)` on key text; `0 0 10px` on accent text |
| Horror | None — oppressive flatness is intentional |
| Space Opera | `text-shadow: 0 0 6px rgba(168,85,247,.2)` on prose; `0 0 8px` on accent text |
| Post-Apoc | None |

### Surfaces Requiring Genre Treatment

The genre visual system must be applied to ALL content areas. Since the CSS class cascades from the root, this is automatic — but every component must use `var(--card-bg)`, `var(--card-radius)`, etc. rather than hardcoded values.

**Surfaces that need overlay textures (three overlay divs required):**
- Story feed / main game panel
- Combat content area
- NPC dialogue conversation feed
- Codex list and detail views
- Journal and Quests list
- Loading state content areas
- Character sheet panel

**Surfaces that need card shape treatment:**
- Story feed navigation cards
- Combat combatant cards, action buttons
- NPC dialogue option cards, NPC header card
- Codex entry cards
- Journal entry cards, quest cards
- Loading state new-area entry card
- Character sheet stat/inventory cards

**Surfaces already genre-specific (no additional work needed):**
- Maps — handled via Canvas rendering, already fully genre-specific
- Character creation wizard — genre cards and class cards already themed; inherits genre class naturally
- Top bar — already reactive to genre accent colour; stays as dark chrome

---

## 4. Layout

### Desktop (3-Panel)

```
[Left 196px: Context Panel] [Center: Story Feed] [Right 196px: Character Panel]
```

**Top bar:** `Endless Worlds` logo | Genre tag | Location breadcrumb (Region › Settlement › Place) | Terse/Standard/Rich toggle | Map/Codex/Journal | Character pill

**Context Panel (left):** Always-visible current location — name, type, description, NPCs present, interactable objects. NOT a map — navigation is via nav cards in the story feed.

**Character Panel (right):** Character name, XP/HP bars, attributes as large numerals, gold row, equipped/pack inventory, log book. Updates in real time from master state.

**Story Feed (centre):** The primary play surface. Top-down scroll. Story text, navigation cards, NPC dialogue, combat — all live here.

### Mobile (Single Column)

Story feed fills the screen. Navigation cards appear below story text. Combat panel anchors to bottom. Character stats accessible via the top character pill. Context accessible via sidebar drawer.

---

## 5. Story Panel

### Text Display

- Font: Georgia serif, 14–15px, line-height 1.82, colour `#c0a878`
- NPC speech: `#f0c060` (brighter), italic, weight 500 — clearly distinct from prose
- Scene arrivals: thin rule → `◆ type` glyph → italic location name → region sub-label → rule → prose begins

### Streaming Behaviour

**The LLM API stream IS the typewriter.** Display tokens as they arrive. No buffering, no fake animation.
- Blinking cursor (genre-specific style) while streaming is active
- Tap the story panel during streaming to skip to instant completion
- Combat log entries: 80ms fade only — data, not narrative, no typewriter

**Genre cursor variants:**
- Fantasy: soft blinking amber underscore
- Cyberpunk: hard-cut block cursor, on/off with no fade
- Horror: irregular flicker timing
- Space Opera: clean fade pulse
- Post-Apoc: slow, heavy blink

### Loading / Waiting States

**Pattern 1 — Story panel wait (most common):**
1. Cursor appears immediately on send (world never feels frozen)
2. After 1.2 seconds of silence: brief atmospheric micro-fragment streams word-by-word ("The torchlight wavers.")
3. Fragment stays in the feed — it's genuine narrative, not a spinner
4. Real content continues after it on a new paragraph when LLM starts streaming
5. Navigation cards dim simultaneously; input bar locks

Atmospheric fragments come from a local lookup table per genre (~20–30 phrases). No LLM call needed. The 1.2s threshold is tunable — if the LLM starts streaming before it, the fragment never shows.

**Pattern 2 — New area loading:**
1. Location name + type badge appear instantly from game state (no LLM)
2. `Revealing…` status + thin progress bar
3. Description streams starting slightly before the bar completes (no dead moment at the end)
4. Top bar location updates immediately

**Pattern 3 — Background operations:**
Small 6px pulsing dot in genre accent in the top bar. Appears when regional bible prefetch runs. Disappears quietly on completion. Invisible unless you look for it.

---

## 6. Navigation Cards

- Each card: icon + italic serif location name + "type · direction" sub-label
- Left-border colour coding: burnt copper (back), sky blue (settlement/exploration), burnt orange (dungeon/danger)
- Unknown paths: dashed border, very dim, "unexplored · [direction]" label
- Section header: "Where to go"
- Cards dim during any loading/waiting state (pointer-events disabled)

---

## 7. Map System

**All maps use HTML5 Canvas.** SVG was considered and abandoned.

### World Map
Continent polygon with visible coastline stroke. Territory divisions inside. Interior borders use organic bezier curves seeded with `(px+ppx)*11 + (py+ppy)*7 + 500` for consistent aligned joins. Fog only at canvas edges, not over territory borders.

### Region Map
Settlement node map. Castle/ruins/shrine icons at 0.58 scale, organic curved paths, fog for unknown edges.

### Settlement Map
Bird's-eye village view. No enclosing ring. Building footprints (top-down rectangles with door marks), central well, dirt roads (~5.5px warm brown, quadratic bezier curves, lighter centre stripe), trees at periphery.

### Dungeon Map
- Dark stone background: `#0f0b07`, organic grain texture (scattered dots + crack lines), no grid
- Explored rooms: warm amber-tinted rectangles
- Unexplored: near-black with fog
- Current location: torch glow radial effect

### Genre Map Variants

| Genre | World | Dungeon |
|-------|-------|---------|
| Fantasy | Parchment, organic bezier borders | Dark stone floor plan |
| Cyberpunk | Circuit traces, hex grid | Glowing conduit plan |
| Horror | Desaturated, fog-heavy | Oppressive, minimal light |
| Space Opera | Star chart, constellation lines | Facility/deck plan |
| Post-Apoc | Torn paper texture, rust tones | Collapsed structure |

---

## 8. Combat UI

### Combatant Cards
Portrait zone at top (fixed dimensions — designed for future art drop-in). Player card: wider (flex 1.4), gold border. Enemy cards: red-tinted. Critical enemies (≤20% HP): brighter border, "Critical" badge, pulsing HP bar.

### HP Bar Colour States

| HP % | Colour |
|------|--------|
| 75–100% | `#4a8a4a` green |
| 50–75% | `#5a9450` transitioning |
| 25–50% | `#a87830` amber |
| 10–25% | `#c84830` orange-red |
| ≤10% | `#e03030` red, pulses |

### Action Buttons
**Mobile:** 2×2 grid + full-width Abilities button
**Desktop:** 5 horizontal buttons

During enemy turn: all buttons dimmed to ~30% opacity, pointer-events disabled.

### Abilities Sub-Panel
Slides up from bottom (mobile). 2×2 grid of ability cards showing: name, type badge, description, cooldown. Disabled abilities at ~50% opacity.

### Combat Timing Orchestration

```
0ms      Button press → buttons lock
100ms    Story text begins streaming + target card brightens
300ms    Dice result in combat log (80ms fade)
400ms    ALL SIMULTANEOUSLY: card shake + HP bar drains (300ms ease) + damage numbers arc
800ms    Story text completes
1000ms   Turn badge flips
1300ms   Enemy resolves (same sequence)
~3000ms  Round complete → buttons re-enable
```

Story text and visual effects run **in parallel** — neither waits for the other.

### Damage Number Arcs
Launch from the HP bar position (not portrait centre). Varied trajectories. Crits: 2–3 particles alongside. Heals float straight upward, `+N` prefix, green `#7abb7a`.

**Damage type colours:** Physical `#e0d8c0` · Fire `#ff7030` · Frost `#60d8ff` · Poison `#80e040` · Lightning `#ffee40` · Shadow `#c060ff` · Holy `#ffdc40` · Bleed `#ff3060` · Heal `#7abb7a`

### Kill Shot Animation
Card greyscales → compresses vertically → slides out (300ms). Remaining cards close the gap.

### Dice Display Format
`16 vs 12 · hit` — roll bright, "vs" muted, target muted, outcome colour-coded. Same format used in combat log AND NPC dialogue rolls.

---

## 9. Character Creation Wizard

### Stage Flow
```
Genre → [World Forging loading] → Step 1: Species/Mode → Step 2: Class
→ Step 3: Origin → Step 4: Appearance → Step 5: Name → Step 6: Motivation → Enter World
```

World creation (WCD + WorldBible) runs in the **background** from genre confirmation through all 6 character steps.

### Creation Modes
1. **Forge a Character** — auto-generate everything, skip to Name. Badge: "Auto-generate"
2. **Build Step by Step** — walk through all 6 steps. Badge: "6 choices"
3. **Write Your Own** — free-text fields. Badge: "Creative"

### Class Cards
Three visual differentiators ALL use the **stat colour** (not genre accent):
- Icon (left) · Role badge (header right) · Bottom bar (3px strip)

**Stat colour system:** STR `#c87040` · AGI `#60a850` · INT `#5880d0` · PER `#409888` · CHA `#9060d0`

**Selected card state:** 2px border in stat colour, visible background tint, filled checkmark circle top-right.

### Confirmed Working Tabler Icons (25 classes)
- Knight: `ti-shield` · Rogue: `ti-eye-off` · Mage: `ti-wand` · Ranger: `ti-crosshair` · Herald: `ti-message`
- Netrunner: `ti-cpu` · Fixer: `ti-briefcase` · Street Samurai: `ti-sword` · Enforcer: `ti-hammer` · Ghost: `ti-ghost`
- Investigator: `ti-search` · Cultist: `ti-moon` · Survivor: `ti-heart` · Phantom: `ti-ghost` · Medium: `ti-eye`
- Commander: `ti-badge` · Pilot: `ti-rocket` · Engineer: `ti-tool` · Marine: `ti-shield` · Recon: `ti-radar`
- Scavenger: `ti-search` · Raider: `ti-axe` · Medic: `ti-first-aid-kit` · Runner: `ti-run` · Demagogue: `ti-speakerphone`

---

## 10. NPC Dialogue System

### Layout
Fixed NPC header card at top. Scrollable conversation history. **Exactly 4 content option slots.** "End conversation" as a persistent separate button below slots — never occupying a slot.

### NPC Header Card
Avatar circle (initials) · Name + role · Trait tags (2–3, can gain new ones via perception) · Disposition badge

### Disposition System

| Word | Colour |
|------|--------|
| Hostile | `#c44040` red |
| Suspicious | `#b06030` orange-red |
| Wary | `#b07030` orange |
| Neutral | `#8a6a3a` amber-muted |
| Warm | `#c4943a` genre accent |
| Trusting | `#5a9a5a` green |
| Devoted | `#4a8a4a` deep green |

### Three Option Types

**Standard dialogue** — what your character says. No badge. Always available.

**Stat-gated dialogue (CHA/STR)** — what your character says, requires stat check. Amber badge showing odds: `CHA · Good odds` / `CHA · Risky` / `CHA · Long shot`. **Always tappable — never hard-locked.** Higher stat = higher d20 modifier = better chance, not guaranteed access.

**Observation (PER/INT)** — what your character *notices*. Teal badge + eye icon. Teal-tinted background. Fires a narrated perception event, not a dialogue exchange. NPC doesn't hear it. **Always tappable.** Failed observation = vaguer, less accurate information. Locked (stat too low): shows vague hint — "Something feels off here you can't quite place. [PER 8]" — not hidden entirely.

### Stat/Roll Mechanics (Critical)

Checks are **never hard gates — always probability-based.** The UI communicates odds without locking players out:
- `CHA · Good odds` (stat meets or exceeds requirement) — amber badge
- `CHA · Risky` (stat close but below) — muted amber
- `CHA · Long shot` (stat significantly below) — very muted, still tappable

A low-stat player rolling a 20 succeeds. A high-stat player rolling a 1 fails. This is the TTRPG spirit and must be preserved in UI.

### Feed Visual Treatments

- **Narrative:** Georgia italic `#b0956a`, 1.78 line-height
- **NPC speech:** Speaker label (uppercase genre accent) + `#f0c060` italic Georgia + streaming cursor
- **Player chosen line:** Left-bordered quote block `#c0a878`
- **Observation event:** Teal left border `rgba(64,152,136,.28)`, "PERCEPTION" label + eye icon, `#a0c8b8` text
- **Dice result:** `[dice] 14 vs 11 · hit` inline in feed — same format as combat log

### Observation Reveals Hidden Traits
Successful PER observations surface hidden NPC trait tags in the header card with teal colour treatment. Rewards building PER — high-PER characters see more.

---

## 11. Codex

### Entry Types and Colours

| Type | Colour | Icon |
|------|--------|------|
| People | `#c4943a` amber | `ti-user` |
| Places | `#7a9ab8` slate blue | `ti-map-pin` |
| Lore | `#a888c8` purple | `ti-book` |
| Events | `#c8885a` warm orange | `ti-clock` |

Left border, icon, and type badge all use the same type colour. Scannable at a glance.

### Organisation Within Tabs

- **All tab:** Section headers by entry type (type-coloured headers with icon)
- **People tab:** Section headers by region/settlement (where you met them)
- **Places tab:** Section headers by region or parent location
- **Lore tab:** Section headers by category (Historical, Political, Spiritual, Factional)
- **Events tab:** Section headers by day (chronological, day markers)

Headers are **section dividers, not accordion groups.** No extra taps required.

### Notable Mark (◈)
Removed from automatic assignment. Only appears when:
1. AI flags as plot-critical, OR
2. Player manually stars it

Small `◈` mark in genre accent, top-right of entry card. Not a badge.

### NEW Badge
Appears on unread entries. Clears on open. Codex icon in top bar shows a dot while unread entries exist.

### Related Entries
Each entry cross-links to related entries. Tapping navigates to that entry. Builds a web of connected knowledge. Shown in detail view as a tappable list with type icons.

### Discovery Ceremony
Subtle toast at bottom of screen: "Added to Codex: Edran Voss" + dot on Codex icon. Small moment that makes discovery feel rewarding.

---

## 12. Journal & Quests

### Layout
Quests and Journal share one nav button, two tabs inside (they're both about tracking your story). Screen title: "Chronicle".

### Quests Tab

**Section headers:** Active (with count) · Completed · Failed

**Quest card shows:**
- Quest name (italic Georgia for Fantasy/Horror/Post-Apoc; system-ui for Space; monospace for Cyberpunk)
- `◈` mark if main quest (same mark as Codex notable)
- Source + day discovered
- 2-line narrative description
- **Current objective** — the most actionable info, visible without opening detail

**Quest detail shows:**
- Status badge (Active/Completed/Failed in appropriate colour)
- Full narrative description
- Objectives list — narrative-language items, NOT checkbox list. Completed: dim + strikethrough. Pending: full colour.
- Related Codex entries (same format as Codex related entries)

### Journal Tab

Two entry types with distinct visual treatments:

**Auto-logged (game's voice):**
- Left border: muted amber `rgba(196,148,58,.38)`
- Label: "Chronicle" (Fantasy) / "SYS_LOG" (Cyberpunk) / "case notes" (Horror) / "SHIP LOG" (Space) / "LOG" (Post-Apoc)
- Text: `#b0956a` Georgia italic

**Player-written notes (personal):**
- Left border: brighter amber `rgba(196,148,58,.72)`
- Label: "Personal entry" (Fantasy) / "PRIV_LOG" (Cyberpunk) / "personal" (Horror) / "PERSONAL" (Space) / "NOTE" (Post-Apoc)
- Text: `#ceaf78` Georgia italic (warmer, slightly brighter — feels more personal)
- Slightly warmer card background

**Write-a-note flow:**
- Triggered by "Write a note" button (always at bottom of journal list)
- Minimal: day label auto-filled, large text area, "Save note" + "Discard" only
- No title, no tags, no formatting tools
- Saved note appears at top of current day section immediately

**Day section headers:** Simple, same pattern as Codex event headers. Genre-specific date language:
- Fantasy: "— Day the Third —"
- Cyberpunk: "// DAY_03 ///"
- Horror: "third night" (lowercase)
- Space: "◈ CYCLE 3 · HUSHEND SECTOR"
- Post-Apoc: "DAY 3 //"

---

## 13. Implementation Notes for Claude Code

- **Genre class on root container** — apply `genre-X` to the game root; all styling cascades. Never apply genre overrides per-component.
- **CSS custom properties** — define all card/content variables at the genre class level; components consume `var()` references.
- **Three overlay divs** — every scrollable content area needs `.ol-scan`, `.ol-grid`, `.ol-tex` divs (absolute, inset: 0, pointer-events: none, z-index: 2). Genre CSS shows exactly one or two per genre.
- **All maps use HTML5 Canvas** — never SVG.
- **LLM stream is the typewriter** — display tokens as they arrive, no buffering.
- **Combat visual effects fire at fixed times** — 400ms after action, not on LLM completion.
- **Stat/roll system is always probabilistic** — never reject an attempt at UI level.
- **NPC dialogue: exactly 4 content slots + 1 persistent end button** — end button is structurally outside the slots.
- **Portrait zones on combat cards have fixed pixel dimensions** — art drops in as background image, layout does not reflow.
- **Tabler icon names in Section 9 are verified** — use exactly those names.
- **Never change narrative prose font** — Georgia italic throughout, all genres. Only labels and UI chrome change typeface per genre.
- **Observation options always tappable** — failed observation gives vaguer result, never hard-locked.
- **Notable mark (◈) is never automatic** — only AI-flagged or player-starred entries get it.
