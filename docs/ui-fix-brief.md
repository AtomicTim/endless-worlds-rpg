# Endless Worlds RPG — UI Fix Brief

**Written by:** Design session Claude (UI designer)  
**For:** Implementation Claude (Claude Code)  
**Date:** May 2026  
**Priority:** Critical — the UI implementation does not match the design spec in any meaningful way

---

## Before You Start

Read these files in full before writing a single line of code:

1. `CLAUDE.md` — project rules, architecture, test requirements
2. `docs/ui-design-reference.md` — the complete visual design spec (20 sections, v3.2)

The design reference is the authoritative source for every visual decision. When this brief says "per spec" it means that document. Every section number below refers to that document.

**Test baseline:** 626 passing. Do not regress. Run `npx jest` before and after each fix group.

---

## What Went Wrong

The UI implementation was attempted but the output does not reflect the design spec. The core problems are:

1. **The font system was not applied.** Monospace (Courier-style) is bleeding through everything. The three-font system was never activated.
2. **The genre visual system was not applied.** The `genre-fantasy` root class and its CSS variables were never activated. Everything looks flat and cold.
3. **Card containers were never implemented.** Every selectable option in character creation and every item in the context panel is floating plain text.

These three root issues explain roughly 80% of what looks wrong. Fix them first, then do targeted surface fixes.

---

## Priority Order

Fix in this sequence. Each group is a separate prompt to Claude Code.

```
Group A — Foundation (fonts + genre system + backgrounds)
Group B — Character creation screens
Group C — Nav cards
Group D — Story feed + arrival format
Group E — Context panel
Group F — Character panel (right sidebar)
Group G — NPC dialogue modal
Group H — Top bar
Group I — Chronicle / quest log
Group J — World intro cinematic
Group K — Map renderer
Group L — Misc bugs
```

---

## Group A — Foundation

**This is the most important fix. Do this first. Everything else depends on it.**

### A1 — Font system

The three fonts are already loaded (they were in the codebase before the overhaul). They are not being applied correctly.

**Required font assignments (never deviate from these):**

| Use | Font | Style | Size |
|-----|------|-------|------|
| All narrative prose, NPC speech, location descriptions, item names | `'Cormorant Garamond', Georgia, serif` | italic | 13–15px |
| ALL UI chrome — labels, badges, button text, section headers, stat labels | `'Inter Tight', system-ui, sans-serif` | normal/uppercase | 7–12px |
| All numeric values — stat numbers, dice notation, HP values, gold amounts | `'JetBrains Mono', monospace` | normal, tabular-nums | varies |

**What is wrong:** Monospace (appears to be Courier or similar) is applied globally. It should appear ONLY on numeric values via JetBrains Mono, and as a genre-specific override for Cyberpunk UI labels. It must never appear on Fantasy game prose or standard UI labels.

**Fix:** Set the CSS base font to Cormorant Garamond italic for body/prose contexts, Inter Tight for all interface elements. Audit every component and correct.

### A2 — Genre visual system

Per Section 3 of the design doc, a single class on the root game container activates the entire genre visual system.

```css
.genre-fantasy {
  --genre-accent: #c4943a;
  --card-bg: linear-gradient(160deg, #2e2010, #281b0e);
  --card-border: rgba(196,148,58,.28);
  --card-radius: 8px;
  --content-bg: linear-gradient(180deg, #241a0a, #1c1308);
}
```

**What is wrong:** This class is not being applied to the root container, or it is applied but the CSS variables are not being consumed by the components. The result is flat, cold, uncoloured surfaces.

**Fix:** Confirm the `genre-fantasy` class is on the root game container during an active Fantasy game. Confirm all card and content components consume `var(--genre-accent)`, `var(--card-bg)`, `var(--card-border)`, `var(--content-bg)` rather than hardcoded values. Apply overlay divs (`.ol-tex` for Fantasy — warm amber candlelight glow) to every scrollable content area.

### A3 — Background colours

**What is wrong:** Backgrounds are pure black (`#000000`). 

**Correct values:**
- Main game content areas: `var(--content-bg)` = `linear-gradient(180deg, #241a0a, #1c1308)` for Fantasy
- Story feed background: `#191308` (very dark warm brown)
- Top/bottom bars: `#141210`
- Character creation: `#0f0d0a`
- Main menu: `#08060a`

### A4 — Fantasy accent colour

The Fantasy accent is `#c4943a` (warm amber gold). If anything currently uses `#f59e0b`, replace it. This was a confirmed correction in the design doc.

---

## Group B — Character Creation Screens

All screens share the same problems. Fix all of them together.

**What is wrong across all screens:**
- No card containers — options are floating text
- Monospace font everywhere (see Group A)
- Pure black background instead of dark warm brown
- No visible selected state on chosen options
- Descriptions too long (especially Species)
- The logo "ENDLESS WORLDS" is in the wrong colour and font — should be Cormorant Garamond italic in `#c4943a`, not cyan monospace

### B1 — Genre Select screen

The screen shows ASCII-art genre icons (castle, robot, etc.) with floating text labels. This is not the design.

**What the spec says (Section 9):** Genre cards are proper contained cards. Each card has:
- Background: `var(--card-bg)` 
- Border: `var(--card-border)`
- Border-radius: `var(--card-radius)` (8px for Fantasy)
- Genre name: Inter Tight, uppercase
- Tagline: Cormorant Garamond italic, muted

The background of the page itself should be `#08060a` (the main menu / pre-game background). The genre selection happens before the genre class is known, so neutral amber (`#c4943a`) is used for selected state.

Selected card: brighter border, slight background tint, a visible check or glow indicator.

### B2 — Class Select screen

**What is wrong:** Classes are flat text rows separated by horizontal rules. No card containers.

**What the spec says:** Each class card has:
- The class icon (Tabler icon, see verified list in Section 9 of design doc) coloured in the **stat colour** (not genre accent)
- A stat badge (STR / AGI / INT / PER / CHA) in its respective stat colour
- A bottom bar (3px strip) in the stat colour
- A brief italic description in Cormorant Garamond
- "Starts with: X" in Inter Tight

**Stat colours:**
- STR: `#c87040`
- AGI: `#60a850`  
- INT: `#5880d0`
- PER: `#409888`
- CHA: `#9060d0`

Selected state: 2px border in the stat colour, visible background tint, checkmark top-right.

### B3 — Species Select screen

**What is wrong:** Descriptions are multiple full paragraphs. Far too much text. No card containers.

**Fix:** Trim every species description to 2–3 sentences maximum. Apply card containers same as other steps. Stat modifiers (`+1 Intelligence · -1 Charisma`) should be prominently styled in their respective stat colours.

### B4 — Origin Select screen

Same issues as Species. No card containers, descriptions too long, wrong font.

**Fix:** Card containers, trim descriptions to 2–3 sentences, "Starts with: X" in Inter Tight.

### B5 — Appearance screen

**What is wrong:** Trait pills exist but are styled as dark monospace boxes. The selected appearance option has no clear selected state.

**Fix:** Trait pills should be Inter Tight uppercase, amber accent border and background tint. The selected appearance option should have a clear amber border/glow treatment.

### B6 — Name Generator

**Bug:** The random name generator generates one name and then the regenerate function stops working.

**Fix:** Identify the name generation handler, confirm it can be triggered multiple times. The "generate another" / regenerate button must work on every press.

### B7 — Motivation screen

The Motivation step exists in the flow (step 6 of character creation) but appears not to have been visually implemented per spec.

**What the spec says:** A text input for the player to write their character's motivation. Simple: a large text area in Cormorant Garamond italic, with a character label above and the Back/Next buttons. This is a freeform step, not a card-selection step.

---

## Group C — Nav Cards

**This is one of the most visually broken surfaces.**

**What is wrong:** Nav cards are giant full-width dark rectangles with ALL CAPS monospace text (e.g. "THE FILED REST / TAVERN"). They look like database table rows. They span the entire width of the story panel and stack vertically, taking up enormous space.

**What the spec says (Section 6):**

Nav cards are compact, warm, visually distinct cards with:
- A 2–2.5px left border in a colour that indicates direction type:
  - **Burnt copper** (`rgba(180,100,40,.7)`) — BACK / exit
  - **Sky blue** (`#7ab8c8`) — settlement, exploration, forward
  - **Burnt orange** (`rgba(200,100,40,.7)`) — dungeon, danger
- Location name in **Cormorant Garamond italic**, ~11px, `#c8b890`
- Sub-label below: "type · direction" in **Inter Tight**, ~7.5px, `#5a4828`
- Card background: `#111009`, subtle border `#222015`, border-radius 6–7px
- Padding: ~7–8px 10px
- The section header above all cards: "Where to go" in Inter Tight 7px uppercase muted

**Do NOT group cards into columns labelled BACK / DEEPER / PEER / UNDISCOVERED.** These are internal navigation categories from CLAUDE.md rule 72. They should be invisible to the player. The visual grouping is the left-border colour only.

**Unknown/undiscovered paths:** Dashed border, very dim opacity (~50%), "unexplored · direction" label.

Cards dim during loading (pointer-events disabled). They must NOT take up the full story panel width in a way that dominates the feed.

---

## Group D — Story Feed + Arrival Format

**What is wrong:** When arriving at a location, a large centred heading block ("Contract Crossing / SETTLEMENT") sits inside the story feed as a dominant visual element. The breadcrumb ("THE PAPER GRAVES › CONTRACT CROSSING") is in the right place (below the location header inside the feed) but the visual treatment is wrong.

**What the spec says (Section 5):**

Scene arrival format:
```
[thin rule — 0.5px #252018]
◆ settlement  [small type label in genre accent]
Contract Crossing  [italic Cormorant Garamond, ~14px, #e2cda0]
The Paper Graves  [very small muted region label]
[thin rule]
[prose begins]
```

The arrival block is a subtle scene-break, not a dominant heading. The large centred heading box needs to be removed or dramatically reduced.

**Attune button:** Currently floating inside the story feed with no home. This is not a designed surface yet. For now, move it to the Context Panel as a tappable action entry, or place it in the top bar as a small icon. It must not live freestanding in the story feed.

---

## Group E — Context Panel (Left Sidebar)

**What is wrong:**
- Object entries are plain text rows with an "EXAMINE" pill — not in contained cards
- Atmosphere text is too dim to read
- Section headers have no left accent bar treatment
- NPC entries (when present) are not in cards

**What the spec says (Section 18):**

**Atmosphere prose:** Cormorant Garamond italic, 11px, `#9a7e52`. Source from WorldBible/RegionBible — no LLM call.

**"HERE NOW" section header:** 2px vertical line in genre accent (opacity .7) + Inter Tight italic label. For Fantasy: "Here now" in italic. Hidden entirely if no NPCs.

**Each NPC card:**
```
background: rgba(196,148,58,.06)
border: 1px solid rgba(196,148,58,.16)
border-radius: 7px
padding: 8px 10px
```
Inside: 6px disposition dot (green for warm, muted amber for neutral, etc.) + name in Cormorant Garamond italic 12px `#d4bc88` + role/disposition in Inter Tight 11px `#7a6040`.

**"IN THIS SPACE" section header:** Same accent bar treatment. Objects only appear after discovered in story feed (progressive reveal). Not all shown on arrival.

**Each object card:**
```
background: rgba(196,148,58,.04)
border: 1px solid rgba(196,148,58,.12)
border-radius: 7px
padding: 7px 10px
```
Inside: Tabler icon (muted) + name in Cormorant Garamond italic 12px `#d4bc88` + action pill right-aligned (Search / Read / Examine / Use in genre accent pill).

**Location header:** Name in Cormorant Garamond italic 12–13px `#e2cda0` + type badge (Inter Tight, genre accent pill).

**Context Panel width:** Must be 196px at ≥1280px viewport, 160px at 1024–1279px. If it's currently wider (e.g. 280px due to LogBook sharing), this coupling needs to be resolved. The LogBook or any other shared concern needs its own surface — it must not inflate the context panel width.

---

## Group F — Character Panel (Right Sidebar)

**What is wrong:**
- Pack items are tiny illegible thumbnails — no names visible
- No item stats shown in pack or equipped section (partially correct on equipped, but wrong font)
- Panel may be too wide (same LogBook coupling issue as context panel)
- Stat row appears to be multi-column layout rather than single inline row

**What the spec says (Section 13 + Section 20):**

**Panel width:** 196px at ≥1280px, 160px at 1024–1279px.

**Attribute block:** Single inline row of 5 cells. No grid. Never any empty cells.
```
[STR 8] [AGI 9] [INT 13] [PER 11] [CHA 10]
```
Each cell: number in JetBrains Mono 15–18px `#cbb888` (neutral — same for all stats, never colour-coded per stat type) + label in Inter Tight 6px uppercase below. Subtle same-tone border around each cell.

**Equipped items:** 3 slots always shown (Weapon / Armour / Accessory). Each shows:
- Tabler icon + item name in Cormorant Garamond italic 10px `#9a8060` + abbreviated stat in JetBrains Mono `#c4943a` right-aligned (e.g. `d6+1` for weapons, `+2 arm` for armour).

**Pack inventory:** 3-column compact grid. Each cell: 13px icon + 6px abbreviated name below in Inter Tight `#7a6040` + count badge top-right (only if count > 1). No empty placeholder cells — grid only renders actual items.

**Item stat colours (per Section 20):**
- Weapon damage: `#c4943a` amber, JetBrains Mono
- Heal amounts: `#7abb7a` green, JetBrains Mono
- Accessory stats: `#a888c8` purple, JetBrains Mono

**Pack item tap → inline detail:** Tapping a pack item expands a detail card directly below the grid, within the same viewport. No scrolling required. Shows full item name, stat, type/rarity, action buttons (Use/Equip/Read/Drop as appropriate).

**HP bar:** 8px tall, colour states:
- 75–100%: `#4a8a4a`
- 50–75%: `#5a9450`
- 25–50%: `#a87830`
- 10–25%: `#c84830`
- ≤10%: `#e03030`, pulsing

**XP bar:** 3px tall, genre accent colour, thin — clearly secondary to HP.

---

## Group G — NPC Dialogue Modal

**What is wrong:**
- The dialogue modal takes up the entire story feed area — it is not a constrained overlay
- Only 2 dialogue options are showing when there should be exactly 4 content slots
- The options do not have the correct card treatment

**What the spec says (Section 10):**

The NPC dialogue is a **constrained modal overlay** that sits above the story feed, not a replacement for it. It has:
- A fixed NPC header card at top (avatar circle with initials, name, role, disposition bar)
- A scrollable conversation feed
- Exactly **4 content slots** for dialogue options — never more, never fewer
- A persistent "End conversation" button below the slots — outside the slots, always visible

**Why only 2 showing:** This is a filtering bug. Something is incorrectly hiding 2 of the 4 generated options. Investigate the dialogue option generation and display logic. The spec explicitly states all 4 slots are always populated if options exist.

**Option types and visual treatment:**
- Standard options: no badge, Cormorant Garamond italic
- Stat-gated (CHA/STR): amber badge showing odds ("CHA · Good odds" / "Risky" / "Long shot") — always tappable, never locked
- Observation (PER/INT): teal badge + eye icon, teal-tinted background — always tappable

The modal must be visually constrained — it should not expand to fill the full content area.

---

## Group H — Top Bar

**What is wrong:** Icons (Codex, Journal, Map) and the character pill are too small. Touch targets are undersized. Font on the character pill and breadcrumb needs correcting.

**What the spec says (Section 17):**

- Top bar height: 44px desktop, 52px mobile
- All icons: 15px visual size, but 44px minimum tap target (pad the hit area)
- Logo: "✦ Endless Worlds" in Cormorant Garamond italic, 13–14px, genre accent `#c4943a`
- Genre tag pill: Inter Tight 11px, uppercase, genre accent text + background + border
- Breadcrumb: Region `#5a4828` → current location `#a08060`, separator `#3a2a18`
- Verbosity toggle (Terse/Standard/Rich): Inter Tight 11px, active state has genre accent colour + background tint + border
- Character pill: 24px avatar circle (class icon in genre accent) + character name in Inter Tight 11px `#c0a878`. Pill shape, `rgba(accent,.1)` background.

Top bar background: `#141210` always — never changes with genre.

---

## Group I — Chronicle / Quest Log

**What is wrong:**
- Quest objective text is ALL CAPS ("A DYING CLERK IN CONTRACT CROSSING WHISPERS THAT...") — should be normal narrative sentence case
- Quest tab labels (SIDE QUESTS, COMPLETED, FAILED) are too muted/unreadable

**What the spec says (Section 12):**

Quest objectives use **narrative language in normal sentence case** — they read like a journal entry, not a database field. "Find the clerk who sent the message." Not "FIND THE CLERK WHO SENT THE MESSAGE."

Day headers format: "— Day the First —" (Fantasy). This is already rendering correctly per the screenshots — keep it.

Chronicle entry typography (Cormorant Garamond italic, `#b0956a`) appears largely correct — preserve it.

Tab labels: Active tab should be clearly differentiated from inactive. Genre accent underline or colour on active tab.

---

## Group J — World Intro Cinematic

**What is wrong:** The opening cinematic text is hard to read — insufficient contrast against the background.

**What the spec says:** The World Intro Cinematic Modal (CLAUDE.md rule 42) should have:
- Backdrop: `rgba(0,0,0,.82)` 
- Modal card with clearly readable text
- Title/world name prominent
- Prose in Cormorant Garamond italic at adequate size (15–16px minimum) with good contrast
- Consider a subtle background tint behind the text block if the backdrop alone isn't enough contrast

---

## Group K — Map Renderer

**Critical clarification:** The map was fully designed in Section 7 of `docs/ui-design-reference.md`. The decision to keep the "existing renderer" in Chat 4 was incorrect. The map needs to be redesigned per spec.

**Current state:** The existing Canvas renderer draws dot-and-line node graphs for all map tiers. This is not the spec.

**What the spec says (Section 7):**

All maps use HTML5 Canvas. SVG was considered and abandoned.

**Settlement map (LOCAL tier — most important to fix first):**
- Bird's-eye view
- No enclosing ring
- Building footprints (rectangles with door marks, top-down)
- Central well or landmark feature
- Dirt roads: ~5.5px, warm brown, quadratic bezier curves, lighter centre stripe
- Trees/natural features at periphery
- Each known location has a distinct building footprint
- Current location highlighted

**Region map (REGION tier):**
- Node map showing settlements and landmarks
- Icons at 0.58 scale per node type (castle, ruins, shrine, etc.)
- Organic curved paths between nodes
- Fog for unknown/unvisited edges

**World map (WORLD tier):**
- Continent polygon with coastline stroke
- Territory divisions using organic bezier curves
- Fog only at canvas edges, not over internal borders

**Dungeon map (DUNGEON tier):**
- Dark stone background: `#0f0b07` with organic grain texture
- Explored rooms: warm amber-tinted rectangles
- Unexplored: near-black with fog
- Current location: torch glow radial effect
- No grid

**Map placement:** On desktop, opening the Map should replace the **center column** content, NOT the left context panel. Left and right panels remain visible. The top bar breadcrumb updates to show "Map".

---

## Group L — Misc Bugs

1. **Name generator regeneration:** Tapping the regenerate/random button after the first name generation doesn't produce a new name. Fix the handler so it generates fresh on every press.

2. **Motivation screen:** Step 6 of character creation (Motivation) needs to be visually implemented. It's a freeform text input step — text area in Cormorant Garamond italic, simple prompt above it, Back/Next buttons.

3. **Nav card "ATTUNE" button:** Has no designed surface. Temporarily place it as a tappable entry in the Context Panel "In this space" section until a permanent surface is designed. It must not live floating in the story feed.

---

## What "Good" Looks Like

When these fixes are complete, the game should feel:
- **Warm and atmospheric** — amber golds, dark warm browns, not cold black
- **Typographically distinct** — italic serif prose vs clean Inter Tight labels vs monospace numbers. Three different registers visually
- **Contained** — every interactive element lives in a proper card with background, border, and radius. Nothing floats on plain dark background
- **Readable** — all prose at adequate contrast. Context panel atmosphere text readable. Pack item names visible

Screenshots from the design session are in the `docs/ui-design-reference.md` file — the design doc contains the written spec, not screenshots, but the interactive mockups were reviewed and approved. The spec is authoritative.

---

## What NOT to Change

- CLAUDE.md rules — do not modify any game logic rules
- `nav-cards.ts` pure functions — only the presentation layer changes
- The Story Feed Colors token system (`--hl-region`, `--hl-loc`, player action teal `#7ab8c8`, etc.) — these coexist with the design doc's prose styling, do not overwrite
- Combat logic, inventory engine, loot engine — UI only
- jest test baseline: 626 tests must continue passing

---

## Recommended Prompt Sequence for Claude Code

Send one group at a time. Do not batch multiple groups into a single prompt — the risk of collision is too high.

**Prompt 1:** "Read CLAUDE.md and docs/ui-design-reference.md. Then read docs/ui-fix-brief.md. Implement Group A (Foundation): font system, genre visual system, background colours, Fantasy accent colour. Investigation-before-patching. tsc clean, jest 626, next build before committing."

**Prompt 2:** "Group B: Character creation screens — all steps. Card containers, correct fonts, trim descriptions to 2–3 sentences, selected states, name generator regeneration bug, motivation screen."

**Prompt 3:** "Group C: Nav cards — complete visual rebuild per Section 6 of design doc. Left-border colour coding, compact cards, Cormorant Garamond names, correct sub-labels. No column grouping."

**Prompt 4:** "Group D + E: Story feed arrival format + Context panel (NPC cards, object cards, section headers, contrast)."

**Prompt 5:** "Group F: Character panel — pack grid legibility, item stats, stat row layout, panel width."

**Prompt 6:** "Group G + H: NPC dialogue (constrain size, fix 4-slot bug) + top bar sizing."

**Prompt 7:** "Group I + J: Chronicle quest objective case + tab contrast. World intro cinematic contrast."

**Prompt 8:** "Group K: Map renderer — implement all 4 tiers per Section 7 of design doc. Settlement map first."

**Prompt 9:** "Group L: Misc bugs — attune button, remaining small fixes."
