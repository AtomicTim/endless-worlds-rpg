# Project: Endless Worlds RPG — Master Context

**Version:** 8.72
**Status:** Day 23.5B hotfix 4d0cc98 complete (567/567) — 23.5C narrator + trust integration next
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
15b. ~~Gen speed audit~~ ✅
15c. ~~Day 23.5A — Types + WCD species + storage~~ ✅
15d. ~~Day 23.5B — Character creation UI + hotfix~~ ✅
15e. **Day 23.5C — Narrator + trust integration** ⏳ NEXT
15f. Day 23.5D — World intro cinematic modal ⏳
16–18. Merchant Trading · Combat UX Polish · Mobile Combat Layout
19. Day 24 — Multiplayer Foundation
20. Day 25 — Customization Layer
21+. Genre Session · UI Overhaul · Verbal Action · Stealth (deferred)

---

## Current Status

**Phase:** 23.5B + hotfix complete. Character creation fully polished. 23.5C wires character context into narrator, trust, world intro, and journal.
**Stack:** Next.js 14 / Tailwind / shadcn/ui / Supabase / Claude API / Stripe / Vercel · **Repo:** AtomicTim/endless-worlds-rpg

| Phase | Status |
| --- | --- |
| Gen pipeline + Day 23A–23D (all parts + fixes) | ✅ |
| Day 23.5A — Types + WCD species + storage (6c137aa) | ✅ |
| Day 23.5B — Character creation UI (eb6df59) | ✅ |
| Day 23.5B hotfix — timing, gender cache, motivation UX, bg WorldBible (4d0cc98) | ✅ |
| **Day 23.5C — Narrator + trust integration** | ⏳ NEXT |
| Day 23.5D — World intro cinematic modal | ⏳ |
| Merchant Trading / Combat UX / Mobile Layout | ⏳ |
| Day 24 Multiplayer / Day 25 Customization | ⏳ |

**Known issues:** HP bar timing (deferred) · No equip during combat (intentional, rule 63) · Nav card peer disappearance (unresolved) · Nav card color differentiation for non-dungeon region_locations (deferred).

### Day 23.5B hotfix (4d0cc98, 567/567, tsc clean) — bundle 18.3→19kB

**FIX 1 — WorldForgingScreen:** Blinking `▋` cursor on stage 1+2 messages (1s pulse). Stage 4 hold extended 800ms→2500ms. Stage 1→2 timer respects startedRef latch — fast WCD response skips stage 2 entirely, goes straight to stage 3.

**FIX 2 — WCD Fantasy anchor:** Added single sentence allowing model to skip Elf/Dwarf anchor for oceanic/urban/desert worlds; generates 2 world-specific species instead.

**FIX 3 — Gender:** Toggle removed from name step — lives on appearance step only. `appearanceByGender` cache — second toggle to previously-loaded gender uses cache (zero network calls). Cache invalidates on species or class change.

**FIX 4 — Motivation UX:** Placeholder → "I came to this world to…". Skip label → "Play as a blank slate". New `✦ Randomize →` button calling `/api/game/generate-random-motivation` (haiku, 100 tokens). Character summary card above textarea showing species + class + origin + appearance + name.

**FIX 5 — Background WorldBible:** `generate-world-bible` fires immediately when WCD completes (`worldBibleResultRef` + `worldBiblePromiseRef`). `handleSubmit` consumes cached result → awaits in-flight promise → falls back to synchronous retry. Empty character_name/class passed to background call; apply-world-bible already resolves world_intro_template from master_state.player_state.

---

## Day 23.5C — Narrator + Trust Integration (NEXT)

### What 23.5C implements

**1. prompt-builder.ts — PLAYER CHARACTER block**
Add to every narrator prompt (DIALOGUE, non-DIALOGUE, DUNGEON ROOM — not COMBAT):
```
═══ PLAYER CHARACTER ═══
Species: {species.name} — {species.lore_notes}
Gender: {gender}
Appearance: {appearance.summary}
Origin: {origin.label} — {origin.description}
Motivation: {motivation}     ← omit block line if empty
════════════════════════
```
Read species from `metadata.species?.find(s => s.id === player.character_profile?.species_id)`.
If character_profile is absent (old saves): omit the block entirely — no crash.
Position: after WCD block, before HARD RULES.

**2. Trust formula — species npc_disposition_seed**
Find where NPC trust/disposition is initialized at first encounter.
Incorporate:
```
effective_trust = base_trust (50)
  + (species?.npc_disposition_seed ?? 0)
  + (npc.disposition_modifiers?.toward_species[player.species_id] ?? 0)
  + existing world_state modifiers
```
All modifiers ±25 max. Seeds, not locks.

**3. apply-world-bible — {motivation} resolution**
Currently resolves `{name}` and `{class}` in `world_intro_template`.
Add `{motivation}` — read from `character_profile?.motivation ?? ""`.
If motivation is empty string: replace `{motivation}` with empty string (no placeholder visible).

**4. generate-journal-entry — character profile context**
Pass `character_profile` in the journal generation request.
Journal prompt should reference species, origin, and motivation
to shape the diary voice (a Tideborn Curse-Breaker writes differently than a Human Herald).

---

## Day 23.5D — World Intro Cinematic Modal (after 23.5C)

Replaces the current `ew-world-intro` NARRATIVE beat in the story feed entirely.

**Design:** Full-screen cinematic overlay, fades in on first game load (when `recent_messages === 0`). Dismissed by clicking anywhere or pressing any key — no close button, no X. More like a book opening than a notification.

**Contents:**
- World name: large, centered, genre primary color, text-glow
- World intro prose: italic serif, centered, max-width readable
- Subtle vignette/gradient overlay on dark background
- "Click anywhere to begin..." hint text at bottom (small, muted, pulsing)

**Distinct from quest reveal modal:** Quest reveal has header + X button + amber accent = functional. World intro has no UI chrome = cinematic. Different z-index class. Different animation (slow fade vs slide).

**Fires:** Once per session on first load when `metadata.world_intro` is set and `recent_messages === 0`. After dismiss: fires the existing "Your adventure begins." SYSTEM beat into the story feed (currently the preamble does this — move that logic to post-dismiss).

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
42. New game preamble: world intro cinematic modal fires on first load (23.5D); then "Your adventure begins." SYSTEM beat. (V8.34+59+62+72)
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
99. **Dungeon runtime in hooks/useDungeonRuntime.ts.** Separate hook. initDungeonState on arrival; re-fire guarded by useRef; "The dungeon falls silent." on boss clear. (V8.57)
100. **Room navigation semantics.** First-visit encounter; revisit suppresses. BACK from entrance → region zone; else → entrance. dungeon_state persists. (V8.57)
101. **DungeonLockPopover.** Locked boss card → hint + [USE key when held] + [FORCE STR ≥ 6] + Close. (V8.57)
102. **Dungeon narrator context.** CURRENT ROOM injected, inventory stripped, adjacent rooms only. (V8.58)
103. **Quest schema types.** QuestArchetype (6), FinaleType, QuestStatus, QuestFaction, QuestBreadcrumb, QuestResolution, MainQuest, SideQuest, QuestEntry, QuestThreads. (V8.59)
104. **WCD generates main quest seed; WorldBible expands it.** 4 breadcrumbs + 2 resolutions + world_intro_template. initializeQuestThreads at apply time. (V8.59+64)
105. **World intro template + RegionBible breadcrumb seeding.** {name}/{class}/{motivation} → metadata.world_intro. (V8.59+72)
106. **Dungeon encounter guards.** (A) isDungeonNode → skip step 7c-3. (B) combatBlocksDungeonEntry → bail useDungeonRuntime when combat active. (V8.60)
107. **Narrator items_acquired permanently blocked.** acceptNarratorItemsAcquired() → always []. (V8.61)
108. **Dungeon lock hint must not name the key item.** (V8.61)
109. **Region zone node spawns discovered: false.** Only starting settlement spawns discovered: true. (V8.62)
110. **World intro display.** Cinematic modal on first load (23.5D). Fires "Your adventure begins." after dismiss. (V8.62+72)
111. **Act 1 breadcrumb discovery.** quest-discovery.ts pure helpers. Two triggers (DIALOGUE + boss clear). (V8.62)
112. **Sub-location node_type fix.** Only is_settlement_node:true gets node_type:"settlement_hub". (V8.63)
113. **Quest discovery pipeline.** Boss-clear: 1200ms. Dialogue: pendingAct1Reveal → useDeferredQuestReveal 2500ms. QuestRevealModal: persistent hold. Acts 2/3: delayed ✦ beat only. (V8.63+64+65)
114. **JournalModal + journal entry generation.** 4 tabs. haiku 200 tokens. LogEntryType.QUEST. (V8.63+65+66)
115. **Codex concurrent-write race guard.** Module-scoped Set<string> keyed by sessionId:entryId. (V8.65)
116. **Side quest generation (Day 23D).** filterQuestHookNpcs, generateSideQuests (haiku 800 tok), mergeSideQuests. Synchronous in apply-regional-bible. (V8.66)
117. **Region zone + settlement spawn discovered: false.** Rule 12 flips on actual arrival. (V8.67)
118. **Quest seed in narrator DIALOGUE context.** SITUATION sub-block for quest-hook NPCs. (V8.67)
119. **Generation timing instrumentation.** [GEN_TIMING] logs on WCD, WorldBible, WorldSeed, RegionBible. (V8.68)
120. **WCD max_tokens 4000, sonnet.** Output ~1800-3117 tokens with species. (V8.68+70+71)
121. **WorldBible max_tokens 10000, sonnet.** Output ~7997-9251 tokens. (V8.69)
122. **RegionBible max_tokens 7000, haiku.** Output 5000-6000 tokens typical. (V8.69)
123. **RegionBible burst confirmed parallel.** fire-and-forget in-flight Map. (V8.68)
124. **No token cap changes without output_tokens data.** (V8.69)
125. **Species generated in WCD.** species[] + damage_type_aliases[] in WCD. Stored by both apply routes. 3-4 species per world. Fantasy can skip Elf/Dwarf anchor for oceanic/urban/desert worlds — emits 2 world-specific instead. (V8.70+72)
126. **Species schema.** Full schema in types/game.ts. PassiveTrait max 2. Unknown effect_types → flavor_only. (V8.70)
127. **PlayerCharacterProfile schema.** species_id + gender("male"|"female") + origin + appearance + motivation. Stored at MasterState.player.character_profile. (V8.70+71)
128. **NPCDefinition extended.** species_id? + disposition_modifiers? + min_trust_to_recruit? (V8.70)
129. **WorldBible species context block.** 3-5 lines after WCD block. No restructuring of 36K prompt. (V8.70)
130. **WCD character fields optional.** WCD fires on genre select, before name/class known. (V8.71)
131. **Character creation wizard: 7-step flow.** WizardStage: genre → forging → species → class → origin → appearance → name → motivation. (V8.71)
132. **WorldForgingScreen.** 4-stage genre messaging + 80ms/char typewriter. Blinking ▋ cursor on stages 1+2. Stage 4 hold = 2500ms. Fast WCD skips stage 2 directly to stage 3. (V8.71+72)
133. **Haiku generation routes.** generate-origin-options · generate-appearance-options · generate-random-name · generate-random-character · generate-random-motivation (100 tok). (V8.71+72)
134. **save-character-profile route.** Atomic read→patch→write. (V8.71)
135. **Origin generation fires on class select.** useEffect watching selectedBackground. (V8.71)
136. **Appearance generation: gender-aware cache.** appearanceByGender state — toggle between genders uses cache after first generation. Invalidates on species or class change. Gender toggle on appearance step only (removed from name step). (V8.71+72)
137. **Motivation step UX.** Placeholder: "I came to this world to…". Skip: "Play as a blank slate". Randomize button (haiku). Character summary card above textarea. (V8.72)
138. **Random mode.** Single haiku call generates full coherent character. Lands on name step pre-filled. (V8.71)
139. **WorldBible fires in background after WCD completes.** worldBibleResultRef + worldBiblePromiseRef. handleSubmit: use cache → await in-flight → synchronous retry. Empty character_name/class in background call. (V8.72)
140. **PLAYER CHARACTER narrator block.** Added to DIALOGUE, non-DIALOGUE, DUNGEON ROOM prompts in 23.5C. Not yet in prompt-builder. Position: after WCD, before HARD RULES. Old saves without character_profile: block omitted entirely. (V8.72 — pending 23.5C)
141. **Trust formula includes species.npc_disposition_seed.** Implemented in 23.5C. (V8.72 — pending)
142. **world_intro_template resolves {name}/{class}/{motivation}.** {motivation} added in 23.5C. (V8.72 — pending)
143. **World intro cinematic modal.** Full-screen fade-in on first game load. No close button — dismissed by click/key. World name + italic serif prose. "Click anywhere to begin..." hint. Fires "Your adventure begins." after dismiss. Implemented in 23.5D. (V8.72 — pending)

---

## Side Quest Source Taxonomy
See Drive doc "quest-source-taxonomy" for full spec.
**23D scope (done):** NPC direct ask + NPC rumor.
**Post-23D:** Dungeon objects, boss drops, shrines, environmental, item-as-hook.
**Key rule:** Side quest discovery = quiet immediate beat only.

---

## Narrator Prompt Order

DIALOGUE: WCD → HARD RULES → **PLAYER CHARACTER** → RESPONDING CHARACTER → CLOSED CONTEXT → TIER 1 OBJECTS → WORLD ASSETS → SCENE → VERBOSITY
non-DIALOGUE: WCD → HARD RULES → **PLAYER CHARACTER** → NPCS PRESENT → TIER 1 OBJECTS → CONNECTED LOCATIONS → WORLD ASSETS → SCENE → VERBOSITY
DUNGEON ROOM: WCD → HARD RULES → **PLAYER CHARACTER** → CURRENT ROOM → OBJECTS IN ROOM → ADJACENT ROOMS → SCENE → VERBOSITY
COMBAT: GENRE TONE PRIMER → COMBAT EVENT → HARD RULES → length hint
**PLAYER CHARACTER block added in 23.5C — bold = pending implementation.**

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
| World intro | cinematic modal (23.5D) — replaces ew-world-intro NARRATIVE beat | — |
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
