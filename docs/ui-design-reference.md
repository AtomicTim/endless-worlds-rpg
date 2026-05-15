# Endless Worlds RPG — UI Design Reference

**Version:** 2.4  
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
|-------|--------|--------|--------|---|
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
|-------|--------------------|--------------------|
| Fantasy | Georgia italic, `font-style: italic`, `text-transform: none`, `letter-spacing: .04em` | Georgia italic (unchanged) |
| Cyberpunk | `"Courier New", monospace`, `font-style: normal`, wider `letter-spacing` | Georgia italic (unchanged) |
| Horror | System sans-serif, `font-size: 6.5px`, minimal `letter-spacing` | Georgia italic (unchanged) |
| Space Opera | `system-ui, sans-serif`, `font-style: normal`, `letter-spacing: .14–.18em` | Georgia italic (unchanged) |
| Post-Apoc | System sans-serif, `letter-spacing: .18–.22em`, `font-size: 6.5px` | Georgia italic (unchanged) |

**Critical rule:** Narrative prose always uses Georgia serif italic regardless of genre. Only labels, section headers, and UI chrome change typeface. Changing prose fonts would require retroactive changes across the entire UI.

### Text Glow Per Genre

| Genre | Glow |
|-------|------|
| Fantasy | None — warmth comes from colour, not glow |
| Cyberpunk | `text-shadow: 0 0 8px rgba(34,211,238,.28)` on key text; `0 0 10px` on accent text |
| Horror | None — oppressive flatness is intentional |
| Space Opera | `text-shadow: 0 0 6px rgba(168,85,247,.2)` on prose; `0 0 8px` on accent text |
| Post-Apoc | None |

### Surfaces Requiring Genre Treatment

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
- Character sheet stat block, equipment slots, pack items

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

**Character Panel (right):** Fixed 196px column. Scrollable. Contains: portrait + identity, HP/XP bars, status effects, attribute block, equipped items + gold, pack inventory. See Section 13 for full spec.

**Story Feed (centre):** The primary play surface. Top-down scroll. Story text, navigation cards, NPC dialogue, combat — all live here.

### Mobile (Single Column)

Story feed fills the screen. Navigation cards appear below story text. Combat panel anchors to bottom. Character sheet accessible via the character pill in the top bar (slides in as a right-side drawer, same content as the desktop panel). Context accessible via sidebar drawer.

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

Checks are **never hard gates — always probability-based.**
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
- **People tab:** Section headers by region/settlement
- **Places tab:** Section headers by region or parent location
- **Lore tab:** Section headers by category (Historical, Political, Spiritual, Factional)
- **Events tab:** Section headers by day (chronological, day markers)

Headers are **section dividers, not accordion groups.** No extra taps required.

### Notable Mark (◈)
Only appears when AI flags as plot-critical OR player manually stars it. Small `◈` mark in genre accent, top-right. Not a badge.

### NEW Badge
Appears on unread entries. Clears on open. Codex icon in top bar shows a dot while unread entries exist.

### Related Entries
Each entry cross-links to related entries. Tapping navigates to that entry. Shown in detail view as a tappable list with type icons.

### Discovery Ceremony — Two-Layer Notification

When a new entry is added to the Codex, two things happen simultaneously:

**1. Story feed inline entry** — a small card appears in the narrative scroll at the exact point of discovery:
- Type icon + "Added to Codex · [Type]" label in genre accent
- Entry name (medium weight)
- Role/location sub-label
- "View in Codex →" link
- Fades in: `opacity 0→1, translateY 6px→0, 300ms ease`

**2. Toast at the bottom** — same amber toast as before: "Added to Codex: [Name]" (3.5s). Fires simultaneously with the feed entry.

The feed entry is the canonical discovery moment (it stays in the narrative scroll permanently). The toast is the notification affordance for players not looking at the feed.

---

## 12. Journal & Quests

### Layout
Quests and Journal share one nav button, two tabs inside. Screen title: "Chronicle".

### Quests Tab

**Section headers:** Active (with count) · Completed · Failed

**Quest card shows:** Quest name · `◈` if main quest · Source + day · 2-line description · **Current objective** (most actionable info, visible without opening detail)

**Quest detail shows:** Status badge · Full narrative description · Objectives list (narrative-language, NOT checkbox list; completed: dim + strikethrough) · Related Codex entries

### Journal Tab

**Auto-logged (game's voice):**
- Left border: muted amber `rgba(196,148,58,.38)`
- Label: "Chronicle" (Fantasy) / "SYS_LOG" (Cyberpunk) / "case notes" (Horror) / "SHIP LOG" (Space) / "LOG" (Post-Apoc)
- Text: `#b0956a` Georgia italic

**Player-written notes (personal):**
- Left border: brighter amber `rgba(196,148,58,.72)`
- Label: "Personal entry" (Fantasy) / "PRIV_LOG" (Cyberpunk) / "personal" (Horror) / "PERSONAL" (Space) / "NOTE" (Post-Apoc)
- Text: `#ceaf78` Georgia italic (warmer, slightly brighter)
- Slightly warmer card background

**Write-a-note flow:** Triggered by button at bottom. Minimal: auto-filled day label, text area, Save + Discard only. No title, no tags, no formatting tools.

**Day section headers:** Genre-specific date language:
- Fantasy: "— Day the Third —"
- Cyberpunk: "// DAY_03 ///"
- Horror: "third night" (lowercase)
- Space: "◈ CYCLE 3 · HUSHEND SECTOR"
- Post-Apoc: "DAY 3 //"

---

## 13. Character Sheet Panel

The character sheet is the right panel on desktop (fixed, always visible, 196px wide, scrollable) and a slide-in drawer on mobile. It must be dense but instantly scannable.

**The character sheet does NOT duplicate the Journal.** It shows mechanical state only. Story beats live in the Journal/Chronicle screen exclusively.

### Content Sections (top to bottom)

**1. Portrait + Identity**
- 48px avatar circle with class icon (Tabler icon, genre accent colour, genre-styled border)
- Character name: 13px, medium weight
- Class + Level: 8.5px Georgia italic, muted

**2. HP Bar**
- 8px tall, fat bar — the most prominent element after the name
- Same colour-state system as combat HP bars (same thresholds, same colours)
- `transition: width 300ms ease, background-color 400ms ease`
- Shows `28 / 42` value right-aligned; flashes red on damage, green on heal
- At ≤10%: CSS pulse animation

**3. XP Bar**
- 3px tall, thin — clearly secondary to HP
- Single colour: genre accent
- Level-up sequence: bar fills to 100% (400ms ease) → pause → level number flashes (scale 1→1.4→1, 600ms) → bar resets, level increments, max HP increases slightly

**4. Status Effects**
- Hidden entirely when no effects active (max-height: 0, no dead space)
- Slides open (max-height: 50px, 300ms ease) when effect applied
- Each effect: small pill badge using damage-type colour system

**5. Attribute Block — Single Inline Row**
All five stats in one horizontal row. No grid, no empty cells ever.

```
[STR 8] [AGI 9] [INT 13] [PER 11] [CHA 10]
```

Each cell: number (15–18px, neutral warm `#cbb888` — same for all stats, NOT colour-coded per stat), label below (6px, muted, uppercase). Subtle same-tone border. Classic D&D feel.

Genre overrides the neutral number colour (teal for Horror, purple for Space) but stats are NEVER individually colour-coded by type.

**6. Equipped Items + Gold (combined section)**
Section header: "EQUIPPED" left-aligned, gold/currency amount right-aligned in genre accent.

Three slots, all always shown — never hidden even when empty:
- Weapon slot
- Armour slot
- Accessory slot (ring, necklace, trinket)

Empty slot: slot-type icon at ~25% opacity, "— empty" in dim italic, slot label.

**7. Pack Inventory**
Section header: "Pack · N / 8"

3-column compact grid. Each cell: 13px icon, 6px abbreviated name below, count badge top-right (only if count > 1).

**No empty placeholder cells.** The grid only renders actual items.

### Animation Summary

| Event | Animation |
|-------|-----------|
| HP damage | Bar shrinks (300ms ease), value flashes red |
| HP heal | Bar grows (300ms ease), value flashes green |
| HP critical (≤10%) | Bar pulses continuously |
| XP gain | Bar fills (400ms ease) |
| Level up | Bar → 100% → pause → level flash → bar resets |
| Status effect added | Section slides open (max-height 300ms ease) |
| Gold change | Value flashes green (gain) or red (spend) |
| Mobile drawer open | Slides in from right, 300ms ease-out, backdrop fades in |
| Mobile drawer close | Slides out right, 250ms ease-in |

### Genre-Specific Currency

| Genre | Currency | Icon |
|-------|----------|------|
| Fantasy | gold | `ti-coins` |
| Cyberpunk | cred | `ti-cpu` |
| Horror | supplies | `ti-backpack` |
| Space Opera | credits | `ti-coin` |
| Post-Apoc | scrap | `ti-tool` |

---

## 14. Transitions & Micro-Interactions

### Combat Entry

Triggered when an enemy encounter begins (AI narrates the enemy appearing).

**Sequence:**
1. Story feed narrates the encounter (streams in as normal)
2. Navigation cards fade out — `opacity 0, 180ms ease` — simultaneously with step 3
3. Combat panel rises — **flex height 0 → 188px**, `380ms cubic-bezier(0.22, 1, 0.36, 1)` (spring ease-out). NOT an overlay — the combat panel is a flex item that pushes the story feed up. Nothing is hidden behind it.
4. Player combatant card appears — `opacity 0→1, translateY 10px→0, 220ms ease-out`
5. Enemy card(s) appear — 80ms stagger after player card, same animation
6. Turn badge fades in — `opacity 0→1, 150ms ease`, 100ms after last card

During combat: input bar remains but placeholder changes. Nav cards are hidden (zero opacity, pointer-events none).

### Combat Exit — Victory

**Sequence:**
1. Kill shot: enemy card `filter: grayscale(1) brightness(.45)`, `400ms ease`
2. Kill shot compress: card collapses — `scaleY(0)` + `height→0`, `300ms ease`
3. Combat panel closes — height → 0, `300ms ease-in`, 750ms after kill shot starts
4. Nav cards return — `opacity 0→1, 200ms ease`
5. Victory card appears in story feed — `opacity 0→1, 250ms ease-out`, 1100ms after kill shot

**Victory card** is a permanent part of the story feed — not a modal, not a popup. Contains:
- "Combat resolved" header with green check-circle icon
- **XP gained only** — gold is NOT shown here. Looting requires the player to tap a "Search" button that appears below the victory card. This is a deliberate design choice: loot is earned through an explicit action, not automatically awarded.
- Thin XP progress bar filling over 600ms (showing level progress)
- Post-combat AI-generated prose line
- "Search the remains →" prompt at the bottom of the card, triggering the loot flow

After the victory card appears, the AI continues streaming the next narrative beat below it naturally.

### Combat Exit — Defeat

If player HP hits 0:
- HP bar pulses red (existing ≤10% animation)
- Screen dims (backdrop `rgba(0,0,0,.6)`, `400ms ease`)
- Defeat panel slides up (same spring as combat entry, ~120px)
- Content: "You have fallen." · Options: Respawn at last safe point / Retry combat / Abandon run
- These are permanent save-state decisions — confirm before executing

### Modal Events

Some game milestones require explicit player acknowledgement before continuing. These use a full backdrop overlay (`rgba(0,0,0,.82)`, `300ms ease`) with a centered modal card.

**Modal entry:** `scale(0.88) → scale(1)` + `opacity 0→1`, `420ms cubic-bezier(0.22, 1, 0.36, 1)` — spring scale-in feels physical and premium.

**Modal exit:** Backdrop fades out `300ms ease`. Player action (Continue / Confirm / close) always required before the game resumes. Never auto-dismiss.

---

#### Quest Complete Modal

Appears when a quest moves to the Completed state. Uses green visual language to distinguish from amber combat/codex language.

**Structure:**
- 44px green circle with check icon, centred at top
- "Quest Complete" label in small caps, green `#5a9a5a`
- Quest name: 16px Georgia italic, prominent
- 2–3 sentence narrative summary of what was accomplished
- Thin divider
- XP reward: large number + "XP" label
- "Continue →" button (green border/tint)

The modal is the canonical completion moment. After dismissal, the quest moves to the Completed section in the Chronicle and a brief toast fires: "Quest complete · [Name]" in green.

---

#### Level Up Modal

The most important moment in the game loop. Must feel genuinely rewarding — this is the primary dopamine beat the entire session is building toward.

**Structure:**

1. **Header (ambient glow)**
   - "✦ Level Up ✦" text in genre accent with pulsing `text-shadow` glow animation (2s loop)
   - A radial gradient behind the level number (`rgba(accent, .22)`, 130px × 90px ellipse)
   - Previous level → new level: `"4 → 5"` displayed as small grey `4 →` followed by large prominent `5` (52px, Georgia, `#e8d5b0`)
   - Class name in muted small caps below

2. **Divider**

3. **Stat picker** — single inline row of 5 stat cards (same inline layout as character sheet)

   Each card shows (top to bottom):
   - `+1` badge: top-right corner, genre accent, hidden until card is selected
   - Current value: 17px, neutral warm, transitions to accent on selection
   - Stat name: 6px uppercase label
   - Two-word description: 5.5px, very muted, two lines stacked

   **Stat descriptions:**
   | Stat | Description |
   |------|-------------|
   | STR | Melee · Carry |
   | AGI | Dodge · Flee |
   | INT | Magic · Lore |
   | PER | Detect · Scout |
   | CHA | Speech · Trade |

   **Selected state:** amber border glow, amber background tint, `+1` badge appears, number colour transitions to genre accent, description brightens slightly.

4. **Confirm button** — disabled and muted until a stat is selected. Once selected:
   - Enables with amber border + background
   - Button text updates dynamically: "INT: 13 → 14" (shows the specific upgrade)
   - Arrow icon fades in at right

5. **On confirm:**
   - Selected stat card flares (brighter border + glow, `480ms`)
   - Modal closes after 480ms
   - Toast fires: "Level 5 · INT 14 · +4 Max HP" in bright gold
   - Character sheet updates: XP bar resets, level number flashes, stat increments

**Animation:**
- Backdrop: `rgba(0,0,0,.82)` — darker than quest modal, more dramatic
- Modal entry: `scale(0.88) → scale(1)`, `420ms cubic-bezier(0.22, 1, 0.36, 1)`
- "✦ Level Up ✦" glow pulse: `2s ease-in-out infinite`, alternates between `text-shadow: 0 0 12px` and `0 0 26px` with outer spread

---

### Toast Notification System

Toasts appear at the **bottom of the screen, just above the input bar** (`bottom: 50px`, `z-index: 30`).

**Timing:**
- Entry: `translateY(18px) → translateY(0)` + `opacity 0→1`, `250ms cubic-bezier(0.22, 1, 0.36, 1)`
- Persist: 3.5 seconds (4s for level-up toast)
- Exit: `opacity 1→0` + `translateY(0→10px)`, `200ms ease-in`

**Four toast types:**

| Type | Colour | Icon | Use case |
|------|--------|------|----------|
| Codex discovery | `#c4943a` amber | `ti-book` | Fires alongside the story feed entry |
| Quest complete | `#5a9a5a` green | `ti-circle-check` | Fires after the quest modal is dismissed |
| Level up | `#e8d070` bright gold | `ti-arrow-up-circle` | Fires after the level up modal is confirmed |
| Combat result | `#7abb7a` green | `ti-shield-check` | XP summary after victory card appears |

Level-up toast fires simultaneously with the character sheet XP bar animation. A level-up triggers character sheet animations regardless of whether the sheet is open.

If multiple toasts queue simultaneously, they stack vertically (5px gap, newest on top). Maximum 2 visible at once — third queues.

### Screen Transitions

**Desktop — Replace center column:**
Codex, Map, Journal, Chronicle all replace the center panel content. Left and right panels remain. Top bar breadcrumb updates. No slide — content fades: `opacity 0→1, 200ms ease`.

**Mobile — Full-screen slide:**
- Open: `translateX(100%) → translateX(0)`, `300ms cubic-bezier(0.22, 1, 0.36, 1)`. Backdrop fades in simultaneously.
- Close: `300ms ease-in` reverse. Back button or swipe-right to dismiss.
- The game behind the overlay does NOT move (content-over-content, not push-navigation)

**Tab switching within a screen** (Quests↔Journal, Codex tabs):
- `opacity 0→1, 150ms ease` only. No slide. Fast.

**Character sheet drawer (mobile):**
- Open: slides from right, `300ms cubic-bezier(0.22, 1, 0.36, 1)`. Backdrop `rgba(0,0,0,.5)` fades in.
- Close: `250ms ease-in`. Tapping backdrop closes.

### Master Timing Reference

| Interaction | Duration | Easing |
|-------------|----------|--------|
| Combat panel open | 380ms | `cubic-bezier(0.22, 1, 0.36, 1)` |
| Combat panel close | 300ms | `ease-in` |
| Combatant card appear | 220ms | `ease-out` |
| Card stagger delay | 80ms | — |
| Kill shot greyscale | 400ms | `ease` |
| Kill shot compress | 300ms | `ease` |
| Nav cards fade | 180ms | `ease` |
| Victory card appear | 250ms | `ease-out` |
| HP bar change | 300ms | `ease` |
| HP colour change | 400ms | `ease` |
| XP bar fill | 400ms | `ease` |
| Level number flash | 600ms | `ease` |
| Status effect slide | 300ms | `ease` |
| Modal backdrop in | 300ms | `ease` |
| Modal card scale-in | 420ms | `cubic-bezier(0.22, 1, 0.36, 1)` |
| Modal backdrop out | 300ms | `ease` |
| Level-up glow pulse | 2000ms | `ease-in-out infinite` |
| Stat card confirm flare | 480ms | `ease` |
| Toast enter | 250ms | `cubic-bezier(0.22, 1, 0.36, 1)` |
| Toast persist (standard) | 3500ms | — |
| Toast persist (level-up) | 4000ms | — |
| Toast exit | 200ms | `ease-in` |
| Mobile screen open | 300ms | `cubic-bezier(0.22, 1, 0.36, 1)` |
| Mobile screen close | 250ms | `ease-in` |
| Tab switch | 150ms | `ease` |
| Desktop center swap | 200ms | `ease` |

---

## 15. Implementation Notes for Claude Code

- **Genre class on root container** — apply `genre-X` to the game root; all styling cascades. Never apply genre overrides per-component.
- **CSS custom properties** — define all card/content variables at the genre class level; components consume `var()` references.
- **Three overlay divs** — every scrollable content area needs `.ol-scan`, `.ol-grid`, `.ol-tex` divs (absolute, inset: 0, pointer-events: none, z-index: 2). Genre CSS shows exactly one or two per genre.
- **All maps use HTML5 Canvas** — never SVG.
- **LLM stream is the typewriter** — display tokens as they arrive, no buffering.
- **Combat visual effects fire at fixed times** — 400ms after action, not on LLM completion.
- **Combat panel is a flex item, not an overlay** — it pushes the story feed up as it opens. Height 0 → 188px, `380ms cubic-bezier(0.22, 1, 0.36, 1)`.
- **Victory card shows XP only — no gold** — gold is awarded through the explicit "Search" loot flow, not automatically on kill. The victory card includes a "Search the remains →" prompt.
- **Victory card lives in the story feed permanently** — not a modal. The feed continues below it.
- **Codex discovery fires two notifications simultaneously** — an inline feed entry card AND a toast. Both are required.
- **Quest complete uses a modal** — not just a toast. The modal must be dismissed before the game resumes. Toast fires after dismissal.
- **Level up uses a full modal with stat picker** — the player must select one stat to increase and confirm before the modal closes. The confirm button is disabled until a stat is selected and updates its label dynamically to show the specific upgrade (e.g., "INT: 13 → 14"). Never auto-select.
- **Level up modal backdrop is darker** — `rgba(0,0,0,.82)` vs `rgba(0,0,0,.72)` for other modals. The moment deserves more gravity.
- **Stat descriptions in level up picker** — each stat card shows two brief descriptors stacked (e.g., "Magic · Lore" for INT). These help new players make informed choices.
- **Stat/roll system is always probabilistic** — never reject an attempt at UI level.
- **NPC dialogue: exactly 4 content slots + 1 persistent end button** — end button is structurally outside the slots.
- **Portrait zones on combat cards have fixed pixel dimensions** — art drops in as background image, layout does not reflow.
- **Tabler icon names in Section 9 are verified** — use exactly those names.
- **Never change narrative prose font** — Georgia italic throughout, all genres. Only labels and UI chrome change typeface per genre.
- **Observation options always tappable** — failed observation gives vaguer result, never hard-locked.
- **Notable mark (◈) is never automatic** — only AI-flagged or player-starred entries get it.
- **Character sheet stat block is a single inline row** — five cells in one horizontal row, no grid, no empty slots ever possible.
- **All three equipment slots always rendered** — Weapon, Armour, Accessory shown whether filled or empty. Empty state uses dim icon + "— empty" label.
- **Pack grid shows only actual items** — no empty placeholder cells. Capacity in section header.
- **Character sheet has no story content** — Journal/Chronicle is the canonical record of narrative events.
- **Toast z-index: 30** — always on top of combat panel (z-index: 10) and overlays.
- **Use `requestAnimationFrame` double-frame trick for CSS transitions on dynamically inserted elements** — set element, then two rAF calls, then add the transition class. Direct class add after insertion won't animate.
