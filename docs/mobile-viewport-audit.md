# Mobile Viewport Audit — Polish Round 4b

**Date:** V8.44 (Polish Round 4b)
**Primary viewport:** 380 × 844 px (iPhone SE / Pixel 7 baseline)
**Secondary viewport:** 768 px width (iPad portrait / large phone landscape)
**Desktop baseline:** ≥1024 px — must NOT regress

Two categories of outcome per surface:
- **Inline fix** — low-risk, single-property CSS or touch-target bump; applied in this round.
- **Defer** — requires layout redesign; documented here, actioned in a dedicated follow-on round.

---

## A. Game layout shell

**Files:** `components/layout/GameLayout.tsx`

| Check | Result |
|---|---|
| Desktop 3-col (map 320 \| story flex-1 \| sidebar 280) | ✅ PASS |
| Mobile sidebar accessible via hamburger → right-slide drawer | ✅ PASS |
| Mobile map accessible via floating ◆ MAP pill (`bottom: 88, left: 16, md:hidden`) | ✅ PASS |
| Header MAP / CODEX buttons: `min-h-[44px] sm:min-h-0` on mobile | ✅ PASS — explicitly touch-safe |
| Sidebar drawer at 288 px, `h-[calc(100vh-3.5rem)]` — scrollable | ✅ PASS |
| Map bottom sheet: `fixed inset-x-0 bottom-0 z-40 h-[65vh]` | ✅ PASS |

**Status: PASS. No fixes.**

---

## B. Story feed

**File:** `components/game/StoryFeed.tsx`

| Check | Result |
|---|---|
| Container padding: `px-4 py-4 md:px-8 md:py-6` — responsive | ✅ PASS |
| `overflow-y-auto` scroll — CSS containment audit item 12 cleared | ✅ PASS |
| Prose text wraps naturally at 380 px; no horizontal overflow detected | ✅ PASS |
| Processing indicator row text at `text-[11px]` — readable | ✅ PASS |
| ASCII art block uses `overflow-x-auto` — scrolls, does not break layout | ✅ PASS |

**Status: PASS. No fixes.**

---

## C. Navigation bar

**File:** `components/game/NavigationBar.tsx` + `app/globals.css`

| Check | Result |
|---|---|
| `.ew-nav-cols` outer container: `overflowX: "auto"`, `overflowY: "visible"` | ✅ PASS — rule 70 compliant |
| Hidden scrollbar: `.ew-nav-cols` CSS in globals via `scrollbar-width: none` + `-webkit-scrollbar { display: none }` | ✅ PASS |
| Card height 64 px — exceeds 44 px touch target minimum | ✅ PASS |
| Mini-col grid cards 140 px wide — scrolls horizontally on narrow screens as designed | ✅ PASS |
| Column framing border + direction label — visible at 380 px | ✅ PASS |

**Status: PASS. No fixes. Layout behaves as designed (horizontal scroll).**

---

## D. Combat panel

**Files:** `components/game/CombatMode/CombatMode.tsx`, `CombatantRow.tsx`, `ActionBar.tsx`

### What works
- Side-by-side player / enemy layout with `overflow: visible` on enemy container — rule 70 safe ✅
- `minHeight: "min(33vh, 360px)"` reserves space; on iPhone 14 (844 px) = 278 px strip
- 1-2 enemy encounters: each combatant row compresses to ~90–170 px wide, HP bar and description ellipsis — playable

### MAJOR ISSUE — 3+ enemies at 380 px
At 380 px, total CombatMode width after padding = ~356 px. Divided equally:
- Player column: ~170 px (portrait maxWidth 128 px + HP) — manageable
- Divider + gap: ~9 px
- Enemy column: ~177 px shared across all enemies

With 3 enemies each `maxWidth: 180` and `flex: 1`, each enemy gets ~59 px. The portrait silhouette is 59 px wide, HP bar labels clip immediately, enemy names are invisible. The layout breaks below usability threshold for encounters with 3+ enemies.

### ActionBar (minor, inline fix applied — see Surface I)
Button height was 34 px. Bumped to 44 px in this round.

### Recommendation
Flag for a dedicated **Mobile Combat Layout** round after Polish 4b. The fix likely requires switching to a stacked (vertical) layout for enemies on narrow viewports — e.g. `flex-direction: column` on the enemy container below a breakpoint, with a scrollable row. This is a non-trivial layout redesign and must not be done inline.

**Status: MAJOR ISSUE — combat panel restructuring deferred to Mobile Combat Layout round.**

---

## E. Floating damage numbers

**Files:** `components/game/CombatMode/CombatantRow.tsx`, useCombat via `floatingByActor`

| Check | Result |
|---|---|
| Float entry uses `position: absolute` above portrait, anchored in `CombatantRow`'s relative wrapper | ✅ PASS |
| Parent enemy container: `overflow: visible` (V8.40 fix, CSS audit item 2) | ✅ PASS |
| At 380 px with 3+ enemies: floats render above their respective compressed portraits; may visually overlap adjacent floats but do not get clipped | ✅ PASS (overflow: visible ensures visibility) |
| `animation-fill-mode: both` holds 0% keyframe during staggered delay | ✅ PASS |

**Status: PASS. Floats remain visible regardless of enemy count. Cosmetic overlap is an accepted trade-off until the Mobile Combat Layout round.**

---

## F. Inventory panel

**File:** `components/game/sidebar/InventoryPanel.tsx`

| Check | Result |
|---|---|
| Equip slot grid `grid-cols-3 gap-1.5` in 288 px drawer → ~86 px per slot, `aspect-square` | ✅ PASS |
| Pack grid `grid-cols-4 gap-1.5` → ~64 px per slot, `aspect-square` | ✅ PASS |
| Item detail panel description text at `text-[10px]` — small but readable in sidebar context | ✅ PASS |
| Drag-and-drop equip: drag events fire on mobile via touch events? Not verified — touch drag is generally problematic on iOS | ⚠️ NOTED — drag-equip may not work on iOS touch. Tap-to-select → Use/Equip button path remains available and works. Defer drag-touch investigation to dedicated session. |
| Item action buttons (Equip / Use / Drop): `py-1 px-2 text-[10px]` → ~22 px tall | ⚠️ MINOR — under 44 px touch target. These are secondary actions reachable only after tapping an item slot. Defer to Mobile Combat Layout / sidebar refinement round. |

**Status: MINOR issues only (drag-touch and action button height). Defer. Primary interactions (tap slot, tap button) functional.**

---

## G. Codex modal

**File:** `components/game/CodexModal.tsx`

| Check | Result |
|---|---|
| `fixed inset-0 z-50` — fills full screen at 380 px | ✅ PASS |
| Inner panel `w-full max-w-5xl` — fills viewport width at 380 px | ✅ PASS |
| `maxHeight: "96vh"` with internal `ew-scroll` scroll — content scrollable | ✅ PASS |
| ESC key closes via `useEffect` keyboard listener | ✅ PASS |
| Backdrop click closes | ✅ PASS |
| Close ✕ button: `text-xl font-mono` → ~24×24 px touch target | ❌ ISSUE — well under 44×44 px minimum |

**Inline fix applied:** Close button now has `minHeight: 44, minWidth: 44, display: "flex", alignItems: "center", justifyContent: "center"` → 44×44 px tap zone.

**Status: FIXED (close button). PASS otherwise.**

---

## H. World map

**File:** `components/game/WorldMap.tsx`

| Check | Result |
|---|---|
| `asSheet` prop: `width: "100%"`, rounded top corners, drag handle — bottom sheet layout ✅ | ✅ PASS |
| Map SVG area: `aspectRatio: "1"` at 380 px → 380×380 px canvas (larger than desktop 320 px) | ✅ PASS — better than desktop |
| Tier buttons (WORLD / REGION / LOCAL): `padding: "8px 0"` + 14 px icon + gap + 8 px label → ~45 px height | ✅ PASS — borderline, but meets 44 px minimum |
| Tier button width at 380 px: (352 − 12)/3 ≈ 113 px each — sufficient | ✅ PASS |
| Disabled LOCAL tier at region zones — dimmed, `cursor: "not-allowed"` | ✅ PASS |
| NPC dialogue buttons in info panel: `padding: "8px 10px"` → ~32 px tall | ⚠️ MINOR — under 44 px. Info panel is secondary browsing context; defer. |
| Landmark EXAMINE buttons: `padding: "6px 8px"` → ~28 px tall | ⚠️ MINOR — under 44 px. Secondary context; defer. |
| Location info panel: `padding: "14px 16px"`, `overflowY: "auto"` — scrolls | ✅ PASS |
| Atmosphere / title text at 13–18 px — readable at 380 px | ✅ PASS |

**Status: PASS with minor notes. Info-panel button heights flagged for a future sidebar/map refinement round.**

---

## I. Forms / inputs

**Files:** `components/game/InputBar.tsx`, `components/game/CombatMode/ActionBar.tsx`

### InputBar (out-of-combat action input)

| Check | Result |
|---|---|
| Input `fontSize: 16` — prevents iOS Safari auto-zoom on focus | ✅ PASS |
| Input + submit button both `minHeight: 52` — exceeds 44 px | ✅ PASS |
| Placeholder text wraps within input bounds | ✅ PASS |
| Character counter `text-[10px]` — not interactive, readable | ✅ PASS |
| Processing indicator `h-4` reserved height — no layout shift | ✅ PASS |

### ActionBar (combat action buttons)

| Check | Result |
|---|---|
| 4 buttons in a row, `flex: 1` — each ~89 px wide at 380 px | ✅ PASS (width OK) |
| Button height: `padding: "10px 12px"` + 11 px font → ~34 px tall | ❌ ISSUE — under 44 px by ~10 px |

**Inline fix applied:** ActionBtn padding bumped from `"10px 12px"` to `"14px 12px"`. Height: 14+14+16 ≈ 44 px. No layout restructuring required — ActionBar is self-contained within the CombatMode strip.

**Status: FIXED (ActionBar touch targets). InputBar PASS throughout.**

---

## J. Resolution banners

**File:** `app/globals.css`, `components/game/StoryFeed.tsx`

| Check | Result |
|---|---|
| `.combat-resolution-banner`: `font-size: 18px, text-align: center` — wraps cleanly at 380 px | ✅ PASS |
| `.combat-resolution-destination`: `font-size: 12px, font-style: italic` — readable, wraps | ✅ PASS |
| `.combat-turn-separator-label`: `font-size: 11px` — readable | ✅ PASS |
| Encounter banner `#f4a07a` light coral at 380 px — visible | ✅ PASS |

**Status: PASS. No fixes.**

---

## Inline fixes applied (this round)

| Surface | File | Change |
|---|---|---|
| G. Codex close button | `CodexModal.tsx` | Added `minHeight: 44, minWidth: 44, display: "flex", alignItems: "center", justifyContent: "center"` — 44×44 tap zone |
| I. ActionBar combat buttons | `ActionBar.tsx` | Padding `"10px 12px"` → `"14px 12px"` — height 34 px → 44 px |

---

## Deferred issues

| Surface | Issue | Recommended action |
|---|---|---|
| D. Combat panel | 3+ enemy layout breaks at 380 px — each combatant column < 60 px | Dedicated **Mobile Combat Layout** round. Switch to vertical-stack enemy list below a breakpoint. |
| F. Inventory panel | Item action buttons (Equip/Use/Drop) at ~22 px | Fold into Mobile Combat Layout / sidebar refinement round |
| F. Inventory panel | Drag-and-drop equip: touch-drag may not work on iOS | Investigate in sidebar refinement round; tap-to-select path is functional fallback |
| H. World map | NPC dialogue buttons ~32 px, EXAMINE buttons ~28 px | Map/sidebar refinement round |

---

## CSS containment — 4b update

From `/docs/css-containment-audit.md` (V8.40): 0 active risks, 5 future candidates. No new containment issues introduced in Polish 4b. The GameLayout mobile rail (`overflow-y-auto` + sidebar drawer) was flagged as a future candidate in V8.40 — no inventory tooltips added in 4b, still 0 active risk.
