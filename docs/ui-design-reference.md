# Endless Worlds RPG — UI Design Reference

**Version:** 3.2  
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

### Spacing & Shape (Base — Fantasy)

- Border radius: 7–8px for cards, 20px for pills/badges, 50% for circles
- Card borders: 1px (default), 1.5–2px for selected state
- Padding: 8–14px card interior, 7–13px bars
- All interactive elements: minimum 44px touch target height on mobile

---

## 3. Genre Visual System

Apply a single class to the root game container: `genre-fantasy`, `genre-cyberpunk`, `genre-horror`, `genre-space`, `genre-postapoc`. All styling cascades via CSS.

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

Every scrollable content area contains three overlay divs (`position: absolute`, `inset: 0`, `pointer-events: none`, `z-index: 2`):

| Overlay | Genres | Effect |
|---------|--------|--------|
| `.ol-scan` | Cyberpunk | CRT scanlines (4px repeat, ~2.5% cyan) |
| `.ol-scan` | Horror | Dot texture (5px grid, ~20%) |
| `.ol-scan` | Post-Apoc | Diagonal scratches (~2.5%) |
| `.ol-grid` | Space Opera | Purple grid (26×26px, ~5%) |
| `.ol-grid` | Horror | Green fog (four ellipses, ~25–32%) |
| `.ol-tex` | Fantasy | Amber candlelight glow (~16% top, ~7% edge) |

Horror uses BOTH `.ol-grid` AND `.ol-scan` simultaneously.

### Card Treatment Per Genre

| Genre | Radius | Border | Decorative |
|-------|--------|--------|------------|
| Fantasy | 7–8px | `rgba(196,148,58,.28)` | `✦` mark top-right |
| Cyberpunk | 0px | `rgba(34,211,238,.17)` | Hard corners |
| Horror | 2px | `rgba(45,65,40,.32)` | Inward shadow |
| Space Opera | 3px | `rgba(168,85,247,.2)` | `┌` `┘` brackets |
| Post-Apoc | 2px | `rgba(180,80,20,.25)` | Rust streak top |

### Content Background Per Genre

| Genre | Background |
|-------|------------|
| Fantasy | `linear-gradient(180deg, #241a0a, #1c1308)` |
| Cyberpunk | Flat `#040c0f` |
| Horror | `#060809` |
| Space Opera | `linear-gradient(180deg, #070520, #060412)` |
| Post-Apoc | `linear-gradient(180deg, #1a0e06, #130b04)` |

### Typography Per Genre (UI labels only — prose never changes)

| Genre | UI labels | Prose |
|-------|-----------|-------|
| Fantasy | Inter Tight italic, `letter-spacing: .04em` | Cormorant Garamond italic |
| Cyberpunk | `"Courier New", monospace`, wider spacing | Cormorant Garamond italic |
| Horror | Inter Tight, `6.5px`, minimal spacing | Cormorant Garamond italic |
| Space Opera | Inter Tight, `letter-spacing: .14–.18em` | Cormorant Garamond italic |
| Post-Apoc | Inter Tight, `letter-spacing: .18–.22em`, `6.5px` | Cormorant Garamond italic |

**Critical rule:** Narrative prose always uses Cormorant Garamond regardless of genre.

### Text Glow Per Genre

| Genre | Glow |
|-------|------|
| Fantasy | None |
| Cyberpunk | `text-shadow: 0 0 8px rgba(34,211,238,.28)` |
| Horror | None |
| Space Opera | `text-shadow: 0 0 6px rgba(168,85,247,.2)` |
| Post-Apoc | None |

---

## 4. Layout

### Desktop (3-Panel)

```
[Left: Context Panel] [Center: Story Feed] [Right: Character Panel]
```

Top bar runs full-width above all three panels.

### Responsive Breakpoints

| Viewport | Layout |
|----------|--------|
| ≥ 1280px | Context Panel 196px + story feed + Character Panel 196px |
| 1024px – 1279px | Context Panel 160px + story feed + Character Panel 160px |
| 768px – 1023px | Single column — both sidebars become drawers |
| < 768px | Full mobile — identical to 768–1023px |

Sidebar drawers at ≤1023px: Context Panel slides from left (`translateX(-100%)→0`, `300ms cubic-bezier(0.22,1,0.36,1)`), Character Panel from right (same). Both with `rgba(0,0,0,.5)` backdrop.

### Mobile Navigation

No bottom tab bar. All navigation in the top bar.

**Mobile top bar (left to right):** Hamburger (`ti-menu-2`) · Logo · [spacer] · Codex · Journal · Map · Character pill

All icons: 44px minimum tap targets. Top bar height: 52px mobile, 44px desktop.

---

## 5. Story Panel

- Font: `'Cormorant Garamond', Georgia, serif`, italic, 14–15px, line-height 1.82, `#c0a878`
- NPC speech: `#f0c060`, italic, weight 500
- Scene arrivals: thin rule → `◆ type` glyph → location name → rule → prose

**The LLM API stream IS the typewriter.** No buffering, no fake animation. Tap to skip to completion.

### Genre cursors
Fantasy: soft amber blink · Cyberpunk: hard block · Horror: irregular flicker · Space: fade pulse · Post-Apoc: slow heavy blink

### Loading States

**Pattern 1 — Wait:** Cursor immediately → after 1.2s: atmospheric fragment streams ("The torchlight wavers.") from local lookup table (~20–30 phrases per genre, no LLM) → real content follows on new paragraph.

**Pattern 2 — New area:** Location name + badge instant → `Revealing…` + progress bar → description streams before bar completes.

**Pattern 3 — Background:** 6px pulsing dot in genre accent in top bar during WorldBible/RegionBible prefetch.

---

## 6. Navigation Cards

Left-border colour: burnt copper (back) · sky blue (settlement) · burnt orange (dungeon). Unknown paths: dashed, very dim. Section header: "Where to go." Cards dim during loading.

---

## 7. Map System

**All maps use HTML5 Canvas.** Never SVG.

**Tiers:** World (bezier territory borders, coastal fog) · Region (node map, 0.58 scale icons) · Settlement (bird's-eye, 5.5px dirt roads) · Dungeon (dark stone, torch glow, no grid)

**Genre variants:** Fantasy parchment · Cyberpunk circuit/hex · Horror desaturated/fog · Space star chart · Post-Apoc torn paper/rust

---

## 8. Combat UI

**HP colour states:** 75–100% `#4a8a4a` · 50–75% `#5a9450` · 25–50% `#a87830` · 10–25% `#c84830` · ≤10% `#e03030` pulsing

**Action buttons:** Mobile 2×2 + full-width Abilities · Desktop 5 horizontal. Enemy turn: ~30% opacity.

**Combat timing:**
```
0ms    Lock buttons
100ms  Story streams + target brightens
300ms  Dice result (80ms fade)
400ms  ALL: shake + HP drain (300ms) + damage numbers arc
800ms  Story completes
1000ms Turn badge flips
1300ms Enemy resolves
~3000ms Re-enable
```

**Damage type colours:** Physical `#e0d8c0` · Fire `#ff7030` · Frost `#60d8ff` · Poison `#80e040` · Lightning `#ffee40` · Shadow `#c060ff` · Holy `#ffdc40` · Bleed `#ff3060` · Heal `#7abb7a`

**Kill shot:** Greyscale (400ms) → compress/collapse (300ms) → remaining cards close gap.

**Dice format:** `16 vs 12 · hit` — roll bright, "vs" muted, outcome colour-coded.

---

## 9. Character Creation Wizard

**Stage flow:** Genre → [World Forging] → Species → Class → Origin → Appearance → Name → Motivation → Enter World

WorldBible runs in background from genre confirmation through all 6 steps.

**Class cards:** Stat colour (not genre accent) on icon, role badge, and bottom bar. Stat colours: STR `#c87040` · AGI `#60a850` · INT `#5880d0` · PER `#409888` · CHA `#9060d0`.

**Verified Tabler icons (25 classes):**
Knight `ti-shield` · Rogue `ti-eye-off` · Mage `ti-wand` · Ranger `ti-crosshair` · Herald `ti-message` · Netrunner `ti-cpu` · Fixer `ti-briefcase` · Street Samurai `ti-sword` · Enforcer `ti-hammer` · Ghost `ti-ghost` · Investigator `ti-search` · Cultist `ti-moon` · Survivor `ti-heart` · Phantom `ti-ghost` · Medium `ti-eye` · Commander `ti-badge` · Pilot `ti-rocket` · Engineer `ti-tool` · Marine `ti-shield` · Recon `ti-radar` · Scavenger `ti-search` · Raider `ti-axe` · Medic `ti-first-aid-kit` · Runner `ti-run` · Demagogue `ti-speakerphone`

---

## 10. NPC Dialogue System

**Layout:** Fixed NPC header card · scrollable feed · exactly 4 content slots · persistent "End conversation" button outside the slots.

**Disposition colours:** Hostile `#c44040` · Suspicious `#b06030` · Wary `#b07030` · Neutral `#8a6a3a` · Warm `#c4943a` · Trusting `#5a9a5a` · Devoted `#4a8a4a`

**Three option types:**
- Standard: no badge, always available
- Stat-gated: amber badge showing odds (`CHA · Good odds` / `Risky` / `Long shot`). Always tappable — probability-based, never a hard lock.
- Observation: teal badge + eye icon. Always tappable. Failed = vaguer result.

**Feed treatments:** Narrative Cormorant Garamond `#b0956a` · NPC speech `#f0c060` italic + speaker label · Player line left-bordered · Observation teal left border · Dice `14 vs 11 · hit` JetBrains Mono

---

## 11. Codex

**Entry type colours:** People `#c4943a` · Places `#7a9ab8` · Lore `#a888c8` · Events `#c8885a`

**Tabs:** All (by type) · People (by region) · Places (by region) · Lore (by category) · Events (by day). Section dividers, not accordions.

**Notable mark (◈):** AI-flagged or player-starred only. Never automatic.

**Discovery:** Two simultaneous notifications — (1) inline feed entry card (permanent, `opacity 0→1, translateY 6px→0, 300ms`) + (2) amber toast.

---

## 12. Journal & Quests

Screen title: "Chronicle". Two tabs: Quests · Journal.

**Quest cards show:** Name · `◈` main quest · source + day · description · current objective

**Journal auto-log:** muted amber left border `rgba(196,148,58,.38)`, genre-specific label (Chronicle / SYS_LOG / case notes / SHIP LOG / LOG), `#b0956a` prose.

**Player notes:** brighter amber border `rgba(196,148,58,.72)`, genre label, `#ceaf78` prose.

**Day headers (genre):** Fantasy "— Day the Third —" · Cyberpunk "// DAY_03 ///" · Horror "third night" · Space "◈ CYCLE 3" · Post-Apoc "DAY 3 //"

---

## 13. Character Sheet Panel

Desktop: always-visible right column (196px / 160px). Mobile: right drawer. Shows mechanical state only — no story content.

**Sections:** Portrait + identity · HP bar (8px, colour states, JetBrains Mono value) · XP bar (3px, genre accent) · Status effects (hidden when clean, slides open 300ms) · Attribute block (single inline row, 5 cells, `#cbb888` neutral — never colour-coded per stat) · Equipped items + gold (3 slots always shown, "— empty" when empty) · Pack (3-column grid, actual items only, no empty placeholders)

**Pack inventory stat display:** Equipped items show abbreviated stat inline in `#c4943a` (e.g. `d6+1`, `+2 arm`). See Section 20 for full stat colour system.

**Genre-specific currency:** Fantasy gold `ti-coins` · Cyberpunk cred `ti-cpu` · Horror supplies `ti-backpack` · Space credits `ti-coin` · Post-Apoc scrap `ti-tool`

---

## 14. Transitions & Micro-Interactions

### Combat Entry
Combat panel rises as flex item (height 0→188px, `380ms cubic-bezier(0.22,1,0.36,1)`). Nav cards fade out (180ms). Player card appears (220ms ease-out), enemy cards stagger 80ms after, turn badge fades in 100ms later.

### Combat Exit — Victory
Kill shot greyscale (400ms) → compress (300ms) → panel closes (300ms ease-in, 750ms after kill) → nav cards return → victory card in feed (250ms ease-out, 1100ms after kill).

**Victory card:** XP only (no gold — gold requires Search, see Section 20), XP bar fills 600ms, post-combat prose, "Search the remains →" prompt.

### Combat Exit — Defeat
HP→0: screen dims → defeat panel slides up → "You have fallen." → options require confirm.

### Modal Events
Backdrop `rgba(0,0,0,.82)`, `300ms`. Card `scale(0.88)→scale(1)` + `opacity 0→1`, `420ms cubic-bezier(0.22,1,0.36,1)`. Always requires player action to dismiss.

**Quest Complete:** Green language. Check circle · "Quest Complete" · quest name (16px Cormorant Garamond) · narrative summary · XP · "Continue →". Toast fires after dismissal.

**Level Up:** "✦ Level Up ✦" pulsing glow · `4→5` display (52px Cormorant Garamond) · stat picker (5 inline cards, each with +1 badge, value, stat name, two-word description) · confirm button updates dynamically ("INT: 13→14"). On confirm: stat flares (480ms) → closes → toast.

Stat descriptions: STR Melee/Carry · AGI Dodge/Flee · INT Magic/Lore · PER Detect/Scout · CHA Speech/Trade

### Toast System
`bottom: 50px`, `z-index: 30`. Enter `translateY(18px→0)` + `opacity 0→1`, `250ms cubic-bezier(0.22,1,0.36,1)`. Persist 3.5s (4s level-up). Exit 200ms ease-in. Max 2 visible, stack vertically.

| Type | Colour | Icon |
|------|--------|------|
| Codex | `#c4943a` | `ti-book` |
| Quest complete | `#5a9a5a` | `ti-circle-check` |
| Level up | `#e8d070` | `ti-arrow-up-circle` |
| Combat result | `#7abb7a` | `ti-shield-check` |

### Screen Transitions
Desktop: center column fades (200ms ease). Mobile: `translateX(100%→0)`, `300ms cubic-bezier(0.22,1,0.36,1)`. Tab switch: 150ms fade only. Context Panel drawer: `translateX(-100%→0)`, `300ms cubic-bezier(0.22,1,0.36,1)`.

### Master Timing Reference

| Interaction | Duration | Easing |
|-------------|----------|--------|
| Combat panel open | 380ms | `cubic-bezier(0.22, 1, 0.36, 1)` |
| Combat panel close | 300ms | `ease-in` |
| Combatant card appear | 220ms | `ease-out` |
| Card stagger | 80ms | — |
| Kill shot greyscale | 400ms | `ease` |
| Kill shot compress | 300ms | `ease` |
| Nav cards fade | 180ms | `ease` |
| Victory card appear | 250ms | `ease-out` |
| HP bar change | 300ms | `ease` |
| XP bar fill | 400ms | `ease` |
| Level number flash | 600ms | `ease` |
| Modal backdrop | 300ms | `ease` |
| Modal card scale-in | 420ms | `cubic-bezier(0.22, 1, 0.36, 1)` |
| Level-up glow pulse | 2000ms | `ease-in-out infinite` |
| Stat confirm flare | 480ms | `ease` |
| Toast enter | 250ms | `cubic-bezier(0.22, 1, 0.36, 1)` |
| Toast persist | 3500ms | — |
| Toast persist level-up | 4000ms | — |
| Toast exit | 200ms | `ease-in` |
| Mobile screen open | 300ms | `cubic-bezier(0.22, 1, 0.36, 1)` |
| Mobile screen close | 250ms | `ease-in` |
| Tab switch | 150ms | `ease` |
| Context Panel drawer open | 300ms | `cubic-bezier(0.22, 1, 0.36, 1)` |
| Context Panel drawer close | 250ms | `ease-in` |

---

## 15. Implementation Notes for Claude Code

- **Font stack:** Cormorant Garamond (prose) · Inter Tight (UI chrome) · JetBrains Mono (numbers). All loaded. Never substitute.
- **Fantasy accent `#c4943a`** — update `--g-fantasy` from `#f59e0b`. Single variable.
- **Genre class on root** — `genre-X` cascades everything. Never per-component.
- **Three overlay divs** — every scrollable area including Context Panel needs `.ol-scan`, `.ol-grid`, `.ol-tex`.
- **Maps: Canvas only** — never SVG.
- **LLM stream is the typewriter** — no buffering.
- **Combat panel is a flex item** — height 0→188px. Refactor existing bottom-strip (CLAUDE.md rule 39).
- **Victory card XP only** — no gold. Gold requires "Search" (Section 20).
- **Loot engine already built** — floor_loot[], engine-resolved, zero LLM calls (CLAUDE.md rules 83/84/87). UI only.
- **Gold is a loot item** — not auto-credited. Requires Take button tap same as any item.
- **LevelUpModal already exists** (rule 90) — redesign, not replace.
- **Story Feed Colors token system** — do not overwrite (`--hl-region`, `--hl-loc`, etc.).
- **Nav card group names** — BACK/DEEPER/PEER/UNDISCOVERED logic stays; presentation changes to plain English.
- **Loot Take button spec:** `font-size: 9.5px`, `padding: 2px 10px`, `border-radius: 20px`, `color: #c4943a`, `background: rgba(196,148,58,.1)`, `border: 1px solid rgba(196,148,58,.3)`. Identical in inline feed card and modal.
- **Item stat colour system:** weapon damage → `#c4943a` · heal → `#7abb7a` · accessory stat → `#a888c8`. JetBrains Mono. Consistent across loot card, inventory detail, and equipped items.
- **Equipped items show abbreviated stat inline** — `d6+1`, `+2 arm` in `#c4943a` in the character sheet sidebar.
- **Pack item detail: inline expand** — tapping a pack item expands a detail card below the grid in the same viewport. No scrolling required.
- **Context Panel objects populate progressively** — only after player discovers them. NPCs always show immediately.
- **Save slot cards:** name + genre badge row 1 · "Level X · Class" row 2. Never wraps.
- **Save slots: hours played** — not last played. "X.X hours played" with clock icon.
- **Top bar hidden on main menu and character creation.**
- **Enter World = World Intro Cinematic Modal** (rule 42). No separate transition.
- **`requestAnimationFrame` double-frame trick** for CSS transitions on dynamically inserted elements.
- **Toast z-index: 30** — above combat panel (z-index: 10).

---

## 16. Notes & Considerations for Implementation Planning

### Resolved Decisions

- Fantasy accent `#c4943a` · Font stack (all loaded) · Responsive breakpoints · Mobile navigation (top bar only)
- Context Panel ✅ Section 18 · Top bar ✅ Section 17 · Main menu + save slots ✅ Section 19
- Enter World transition ✅ World Intro Cinematic Modal (rule 42)
- Loot flow ✅ Section 20

### Active Conflicts with Existing Codebase

- **CombatMode bottom-strip** (rule 39) → refactor to flex item per Section 14 spec
- **LevelUpModal exists** (rule 90) → redesign, not replace
- **Story Feed Colors token system** — coexists, never overwrite
- **Nav card group names** — grouping logic unchanged, presentation only
- **Design token naming** — reconcile `--g-fantasy`/`--accent` into single system

### Remaining Design Gaps

- **Error states** — API failures, network errors, mid-stream LLM failures
- **Settings screen** — not designed

### Implementation Approach

Surface-by-surface redesign. V8.83, 626 tests. Not a big-bang overhaul.

**Authority:** CLAUDE.md → game logic, architecture, data. This doc → visual presentation, interaction. On UI conflicts: this doc wins. On game mechanic conflicts: CLAUDE.md wins.

**Per-prompt invariants:** Origin/main baseline check first (rule 76) · Investigation-before-patching (V8.40) · jest baseline 626 (rule 91) · Do not break Story Feed Colors token system.

---

## 17. Top Bar

Dark chrome `#141210` in all genres. Never changes colour.

**Desktop elements (left → right):** Logo "✦ Endless Worlds" (Cormorant Garamond italic, 13–14px, genre accent) · Genre tag pill · Location breadcrumb (Region › Settlement › Current) · [spacer] · Verbosity toggle (Terse/Standard/Rich) · Background loading dot (6px, genre accent, hidden when idle) · Codex `ti-book` · Journal `ti-notebook` · Map `ti-map` · Character pill (avatar + name, opens Character Panel)

Height: 44px desktop, 52px mobile. **Hidden on main menu and character creation.**

---

## 18. Context Panel

Always-visible left column (196px ≥1280px, 160px 1024–1279px). Left drawer on ≤1023px.

**NOT navigational** — describes the current space only.

### Content

**Location header:** Name (Cormorant Garamond italic 12–13px, `#e2cda0`) · Type badge (genre accent pill)

**Atmosphere prose:** 2–3 sentences, 11px `#9a7e52`, Cormorant Garamond italic. From WorldBible/RegionBible data — no LLM call.

**"HERE NOW" — NPCs:** Section header: 2px vertical accent bar + label (genre-specific typography). Hidden if no NPCs. Each NPC in its own card: `rgba(accent,.06)` background · `rgba(accent,.16)` border · 7px radius · 8px 10px padding · disposition dot + name (`#d4bc88`) + role text (`#7a6040`) · hover brightens. Tapping opens dialogue (same code path as story feed).

**"IN THIS SPACE" — Objects:** Same section header treatment. **Objects populate progressively** — only appear after the player discovers them in the story feed. NPCs always show immediately. Each object in its own card: `rgba(accent,.04)` background · `rgba(accent,.12)` border · 7px radius · icon + name + action label pill. Action labels match CLAUDE.md rule 87: Search · Read · Examine · Use.

**Unlooted sources** persist as a single entry ("Sentinel's remains · Search") until all items taken. Tapping opens loot modal (see Section 20).

**Empty states:** Sections don't render when empty — never show placeholders.

### Genre Treatment
Full genre visual system: `var(--content-bg)` background, genre section header typography, three overlay divs.

---

## 19. Main Menu, Your Worlds & Enter World

### Two Distinct Screens

1. **Main Menu** — splash/landing. Logo + genre pills + two CTAs. Gets out of the way fast.
2. **Your Worlds** — save slots. Reached from "Continue ›" on Main Menu. Has back button.

"Continue ›" → directly into game if 1 save, Your Worlds screen if multiple. Hidden if no saves.

### Main Menu

Background `#08060a`. Centred layout: Logo ("Endless Worlds", Cormorant Garamond italic, 28px/40px, `#e2cda0`) · tagline ("A new adventure every time", Inter Tight 12px, `#4a3828`) · genre pills (5 pills in respective accent colours) · CTAs · settings gear bottom-right.

**Ambient genre shift:** Radial glow cycles through 5 genre accents (~8s per genre). Genre label above title fades fully out, holds invisible, then new name fades in clean — no overlap. "Begin New Adventure" button border/tint shifts with glow. Placeholder for future genre artwork.

**CTAs:** "Begin New Adventure" (primary, Cormorant Garamond italic, genre accent, full-width) · "Continue ›" (secondary, muted).

### Your Worlds — Save Slot Cards

**Filled card layout:**

Row 1 — flex, no wrap: Avatar circle (class icon, genre accent) · Name (Cormorant Garamond italic 15–16px, flex:1, ellipsis) · Genre badge pill (flex-shrink:0, always in line)

Row 2 — single line, no wrap: "Level X · Class" · Inter Tight 12px · genre-tinted muted colour (Fantasy `#7a6040` · Cyberpunk `#2a7a8a` · Horror `#4a6a30` · Space `#7a5a9a` · Post-Apoc `#8a5030`)

Divider · World name (Cormorant Garamond italic, muted) · Location breadcrumb · Hours played (`ti-clock` + "X.X hours played") · "Continue →" button (genre accent)

**Empty slot:** Dashed amber border · ✦ centred · "Begin a new adventure" italic

**Slot counts:** Free 1 · Adventurer 3 · Legend unlimited. Delete via long-press/right-click with confirmation modal.

### Enter World Transition

Connects to World Intro Cinematic Modal (CLAUDE.md rule 42). No separate transition.

"Begin Adventure" → loading state → character profile saves → WorldBible check (wait if still generating) → game view mounts → Cinematic Modal fires → "Your adventure begins."

---

## 20. Loot Flow

### Overview

Looting is a two-path design. The **first-time discovery** is a narrative moment in the story feed. **Revisiting** unlooted sources is a modal accessed via the Context Panel. Both paths surface the same data from `floor_loot[]`.

Gold is **not** auto-credited — it is a loot item requiring an explicit Take tap, same as any other item.

---

### Item Card Spec

Used in both the inline feed card and the loot modal. Identical across both contexts.

**Card container:**
- Background: `rgba(accent, .05)` · Border: `1px solid rgba(accent, .16)` · Border-radius: 7px · Padding: 9px 10px · Margin-bottom: 5px
- Hover: background `rgba(accent, .10)`, border `rgba(accent, .28)`
- After taken: `opacity: 0.3`, pointer-events none

**Card layout (flex row):**
- Left: Tabler icon (14–15px, `#7a6040` at rest) — category by type: `ti-coins` (gold) · `ti-sword` (weapons) · `ti-shield` (armor) · `ti-heart` (heal consumables) · `ti-backpack` (other consumables) · `ti-gem` (valuables/accessories) · `ti-book` (lore items)
- Centre (flex 1): Item name (Cormorant Garamond italic 12px, `#d4bc88`, single line ellipsis) · Stat line below (see stat system)
- Right: Take button

**Stat line format:** `[stat in JetBrains Mono] · Type · Rarity`

### Stat Colour System

Consistent across loot cards, inventory item detail, and character sheet sidebar. Always JetBrains Mono.

| Item type | Stat example | Colour |
|-----------|-------------|--------|
| Weapon | `d4+1`, `d8+3` | `#c4943a` amber |
| Armor | `+2 armor` | `#c4943a` amber |
| Heal consumable | `Heal 2d4+2` | `#7abb7a` green |
| Accessory | `+1 INT`, `+2 AGI` | `#a888c8` purple |
| Lore item | `Lore item` | `#c4943a` amber |
| Gold / currency | `Currency` (no stat value) | — (type text only, `#6a5530`) |

### Take Button Spec

Identical in both inline feed card and loot modal — same component, same styles:

```
font-size: 9.5px
padding: 2px 10px
border-radius: 20px
color: #c4943a
background: rgba(196,148,58,.1)
border: 1px solid rgba(196,148,58,.3)
margin-top: 1px
```

Hover: `background rgba(196,148,58,.22)`, `border-color rgba(196,148,58,.55)`

After taken: Take button replaced with `ti-check` icon in `#5a9a5a`.

### Take All Button

Full-width, amber border + tint, Inter Tight uppercase, `padding: 8px`, `border-radius: 7px`.

Updates dynamically as items are taken: "Take all →" → "Take remaining (N) →" → replaced by "All collected ✓" (Cormorant Garamond italic, `#5a9a5a`) when complete.

---

### First-Time Discovery — Inline Feed Card

Triggered by tapping "Search the remains →" on the victory card (or "Search" on a world container in the story feed).

**Sequence:**
1. "Search the remains →" link on victory card changes to "Searched ✓" (green, non-interactive)
2. Loot card appears in the story feed directly below the victory card
3. Loot card is permanent in the feed — it scrolls with everything else and is never removed

**Loot card header:** Small caps label with package icon: "You search the remains" / "You search the [object name]"

**Gold row:** Gold is a regular loot item at the top of the list. Icon: `ti-coins`. Type label: "Currency". Take button same as all items. Credits to player gold balance on Take tap.

---

### Revisit — Context Panel Entry + Loot Modal

If the player navigates away without taking all items, the source persists in the Context Panel "In this space" section as a **single compact entry** — not individual items listed.

**Context Panel entry format:**
- Icon: `ti-skull` (enemy remains) or `ti-package` (containers)
- Name: "[Enemy name]'s remains" or "[Container name]"
- Action label pill: "Search"
- Same card treatment as other "In this space" entries

Tapping the Context Panel entry opens the **loot modal**.

**Loot modal spec:**
- Backdrop: `rgba(0,0,0,.78)`, `300ms ease`
- Card: `scale(0.88)→scale(1)` + `opacity 0→1`, `400ms cubic-bezier(0.22,1,0.36,1)`. Width ~280px.
- Header: source name ("Sentinel's remains") + `ti-x` close button top-right
- Same item cards as the inline feed card — identical layout, identical Take buttons
- "Take all →" button at bottom
- Backdrop tap or ✕ to close

The Context Panel entry disappears once `floor_loot[]` is empty for that source (all items taken via either path).

---

### Inventory Full State

When INVENTORY_CAP (20) is reached:

- Orange warning banner at the top of the item list: "Pack full (20/20)" (bold) + "Drop an item to make room" (secondary line). Background `rgba(180,90,40,.12)`, border `rgba(180,90,40,.28)`.
- Take buttons replaced with disabled "Inventory full" labels: same pill shape, greyed out, `opacity: 0.5`, not interactive.
- Items remain in `floor_loot[]` — the loot card/modal stays accessible until items are taken.

---

### Empty Loot Result

If `floor_loot[]` is empty when search is triggered: a single prose line appears in the story feed ("The remains yield nothing of worth.") No card is created. No Context Panel entry is added.

---

### Two Contexts — Same Component

| Context | Header | Trigger | Card type |
|---------|--------|---------|-----------|
| Enemy remains | "You search the remains" | "Search the remains →" on victory card | Inline feed (first-time), modal (revisit) |
| World container | "You search the [name]" | "Search" on Context Panel object or story feed object | Inline feed (first-time), modal (revisit) |

---

### Inventory Item Detail

Tapping any item in the character sheet pack grid expands an inline detail card **directly below the grid** — no scrolling required. The detail appears within the same viewport.

**Detail card:**
- `border: 1px solid rgba(accent,.3)` · `background: rgba(accent,.07)` · `border-radius: 7px` · `padding: 10px`
- Item name: Cormorant Garamond italic 12px, `#e2cda0`
- Stat: JetBrains Mono, same colour system as loot card (weapon `#c4943a`, heal `#7abb7a`, accessory `#a888c8`)
- Type · Rarity: Inter Tight 9px, `#6a5530`
- Action buttons: Equip / Use / Read / Drop (context-appropriate, Inter Tight, amber style for primary, red-tinted for Drop)

Tapping same item again collapses the detail. Tapping a different item switches to that item's detail.

**Equipped items in sidebar:** Show abbreviated stat inline in `#c4943a` JetBrains Mono (e.g. `d6+1` for weapons, `+2 arm` for armor) so the most important number is visible without tapping.
