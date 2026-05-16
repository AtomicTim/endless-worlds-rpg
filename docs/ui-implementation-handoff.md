# UI Implementation Handoff — From Foundation to Visual Fidelity

**Status:** Foundation complete. PR-1 (canonical tokens + legacy purge) and PR-2 (semantic systems tokenization) shipped. ui-foundation jest suite at 0 failures across 4 sub-suites. 854 / 854 tests passing.

**Audience:** Any Claude (chat, Code, or Design) picking up the UI implementation work. Read this entire doc before writing or running any prompt.

---

## 1. What's already done

| PR | Commit | Outcome |
|---|---|---|
| PR-1 | 0be34aa | Canonical UI tokens added to globals.css (`--ui-text-*`, `--ui-border-*`, `--ui-bg-*`, `--npc-*`, `--breadcrumb-*`, `--chronicle-*`, `--stat-*`, `--combat-dot-tick`). Legacy `#f59e0b` purged from 4 map files. ui-foundation went 31 → 17 failures. |
| PR-2 | 6101441 | 42 semantic tokens added (POI markers, status effects, dialogue tones, codex entry types, observation badge, character sheet inks, loot rarity, action verbs, surfaces, cross-region nav). 16 component files refactored to consume them. ui-foundation went 17 → 0. |

**The verification harness lives at `lib/__tests__/ui-foundation.test.ts`.** It enforces:
1. No unauthorized hardcoded hex codes in any `components/game/**/*.{ts,tsx}` file
2. No forbidden legacy values (`#f59e0b`)
3. Required overlay trio (`.ol-tex`, `.ol-scan`, `.ol-grid`) on every scrollable surface
4. Genre class wiring on the GameLayout root

Run with: `npx jest ui-foundation`

**Foundation discipline is locked in.** Any future PR that tries to introduce shadow hexes will fail the test in CI.

---

## 2. The workflow that works

The two foundation PRs landed cleanly because we used a strict pattern. Future PRs must follow the same pattern.

### Per-PR flow

1. **Identify scope.** One surface, or one tightly-related group. Never multiple surfaces in one PR.
2. **Write a complete prompt** as a single copyable block following the template in §6 of this doc.
3. **Paste into Claude Code** — let it run the investigation step, make changes, run tests, commit.
4. **Verify yourself** with `npx jest ui-foundation` and visual inspection in the running app.
5. **Move to next PR.**

### Role split (per CLAUDE.md)

- **Tim** — Vision, product decisions, manual verification.
- **Claude.ai** — Architecture, design, prompt-authorship. **This is the role this doc serves.**
- **Claude Code** — Implementation. Executes prompts. Updates PROMPT-LOG.md.

If you're a Claude.ai instance reading this: your job is to write the prompts. Do NOT write the code yourself.

---

## 3. The design source of truth — and what to ignore

**Authoritative documents (in priority order):**
1. `docs/ui-design-reference.md` v3.3 — every visual decision lives here
2. The 23 mockup screenshots Tim provided in the original Design chat (see §7 for what they showed)
3. CLAUDE.md — game logic, architecture, rules (UI conflicts: ui-design-reference wins; game mechanic conflicts: CLAUDE.md wins)

**Resolved design conflicts (do NOT re-litigate these):**

- **Fantasy accent = `#c4943a`** — not `#f59e0b`. The legacy value is in the forbidden list.
- **Stats are NOT individually color-coded.** All stats render in `--attribute-value` neutral cream. The "STR copper / AGI green / INT blue" system in older spec versions was removed in V3.3.
- **Maps are CANVAS, not SVG.** Hand-drawn parchment aesthetic for Fantasy. Genre-specific styles per `components/game/map/renderers/*Map.tsx`.
- **Genre is BOTH color AND typography swap.** Fantasy/Horror use Cormorant Garamond italic; Cyberpunk uses monospace; Space uses tracked uppercase; Post-Apoc uses bold uppercase. See `globals.css` `.genre-* .ui-label` rules.
- **Context Panel has ONE structure at every depth** (Place / Settlement / Region all use the same PRESENT + INTERACT layout).
- **NPC Dialogue on mobile is a full-screen takeover, NOT a constrained modal.** Desktop can be modal; mobile is a screen.
- **Damage type colors are a dedicated subsystem** (Physical / Fire / Frost / Poison / Lightning / Shadow / Holy / Bleed / Heal — see screenshot "damage type colors.png" in design context). These are separate from status effect colors.

**Loading patterns (typewriter stream, atmospheric fragments, etc.) belong to `docs/loading-and-streaming-spec.md`** — split from ui-design-reference because they're behavioral, not visual. If that doc doesn't exist yet, treat it as a deferred backlog item.

---

## 4. Remaining work (PR-3 onward)

Tackle in this order. Each row is one PR. Each PR follows the template in §6.

| PR | Surface | Mockup screenshot | Reason for ordering | Est. complexity |
|---|---|---|---|---|
| 3 | `components/game/NavigationBar.tsx` | "nav cards" cluster + design ref §6 | Largest visual gap; contained; pure presentation | Medium |
| 4 | `components/game/StoryFeed.tsx` arrival format | design ref §5 + mockup combat panel mobile | Scene arrival is a dominant heading box — should be subtle scene-break (thin rule + ◆ + name + rule) | Medium |
| 5 | `components/game/sidebar/CharacterPanel.tsx` | "character panel fantasy.png", "inventory and character panel.png", "inventory.png" | Pack grid legibility, single inline attribute row, equipped item stats inline, item detail expand inline | Medium-high |
| 6 | `components/game/sidebar/CharacterSheet.tsx` (if separate from CharacterPanel) | Same as above | Coordinated with PR-5 if both exist | Low |
| 7 | `components/game/DialogueModal.tsx` | "npc dialogue mobile.png" | Mobile must be full-screen takeover; 4 option slots; persistent END CONVERSATION | High |
| 8 | `components/game/CodexContent.tsx` + `CodexModal.tsx` | "codex mobile.png" | Section dividers (not accordions); type colors via tokens (PR-2 added these) | Medium |
| 9 | `components/game/JournalModal.tsx` (Chronicle) | "quest and journal mobile.png", "quests cyberpunk.png", "quests space.png" | Quest objectives in sentence case, not ALL CAPS; per-genre typography registers | Medium |
| 10 | `components/game/LevelUpModal.tsx` | design ref §14 + "ability panel expanded, mobile.png" | Stage flow per spec; uses --action-buff token (PR-2 added) | Medium |
| 11 | `components/game/CombatMode/*` | "combat desktop.png", "ocmbat panel, mobile.png", "turn resolution timing.png", "health bar and damage numbers.png" | Timing diagram is implementation-ready; damage number arc not yet built; HP bar states already token'd | High |
| 12 | `components/game/loot/*` + `FloorLootStrip.tsx` | "loot panel.png" | Item card spec is exhaustive in design ref §20 | Medium |
| 13 | `components/game/TradeModal.tsx` | (no dedicated mockup; design ref + merchant rules in CLAUDE.md) | Buy/Sell tabs, trust pricing display, type pills | Low |
| 14 | `components/game/AttunementModal.tsx` | (no mockup) | Ability slot model per CLAUDE.md rules 164-168; spec-driven not mockup-driven | Medium |
| 15 | `components/game/InputBar.tsx` + `VerbosityToggle.tsx` | design ref §17 | Top-bar verbosity toggle + input bar polish | Low |
| 16 | Save slots screen + Main Menu | "save slots.png", "genre select mobile.png" | Splash flow per design ref §19; ambient genre cycle animation | Medium |
| 17 | `components/game/map/renderers/*` | "world map.png", "reigon map.png", "settlement map.png", "dungeon map.png" | Hand-drawn parchment aesthetic per genre; canvas-only; biggest visual transformation; may need multiple sub-PRs | Very high |

After PR-17, the visual implementation is complete and matches the mockups.

---

## 5. The verification harness — keep it tight

`lib/__tests__/ui-foundation.test.ts` has an `ALLOWED_HEX_CODES` set. Every PR that adds a new semantic system MUST:

1. Add the new tokens to `app/globals.css` (inside `:root`, additively)
2. Refactor components to consume via `var(--token-name)`
3. Add the canonical hex values to `ALLOWED_HEX_CODES` in the test (with a comment header naming the system)
4. Run `npx jest ui-foundation` → must remain green

**Never** add a hex to `ALLOWED_HEX_CODES` without also adding the corresponding token to globals.css. The allow-list exists so the test can scan globals.css canonical definitions without false-positiving on them — not as a back-door for hardcoded values.

If a PR is purely layout/spacing/typography (no new colors), no token changes are needed. Just verify the existing test still passes.

---

## 6. Prompt template for PR-3+

Copy this scaffold for every visual-fidelity PR. Fill in the bracketed sections.

```
─────────────────────────────────────────────────────────────────────
TASK: [PR-N name — e.g. "NavigationBar visual refactor"]

CONTEXT:
[2–3 sentences: what surface, what's wrong now, what we want.
Reference the mockup screenshot by filename if applicable.
Reference the design ref section number(s).]

This is part of the post-foundation visual refactor track. ui-foundation
must remain 100% green. PR-1 (commit 0be34aa) and PR-2 (commit 6101441)
established the token system; this PR uses those tokens to fix visual
fidelity without introducing new ones (unless a new semantic system is
discovered — in which case add to globals.css + test allow-list per
the §5 workflow in docs/ui-implementation-handoff.md).

─────────────────────────────────────────────────────────────────────
INVESTIGATION FIRST (per CLAUDE.md V8.40 protocol)
─────────────────────────────────────────────────────────────────────

1. git fetch origin && git log origin/main --oneline -5
2. npx jest ui-foundation                  ← must be green pre-edit
3. Read the current implementation: [file path]
4. Read design ref §[N]
5. Read PROMPT-LOG.md for current jest baseline
6. Re-read this prompt's "DO NOT" section

─────────────────────────────────────────────────────────────────────
CHANGES
─────────────────────────────────────────────────────────────────────

(A) [Component-level change description]
    Target structure (matching mockup):
      [Describe layout, spacing, sizes, fonts, borders, animations]
    Tokens to consume:
      [List the var(--token) references — pull from globals.css]
    Props / state changes (if any):
      [List, with rationale]

(B) [Additional changes if needed]
    …

NEW TOKENS (only if a new semantic system is required):
   [If yes, list them — add to globals.css per §5 workflow. If no,
    omit this section entirely.]

─────────────────────────────────────────────────────────────────────
VERIFICATION
─────────────────────────────────────────────────────────────────────

1. npx jest ui-foundation                  ← still 100% green
2. npx jest                                ← no baseline regression
3. npx tsc --noEmit                        ← clean
4. npx next build                          ← succeeds
5. Visual check: start the dev server, navigate to [surface],
   verify it matches the mockup at [screenshot filename]. Capture
   any visual discrepancies and resolve before commit.

─────────────────────────────────────────────────────────────────────
COMMIT
─────────────────────────────────────────────────────────────────────

Title: "UI-PR[N]: [surface] visual refactor"
Body: bullet list of layout/spacing/typography changes, props/state
changes, screenshot of before/after if available.

Update PROMPT-LOG.md per CLAUDE.md rule 91.

─────────────────────────────────────────────────────────────────────
DO NOT
─────────────────────────────────────────────────────────────────────

- Touch any component NOT named in this PR.
- Introduce new hex codes without adding them to globals.css + the
  ui-foundation allow list.
- Modify the Story Feed Colors token system (CLAUDE.md rule 17).
- Refactor game logic, props, hooks, or state management unless
  explicitly listed in CHANGES above.
- Skip the npx jest ui-foundation check.
- Touch the verification harness file except to add tokens
  introduced by this PR.

─────────────────────────────────────────────────────────────────────
SUCCESS CRITERIA
─────────────────────────────────────────────────────────────────────

✓ ui-foundation suite: 100% green.
✓ jest baseline: unchanged or net additions only.
✓ tsc + next build: clean.
✓ Visual match to mockup [screenshot filename].
✓ Commit + PROMPT-LOG.md updated.

─────────────────────────────────────────────────────────────────────
```

---

## 7. Mockup screenshot reference

Tim provided 23 mockup screenshots in the Design chat. They are the visual source of truth for PR-3+. If the screenshots aren't in the repo, ask Tim to upload them to `design/mockups/` so future Claude chats can reference them.

Key files and what they cover:

- `context panel.png` — three-context layout (Place / Settlement / Region) with PRESENT + INTERACT
- `character panel fantasy.png` — HP/XP bars, single inline attribute row, equipped + gold
- `inventory and character panel.png` — mobile character sheet with portrait + pack grid
- `inventory.png` — pack inventory detail view with log book section
- `combat desktop.png` — 5 buttons horizontal, 3 combatants with CRIT state
- `ocmbat panel, mobile.png` — mobile combat panel, 2×2 + full-width Abilities, inline combat log entries above
- `turn resolution timing.png` — full 0ms → 3000ms timing breakdown
- `health bar and damage numbers.png` — HP state bands + damage arc trajectories
- `damage type colors.png` — 9-type subsystem (separate from status effects)
- `button accents.png` — per-genre button accent treatment
- `npc dialogue mobile.png` — full-screen takeover with header, NPC card, 4 option slots, persistent END CONVERSATION
- `quest and journal mobile.png` — Chronicle screen with QUESTS / JOURNAL tabs, sentence-case objectives
- `quests cyberpunk.png` + `quests space.png` — per-genre typography variants of the quest log
- `codex mobile.png` — tabs with type-colored left borders (people/places/lore/events)
- `loot panel.png` — combat resolved → search the remains, plus Pack full state
- `ability panel expanded, mobile.png` — 2×2 ability cards with type icons
- `save slots.png` — mobile + desktop genre-tinted slot cards
- `genre select mobile.png` — per-genre typography on the splash
- `world map.png` + `reigon map.png` + `settlement map.png` + `dungeon map.png` — hand-drawn parchment Fantasy map per tier

---

## 8. Workflow for the human in the loop (Tim)

Per chat session:

1. Open this doc or send to the assistant: "Read docs/ui-implementation-handoff.md, then we'll work on PR-N."
2. Confirm which PR from §4 you want to work on.
3. The assistant produces a single copyable prompt block following §6.
4. You paste it into Claude Code (CLAUDE.md role split).
5. Claude Code runs it, commits, reports back.
6. You run `npx jest ui-foundation` yourself, confirm green.
7. Visually inspect the surface in the dev server. If it doesn't match the mockup, paste the discrepancy back to the assistant; they produce a follow-up prompt.
8. Move to next PR.

Per week:
- Aim for 2–3 PRs landed. Each PR should be one chat session of ~5–10 messages.
- If a PR exceeds 10 messages or 2 Claude Code rounds, it's too big — split it.

---

## 9. Why this works (and why the previous audits failed)

The previous two audit attempts failed because they tried to fix everything at once, with no verification gate. Each fix was plausible in isolation but the system drifted overall.

This methodology works because:
1. **Token discipline is enforced by code, not memory.** The ui-foundation test means no PR can silently drift.
2. **Each PR is one surface, one prompt, one commit.** Atomic, reviewable, reversible.
3. **The token system is now complete.** PR-3+ never needs to invent values — only consume.
4. **The mockups are the visual source of truth.** Not the assistant's interpretation, not the spec's prose — the screenshots.
5. **The DO NOT list in every prompt prevents scope creep.** Claude Code follows it.

Trust the process. The foundation is real. The remaining work is execution.

---

*End of handoff document.*
