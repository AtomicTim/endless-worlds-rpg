# Endless Worlds RPG — Project Log

**Purpose:** Living trajectory log. Contains round history, future feature ideas, detailed design notes, and open questions. Updated after every significant commit. Keeps CLAUDE.md lean.

---

## Future Feature Ideas (captured, not yet slotted)

**Encounter Avoidance / Stealth System (V8.41):**
Roll PER/AGI/stealth-skill vs enemy detection DC. SUCCESS: Avoid / Pre-emptive / Sneak / Environmental / Engage normally. FAIL: combat triggers.
*Dependencies:* Day 22 skills. *Slot:* Day 20.6. *Risk:* must not punish combat-built characters.

**EPIC/LEGENDARY Loot Reveal Animation (V8.46):**
Full-screen overlay on RARE+ find: item portrait fades in with animated border glow. Destiny exotic drop energy.
*Slot:* Post-Day-22 polish. *Note:* RARE+ only; COMMON/UNCOMMON get standard loot strip.

**Genre Expansion + Sub-Genre System (V8.46):**
Full reference in `/docs/genre-reference.md`. Fantasy → Light / Classic / Dark confirmed. All genres get same treatment.
*Slot:* Genre Session post-Day-25.

**Merchant Trading Foundation (V8.46):**
Current merchant system is narrator-only. Needs: persistent NPC inventory, buy/sell pricing, engine-enforced gold deduction, Trade UI with real prices.
*Slot:* After Day 21 loot in play. Dedicated round.

**Death Summary + Loss Display (V8.49):**
Currently defeat just teleports the player with no summary. Player should see what they lost: XP forfeited (amount gained in the fight), gold lost (10% of balance), HP set to 50%. Display as a "YOU DIED" summary beat or overlay before the story feed continues.
*Slot:* Combat UX & Flow Polish round (bundle with HP timing, hit/miss). Small addition to `handleDefeat` + defeat resolution event payload.

**Death Stash / Recovery Mechanic (V8.49):**
Dark Souls bloodstain analog. When a player dies, a `death_stash` FloorLootEntry is placed at the death node containing the gold that was lost (10% of balance). Player can navigate back and reclaim it via the loot strip. Only one stash active at a time — a second death clears the previous stash.
*Design decision needed:* Does this soften death too much given "death must matter" principle? Counter-argument: the journey back IS the penalty, and the gold is only the 10% loss not all gold. The stash creates interesting risk/reward decisions.
*Slot:* Combat UX & Flow Polish round or dedicated Death UX round.
*Implementation:* `handleDefeat` stamps a special FloorLootEntry at `state.origin_node_id` before teleport. `MasterState` gains `death_stash_node_id?: string` for single-stash enforcement.

**In-Combat Equipment Swapping (V8.49):**
Equip/Unequip currently hidden during combat (rule 63, intentional interim). When Day 20.5 Verbal Action lands, in-combat equipment swapping should be revisited. Design question: cost to swap? (spend your turn, or free action?)
*Slot:* Day 20.5 scope item.

---

## Open Strategic Questions

- External playtest timing (post-Day-22 or post-Day-23).
- Difficulty tuning — toggle vs world-tier scaling.
- Random travel encounters (combat-spec §3).
- NPC behavior dispatch (combat-spec §6.3).
- Map visual rework — dedicated session, deferred.
- Audit queue: defensive overchecks, prompt-template hardcoded IDs, integration test coverage.
- Genre Session scope and timing (post-Day-25 standalone vs bundled with Day 25).
- WCD variety second pass — WCD prompt needs own theme-diversity instruction (WorldBible fix ad82300 was necessary but not sufficient; WCD itself still defaults to honor/oath/covenant in Fantasy).
- Death stash design decision (see Future Features above).
- In-combat equipping — cost model (turn vs free action).

---

## Round History

| Commit | Round | Rules | Notes |
| --- | --- | --- | --- |
| 0bef82b | Potion hotfix — resolveUseItem reads effect.heal (primary), BASIC_HEALTH_POTION_ID (fallback) | 88 | Out-of-combat already worked; in-combat was broken by UUID stamp |
| 4619a32 | UX patch — revisit suppression, context-aware popup labels (SEARCH/EXAMINE/Close), .ew-said #f4e8c8→#f0c060 | 86-87 | Spawn settlement starts discovered=true; isNavigationLikeLabel heuristic |
| a56940f | Day 21 — 3-layer loot, loot-resolver, FloorLootStrip, SEARCH REMAINS, container flow, currency.ts, constants.ts, jest fix 762→393 | 82-85 | handleVictory XP-only + pending manifest; INVENTORY_CAP=20 |
| ad82300 | WorldBible variety fix — remove biased named examples, add uniqueness instruction, neutral placeholder IDs | (79 applied) | Fixes WorldBible; WCD itself still needs second pass |
| 4fe27e3 | Polish 4b — mobile audit + CodexModal close 44×44px + ActionBar combat buttons 44px | — | D (combat panel) MAJOR deferred; F/H minor deferred |
| 14252ac | Nav mini-cols — 2-row max, overflow wraps right, lone cards bottom-aligned | 72 updated | |
| 198a757 | Polish 4c — column layout + nav dedup + map tier auto-switch expansion | 80-81 | chooseTierForNode extracted to map-tier.ts |
| e87b23a | 20.4.4 — settlement DEEPER card + story header display name + stitch guarantee | (80-81 defined) | |
| 60501c8 | 20.4.3 — region expansion prompt template fix + splitConflatedRegionSettlement | 77-79 | Third recurrence of hardcoded ID bug |
| 24ac19c | Polish 4a — nav grouping/tiers/cross-region BACK/map auto-switch/.ew-said/CSS audit | 72-76 | |
| f17c221 | 20.4.2 — float CSS clip + stagger + sync to feed + codex modal + D&D roll format | 66-71 | CSS containment lesson (rule 70) |
| c67f2c0 | 20.4.1 — float routing + inventory-Use + flee DC + defeat respawn fix | 62-65 | |
| fc508f3 | 20.4 — rolls field + inline suffix + floats introduced + defeat teleport groundwork | 57-61 | |
| 732e944 | 20.3 — flex separators + button-only input + crit banner + suppression + resolution | 52-56 | |
| bf3871e + 1215bb6 | 20.2 + 20.1 — initiative kickoff, inventory stats, starting equipment, encounter banner | 43-51 | |
| abf73e6 + earlier | 20 Prompt 3 + foundation + pre-combat + 19A-19F | 1-42 | |

---

## V8.49 — Potion Hotfix

**Root cause:** `resolveUseItem` was hardcoded to `item_id === BASIC_HEALTH_POTION_ID`. Looted potions get `crypto.randomUUID()` → never matched → no-op branch → item stayed in inventory, HP unchanged. Out-of-combat use already worked via logic-resolver which read `effect.heal` directly.

**Fix (0bef82b, 393/393):** `combat-engine.ts` threads `owned.effect` through. Resolver reads `effect.heal` as primary path. BASIC_HEALTH_POTION_ID fallback kept for backwards-compat.

**HP timing deferred:** HP bar drops before floating numbers/story text. HP state updates synchronously; pacing delays in `projectCombatEventsToFeed` haven't fired yet. Fix: HP display reads from event timeline. Bundled with Combat UX Polish.

**Notes from playtest (Day 21 session):**
- Container search flow ✅
- Loot thematic cohesion ✅ ("Forsaken's Vigil Disc" RARE, "Scorched Salt-Cellar" UNCOMMON)
- Codex tracking items ✅
- Region expansion pipeline ✅
- Revisit suppression ✅
- Enemy loot (SEARCH REMAINS post-combat) — deferred until Day 22 leveling; too slow to kill enemies without level-appropriate power
- Boss fight — deferred until multi-room dungeon generation implemented
- Inventory cap warning at 20 — not yet tested

---

## V8.48 — UX Patch (4619a32)

**Fix 1 — Revisit suppression (rule 86):** Cache-hit ARRIVING reads `world_graph.nodes[id].discovered` BEFORE step-7 flip. Return visit emits "You return to {name}." only — skips cached prose AND narrator API. Spawn settlement starts `discovered=true` so first MOVE-back correctly suppresses.

**Fix 2 — Context-aware popup labels (rule 87):** InteractionPopover.tsx: CONTAINER → "Search" primary; fixture/lore/trigger/unknown ITEM POI → "Examine" (never "Pick up"); `isNavigationLikeLabel` heuristic (bridge/gate/passage/stairs/path/trail/doorway/archway/corridor) → header + Close only.

**Design distinction captured:** PICK UP (physical item into inventory from loot strip) ≠ SEARCH (rolling loot from container). Two different actions; must look different in UI.

**Fix 3 — `.ew-said` color:** `#f4e8c8` cream → `#f0c060` warmer golden. `#e8b84b` available as toggle. Italic + weight-600 preserved.

---

## V8.47 — Day 21 Container + Loot (a56940f)

**Jest baseline correction:** V8.45 reported 762 due to `.claude/worktrees/` double-counting. Fixed via `testPathIgnorePatterns` + `modulePathIgnorePatterns`. **True baseline = 393.**

**Architecture:**
- Layer 1: 5 genre LootPools (`lib/game/loot-tables/{fantasy,cyberpunk,horror,space,apoc}.ts`)
- Layer 2: `WorldBible.world_loot_items[]` (6-8 world-themed items)
- Layer 3: `RegionBible.region_loot_items[]` + `boss_drop_item`
- `lib/game/loot-resolver.ts` — pure, RNG-injectable
- `lib/game/floor-loot.ts` — pure transitions
- `hooks/useFloorLoot.ts` — thin React wrapper
- `components/game/FloorLootStrip.tsx` — SEARCH REMAINS / item pills / gold pill / TAKE ALL
- `lib/game/currency.ts` — canonical currencyKeyFor / currencyLabelFor
- `lib/game/constants.ts` — INVENTORY_CAP = 20
- `MasterState.floor_loot?: FloorLootEntry[]` — persists across navigation, auto-prunes
- Container guarantee: both WorldBible and RegionBible routes promote one `is_interactable` to `type:"container"` in every combat-eligible node
- `/game` route: 109kB → 117kB (+8kB)

**Investigation findings (V8.40 protocol):**
- `CombatEnemyInstance` already carries `loot_table_id` + `is_boss` — perfect for SEARCH REMAINS
- `handleVictory` previously auto-rolled loot inline — required full refactor to XP-only + pending manifest
- `RegionBible` route had no normalize step — added for loot fields + container guarantee

---

## V8.46 — Polish 4b + Genre Doc

**Mobile QA (380px audit, 10 surfaces):**
- PASS: A (layout shell), B (story feed), C (nav bar), E (floating damage), G (codex modal), I (forms), J (resolution banners)
- MAJOR DEFERRED D: Combat panel — 3+ enemies at 380px ~60px per combatant. Recommended: stacked portrait layout below `md:`, ~64px portraits. Bundle with F/H minor items.
- MINOR DEFERRED F: Inventory action buttons ~22px
- MINOR DEFERRED H: World map NPC/EXAMINE buttons ~28-32px

Two inline fixes applied: CodexModal close button 24→44×44px, ActionBar combat buttons 34→44px.

**Genre reference:** `/docs/genre-reference.md` created — all brainstormed genres with mechanics, loot, enemies, UI identity. 40+ genres/sub-genres.

**Tim's confirmed Fantasy sub-genre split:** Light (Zelda, Dragon Quest) / Classic (LOTR, D&D) / Dark (GoT, Warhammer, Berserk). Full Genre Session post-Day-25.

---

## V8.41-V8.45 — Combat Polish Era

**V8.45 — Nav mini-cols (rule 72 updated):** 2-row max, overflow right, lone cards bottom-aligned.

**V8.44 — Polish 4c:** `chooseTierForNode()` extracted to `map-tier.ts` proactively. Nav dedup via `backCards[0]?.targetId`.

**V8.43 — Map tier + nav dedup (rules 80-81 defined):** `chooseTierForNode()` spec; DEEPER settlement suppression at region zone.

**V8.42 — Third ID bug recurrence (rules 77-79):** `splitConflatedRegionSettlement()` heal-on-apply. Recurring bug class: audit `generate-*/route.ts` for hardcoded structural IDs.

**V8.41 — Nav grouping + workflow (rules 72-76):** BACK/DEEPER/PEER/UNDISCOVERED groups. Origin/main baseline check protocol. Cross-region BACK targets last settlement hub.

---

## V8.38-V8.40 — Combat Foundation Era

**V8.40 — Investigation-before-patching protocol. CSS containment lesson (rule 70). Integration tests required (rule 71).**

**V8.39 — Defeat respawn (rule 65) + float routing fix (rule 64) + inventory Use in combat (rule 63).**

**V8.38 — Three strategic decisions LOCKED:**
- Multiplayer = PRE-LAUNCH (Day 24)
- Customization = PRE-LAUNCH (Day 25)
- Day 22 skills = FOUNDATIONS NOW

**V8.37 — Use item templated (rule 53). Crit two-line (rule 54). Event suppression (rule 55). Resolution events (rule 56).**

**V8.36 — advanceUntilPlayerTurnOrEnd (rule 49). kickoffCombatIfEnemyFirst (rule 50). Inventory combat stats (rule 51).**

**V8.35 — Starting equipment module (rule 43). combat_start templated (rule 45). Pacing delays 800ms/800ms/500ms (rule 47).**

**V8.34 — CombatMode strip (rule 39). Portrait slot 128px (rule 40). Bestiary codex on combat_start (rule 41). New game preamble (rule 42).**

**V8.32-V8.33 — Combat math/engine/loop (rules 28-37). Region bible idempotency. GRAPH_NAVIGATE vs WORLD_EXPLORE.**

**V8.31 — Combat spec (rule 27). Enemy interface (rule 24). 4-layer enemy lookup (rule 25). region_bibles accumulation (rule 26).**
