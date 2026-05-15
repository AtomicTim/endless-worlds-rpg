# Endless Worlds RPG — UI Design Reference

**Version:** 3.0  
**Status:** Design complete — all primary surfaces specced  
**Covers:** All designed UI surfaces as of May 2026

---

## 1. Design Philosophy

**The guiding aesthetic:** "Snappy, clean, modern game feel with aesthetics of classic D&D/RPG games that invoke wonder."

- Dark and warm, never cold or sterile
- Amber gold is the only saturated accent colour in the Fantasy genre — all other colours are muted, warm darks. This makes the accent feel precious and meaningful
- Cormorant Garamond serif for all narrative text (prose, NPC speech, item descriptions)
- Inter Tight for all UI chrome (labels, badges, buttons, stats)
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
Main menu background:  #08060a  (coolest/darkest — outside game)

Border default:        #2d2618
Border subtle:         #252018
Border strong:         #3a3020

Story prose:           #c0a878  (Cormorant Garamond, warm amber)
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

All three fonts are already loaded in the existing codebase. Use exact font names as specified.

```
Narrative prose:     'Cormorant Garamond', Georgia, serif
                     italic, 13–15px, line-height 1.78–1.82, colour #c0a878

NPC speech:          'Cormorant Garamond', Georgia, serif
                     italic, 13px, genre accent colour, weight 500

UI labels / chrome:  'Inter Tight', system-ui, sans-serif
                     7–9px, letter-spacing 0.1–0.18em, uppercase

Button labels:       'Inter Tight', system-ui, sans-serif
                     8–9px, uppercase, letter-spacing 0.12em

Stat numbers / dice: 'JetBrains Mono', monospace
                     tabular-nums, for anything numeric
```

Georgia and system-ui are fallbacks only. Cormorant Garamond, Inter Tight, and JetBrains Mono are always available in this codebase.

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
| Fantasy | Inter Tight italic, `letter-spacing: .04em` | Cormorant Garamond italic (unchanged) |
| Cyberpunk | `"Courier New", monospace`, `font-style: normal`, wider `letter-spacing` | Cormorant Garamond italic (unchanged) |
| Horror | Inter Tight, `font-size: 6.5px`, minimal `letter-spacing` | Cormorant Garamond italic (unchanged) |
| Space Opera | Inter Tight, `font-style: normal`, `letter-spacing: .14–.18em` | Cormorant Garamond italic (unchanged) |
| Post-Apoc | Inter Tight, `letter-spacing: .18–.22em`, `font-size: 6.5px` | Cormorant Garamond italic (unchanged) |

**Critical rule:** Narrative prose always uses Cormorant Garamond serif italic regardless of genre. Only labels, section headers, and UI chrome change typeface. Changing prose fonts would require retroactive changes across the entire UI.

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
- Context Panel

**Surfaces that need card shape treatment:**
- Story feed navigation cards
- Combat combatant cards, action buttons
- NPC dialogue option cards, NPC header card
- Codex entry cards
- Journal entry cards, quest cards
- Loading state new-area entry card
- Character sheet stat block, equipment slots, pack items
- Context Panel NPC and object rows

**Surfaces already genre-specific (no additional work needed):**
- Maps — handled via Canvas rendering, already fully genre-specific
- Character creation wizard — genre cards and class cards already themed; inherits genre class naturally
- Top bar — always dark chrome, genre accent only in logo mark and genre tag pill
- Main menu — uses neutral amber regardless of genre (no active game loaded)

---

## 4. Layout

### Desktop (3-Panel)

```
[Left: Context Panel] [Center: Story Feed] [Right: Character Panel]
```

**Context Panel (left):** Always-visible current location summary. 196px at ≥1280px, 160px at 1024–1279px. See Section 18 for full spec.

**Character Panel (right):** Same widths as Context Panel. Scrollable. See Section 13 for full spec.

**Story Feed (centre):** The primary play surface. Top-down scroll. Story text, navigation cards, NPC dialogue, combat — all live here.

**Top bar:** Runs full-width above all three panels. See Section 17 for full spec.

### Responsive Breakpoints

| Viewport | Layout |
|----------|--------|
| ≥ 1280px | Full 3-panel: Context Panel 196px + story feed + Character Panel 196px |
| 1024px – 1279px | Narrow 3-panel: Context Panel 160px + story feed + Character Panel 160px. Story feed ~680px minimum. |
| 768px – 1023px | Single column. Both sidebars become drawers. Story feed fills full width. |
| < 768px | Full mobile — identical behaviour to 768–1023px range. |

**Sidebar drawer behaviour at ≤1023px:**
- Context Panel: hamburger icon (`ti-menu-2`) in top bar, left side. Opens as left drawer: `translateX(-100%) → translateX(0)`, `300ms cubic-bezier(0.22, 1, 0.36, 1)`. Backdrop `rgba(0,0,0,.5)`. Tapping backdrop or swiping left closes (`250ms ease-in`).
- Character Panel: character pill in top bar. Opens as right drawer (already specced in Section 13).

### Mobile Navigation

No bottom tab bar. All navigation lives in the top bar. The story feed fills every available pixel — a bottom nav permanently sacrifices vertical space better used for narrative.

**Mobile top bar element order (left to right):**
1. Hamburger (`ti-menu-2`) — opens Context Panel left drawer
2. Logo: "✦ Endless Worlds" — Cormorant Garamond italic, genre accent
3. [flex spacer]
4. Codex icon (`ti-book`)
5. Journal icon (`ti-notebook`)
6. Map icon (`ti-map`)
7. Character pill — avatar circle + name, opens Character Panel right drawer

All icons have 44px minimum tap targets (visual icon can be smaller; hit area pads to 44px).

**Mobile top bar height:** 52px (vs 44px desktop).

---

## 5. Story Panel

### Text Display

- Font: `'Cormorant Garamond', Georgia, serif`, italic, 14–15px, line-height 1.82, colour `#c0a878`
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
4. Top bar location breadcrumb updates immediately

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

- **Narrative:** Cormorant Garamond italic, `#b0956a`, 1.78 line-height
- **NPC speech:** Speaker label (uppercase Inter Tight, genre accent) + `#f0c060` italic Cormorant Garamond + streaming cursor
- **Player chosen line:** Left-bordered quote block `#c0a878`
- **Observation event:** Teal left border `rgba(64,152,136,.28)`, "PERCEPTION" label + eye icon, `#a0c8b8` text
- **Dice result:** `[dice] 14 vs 11 · hit` inline in feed — JetBrains Mono, same format as combat log

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

**2. Toast at the bottom** — amber toast: "Added to Codex: [Name]" (3.5s). Fires simultaneously with the feed entry.

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
- Text: `#b0956a` Cormorant Garamond italic

**Player-written notes (personal):**
- Left border: brighter amber `rgba(196,148,58,.72)`
- Label: "Personal entry" (Fantasy) / "PRIV_LOG" (Cyberpunk) / "personal" (Horror) / "PERSONAL" (Space) / "NOTE" (Post-Apoc)
- Text: `#ceaf78` Cormorant Garamond italic (warmer, slightly brighter)
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

The character sheet is the right panel on desktop (fixed, always visible, scrollable) and a slide-in drawer on mobile. It must be dense but instantly scannable.

**The character sheet does NOT duplicate the Journal.** It shows mechanical state only. Story beats live in the Journal/Chronicle screen exclusively.

### Content Sections (top to bottom)

**1. Portrait + Identity**
- 48px avatar circle with class icon (Tabler icon, genre accent colour, genre-styled border)
- Character name: 13px, medium weight, Inter Tight
- Class + Level: 8.5px Cormorant Garamond italic, muted

**2. HP Bar**
- 8px tall, fat bar — the most prominent element after the name
- Same colour-state system as combat HP bars (same thresholds, same colours)
- `transition: width 300ms ease, background-color 400ms ease`
- Shows `28 / 42` value right-aligned in JetBrains Mono; flashes red on damage, green on heal
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

Each cell: number (15–18px, JetBrains Mono, neutral warm `#cbb888` — same for all stats, NOT colour-coded per stat), label below (6px Inter Tight, muted, uppercase). Subtle same-tone border.

Genre overrides the neutral number colour (teal for Horror, purple for Space) but stats are NEVER individually colour-coded by type.

**6. Equipped Items + Gold (combined section)**
Section header: "EQUIPPED" left-aligned, gold/currency amount right-aligned in genre accent.

Three slots, all always shown — never hidden even when empty:
- Weapon slot · Armour slot · Accessory slot

Empty slot: slot-type icon at ~25% opacity, "— empty" in dim italic Cormorant Garamond, slot label.

**7. Pack Inventory**
Section header: "Pack · N / 8"

3-column compact grid. Each cell: 13px icon, 6px abbreviated name below, count badge top-right (only if count > 1). No empty placeholder cells.

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

**Sequence:**
1. Story feed narrates the encounter (streams in as normal)
2. Navigation cards fade out — `opacity 0, 180ms ease` — simultaneously with step 3
3. Combat panel rises — **flex height 0 → 188px**, `380ms cubic-bezier(0.22, 1, 0.36, 1)`. NOT an overlay — flex item that pushes story feed up.
4. Player card appears — `opacity 0→1, translateY 10px→0, 220ms ease-out`
5. Enemy card(s) appear — 80ms stagger, same animation
6. Turn badge fades in — `opacity 0→1, 150ms ease`, 100ms after last card

### Combat Exit — Victory

**Sequence:**
1. Kill shot: enemy card `filter: grayscale(1) brightness(.45)`, `400ms ease`
2. Compress: `scaleY(0)` + `height→0`, `300ms ease`
3. Combat panel closes — height → 0, `300ms ease-in`, 750ms after kill shot
4. Nav cards return — `opacity 0→1, 200ms ease`
5. Victory card in story feed — `opacity 0→1, 250ms ease-out`, 1100ms after kill shot

**Victory card** — permanent in story feed, not a modal. Contains: XP only (no gold — gold comes from "Search" loot flow), XP progress bar (fills 600ms), post-combat prose, "Search the remains →" prompt.

### Combat Exit — Defeat

HP hits 0 → screen dims (backdrop `rgba(0,0,0,.6)`, `400ms`) → defeat panel slides up (~120px, same spring) → "You have fallen." · options require confirm before executing.

### Modal Events

Backdrop: `rgba(0,0,0,.82)`, `300ms ease`. Modal card: `scale(0.88) → scale(1)` + `opacity 0→1`, `420ms cubic-bezier(0.22, 1, 0.36, 1)`. Always requires player action to dismiss.

#### Quest Complete Modal

Green visual language. Structure: check circle icon · "Quest Complete" · quest name (16px Cormorant Garamond italic) · 2–3 sentence narrative summary · divider · XP reward · "Continue →". Toast fires after dismissal.

#### Level Up Modal

The most important moment in the game loop.

1. **Header:** "✦ Level Up ✦" with pulsing glow (2s loop) · ambient radial gradient · `4 → 5` level display (52px Cormorant Garamond) · class name
2. **Divider**
3. **Stat picker** — single inline row, 5 cards. Each card: `+1` badge (hidden until selected) · value (17px JetBrains Mono) · stat name · two-word description (stacked)

   | Stat | Description |
   |------|-------------|
   | STR | Melee · Carry |
   | AGI | Dodge · Flee |
   | INT | Magic · Lore |
   | PER | Detect · Scout |
   | CHA | Speech · Trade |

4. **Confirm button** — disabled until selection. Button text updates: "INT: 13 → 14". Arrow icon fades in. On confirm: stat flares (480ms) → modal closes → toast fires → character sheet updates.

Backdrop: `rgba(0,0,0,.82)` (darker than quest modal).

### Toast Notification System

`bottom: 50px`, `z-index: 30`. Entry: `translateY(18px→0)` + `opacity 0→1`, `250ms cubic-bezier(0.22, 1, 0.36, 1)`. Persist: 3.5s (4s level-up). Exit: `opacity 0` + `translateY(10px)`, `200ms ease-in`. Stack vertically, max 2 visible.

| Type | Colour | Icon |
|------|--------|------|
| Codex discovery | `#c4943a` amber | `ti-book` |
| Quest complete | `#5a9a5a` green | `ti-circle-check` |
| Level up | `#e8d070` bright gold | `ti-arrow-up-circle` |
| Combat result | `#7abb7a` green | `ti-shield-check` |

### Screen Transitions

**Desktop:** Center column content fades `opacity 0→1, 200ms ease`. Left and right panels remain.

**Mobile:** `translateX(100%)→translateX(0)`, `300ms cubic-bezier(0.22, 1, 0.36, 1)`. Backdrop fades. Content-over-content (game doesn't move behind overlay).

**Tab switching within a screen:** `opacity 0→1, 150ms ease` only.

**Context Panel drawer (mobile):** `translateX(-100%)→translateX(0)`, `300ms cubic-bezier(0.22, 1, 0.36, 1)`. Backdrop `rgba(0,0,0,.5)`. Close: `250ms ease-in`.

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
| Context Panel drawer open | 300ms | `cubic-bezier(0.22, 1, 0.36, 1)` |
| Context Panel drawer close | 250ms | `ease-in` |

---

## 15. Implementation Notes for Claude Code

- **Font stack is authoritative** — Cormorant Garamond for prose/narrative, Inter Tight for UI chrome, JetBrains Mono for numbers. All three are already loaded. Never substitute system fonts.
- **Fantasy accent colour is `#c4943a`** — update `--g-fantasy` and CLAUDE.md tech stack table from `#f59e0b`. Single variable change.
- **Genre class on root container** — apply `genre-X` to the game root; all styling cascades.
- **Three overlay divs** — every scrollable content area (including Context Panel) needs `.ol-scan`, `.ol-grid`, `.ol-tex` divs (absolute, inset: 0, pointer-events: none, z-index: 2).
- **All maps use HTML5 Canvas** — never SVG.
- **LLM stream is the typewriter** — display tokens as they arrive, no buffering.
- **Combat visual effects fire at fixed times** — 400ms after action, not on LLM completion.
- **Combat panel is a flex item, not an overlay** — height 0 → 188px. Refactor existing bottom-strip.
- **Victory card shows XP only** — no gold. "Search the remains →" prompt triggers loot flow.
- **Codex discovery fires two notifications simultaneously** — inline feed entry card AND toast.
- **Quest complete uses a modal** — toast fires after dismissal.
- **Level up modal with stat picker** — confirm button disabled until stat selected, label updates dynamically. Never auto-select.
- **Stat descriptions in level up picker** — two-word stacked descriptors per stat.
- **LevelUpModal already exists** (CLAUDE.md rule 90) — redesign it, don't replace it.
- **Story Feed Colors token system in CLAUDE.md is untouchable** — highlight tokens (`--hl-region`, `--hl-loc`, etc.) coexist with this doc's prose styling. Never overwrite them.
- **Nav card group names** — BACK/DEEPER/PEER/UNDISCOVERED logic stays; only presentation changes to plain English directional labels.
- **NPC dialogue: exactly 4 content slots + 1 persistent end button** — end button outside the slots.
- **Portrait zones on combat cards: fixed pixel dimensions** — art drops in as background image.
- **Tabler icons in Section 9 are verified** — use exactly those names.
- **Prose font never changes** — Cormorant Garamond italic regardless of genre.
- **Observation options always tappable** — failed = vaguer result, never locked.
- **Notable mark (◈) never automatic** — only AI-flagged or player-starred.
- **Character sheet stat block: single inline row** — five cells, no grid, never empty.
- **All three equipment slots always rendered** — empty = dim icon + "— empty".
- **Pack grid: actual items only** — no empty placeholders.
- **Character sheet has no story content** — Journal/Chronicle only.
- **Toast z-index: 30** — above combat panel (z-index: 10).
- **`requestAnimationFrame` double-frame trick** for CSS transitions on dynamically inserted elements.
- **Top bar hidden on main menu and character creation** — appears only when game begins.
- **Context Panel updates from game state** — no LLM call needed on arrival.
- **Main menu background `#08060a`** — distinct from in-game dark backgrounds.
- **Enter World transition = World Intro Cinematic Modal** (CLAUDE.md rule 42) — don't design a separate transition.

---

## 16. Notes & Considerations for Implementation Planning

*This section is for Claude.ai review when planning Claude Code prompts.*

---

### Resolved Decisions

- **Fantasy accent:** `#c4943a` (update `#f59e0b` in existing codebase — single variable)
- **Font stack:** Cormorant Garamond / Inter Tight / JetBrains Mono — all already loaded
- **Responsive breakpoints:** ≥1280px full 3-panel · 1024–1279px narrow 3-panel · ≤1023px single column with drawers
- **Mobile navigation:** Top bar only, no bottom tab bar
- **Context Panel:** ✅ Fully designed — Section 18
- **Top bar:** ✅ Fully designed — Section 17
- **Main menu + save slots:** ✅ Fully designed — Section 19
- **Enter World transition:** ✅ Resolved — connects to existing World Intro Cinematic Modal (CLAUDE.md rule 42)

---

### Active Conflicts with the Existing Codebase

**CombatMode architecture** — existing implementation is an absolute-positioned bottom strip (CLAUDE.md rule 39). This doc specifies a flex item. The bottom-strip needs to be refactored when implementing the combat panel redesign.

**LevelUpModal already exists** — CLAUDE.md rule 90. Redesign the existing component; do not delete and recreate.

**Story Feed Colors token system** — CLAUDE.md has its own canonical highlight token table (`--hl-region`, `--hl-loc`, player action teal `#7ab8c8`, item highlight `#e8c547`, etc.). This coexists with this doc's prose styling. Never overwrite it.

**Nav card group names** — CLAUDE.md rule 72 uses BACK/DEEPER/PEER/UNDISCOVERED internally. Grouping logic stays; only presentation label language changes.

**Design token naming** — existing codebase uses `--g-fantasy`, `--accent`, `var(--ink-1)`. Reconcile into a single system; do not create a parallel token set.

---

### Remaining Design Gaps

The following surfaces still need design before Claude Code can be prompted for them:

- **Search / loot flow** — victory card's "Search the remains →" triggers loot UI; floor_loot[] engine exists (CLAUDE.md rules 83/84/87) but the UI is not designed
- **Error states** — API failures, network errors, mid-stream LLM failures
- **Settings screen** — not designed

Everything else in Section 16's original gap list has been resolved or is deferred by explicit decision.

---

### Implementation Approach

This doc describes the **target visual state** for a live codebase at V8.83 with 626 passing tests. Surface-by-surface redesign integrated into the 11-prompt implementation arc — not a big-bang UI overhaul.

**Authority:** CLAUDE.md governs game logic, architecture, data. This doc governs visual presentation, interaction, animation. On UI conflicts: this doc wins. On game mechanic conflicts: CLAUDE.md wins.

**Per-prompt invariants:**
- Origin/main baseline check first (CLAUDE.md rule 76)
- Investigation-before-patching (CLAUDE.md V8.40)
- jest baseline of 626 must be maintained (CLAUDE.md rule 91)
- Do not break the Story Feed Colors token system

---

## 17. Top Bar

The top bar is dark chrome (`#141210`) in all genres and at all screen sizes. It never changes colour with genre. It's the persistent UI frame the game lives inside.

### Desktop Elements (left to right)

| # | Element | Spec |
|---|---------|------|
| 1 | **Logo** | "✦ Endless Worlds" · Cormorant Garamond italic · 13–14px · genre accent colour |
| 2 | **Genre tag** | Rounded pill · Inter Tight · 11px · uppercase · genre accent text + background + border |
| 3 | **Location breadcrumb** | Region `›` Settlement `›` Current Location · region/settlement in `#5a4828` · current location in `#a08060` · separator `›` in `#3a2a18` · truncates left on narrow viewports (current location always visible) |
| 4 | [flex spacer] | — |
| 5 | **Verbosity toggle** | Three states: Terse · Standard · Rich · Active: Inter Tight 11px, genre accent, background tint + border · Inactive: `#3e3020`, no border |
| 6 | **Background loading dot** | 6px pulsing circle, genre accent · visible only during WorldBible/RegionBible prefetch · hidden when idle |
| 7 | **Codex icon** | `ti-book` · 15px · `#4a3828` at rest · brightens on hover · 4px dot in genre accent when unread entries exist |
| 8 | **Journal icon** | `ti-notebook` · 15px · same states as Codex |
| 9 | **Map icon** | `ti-map` · 15px · same states |
| 10 | **Character pill** | 24px avatar circle (class icon, genre accent, genre-styled border) + character name (Inter Tight 11px, `#c0a878`) · `border-radius: 20px` pill shape · tapping opens Character Panel |

### Desktop height: 44px · Mobile height: 52px

### Behaviour Rules

- Top bar never scrolls — `position: sticky` or fixed at top.
- Breadcrumb updates immediately on navigation (from game state, no LLM call).
- Verbosity toggle takes effect on next AI action — not retroactively.
- Background dot is the only dynamically appearing/disappearing element.
- **Hidden on main menu and character creation screens** — top bar appears only when game begins.

---

## 18. Context Panel

The Context Panel is the always-visible left column on desktop (196px at ≥1280px, 160px at 1024–1279px). On ≤1023px it becomes a left drawer opened by the hamburger icon in the top bar.

**The Context Panel is NOT navigational.** Navigation happens via nav cards in the story feed. The Context Panel describes the current space.

### Content Sections (top to bottom)

**1. Location header**
- Name: Cormorant Garamond italic, 12–13px, `#e2cda0`
- Type badge: Inter Tight 11px, genre accent, pill shape

**2. Atmosphere prose**
- 2–3 sentences. Cormorant Garamond italic, 11px, `#5a4020` (more muted than story feed — ambient, not narrative)
- Line-height 1.65
- Source: current location's `physical_description` / `atmosphere` fields from WorldBible/RegionBible — **no LLM call**
- Updates immediately on arrival

**3. Divider** — 0.5px `#252018`

**4. "HERE NOW" — NPCs present**
Hidden entirely if no NPCs present. No empty placeholder.

Each NPC row (tappable — opens same dialogue flow as story feed):
- 6px disposition dot (coloured per Section 10 disposition system)
- Name: Cormorant Garamond italic, 11px, `#c0a878`
- Role + disposition word: Inter Tight 11px, `#4a3828`
- Hover: `rgba(196,148,58,.09)` background, `border-radius: 5px`

**5. Divider** — hidden if either NPCs or Objects section is absent

**6. "IN THIS SPACE" — interactable objects**
Hidden entirely if no objects present. No empty placeholder.

Each object row (tappable — triggers object interaction):
- Tabler icon by category: `ti-package` (containers), `ti-news` (notices/boards), `ti-door` (doors), `ti-book` (books/lore), `ti-coins` (valuables), `ti-skull` (enemy remains) · `#4a3828` at rest
- Name: Cormorant Garamond italic, 11px, `#c0a878`
- Action label right-aligned: Inter Tight 11px, `#3e3020`

**Action label values match CLAUDE.md rule 87 exactly:**
- "Search" — containers, enemy remains
- "Read" — books, notices, signs
- "Examine" — doors, interesting objects
- "Use" — mechanisms, switches

### Interaction Model

Tapping an NPC or object in the Context Panel is functionally identical to tapping the same entity in the story feed — same underlying interaction, same code path. NPCs grey out (non-tappable) while in dialogue. Objects disappear from the panel when examined/looted (game state update).

### Empty States

If no NPCs: entire "Here Now" section doesn't render. If no objects: entire "In This Space" section doesn't render. If both absent: just location name + type + atmosphere prose. This looks clean and intentional — never broken.

### Update Behaviour

Context Panel updates instantly on arrival. Data from game state only — never an LLM call. Never in a "loading" state.

### Genre Treatment

Context Panel uses the full genre visual system: `var(--content-bg)` background, genre typography rules for section headers, and three overlay divs (`.ol-scan`, `.ol-grid`, `.ol-tex`) — same requirement as story feed.

### Mobile Drawer

`translateX(-100%) → translateX(0)`, `300ms cubic-bezier(0.22, 1, 0.36, 1)`. Backdrop `rgba(0,0,0,.5)`. Close: swipe left, tap backdrop, or tap hamburger again. `250ms ease-in`. Same content as desktop.

---

## 19. Main Menu, Save Slots & Enter World

### Main Menu

**Background:** `#08060a` — coolest and darkest background in the entire app. Creates a clear mode boundary: not the game yet.

**Layout (mobile):** Logo + tagline centred (upper ~30% of screen) → save slot cards stacked vertically, full-width → settings gear bottom-right.

**Layout (desktop):** Logo + tagline centred → save slot cards in a horizontal row (up to 3 per row, max ~280px each, scrollable if more) → settings gear bottom-right.

**Logo:** "Endless Worlds" · Cormorant Garamond italic · 28px mobile / 40px desktop · `#e2cda0` · no icon mark on main menu (just the text)

**Tagline:** "An adventure generated for you" · Inter Tight · 12px · `#4a3828` · letter-spacing 0.08em

**Settings gear:** `ti-settings` icon, 16px, `#2a2015` at rest, `#4a3828` on hover. Opens settings modal (not yet designed — deferred).

### Save Slot Cards

**Filled slot card:**
- Genre badge pill: Inter Tight 11px, genre accent colour + border
- Character name: Cormorant Garamond italic, 15–16px, genre-appropriate text colour
- Class · Level: Inter Tight 12px, very muted
- Thin divider `0.5px`
- World name: Cormorant Garamond italic, 12px, muted
- Current location breadcrumb: Inter Tight 11px, very muted
- Last played: Inter Tight 11px, very muted
- "Continue →" button: full-width, genre accent border + background tint, Inter Tight uppercase

**Card background and border match the genre of that save.** A Fantasy save has a warm amber parchment card. A Cyberpunk save has a flat cyan-bordered card. The full genre card treatment from Section 3 applies.

**Empty slot card:**
- Dashed border: `rgba(196,148,58,.3)` — neutral amber regardless of genre
- ✦ mark centred, `#3e3020`, 18px
- "Begin a new adventure" · Cormorant Garamond italic · 13px · `#4a3828` · centred
- Hover: border brightens to `rgba(196,148,58,.55)`, very faint amber background

**Slot counts:** Free = 1 · Adventurer = 3 · Legend = unlimited (row scrolls)

**Delete / manage:** Long-press (mobile) or right-click (desktop) reveals "Delete save" option. Requires confirmation modal — "Are you sure? This world is gone forever." Destructive — cannot be undone.

### Enter World Transition

The transition from character creation to the game connects to the existing World Intro Cinematic Modal (CLAUDE.md rule 42). No separate transition animation is designed.

**Sequence:**
1. Player taps "Begin Adventure" (final character creation step)
2. Button enters loading state (spinner replaces arrow icon)
3. Character profile saves (`/api/game/save-character-profile`)
4. If WorldBible is still generating: full-screen loading state with pulsing ✦ and world name when available. Never navigate to the game with incomplete WorldBible.
5. App transitions to game view (story feed, context panel, character panel mount)
6. World Intro Cinematic Modal fires automatically (CLAUDE.md rule 42): full-screen overlay, world name, opening narration from `metadata.world_intro` template. Dismissed by tap or keypress.
7. First story beat streams below the modal dismissal: "Your adventure begins."

**WorldBible timing:** Generation starts at genre confirmation (character creation step 1) and runs in background through all 6 steps. In practice it completes well before the player reaches the Motivation step. The loading state in step 4 is the rare edge case, not the normal path.
