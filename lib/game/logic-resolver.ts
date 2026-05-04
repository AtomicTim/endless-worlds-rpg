import { ActionType, ItemType, LocationStatus } from "@/types/game";
import type { ActiveBuff, Attributes, MasterState, ParsedAction, ResolutionResult } from "@/types/game";
import { rollD20, rollD6, getAttributeModifier } from "./dice";
import { equipItem, unequipItem, updateHealth, updateSanity } from "./state-utils";

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
    case ActionType.DIALOGUE: return resolveDialogue(action, state);
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
  const target  = action.primary_target?.trim() ?? "";
  const current = state.world_state.current_location_id;

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

function resolveInteract(action: ParsedAction, state: MasterState): ResolutionResult {
  const targetRaw = action.primary_target ?? "";
  const target    = normalizeKey(targetRaw);

  if (!target) {
    return {
      success: true,
      outcome_type: "INTERACT_GENERIC",
      state_delta: { world_state: PRESENT },
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

function resolveDialogue(action: ParsedAction, state: MasterState): ResolutionResult {
  const charisma         = state.player_state.attributes.charisma;
  const charismaModifier = getAttributeModifier(charisma);
  const npcKey           = action.primary_target ? normalizeKey(action.primary_target) : null;
  const npc              = npcKey ? state.npc_registry[npcKey] ?? null : null;

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
