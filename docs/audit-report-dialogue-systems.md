# Dialogue / World Graph / Asset Consistency — Audit Report

## ISSUE A: Narrator receives all NPCs at a location, not just the active one
**FILES:** hooks/useGameLoop.ts, lib/game/prompt-builder.ts, app/api/game/narrate/route.ts
**LINES:**
- useGameLoop.ts line ~409: `locationAssets = useGameStore.getState().locationAssets` passed to narrateAction whole
- prompt-builder.ts buildNarratorUserPrompt: NPCS PRESENT block lists EVERY CHARACTER asset in currentNode.npc_ids; ACTIVE NPC CONTEXT only fires when stat_checked is set

**ROOT CAUSE:** The dialogue path treats locationAssets as a flat blob and sends it all to the narrator. There is no DIALOGUE-specific filter that narrows the data to the active NPC.

**INTENDED BEHAVIOR (CLAUDE.md):** "The narrator receives ONLY the active NPC's constitution." NPCs are placed in nodes; the narrator should write IN CHARACTER for one identified NPC, not pick from a roster.

**PROPOSED FIX:** In useGameLoop step 5, when parsedAction.action_type === DIALOGUE and there is a resolved active NPC, build a filtered locationAssets containing EXACTLY that one CHARACTER asset plus all non-CHARACTER assets. Tighten ACTIVE NPC CONTEXT to fire on DIALOGUE always. Drop multi-NPC NPCS PRESENT block on DIALOGUE.

**RISK:** New NPCs introduced via new_npcs arrive same turn — must not block them. Mitigated by filtering only when parsedAction.primary_target is known and resolves to an asset.

**SEVERITY:** Critical — root cause of Issue A and the underlying NPC mismatch.

---

## ISSUE B: Dialogue option tone is discarded; resolver re-classifies from speech
**FILES:** components/game/DialogueModal.tsx, hooks/useGameLoop.ts, app/api/game/parse-intent/route.ts, lib/game/logic-resolver.ts
**LINES:**
- DialogueModal.tsx handleOption: passes only npcName, never option.tone
- useGameLoop.ts step 2b: only overrides primary_target, never dialogue_tone
- parse-intent/route.ts: dialogueMode runs inferToneFromSpeech(trimmed) ignoring any caller-provided tone
- logic-resolver.ts resolveDialogue: tone from action.dialogue_tone ?? heuristic

**ROOT CAUSE:** No channel for the modal's option click to pass the option's tone. Pipeline re-derives tone from speech string. Badge computes from option.tone; resolver computes from heuristic. They desync whenever the heuristic disagrees.

**INTENDED BEHAVIOR (CLAUDE.md):** "When a dialogue option button is clicked, its tone is authoritative." "What the badge shows ALWAYS matches what fires."

**PROPOSED FIX:**
1. DialogueModalProps.onSubmit extends to accept `{ npcName?, tone? }`
2. handleOption passes `tone: option.tone`
3. submitAction extends options to `{ npcName?, tone? }` and sets `parsedAction.dialogue_tone = options.tone` when present
4. Map option tones to ParsedAction tones: `aggressive → intimidating`, others pass through
5. Consolidate tone mapping into a single helper

**RISK:** Free-typed quoted speech still uses heuristic — correct. Mapping aggressive ⇒ intimidating must match getToneBadge display.

**SEVERITY:** Critical — directly causes "badge shown but check never fires."

---

## ISSUE C: Pre-seeded NPCs (name_known: true) can be overwritten by narrator reveals
**FILES:** hooks/useGameLoop.ts, lib/game/codex.ts
**LINES:**
- useGameLoop.ts step 7d: applies revealed_npc_names unconditionally
- codex.ts updateAssetNameRevealed: writes name with no guard

**ROOT CAUSE:** No name_known === false precondition before applying a reveal.

**INTENDED BEHAVIOR (CLAUDE.md):** "Pre-seeded NPCs (name_known: true) never have their names changed." World assets are write-once / immutable.

**PROPOSED FIX:** In step 7d, skip when matchedAsset.name_known === true AND name differs from trueName AND name doesn't look like a placeholder. Add early-continue with console.warn.

**SEVERITY:** High — corrupts canonical world data.

---

## ISSUE D: Discovered NPCs are not added to current node's npc_ids
**FILES:** hooks/useGameLoop.ts
**LINES:**
- Step 8: merges new_npcs into npc_registry but does NOT mutate world_graph.nodes[currentNode].npc_ids
- Step 7b: saves world_asset but doesn't update graph node

**ROOT CAUSE:** graph node npc_ids is set only at world-seed time. No code path appends to it after dynamic encounter.

**INTENDED BEHAVIOR (CLAUDE.md):** "Every discovered NPC is added to the node's npc_ids." "Pre-seeded and dynamically created assets must follow the same rules."

**PROPOSED FIX:** After step 8, find the current node and append character_<slug> to its npc_ids if not already present. When an asset is saved with category === CHARACTER and first_seen_location === currentLocationId, push its id into world_graph.nodes[currentLocationId].npc_ids.

**SEVERITY:** Critical — causes Issue E's wrongful clears AND breaks ACTIVE NPC CONTEXT injection on revisit.

---

## ISSUE E: Stale dialogue context after location change (compound bug)
**FILES:** hooks/useGameLoop.ts
**ROOT CAUSE:**
(a) Free-typed "Hello" at same node: primary_target is undefined, step 2b npcName override only fires for options.npcName. Resolver gets no NPC context.
(b) Dynamic NPCs not in npc_ids (Issue D) causes step 2c check to wrongly clear modal.

**INTENDED BEHAVIOR:** "Dialogue context clears when player moves to a different node." Active NPC determined by game code, not narrator.

**PROPOSED FIX:**
- When DIALOGUE and primary_target empty AND node has exactly ONE npc_ids entry → pin to that NPC
- When multiple NPCs and currentDialogueNpc is set and is in npc_ids → pin to currentDialogueNpc
- After fixing Issue D, step 2c location guard becomes reliable for dynamic NPCs

**SEVERITY:** High — produces "wrong NPC responds" symptom.

---

## ISSUE F: Free-typed quoted dialogue at single-NPC node doesn't pin active NPC
**FILES:** hooks/useGameLoop.ts, app/api/game/parse-intent/route.ts
**ROOT CAUSE:** Fast-path returns primary_target: undefined. No game-state-driven default for primary_target.

**PROPOSED FIX:** Same as Issue E items (1)/(2) — folds into one fix.

**SEVERITY:** High — sub-cause of Issue A's "wrong NPC writes the response."

---

## ISSUE G: NPC location guard runs AFTER clear() in modal
**FILES:** components/game/DialogueModal.tsx, hooks/useGameLoop.ts
**LINES:**
- DialogueModal.tsx handleOption: calls clear() BEFORE onSubmit(). currentDialogueNpc is null when submitAction runs.
- useGameLoop.ts step 2c: reads gsBefore.currentDialogueNpc after clear() nulled it.

**ROOT CAUSE:** Modal clears its own state synchronously before action submitted. Guard has no data to act on for option clicks.

**PROPOSED FIX:** Remove clear() from handleOption. Let step 7g's clearDialogueOptions() own modal lifecycle. Move location guard to check resolved parsedAction.primary_target against currentNode.npc_ids directly — independent of store state.

**SEVERITY:** Medium — masked by other paths but a hidden-behaviour landmine.

---

## ISSUE H: Feed header NPC name from parsedAction.primary_target, not actual responding NPC
**FILES:** hooks/useGameLoop.ts
**ROOT CAUSE:** Header label comes from player's TARGET, not the asset that produced the line. After Issue A fixed (narrator only sees one NPC), the two will agree by definition.

**PROPOSED FIX:** Closes naturally with Issue A's fix. Stamp feed metadata npcName from the same activeNpcName computed in step 5.

**SEVERITY:** High — symptom of A.

---

## ISSUE I: revealed_npc_names matched-asset lookup falls back to synthetic asset_id
**FILES:** hooks/useGameLoop.ts
**LINES:** Step 7d: when no matched asset found, effectiveAssetId computed from activeNpcName or trueName. updateAssetNameRevealed called with synthetic id.

**ROOT CAUSE:** DB call silently no-ops if no row matches, but setLocationAssets patches in-memory with synthetic id that can't match existing locationAssets. Both operations are no-ops.

**PROPOSED FIX:** When matchedAsset is null, also search narratorResponse.new_npcs. If still not found, skip — don't synthesize asset_ids. Log and continue.

**SEVERITY:** Medium — ghost reveals that update nothing but pollute logs.

---

## ISSUE J: new_npcs added to npc_registry but never to world_assets directly
**FILES:** hooks/useGameLoop.ts
**LINES:**
- Step 8: registry merge only. No saveWorldAsset for new_npcs.
- Step 7b only writes assets for NPCs that ALSO appear in NOTABLE/MAJOR codex_entries.

**ROOT CAUSE:** new_npcs and codex_entries are independent lists. An NPC introduced via new_npcs only is invisible to world_assets and therefore to codex/locationAssets pipeline.

**INTENDED BEHAVIOR (CLAUDE.md):** "world_assets = narrator's bible (pre-seeded + dynamically created)." All NPCs narrator references must end up in world_assets.

**PROPOSED FIX:** In step 8, for each new_npc, also call saveWorldAsset with category=CHARACTER, name=npc.name, name_known=true, constitution from npc fields, first_seen_location: currentLocationId. Safe because saveWorldAsset uses ignoreDuplicates: true.

**SEVERITY:** High — chains with Issues A, D, E. Foundational fix.

---

## ISSUE K: inferToneFromText and inferToneFromSpeech are duplicated and can disagree
**FILES:** lib/game/logic-resolver.ts, app/api/game/parse-intent/route.ts

**ROOT CAUSE:** Two heuristic implementations with different word lists. Same speech classified differently in both places.

**PROPOSED FIX:** Move heuristic into single shared helper lib/game/dialogue-tone.ts. Import from both call sites.

**SEVERITY:** Low — contributes to Issue B's fragility.

---

## ISSUE L: WORLD_EXPLORE node name is a guess; stub generator rewrites world_asset name async
**FILES:** hooks/useGameLoop.ts
**ROOT CAUSE:** Graph node uses destination_hint (player's guess); world_asset uses AI stub.name. They diverge.

**PROPOSED FIX:** When stub returns, also patch world_graph.nodes[id].name = stub.name and persist.

**SEVERITY:** Medium — asset consistency violation.

---

## ISSUE M: Step 2c uses pre-resolution graph state — comment-vs-code drift
**FILES:** hooks/useGameLoop.ts
**SEVERITY:** Low — code quality, not behaviour.

---

## ISSUE N: Codex CHARACTER entry write order: new_npcs world_assets needed before step 7g
**FILES:** hooks/useGameLoop.ts
**ROOT CAUSE:** Step 7g codex write runs before step 8 new_npcs save. Codex write can't find the world_asset constitution. Falls through with "codex entry skipped."

**PROPOSED FIX:** Move new_npcs world_asset saves BEFORE step 7g. Or in step 7g codex skip-branch, fall back to constructing description from narratorResponse.new_npcs directly.

**SEVERITY:** Medium — chains with J.

---

## SUMMARY

**Total issues found:** 14

**Common root causes:**
1. Narrator gets unfiltered location data — Issues A, H, F, E (trunk issue)
2. Option metadata lost at modal→loop boundary — Issues B, G
3. Dynamic NPCs aren't first-class assets — Issues D, J, N
4. No name_known immutability guard — Issue C
5. Heuristic duplication — Issue K
6. Cosmetic name drift in WORLD_EXPLORE — Issue L

**Recommended fix order (dependency chain):**
1. J — new_npcs as world_assets (foundational data fix)
2. D — push asset_id into currentNode.npc_ids on encounter (builds on J)
3. C — name_known guard in step 7d (independent)
4. I — don't synthesize asset_ids in step 7d (independent)
5. A — filter locationAssets to active NPC for DIALOGUE (needs D)
6. B — carry option tone through modal→loop→resolver (independent)
7. E+F — pin primary_target from graph node npc_ids (builds on D)
8. K — consolidate heuristic (pure refactor)
9. L — rename node to stub.name when stub returns (independent)
10. M — cleanup after E/F
11. N — move codex write order (after J)

**Architectural changes needed:**
- Clear contract: resolver decides active NPC, narrator only writes the response
- Common dialogue-tone helper module (Issue K)
- Consider graph-mutator.ts for npc_ids rules in one tested place
