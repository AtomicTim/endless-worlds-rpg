// Mock the dice module so tests can control rolls.
// jest.mock must run before the SUT is imported.
jest.mock("../dice", () => {
  const actual = jest.requireActual<typeof import("../dice")>("../dice");
  return {
    ...actual,
    rollD20: jest.fn(actual.rollD20),
    rollD6:  jest.fn(actual.rollD6),
  };
});

import { resolveAction } from "../logic-resolver";
import { createNewMasterState } from "../state-factory";
import {
  ActionType,
  Difficulty,
  Genre,
  ItemRarity,
  ItemType,
} from "@/types/game";
import type { Item, MasterState, NPCMemory, ParsedAction } from "@/types/game";
import { rollD20, rollD6 } from "../dice";

const mockedD20 = rollD20 as jest.MockedFunction<typeof rollD20>;
const mockedD6  = rollD6  as jest.MockedFunction<typeof rollD6>;

// ── Fixtures ──────────────────────────────────────────────────────────────────

function baseState(): MasterState {
  return createNewMasterState(Genre.FANTASY, "Aria", "knight", Difficulty.NORMAL);
}

function withCurrentLocation(state: MasterState, locationId: string): MasterState {
  return {
    ...state,
    world_state: {
      ...state.world_state,
      current_location_id: locationId,
      visited_locations:   Array.from(new Set([...state.world_state.visited_locations, locationId])),
    },
  };
}

function withStrength(state: MasterState, strength: number): MasterState {
  return {
    ...state,
    player_state: {
      ...state.player_state,
      attributes: { ...state.player_state.attributes, strength },
    },
  };
}

function makeItem(overrides: Partial<Item> & { name: string; type: ItemType }): Item {
  return {
    id:          overrides.id ?? `item_${overrides.name}`,
    name:        overrides.name,
    type:        overrides.type,
    rarity:      overrides.rarity ?? ItemRarity.COMMON,
    description: overrides.description ?? "",
    effect:      overrides.effect,
    quantity:    overrides.quantity ?? 1,
    stackable:   overrides.stackable ?? (overrides.type === ItemType.CONSUMABLE),
    equipped:    overrides.equipped,
    stat_bonus:  overrides.stat_bonus,
  };
}

function actionOf(partial: Partial<ParsedAction> & { action_type: ActionType }): ParsedAction {
  return {
    inferred_intent: partial.inferred_intent ?? "test action",
    confidence:      partial.confidence      ?? 1,
    ...partial,
  };
}

// ── Resets ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockedD20.mockReset();
  mockedD6.mockReset();
  // Sensible defaults so unrelated calls don't blow up.
  mockedD20.mockReturnValue(10);
  mockedD6.mockReturnValue(3);
});

// ── MOVE ──────────────────────────────────────────────────────────────────────

describe("MOVE", () => {
  it("succeeds and updates current_location_id when target is in visited_locations", () => {
    let state = baseState();
    state = {
      ...state,
      world_state: {
        ...state.world_state,
        current_location_id: "fantasy_start_01",
        visited_locations:   ["fantasy_start_01", "fantasy_tavern_01"],
      },
    };

    const result = resolveAction(
      actionOf({ action_type: ActionType.MOVE, primary_target: "fantasy_tavern_01" }),
      state
    );

    expect(result.success).toBe(true);
    expect(result.outcome_type).toBe("MOVE_SUCCESS");
    expect(result.state_delta.world_state?.current_location_id).toBe("fantasy_tavern_01");
    expect(result.narrative_context.location_id).toBe("fantasy_tavern_01");
  });

  it("succeeds for an unvisited but adjacent (same-genre-prefix) location", () => {
    const state = baseState();
    const result = resolveAction(
      actionOf({ action_type: ActionType.MOVE, primary_target: "fantasy_forest_01" }),
      state
    );

    expect(result.success).toBe(true);
    expect(result.state_delta.world_state?.current_location_id).toBe("fantasy_forest_01");
    expect(result.state_delta.world_state?.visited_locations).toContain("fantasy_forest_01");
    expect(result.narrative_context.first_visit).toBe(true);
  });

  it("fails for a different-genre location and flags invalid_location", () => {
    const state  = baseState(); // current = fantasy_start_01
    const result = resolveAction(
      actionOf({ action_type: ActionType.MOVE, primary_target: "cyberpunk_alley_01" }),
      state
    );

    expect(result.success).toBe(false);
    expect(result.outcome_type).toBe("MOVE_INVALID");
    expect(result.narrative_context.invalid_location).toBe(true);
    expect(result.state_delta).toEqual({});
  });
});

// ── ATTACK ────────────────────────────────────────────────────────────────────

describe("ATTACK", () => {
  it("hits and deals damage with high Strength on a mid-roll", () => {
    mockedD20.mockReturnValueOnce(15); // roll
    mockedD6.mockReturnValueOnce(4);   // damage die

    const state  = withStrength(baseState(), 18); // STR 18 → +4 mod
    const result = resolveAction(
      actionOf({ action_type: ActionType.ATTACK, primary_target: "goblin" }),
      state
    );

    expect(result.success).toBe(true);
    expect(result.outcome_type).toBe("ATTACK_HIT");
    expect(result.narrative_context.roll).toBe(15);
    expect(result.narrative_context.modifier).toBe(4);
    expect(result.narrative_context.total).toBe(19);
    expect(result.narrative_context.damage).toBe(8); // 4 + 4
    expect(result.narrative_context.target).toBe("goblin");
  });

  it("flags critical_hit on a natural 20 and doubles damage", () => {
    mockedD20.mockReturnValueOnce(20);
    mockedD6.mockReturnValueOnce(5);

    const state  = withStrength(baseState(), 14); // +2 mod
    const result = resolveAction(
      actionOf({ action_type: ActionType.ATTACK, primary_target: "wolf" }),
      state
    );

    expect(result.success).toBe(true);
    expect(result.outcome_type).toBe("ATTACK_CRITICAL_HIT");
    expect(result.narrative_context.critical_hit).toBe(true);
    expect(result.narrative_context.critical_miss).toBe(false);
    expect(result.narrative_context.damage).toBe((5 + 2) * 2);
  });

  it("flags critical_miss on a natural 1 with no damage", () => {
    mockedD20.mockReturnValueOnce(1);

    const state  = withStrength(baseState(), 18);
    const result = resolveAction(
      actionOf({ action_type: ActionType.ATTACK, primary_target: "ogre" }),
      state
    );

    expect(result.success).toBe(false);
    expect(result.outcome_type).toBe("ATTACK_CRITICAL_MISS");
    expect(result.narrative_context.critical_miss).toBe(true);
    expect(result.narrative_context.damage).toBe(0);
  });
});

// ── EXAMINE ───────────────────────────────────────────────────────────────────

describe("EXAMINE", () => {
  it("always succeeds with no state changes and reports perception bonus", () => {
    const state  = baseState();
    state.player_state.attributes.perception = 16; // +3
    const result = resolveAction(
      actionOf({ action_type: ActionType.EXAMINE, primary_target: "altar" }),
      state
    );

    expect(result.success).toBe(true);
    expect(result.state_delta).toEqual({});
    expect(result.narrative_context.perception_bonus).toBe(3);
    expect(result.narrative_context.current_location_id).toBe(state.world_state.current_location_id);
  });
});

// ── INTERACT ──────────────────────────────────────────────────────────────────

describe("INTERACT", () => {
  it("fails when a block flag is set for the target", () => {
    let state = baseState();
    state = {
      ...state,
      world_state: { ...state.world_state, flags: { ...state.world_state.flags, block_door: true } },
    };

    const result = resolveAction(
      actionOf({ action_type: ActionType.INTERACT, primary_target: "door" }),
      state
    );

    expect(result.success).toBe(false);
    expect(result.outcome_type).toBe("INTERACT_BLOCKED");
    expect(result.narrative_context.blocked_by).toBe("block_door");
  });

  it("succeeds and sets a completion flag", () => {
    const state  = baseState();
    const result = resolveAction(
      actionOf({ action_type: ActionType.INTERACT, primary_target: "lever" }),
      state
    );

    expect(result.success).toBe(true);
    expect(result.outcome_type).toBe("INTERACT_SUCCESS");
    expect(result.state_delta.world_state?.flags?.interact_lever_completed).toBe(true);
  });
});

// ── USE_ITEM ──────────────────────────────────────────────────────────────────

describe("USE_ITEM", () => {
  it("reduces quantity for a consumable in inventory", () => {
    let state = baseState();
    const potion = makeItem({
      id: "potion_01",
      name: "Healing Potion",
      type: ItemType.CONSUMABLE,
      quantity: 3,
      effect: { health: 20 },
    });
    state = {
      ...state,
      player_state: { ...state.player_state, inventory: [potion] },
    };

    const result = resolveAction(
      actionOf({ action_type: ActionType.USE_ITEM, item_used: "Healing Potion" }),
      state
    );

    expect(result.success).toBe(true);
    expect(result.outcome_type).toBe("USE_ITEM_CONSUMED");
    expect(result.state_delta.player_state?.inventory[0].quantity).toBe(2);
    expect(result.narrative_context.remaining_quantity).toBe(2);
  });

  it("removes the item entirely when quantity drops to 0", () => {
    let state = baseState();
    state = {
      ...state,
      player_state: {
        ...state.player_state,
        inventory: [
          makeItem({ id: "p", name: "Potion", type: ItemType.CONSUMABLE, quantity: 1 }),
        ],
      },
    };

    const result = resolveAction(
      actionOf({ action_type: ActionType.USE_ITEM, item_used: "Potion" }),
      state
    );

    expect(result.state_delta.player_state?.inventory).toHaveLength(0);
  });

  it("fails when item is not in inventory", () => {
    const state  = baseState(); // empty inventory
    const result = resolveAction(
      actionOf({ action_type: ActionType.USE_ITEM, item_used: "ghost_axe" }),
      state
    );

    expect(result.success).toBe(false);
    expect(result.outcome_type).toBe("USE_ITEM_NOT_FOUND");
    expect(result.narrative_context.item_not_found).toBe(true);
  });
});

// ── DIALOGUE ──────────────────────────────────────────────────────────────────

describe("DIALOGUE", () => {
  it("succeeds and exposes Charisma + modifier", () => {
    let state = baseState();
    state = withStrength(state, 10);
    state.player_state.attributes.charisma = 14;

    const result = resolveAction(
      actionOf({ action_type: ActionType.DIALOGUE, primary_target: "old_hermit" }),
      state
    );

    expect(result.success).toBe(true);
    expect(result.narrative_context.charisma).toBe(14);
    expect(result.narrative_context.charisma_modifier).toBe(2);
    expect(result.narrative_context.npc_key).toBe("old_hermit");
    expect(result.narrative_context.trust_score).toBeNull(); // NPC not in registry
  });

  it("returns trust_score and NPC data when the NPC exists in the registry", () => {
    const npc: NPCMemory = {
      id:                  "npc_old_hermit",
      npc_key:             "old_hermit",
      name:                "Old Hermit",
      role:                "guide",
      relationship_status: "neutral",
      trust_score:         55,
      memory_snippets:     ["Met outside the forest."],
    };

    let state = baseState();
    state = { ...state, npc_registry: { ...state.npc_registry, old_hermit: npc } };

    const result = resolveAction(
      actionOf({ action_type: ActionType.DIALOGUE, primary_target: "Old Hermit" }),
      state
    );

    expect(result.success).toBe(true);
    expect(result.narrative_context.trust_score).toBe(55);
    expect(result.narrative_context.npc).toMatchObject({ name: "Old Hermit", trust_score: 55 });
  });
});

// ── CUSTOM ────────────────────────────────────────────────────────────────────

describe("CUSTOM", () => {
  it("always succeeds and passes through inferred_intent", () => {
    const state  = baseState();
    const result = resolveAction(
      actionOf({
        action_type:     ActionType.CUSTOM,
        inferred_intent: "Player wants to meditate.",
        confidence:      0.4,
      }),
      state
    );

    expect(result.success).toBe(true);
    expect(result.narrative_context.inferred_intent).toBe("Player wants to meditate.");
    expect(result.narrative_context.confidence).toBe(0.4);
  });
});
