# CSS Containment Audit — Polish Round 4a

**Date:** V8.40 (Polish Round 4a, TASK 5)
**Lesson reference:** V8.40 foundational rule 70 — `overflow: auto/scroll/hidden` on a parent silently clips absolutely-positioned descendants. Per CSS spec, `overflow-x: auto` automatically promotes `overflow-y` to `auto`. This bit us once: V8.38's `overflowX: auto` on the enemy row in CombatMode clipped floating-damage numbers that anchored ABOVE the portrait. Fix landed in V8.40 by switching to `overflow: visible`.

This audit is documentation only. **No fixes applied in this round.** When a future polish round touches a flagged region, revisit the container and either widen the parent's overflow OR move the floating element to a portal.

## Methodology

```
grep -rnE "overflow[XY]?:\s*['\"](auto|scroll|hidden)['\"]" components/ app/
grep -rnE "overflow-(auto|scroll|hidden|y-auto|x-auto|y-scroll|x-scroll)" components/ app/
grep -rnE "position:\s*['\"]absolute['\"]" components/
grep -rE "className=.*absolute" components/
```

Each container below was cross-checked for descendants using `position: absolute` with offsets that could extend past the container's box.

---

## Findings — inline-style overflow

### 1. `components/game/CombatMode/CombatantRow.tsx:142, 165` — `overflow: "hidden"`
Combatant row name/HP-bar ellipsis containers. Internal text clipping only.
- **Risk:** none.

### 2. `components/game/CombatMode/CombatMode.tsx:288` — `overflow: "visible"` (enemy row, FIXED in V8.40)
Already corrected — this was the V8.40 root-cause site. Floating damage numbers anchor above the enemy portraits and now render correctly.
- **Risk:** none (locked in).
- **Note:** the comment at line 273-279 explicitly forbids reintroducing `overflowX: auto` here. Anyone touching this block must read that comment.

### 3. `components/game/CombatMode/HPBar.tsx:55` — `overflow: "hidden"`
HP bar fill container — clips the inner gradient to the bar's width. Intentional.
- **Risk:** none.

### 4. `components/game/CombatMode/PortraitSlot.tsx:57` — `overflow: "hidden"`
Portrait silhouette mask. **Flag:** if a future combat-mode tooltip / status-effect icon needs to render ABOVE or BESIDE the portrait, it'd be clipped here. The float-damage number is anchored at the row level (parent of PortraitSlot), so it's unaffected.
- **Risk:** low for current UI.
- **Future candidate:** status-effect badge popups, ability-cooldown rings that extend past the portrait box.

### 5. `components/game/CombatMode/UseItemPicker.tsx:91` — `overflowY: "auto"`
Item picker scroll list. No absolutely-positioned children.
- **Risk:** none (today).
- **Future candidate:** "item tooltip" on hover would clip if added inside the scroll pane. Use a portal for that.

### 6. `components/game/DialogueModal.tsx:244` — `overflow: "hidden"`
NPC portrait chip mask. Intentional silhouette clipping.
- **Risk:** none.

### 7. `components/game/NavigationBar.tsx:107, 357, 367, 395` — multiple `overflow: hidden`
Breadcrumb + card title/badge text ellipsis. Polish 4a TASK 1 added per-direction row containers; the text-level clips inside cards are still intentional ellipses with no absolute children.
- **Risk:** none.

### 8. `components/game/WorldMap.tsx:133` — `overflow: "hidden"` (sidebar)
Top-level map sidebar wrapper. Contains the genre SVG (which self-clips inside its 0..VIEW viewBox) and the location info panel.
- **Risk:** none for current SVG renderers.

### 9. `components/game/WorldMap.tsx:269` — `overflowY: "auto"` (info panel scroll)
Scrolling location info panel. No absolutely-positioned children.
- **Risk:** none.

### 10. `components/game/WorldMap.tsx:382, 481` — `overflow: "hidden"` (text ellipsis)
Two intentional text ellipses inside NPC / landmark rows.
- **Risk:** none.

### 11. `components/game/map/WorldMapTier1.tsx:454` — `overflow: "hidden"`
Tooltip card multi-line description clip (`-webkit-line-clamp: 2`). The down-pointing arrow below the tooltip card uses `position: absolute; bottom: -5` — that arrow is INSIDE the tooltip's own positioned ancestor, not inside this clip. Verified safe.
- **Risk:** none.

---

## Findings — Tailwind overflow classes

### 12. `components/game/StoryFeed.tsx:131` — `overflow-y-auto`
Main story-feed scroll container. **High-attention area** because future features may want floating elements:
- Floating combat-damage numbers are emitted at the CombatMode layer (separate scroll context), not the story feed. Verified safe today.
- If we later add inline reaction icons or tooltips on highlighted spans (item hover for stats, NPC hover for trust), they'd clip if positioned absolutely INSIDE message rows. Use a portal.
- **Risk:** low today. Flagged for any future feature that adds floating overlays inside message rows.

### 13. `components/game/StoryFeed.tsx:354` — `overflow-x-auto` (ASCII art)
Horizontal scroll for ASCII pre tags. No absolute children.
- **Risk:** none.

### 14. `components/game/map/WorldMapTier1.tsx:114`, `WorldMapTier2.tsx:137`, `WorldMapTier3.tsx:197` — `overflow-auto` (map viewports)
Scrolling viewports for the world / region / local grids. Each contains a `<div className="relative">` with absolutely-positioned tile markers + optional tooltips. The tooltip arrow extends 5px below the tooltip card but the tooltip card itself sits inside the same `relative` ancestor, which sits inside this scroll viewport. The arrow won't clip because the tooltip is large enough that 5px is well within the card; the scroll viewport only clips if the tooltip card itself overflows the grid bounds (rare — grids are large).
- **Risk:** low.
- **Future candidate:** if tooltips ever render near the viewport edge, they could get clipped. Switch to portal positioning then.

### 15. `components/game/sidebar/LogBook.tsx:80` — `overflow-y-auto`
LogBook entries scroll. No absolutely-positioned children.
- **Risk:** none.

### 16. `components/game/sidebar/SidebarPanel.tsx:68` — `overflow-hidden`
Collapsing sidebar transition wrapper. Part of slide animation.
- **Risk:** none.

### 17. `components/game/sidebar/CharacterSheet.tsx:41` — `overflow-hidden`
HP/XP fill bar clipping. Intentional.
- **Risk:** none.

### 18. `components/game/TradeModal.tsx:51, 92, 142` — `overflow-hidden` + `overflow-y-auto`
Modal frame + inventory scroll panes. No absolutely-positioned children today.
- **Risk:** low.
- **Future candidate:** "+1 gold / -1 gold" floating numbers on buy/sell would clip if added inside the scroll pane. Same pattern as combat — use `overflow: visible` on the row level, or float at the modal level.

### 19. `components/layout/GameLayout.tsx:95, 272, 308, 347, 363` — multiple `overflow-hidden` + `overflow-y-auto`
Top-level layout frame + sidebar collapse + mobile sheet rail. These are structural — clipping is desired so the outer viewport never scrolls. Modals + dialogue use `position: fixed` to escape.
- **Risk:** none for current UI.
- **Future candidate:** line 363's mobile rail is `overflow-y-auto`. If we ever add absolutely-positioned tooltips inside rail content (e.g. inventory item hover), they'd clip. Polish Round 4b (mobile) is a natural moment to revisit.

### 20. `components/ui/dropdown-menu.tsx:44, 62` — Radix dropdowns
Shadcn/Radix wrappers. Both `overflow-hidden` (line 44, menu content frame) and `overflow-y-auto overflow-x-hidden` (line 62, available-height variant). Radix handles its own portal positioning; absolutely-positioned children inside the menu render correctly because they're scoped within the menu content frame and don't try to escape it.
- **Risk:** none.

### 21. `app/(marketing)/page.tsx:30` — `overflow-hidden`
Marketing page wrapper for background animations.
- **Risk:** none.

### 22. `app/game/codex/page.tsx:191` — `overflow-y-auto`
Codex page scroll (legacy route; V8.40 moved codex into a modal but the page still exists for direct URL access).
- **Risk:** none.

---

## `position: absolute` audit (inside scrolling containers)

Only the following absolutely-positioned children sit inside scrolling containers, and all have been verified:
- `WorldMapTier1.tsx:464` — tooltip arrow inside grid viewport. Verified safe (#14 above).
- Tooltip cards themselves on world-map grids — render inside the relative grid container; verified safe.
- Floating combat damage (V8.40 `makeFloatingEntry`) — rendered inside `CombatantRow`'s absolutely-positioned wrapper which sits inside the enemy row's `overflow: visible` flex container (#2 above). Working correctly post-V8.40 fix.

No other absolutely-positioned children inside scrolling containers found.

---

## Summary

- **Real risks:** 0 active.
- **Flagged future candidates** (revisit when feature ships):
  - **CombatMode PortraitSlot** — status-effect badges, ability cooldown rings (future combat-depth pass)
  - **StoryFeed scroll** — inline reaction / hover tooltips on message highlights
  - **TradeModal scroll panes** — +1/-1 gold floating numbers on buy/sell
  - **GameLayout mobile rail** — inventory tooltips in mobile sidebar (Polish 4b natural moment)
  - **WorldMap tier viewports** — edge-case tooltip clipping when grid is small
- **No fixes recommended in this round.**

The codebase's containment posture is healthy. The V8.40 lesson is internalized (enemy row uses `overflow: visible` explicitly with a guard comment). All other overflow usages are intentional text ellipses, modal frames, or scroll panes without absolute children.

When a future polish round touches any flagged candidate, either:
1. Set `overflow: visible` on the immediate parent of the floating element, or
2. Hoist the floating element to a portal anchored outside the scroll container.

Both patterns are already in use elsewhere in the codebase.
