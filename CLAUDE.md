# Project: Endless Worlds RPG — Master Context

**Version:** 8.74
**Status:** Gen quality hotfix f737c54 complete (567/567) — 23.5D world intro cinematic modal next
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

**Decision flow:** Tim describes → Claude.ai assesses → Tim decides → Claude.ai writes prompt → Claude Code implements → Tim verifies → Claude.ai updates CLAUDE.md.

**Per-prompt protocols:**
- **V8.40** — Investigation-before-patching.
- **V8.41** — Origin/main baseline check: `git fetch origin && git log origin/main --oneline -5` as step 1.
- **V8.66** — jest baseline = 567. See rule 91.
- **V8.69** — No token cap changes without confirmed output_tokens data first.

---

## Trajectory

> Full notes, round history, future features in `/docs/project-log.md`. Quest spec in `/docs/quest-system-spec.md`. Quest source taxonomy in Drive: "quest-source-taxonomy". Character creation design in Drive: "day-23-5-character-creation-design-spec-v2".

### Sequence

1–15. ~~Through Day 23D + hotfixes~~ ✅
15b–e. ~~Gen speed audit + Day 23.5A/B/C + gen quality hotfix~~ ✅
15f. **Day 23.5D — World intro cinematic modal** ⏳ NEXT
16–18. Merchant Trading · Combat UX Polish · Mobile Combat Layout
19. Day 24 — Multiplayer Foundation
20. Day 25 — Customization Layer
21+. Genre Session (incl. world structure per-genre) · UI Overhaul · Verbal Action · Stealth (deferred)

---

## Current Status

**Phase:** All 23.5 work complete. Gen quality hotfix landed. 23.5D is the final piece before Merchant Trading.
**Stack:** Next.js 14 / Tailwind / shadcn/ui / Supabase / Claude API / Stripe / Vercel · **Repo:** AtomicTim/endless-worlds-rpg

| Phase | Status |
| --- | --- |
| Day 23.5A–C + hotfixes | ✅ |
| Gen quality hotfix f737c54 | ✅ |
| **Day 23.5D — World intro cinematic modal** | ⏳ NEXT |
| Merchant Trading / Combat UX / Mobile Layout | ⏳ |
| Day 24 Multiplayer / Day 25 Customization | ⏳ |

**Known issues:** HP bar timing (deferred) · No equip during combat (intentional, rule 63) · Nav card peer disappearance (unresolved) · Nav card color differentiation for non-dungeon region_locations (deferred).

**Deferred design discussion:** World structure per-genre. Cyberpunk/Post-Apoc/Horror are Earth-based — the "world with named regions" model doesn't fit. Genre Session (Day 21+) to address this properly.

### Gen quality hotfix (f737c54, 567/567, tsc clean)

**FIX 1 — world_name per-genre scope:** world_name = name of entire game world (planet/continent/reality). Per-genre guidance: Fantasy = invented world name; Post-Apoc = remnant Earth territory; Horror = isolated location/community; Cyberpunk = future city/corporate zone name; Space Opera = planet/system name. Hard MUST-NOT list: settlement names, document titles, geographic features.

**FIX 2 — Species stat_modifiers cap:** Exactly 2 entries max, each exactly ±1. One positive, one negative. Cyberpunk Augmented anchor rewritten to conform. normalizeWcd defense-in-depth: clamps entries to ±1, caps to 2, drops extras silently.

**FIX 3 — Disposition seed commitment:** COMMITMENT RULE added. If lore_notes describes fear/persecution → seed ≤ -8. If revered/trusted → seed ≥ +8. If neutral → seed = 0. Forbids tension-laden lore with near-zero seeds.

**FIX 4 — NPC name WCD-anchoring:** WorldBible + RegionBible NPC skeletons replaced with `"<NPC name derived from WCD cultural context>"` placeholders. Both prompts gain WCD-anchored naming instruction: names derive from world's cultural/geographic/atmospheric context, not generic naming pools.

**FIX 5 — WorldBible background fire root cause fixed:** generate-world-bible was requiring non-empty character_name/character_class — 400-ing the background call from /game/new which passes "". Validation now only requires genre + wcd. Logs: `[WB] generating with character context` (foreground) vs `[WB_BACKGROUND] generating without character context` (background). {name}/{class} resolution confirmed in apply-world-bible only.

---

## Day 23.5D — World Intro Cinematic Modal (NEXT)

Replaces the current `ew-world-intro` NARRATIVE beat in the story feed entirely.

**Design:** Full-screen cinematic overlay, fades in on first game load (`recent_messages === 0`). Dismissed by clicking anywhere or pressing any key — no close button, no X. Like a book opening, not a notification.

**Contents:**
- World name: large, centered, genre primary color, text-glow
- World intro prose: italic serif, centered, max-width readable, pre-wrap
- Subtle radial vignette on dark background
- "Click anywhere to begin..." hint at bottom (small, muted, pulse animation)

**Distinct from quest reveal modal:** Quest reveal = header + X button + amber accent = functional. World intro = no chrome = cinematic.

**Trigger:** `metadata.world_intro` is set AND `recent_messages === 0`. After dismiss: fire "Your adventure begins." SYSTEM beat.

**Old saves (no world_intro):** Modal never shows. Existing preamble behavior unchanged.

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
42. **World intro cinematic modal** fires on first game load when `metadata.world_intro` set + `recent_messages === 0`. Dismissed by click/key. "Your adventure begins." fires post-dismiss. Old saves: modal never shows. (V8.73+74)
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
82. **jest baseline history.** 393→…→552→567 (+15 Day 23D). See rule 91. (V8.47–V8.66)
83. **Loot never auto-credits.** All drops go to floor_loot[]. (V8.47)
84. **Container search is engine-resolved, zero LLM calls.** (V8.47)
85. **Currency + inventory cap canonical.** INVENTORY_CAP = 20. (V8.47)
86. **Revisit suppression.** discovered: true → "You return to {name}." only. (V8.48)
87. **Object popup context-aware labels.** CONTAINER → "Search". ITEM POI → "Examine". (V8.48)
88. **resolveUseItem resolves heal by effect, not id.** (V8.49)
89. **Archetype system in archetypes.ts.** 25 classes. STAT_BASE=2, primary +2, secondary +1. (V8.50)
90. **Level-up post-combat, player-driven.** LevelUpModal + 5-button picker. (V8.50)
91. **jest baseline = 567 (V8.66).** Day 23D added 15 tests (552→567). 567 is authoritative. (V8.66)
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
110. **World intro cinematic modal (23.5D).** Full-screen fade-in, dismissed by click/key, fires "Your adventure begins." after dismiss. Old saves: falls through to existing preamble. (V8.73)
111. **Act 1 breadcrumb discovery.** Two triggers: DIALOGUE + boss clear. (V8.62)
112. **Sub-location node_type fix.** (V8.63)
113. **Quest discovery pipeline.** Boss-clear 1200ms. Dialogue: pendingAct1Reveal → 2500ms. QuestRevealModal: persistent hold. (V8.63+64+65)
114. **JournalModal + journal entry generation.** 4 tabs. haiku 200 tokens. CHARACTER VOICE block from character_profile. (V8.63+65+66+73)
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
133. **Haiku generation routes.** origin-options · appearance-options · random-name · random-character · random-motivation. (V8.71+72)
134. **save-character-profile route.** Atomic read→patch→write. (V8.71)
135. **Origin generation fires on class select.** (V8.71)
136. **Appearance generation: gender-aware cache.** Gender toggle on appearance step only. (V8.71+72)
137. **Motivation step UX.** "I came to this world to…". Skip: "Play as a blank slate". Randomize. Character summary card. (V8.72)
138. **Random mode.** Full coherent character, lands on name step. (V8.71)
139. **WorldBible fires in background after WCD completes.** worldBibleResultRef + worldBiblePromiseRef. Root cause of 400 fixed (character_name/class now optional in route). (V8.72+74)
140. **PLAYER CHARACTER narrator block.** `formatPlayerCharacterBlock(state)` in prompt-builder. Between WCD and HARD RULES. COMBAT exempt. Old saves: block omitted. (V8.73)
141. **Trust formula: computeInitialTrust(state, npcAsset).** 50 + species.npc_disposition_seed + npc.disposition_modifiers, clamped 0–100. (V8.73)
142. **{motivation} resolved in world_intro_template.** (V8.73)
143. **Journal CHARACTER VOICE block.** generate-journal-entry loads master_state, builds character voice context. (V8.73)
144. **world_name = entire game world.** Per-genre scope: Fantasy=invented world; Post-Apoc=remnant Earth territory; Horror=isolated location; Cyberpunk=future city/corporate zone; Space Opera=planet/system. NOT a settlement, document title, or geographic feature. (V8.74)
145. **Species stat_modifiers: exactly ±1, max 2 entries.** One +1, one -1. normalizeWcd clamps defensively. (V8.74)
146. **Disposition seed COMMITMENT RULE.** Feared/persecuted lore → seed ≤ -8. Revered → seed ≥ +8. Neutral → seed = 0. Lore and seed must agree. (V8.74)
147. **NPC names WCD-anchored.** Skeleton placeholders `<NPC name derived from WCD cultural context>`. Naming instruction in both WorldBible + RegionBible prompts. (V8.74)
148. **WorldBible background validation fix.** generate-world-bible now only requires genre + wcd. character_name/class optional. Background call logs [WB_BACKGROUND]. (V8.74)

---

## Side Quest Source Taxonomy
See Drive doc "quest-source-taxonomy" for full spec.
**23D scope (done):** NPC direct ask + NPC rumor.
**Post-23D:** Dungeon objects, boss drops, shrines, environmental, item-as-hook.

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
| World intro | cinematic modal — no story feed beat (23.5D) | — |
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

Claude.ai owns all CLAUDE.md updates. Round flow: Claude Code pushes → Tim reports → Claude.ai updates docs → Tim verifies → next prompt.

**Protocols:** Origin/main baseline check (rule 76) · Investigation-before-patching (V8.40) · No token cap changes without output_tokens data (V8.69). **npx jest (no pattern) = authoritative count. Baseline = 567 (rule 91).**

**Note:** Remote URL `https://github.com/AtomicTim/endless-worlds-rpg.git` (capitalized).

**Authority:** architecture-spec.md · combat-spec.md · quest-system-spec.md · Game Vision · project-log.md.
