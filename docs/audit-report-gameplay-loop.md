# Gameplay Loop Audit Report

Full audit of hooks/useGameLoop.ts, logic-resolver.ts, prompt-builder.ts, move-classifier.ts, codex.ts, narrator.ts, state-utils.ts, highlights.ts, ambient-objects.ts, dialogue-tone.ts, regional-bible-cache.ts, DialogueModal.tsx, StoryFeed.tsx, apply-world-bible, apply-regional-bible, generate-regional-bible, narrate, parse-intent, page.tsx, game-store, types/game.ts.

Total issues found: 21

---

## CONFIRMED ISSUES (A–J)

### ISSUE A — Location ID normalization mismatch
SEVERITY: Critical
FILE(S): lib/game/codex.ts, lib/game/logic-resolver.ts, app/api/game/apply-world-bible/route.ts, app/game/page.tsx, lib/game/highlights.ts, lib/game/prompt-builder.ts
LINE(S):
- codex.ts:117–119 (stripArticles), 145–147 (normalizeLocationId), 160–164 (normalizeAssetId strips articles for LOCATION)
- logic-resolver.ts:60–61 (normalizeLocationId(rawTarget)), 186–198 (WORLD_EXPLORE writes normalized target into current_location_id)
- apply-world-bible/route.ts:40, 56, 217, 273 — writes raw loc.id (preserves the_)
- app/game/page.tsx:195 — normalizeLocationId(state.world_state.current_location_id) strips the_
- lib/game/highlights.ts:50, prompt-builder.ts:796, 973 — look up current location asset by `location_${current_location_id}`

ROOT CAUSE: Two ID schemes coexist:
- WorldBible/apply-world-bible writes raw IDs: the_lowered_gaze, location_the_lowered_gaze
- Everything that touches user input or runs normalizeLocationId/normalizeAssetId(LOCATION) strips leading the_/a_/an_, producing prefix-less form
- Resolver's WORLD_EXPLORE branch writes normalized form back into current_location_id, replacing the bible's canonical ID with a sibling that no asset/node is keyed under

INTENDED BEHAVIOR: One canonical ID — chosen at WorldBible time — flows through everywhere unchanged.

PROPOSED FIX: Stop stripping articles. Replace stripArticles with a no-op (or remove the call from normalizeLocationId / normalizeAssetId). For backward compat with old saves, add a fallback at lookup time that also tries the article-stripped form, but never normalize what's WRITTEN. In resolveMove, write the WorldBible's canonical id (graph node id) — never write a player-typed slug back into state.

RISK: Old saves that already have the stripped form in current_location_id need a runtime fallback. Highlight/asset lookups using `location_${id}` may need to try both forms during transition.

CAUSES DOWNSTREAM: Issues D (stripped IDs), F (asset lookup fails), H (asset lookup fails), O (Tier 2 ambient), S (discovered state). ~29% of all 21 issues trace to Issue A.

---

### ISSUE B — intimidating tone falls through to CHA
SEVERITY: High
FILE(S): lib/game/logic-resolver.ts
LINE(S): 672–681

ROOT CAUSE:
```
case "intimidating":
  if (strength >= 10) {
    statChecked = "strength";
    ...
  } else {
    statChecked = "charisma";   // ← bug
    ...
  }
```
A strength >= 10 guard re-routes low-STR characters to CHA. Default characters have STR ≤ 8, so this branch always falls through to charisma. DialogueModal.tsx:39–40 always shows STR badge. Prompt-builder.ts:425, 527 specs aggressive → STR.

INTENDED BEHAVIOR: Badge always matches check. aggressive (UI) → intimidating (resolver) → STR check, no conditional.

PROPOSED FIX: Drop the guard. case "intimidating" should unconditionally statChecked = "strength".

RISK: Low. Low-STR characters now fail intimidation explicitly instead of silently succeeding via CHA substitution.

---

### ISSUE C — Narrator invents NPCs not in WorldBible
SEVERITY: High
FILE(S): lib/game/prompt-builder.ts, app/api/game/apply-world-bible/route.ts, lib/game/narrator.ts, hooks/useGameLoop.ts
LINE(S):
- apply-world-bible/route.ts:225 — copies loc.npc_ids without validating IDs exist in npcs[]
- prompt-builder.ts:709 — NPCS PRESENT block skipped entirely on DIALOGUE actions
- prompt-builder.ts:917–953 — ACTIVE NPC CONTEXT only fires if targetName matches CHARACTER asset by name
- useGameLoop.ts:372–414 — pin-from-graph step 2b-2 only runs when !parsedAction.primary_target

ROOT CAUSE: Three failures compound:
1. WorldBible AI may emit loc.npc_ids that don't match actual npcs[].id — NPCS PRESENT renders empty even when NPCs exist
2. On DIALOGUE with placeholder target, NPCS PRESENT is skipped AND ACTIVE NPC CONTEXT can't resolve — narrator gets neither block and free-invents
3. Pin-to-graph guard only fires when target is null, not when it's a wrong descriptor

INTENDED BEHAVIOR: Engine resolves target to WorldBible NPC. RESPONDING CHARACTER block fires.

PROPOSED FIX:
1. Extend step 2b-2 to ALSO fire when primary_target is set but doesn't match any locationAssets CHARACTER name AND current node has NPCs — pin to sole NPC or active-dialogue NPC
2. In apply-world-bible, validate loc.npc_ids against bible.starting_region.npcs[].id; drop dangling references
3. When ACTIVE NPC CONTEXT does NOT fire, append hardcoded "DO NOT introduce a named NPC" instruction

RISK: Step 2b-2 now overrides narrator-classified target; could mask genuine multi-NPC ambiguity. Mitigated by only overriding when existing target doesn't match any present asset.

---

### ISSUE D — WORLD_EXPLORE fires for known WorldBible locations
SEVERITY: High (derivative of A + Area 1)
FILE(S): lib/game/move-classifier.ts, lib/game/logic-resolver.ts, app/api/game/apply-world-bible/route.ts

ROOT CAUSE: Two contributing causes:
1. Primary (derives from A): normalizeLocationId writes stripped slug into current_location_id; classifyMove works against raw graph IDs; subsequent moves appear to be in wrong (stripped) node
2. Architectural: WorldBible prompt skeleton has tavern as is_settlement_node: true. No separate town square node exists, so "leave the tavern and go into town" has nowhere to GRAPH_NAVIGATE → fires WORLD_EXPLORE → spawns duplicate

INTENDED BEHAVIOR: Settlement node = arrival hub (square/crossroads). Tavern/inn = sub-location.

PROPOSED FIX:
1. Fix Issue A (eliminates spurious WORLD_EXPLORE due to stripped IDs)
2. Rewrite generate-world-bible skeleton: first location has type: "settlement", is_settlement_node: true. Tavern is separate is_interior: true sub-location
3. Add hard rule: "Settlement node MUST be a town_square/crossroads/market/hub — NEVER a tavern, smithy, or named building"
4. In apply-world-bible, validate settlement node type ∈ {settlement, settlement_hub} and reject if not

RISK: Stricter validation may reject otherwise-valid bibles; pair with normalization.

---

### ISSUE E — Regional Bible route timeout
SEVERITY: High
FILE(S): app/api/game/generate-regional-bible/route.ts
LINE(S): 148–156, 188–222

ROOT CAUSE:
- No `export const maxDuration` for Vercel — defaults to 10s (free) or 60s (Pro), well under observed 116s
- max_tokens: 3000 plus non-streamed call means model runs to ~3000 tokens before any byte returns; retry doubles worst case to 6000 tokens
- Same model (sonnet) used as narration but regional bible is far less time-sensitive

INTENDED BEHAVIOR: Completes reliably in <60s (ideally <30s for live path).

PROPOSED FIX:
- Add `export const maxDuration = 300;` and `export const dynamic = "force-dynamic"`
- Lower max_tokens to ~2000 and tighten prompt skeleton
- Lean harder on pregenerateRegionalBible background path
- Cap retry to once with time budget — don't double-bill if first attempt already hit wall

RISK: Lower max_tokens may produce thinner regions; mitigate via stricter skeleton.

---

### ISSUE F — Sparse highlights (narrator uses synonyms)
SEVERITY: Medium
FILE(S): lib/game/prompt-builder.ts, lib/game/highlights.ts
LINE(S): prompt-builder.ts:801–814, 265–270; highlights.ts:120–135

ROOT CAUSE: TIER 1 OBJECTS block has prohibitive wording ("these are the only objects you should name") but no imperative ("USE THESE EXACT NAMES VERBATIM"). Narrator writes "the cracked fountain" instead of "Cracked Memory Fountain". Whole-word matcher finds nothing.

PROPOSED FIX: Strengthen TIER 1 OBJECTS block: "When referring to any of these objects, write the exact name as listed — do not abbreviate, paraphrase, or stylize. The player's UI highlights only exact matches." List NPC names with same imperative.

---

### ISSUE G — Dialogue modal shows placeholder NPC name
SEVERITY: High (derivative of C)
FILE(S): hooks/useGameLoop.ts, components/game/DialogueModal.tsx
LINE(S): useGameLoop.ts:372–414 (step 2b-2), 1366–1400 (step 7g), DialogueModal.tsx:206–208

ROOT CAUSE: When AI parser returns primary_target: "solitary figure" (a descriptor), step 2b-2 doesn't override (target is set). Descriptor flows through to setDialogueOptions which modal renders.

PROPOSED FIX: Same fix as Issue C step 1 — extend step 2b-2 to override when target doesn't match any present CHARACTER asset. Once primary_target is real name, step 7g picks it up automatically.

---

### ISSUE H — NPC not added to codex after first dialogue
SEVERITY: Medium (derivative of C/G)
FILE(S): hooks/useGameLoop.ts
LINE(S): 1467–1515

ROOT CAUSE: Codex write triggers ONLY when findNpcInRegistry returns null AND matching CHARACTER asset found by name. When effectiveNpcName is placeholder (Issue G), asset lookup fails — no asset named "solitary figure" — codex skipped.

PROPOSED FIX: Fixing Issue G automatically fixes this. Defense-in-depth: when effectiveNpcName doesn't match any asset, also try to resolve against currentNode.npc_ids (each maps to a CHARACTER asset by id).

---

### ISSUE I — recent_messages capped at 8 (by design, low)
SEVERITY: Low
FILE(S): hooks/useGameLoop.ts
LINE(S): 1640–1648

ROOT CAUSE: .slice(-8) is a designed sliding window for session restoration. Not a bug — but misleading log. Can bump to 12–16 if restoration UX feels truncated.

PROPOSED FIX (optional): Rephrase log: `[GameLoop/9b] recent_messages window (cap=8): ${recent.length}`

---

### ISSUE J — No roll feedback log fires on every neutral action
SEVERITY: Low
FILE(S): hooks/useGameLoop.ts
LINE(S): 455–464

ROOT CAUSE: else branch logs unconditionally, including for actions with no check (MOVE, friendly DIALOGUE, EXAMINE).

PROPOSED FIX:
```typescript
} else if (typeof resolution.narrative_context?.stat_checked === "string") {
  console.warn("[GameLoop/3b] stat_checked set but no roll/total — silent drop:", { ... });
}
```

---

## AREAS 1–10

### Area 1 — WorldBible settlement node structure (BROKEN)
SEVERITY: High
FILE(S): app/api/game/generate-world-bible/route.ts (lines 47–58), app/api/game/apply-world-bible/route.ts (line 206)

ROOT CAUSE: Skeleton example makes a tavern the settlement node (is_settlement_node: true). AI follows the example. Architecture intends settlement node = hub, tavern = sub-location.

FIX: Rewrite skeleton. Add validation in apply-world-bible.

---

### Area 2 — Graph node npc_ids population (PARTIALLY BROKEN)
SEVERITY: High
FILE(S): app/api/game/apply-world-bible/route.ts:225, app/api/game/apply-regional-bible/route.ts:200

ROOT CAUSE: Copies AI-emitted npc_ids without verifying each id matches an npcs[].id. AI ID drift produces dangling references → NPCS PRESENT renders empty even when NPCs exist.

FIX: Build Set<npcId> from bible.npcs.map((n) => n.id); filter each loc.npc_ids against it. If node ends up with zero valid ids but NPCs have home_location_id matching this location, re-stitch.

---

### Area 3 — Dialogue option tone passthrough (BROKEN at resolver only)
SEVERITY: High (already Issue B)

Tracing confirmed: DialogueModal → submitAction(options.tone) ✅ → TONE_MAP ✅ → resolveDialogue switch ❌ (Issue B STR guard) → buildRollFeedback ✅. Only the resolver step diverges.

---

### Area 4 — GRAPH_NAVIGATE for WorldBible sub-locations (FRAGILE)
SEVERITY: Medium
FILE(S): lib/game/move-classifier.ts:200–221

ROOT CAUSE: When player input is phrase like "the inn" and multiple connected sub-locations share type "tavern", typeMatchIds gets >1 entries and falls through to WORLD_EXPLORE. Also: if apply-world-bible left settlement node without sub-location connections, sub-locations are unreachable.

FIX: When name match fails AND multiple type matches collide, pick closest by Levenshtein on names. Resolves further when Area 1 fixed (no building-as-hub).

---

### Area 5 — locationAssets refresh after MOVE (works for ARRIVING, fragile otherwise)
SEVERITY: Medium
FILE(S): hooks/useGameLoop.ts:1266–1321

ROOT CAUSE: Step 7c refreshes when location_status === ARRIVING. But after getWorldAssetsForLocation returns assets that fail per-location filter (Issue A mismatch), setLocationAssets is called with potentially zero matching LOCATION assets. Fallback to getAllWorldAssets only fires on completely empty result — partial-zero (CHARACTER assets always pass-through) wouldn't trigger it.

FIX: Stronger fallback: if assets.find(LOCATION matching current_location_id) returns null even though assets.length > 0, pull getAllWorldAssets and merge.

---

### Area 6 — Narrator prompt structure (mostly correct, one gap)
SEVERITY: Medium (already Issue F)

Block ordering is correct. WCD in system prompt first. RESPONDING CHARACTER replaces NPCS PRESENT on DIALOGUE. One bug: TIER 1 OBJECTS block uses prohibitive wording but no verbatim imperative (Issue F). Points of interest block still in schema but no longer drives highlights (Issue N).

---

### Area 7 — World graph persistence (BROKEN for regional expansion)
SEVERITY: High
FILE(S): app/api/game/apply-regional-bible/route.ts, hooks/useGameLoop.ts:1656–1664

ROOT CAUSE: apply-regional-bible does NOT write master_state or world_graph to database — only world_assets. Client patches local state but next persistence is 10-action auto-save. Reload before auto-save loses entire region's graph nodes (assets remain but graph disconnected).

FIX: apply-regional-bible should also update game_sessions.master_state and world_graph — mirror apply-world-bible lines 285–293.

---

### Area 8 — Codex write for WorldBible NPCs on first dialogue (BROKEN)
SEVERITY: Medium (already Issues G/H)

Same root cause and fix as H.

---

### Area 9 — Intent parser classification accuracy (mostly fine)
SEVERITY: Low

Option-click tone override path is correct. Free-typed quoted speech uses heuristic which may misclassify — this is by design but easy to trigger unintentionally.

---

### Area 10 — Message feed architecture (mostly fine)
SEVERITY: Low (downstream of G)

NARRATIVE/DIALOGUE/SYSTEM render distinctly. Arrival headers work when MOVE_SUCCESS. Stat check receipts read Passed/Failed strings — fragile but consistent. NPC quote-blocks use metadata.npcName = parsedAction.primary_target — affected by Issue G placeholder.

---

## ADDITIONAL ISSUES FOUND (K–U)

### ISSUE K — apply-regional-bible doesn't persist master_state
SEVERITY: High
FILE: app/api/game/apply-regional-bible/route.ts:246–265
FIX: Add game_sessions.update({ master_state, world_graph }) pattern — mirror apply-world-bible.

### ISSUE L — apply-world-bible doesn't validate loc.npc_ids references
SEVERITY: High
FILE: app/api/game/apply-world-bible/route.ts:225 (same for apply-regional-bible:200)
FIX: Build Set<npcId> from bible.npcs.map((n) => n.id); intersect with each loc.npc_ids. Re-stitch via home_location_id when no valid ids.

### ISSUE M — addNpcToCurrentNode graph mutation is local-only
SEVERITY: Medium
FILE: hooks/useGameLoop.ts:1192–1194, state-utils.ts:104–124
ROOT CAUSE: Mutation reaches DB only via 10-action auto-save. saveWorldStateAsync only persists world_state, not world_graph. Reload before auto-save loses new NPC's npc_ids connection.
FIX: Add world-graph persistence route or extend world-state route to also persist world_graph.

### ISSUE N — points_of_interest still in schema but no longer drives highlights
SEVERITY: Low
FILE: lib/game/prompt-builder.ts:463, 503–508
FIX: Remove from schema and parser, OR repurpose as UI hint. Wastes 50–150 tokens per response.

### ISSUE O — Tier 2 ambient lookup uses location ID subject to Issue A mismatch
SEVERITY: Medium
FILE: hooks/useGameLoop.ts:506–516
ROOT CAUSE: Tier 2 lookup fails when Issue A strips ID. Silently falls through to Tier 3 narrator call — paying AI for every "examine fireplace".
FIX: Resolves with Issue A.

### ISSUE P — locationAssets filter on DIALOGUE passes full roster on placeholder miss
SEVERITY: Medium
FILE: hooks/useGameLoop.ts:712–736
ROOT CAUSE: When activeNpcForFilter (placeholder name) returns no asset match, early-return at line 730 sends unfiltered full roster to narrator on a DIALOGUE action. Combined with C's missing NPCS PRESENT, narrator sees full roster in ESTABLISHED WORLD ASSETS but no directive — free-invents.
FIX: When filter fails to find active NPC asset on DIALOGUE action, fall back to filtering against currentNode.npc_ids assets rather than passing whole roster.

### ISSUE Q — currentDialogueNpcKey re-derived slug may drift from WorldBible NPCDefinition.id
SEVERITY: Low
FILE: hooks/useGameLoop.ts:1418–1420
FIX: Prefer the asset's actual .id whenever available. Re-derivation as fallback only.

### ISSUE R — Unused invalidateRegionalBibleCache import in useGameLoop
SEVERITY: Low (cosmetic/lint)
FILE: hooks/useGameLoop.ts:13–19

### ISSUE S — apply-world-bible marks sub-locations discovered: false but settlement node is a building
SEVERITY: Medium (downstream of Area 1)
FILE: app/api/game/apply-world-bible/route.ts:228
FIX: Resolves when Area 1 fixed (settlement node becomes a hub, tavern becomes discoverable sub-location).

### ISSUE T — Background pre-generation hint matching too loose for cardinal directions
SEVERITY: Low
FILE: hooks/useGameLoop.ts:842–846
ROOT CAUSE: `narrText.includes("north")` matches ambient prose. Every ambient narrative direction mention fires a background fetch.
FIX: Require explicit phrasing ("to the north", "northward") or join with region name check (AND not OR).

### ISSUE U — getWorldAssetsForLocation passes ALL CHARACTER assets through regardless of location
SEVERITY: Low
FILE: lib/game/codex.ts:317–322
ROOT CAUSE: `r.category === "CHARACTER" return true` ships every NPC in the session into every narrator prompt. Grows without bound as player explores.
FIX: Filter CHARACTER by currentNode.npc_ids membership instead of pass-through.

---

## SUMMARY

Total issues: 21 (A–J confirmed + K–U additional)

Issues caused by Issue A (ID normalization): ~6 of 21 (29%) — Issues D, F, H, O, S, P partial. Single highest-leverage fix.

Common root cause clusters:
1. ID normalization split (Issue A) — 6 downstream issues
2. WorldBible settlement node = building (Area 1) — Issues D structural, S
3. step 2b-2 only fires when primary_target is null — Issues C, G, H
4. Resolver intimidating STR guard — Issue B, Area 3
5. No master_state/world_graph persistence after mutations — Issues K, M
6. AI prompt skeleton leaks into AI output — Area 1, Issue D

Recommended fix order:
1. Issue B — 1-line change, zero risk
2. Issue J — console noise, zero risk
3. Issue A — the_ normalization, cascades fix D/F/H/O/S/P
4. Area 1 — settlement node structure in WorldBible prompt + apply validation
5. Issues C/G/H together — extend step 2b-2, fix Issue P simultaneously
6. Issue F — exact names imperative in narrator prompt
7. Issue E — regional bible timeout (maxDuration + smaller prompt)
8. Issues K + M (Area 7) — persistence for regional expansion
9. Issue L + Area 2 — npc_ids validation in apply routes
10. Issues N, T, U, Q, R, I, S — cleanup batch

Architectural patterns producing recurring bugs:
- Lossy normalization in shared utilities (ID stripping propagates everywhere)
- Silent fire-and-forget DB writes for graph mutations (no critical-path persistence)
- Guards keyed on falsy fields rather than asset membership (step 2b-2, step 7g)
- AI prompt skeletons leak into AI output verbatim
- Local updatedState mutations to world_graph don't reach DB until auto-save
