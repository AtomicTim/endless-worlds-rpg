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
Player should see what they lost on death: XP forfeited, gold lost (10% of balance), HP set to 50%.
*Slot:* Combat UX & Flow Polish round.

**Death Stash / Recovery Mechanic (V8.49):**
Dark Souls bloodstain analog. `death_stash` FloorLootEntry placed at death node containing lost gold. One stash active at a time.
*Design decision needed:* Does this soften death too much? Counter: the journey back IS the penalty.
*Slot:* Combat UX & Flow Polish round.

**In-Combat Equipment Swapping (V8.49):**
Equip/Unequip hidden during combat (rule 63, intentional interim). Revisit with Day 20.5 Verbal Action.
*Design question:* costs your turn or free action?
*Slot:* Day 20.5 scope item.

**Skills System — DEFERRED from Day 22 (V8.49):**
Stats serve as skills for now — a PER check IS a Perception check. A separate skills layer adds overhead that doesn't serve the pickup-game format at this stage.
*Design questions to answer at slot time:*
- Separate skill points pool, or skills as named modifiers on top of stats?
- Proficiency system (D&D: proficient or not) vs trained/untrained/mastered tiered system?
- How does archetype signal implied proficiencies? (A Rogue is "skilled at" stealth — but does the engine give them a bonus on AGI stealth checks?)
- Skill list scope: broad (5-6 skills per stat) or narrow (just name the stat check differently per context)?
*Slot:* Dedicated Skills round, after Day 22 is stable and playtested.

**World Save / Replay / Share (V8.49):**
Generated worlds saveable as portable artifacts. Players can replay with new character, share a world link, return for longer campaigns. World portability, not simultaneous play. Makes procgen feel like authored content — world has permanence, characters don't.
*Slot:* Post-Day-25, bundled with or just after Customization Layer.

---

## Open Strategic Questions

- Vertical slice scope — what constitutes a "complete" playthrough for tuning purposes.
- XP threshold tuning — revisit after playtest; values in constants.ts intentionally easy to change.
- Difficulty tuning — toggle vs world-tier scaling.
- Random travel encounters (combat-spec §3).
- NPC behavior dispatch (combat-spec §6.3).
- Map visual rework — dedicated session, deferred.
- Genre Session scope and timing (post-Day-25 standalone vs bundled with Day 25).
- WCD variety second pass — WCD prompt needs own theme-diversity instruction.
- Death stash design decision (see Future Features above).
- In-combat equipping — cost model (turn vs free action).
- Skills system design (see Future Features above).
- World save/replay/share scope and timing (see Future Features above).

---

## Day 22 Design Decisions (pre-prompt, V8.49)

**Archetype system:** Option B confirmed. Class chosen at character creation IS the archetype. Each class maps to a primary stat (+2 starting, +1 auto per level) and secondary stat (+1 starting, +1 auto per level). Player gets +1 free point to any stat per level-up.

**5 classes per genre:** Expand from 3 to 5 per genre. New classes fill PER and CHA/STR coverage gaps.

| Genre | New Class | Primary | Secondary |
|---|---|---|---|
| Fantasy | Ranger | PER | AGI |
| Fantasy | Herald | CHA | INT |
| Cyberpunk | Enforcer | STR | AGI |
| Cyberpunk | Ghost | PER | AGI |
| Horror | Phantom | AGI | PER |
| Horror | Medium | CHA | INT |
| Space Opera | Marine | STR | AGI |
| Space Opera | Recon | PER | AGI |
| Post-Apoc | Runner | AGI | PER |
| Post-Apoc | Demagogue | CHA | INT |

**Starting stats:** All stats at 2. Primary +2 → starts at 4. Secondary +1 → starts at 3. Stat cap = 10.
**Level cap:** 10 (tunable). **XP thresholds:** 100/200/350/550/800/1100/1450/1850/2300.
**HP growth:** +5/level base. STR-primary +3 (total +8). AGI-primary +1 (total +6). Others +5.
**STAT_XP mid-combat:** auto-applies to archetype primary (no picker — keeps combat flow clean).
**Skills:** Deferred. Stats serve as skills for now.

---

## Round History

| Commit | Round | Rules | Notes |
| --- | --- | --- | --- |
| 9fe5c8d | Char creation UI fix — remove point-buy step, dynamic class picker (all 5 per genre), CLASS_FLAVOR descriptions, ARCHETYPE_MAP-driven stat labels | — | 452/452 unchanged (UI-only). Net -174 lines — wizard leaner without point-buy state |
| 7833245 | Day 22 — archetypes.ts 25 classes, level-resolver, LevelUpModal, XP bar, CharacterSheet, STAT_XP wiring, 10 new class configs | 89-91 | 452/452 (+59 new tests). STAT_XP mid-combat auto-applies to primary |
| 0bef82b | Potion hotfix — resolveUseItem reads effect.heal (primary), BASIC_HEALTH_POTION_ID (fallback) | 88 | Out-of-combat already worked; in-combat broken by UUID stamp |
| 4619a32 | UX patch — revisit suppression, context-aware popup labels, .ew-said #f0c060 | 86-87 | isNavigationLikeLabel heuristic; spawn settlement discovered=true |
| a56940f | Day 21 — 3-layer loot, loot-resolver, FloorLootStrip, SEARCH REMAINS, currency.ts, constants.ts | 82-85 | jest baseline corrected 762→393 |
| ad82300 | WorldBible variety fix | (79 applied) | WCD itself still needs second pass |
| 4fe27e3 | Polish 4b — mobile audit + touch target fixes | — | D (combat panel) MAJOR deferred |
| Earlier commits | Polish 4a through 19A-19F | 1-81 | See CLAUDE.md rules section |

---

## V8.50 — Day 22 + Char Creation Fix

**Day 22 (7833245, 452/452):** Full leveling system shipped. archetypes.ts (25 classes) · level-resolver.ts (checkLevelUp, resolveLevelUp, applyLevelUp) · LevelUpModal (auto-gain readout + free stat picker) · XP bar in CharacterSheet · STAT_XP item wiring. Level-up flow is post-combat, gated on `pending_level_up && !combat.active`. Backend correct; UI had two gaps (see below).

**Char creation UI fix (9fe5c8d, 452/452):**
- Point-buy step removed entirely — route was already ignoring the payload since Day 22; now the UI matches. 3-step wizard (Genre → Name → Background).
- Background picker now dynamic: reads `Object.keys(BACKGROUND_CONFIGS[genre])` — any new class added to starting-equipment.ts appears automatically.
- `CLASS_FLAVOR` record added for all 25 classes. Primary stat label reads from `ARCHETYPE_MAP[bgId].primary` — card labels cannot drift from engine behavior.
- `formatClassName` helper handles snake_case display (street_samurai → Street Samurai).
- Grid widened to max-w-4xl, 3-col lg layout, 5 cards in 3+2 rows.

**Vertical slice playtest is now unblocked.** Knight → STR 4, AGI 3, others 2 on game start. XP accumulates toward level 2 at 100 XP. Level-up modal fires post-combat.

---

## V8.49 — Potion Hotfix

`resolveUseItem` hardcoded to `BASIC_HEALTH_POTION_ID`. Looted potions get UUID → never matched → no-op. Fix: reads `effect.heal` directly as primary path.
HP timing deferred to Combat UX Polish.

---

## V8.48 — UX Patch (4619a32)

Revisit suppression (rule 86) · Context-aware popup labels (rule 87) · `.ew-said` #f0c060.

---

## V8.47 — Day 21 (a56940f)

3-layer loot system · loot-resolver · FloorLootStrip · SEARCH REMAINS · jest baseline corrected 762→393.

---

## V8.41-V8.46 — Combat Polish Era

Nav grouping/columns/dedup · map-tier · Polish 4a-4b · WorldBible variety fix · genre-reference.md created.

---

## V8.38-V8.40 — Combat Foundation Era

Investigation-before-patching · CSS containment lesson · three strategic decisions LOCKED.
