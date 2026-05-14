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
Generated worlds saveable as portable artifacts. Players can replay with new character, share a world link, return for longer campaigns. World portability, not simultaneous play.
*Slot:* Post-Day-25, bundled with or just after Customization Layer.

**Item Contextual Appropriateness (V8.52 playtest capture):**
Trail Rations appeared in dungeon loot from combat enemies — food items feel wrong as dungeon drops. More broadly, the item generation pipeline (WorldBible world_loot_items, RegionBible region_loot_items) needs guidance on contextual appropriateness:
- Dungeon/combat loot: weapons, armor, valuables, RARE artifacts, consumable potions
- Settlement/shop: food, tools, mundane equipment, trade goods
- Exploration/containers: a mix — but food items in a skeleton's remains is odd
*Slot:* WorldBible/RegionBible prompt tuning round, or bundle into Day 23. Not a blocker.

**More Location Node Types (V8.52 playtest capture):**
Current world structure is basically: settlement + single dungeon entrance (the region_location). Tim wants more variety — wilderness stretches, abandoned villages, workshops, camps, crossroads. This is Day 23 scope — quest nodes need interesting locations to exist at anyway. Should be scoped when designing the quest thread generation.
*Slot:* Day 23. Core to making the world feel like a world rather than a settlement with one danger spot.

---

## Open Strategic Questions

- XP threshold tuning — revisit after more playtest data; values in constants.ts intentionally easy to change.
- Difficulty tuning — toggle vs world-tier scaling.
- Random travel encounters (combat-spec §3).
- NPC behavior dispatch (combat-spec §6.3).
- Map visual rework — dedicated session, deferred.
- Genre Session scope and timing (post-Day-25 standalone vs bundled with Day 25).
- Death stash design decision (see Future Features above).
- In-combat equipping — cost model (turn vs free action).
- Skills system design (see Future Features above).
- World save/replay/share scope and timing (see Future Features above).
- Item contextual appropriateness — loot generation prompt guidance for what belongs where.
- Location node variety — scope for Day 23 design.

---

## Day 22 Design Decisions (pre-prompt, V8.49)

**Archetype system:** Option B confirmed. Class chosen at character creation IS the archetype. Each class maps to a primary stat (+2 starting, +1 auto per level) and secondary stat (+1 starting, +1 auto per level). Player gets +1 free point to any stat per level-up.

**5 classes per genre (new):**
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

**Starting stats:** All stats at 2. Primary +2 → 4. Secondary +1 → 3. Stat cap = 10.
**Level cap:** 10. **XP thresholds:** 100/200/350/550/800/1100/1450/1850/2300.
**HP growth:** +5/level base. STR-primary +3 (total +8). AGI-primary +1 (total +6). Others +5.

---

## Round History

| Commit | Round | Rules | Notes |
| --- | --- | --- | --- |
| 4091ff3 | V8.52 Polish — WCD theme diversity (12 themes, no more oath/honor default), gold tiers unified (3-18/12-35/30-80), food consumables heal 5 HP | — | 454/454 unchanged. 6 files, +90/-21 |
| 00b5450 | Combat Rebalance — abilityMod floor((score-2)/2), all 5 bestiaries retuned, bible stat budget guidance | 92-93 | 454/454 (+2 dice modifier tests) |
| 9fe5c8d | Char creation UI fix — remove point-buy step, dynamic class picker, CLASS_FLAVOR, ARCHETYPE_MAP-driven labels | — | 452/452 unchanged |
| 7833245 | Day 22 — archetypes.ts 25 classes, level-resolver, LevelUpModal, XP bar, CharacterSheet, STAT_XP wiring, 10 new class configs | 89-91 | 452/452 (+59 tests) |
| 0bef82b | Potion hotfix — resolveUseItem reads effect.heal (primary), BASIC_HEALTH_POTION_ID (fallback) | 88 | Out-of-combat already worked; in-combat broken by UUID stamp |
| 4619a32 | UX patch — revisit suppression, context-aware popup labels, .ew-said #f0c060 | 86-87 | |
| a56940f | Day 21 — 3-layer loot, loot-resolver, FloorLootStrip, SEARCH REMAINS, currency.ts, constants.ts | 82-85 | jest baseline corrected 762→393 |
| Earlier | Combat polish era through 19A-19F | 1-81 | See CLAUDE.md rules section |

---

## V8.52 — Vertical Slice Playtest Results + Polish

**Playtest session (world: Veldcrux / The Ashfall Lowlands, Knight class):**

What worked ✅:
- Combat is fun and winnable — took real damage, managed resources, survived
- Roll display reads great: `(d20: 11, +0 → 11 vs 11 | 1d6+1)` — players can understand every outcome
- SEARCH REMAINS → loot strip → individual TAKE working correctly
- VICTORY banner + LLM resolution prose looking good
- Level-up modal fired post-combat: STR+1, AGI+1, HP+8 auto-gains shown, free stat picker confirmed (Image 2)
- XP awarded 70+30=100 → hit level 2 threshold exactly ✓
- Revisit suppression ("You return to X.") working cleanly
- AI-generated Echo-Knight stats were tier-1 appropriate (DC ~11, HP ~8-9) — bible stat budget guidance working

Combat flow observed:
- Fight 1: Echo-Knight killed in 1 hit (7 damage, nat 11 hit), Skeleton took 8 rounds (4 consecutive misses rounds 4-7 — bad dice luck, skeleton reached 2 HP multiple times before final kill)
- Fight 2: Echo-Knight, 5 rounds, player took 17+3+7+6=33 damage total from 100 HP

Issues found and fixed in 4091ff3:
- Trail Rations used → "hunger satisfied" flavor but no mechanical effect → now heals 5 HP
- 87 gold from two tier-1 enemies → now tier-1 drops 3-18 gold
- World still oath/ash themed (Ashfall Lowlands, Oathkeeper's Crossing) → WCD now rotates 12 distinct themes

Issues deferred:
- Trail Rations in dungeon combat loot feels contextually wrong — food shouldn't drop from skeletons (captured as future feature above)
- Need more location node types beyond settlement + single barrow (Day 23 scope)
- No actual multi-room dungeon generation yet (Day 23 core feature)

---

## V8.51 — Combat Rebalance (00b5450)

Root cause: D&D formula `floor((score-10)/2)` assumed stats centered on 10. Our stats are 2-10 → all starting modifiers negative. Knight AGI=3 → modifier -4, ~25% hit rate.
Fix: `floor((score-2)/2)`. Knight AGI=3 → 0, ~50% hit rate vs tier-1 enemies.
Also: all 5 bestiaries retuned (tier-1 agi≤1, HP -25%), bible prompts gained ENEMY STAT BUDGET guidance block.

---

## V8.50 — Day 22 + Char Creation Fix

Day 22 (7833245): Full leveling shipped. archetypes.ts · level-resolver.ts · LevelUpModal · XP bar · STAT_XP wiring.
Char creation fix (9fe5c8d): Point-buy step removed. Background picker dynamic from BACKGROUND_CONFIGS. CLASS_FLAVOR + ARCHETYPE_MAP-driven labels.

---

## V8.47-V8.49 — Day 21 + Hotfixes

Day 21 (a56940f): 3-layer loot system · loot-resolver · FloorLootStrip · SEARCH REMAINS. jest baseline corrected 762→393.
Potion hotfix (0bef82b): resolveUseItem reads effect.heal directly. Looted consumables now work in combat.
UX patch (4619a32): Revisit suppression · context-aware popup labels · .ew-said #f0c060.

---

## V8.38-V8.46 — Combat Foundation + Polish Era

Investigation-before-patching · CSS containment lesson · three strategic decisions LOCKED · nav grouping · map-tier · Polish 4a-4b · WorldBible variety fix · genre-reference.md.
