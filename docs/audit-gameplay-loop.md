# Gameplay Loop Audit — Known Issues & Scope

This document is provided as reference for the gameplay loop audit.
It lists confirmed issues from playtest logs plus areas to investigate.
The audit should cover all of these AND look for anything else.

---

## CONFIRMED ISSUES FROM PLAYTEST LOGS

### ISSUE A — Location ID normalization mismatch
WorldBible generates `the_lowered_gaze` as a node ID.
`normalizeLocationId()` in codex.ts strips the `the_` prefix producing `lowered_gaze`.
Assets stored under `the_lowered_gaze` are not found when queried with `lowered_gaze`.
Cascade effects:
- locationAssets loads empty on page load
- Move classifier cannot find the node in the graph → fires WORLD_EXPLORE instead of GRAPH_NAVIGATE
- WORLD_EXPLORE stub fires for the starting location
- `getWorldAssetsForLocation` queries return empty
Evidence: `[GamePage] current_location_id: the_lowered_gaze` then `querying for: ... lowered_gaze`

### ISSUE B — `intimidating` tone maps to CHA check instead of STR
Log: `tone: intimidating | raw action: DIALOGUE` → `stat_checked: charisma`
Expected: intimidating → strength check.
The resolver switch/if-else block in resolveDialogue() has a bug — intimidating
falls through to the default charisma case.

### ISSUE C — Narrator inventing NPCs not in WorldBible
WorldBible assigned `harmon_veil` and `tesslyn_crow` to the tavern node.
Narrator described a "solitary figure" and invented "Mira Twice-Named" — neither in WorldBible.
Result: codex entry skipped, modal shows placeholder name, NPC not in npc_ids.
Suspected cause: NPCS PRESENT block in prompt-builder not correctly reading from node.npc_ids.

### ISSUE D — WORLD_EXPLORE fires for known WorldBible locations
Log: `WORLD_EXPLORE node renamed: Lowered Gaze → The Lowered Gaze (category=tavern)`
The starting location fires WORLD_EXPLORE on first visit because the move classifier
cannot find the node (Issue A causes the ID mismatch).
Also: when player said "leave the tavern and go into town" — there is no separate
town node because the tavern was generated as `is_settlement_node: true`. The WorldBible
should generate a town square as the settlement node with the tavern as a sub-location.

### ISSUE E — Regional Bible route timeout
Log: `generate-regional-bible 500 in 116779ms` — three consecutive failures.
The route takes 110-120 seconds and times out. Next.js API route default timeout exceeded.
The prompt produces responses too large for the model to complete quickly.

### ISSUE F — Sparse highlights in story feed
Few Tier 1 objects are highlighted. The narrator does not use exact WorldBible object
names in prose (e.g. writes "cracked fountain" instead of "Cracked Memory Fountain").
The exact-match highlight system finds nothing when names don't match verbatim.

### ISSUE G — Dialogue modal shows placeholder NPC name
When player says "talk to the solitary figure", parsedAction.primary_target = "solitary figure".
Modal shows "solitary figure" instead of the WorldBible NPC at that node.
Step 2b-2 pins to node NPCs but only when primary_target is null — not when it's a
mismatched descriptor like "solitary figure".

### ISSUE H — NPC not added to codex after first dialogue
Log: `No world_asset found for NPC: solitary figure — codex entry skipped`
Codex write in step 7g requires a matching world_asset by name.
When primary_target doesn't match any world_asset name, codex is skipped.

### ISSUE I — Recent messages count not incrementing past 8
Log: `recent_messages captured: 8 Array(8)` — stays at 8 for many subsequent actions.
The capture may be incorrectly capped or the filter is too narrow.

### ISSUE J — [GameLoop/3b] No roll feedback fires on every neutral action
Every neutral/friendly dialogue beat logs "No roll feedback" which pollutes the console
and makes it hard to debug real missing checks. The log should only fire when a check
was expected but didn't fire — not on every no-check action.

---

## AREAS TO AUDIT EVEN IF NOT YET CONFIRMED BROKEN

### Area 1 — WorldBible settlement node structure
Is the settlement node always generated correctly as the town square/arrival point
rather than a specific building (tavern, inn)? If the tavern is `is_settlement_node: true`,
the player starts inside a building with no separate "town" to navigate to.
Audit: apply-world-bible, the WorldBible generation prompt, and how settlement nodes
are structured in the graph.

### Area 2 — Graph node npc_ids population
Are WorldBible NPCs correctly assigned to their home_location_id graph nodes after apply-world-bible?
Audit apply-world-bible step F (graph building) — verify each NPCDefinition.home_location_id
is in the node's npc_ids array.

### Area 3 — Dialogue option tone passthrough end-to-end
Trace the full path: DialogueModal button click → submitAction(options.tone) →
step 2b TONE_MAP → parsedAction.dialogue_tone → resolveDialogue switch → stat_checked.
Verify every step preserves the tone without re-classification.

### Area 4 — GRAPH_NAVIGATE for WorldBible locations
When the player moves to a sub-location within the starting settlement (e.g. "go to the inn"),
does the move classifier correctly fire GRAPH_NAVIGATE to the node in the graph,
or does it fire WORLD_EXPLORE and create a duplicate?
Audit move-classifier.ts TYPE_KEYWORDS and the graph node connection structure.

### Area 5 — locationAssets refresh after MOVE
After GRAPH_NAVIGATE to a sub-location, does getWorldAssetsForLocation correctly
load Tier 1 objects for the new location? Is the first_seen_location of sub-location
assets matching the node ID that gets queried?

### Area 6 — Narrator prompt structure for new WorldBible architecture
The narrator prompt was designed before the WorldBible existed. Now that we have:
- WCD block (injected first)
- NPCS PRESENT (from graph node.npc_ids)
- TIER 1 OBJECTS (from world_asset key_landmarks)
- ESTABLISHED WORLD ASSETS
Audit whether these blocks are correctly ordered, whether TIER 1 OBJECTS
actually instructs the narrator to use exact names verbatim, and whether
RESPONDING CHARACTER correctly replaces NPCS PRESENT for DIALOGUE actions.

### Area 7 — World graph persistence
After each action that modifies the world graph (new node added, npc_ids updated,
node renamed), is the updated graph saved to Supabase correctly?
Audit where world_graph is persisted — is it only on full auto-save (every 10 actions)
or also on immediate world-state saves?

### Area 8 — Codex write for WorldBible NPCs on first dialogue
When a player first talks to a WorldBible NPC (one with a real world_asset),
does the codex write correctly in step 7g? Or does the 3-pass asset lookup fail
because the node ID doesn't match due to Issue A?

### Area 9 — Intent parser classification accuracy
When the player types quoted speech ("What's in the case?"), is the Intent Parser
correctly classifying this as DIALOGUE and preserving the forcedTone from the
dialogue option that was clicked? Or is it re-classifying the tone from the speech text?

### Area 10 — Message feed architecture
Are NARRATIVE, DIALOGUE, SYSTEM message types being used correctly and consistently?
Are arrival headers showing for WorldBible location moves?
Are stat check receipts showing with the correct pass/fail styling?
Are NPC quote-blocks showing with the NPC name from the WorldBible?

---

## OUTPUT FORMAT

For each issue found (confirmed + additional):

ISSUE [ID]: [short title]
FILE(S): [which files]
LINE(S): [specific lines or function names]
ROOT CAUSE: [exact explanation]
INTENDED BEHAVIOR: [what should happen per CLAUDE.md]
PROPOSED FIX: [what to change]
RISK: [what else could break]
SEVERITY: Critical / High / Medium / Low

End with a SUMMARY:
- Total issues
- Common root causes
- Recommended fix order
- Any architectural concerns
