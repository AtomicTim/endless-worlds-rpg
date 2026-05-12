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
Player should see what they lost on death: XP forfeited (amount gained in the fight), gold lost (10% of balance), HP set to 50%.
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
D&D distinguishes ability scores (broad stats like STR/DEX) from skills (specific applications like Athletics/Stealth with proficiency bonuses). For this game's pickup-game format, stats serve as skills for now — a PER check IS a Perception check, a CHA check IS a Persuasion check. A separate skills layer adds character sheet overhead that doesn't serve the format at this stage.
*Design questions to answer at slot time:*
- Separate skill points pool, or skills as named modifiers on top of stats?
- Proficiency system (D&D-style: you're either proficient or not) vs a trained/untrained/mastered tiered system?
- How does the archetype class signal implied skill proficiencies? (A Rogue is "skilled at" stealth narratively — but does that mean the engine gives them a bonus on AGI stealth checks?)
- Skill list scope: broad (Athletics, Stealth, Persuasion, Investigation, Survival = 5-6 skills per stat) or narrow (just name the stat check differently per context)?
*Slot:* Dedicated Skills round, after Day 22 leveling is live and playtested. Dependencies: Day 22 stat system must be stable first.

**World Save / Replay / Share (V8.49):**
Generated worlds should be saveable as portable artifacts. Players can: replay a world with a new character, share a world link so someone else plays it, return to a saved world for a longer campaign. Distinct from multiplayer (Day 24) — this is world portability, not simultaneous play. Makes procedural generation feel like authored content — the world has permanence, the characters don't.
*Slot:* Post-Day-25, likely bundled with or just after the Customization Layer.
*Implementation considerations:* World state stored in Supabase already; need: world permalink, shareable URL, "start new character in this world" flow, world browser UI.

---

## Open Strategic Questions

- External playtest timing (post-Day-22 or post-Day-23).
- Difficulty tuning — toggle vs world-tier scaling.
- Random travel encounters (combat-spec §3).
- NPC behavior dispatch (combat-spec §6.3).
- Map visual rework — dedicated session, deferred.
- Audit queue: defensive overchecks, prompt-template hardcoded IDs, integration test coverage.
- Genre Session scope and timing (post-Day-25 standalone vs bundled with Day 25).
- WCD variety second pass — WCD prompt needs own theme-diversity instruction.
- Death stash design decision (see Future Features above).
- In-combat equipping — cost model (turn vs free action).
- Skills system design (see Future Features above — full design questions listed there).
- World save/replay/share scope and timing (see Future Features above).
- XP threshold tuning — revisit after vertical slice playtest; values in constants.ts are intentionally easy to change.

---

## Day 22 Design Decisions (pre-prompt, V8.49)

**Archetype system:** Option B confirmed. Class chosen at character creation IS the archetype. No separate archetype selection. Each class maps to a primary stat (+2 starting, +1 auto per level) and secondary stat (+1 starting, +1 auto per level). Player also gets +1 free point to any stat per level-up.

**5 classes per genre:** Expand from 3 to 5 per genre. Add 2 new classes per genre to fill PER and CHA/STR coverage gaps. All existing classes retained unchanged.

New classes to add:
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

Existing class primary/secondary mapping:
| Class | Primary | Secondary |
|---|---|---|
| Knight | STR | AGI |
| Rogue | AGI | PER |
| Mage | INT | PER |
| Netrunner | INT | PER |
| Fixer | CHA | INT |
| Street Samurai | AGI | STR |
| Investigator | INT | PER |
| Cultist | PER | INT |
| Survivor | STR | AGI |
| Commander | CHA | INT |
| Pilot | AGI | PER |
| Engineer | INT | STR |
| Scavenger | PER | INT |
| Raider | STR | AGI |
| Medic | INT | CHA |

**Starting stats:** All stats begin at 2. Archetype primary +2 → starts at 4. Archetype secondary +1 → starts at 3. Other 3 stats remain at 2. Stat cap = 10.

**Level cap:** 10 (tunable constant). Revisit after vertical slice playtest.

**XP thresholds:** 100 / 200 / 350 / 550 / 800 / 1100 / 1450 / 1850 / 2300 (levels 1→2 through 9→10). Stored in constants.ts as XP_THRESHOLDS array. Easy to tune.

**HP growth per level:** Flat +5 HP base. STR-primary classes +3 bonus (total +8). AGI-primary classes +1 bonus (total +6). All others +0 (total +5). No CON stat — HP growth is archetype-flavored instead.

**Skills:** Deferred. Stats serve as skills for now. Full skills design discussion captured in Future Feature Ideas above.

**STAT_XP items:** Using one prompts "Choose a stat to improve" picker → +1 to chosen stat. Rare drop — lets players break archetype pattern.

**Level-up during combat:** If XP threshold crossed mid-combat, set `pending_level_up: true` on player state. Level-up modal fires after combat resolves (victory, flee). Defeat discards pending level-up (XP is rolled back per rule 31 anyway).

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
| e87b23a + 60501c8 + 24ac19c | 20.4.4 through Polish 4a | 72-81 | |
| f17c221 through abf73e6 | 20.4.2 through 19A-19F | 1-71 | See earlier entries |

---

## V8.49 — Potion Hotfix + Design Notes

**Root cause:** `resolveUseItem` hardcoded to `BASIC_HEALTH_POTION_ID`. Looted potions get UUID → never matched → no-op. Fix (0bef82b): reads `effect.heal` directly as primary path.

**HP timing deferred:** HP bar drops before floating numbers/story text. Fix: HP display reads from event timeline. Bundled with Combat UX Polish.

**Playtest notes (Day 21 session):** Container search ✅ · Loot cohesion ✅ · Codex ✅ · Region expansion ✅ · Revisit suppression ✅. Enemy loot, boss, inventory cap — all deferred.

---

## V8.48 — UX Patch (4619a32)

Revisit suppression (rule 86) · Context-aware popup labels (rule 87) · `.ew-said` #f0c060.
Design distinction: PICK UP (physical item from loot strip) ≠ SEARCH (rolling loot from container).

---

## V8.47 — Day 21 (a56940f)

3-layer loot system · loot-resolver · FloorLootStrip · SEARCH REMAINS · currency.ts · constants.ts · jest baseline corrected 762→393.

---

## V8.41-V8.46 — Combat Polish Era

Nav grouping/columns/dedup · map-tier · Polish 4a-4b · WorldBible variety fix · genre-reference.md created.

---

## V8.38-V8.40 — Combat Foundation Era

Investigation-before-patching · CSS containment lesson · three strategic decisions LOCKED (Multiplayer/Customization/Day 22 PRE-LAUNCH).
