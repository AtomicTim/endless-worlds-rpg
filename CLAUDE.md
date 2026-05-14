# Project: Endless Worlds RPG — Master Context

**Version:** 8.80  |  **Build status → see PROMPT-LOG.md**
**Objective:** A text-based RPG that generates a unique world for every playthrough. Genre-agnostic, infinitely replayable, CRPG depth.

**References:** /docs/architecture-spec.md · /docs/combat-spec.md · /docs/quest-system-spec.md · /docs/genre-reference.md · /docs/project-log.md

---

## Game Vision

> **Tim and his wife (or a friend) are sitting in the living room on a Saturday night. One of them says "let's play." Both pull out phones, tap a website, pick a genre, name a character. Within a couple minutes they're in a brand-new world neither has seen before — a quest waiting, NPCs to meet, dungeons to crawl, lore to discover. They play for an hour or two and walk away having had a real D&D-style adventure.**

Design principles: Pickup-friendly · Mobile-first viewport · Multiple play styles · Procedural variety > authored depth · Multiplayer-aware (Day 24) · Customization-aware (Day 25) · D&D narration is the soul · Death must matter.

**Positioning:** "Baldur's Gate depth without Baldur's Gate overhead. D&D feel without needing a DM."

---

## Project Roles

**Vision:** Tim. **Engineering/Architecture:** Claude.ai. **Implementation:** Claude Code.

**Decision flow:** Tim describes → Claude.ai assesses → Tim decides → Claude.ai writes prompt in Claude.ai conversation → Claude Code implements → Tim verifies → Claude.ai updates PROMPT-LOG.md (every prompt) and CLAUDE.md (only when rules/architecture change).

**Per-prompt protocols:**
- **V8.40** — Investigation-before-patching.
- **V8.41** — Origin/main baseline check: `git fetch origin && git log origin/main --oneline -5` as step 1.
- **V8.79** — jest baseline = 580. See rule 91.
- **V8.69** — No token cap changes without confirmed output_tokens data first.
- **V8.78** — Prompts for Claude Code are written directly in the Claude.ai conversation, not in Drive docs.

---

## Trajectory

> Full notes in `/docs/project-log.md`. Drive design docs index below. **Build status / prompt arc → see PROMPT-LOG.md.**

### Drive Design Documents
- "quest-source-taxonomy" — side quest sources
- "day-23-5-character-creation-design-spec-v2" — character creation
- "world-theme-taxonomy" — 54 themes, Genre Session implementation
- "economy-and-progression-design-spec" — economy baseline, merchant design, item tiers
- "status-effects-and-abilities-design-spec-v2" — status effects, damage types
- "ability-library-v1-all-25-classes" — all 125 ability templates (25 classes × 4 active + 1 passive)
- "ability-system-architecture-v2-final" — level cap 20, no mana, pool/slot model, stat gates
- "professions-perks-and-ability-acquisition-spec-v2" — professions (20 levels), perks, acquisition
- "design-session-master-summary-2026-05-13" — full session summary + original 33-step build order

### 11-Prompt Implementation Arc

P1 Status Effects + Death Penalty + Gold · P2 Generation Prompts · P3 Merchant Trading + Inn Rest ·
P4 Quest Gates · P5 Combat UX Status Display · P6 Ability Foundation · P7 Ability Combat + Attunement ·
P8 Perks · P9-P11 Professions (Day 25)

After P1–P8: Combat UX Polish · Mobile Layout · Day 24 Multiplayer · Day 25 Customization
Post-Day 25: **Genre Session** (world theme taxonomy + world structure per-genre + Horror full design)

---

## Design Session Decisions (V8.77–V8.80) — Full index

### DEATH PENALTY (locked — ✅ shipped P1)
- Gold loss: 10% of current gold, cap 50, floor 0
- HP on spawn: Math.floor(max_health * 0.75) — 75%, not 100%
- XP: preserved (rule 31)
- Items: not lost
- Inn Rest: innkeeper NPC → dialogue type "rest" → 10 gold → HP to max_health (P3)
- Horror: 75% HP only, no gold penalty (Marks deferred to Genre Session)

### ECONOMY BASELINE (locked — ✅ gold drops shipped P1)
- Starting gold: Fantasy 10 · Cyberpunk 500 · Post-Apoc 25 caps · Space Opera 100 SU
- Enemy drops: Tier 1 = 2–5g · Tier 2 = 6–12g · Boss = 15–30g
- Item tiers: Common consumable 8–15g · Uncommon 20–40g · Common weapon 30–60g · Uncommon weapon 80–150g
- Starting equipment sell value = 0

### MERCHANT TRADING (locked — P3)
- Inventory seeded at WorldBible/RegionBible time — never narrator-generated
- Trust pricing: 0–40 = +25% · 41–60 = base · 61–80 = −10% · 81–100 = −20%
- Speciality-filtered selling; VALUABLE sells to any merchant
- Quest completion gates (type === "item") must be mechanically enforced

### STATUS EFFECTS (designed — ✅ engine P1, generation P2)
- 5 ailments: POISONED (1d4/3r AGI DC12) · BURNING (1d6/2r AGI DC14) · CHILLED (−2atk+saves/2r STR DC11) · WEAKENED (−3STR/2r STR DC10) · FRIGHTENED (−2all/2r CHA DC12)
- 3 buffs: FORTIFIED (+3 armor/3r) · HASTENED (+3 atk/2r) · FOCUSED (+3 INT-PER/2r)
- One-curse limit (ailments). Boss resistance: max 1 tick, 2-round immunity after.
- Save: d20 + stat vs DC at END of player turn.
- World aliases: WCD.status_effect_aliases (only when thematically compelling — "rootblight" rule)

### DAMAGE TYPES (designed — ✅ shipped P1 + P2)
- Enemy gains primary_damage_type?: DamageType
- Item additions: on_hit_status (RARE+ weapons) · damage_resistances (UNCOMMON+ armor, flat) · status_immunities (UNCOMMON+ armor) · apply_status + burst_damage (throwable consumables)

### ABILITIES (designed — P6–P7 scope)
- Level cap: **20**. Slot unlocks: **level 5** (Slot 2) · **level 10** (Slot 3) · **level 15** (Slot 4).
- **No mana system.** Cross-class stat requirements (INT/STR/AGI/CHA ≥ 6) gate ability use. Item gates: UNCOMMON stat ≥ 4, RARE ≥ 6, LEGENDARY ≥ 8 or class-locked.
- LEARNED POOL (5–7 abilities per playthrough) vs EQUIPPED SLOTS (always exactly 4).
- 1 passive per class, always active, never slotted.
- Slot 1 fixed. Slot 2 random at level 5. Slots 3–4 pick 1 of 2 at levels 10/15 (Option A standard; Option B world-influenced WCD variant).
- Class variant pool: 8–10 abilities per class; 3 drawn per playthrough.
- Charges: base 2, restore at combat end. +1 per 2 levels in charge_stat. Level 5: Slot 1 +1 charge.
- Attunement at settlements/Inn Rest. Locked during combat.
- Ability flavor name generation deferred to P7 (WCD fires before class is chosen).
- Drive: "ability-library-v1-all-25-classes" + "ability-system-architecture-v2-final".

### ABILITY ACQUISITION PATHS (designed)
- Path 1 — Class (hardcoded): Slots 1–4 + passive. Non-negotiable identity.
- Path 2 — World-learnable lore items: WCD seeds 1–3 per world, teaches_ability on Item, stat ≥ 6 gate.
- Path 3 — NPC-taught: RegionBible assigns, trust ≥ 70–80. Dialogue type "learn_ability".
- Runtime-generated: NEVER.

### LORE ITEMS (expanded purpose)
- teaches_ability (first READ adds to pool) · teaches_profession {id, xp_grant}
- Rarity rule: COMMON/UNCOMMON = max 1 special function. RARE = up to 2. LEGENDARY = up to 2 + breadcrumb.
- Guaranteed profession manuals (all 3) in every starting settlement ✅ P2

### PERKS (designed — P8 scope)
- ~20 pool. Unlock every 4 combat levels (4, 8, 12, 16, 20) = 5 total. Choose 1 of 3. Permanent. Universal.
- Categories: Combat · Status · Ability · World

### PROFESSIONS (designed — P9–P11, Day 25 scope)
- 3 for MVP: Alchemy · Smithing · Lore (genre-variant names)
- 20 levels. Novice→Apprentice→Journeyman→Expert→Master. Advance by DOING.
- No carryover between worlds. MATERIAL ItemType. Material nodes in RegionBible.
- Drive: "professions-perks-and-ability-acquisition-spec-v2"

### POST-QUEST WORLD STATE (designed)
- Player chooses End Chapter OR Continue Exploring after main quest resolution.
- QUEST_STATUS: resolved_[id] permanently in narrator context. NPCs shift tone. Zero content locks.

### HORROR GENRE (deferred — Genre Session)
- Sanity: declared stub. Marks: inconsistent codebase.

---

## World Theme Taxonomy — Design Complete

See Drive: "world-theme-taxonomy". 54 themes across 5 genres. Implementation: Genre Session.
`lib/game/world-themes.ts` + `rollWorldTheme()` replaces all WCD theme-selection instructions.

---

## FOUNDATIONAL RULES

1. World Assets Are Permanent. Write-once.
2. Navigation Is Nav Bar Only. Map is visual only.
3. Location Is Authoritative State. current_node_id on navigateTo.
4. Actions Permitted By Default.
5. Objects Mentioned Exist. Failed checks = evasion.
6. Dialogue Consistent. Failed check = no info. Trade = no check.
7. AI Three Roles Only. Generator → Bridge → Thread.
8. WCD Is Absolute Law.
9. Failed Checks = Evasion Only.
10. Highlights Are Exact Tier 1 Matches.
11. Highlight clicks resolve display-name → node id. (V8.26)
12. Every successful arrival flips `discovered = true`. (V8.26)
13. Cache hit on ARRIVING synthesizes response, skips narrator API. (V8.27)
14. Map description sourcing: World/Region/Local — no cross-tier bleed. (V8.27)
15. Region zone assets populate both `physical_description` AND `atmosphere` from same prose. (V8.28)
16. Collision-check loops guard each entry with `isValidPos`. (V8.28)
17. Story feed location highlights tier-aware: region (lavender), location (sky-blue), landmark (mint). (V8.29–30)
18. Region zone D2 card builder iterates adjacent_regions/connections without filtering stripped links. (V8.29–30)
19. Span dispatch separates `key` from spread props. (V8.29)
20. Region tier description resolves from parent region zone asset. (V8.30)
21. Map tier defaults to Local on initial mount for non-region-zone nodes. (V8.30)
22. New region creation wires origin region symmetrically. (V8.30)
23. RegionBible parse failure never blocks the player. (V8.30)
24. Enemy entries follow Enemy interface. Validation is warn-don't-500. (V8.31)
25. Encounter rosters resolved via 4-layer fall-through; unknown ids scrubbed at apply time. (V8.31)
26. metadata.region_bibles accumulates RegionBibles by id. (V8.31)
27. Combat system design defers to /docs/combat-spec.md. (V8.31)
28. Combat math in `/lib/game/combat-resolver.ts`. Pure functions, RNG injected. (V8.32)
29. Combat turn loop in `/lib/game/combat-engine.ts`. Defeat/victory/flee dismiss combat slice. (V8.32)
30. last_settlement_hub_id + navigation_trail update on every arrival. Initialized at game spawn. (V8.32+38)
31. pre_combat_xp captured at encounter start. Defeat restores xp. (V8.32)
32. Encounter trigger in step 7c-3 — SKIPPED for dungeon nodes (rule 106). (V8.32+60)
33. Enemy behavior hardcoded "attack" regardless of behavior_flavor. (V8.32)
34. GRAPH_NAVIGATE for regions already in metadata.region_bibles with discovered node. (V8.33)
35. apply-regional-bible is idempotent: skipped: true when redundant. (V8.33)
36. mergeNodePreservingDiscovered preserves discovered: true on re-apply. (V8.33)
37. arrivedAt in step 7c reads from updatedState. (V8.33)
38. Combat narration selective: routine templated; dramatic calls /api/game/narrate-combat. (V8.34–37)
39. CombatMode bottom-strip swap when `combat?.active === true`. (V8.34)
40. Each combatant row reserves ~128px portrait slot. (V8.34)
41. Bestiary codex entries write on combat_start, deduplicated by enemy.id. (V8.34)
42. **World intro cinematic modal** fires on first game load when `metadata.world_intro` set + `recentMsgs.length === 0`. Dismissed by click/key. "Your adventure begins." deferred to post-dismiss. (V8.75)
43. Starting equipment in `lib/game/starting-equipment.ts`. (V8.35)
44. Starting weapon: equipped + damage_die. Starting armor: equipped + armor_bonus. (V8.35)
45. combat_start templated, not LLM-narrated. (V8.35)
46. player_turn_start + enemy_phase_start emitted at phase transitions. (V8.35)
47. Pacing: 800ms before enemy_phase_start, 800ms before player_turn_start, 500ms between distinct enemy actors. (V8.35)
48. CombatMode displayPhase decoupled from turn_index, flips ahead of feed. (V8.35)
49. advanceUntilPlayerTurnOrEnd single source of truth for enemy turn loop. (V8.36)
50. kickoffCombat fires initial enemy phase from useEffect when turn_order[0] !== PLAYER. Tracked via useRef. (V8.36)
51. Inventory detail: WEAPON Damage, ARMOR Armor (+0 shown), CONSUMABLE Heal. EQUIPPED pill. (V8.36)
52. Combat input button-only. INTERIM until Day 20.5. (V8.37)
53. Use Item templated: "You use {item}. Restored N HP." Out-of-combat: direct-dispatch via handleDirectConsumeItem. (V8.37+58)
54. Crit: two lines — templated banner instant, then LLM prose. (V8.37)
55. planEventSuppression pre-scans batches. Victory: kill events dropped, last crit prose suppressed. (V8.37)
56. Resolution events: two-line centered block, ≤20-word LLM prose, max_tokens 120. (V8.37)
57. CombatEvent.rolls on every event. (V8.38)
58. Inline roll suffix: `{primary, rolls}` return shape. (V8.38)
59. Floating damage: hit/crit/heal only. (V8.38–39)
60. Defeat teleport: last_settlement_hub_id initialized at spawn; 3-tier fallback. (V8.38)
61. Defeat/flee carry destination payload. Victory does not. (V8.38)
62. rolls.d20 stores raw 1-20. target_dc wrapped in Math.round(). (V8.39)
63. Inventory during combat: USE routes submitCombatAction; Equip/Unequip/Read/Drop hidden. INTERIM. (V8.39)
64. Floating damage routing uses explicit switch(event.type). (V8.40)
65. Settlement-hub detection: is_settlement_node === true predicate only. (V8.39)
66. Floating damage emitted inside projectCombatEventsToFeed, after pacing sleeps. (V8.40)
67. computeFloatStartDelay: 300ms increments, animation-fill-mode: both. (V8.40)
68. Roll display D&D-style: hits/fumbles/crits/heals formats. (V8.40)
69. Codex: CodexModal overlay z-50, ESC + backdrop + X. (V8.40)
70. **CSS containment:** overflow auto clips absolutely-positioned children. Use overflow visible on hosting containers. (V8.40)
71. **Integration tests required for routing helpers.** (V8.40)
72. Nav cards: BACK/DEEPER/PEER/UNDISCOVERED groups. 140px mini-columns, max 2 tall. (V8.41–45)
73. Nav card tier color: region lavender · settlement sky-blue · sub-location mint · dungeon burnt-copper. (V8.41)
74. Cross-region BACK targets previous region's settlement hub. (V8.41)
75. WorldMap cross-region → Region tier. Superseded by rule 81. (V8.41→44)
76. **Origin/main baseline check** as step 1 of every prompt. (V8.41)
77. **RegionBible prompt MUST distinguish settlement_id from region_id.** (V8.42)
78. **Apply-regional-bible: splitConflatedRegionSettlement at step 0d.** (V8.42)
79. **Prompt-template hardcoded IDs are a recurring bug class.** (V8.42)
80. **Nav card dedup at region zone.** DEEPER suppresses settlement if matches BACK. (V8.43–44)
81. **Map tier auto-switch on every arrival.** Region zone → tier 2, else → tier 1. (V8.43–44)
82. **jest baseline history.** 393→…→552→567→580. (V8.47–V8.79)
83. **Loot never auto-credits.** All drops go to floor_loot[]. (V8.47)
84. **Container search is engine-resolved, zero LLM calls.** (V8.47)
85. **Currency + inventory cap canonical.** INVENTORY_CAP = 20. (V8.47)
86. **Revisit suppression.** discovered: true → "You return to {name}." only. (V8.48)
87. **Object popup context-aware labels.** CONTAINER → "Search". ITEM POI → "Examine". (V8.48)
88. **resolveUseItem resolves heal by effect, not id.** (V8.49)
89. **Archetype system in archetypes.ts.** 25 classes. STAT_BASE=2, primary +2, secondary +1. (V8.50)
90. **Level-up post-combat, player-driven.** LevelUpModal + 5-button picker. (V8.50)
91. **jest baseline = 580 (V8.79).** P1 added 13 tests (567→580). 580 is authoritative. (V8.79)
92. **Ability modifier: floor((score-2)/2).** (V8.51)
93. **Enemy stat budgets: tier-1 agi_mod ≤1, hp min ≤8.** (V8.51)
94. **RegionBibleCache in-flight dedup via Map<string, Promise>.** (V8.53)
95. **Post-apply pregeneration burst.** Wizard fires all adjacent_regions. WorldBible NOT split. (V8.53)
96. **Dungeon data layer in two pure modules.** dungeon-validation.ts + dungeon-navigation.ts. (V8.54)
97. **LLM generation prompt skeleton anchors output.** Update skeleton + enforcement + logging together. (V8.55)
98. **Nav card type label via nodeTypeLabel().** settlement_hub→SETTLEMENT · outpost→OUTPOST · wilderness→WILDERNESS · dungeon→DUNGEON · landmark→LANDMARK · abandoned_settlement→RUINS. (V8.56+63)
99. **Dungeon runtime in hooks/useDungeonRuntime.ts.** Separate hook. (V8.57)
100. **Room navigation semantics.** First-visit encounter; revisit suppresses. BACK from entrance → region zone. (V8.57)
101. **DungeonLockPopover.** Locked boss card → hint + [USE key] + [FORCE STR ≥ 6] + Close. (V8.57)
102. **Dungeon narrator context.** CURRENT ROOM injected, inventory stripped, adjacent rooms only. (V8.58)
103. **Quest schema types.** QuestArchetype (6), FinaleType, QuestStatus, QuestFaction, QuestBreadcrumb, QuestResolution, MainQuest, SideQuest, QuestEntry, QuestThreads. (V8.59)
104. **WCD generates main quest seed; WorldBible expands it.** 4 breadcrumbs + 2 resolutions + world_intro_template. (V8.59+64)
105. **World intro template.** {name}/{class}/{motivation} resolved in apply-world-bible. (V8.59+73)
106. **Dungeon encounter guards.** (A) isDungeonNode → skip step 7c-3. (B) combatBlocksDungeonEntry. (V8.60)
107. **Narrator items_acquired permanently blocked.** (V8.61)
108. **Dungeon lock hint must not name the key item.** (V8.61)
109. **Region zone node spawns discovered: false.** (V8.62)
110. **World intro cinematic modal** — see rule 42. (V8.75)
111. **Act 1 breadcrumb discovery.** Two triggers: DIALOGUE + boss clear. (V8.62)
112. **Sub-location node_type fix.** (V8.63)
113. **Quest discovery pipeline.** Boss-clear 1200ms. Dialogue: pendingAct1Reveal → useDeferredQuestReveal → currentDialogueNpc null gate → act1RevealFiredRef latch → 2500ms. (V8.63+64+65+76)
114. **JournalModal + journal entry generation.** 4 tabs. haiku 200 tokens. CHARACTER VOICE block. (V8.63+65+66+73)
115. **Codex concurrent-write race guard.** (V8.65)
116. **Side quest generation (Day 23D).** Synchronous in apply-regional-bible. (V8.66)
117. **Region zone + settlement spawn discovered: false.** (V8.67)
118. **Quest seed in narrator DIALOGUE context.** SITUATION sub-block. (V8.67)
119. **Generation timing instrumentation.** [GEN_TIMING] logs. (V8.68)
120. **WCD max_tokens 4000, sonnet.** (V8.68+70)
121. **WorldBible max_tokens 10000, sonnet.** (V8.69)
122. **RegionBible max_tokens 7000, haiku.** (V8.69)
123. **RegionBible burst confirmed parallel.** (V8.68)
124. **No token cap changes without output_tokens data.** (V8.69)
125. **Species generated in WCD.** Fantasy can skip Elf/Dwarf anchor for oceanic/urban/desert worlds. (V8.70+72)
126. **Species schema.** Full schema in types/game.ts. PassiveTrait max 2. stat_modifiers: exactly ±1, max 2 entries. (V8.70+74)
127. **PlayerCharacterProfile schema.** species_id + gender + origin + appearance + motivation. (V8.70+71)
128. **NPCDefinition extended.** species_id? + disposition_modifiers? + min_trust_to_recruit? (V8.70)
129. **WorldBible species context block.** 3-5 lines injected. (V8.70)
130. **WCD character fields optional.** WCD fires on genre select. (V8.71)
131. **Character creation wizard: 7-step flow.** genre → forging → species → class → origin → appearance → name → motivation. (V8.71)
132. **WorldForgingScreen.** Blinking ▋ cursor stages 1+2. Stage 4 hold 2500ms. Fast WCD skips stage 2. (V8.71+72)
133. **Haiku generation routes.** origin-options · appearance-options · random-name · random-character · random-motivation (100 char cap). (V8.71+72+76)
134. **save-character-profile route.** Atomic read→patch→write. (V8.71)
135. **Origin generation fires on class select.** (V8.71)
136. **Appearance generation: gender-aware cache.** Gender toggle on appearance step only. (V8.71+72)
137. **Motivation step UX.** "I came to this world to…". Skip: "Play as a blank slate". Randomize (120 char cap). (V8.72+76)
138. **Random mode.** Full coherent character, lands on name step. Appearance summary name-agnostic. (V8.71+76)
139. **WorldBible fires in background after WCD completes.** (V8.72+74)
140. **PLAYER CHARACTER narrator block.** formatPlayerCharacterBlock(state). Between WCD and HARD RULES. COMBAT exempt. (V8.73)
141. **Trust formula: computeInitialTrust(state, npcAsset).** 50 + species.npc_disposition_seed + disposition_modifiers, clamped 0–100. (V8.73)
142. **{motivation} resolved in world_intro_template.** (V8.73)
143. **Journal CHARACTER VOICE block.** (V8.73)
144. **world_name = entire game world.** Per-genre scope rules. (V8.74)
145. **Species stat_modifiers: exactly ±1, max 2 entries.** normalizeWcd clamps defensively. (V8.74)
146. **Disposition seed COMMITMENT RULE.** Feared → ≤-8. Revered → ≥+8. Neutral → 0. (V8.74)
147. **NPC names WCD-anchored.** Skeleton placeholders. (V8.74)
148. **WorldBible background validation fix.** Only requires genre + wcd. (V8.74)
149. **Quest modal double-fire fixed.** currentDialogueNpc === null gate + act1RevealFiredRef latch. (V8.76)
150. **Maritime theme prompt cap (TEMPORARY).** Band-aid until Genre Session. (V8.76)
151. **Motivation char limit enforced.** Prompt + server-side slice(0,120). (V8.76)
152. **Appearance summary name-agnostic.** Prompt rule + normalizeCharacter regex strip. (V8.76)
153. **World theme taxonomy designed.** 54 themes in Drive: "world-theme-taxonomy". Genre Session implementation. (V8.76)
154. **Death penalty designed + shipped P1.** 10% gold (cap 50) + 75% HP spawn + Inn Rest (10g → HP to max). (V8.77+79)
155. **Economy baseline designed.** Price tiers, enemy gold drops, merchant seeding rules. Drive: "economy-and-progression-design-spec". (V8.77)
156. **Merchant trading architecture designed.** World-asset-backed inventory, trust pricing, speciality selling. P3 scope. (V8.77)
157. **Status effects designed + shipped.** Engine P1. World aliases P2. UI P5. (V8.77+79+80)
158. **Damage type system designed + shipped.** P1 engine. P2 generation guidance. (V8.77+79+80)
159. **Abilities system designed.** 125 templates + LLM flavor; learned pool vs equipped slots; stat gates; 3 acquisition paths. P6–P7 scope. Flavor names deferred to P7. (V8.77+80)
160. **Perks system designed.** ~20 pool, every 4 combat levels (4/8/12/16/20). P8 scope. (V8.77)
161. **Professions system designed.** 3 professions, 20 levels, RuneScape-inspired, MATERIAL ItemType. P9–P11 Day 25. (V8.77)
162. **Horror genre deferred.** Sanity = declared stub. Marks = codebase inconsistency. Genre Session. (V8.77)
163. **Comprehensive build order.** Drive: "design-session-master-summary-2026-05-13". (V8.77)
164. **Level cap: 20.** Ability slots 5/10/15. Perk gates 4/8/12/16/20. Item gates: UNCOMMON L5+stat≥4, RARE L10+stat≥6, LEGENDARY L15+stat≥8 or class-locked. (V8.78)
165. **No mana system.** Cross-class stat gate ≥ 6. Class abilities: no gate. (V8.78)
166. **Ability pool model.** LEARNED POOL (5–7) vs EQUIPPED SLOTS (4). Attunement at settlements/Inn Rest. (V8.78)
167. **Ability slot assignment.** Slot 1 fixed. Slot 2 random at L5. Slots 3–4 pick 1-of-2 at L10/L15. Option B world-influenced. Pool = 8–10 per class; 3 drawn per run. (V8.78)
168. **Ability acquisition.** (1) class; (2) lore items (teaches_ability, stat-gated); (3) NPC trust ≥ 70–80. Never runtime-generated. (V8.78)
169. **Lore item rarity rule.** COMMON/UNCOMMON max 1 function. RARE max 2. LEGENDARY max 2 + breadcrumb. (V8.78)
170. **Profession access.** Guaranteed manuals in starting settlement ✅ P2. (V8.78+80)
171. **Post-quest world state.** End Chapter OR Continue Exploring. QUEST_STATUS: resolved_[id] in narrator permanently. Zero content locks. (V8.78)
172. **Ability library v1 complete.** Drive: "ability-library-v1-all-25-classes". Variant pools v2 pending before P6. (V8.78)
173. **Ability system architecture final.** Drive: "ability-system-architecture-v2-final". (V8.78)
174. **Status effect world aliases.** WCD.status_effect_aliases — rootblight rule. ✅ P2. (V8.78+80)
175. **Prompt workflow.** Prompts written in Claude.ai conversation. Drive = design specs only. (V8.78)
176. **11-prompt implementation arc defined.** P1–P8 active; P9–P11 Day 25. (V8.78)
177. **P1 shipped d577359.** Full status effects engine + death penalty rebalance + 3-tier gold. 567→580 tests. (V8.79)
178. **P2 shipped 354a013.** WCD status_effect_aliases. WB/RB enemy type guidance + profession manuals mandatory. Prompt-text only. (V8.80)
179. **PROMPT-LOG.md introduced.** Volatile build state (commit, baseline, P-table) lives in PROMPT-LOG.md. CLAUDE.md only updated when rules or architecture change. (V8.80)

---

## Side Quest Source Taxonomy
See Drive: "quest-source-taxonomy". 23D scope done: NPC direct ask + NPC rumor. Post-23D: objects, boss drops, shrines, environmental, item-as-hook.

---

## Narrator Prompt Order

DIALOGUE: WCD → HARD RULES → PLAYER CHARACTER → RESPONDING CHARACTER → CLOSED CONTEXT → TIER 1 OBJECTS → WORLD ASSETS → SCENE → VERBOSITY
non-DIALOGUE: WCD → HARD RULES → PLAYER CHARACTER → NPCS PRESENT → TIER 1 OBJECTS → CONNECTED LOCATIONS → WORLD ASSETS → SCENE → VERBOSITY
DUNGEON ROOM: WCD → HARD RULES → PLAYER CHARACTER → CURRENT ROOM → OBJECTS IN ROOM → ADJACENT ROOMS → SCENE → VERBOSITY
COMBAT: GENRE TONE PRIMER → COMBAT EVENT → HARD RULES → length hint

---

## Story Feed Colors

| Use | Color | Token |
| --- | --- | --- |
| Narrator prose | var(--ink-1) | — |
| NPC quoted speech | #f0c060 italic weight 600 | --hl-said |
| Player actions | #7ab8c8 teal-blue 12px mono italic | — |
| Item highlights | #e8c547 yellow | --hl-item |
| Region highlights | #c4b5fd lavender | --hl-region |
| Location highlights | #7dd3fc sky-blue | --hl-loc |
| Sub-location / Landmark | #94d8b8 mint | --hl-sublocation / --hl-landmark |
| Dungeon | #b45309 burnt-copper | --hl-dungeon |
| NPC highlights | var(--accent) orange | — |
| Level-up beat | --hl-pass green (centered) | — |
| World intro | WorldIntroModal cinematic overlay | — |
| Main quest discovery | ✦ amber/gold serif italic 13px | var(--accent) |
| Side quest discovery | 11px serif italic accent 0.9 opacity, immediate | — |
| Quest reveal modal | persistent overlay, X/backdrop/Escape | — |
| Combat player/enemy routine | #7ab8c8 / #e87c6d | — |
| Combat crits | #3b82a8 / #c0392b BOLD | — |
| Combat outcomes | #7dbb8e / #a93226 / #a8a29c | victory / defeat / flee |
| Encounter banner | #f4a07a | --combat-encounter-banner |
| Roll detail suffix | 10px dim mono 0.6 opacity | — |
| Floating damage | 28px (36px crit) bold, 1100ms fade | — |
| Resolution destination | 12px italic serif 0.75 opacity | — |

---

## Tech Stack · Classes · Monetization

**Stack:** Next.js 14 · Tailwind + shadcn/ui · Supabase · claude-sonnet-4-5 · claude-haiku-4-5-20251001 · Stripe · Vercel · Howler.js · Zustand

| Genre | Color | Currency | HP | Classes |
| --- | --- | --- | --- | --- |
| Fantasy | #f59e0b amber | Gold | HP | Knight · Rogue · Mage · Ranger · Herald |
| Cyberpunk | #22d3ee cyan | Credits | Integrity | Netrunner · Fixer · Street Samurai · Enforcer · Ghost |
| Horror | #84cc16 acid green | Marks | HP+Sanity | Investigator · Cultist · Survivor · Phantom · Medium |
| Space Opera | #a855f7 purple | Stellar Units | Hull Integrity | Commander · Pilot · Engineer · Marine · Recon |
| Post-Apoc | #ea580c rust | Caps | HP | Scavenger · Raider · Medic · Runner · Demagogue |

| Feature | Free | Adventurer $6.99 | Legend $14.99 |
| --- | --- | --- | --- |
| Genres | Fantasy | All 5 | All 5 + future |
| Save Slots | 1 | 3 | Unlimited |
| AI Actions/Day | 50 | Unlimited | Unlimited |
| Priority Speed | ❌ | ❌ | ✅ |

---

## Workflow

Claude.ai owns CLAUDE.md and PROMPT-LOG.md. After every prompt: update PROMPT-LOG.md (always) + CLAUDE.md (only when rules change).

Round flow: Claude Code pushes → Tim reports → Claude.ai updates PROMPT-LOG.md → Tim verifies → next prompt.

**Protocols:** Origin/main baseline check (rule 76) · Investigation-before-patching (V8.40) · No token cap changes without output_tokens data (V8.69) · Prompts written in Claude.ai conversation (rule 175). **npx jest (no pattern) = authoritative count. Baseline = 580 (rule 91).**

**Note:** Remote URL `https://github.com/AtomicTim/endless-worlds-rpg.git` (capitalized).

**Authority:** architecture-spec.md · combat-spec.md · quest-system-spec.md · Game Vision · project-log.md.
