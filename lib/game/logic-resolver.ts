import { ActionType, ItemType } from "@/types/game";
import type { MasterState, ParsedAction, ResolutionResult } from "@/types/game";
import { rollD20, rollD6, getAttributeModifier } from "./dice";

// ── Tunables ──────────────────────────────────────────────────────────────────

const ATTACK_DEFAULT_DIFFICULTY = 12;

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
    case ActionType.DIALOGUE: return resolveDialogue(action, state);
    case ActionType.CUSTOM:
    default:                  return resolveCustom(action, state);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function genrePrefix(locationId: string): string {
  // Convention: <genre>_<place>_<index>  e.g. "fantasy_tavern_01".
  return locationId.split("_")[0] ?? "";
}

function isAdjacent(from: string, to: string): boolean {
  const a = genrePrefix(from);
  const b = genrePrefix(to);
  return a.length > 0 && a === b;
}

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
  const target  = action.primary_target?.trim() ?? "";
  const current = state.world_state.current_location_id;

  if (!target) {
    return {
      success: false,
      outcome_type: "MOVE_INVALID",
      state_delta: {},
      narrative_context: {
        invalid_location: true,
        reason: "no_target",
        location_id: current,
        current_location_id: current,
      },
    };
  }

  const visited  = state.world_state.visited_locations;
  const isVisit  = visited.includes(target);
  const isAdj    = isAdjacent(current, target);

  if (!isVisit && !isAdj) {
    return {
      success: false,
      outcome_type: "MOVE_INVALID",
      state_delta: {},
      narrative_context: {
        invalid_location: true,
        location_id: target,
        current_location_id: current,
      },
    };
  }

  const newVisited = isVisit ? visited : [...visited, target];

  return {
    success: true,
    outcome_type: "MOVE_SUCCESS",
    state_delta: {
      world_state: {
        ...state.world_state,
        current_location_id: target,
        visited_locations:   newVisited,
      },
    },
    narrative_context: {
      location_id:        target,
      from_location:      current,
      first_visit:        !isVisit,
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
    state_delta: {},
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
    state_delta: {},
    narrative_context: {
      perception_bonus,
      current_location_id: current,
      target,
      relevant_flags:      relevantFlags,
    },
  };
}

// ── INTERACT ──────────────────────────────────────────────────────────────────

function resolveInteract(action: ParsedAction, state: MasterState): ResolutionResult {
  const targetRaw = action.primary_target ?? "";
  const target    = normalizeKey(targetRaw);

  if (!target) {
    return {
      success: true,
      outcome_type: "INTERACT_GENERIC",
      state_delta: {},
      narrative_context: { target: null, relevant_flags: {} },
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
      state_delta: {},
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
        ...state.world_state,
        flags: newFlags,
      },
    },
    narrative_context: {
      target,
      flag_set:       completeFlag,
      relevant_flags: pickFlagsRelatedTo(newFlags, target),
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
      state_delta: {},
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
      state_delta: {},
      narrative_context: { item_not_found: true, attempted: lookup },
    };
  }

  if (item.type === ItemType.CONSUMABLE) {
    const newQty    = item.quantity - 1;
    const inventory = newQty > 0
      ? state.player_state.inventory.map((i) =>
          i.id === item.id ? { ...i, quantity: newQty } : i
        )
      : state.player_state.inventory.filter((i) => i.id !== item.id);

    return {
      success: true,
      outcome_type: "USE_ITEM_CONSUMED",
      state_delta: {
        player_state: { ...state.player_state, inventory },
      },
      narrative_context: {
        item_id:            item.id,
        item_name:          item.name,
        item_type:          item.type,
        effect:             item.effect ?? null,
        remaining_quantity: newQty,
      },
    };
  }

  if (item.type === ItemType.KEY) {
    const requiredKeyFlag = `requires_${normalizeKey(item.name)}`;
    const expectedAtHere  = state.world_state.flags[requiredKeyFlag];
    const matches         = expectedAtHere === state.world_state.current_location_id;

    return {
      success: matches,
      outcome_type: matches ? "USE_ITEM_UNLOCKED" : "USE_ITEM_KEY_MISMATCH",
      state_delta: matches
        ? {
            world_state: {
              ...state.world_state,
              flags: {
                ...state.world_state.flags,
                [`unlocked_${state.world_state.current_location_id}`]: true,
              },
            },
          }
        : {},
      narrative_context: {
        item_id:    item.id,
        item_name:  item.name,
        item_type:  item.type,
        location:   state.world_state.current_location_id,
        unlocked:   matches,
      },
    };
  }

  // Other types (weapon, armor, lore) — no state change, just context.
  return {
    success: true,
    outcome_type: "USE_ITEM_GENERIC",
    state_delta: {},
    narrative_context: {
      item_id:   item.id,
      item_name: item.name,
      item_type: item.type,
      effect:    item.effect ?? null,
    },
  };
}

// ── DIALOGUE ──────────────────────────────────────────────────────────────────

function resolveDialogue(action: ParsedAction, state: MasterState): ResolutionResult {
  const charisma         = state.player_state.attributes.charisma;
  const charismaModifier = getAttributeModifier(charisma);
  const npcKey           = action.primary_target ? normalizeKey(action.primary_target) : null;
  const npc              = npcKey ? state.npc_registry[npcKey] ?? null : null;

  return {
    success: true,
    outcome_type: "DIALOGUE_SUCCESS",
    state_delta: {},
    narrative_context: {
      charisma,
      charisma_modifier: charismaModifier,
      npc_key:           npcKey,
      npc,
      trust_score:       npc?.trust_score ?? null,
    },
  };
}

// ── CUSTOM ────────────────────────────────────────────────────────────────────

function resolveCustom(action: ParsedAction, state: MasterState): ResolutionResult {
  return {
    success: true,
    outcome_type: "CUSTOM",
    state_delta: {},
    narrative_context: {
      inferred_intent:     action.inferred_intent,
      confidence:          action.confidence,
      current_location_id: state.world_state.current_location_id,
    },
  };
}
