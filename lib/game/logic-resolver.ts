import { ActionType, ItemType, LocationStatus } from "@/types/game";
import type { ActiveBuff, Attributes, MasterState, ParsedAction, ResolutionResult } from "@/types/game";
import { rollD20, rollD6, getAttributeModifier } from "./dice";
import { equipItem, unequipItem, updateHealth, updateSanity, findNpcInRegistry } from "./state-utils";
import { normalizeLocationId } from "./codex";
import { classifyMove } from "./move-classifier";
// Issue K — single canonical tone heuristic shared with parse-intent.
import { inferToneFromSpeech, type DialogueTone } from "./dialogue-tone";

// ── Tunables ──────────────────────────────────────────────────────────────────

const ATTACK_DEFAULT_DIFFICULTY = 12;

// Shorthand delta fragment: player is present at their current location.
const PRESENT = { location_status: LocationStatus.PRESENT };

// ── Public entry point ────────────────────────────────────────────────────────

export interface ResolveOptions {
  /** Optional seed for deterministic dice — used by tests. */
  seed?: number;
}

export function resolveAction(
  action: ParsedAction,
  state: MasterState,
  opts: ResolveOptions = {}
): ResolutionResult {
  switch (action.action_type) {
    case ActionType.MOVE:     return resolveMove(action, state);
    case ActionType.ATTACK:   return resolveAttack(action, state, opts);
    case ActionType.EXAMINE:  return resolveExamine(action, state);
    case ActionType.INTERACT: return resolveInteract(action, state);
    case ActionType.USE_ITEM: return resolveUseItem(action, state);
    case ActionType.DIALOGUE: return resolveDialogue(action, state, opts);
    case ActionType.CUSTOM:
    default:                  return resolveCustom(action, state);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function pickFlagsRelatedTo(
  flags: Record<string, boolean | number | string>,
  needle: string
): Record<string, boolean | number | string> {
  if (!needle) return {};
  return Object.fromEntries(
    Object.entries(flags).filter(([k]) => k.toLowerCase().includes(needle.toLowerCase()))
  );
}

function normalizeKey(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, "_");
}

// ── MOVE ──────────────────────────────────────────────────────────────────────

function resolveMove(action: ParsedAction, state: MasterState): ResolutionResult {
  const rawTarget = action.primary_target?.trim() ?? "";
  const target    = rawTarget ? normalizeLocationId(rawTarget) : "";
  const current   = state.world_state.current_location_id;

  if (!target) {
    return {
      success: false,
      outcome_type: "MOVE_INVALID",
      state_delta: { world_state: PRESENT },
      narrative_context: {
        invalid_location: true,
        reason: "no_target",
        location_id: current,
        current_location_id: current,
      },
    };
  }

  // Only hard block: an explicit world flag marks this destination as locked.
  const lockFlag = `${normalizeKey(target)}_locked`;
  if (state.world_state.flags[lockFlag] === true) {
    return {
      success: false,
      outcome_type: "MOVE_BLOCKED",
      state_delta: { world_state: PRESENT },
      narrative_context: {
        movement_blocked: true,
        reason: "locked",
        lock_flag: lockFlag,
        location_id: target,
        current_location_id: current,
      },
    };
  }

  // ── Day 18 — World Graph branch ────────────────────────────────────────────
  // When the session has a world_graph, the destination kind is decided by
  // classifyMove(). Each kind produces a distinct outcome / state_delta so
  // the game loop knows whether to nav, expand, explore, or do nothing.
  const graph = state.world_graph;
  if (graph) {
    const currentNode = graph.nodes[graph.current_node_id];
    if (currentNode) {
      const classification = classifyMove(action, currentNode, graph);

      // INTERNAL_DESCRIBE — sub-area phrasing, NO actual move.
      if (classification.type === "INTERNAL_DESCRIBE") {
        return {
          success:      true,
          outcome_type: "DESCRIBE_SUCCESS",
          state_delta:  { world_state: PRESENT },
          narrative_context: {
            is_internal_description: true,
            sub_area_hint:           rawTarget,
            current_location_id:     current,
            current_node_id:         currentNode.id,
          },
        };
      }

      // GRAPH_NAVIGATE — known direct connection.
      if (classification.type === "GRAPH_NAVIGATE" && classification.target_node_id) {
        const targetNode = graph.nodes[classification.target_node_id];
        if (targetNode) {
          const visited    = state.world_state.visited_locations;
          const isVisit    = visited.includes(targetNode.id);
          const newVisited = isVisit ? visited : [...visited, targetNode.id];
          return {
            success:      true,
            outcome_type: "MOVE_SUCCESS",
            state_delta: {
              world_state: {
                current_location_id: targetNode.id,
                current_node_id:     targetNode.id,
                visited_locations:   newVisited,
                location_status:     LocationStatus.ARRIVING,
              },
            },
            narrative_context: {
              location_id:        targetNode.id,
              from_location:      current,
              from_node_id:       currentNode.id,
              first_visit:        !targetNode.discovered,
              movement_mandatory: true,
              is_known_location:  true,
              arriving_at:        targetNode.name,
              npcs_present:       targetNode.npc_ids,
              move_type:          "GRAPH_NAVIGATE",
            },
          };
        }
      }

      // ZONE_EXPAND — sub-location within current zone, new node will be
      // created in the game loop after the narrator describes it. We
      // commit the canonical sub-location id eagerly so the standard
      // ARRIVING flow (asset reload in step 7c, etc.) handles it.
      if (classification.type === "ZONE_EXPAND") {
        const hint        = classification.destination_hint ?? rawTarget;
        const expandSlug  = normalizeLocationId(hint) || `${currentNode.id}_subarea`;
        const visitedZ    = state.world_state.visited_locations;
        const newVisitedZ = visitedZ.includes(expandSlug) ? visitedZ : [...visitedZ, expandSlug];
        return {
          success:      true,
          outcome_type: "ZONE_EXPAND",
          state_delta: {
            world_state: {
              current_location_id: expandSlug,
              current_node_id:     expandSlug,
              visited_locations:   newVisitedZ,
              location_status:     LocationStatus.ARRIVING,
            },
          },
          narrative_context: {
            expand_hint:        hint,
            expand_slug:        expandSlug,
            parent_zone:        currentNode.zone_id,
            from_node_id:       currentNode.id,
            from_location:      current,
            movement_mandatory: true,
            move_type:          "ZONE_EXPAND",
          },
        };
      }

      // Audit Issue A fix (STEP D): before declaring WORLD_EXPLORE,
      // try a final exact-id lookup against the live graph. Now that
      // normalizeLocationId preserves articles, the player-typed
      // "the wilderness" slugifies to "the_wilderness" — which IS the
      // canonical id for any graph node WorldBible wrote. If that id
      // resolves to an existing node, treat this as GRAPH_NAVIGATE so
      // we never override a canonical id with a re-derived slug.
      const directHit = graph.nodes[target];
      if (directHit) {
        const visitedH    = state.world_state.visited_locations;
        const isVisitH    = visitedH.includes(directHit.id);
        const newVisitedH = isVisitH ? visitedH : [...visitedH, directHit.id];
        return {
          success:      true,
          outcome_type: "MOVE_SUCCESS",
          state_delta: {
            world_state: {
              current_location_id: directHit.id,
              current_node_id:     directHit.id,
              visited_locations:   newVisitedH,
              location_status:     LocationStatus.ARRIVING,
            },
          },
          narrative_context: {
            location_id:        directHit.id,
            from_location:      current,
            from_node_id:       currentNode.id,
            first_visit:        !directHit.discovered,
            movement_mandatory: true,
            is_known_location:  true,
            arriving_at:        directHit.name,
            npcs_present:       directHit.npc_ids,
            move_type:          "GRAPH_NAVIGATE",
          },
        };
      }

      // WORLD_EXPLORE — heading somewhere genuinely new.
      const visitedW    = state.world_state.visited_locations;
      const newVisitedW = visitedW.includes(target) ? visitedW : [...visitedW, target];
      return {
        success:      true,
        outcome_type: "MOVE_SUCCESS",
        state_delta: {
          world_state: {
            current_location_id: target,
            current_node_id:     target,
            visited_locations:   newVisitedW,
            location_status:     LocationStatus.ARRIVING,
          },
        },
        narrative_context: {
          location_id:        target,
          from_location:      current,
          from_node_id:       currentNode.id,
          first_visit:        true,
          movement_mandatory: true,
          is_known_location:  false,
          destination_hint:   classification.destination_hint ?? rawTarget,
          move_type:          "WORLD_EXPLORE",
        },
      };
    }
    // Fall through to legacy if current_node_id doesn't resolve — corrupted
    // graph state shouldn't block the player.
    console.warn("[resolveMove] world_graph present but current_node_id has no node — falling back to legacy");
  }

  // ── Legacy path — used when world_graph is undefined (old saves, fresh
  // sessions before world-seed application, or fallback). Mirrors the
  // pre-Day-18 behaviour exactly so existing tests keep passing.
  const visited    = state.world_state.visited_locations;
  const isVisit    = visited.includes(target);
  const newVisited = isVisit ? visited : [...visited, target];
  return {
    success: true,
    outcome_type: "MOVE_SUCCESS",
    state_delta: {
      world_state: {
        current_location_id: target,
        visited_locations:   newVisited,
        location_status:     LocationStatus.ARRIVING,
      },
    },
    narrative_context: {
      location_id:        target,
      from_location:      current,
      first_visit:        !isVisit,
      movement_mandatory: true,
    },
  };
}

// ── ATTACK ────────────────────────────────────────────────────────────────────

function resolveAttack(
  action: ParsedAction,
  state: MasterState,
  opts: ResolveOptions
): ResolutionResult {
  const strMod     = getAttributeModifier(state.player_state.attributes.strength);
  const roll       = rollD20(opts.seed);
  const total      = roll + strMod;
  const difficulty = ATTACK_DEFAULT_DIFFICULTY;

  const criticalHit  = roll === 20;
  const criticalMiss = roll === 1;
  const hit          = criticalHit || (!criticalMiss && total >= difficulty);

  let damage = 0;
  if (hit) {
    const dmgSeed = opts.seed !== undefined ? opts.seed + 1 : undefined;
    const base    = rollD6(dmgSeed) + strMod;
    damage        = Math.max(1, base);
    if (criticalHit) damage *= 2;
  }

  const outcome =
    criticalHit  ? "ATTACK_CRITICAL_HIT"  :
    criticalMiss ? "ATTACK_CRITICAL_MISS" :
    hit          ? "ATTACK_HIT"           :
                   "ATTACK_MISS";

  return {
    success: hit,
    outcome_type: outcome,
    state_delta: { world_state: PRESENT },
    narrative_context: {
      roll,
      modifier:       strMod,
      total,
      difficulty,
      critical_hit:   criticalHit,
      critical_miss:  criticalMiss,
      damage,
      target:         action.primary_target ?? null,
    },
  };
}

// ── EXAMINE ───────────────────────────────────────────────────────────────────

function resolveExamine(action: ParsedAction, state: MasterState): ResolutionResult {
  const perception_bonus = getAttributeModifier(state.player_state.attributes.perception);
  const current          = state.world_state.current_location_id;
  const target           = action.primary_target ?? null;

  const relevantFlags = target
    ? pickFlagsRelatedTo(state.world_state.flags, normalizeKey(target))
    : pickFlagsRelatedTo(state.world_state.flags, current);

  return {
    success: true,
    outcome_type: "EXAMINE_SUCCESS",
    state_delta: { world_state: PRESENT },
    narrative_context: {
      perception_bonus,
      current_location_id: current,
      target,
      relevant_flags:      relevantFlags,
      // Resolver-confirmed object existence — prevents narrator from denying it.
      ...(target ? {
        object_confirmed:       true,
        object_name:            action.primary_target,
        object_exists_message:  "This object exists. The player is interacting with it right now. Do not deny its existence.",
      } : {}),
    },
  };
}

// ── INTERACT ──────────────────────────────────────────────────────────────────

// Words in the player's stated target / intent that suggest the player is
// approaching a merchant for trade. Detected here so the narrator gets a
// trade_available flag and emits items_for_sale.
const TRADE_KEYWORDS = [
  "merchant", "trader", "shopkeeper", "vendor", "shop", "wares",
  "buy", "sell", "barter", "purchase", "browse",
];

function isTradeInteraction(action: ParsedAction): boolean {
  const haystack = `${action.primary_target ?? ""} ${action.inferred_intent}`.toLowerCase();
  return TRADE_KEYWORDS.some((k) => haystack.includes(k));
}

function resolveInteract(action: ParsedAction, state: MasterState): ResolutionResult {
  const targetRaw = action.primary_target ?? "";
  const target    = normalizeKey(targetRaw);
  const tradeAvailable = isTradeInteraction(action);

  if (!target) {
    return {
      success: true,
      outcome_type: "INTERACT_GENERIC",
      state_delta: { world_state: PRESENT },
      narrative_context: {
        target: null,
        relevant_flags: {},
        ...(tradeAvailable ? { trade_available: true } : {}),
      },
    };
  }

  const blockFlag    = `block_${target}`;
  const completeFlag = `interact_${target}_completed`;
  const blocked      = state.world_state.flags[blockFlag] === true;

  const relevant = pickFlagsRelatedTo(state.world_state.flags, target);

  if (blocked) {
    return {
      success: false,
      outcome_type: "INTERACT_BLOCKED",
      state_delta: { world_state: PRESENT },
      narrative_context: {
        target,
        blocked_by:     blockFlag,
        relevant_flags: relevant,
      },
    };
  }

  const newFlags = { ...state.world_state.flags, [completeFlag]: true };

  return {
    success: true,
    outcome_type: "INTERACT_SUCCESS",
    state_delta: {
      world_state: {
        flags:           newFlags,
        location_status: LocationStatus.PRESENT,
      },
    },
    narrative_context: {
      target,
      flag_set:       completeFlag,
      relevant_flags: pickFlagsRelatedTo(newFlags, target),
      // Resolver-confirmed object existence — prevents narrator from denying it.
      object_confirmed:       true,
      object_name:            action.primary_target ?? target,
      object_exists_message:  "This object exists. The player is interacting with it right now. Do not deny its existence.",
      // Day 16 — flag the narrator that this is a merchant interaction so it
      // emits items_for_sale.
      ...(tradeAvailable ? { trade_available: true } : {}),
    },
  };
}

// ── USE_ITEM ──────────────────────────────────────────────────────────────────

function resolveUseItem(action: ParsedAction, state: MasterState): ResolutionResult {
  const lookup = (action.item_used ?? action.primary_target ?? "").trim().toLowerCase();

  if (!lookup) {
    return {
      success: false,
      outcome_type: "USE_ITEM_NO_TARGET",
      state_delta: { world_state: PRESENT },
      narrative_context: { item_not_found: true, attempted: null },
    };
  }

  const item = state.player_state.inventory.find(
    (i) => i.id === lookup || i.name.toLowerCase() === lookup
  );

  if (!item) {
    return {
      success: false,
      outcome_type: "USE_ITEM_NOT_FOUND",
      state_delta: { world_state: PRESENT },
      narrative_context: { item_not_found: true, attempted: lookup },
    };
  }

  // ── CONSUMABLE ───────────────────────────────────────────────────────────────
  if (item.type === ItemType.CONSUMABLE) {
    const newQty    = item.quantity - 1;
    const inventory = newQty > 0
      ? state.player_state.inventory.map((i) =>
          i.id === item.id ? { ...i, quantity: newQty } : i
        )
      : state.player_state.inventory.filter((i) => i.id !== item.id);

    let updated: MasterState = { ...state, player_state: { ...state.player_state, inventory } };
    const effectsApplied: string[] = [];

    if (item.effect) {
      if (typeof item.effect.heal === "number") {
        updated = updateHealth(updated, item.effect.heal);
        effectsApplied.push(`heal ${item.effect.heal}`);
      }
      if (typeof item.effect.sanity === "number") {
        const sanityResult = updateSanity(updated, item.effect.sanity);
        if (sanityResult) {
          updated = sanityResult;
          effectsApplied.push(`sanity ${item.effect.sanity}`);
        }
      }
      for (const [key] of Object.entries(item.effect)) {
        const m = key.match(/^buff_([a-z_]+)_(\d+)$/);
        if (!m) continue;
        const stat   = m[1] as keyof Attributes;
        const amount = parseInt(m[2], 10);
        if (!isNaN(amount) && stat in updated.player_state.attributes) {
          const buff: ActiveBuff = {
            id:         crypto.randomUUID(),
            stat,
            amount,
            source:     item.name,
            expires_at: null,
          };
          const buffs = [...(updated.player_state.buffs ?? []), buff];
          updated = {
            ...updated,
            player_state: {
              ...updated.player_state,
              buffs,
              attributes: {
                ...updated.player_state.attributes,
                [stat]: updated.player_state.attributes[stat] + amount,
              },
            },
          };
          effectsApplied.push(`buff ${stat} +${amount}`);
        }
      }
    }

    return {
      success: true,
      outcome_type: "USE_ITEM_CONSUMED",
      state_delta: { player_state: updated.player_state, world_state: PRESENT },
      narrative_context: {
        item_id:            item.id,
        item_name:          item.name,
        item_type:          item.type,
        effect:             item.effect ?? null,
        effects_applied:    effectsApplied,
        remaining_quantity: newQty,
      },
    };
  }

  // ── WEAPON / ARMOR — toggle equip/unequip ────────────────────────────────────
  if (item.type === ItemType.WEAPON || item.type === ItemType.ARMOR) {
    const nextState = item.equipped
      ? unequipItem(state, item.id)
      : equipItem(state,   item.id);
    return {
      success:      true,
      outcome_type: item.equipped ? "USE_ITEM_UNEQUIPPED" : "USE_ITEM_EQUIPPED",
      state_delta:  { player_state: nextState.player_state, world_state: PRESENT },
      narrative_context: {
        item_id:    item.id,
        item_name:  item.name,
        item_type:  item.type,
        equipped:   !item.equipped,
        stat_bonus: item.stat_bonus ?? null,
      },
    };
  }

  // ── CONTAINER — searchable; Narrator decides what's inside ───────────────────
  if (item.type === ItemType.CONTAINER) {
    if (item.searched) {
      return {
        success:      false,
        outcome_type: "USE_ITEM_CONTAINER_EMPTY",
        state_delta:  { world_state: PRESENT },
        narrative_context: {
          already_searched: true,
          container_id:     item.id,
          container_name:   item.name,
        },
      };
    }
    const inventory = state.player_state.inventory.map((i) =>
      i.id === item.id ? { ...i, searched: true } : i
    );
    return {
      success:      true,
      outcome_type: "USE_ITEM_CONTAINER_SEARCHED",
      state_delta:  { player_state: { ...state.player_state, inventory }, world_state: PRESENT },
      narrative_context: {
        container_search: true,
        container_id:     item.id,
        container_name:   item.name,
      },
    };
  }

  // ── KEY ──────────────────────────────────────────────────────────────────────
  if (item.type === ItemType.KEY) {
    const requiredKeyFlag = `requires_${normalizeKey(item.name)}`;
    const expectedAtHere  = state.world_state.flags[requiredKeyFlag];
    const matches         = expectedAtHere === state.world_state.current_location_id;

    if (matches) {
      const inventory = state.player_state.inventory.filter((i) => i.id !== item.id);
      return {
        success:      true,
        outcome_type: "USE_ITEM_UNLOCKED",
        state_delta: {
          player_state: { ...state.player_state, inventory },
          world_state: {
            flags: {
              ...state.world_state.flags,
              [`unlocked_${state.world_state.current_location_id}`]: true,
            },
            location_status: LocationStatus.PRESENT,
          },
        },
        narrative_context: {
          item_id:   item.id,
          item_name: item.name,
          item_type: item.type,
          location:  state.world_state.current_location_id,
          unlocked:  true,
        },
      };
    }

    return {
      success:      false,
      outcome_type: "USE_ITEM_KEY_MISMATCH",
      state_delta:  { world_state: PRESENT },
      narrative_context: {
        item_id:   item.id,
        item_name: item.name,
        item_type: item.type,
        location:  state.world_state.current_location_id,
        unlocked:  false,
      },
    };
  }

  // ── LORE / other — read only ──────────────────────────────────────────────────
  return {
    success:      true,
    outcome_type: "USE_ITEM_GENERIC",
    state_delta:  { world_state: PRESENT },
    narrative_context: {
      item_id:   item.id,
      item_name: item.name,
      item_type: item.type,
      effect:    item.effect ?? null,
    },
  };
}

// ── DIALOGUE ──────────────────────────────────────────────────────────────────
// Tone fallback uses inferToneFromSpeech (Issue K) — imported at top.

/**
 * Maps NPC trust score → base difficulty for dialogue-driven stat checks.
 * Hostile NPCs are harder to sway; allied NPCs concede easily.
 */
function difficultyForTrust(trustScore: number): number {
  if (trustScore <= 30)  return 15; // hostile / suspicious
  if (trustScore <= 60)  return 12; // neutral (default)
  if (trustScore <= 80)  return 9;  // friendly
  return 6;                          // allied
}

function resolveDialogue(action: ParsedAction, state: MasterState, opts: ResolveOptions = {}): ResolutionResult {
  const charisma         = state.player_state.attributes.charisma;
  const strength         = state.player_state.attributes.strength;
  const perception       = state.player_state.attributes.perception;
  const charismaModifier = getAttributeModifier(charisma);

  // Robust registry lookup — handles snake_case, asset-id, and name-scan keys.
  const found  = findNpcInRegistry(state.npc_registry, action.primary_target);
  const npcKey = found?.key ?? (action.primary_target ? normalizeKey(action.primary_target) : null);
  const npc    = found?.npc ?? null;
  console.log("[resolveDialogue] NPC lookup:", {
    primary_target: action.primary_target ?? null,
    found:          !!found,
    resolved_key:   npcKey,
  });
  // FIX 1: When the NPC isn't in the registry yet (first dialogue, or
  // introduced via codex_entries only), proceed with neutral defaults rather
  // than skipping the stat check. trustScore falls back to 50 below, which
  // produces baseDifficulty=12. The stat check fires from `tone` regardless.
  if (!found && action.primary_target) {
    console.log("[resolveDialogue] NPC not in registry, using default difficulty=12");
  }

  // Use the parser-supplied tone first; fall back to text heuristics so quoted
  // dialogue (which sometimes skips the tone slot) still routes correctly.
  const tone: DialogueTone =
    action.dialogue_tone ?? inferToneFromSpeech(action.inferred_intent);

  // Visibility log — confirms the resolver received a tone for this beat
  // and shows what the parser produced before any fallback heuristic ran.
  console.log(
    "[resolveDialogue] tone:", action.dialogue_tone,
    "| raw action:", action.action_type,
    "| inferred:", action.inferred_intent
  );

  // Trust score drives base difficulty. Default to 50 (neutral) when no NPC is
  // in the registry yet (first-encounter situations).
  const trustScore     = npc?.trust_score ?? 50;
  const baseDifficulty = difficultyForTrust(trustScore);

  // Decide which stat (if any) to check based on tone. friendly/neutral skip
  // checks entirely. curious uses Perception only when the resolver knows
  // something is hidden — in the current architecture we don't have that
  // signal pre-narrator, so curious is treated as no-check.
  let statChecked: "charisma" | "strength" | "perception" | null = null;
  let modifier: number = 0;
  let difficulty: number = baseDifficulty;

  switch (tone) {
    case "persuasive":
      statChecked = "charisma";
      modifier    = charismaModifier;
      break;
    case "deceptive":
      statChecked = "charisma";
      modifier    = charismaModifier;
      difficulty  = baseDifficulty + 2; // deception is harder than honest persuasion
      break;
    case "intimidating":
      // Audit Issue B fix: intimidating ALWAYS rolls STR. Removed the
      // STR>=10 guard that silently substituted CHA for low-STR
      // characters and contradicted the badge UI / system prompt spec.
      statChecked = "strength";
      modifier    = getAttributeModifier(strength);
      break;
    case "curious":
      // Curious tone always fires a Perception check — investigative speech
      // can succeed or fail to draw out information regardless of whether
      // the resolver has an explicit "hidden info" signal.
      statChecked = "perception";
      modifier    = getAttributeModifier(perception);
      break;
    case "friendly":
    case "neutral":
    default:
      // No stat check — just talk.
      break;
  }

  // Always return success=true at the resolver layer; the narrator interprets
  // the in-fiction outcome from the check result in narrative_context.
  const checkContext: Record<string, unknown> = {
    stat_checked:    statChecked,
    check_difficulty: difficulty,
    npc_trust_score: trustScore,
  };

  if (statChecked !== null) {
    // Every required field for buildRollFeedback() and the narrator's
    // STAT CHECK block lives in narrative_context here:
    //   stat_checked   - lowercase: 'charisma' | 'strength' | 'perception'
    //   roll           - d20 result via rollD20(opts.seed)
    //   modifier       - getAttributeModifier(<stat>)
    //   total          - roll + modifier
    //   difficulty     - trust-scaled (and +2 for deception)
    //   success        - total >= difficulty
    //   charisma_check - true only when stat_checked === 'charisma' (legacy alias)
    const roll    = rollD20(opts.seed);
    const total   = roll + modifier;
    const success = total >= difficulty;
    Object.assign(checkContext, {
      charisma_check:    statChecked === "charisma",
      stat_check_active: true,
      roll,
      modifier,
      total,
      difficulty,
      success,
      tone,
    });
    // Verification log — JSON.stringify so the full payload is one-line
    // searchable in the browser console even when nested objects truncate.
    console.log(
      "[resolveDialogue] stat check fields:",
      JSON.stringify({
        stat_checked: statChecked,
        roll,
        modifier,
        total,
        difficulty,
        success,
      })
    );
    // BUG FIX 4b: hard-validate every required field. If any is missing
    // here, buildRollFeedback will silently drop the check downstream —
    // surface the bug instead of swallowing it.
    if (
      typeof statChecked !== "string" ||
      typeof roll        !== "number" ||
      typeof modifier    !== "number" ||
      typeof total       !== "number" ||
      typeof difficulty  !== "number" ||
      typeof success     !== "boolean"
    ) {
      console.error(
        "[resolveDialogue] MISSING stat check field:",
        tone,
        { stat_checked: statChecked, roll, modifier, total, difficulty, success }
      );
    }
  }

  return {
    success: true,
    outcome_type: "DIALOGUE_SUCCESS",
    state_delta: { world_state: PRESENT },
    narrative_context: {
      charisma,
      charisma_modifier: charismaModifier,
      npc_key:           npcKey,
      npc,
      trust_score:       npc?.trust_score ?? null,
      ...checkContext,
    },
  };
}

// ── CUSTOM ────────────────────────────────────────────────────────────────────

function resolveCustom(action: ParsedAction, state: MasterState): ResolutionResult {
  return {
    success: true,
    outcome_type: "CUSTOM",
    state_delta: { world_state: PRESENT },
    narrative_context: {
      inferred_intent:     action.inferred_intent,
      confidence:          action.confidence,
      current_location_id: state.world_state.current_location_id,
    },
  };
}
