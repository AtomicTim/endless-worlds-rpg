# Endless Worlds — Design Handoff

These files are the Claude Design output for the UI and map visual redesign.
They are HIGH-FIDELITY REFERENCES — not production code to copy directly.

## Files

| File | Role |
|---|---|
| `styles.css` | **Design tokens — port these verbatim into globals.css or tailwind** |
| `map-v2.jsx` | Fantasy + Cyberpunk map renderers (World/Region/Local) |
| `map-genres.jsx` | Space Opera, Post-Apoc, Horror map renderers |
| `map-sidebar.jsx` | The 320px sidebar shell (tier switcher + location info panel) |
| `ui-pieces.jsx` | StatPill, NavCard, Loc, Npc, Said, NarrativeBlock |
| `desktop-ui.jsx` | 1280×860 desktop layout reference |
| `mobile-ui.jsx` | 390×844 mobile layout reference |
| `extras.jsx` | DialogueModal, NavCardRow showcase |

## Key Notes

- The `window.ComponentName` globals in design files must be converted to React imports
- All static demo data must be wired to real Zustand store state
- Map renderers need props: `nodes`, `currentNodeId`, `onNodeClick`, `npcDots` etc.
- `data-genre` attribute on root element drives ALL color theming via CSS custom properties
- The `ew-pulse` CSS class drives the current-location animation
- SVG IDs (paper-warm, paper-fiber, cyber-glow etc) must be unique per-instance to avoid conflicts

## Implementation Order (from README)

1. Port tokens (styles.css) into globals.css
2. Add data-genre mechanism to app root
3. Build StatPill, Loc, Npc, Said inline text components
4. Build map renderers genre by genre (Fantasy first)
5. Build MapSidebar shell with tier switcher
6. Compose desktop layout then mobile layout
7. Wire DialogueModal last

## Navigation Bar Decision

- **Desktop**: Remove nav bar — map is always visible in left sidebar
- **Mobile**: Keep nav bar — map is hidden by default, nav bar is essential for one-tap navigation

## Map Toggle Button

- **Desktop**: No button needed — map is permanent left sidebar
- **Mobile**: Floating pill button bottom-left above input bar, labeled `◆ MAP`
