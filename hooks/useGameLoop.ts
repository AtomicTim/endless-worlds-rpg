"use client";

import { startTransition, useCallback } from "react";
import { useGameStore, makeMessage, type StoryMessage } from "@/lib/stores/game-store";
import { parseIntent, IntentParserError } from "@/lib/game/intent-parser";
import { resolveAction } from "@/lib/game/logic-resolver";
import { narrateAction } from "@/lib/game/narrator";
import { applyStateDelta, addLogEntry, addToInventory, removeFromInventory, updateNPCTrust, findNpcInRegistry, seedNpcRegistry, addNpcToCurrentNode } from "@/lib/game/state-utils";
import { isNarrativeAction, isEquipIntent, isDropIntent, isReadIntent } from "@/lib/game/action-classifier";
import { saveCodexEntry, saveWorldAsset, getWorldAssetsForLocation, normalizeAssetId, normalizeLocationId } from "@/lib/game/codex";
import { generateLocationStub } from "@/lib/game/location-stub-generator";
import { findAmbientResponse } from "@/lib/game/ambient-objects";
import {
  matchRegionOutline,
  getCachedRegionalBible,
  cacheRegionalBible,
  pregenerateRegionalBible,
  invalidateRegionalBibleCache,
} from "@/lib/game/regional-bible-cache";
import { ActionType, AssetCategory, Genre, ItemRarity, ItemType, LocationStatus, LogEntryType } from "@/types/game";
import type { Item, MasterState, ParsedAction, RegionBible, RegionOutline, ResolutionResult, StoredMessage, WorldAsset, WorldGraph, WorldNode } from "@/types/game";

const MAX_INPUT_LENGTH  = 500;
const AUTO_SAVE_INTERVAL = 10;

// Genre → resources key under which the primary currency is stored. Mirrors
// the table in CharacterSheet — kept here so the trade hook never imports UI.
// Horror/Lovecraftian has no primary currency by design (sanity is its scarcity).
const GENRE_CURRENCY_KEY: Partial<Record<Genre, string>> = {
  [Genre.FANTASY]:          "gold",
  [Genre.CYBERPUNK]:        "credits",
  [Genre.SPACE_OPERA]:      "stellar_units",
  [Genre.POST_APOCALYPTIC]: "caps",
};

// Module-level counter — persists across renders, resets when the module reloads.
let autoSaveActionCount = 0;

// Bug 7 — track the last node id we emitted an arrival section header
// for. The duplicate "◆ ◆ GRAYVEIL CROSSING" symptom comes from two
// arrival narrations firing for the same node back-to-back (most often
// from a re-navigation click on the current location). We guard the
// header-emit step against this here so even if the upstream no-op
// guards miss, the player only ever sees one header per arrival.
let lastArrivalNodeId: string | null = null;

/**
 * FIX 4 — contextual loading-state text.
 *
 * The InputBar's "processingStep" indicator used to flash a generic
 * "Generating response..." regardless of what was actually happening.
 * This helper turns the parsed action into a sentence the player can
 * read at a glance — "Speaking with Korven...", "Examining the
 * fountain...", "Entering Salt-Iron Crossing..." — so the wait feels
 * directed instead of opaque.
 *
 * The MOVE intercept and WORLD_EXPLORE branch set their own bespoke
 * strings ("Looking around...", "Entering [region]...") before this is
 * reached; this is the fallback for the post-parse / narrator-call
 * stages where the action_type is the only signal we have.
 */
function getLoadingText(action: ParsedAction): string {
  const target = action.primary_target?.trim();
  switch (action.action_type) {
    case ActionType.DIALOGUE:
      return target ? `Speaking with ${target}...` : "Speaking...";
    case ActionType.EXAMINE:
      return target ? `Examining ${target}...` : "Examining...";
    case ActionType.MOVE:
      return target ? `Entering ${target}...` : "Looking around...";
    case ActionType.INTERACT:
      return target ? `Interacting with ${target}...` : "Interacting...";
    case ActionType.ATTACK:
      return target ? `Attacking ${target}...` : "Attacking...";
    case ActionType.USE_ITEM: {
      const item = action.item_used?.trim() ?? target;
      return item ? `Using ${item}...` : "Using item...";
    }
    default:
      return "Thinking...";
  }
}

/**
 * FIX 5 — descriptor → role mapping. The Intent Parser sometimes hands us
 * "the boy" / "the kid" / "the merchant" / "stranger" instead of a name
 * because that's what the player typed. matchDescriptorToNpc tries to
 * resolve those descriptors to a real NPC at the current node by
 * comparing against the asset's role and archetype.
 *
 * Returns the matching asset when EXACTLY ONE NPC at the node fits;
 * returns null when zero or multiple match (ambiguous → leave unresolved
 * so the narrator can deflect rather than picking the wrong character).
 */
const DESCRIPTOR_ROLES: Record<string, string[]> = {
  boy:      ["acolyte", "apprentice", "youth", "novice", "page", "child", "lad"],
  girl:     ["acolyte", "apprentice", "youth", "vendor", "merchant", "lass", "child"],
  kid:      ["acolyte", "apprentice", "youth", "page", "child"],
  child:    ["acolyte", "apprentice", "youth", "page"],
  man:      ["innkeeper", "guard", "merchant", "blacksmith", "smith", "trader",
             "patron", "soldier", "captain", "warden"],
  woman:    ["innkeeper", "merchant", "healer", "trader", "patron",
             "soldier", "captain", "warden", "priestess"],
  // Pure descriptors with no role hint — match any NPC, but only when there
  // is exactly one at the node.
  stranger: [],
  figure:   [],
  person:   [],
};

function matchDescriptorToNpc(
  rawTarget: string,
  presentNpcAssets: WorldAsset[]
): WorldAsset | null {
  const target = rawTarget.trim().toLowerCase().replace(/^the\s+/, "");
  if (!target) return null;
  if (presentNpcAssets.length === 0) return null;

  // Direct role / archetype substring match — covers cases like
  // "merchant" → role "merchant", "innkeeper" → role "innkeeper".
  // archetype isn't on WorldAssetConstitution today (apply-world-bible
  // doesn't carry it through), but we still read it via a loose record
  // cast so any future schema addition or stub-generated NPC carrying
  // archetype data lights up automatically.
  const directHits = presentNpcAssets.filter((a) => {
    const c = a.constitution as Record<string, unknown>;
    const role      = String(c.role      ?? "").toLowerCase();
    const archetype = String(c.archetype ?? "").toLowerCase();
    if (!role && !archetype) return false;
    return role.includes(target)
        || archetype.includes(target)
        || (role && target.includes(role))
        || (archetype && target.includes(archetype));
  });
  if (directHits.length === 1) return directHits[0];

  // Descriptor → role-bucket mapping (boy → acolyte, woman → innkeeper, etc.).
  const acceptedRoles = DESCRIPTOR_ROLES[target];
  if (acceptedRoles !== undefined) {
    if (acceptedRoles.length === 0) {
      // Generic descriptor — only resolve when there is exactly one NPC.
      if (presentNpcAssets.length === 1) return presentNpcAssets[0];
      return null;
    }
    const roleHits = presentNpcAssets.filter((a) => {
      const role = String(a.constitution.role ?? "").toLowerCase();
      if (!role) return false;
      return acceptedRoles.some((r) => role.includes(r));
    });
    if (roleHits.length === 1) return roleHits[0];
  }
  return null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildRollFeedback(resolution: ResolutionResult): string | null {
  const ctx  = resolution.narrative_context;
  const roll = typeof ctx.roll === "number" ? ctx.roll : null;
  if (roll === null) return null;

  const modifier   = typeof ctx.modifier   === "number" ? ctx.modifier   : 0;
  const total      = typeof ctx.total      === "number" ? ctx.total      : roll + modifier;
  const difficulty = typeof ctx.difficulty === "number" ? ctx.difficulty : null;

  const sign    = modifier >= 0 ? `+${modifier}` : `${modifier}`;
  const diffStr = difficulty !== null ? ` vs difficulty ${difficulty}` : "";

  if (resolution.outcome_type.startsWith("ATTACK")) {
    const label =
      ctx.critical_hit  ? "Critical Hit!"  :
      ctx.critical_miss ? "Critical Miss!" :
      resolution.success ? "Hit!"          :
                           "Miss!";
    return `⚔ Attack roll: ${roll} ${sign} (STR) = ${total}${diffStr} — ${label}`;
  }

  // Generic stat-check feedback (charisma / strength / perception / intelligence).
  // Reads ctx.success (NOT resolution.success — DIALOGUE always succeeds at the
  // resolver layer; the in-fiction outcome lives in narrative_context).
  const statKey =
    typeof ctx.stat_checked === "string" ? ctx.stat_checked.toLowerCase() : null;
  if (statKey || ctx.charisma_check === true) {
    const STAT_ICON: Record<string, string> = {
      charisma: "🎭", strength: "💪", perception: "👁", intelligence: "🧠",
    };
    const STAT_NAME: Record<string, string> = {
      charisma: "Charisma", strength: "Strength", perception: "Perception", intelligence: "Intelligence",
    };
    const STAT_SHORT: Record<string, string> = {
      charisma: "CHA", strength: "STR", perception: "PER", intelligence: "INT",
    };
    const key   = statKey ?? "charisma";
    const icon  = STAT_ICON[key] ?? "🎲";
    const name  = STAT_NAME[key] ?? "Stat";
    const short = STAT_SHORT[key] ?? "STAT";
    const passed = ctx.success === true;
    const label  = passed ? "Passed!" : "Failed.";
    return `${icon} ${name} check: ${roll} ${sign} (${short}) = ${total}${diffStr} — ${label}`;
  }

  return `🎲 Roll: ${roll} ${sign} = ${total}${diffStr}`;
}

function outcomeToLogType(outcomeType: string): LogEntryType {
  if (outcomeType.startsWith("ATTACK"))   return LogEntryType.COMBAT;
  if (outcomeType.startsWith("DIALOGUE")) return LogEntryType.DIALOGUE;
  if (outcomeType.startsWith("EXAMINE") || outcomeType.startsWith("INTERACT")) {
    return LogEntryType.DISCOVERY;
  }
  return LogEntryType.STORY;
}

const RARITY_LABELS: Record<ItemRarity, string> = {
  [ItemRarity.COMMON]:    "Common",
  [ItemRarity.UNCOMMON]:  "Uncommon",
  [ItemRarity.RARE]:      "Rare",
  [ItemRarity.LEGENDARY]: "Legendary",
};

/**
 * Adds a log entry to masterState AND syncs it to the Zustand persistedLogEntries
 * so the LogBook survives SPA navigation without waiting for a DB auto-save.
 */
function persistLogEntry(state: MasterState, type: LogEntryType, content: string): MasterState {
  const updated = addLogEntry(state, type, content);
  // addLogEntry PREPENDS — the new entry is always at index [0].
  const latest  = updated.log_book.entries[0];
  if (latest) {
    useGameStore.getState().addPersistedLogEntry(latest);
  }
  return updated;
}

/**
 * Fire-and-forget: immediately persist world_state to the DB after a MOVE or
 * any action that mutates world flags. Ensures current_location_id and flag
 * changes survive a hard refresh without waiting for the 10-action auto-save.
 */
function saveWorldStateAsync(sessionId: string, worldState: import("@/types/game").WorldState): void {
  void (async () => {
    try {
      await fetch("/api/game/world-state", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ sessionId, worldState }),
      });
    } catch {
      // Silently swallow — best-effort; the 10-action auto-save is the fallback.
    }
  })();
}

/**
 * Audit Issue M fix — fire-and-forget world_graph persist.
 * Mutations such as ZONE_EXPAND (new sub_location node), NPC arrivals
 * (addNpcToCurrentNode), and RegionBible application used to wait for
 * the 10-action auto-save before reaching the DB. Now any path that
 * mutates world_graph can call this immediately so a hard reload
 * doesn't lose the new node / npc_id link.
 */
function saveWorldGraphAsync(
  sessionId: string,
  worldGraph: import("@/types/game").WorldGraph
): void {
  void (async () => {
    try {
      await fetch("/api/game/world-state", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ sessionId, worldGraph }),
      });
    } catch {
      // Silently swallow — best-effort; the 10-action auto-save is the fallback.
    }
  })();
}

/**
 * Fire-and-forget: immediately persist the full log_book (entries +
 * recent_messages) to the DB so both survive a hard page refresh without
 * waiting for the 10-action auto-save.
 */
function saveLogEntriesAsync(sessionId: string, logBook: import("@/types/game").LogBook): void {
  void (async () => {
    try {
      await fetch("/api/game/log-entries", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ sessionId, logBook }),
      });
    } catch {
      // Silently swallow — this is best-effort; the 10-action auto-save is the fallback.
    }
  })();
}

async function persistState(
  state: MasterState,
  addMessage: (m: StoryMessage) => void
): Promise<void> {
  try {
    const response = await fetch("/api/game/state", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ sessionId: state.metadata.session_id, state }),
    });

    if (!response.ok) {
      addMessage(
        makeMessage("SYSTEM", "Your progress could not be saved. Check your connection.")
      );
    }
  } catch {
    addMessage(
      makeMessage("SYSTEM", "Your progress could not be saved. Check your connection.")
    );
  }
}

// ── Direct-action parser (no AI call) ────────────────────────────────────────

/**
 * Converts well-known prefixed commands into a ParsedAction without any AI
 * call. Returns null for everything else so the normal parseIntent path runs.
 */
function getDirectAction(input: string, _state: MasterState): ParsedAction | null {
  const lower = input.toLowerCase();

  if (lower.startsWith("equip ")) {
    const target = input.slice(6).trim();
    return { action_type: ActionType.USE_ITEM, primary_target: target, item_used: target, inferred_intent: "equip", confidence: 1 };
  }
  if (lower.startsWith("unequip ")) {
    const target = input.slice(8).trim();
    return { action_type: ActionType.USE_ITEM, primary_target: target, item_used: target, inferred_intent: "unequip", confidence: 1 };
  }
  if (lower.startsWith("drop ")) {
    const target = input.slice(5).trim();
    return { action_type: ActionType.CUSTOM, primary_target: target, inferred_intent: "drop", confidence: 1 };
  }
  if (lower.startsWith("read ")) {
    const target = input.slice(5).trim();
    return { action_type: ActionType.USE_ITEM, primary_target: target, item_used: target, inferred_intent: "read", confidence: 1 };
  }
  // "search [item]" — pre-classified as USE_ITEM so the resolver routes it to
  // the CONTAINER branch, but isNarrativeAction still returns true so the
  // Narrator runs and decides what's inside. NOT a fast-path action.
  if (lower.startsWith("search ")) {
    const target = input.slice(7).trim();
    return { action_type: ActionType.USE_ITEM, primary_target: target, item_used: target, inferred_intent: "search", confidence: 1 };
  }

  return null;
}

// ── Fast-path handler ─────────────────────────────────────────────────────────

type GameStore = ReturnType<typeof import("@/lib/stores/game-store").useGameStore.getState>;

function handleFastPath(
  action: ParsedAction,
  resolution: ResolutionResult,
  state: MasterState,
  store: GameStore,
  originalState: MasterState
): MasterState {
  let updated = state;

  if (
    resolution.outcome_type === "USE_ITEM_EQUIPPED" ||
    resolution.outcome_type === "USE_ITEM_UNEQUIPPED"
  ) {
    const itemName =
      typeof resolution.narrative_context.item_name === "string"
        ? resolution.narrative_context.item_name
        : (action.item_used ?? action.primary_target ?? "item");
    const verb = resolution.outcome_type === "USE_ITEM_EQUIPPED" ? "Equipped" : "Unequipped";
    store.addMessage(makeMessage("SYSTEM", `[ ${verb}: ${itemName} ]`));
    return updated;
  }

  const lookup = (action.item_used ?? action.primary_target ?? "").trim().toLowerCase();
  const item = originalState.player_state.inventory.find(
    (i) => i.id === lookup || i.name.toLowerCase() === lookup
  );

  if (isDropIntent(action.inferred_intent)) {
    if (item) {
      updated = removeFromInventory(updated, item.id, 1);
      store.addMessage(makeMessage("SYSTEM", `[ Dropped: ${item.name} ]`));
    }
    return updated;
  }

  if (isReadIntent(action.inferred_intent)) {
    if (item) {
      store.addMessage(
        makeMessage("LORE", item.description, { item_name: item.name, item_rarity: item.rarity })
      );
      updated = addLogEntry(
        updated,
        LogEntryType.DISCOVERY,
        `Read: ${item.name} — ${item.description}`
      );
    }
    return updated;
  }

  return updated;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useGameLoop() {
  // Reactive subscriptions — re-render when these change.
  const masterState    = useGameStore((s) => s.masterState);
  const messages       = useGameStore((s) => s.messages);
  const isProcessing   = useGameStore((s) => s.isProcessing);
  const processingStep = useGameStore((s) => s.processingStep);

  const submitAction = useCallback(async (
    input: string,
    options?: {
      npcName?:         string;
      tone?:            "friendly" | "aggressive" | "curious" | "deceptive";
      /** Navigation redesign — when set, submitAction skips parseIntent
       *  AND the MOVE intercept, building a synthetic MOVE ParsedAction
       *  for this node id. Used by navigateTo() and direct UI navigation
       *  (NavigationBar, map clicks, LOCATION highlight links). */
      forceMoveToNode?: string;
    }
  ) => {
    const store = useGameStore.getState();
    const forceMoveToNode = options?.forceMoveToNode ?? null;

    // ── 1. Validate input ────────────────────────────────────────────────────
    // Direct-navigation invocations carry no player text; skip the
    // empty-input guard for that path so the call goes through.
    const trimmed = input.trim();
    if (!forceMoveToNode && (!trimmed || trimmed.length > MAX_INPUT_LENGTH)) return;
    if (forceMoveToNode && trimmed.length > MAX_INPUT_LENGTH) return;

    const state = store.masterState;
    if (!state) {
      store.addMessage(
        makeMessage("SYSTEM", "No active game session. Please start a new game.")
      );
      return;
    }

    // Echo the player's command into the feed — only for typed input.
    // Direct-navigation clicks are intentionally silent here; the
    // narrator's ARRIVING beat is the player-facing record.
    //
    // FIX 4 — DIALOGUE option clicks (and the inline free-type input
    // submitted from the DialogueModal) come in as quoted speech with
    // an explicit npcName/tone option. Render those as a NARRATIVE
    // dialogue echo styled like the player's spoken line, not as the
    // generic "> action" SYSTEM echo, so the conversation reads as a
    // back-and-forth in the story feed.
    if (!forceMoveToNode) {
      const isQuotedSpeech =
        /^["'“‘]/.test(trimmed) &&
        (!!options?.npcName || !!options?.tone);
      if (isQuotedSpeech) {
        // Strip surrounding quotes so the renderer can format the line
        // without doubling them. Falls back to the raw trimmed string
        // if the regex misses for any reason.
        const stripped = trimmed
          .replace(/^["'“‘]/, "")
          .replace(/["'”’]$/, "")
          .trim();
        store.addMessage(
          makeMessage(
            "NARRATIVE",
            `◈ "${stripped}"`,
            { isPlayerDialogue: true }
          )
        );
      } else {
        store.addMessage(makeMessage("SYSTEM", `> ${trimmed}`));
      }
    }

    try {
      // ── 2. Parse intent (fast-path skips AI call entirely) ────────────────
      const directAction = getDirectAction(trimmed, state);
      let parsedAction: ParsedAction;

      if (forceMoveToNode) {
        // Direct navigation — bypass the AI parser entirely. The target
        // node is resolved from the live graph; we set primary_target
        // to its display name so the move classifier's name-match
        // channel resolves the node on the resolveAction pass.
        const navTarget =
          state.world_graph?.nodes[forceMoveToNode]?.name ?? forceMoveToNode;
        parsedAction = {
          action_type:     ActionType.MOVE,
          primary_target:  navTarget,
          inferred_intent: `navigate to ${navTarget}`,
          confidence:      1,
        };
      } else if (directAction) {
        // Direct actions (equip/unequip/drop/read) — zero AI calls, zero delay.
        parsedAction = directAction;
      } else {
        store.setProcessing(true, "Parsing intent...");
        try {
          parsedAction = await parseIntent(trimmed, state);
        } catch (err) {
          if (err instanceof IntentParserError) {
            store.addMessage(
              makeMessage(
                "SYSTEM",
                "The winds of fate are unclear. Try rephrasing your action."
              )
            );
            store.setProcessing(false);
            return;
          }
          throw err;
        }
        // FIX 4 — show the player what we're actually doing instead of
        // the generic "The world responds...". MOVE intercept and
        // WORLD_EXPLORE override this further down with their own
        // bespoke strings; everything else uses the helper's default.
        store.setProcessing(true, getLoadingText(parsedAction));
      }

      // ── 2b. NPC name + tone override ───────────────────────────────────────
      // When the caller provides an authoritative NPC name (e.g. dialogue
      // modal click, or InputBar submit while a dialogue is active), pin
      // primary_target to that name for DIALOGUE actions. The Intent Parser
      // never has to extract an NPC name from quoted speech.
      //
      // Issue B: also pin dialogue_tone from the option's tone so the
      // resolver fires the SAME check the badge advertised. The four
      // DialogueOption tones map to ParsedAction tones:
      //   aggressive → intimidating  (STR check)
      //   curious    → curious       (PER check)
      //   deceptive  → deceptive     (CHA check at +2 difficulty)
      //   friendly   → friendly      (no check)
      if (parsedAction.action_type === ActionType.DIALOGUE) {
        const overrides: Partial<ParsedAction> = {};
        if (options?.npcName) {
          // FIX 3 — DON'T pin to the active dialogue NPC if the parser
          // already extracted a different name. The InputBar always
          // passes the active NPC as a fallback so naked replies
          // ("Tell me more.") resolve correctly, but it must not
          // override the player's explicit "let me speak with Dessa"
          // by silently swapping Dessa back to the active speaker.
          const parsedName  = parsedAction.primary_target?.trim() ?? "";
          const optionName  = options.npcName.trim();
          const playerNamedDifferentNpc =
            parsedName.length > 0 &&
            parsedName.toLowerCase() !== optionName.toLowerCase();
          if (!playerNamedDifferentNpc) {
            overrides.primary_target = options.npcName;
          } else {
            console.log(
              `[GameLoop/2b] Player named '${parsedName}' explicitly — keeping over active NPC '${optionName}'`
            );
          }
        }
        if (options?.tone) {
          const TONE_MAP: Record<typeof options.tone & string, NonNullable<ParsedAction["dialogue_tone"]>> = {
            aggressive: "intimidating",
            curious:    "curious",
            deceptive:  "deceptive",
            friendly:   "friendly",
          };
          overrides.dialogue_tone = TONE_MAP[options.tone];
        }
        if (Object.keys(overrides).length > 0) {
          parsedAction = { ...parsedAction, ...overrides };
        }
      }

      // ── 2b-2. Audit Issues C/G — pin primary_target from the current node
      // The narrator must NOT pick which NPC responds — the game determines
      // that from the graph. We override primary_target in two scenarios:
      //
      //   Case 1 (original): primary_target is null — quoted dialogue
      //   reached the fast-path with no extracted target.
      //
      //   Case 2 (audit fix): primary_target is set BUT does not match any
      //   CHARACTER asset present at the current node. The AI parser picked
      //   a descriptor like "solitary figure" or "the hooded man" — without
      //   intervention the narrator would invent a fresh NPC. We override
      //   the descriptor with the real WorldBible NPC at this node.
      //
      // In both cases we resolve to:
      //   - the sole NPC in the node, or
      //   - the player's currentDialogueNpc when continuing a conversation
      //     and that NPC is still at the node.
      // Otherwise we leave primary_target as it was (Case 1: still null;
      // Case 2: we don't have a confident substitute, so we stay out of
      // the way and let the empty-NPC fallback fire downstream).
      if (parsedAction.action_type === ActionType.DIALOGUE) {
        const graph2 = state.world_graph;
        const node2  = graph2?.nodes[graph2.current_node_id];
        if (node2) {
          const liveAssets = useGameStore.getState().locationAssets;
          const presentNpcAssets = node2.npc_ids
            .map((id) => liveAssets.find((a) => a.id === id))
            .filter((a): a is WorldAsset =>
              !!a && a.category === AssetCategory.CHARACTER
            );

          // Determine whether the existing primary_target already matches
          // a CHARACTER asset present at the node — if so, we leave it.
          const target = parsedAction.primary_target?.trim() ?? "";
          const targetMatchesPresent =
            target.length > 0 &&
            presentNpcAssets.some(
              (a) => a.name.toLowerCase() === target.toLowerCase()
            );

          // FIX 3 — explicit NPC switch: when the player named a
          // present NPC that's DIFFERENT from the active dialogue
          // partner, snap the dialogue modal closed so step 7g seeds
          // fresh options for the new character. Without this, options
          // for the old NPC linger until the narrator returns the new
          // ones, which leaks across the conversation boundary.
          if (targetMatchesPresent) {
            const activeNpc = useGameStore.getState().currentDialogueNpc;
            if (activeNpc && activeNpc.toLowerCase() !== target.toLowerCase()) {
              console.log(
                `[GameLoop/2b-2] NPC switch: ${activeNpc} → ${target}`
              );
              useGameStore.getState().clearDialogueOptions();
            }
          }

          // FIX 3 — named-but-absent flag. When the player names a
          // specific NPC who isn't at this location, the narrator
          // should describe that NPC as not present rather than
          // inventing a new character. We can't reach narrative_context
          // from here (the resolver writes that), so we tag the
          // ParsedAction with a private field; step 5 will graft it
          // onto resolution.narrative_context just before the narrator
          // call.
          const looksLikeProperName = (s: string): boolean => {
            // Heuristic: at least one capitalised word and not a known
            // descriptor like "the boy" / "stranger" / "merchant".
            if (!s) return false;
            if (/^(the\s+)?(boy|girl|kid|child|man|woman|stranger|figure|person|merchant|trader|vendor|shopkeeper|guard|innkeeper|patron)$/i.test(s)) {
              return false;
            }
            return /[A-Z]/.test(s);
          };
          // Fix 2 — when the player names a specific NPC by proper name and
          // that NPC is not present, short-circuit with a hardcoded system
          // message. No AI call, no redirect to a different NPC at the
          // current node — the parser is asked to address the named person,
          // not whoever happens to be standing here.
          if (
            target.length > 0 &&
            !targetMatchesPresent &&
            looksLikeProperName(target)
          ) {
            console.log(
              `[GameLoop/2b-2] '${target}' isn't here — short-circuiting with hardcoded response.`
            );
            store.addMessage(
              makeMessage("SYSTEM", `${target} isn't here.`)
            );
            store.setProcessing(false);
            return;
          }

          // Generic descriptor / null-target resolution — the parser said
          // "the boy" or "the merchant" without naming a specific NPC, or
          // the player typed quoted speech with no target at all. We can
          // safely resolve this to a present NPC because the player did
          // not address anyone by name. (No proper-name redirect runs
          // here — that case short-circuits above.)
          const shouldOverride = !target || !targetMatchesPresent;

          if (shouldOverride && presentNpcAssets.length === 1) {
            const real = presentNpcAssets[0].name;
            console.log(
              "[GameLoop/2b-2] Pinned primary_target to sole NPC at node:",
              real
            );
            parsedAction = { ...parsedAction, primary_target: real };
          } else if (shouldOverride && presentNpcAssets.length > 1) {
            const descriptorMatch = matchDescriptorToNpc(target, presentNpcAssets);
            if (descriptorMatch) {
              console.log(
                `[GameLoop/2b-2] Resolved descriptor '${target}' → role-matched NPC: ${descriptorMatch.name}`
              );
              parsedAction = { ...parsedAction, primary_target: descriptorMatch.name };
            } else {
              const activeNpcName = useGameStore.getState().currentDialogueNpc;
              if (activeNpcName) {
                const activeIsHere = presentNpcAssets.some(
                  (a) => a.name.toLowerCase() === activeNpcName.toLowerCase()
                );
                if (activeIsHere) {
                  console.log(
                    "[GameLoop/2b-2] Pinned primary_target to active NPC at node:",
                    activeNpcName
                  );
                  parsedAction = { ...parsedAction, primary_target: activeNpcName };
                }
              }
            }
          }
        }
      }

      // ── 2c. Defensive NPC location guard ─────────────────────────────────
      // After step 2b-2 (Issues E+F) pinned primary_target from the graph,
      // this guard is mostly redundant — but it still serves as a final
      // sweep for the rare case where currentDialogueNpc lingers from a
      // location the player has since left (e.g. modal reopened from stale
      // store state after a long pause). Keep it as a safety net; it
      // no-ops when the NPC IS at the current node.
      if (parsedAction.action_type === ActionType.DIALOGUE) {
        const graph2       = state.world_graph;
        const currentNode2 = graph2?.nodes[graph2.current_node_id];
        const gsBefore     = useGameStore.getState();
        if (currentNode2 && gsBefore.currentDialogueNpc) {
          const npcAtNode = (currentNode2.npc_ids ?? []).some(
            (id) =>
              id === gsBefore.currentDialogueNpcKey ||
              id === normalizeAssetId(AssetCategory.CHARACTER, gsBefore.currentDialogueNpc as string)
          );
          if (!npcAtNode) {
            console.log("[GameLoop/2c] Active NPC not at current node — clearing dialogue modal");
            gsBefore.clearDialogueOptions();
          }
        }
      }

      // ── 2d. Architecture spec: text MOVE is UI-only ─────────────────────
      // Per /docs/architecture-spec.md ("Navigation — Code Only"): the AI
      // never receives movement intent and never writes travel prose. If
      // the parser classified the player's text as MOVE, we respond with
      // a hardcoded system message and stop. Zero AI involvement.
      //
      // The previous INTERNAL_DESCRIBE narrator path is removed entirely.
      // navigateTo() (NavigationBar / map clicks / highlight clicks) is
      // the only way to actually move. forceMoveToNode is the sanctioned
      // UI channel and bypasses this guard via the early branch above.
      if (!forceMoveToNode && parsedAction.action_type === ActionType.MOVE) {
        console.log("[GameLoop] MOVE blocked — text navigation disabled per spec");
        store.addMessage(
          makeMessage(
            "SYSTEM",
            "Use the navigation bar below to travel to a nearby location."
          )
        );
        store.setProcessing(false);
        return;
      }

      // ── 3. Resolve action ──────────────────────────────────────────────────
      const resolution = resolveAction(parsedAction, state);

      // ── 4. Apply state_delta ───────────────────────────────────────────────
      let updatedState = applyStateDelta(state, resolution.state_delta);

      // ── 4b. Roll feedback (feed + log book) ────────────────────────────────
      // The roll line goes into both the live story feed AND the persistent
      // log book — stat checks are mechanically meaningful events that
      // belong in the journal. Runs after step 4 so updatedState exists for
      // persistLogEntry.
      const rollMsg = buildRollFeedback(resolution);
      if (rollMsg) {
        store.addMessage(makeMessage("SYSTEM", rollMsg));
        updatedState = persistLogEntry(updatedState, LogEntryType.COMBAT, rollMsg);
      } else if (typeof resolution.narrative_context?.stat_checked === "string") {
        // Audit Issue J fix: only warn when a stat check was actually
        // expected (resolver set stat_checked) but the roll fields were
        // silently dropped. Pre-fix this fired on every neutral action,
        // polluting the console.
        console.warn("[GameLoop/3b] stat_checked set but no roll populated — silent drop:", {
          stat_checked: resolution.narrative_context.stat_checked,
          roll:         resolution.narrative_context.roll,
          outcome_type: resolution.outcome_type,
        });
      }

      // ── 4b. Fast path — inventory management actions skip the Narrator ─────
      if (!isNarrativeAction(parsedAction, state)) {
        const finalState = handleFastPath(parsedAction, resolution, updatedState, store, state);
        const stamped: MasterState = {
          ...finalState,
          metadata: { ...finalState.metadata, last_played: new Date().toISOString() },
        };

        if (directAction) {
          // Direct typed prefix (equip/unequip/drop/read) — defer the React
          // re-render so the input clear and the resulting feed update happen
          // in the same paint, eliminating the spinner flash entirely.
          startTransition(() => {
            store.setMasterState(stamped);
          });
        } else {
          store.setMasterState(stamped);
        }

        await persistState(stamped, store.addMessage);
        store.setProcessing(false);
        return;
      }

      // ── 4c. Day 19C — Tier 2 ambient object short-circuit ──────────────────
      // Before paying for a narrator call on EXAMINE/INTERACT, ask the
      // ambient-objects library whether the target is a known template at
      // this location. If it is, we return an instant flavour line and
      // skip the narrator entirely — no AI call, no state change. The
      // location's ambient_type lives on its world_asset constitution
      // (written by apply-world-bible).
      //
      // Tier 1 (named LocationObjects) and Tier 3 (free interaction) are
      // both still routed to the narrator — Tier 1 for rich responses,
      // Tier 3 for the brief ambient instruction (added in prompt-builder).
      if (
        parsedAction.action_type === ActionType.EXAMINE ||
        parsedAction.action_type === ActionType.INTERACT
      ) {
        const tier2Graph    = updatedState.world_graph;
        const tier2NodeId   = tier2Graph?.current_node_id ?? updatedState.world_state.current_location_id;
        const tier2Assets   = useGameStore.getState().locationAssets;
        const tier2LocAsset = tier2Assets.find(
          (a) =>
            a.category === AssetCategory.LOCATION &&
            (a.id === `location_${tier2NodeId}` || a.first_seen_location === tier2NodeId)
        );
        const ambientType =
          typeof tier2LocAsset?.constitution.ambient_type === "string"
            ? tier2LocAsset.constitution.ambient_type
            : "";
        const target =
          parsedAction.primary_target ??
          parsedAction.secondary_target ??
          trimmed;
        const ambientResponse = ambientType
          ? findAmbientResponse(ambientType, target)
          : null;

        if (ambientResponse) {
          store.addMessage(makeMessage("NARRATIVE", ambientResponse));
          store.setLastNarrativeText(ambientResponse);
          updatedState = persistLogEntry(
            updatedState,
            LogEntryType.STORY,
            `Examined ${target} — nothing notable.`
          );
          const stamped: MasterState = {
            ...updatedState,
            metadata: { ...updatedState.metadata, last_played: new Date().toISOString() },
          };
          store.setMasterState(stamped);
          await persistState(stamped, store.addMessage);
          store.setProcessing(false);
          return;
        }

        // FIX 7 — Tier 1 repeat-examine short-circuit. Match the
        // player's target against the current location's key_landmarks
        // (the Tier 1 object roster). If they've already examined this
        // landmark in this session, return a canned line instead of
        // burning another narrator call to re-describe the same thing.
        // EXAMINE only — INTERACT semantics differ (player may push,
        // pull, take from a container) so we don't dedup those.
        if (parsedAction.action_type === ActionType.EXAMINE) {
          const landmarks = (tier2LocAsset?.constitution.key_landmarks ?? [])
            .map((s) => (typeof s === "string" ? s : ""))
            .filter((s) => s.trim().length > 0);
          const targetLower = target.trim().toLowerCase();
          const matchedLandmark = landmarks.find((lm) => {
            const lmLower = lm.toLowerCase();
            return lmLower === targetLower
                || lmLower.includes(targetLower)
                || targetLower.includes(lmLower);
          });

          if (matchedLandmark) {
            const examineKey = matchedLandmark.toLowerCase();
            if (useGameStore.getState().hasExaminedObject(examineKey)) {
              const canned = "You find nothing new upon closer inspection.";
              store.addMessage(makeMessage("NARRATIVE", canned));
              store.setLastNarrativeText(canned);
              updatedState = persistLogEntry(
                updatedState,
                LogEntryType.STORY,
                `Re-examined ${matchedLandmark} — no new details.`
              );
              const stamped: MasterState = {
                ...updatedState,
                metadata: { ...updatedState.metadata, last_played: new Date().toISOString() },
              };
              store.setMasterState(stamped);
              await persistState(stamped, store.addMessage);
              store.setProcessing(false);
              return;
            }
            // First examine this session — stash the key on the parsed
            // action so step 6 can mark it examined after the narrator
            // produces a successful response.
            (parsedAction as ParsedAction & { _examineKey?: string })._examineKey = examineKey;
          }
        }
      }

      // ── 4d. Day 19D — WORLD_EXPLORE → Regional Bible expansion ─────────────
      // Before the narrator runs, see if this WORLD_EXPLORE matches an
      // outline from the WorldBible's adjacent_regions. If so, generate
      // (or fetch from cache) a full RegionBible, apply it on the server
      // side, and swap the player into the new region's settlement node.
      // The narrator then runs with ARRIVING context describing the real
      // settlement instead of a stub-named placeholder.
      //
      // Falls through to the legacy stub-gen path (step 7-C) when:
      //   - the move isn't WORLD_EXPLORE
      //   - the world_bible isn't in metadata (legacy save)
      //   - no outline matched (truly unknown destination)
      //   - the network fetch fails (graceful degrade)
      const moveTypeForRegion =
        typeof resolution.narrative_context.move_type === "string"
          ? resolution.narrative_context.move_type
          : null;
      if (
        moveTypeForRegion === "WORLD_EXPLORE" &&
        updatedState.world_graph &&
        updatedState.metadata.world_bible
      ) {
        const wb        = updatedState.metadata.world_bible;
        const wcdRegion = updatedState.metadata.world_consistency;
        const target    =
          parsedAction.primary_target ??
          (typeof resolution.narrative_context.destination_hint === "string"
            ? resolution.narrative_context.destination_hint
            : null);
        const matchedOutline = matchRegionOutline(wb.adjacent_regions, target);

        // Bug 2 diagnostic — show what outline (and bible) the
        // RegionBible expansion path picked for this navigation. If
        // we ever cache-poison or mis-match, the mismatch shows up
        // here next to the [RegionBibleCache] READ/WRITE lines.
        console.log("[navigateTo] expanding region:", {
          targetId:           target,
          matchedOutlineId:   matchedOutline?.id,
          matchedOutlineName: matchedOutline?.name,
        });

        if (matchedOutline && wcdRegion) {
          const sessionId = updatedState.metadata.session_id;
          const fromId    = String(
            resolution.narrative_context.from_node_id ??
              updatedState.world_graph.current_node_id
          );
          const fromNode  = updatedState.world_graph.nodes[fromId];
          const fromName  = fromNode?.name ?? wb.starting_region.name;

          // Status line in the feed so the player knows the world is
          // expanding under them. Removed as soon as application returns.
          const enteringMsg = makeMessage(
            "SYSTEM",
            `Entering ${matchedOutline.name}...`
          );
          store.addMessage(enteringMsg);
          store.setProcessing(true, `Entering ${matchedOutline.name}...`);

          // Names of every region the player already knows about — keeps
          // the model from re-using one when fleshing out a new outline.
          const existingRegionNames = [
            wb.starting_region.name,
            ...wb.adjacent_regions
              .filter((r) => r.id !== matchedOutline.id)
              .map((r) => r.name),
          ];

          // Cache hit short-circuits the AI call entirely (~5s saved).
          const cached = getCachedRegionalBible(sessionId, matchedOutline.id);
          let regionBible: RegionBible | null = cached;

          if (!regionBible) {
            try {
              const genRes = await fetch("/api/game/generate-regional-bible", {
                method:  "POST",
                headers: { "Content-Type": "application/json" },
                body:    JSON.stringify({
                  session_id:            sessionId,
                  outline:               matchedOutline,
                  origin_region_name:    fromName,
                  direction_from_origin: matchedOutline.direction_from_start,
                  genre:                 updatedState.metadata.genre,
                  wcd:                   wcdRegion,
                  existing_region_names: existingRegionNames,
                }),
              });
              if (genRes.ok) {
                const data = await genRes.json() as { bible?: RegionBible };
                regionBible = data.bible ?? null;
                if (regionBible) {
                  cacheRegionalBible(sessionId, matchedOutline.id, regionBible);
                }
              } else {
                console.warn(
                  "[GameLoop/4d] generate-regional-bible failed:",
                  await genRes.text()
                );
              }
            } catch (err) {
              console.warn("[GameLoop/4d] generate-regional-bible threw:", err);
            }
          } else {
            console.log(
              `[GameLoop/4d] Cache hit for region: ${matchedOutline.name}`
            );
          }

          if (regionBible) {
            try {
              const applyRes = await fetch("/api/game/apply-regional-bible", {
                method:  "POST",
                headers: { "Content-Type": "application/json" },
                body:    JSON.stringify({
                  session_id:           sessionId,
                  bible:                regionBible,
                  origin_node_id:       fromId,
                  existing_world_graph: updatedState.world_graph,
                }),
              });
              if (applyRes.ok) {
                const applied = await applyRes.json() as {
                  starting_node_id?:    string;
                  updated_world_graph?: WorldGraph;
                };
                if (applied.starting_node_id && applied.updated_world_graph) {
                  // Swap the player into the new settlement node and replace
                  // the graph in one step so the narrator's ARRIVING context
                  // reflects the real region from the very first beat.
                  const newGraph = {
                    ...applied.updated_world_graph,
                    current_node_id: applied.starting_node_id,
                  };
                  updatedState = {
                    ...updatedState,
                    world_state: {
                      ...updatedState.world_state,
                      current_location_id: applied.starting_node_id,
                      current_node_id:     applied.starting_node_id,
                      visited_locations: Array.from(
                        new Set([
                          ...(updatedState.world_state.visited_locations ?? []),
                          applied.starting_node_id,
                        ])
                      ),
                      // FIX 4 — explicitly stamp ARRIVING after RegionBible
                      // expansion. The earlier WORLD_EXPLORE resolution set
                      // ARRIVING already, but we re-apply it here so the
                      // narrator's state sees ARRIVING regardless of any
                      // intermediate mutations, and so the ◈ arrival header
                      // fires for the new settlement on the first beat.
                      location_status: LocationStatus.ARRIVING,
                    },
                    world_graph: newGraph,
                  };
                  // Refresh locationAssets for the new settlement node so
                  // later steps (narrator, highlight) see real Tier 1 data.
                  void getWorldAssetsForLocation(sessionId, applied.starting_node_id).then(
                    (assets) => useGameStore.getState().setLocationAssets(assets)
                  );
                  // Audit Issue M fix: also fire a world_graph persist so a
                  // hard reload doesn't lose the new region's nodes (the
                  // route already persisted master_state — this is a
                  // belt-and-braces patch for the dedicated jsonb column).
                  saveWorldGraphAsync(sessionId, newGraph);
                  console.log(
                    `[GameLoop/4d] RegionBible applied: ${regionBible.name} → ${applied.starting_node_id}`
                  );
                }
              } else {
                console.warn(
                  "[GameLoop/4d] apply-regional-bible failed:",
                  await applyRes.text()
                );
              }
            } catch (err) {
              console.warn("[GameLoop/4d] apply-regional-bible threw:", err);
            }
          }
          // Either way, the "Entering..." status is no longer accurate —
          // narration takes over from here.
          store.setProcessing(true, getLoadingText(parsedAction));
        }
      }

      // ── 5. Narrate ─────────────────────────────────────────────────────────
      // FIX 4 — replace the generic "Narrating..." with action-specific
      // text so the player can read what's about to happen.
      store.setProcessing(true, getLoadingText(parsedAction));

      // FIX 2 — Pre-load locationAssets BEFORE the narrator runs when this
      // action ARRIVES at a new location. Step 7c does the same fetch
      // fire-and-forget AFTER the narrator returns, but on first visit
      // to a WorldBible sub-location that's too late: NPCS PRESENT and
      // the TIER 1 OBJECTS block render empty, so the narrator can't
      // reference the real cast / props. Synchronous pre-load fixes the
      // first beat; step 7c continues to keep subsequent beats fresh.
      const arrivingAt =
        resolution.state_delta.world_state?.location_status === LocationStatus.ARRIVING
          ? resolution.state_delta.world_state.current_location_id ?? null
          : null;
      if (arrivingAt) {
        const arrivedAssets = await getWorldAssetsForLocation(
          updatedState.metadata.session_id,
          arrivingAt
        );
        if (arrivedAssets.length > 0) {
          useGameStore.getState().setLocationAssets(arrivedAssets);
          console.log(
            "[GameLoop/5] Pre-loaded assets for ARRIVING:",
            arrivingAt,
            arrivedAssets.length
          );
        }
      }

      const lastNarrative      = useGameStore.getState().lastNarrativeText;
      const allLocationAssets  = useGameStore.getState().locationAssets;

      // Issue A: for DIALOGUE actions, the narrator must receive ONLY the
      // active NPC's CHARACTER constitution — never the full roster of
      // people at the location. Non-CHARACTER assets (locations, factions,
      // items, lore) still flow through so the setting/context stays rich.
      //
      // Audit Issue P fix: previously when the active NPC name didn't
      // match any CHARACTER asset (e.g. the player typed a descriptor
      // that step 2b-2 also failed to resolve), this fell back to the
      // FULL roster — exactly the wrong move on a DIALOGUE action,
      // because the narrator then sees every NPC in the session and
      // free-invents. New fallback: filter CHARACTERs to only those in
      // the current node's npc_ids, so the narrator still sees the
      // graph-confirmed cast for ambient context but can't pick a
      // stranger to respond.
      const isDialogueForFilter =
        parsedAction.action_type === ActionType.DIALOGUE;
      const activeNpcForFilter =
        parsedAction.primary_target ?? null;
      const currentNodeForFilter =
        state.world_graph?.nodes[state.world_graph.current_node_id] ?? null;
      const locationAssets: WorldAsset[] = (() => {
        if (!isDialogueForFilter || !activeNpcForFilter) return allLocationAssets;
        const activeKey = normalizeAssetId(AssetCategory.CHARACTER, activeNpcForFilter);
        const activeAsset = allLocationAssets.find(
          (a) =>
            a.category === AssetCategory.CHARACTER &&
            (a.id === activeKey || a.name.toLowerCase() === activeNpcForFilter.toLowerCase())
        );
        if (activeAsset) {
          // Keep every non-CHARACTER asset, plus only the resolved active NPC.
          return [
            ...allLocationAssets.filter((a) => a.category !== AssetCategory.CHARACTER),
            activeAsset,
          ];
        }
        // Audit Issue P fallback: no asset matched. Restrict CHARACTERs to
        // the current node's roster so the narrator can't reach for an
        // off-stage NPC, and log the miss for observability.
        const nodeNpcIds = new Set(currentNodeForFilter?.npc_ids ?? []);
        console.warn(
          "[GameLoop/5] DIALOGUE filter: no CHARACTER asset matched activeNpc — falling back to current node roster.",
          { activeNpc: activeNpcForFilter, nodeNpcIds: Array.from(nodeNpcIds) }
        );
        return allLocationAssets.filter(
          (a) => a.category !== AssetCategory.CHARACTER || nodeNpcIds.has(a.id)
        );
      })();

      // Always give the narrator the most current world_state (including
      // location_status from the resolution) so it never infers location
      // from narrative history.
      const narratorState: MasterState = resolution.state_delta.world_state
        ? {
            ...updatedState,
            world_state: { ...updatedState.world_state, ...resolution.state_delta.world_state },
          }
        : updatedState;

      // Day 18 — read player's verbosity preference from the store.
      const currentVerbosity = useGameStore.getState().verbosity;
      // FIX 6 — log verbosity at the call site so we can confirm the
      // store value reaches the narrator.
      console.log("[GameLoop/5] verbosity:", currentVerbosity);
      // Day 19A — pull the World Consistency Document straight from state
      // metadata so every narrator call carries the absolute facts. Old
      // saves without a WCD pass undefined — narrate route handles it.
      const wcd = narratorState.metadata.world_consistency;

      // FIX 3 — propagate the named-but-absent NPC flag from step 2b-2
      // into the narrative_context so the narrator can describe the
      // named character as not present rather than inventing them.
      const namedNpcNotPresent =
        (parsedAction as ParsedAction & { _namedNpcNotPresent?: string })._namedNpcNotPresent;
      const resolutionForNarrator: ResolutionResult =
        namedNpcNotPresent
          ? {
              ...resolution,
              narrative_context: {
                ...resolution.narrative_context,
                named_npc_not_present: namedNpcNotPresent,
              },
            }
          : resolution;

      let narratorResponse;
      try {
        narratorResponse = await narrateAction(
          resolutionForNarrator,
          narratorState,
          lastNarrative,
          parsedAction,
          locationAssets,
          currentVerbosity,
          wcd,
        );
      } catch {
        // Narrator failed — still save the resolved state so the action sticks.
        store.addMessage(
          makeMessage(
            "SYSTEM",
            "The oracle falls silent momentarily. Your action occurred but the story pauses."
          )
        );
        updatedState = addLogEntry(
          updatedState,
          LogEntryType.SYSTEM,
          `Action ${resolution.outcome_type} occurred (no narrative).`
        );
        store.setMasterState(updatedState);
        await persistState(updatedState, store.addMessage);
        store.setProcessing(false);
        return;
      }

      // ── 6. Add narrative message ───────────────────────────────────────────
      // DIALOGUE actions get their own message type so StoryFeed can style
      // them with the NPC accent colour and quoted presentation.
      const isDialogueAction = parsedAction.action_type === ActionType.DIALOGUE;
      // Day 18 — for MOVE that lands on a known graph node, pin the
      // destination name onto the metadata so StoryFeed can render the
      // arrival header (◈ Name).
      // FIX 4 — also fire when the resolver reported `arriving_at` OR
      // updatedState.location_status is ARRIVING (which the
      // RegionBible expansion path stamps explicitly). The previous
      // `outcome_type === MOVE_SUCCESS` gate alone missed the
      // RegionBible flow because the resolver returned without an
      // arriving_at hint and step 4d's ARRIVING status update wasn't
      // honoured by the header.
      const arrivalLocationName: string | null = (() => {
        const graph = updatedState.world_graph;
        if (!graph) return null;

        const isMoveSuccess  = resolution.outcome_type === "MOVE_SUCCESS";
        const isZoneExpand   = resolution.outcome_type === "ZONE_EXPAND";
        const arrivingAtHint = typeof resolution.narrative_context.arriving_at === "string"
          ? resolution.narrative_context.arriving_at
          : null;
        const statusArriving =
          updatedState.world_state.location_status === LocationStatus.ARRIVING;

        if (!(isMoveSuccess || isZoneExpand || arrivingAtHint || statusArriving)) {
          return null;
        }
        const targetId = updatedState.world_state.current_location_id;

        // Bug 7 — duplicate section header guard. If the last arrival
        // we emitted a header for is the same node, skip the metadata
        // tag so StoryFeed doesn't render a second ◆ NAME divider.
        // The narrative text still flows through as usual; only the
        // section header is suppressed.
        if (targetId && targetId === lastArrivalNodeId) {
          console.log(
            "[GameLoop] suppressing duplicate arrival header for", targetId
          );
          return null;
        }
        if (targetId) {
          lastArrivalNodeId = targetId;
        }
        return graph.nodes[targetId]?.name ?? arrivingAtHint ?? null;
      })();
      store.addMessage(
        makeMessage(
          isDialogueAction ? "DIALOGUE" : "NARRATIVE",
          narratorResponse.narrative_text,
          {
            outcome_type:       resolution.outcome_type,
            sound_id:           narratorResponse.sound_id,
            response_tier:      narratorResponse.response_tier,
            points_of_interest: narratorResponse.points_of_interest,
            ...(isDialogueAction && parsedAction.primary_target
              ? { npcName: parsedAction.primary_target }
              : {}),
            ...(arrivalLocationName ? { locationName: arrivalLocationName } : {}),
          }
        )
      );
      store.setLastNarrativeText(narratorResponse.narrative_text);

      // FIX 7 — landmark passed step 4c's match check; the narrator just
      // produced its first description for this session. Mark the
      // landmark examined so the next EXAMINE on the same target
      // short-circuits to the canned response instead of paying for
      // another narrator call.
      {
        const examineKey = (parsedAction as ParsedAction & { _examineKey?: string })._examineKey;
        if (examineKey) {
          useGameStore.getState().markObjectExamined(examineKey);
        }
      }

      // ── 6b. Day 19D — Background pre-generation of adjacent regions ────────
      // When the narrator's response hints toward an undiscovered region
      // (mentions its direction or its name), kick off a void fetch to
      // warm the regional bible cache. By the time the player actually
      // crosses into that region, the bible is usually ready and the
      // "Entering ${name}..." indicator never appears. Best-effort —
      // failures are silently ignored, and a real WORLD_EXPLORE will
      // still fall back to a synchronous fetch with a visible spinner.
      const wbForPregen   = updatedState.metadata.world_bible;
      const wcdForPregen  = updatedState.metadata.world_consistency;
      const sessionForPregen = updatedState.metadata.session_id;
      if (
        wbForPregen &&
        wcdForPregen &&
        narratorResponse.narrative_text &&
        wbForPregen.adjacent_regions.length > 0
      ) {
        const narrText = narratorResponse.narrative_text.toLowerCase();
        const existingNames = wbForPregen.adjacent_regions.map((r) => r.name);
        const originName = (() => {
          const g = updatedState.world_graph;
          const id = g?.current_node_id ?? updatedState.world_state.current_node_id ?? "";
          return g?.nodes[id]?.name ?? wbForPregen.starting_region.name;
        })();
        for (const outline of wbForPregen.adjacent_regions) {
          const dir   = (outline.direction_from_start ?? "").toLowerCase();
          const name  = outline.name.toLowerCase();
          // Audit Issue T fix: tighten direction matching. Bare
          // narrText.includes("north") matched ambient prose ("the wind
          // from the north") and fired a fetch every turn. Require an
          // explicit "to the <dir>" / "<dir>ward" phrase, OR a region
          // name match — the name match alone is reliable enough.
          const dirMatches =
            dir.length > 2 &&
            (narrText.includes(`to the ${dir}`) || narrText.includes(`${dir}ward`));
          const nameMatches = name.length > 3 && narrText.includes(name);
          const hinted = dirMatches || nameMatches;
          if (!hinted) continue;
          // existingRegionNames excludes the outline itself so the model
          // doesn't get confused into reusing its own placeholder name.
          pregenerateRegionalBible({
            sessionId:           sessionForPregen,
            outline,
            originRegionName:    originName,
            directionFromOrigin: outline.direction_from_start,
            genre:               updatedState.metadata.genre,
            wcd:                 wcdForPregen,
            existingRegionNames: existingNames.filter((n) => n !== outline.name),
          });
        }
      }

      // ── 7. Day 18 — Move dispatch + Art engine ───────────────────────────────
      // The resolver tags every move with a move_type in narrative_context.
      // Each branch handles graph maintenance differently:
      //   GRAPH_NAVIGATE  → just refresh assets, mark node discovered, no stub
      //   ZONE_EXPAND     → create a new sub_location node + asset
      //   WORLD_EXPLORE   → existing stub generator + add new zone node
      //   (legacy)        → MOVE_SUCCESS with no move_type — pre-graph saves
      //   DESCRIBE_SUCCESS / INTERNAL_DESCRIBE → no location change, skip both
      const moveType =
        typeof resolution.narrative_context.move_type === "string"
          ? resolution.narrative_context.move_type
          : null;
      const isLocationChange =
        resolution.outcome_type === "MOVE_SUCCESS" ||
        resolution.outcome_type === "ZONE_EXPAND";

      if (isLocationChange) {
        const newLocationId = updatedState.world_state.current_location_id;
        const artSessionId  = updatedState.metadata.session_id;

        // ── 7-A. GRAPH_NAVIGATE ─────────────────────────────────────────────
        if (moveType === "GRAPH_NAVIGATE" && updatedState.world_graph) {
          const graph = updatedState.world_graph;
          const node  = graph.nodes[newLocationId];
          if (node) {
            const updatedNodes = node.discovered
              ? graph.nodes
              : { ...graph.nodes, [newLocationId]: { ...node, discovered: true } };
            updatedState = {
              ...updatedState,
              world_graph: {
                ...graph,
                nodes:           updatedNodes,
                current_node_id: newLocationId,
              },
            };
          }
          // No stub gen needed — known asset already exists. Step 7c will
          // refresh locationAssets via the standard ARRIVING flow.
        }

        // ── 7-B. ZONE_EXPAND ────────────────────────────────────────────────
        else if (moveType === "ZONE_EXPAND" && updatedState.world_graph) {
          const graph        = updatedState.world_graph;
          const parentNodeId = String(resolution.narrative_context.from_node_id ?? graph.current_node_id);
          const parentNode   = graph.nodes[parentNodeId];
          const expandHint   = String(resolution.narrative_context.expand_hint ?? newLocationId);
          const subId        = newLocationId; // resolver already canonicalised it
          const subName      = expandHint
            .replace(/^(the|a|an)\s+/i, "")
            .split(/\s+/)
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(" ");

          if (parentNode && !graph.nodes[subId]) {
            const subNode: WorldNode = {
              id:            subId,
              name:          subName,
              type:          "sub_location",
              zone_id:       parentNode.zone_id,
              is_expandable: false,
              connections:   [parentNodeId],
              npc_ids:       [],
              item_ids:      [],
              asset_id:      `location_${subId}`,
              discovered:    true,
              map_position: {
                x: parentNode.map_position.x + (Math.random() * 0.5 - 0.25),
                y: parentNode.map_position.y + (Math.random() * 0.5 - 0.25),
              },
            };
            updatedState = {
              ...updatedState,
              world_graph: {
                ...graph,
                nodes: {
                  ...graph.nodes,
                  [subId]: subNode,
                  [parentNodeId]: {
                    ...parentNode,
                    connections: parentNode.connections.includes(subId)
                      ? parentNode.connections
                      : [...parentNode.connections, subId],
                  },
                },
                current_node_id: subId,
              },
            };

            // Persist a world_asset for the new sub_location so the codex
            // step 7c finds it on arrival. ignoreDuplicates makes it safe.
            const subAsset: WorldAsset = {
              id:                  `location_${subId}`,
              category:            AssetCategory.LOCATION,
              name:                subName,
              constitution: {
                physical_description: narratorResponse.narrative_text.slice(0, 280),
                notes: `type=sub_location; parent_zone=${parentNode.zone_id}`,
              },
              significance:        "NOTABLE",
              first_seen_location: subId,
              session_id:          artSessionId,
              name_known:          true,
              created_at:          new Date().toISOString(),
            };
            void saveWorldAsset(artSessionId, subAsset).then(async () => {
              const refreshed = await getWorldAssetsForLocation(artSessionId, subId);
              useGameStore.getState().setLocationAssets(refreshed);
            });
            // Audit Issue M fix: persist the mutated graph immediately so a
            // hard reload doesn't lose the new sub_location node.
            if (updatedState.world_graph) {
              saveWorldGraphAsync(artSessionId, updatedState.world_graph);
            }
            console.log(`[GameLoop/7] ZONE_EXPAND created sub_location: ${subName} (${subId})`);
          }
        }

        // ── 7-C. WORLD_EXPLORE — stub gen + new zone node ───────────────────
        else if (moveType === "WORLD_EXPLORE" && updatedState.world_graph) {
          const graph    = updatedState.world_graph;
          const fromId   = String(resolution.narrative_context.from_node_id ?? graph.current_node_id);
          const fromNode = graph.nodes[fromId];

          if (!graph.nodes[newLocationId]) {
            const fallbackName = String(resolution.narrative_context.destination_hint ?? newLocationId)
              .replace(/^(the|a|an)\s+/i, "")
              .split(/\s+/)
              .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
              .join(" ");
            const newZoneNode: WorldNode = {
              id:            newLocationId,
              name:          fallbackName || newLocationId,
              type:          "zone",
              zone_id:       newLocationId,
              is_expandable: true,
              connections:   fromNode ? [fromId] : [],
              npc_ids:       [],
              item_ids:      [],
              asset_id:      `location_${newLocationId}`,
              discovered:    true,
              map_position: fromNode
                ? { x: fromNode.map_position.x + 1, y: fromNode.map_position.y }
                : { x: 0, y: 0 },
            };
            updatedState = {
              ...updatedState,
              world_graph: {
                ...graph,
                nodes: {
                  ...graph.nodes,
                  [newLocationId]: newZoneNode,
                  ...(fromNode
                    ? {
                        [fromId]: {
                          ...fromNode,
                          connections: fromNode.connections.includes(newLocationId)
                            ? fromNode.connections
                            : [...fromNode.connections, newLocationId],
                        },
                      }
                    : {}),
                },
                current_node_id: newLocationId,
              },
            };
          }

          // Run the existing stub generator — it'll fill in narrator-quality
          // structural facts and persist the world_asset.
          const liveAssets  = useGameStore.getState().locationAssets;
          const stubAssetId = `location_${newLocationId}`;
          const exists = liveAssets.find(
            (a) =>
              a.category === AssetCategory.LOCATION &&
              (a.id === stubAssetId || a.first_seen_location === newLocationId)
          );
          if (!exists) {
            void generateLocationStub(
              parsedAction.primary_target ?? newLocationId,
              state.world_state.current_location_id,
              state.metadata.world_seed,
              state.metadata.genre
            ).then(async (stub) => {
              const asset: WorldAsset = {
                id:                  `location_${stub.id}`,
                category:            AssetCategory.LOCATION,
                name:                stub.name,
                constitution: {
                  physical_description: stub.description,
                  ...(stub.faction_id ? { faction_affiliation: stub.faction_id } : {}),
                  notes: `type=${stub.type}`,
                },
                significance:        "NOTABLE",
                first_seen_location: stub.id,
                session_id:          artSessionId,
                name_known:          true,
                created_at:          new Date().toISOString(),
              };
              await saveWorldAsset(artSessionId, asset);
              const refreshed = await getWorldAssetsForLocation(artSessionId, newLocationId);
              useGameStore.getState().setLocationAssets(refreshed);

              // Issue L: the graph node was created earlier with a player-
              // derived fallback name; the stub generator just produced the
              // canonical name. Patch the node name (and category, since the
              // stub knows the location's type) so the graph and the
              // world_asset agree on one canonical identity.
              const liveMaster = useGameStore.getState().masterState;
              if (liveMaster?.world_graph) {
                const liveGraph = liveMaster.world_graph;
                const liveNode  = liveGraph.nodes[newLocationId];
                if (liveNode && (liveNode.name !== stub.name || liveNode.category !== stub.type)) {
                  useGameStore.getState().setMasterState({
                    ...liveMaster,
                    world_graph: {
                      ...liveGraph,
                      nodes: {
                        ...liveGraph.nodes,
                        [newLocationId]: {
                          ...liveNode,
                          name:     stub.name,
                          category: stub.type,
                        },
                      },
                    },
                  });
                  console.log(
                    `[GameLoop/7] WORLD_EXPLORE node renamed: ${liveNode.name} → ${stub.name} (category=${stub.type})`
                  );
                }
              }

              console.log(`[GameLoop/7] WORLD_EXPLORE stub saved: ${stub.name} (${stub.id})`);
            });
          }
        }

        // ── 7-D. Legacy MOVE_SUCCESS (no graph) ─────────────────────────────
        else {
          const liveAssets  = useGameStore.getState().locationAssets;
          const stubAssetId = `location_${newLocationId}`;
          const exists = liveAssets.find(
            (a) =>
              a.category === AssetCategory.LOCATION &&
              (a.id === stubAssetId || a.first_seen_location === newLocationId)
          );
          if (!exists) {
            console.log("[WorldGraph] No graph available, using legacy navigation");
            void generateLocationStub(
              parsedAction.primary_target ?? newLocationId,
              state.world_state.current_location_id,
              state.metadata.world_seed,
              state.metadata.genre
            ).then(async (stub) => {
              const asset: WorldAsset = {
                id:                  `location_${stub.id}`,
                category:            AssetCategory.LOCATION,
                name:                stub.name,
                constitution: {
                  physical_description: stub.description,
                  ...(stub.faction_id ? { faction_affiliation: stub.faction_id } : {}),
                  notes: `type=${stub.type}`,
                },
                significance:        "NOTABLE",
                first_seen_location: stub.id,
                session_id:          artSessionId,
                name_known:          true,
                created_at:          new Date().toISOString(),
              };
              await saveWorldAsset(artSessionId, asset);
              const refreshed = await getWorldAssetsForLocation(artSessionId, newLocationId);
              useGameStore.getState().setLocationAssets(refreshed);
              console.log(`[GameLoop/7] Location stub saved: ${stub.name} (${stub.id})`);
            });
          }
        }

        // Art generation removed — SceneArt now renders a genre-themed
        // placeholder for any location. No SVG fetch, no cache, no backfill.
      }

      // ── 7b. Process codex_entries — only NOTABLE/MAJOR are saved ──────────
      // Both saveCodexEntry and saveWorldAsset are fire-and-forget: they
      // upsert with ignoreDuplicates so first-introduction is law, and any
      // failures are logged inside the helpers without crashing the loop.
      const sessionId = updatedState.metadata.session_id;
      const currentLocationId = updatedState.world_state.current_location_id;
      for (const entry of narratorResponse.codex_entries) {
        if (entry.significance !== "NOTABLE" && entry.significance !== "MAJOR") continue;

        // Codex (player-facing encyclopedia row). FIX 6 — saveCodexEntry
        // now reports whether this was a genuinely new entry; only
        // surface the "✦ added to codex" notification when it was, so
        // the feed isn't spammed every time the narrator re-mentions an
        // already-saved character or location.
        try {
          void saveCodexEntry(sessionId, entry).then(({ created }) => {
            if (created) {
              store.addMessage(
                makeMessage("SYSTEM", `✦ ${entry.name} added to codex`)
              );
            }
          });
        } catch (err) {
          console.error("[useGameLoop] saveCodexEntry threw", err);
        }

        // World asset (immutable narrator constitution).
        const assetCategory: AssetCategory =
          (Object.values(AssetCategory) as string[]).includes(entry.category)
            ? (entry.category as AssetCategory)
            : AssetCategory.LORE;

        // Art generation removed — no svg_content backfill. Just save the
        // asset with its constitution and significance.
        if (
          assetCategory === AssetCategory.LOCATION &&
          resolution.state_delta.world_state?.location_status === LocationStatus.ARRIVING
        ) {
          console.log(`[GameLoop/7b] Saving LOCATION asset for ${currentLocationId} (session=${sessionId})`);
        }

        const asset: WorldAsset = {
          id:                  normalizeAssetId(assetCategory, entry.name),
          category:            assetCategory,
          name:                entry.name,
          constitution:        { notes: entry.description },
          significance:        entry.significance,
          first_seen_location: currentLocationId,
          session_id:          sessionId,
          created_at:          new Date().toISOString(),
          // CHARACTER assets default to name_known=false; all others are known.
          name_known:          assetCategory !== AssetCategory.CHARACTER,
        };
        try {
          void saveWorldAsset(sessionId, asset);
        } catch (err) {
          console.error("[useGameLoop] saveWorldAsset threw", err);
        }

        // Issue D: every CHARACTER asset whose first_seen_location is the
        // node we're at right now belongs in that node's npc_ids list. The
        // location guard, NPCS PRESENT block, and step 7g's filtering all
        // depend on this list staying authoritative.
        if (assetCategory === AssetCategory.CHARACTER) {
          updatedState = addNpcToCurrentNode(updatedState, asset.id);
        }

        if (entry.significance === "MAJOR") {
          updatedState = persistLogEntry(
            updatedState,
            LogEntryType.DISCOVERY,
            `New codex entry: ${entry.name} — ${entry.description}`
          );
        }
      }

      // ── 7b-2. Issues J + D + N ─────────────────────────────────────────────
      // Every NPC the narrator introduces via new_npcs becomes a first-class
      // world_asset (J), gets pushed into the current node's npc_ids (D),
      // and is committed BEFORE step 7d / 7g so the codex and reveal
      // lookups in those steps find a real matching asset (N).
      //
      // The new asset is also patched optimistically into the store's
      // locationAssets so the same-turn lookups don't have to wait for a
      // DB roundtrip. saveWorldAsset uses ignoreDuplicates so idempotent.
      if (narratorResponse.new_npcs.length > 0) {
        const merged                    = { ...updatedState.npc_registry };
        const optimisticAssets: WorldAsset[] = [];
        for (const npc of narratorResponse.new_npcs) {
          const standardKey = normalizeAssetId(AssetCategory.CHARACTER, npc.name);

          // Registry entry — same shape the old step 8 produced.
          merged[standardKey] = {
            ...npc,
            npc_key:         standardKey,
            trust_score:     typeof npc.trust_score === "number" ? npc.trust_score : 50,
            memory_snippets: Array.isArray(npc.memory_snippets) ? npc.memory_snippets : [],
          };

          // World asset — narrator-introduced NPCs always carry a real name,
          // so name_known starts true. Constitution carries the role; later
          // narrator codex_entries can extend the notes via ignoreDuplicates'd
          // upserts (first wins; subsequent calls no-op).
          const npcAsset: WorldAsset = {
            id:                  standardKey,
            category:            AssetCategory.CHARACTER,
            name:                npc.name,
            constitution: {
              role:  typeof npc.role === "string" ? npc.role : "",
              notes: `Introduced via narrator new_npcs at ${currentLocationId}.`,
            },
            significance:        "NOTABLE",
            first_seen_location: currentLocationId,
            session_id:          sessionId,
            created_at:          new Date().toISOString(),
            name_known:          true,
          };
          optimisticAssets.push(npcAsset);

          // Persist DB row — fire-and-forget, write-once.
          void saveWorldAsset(sessionId, npcAsset);

          // Push asset_id into the current graph node's npc_ids list.
          updatedState = addNpcToCurrentNode(updatedState, standardKey);
        }

        updatedState = { ...updatedState, npc_registry: merged };

        // Optimistic locationAssets patch so this turn's later steps see them.
        const liveAssets = useGameStore.getState().locationAssets;
        const liveIds    = new Set(liveAssets.map((a) => a.id));
        const additions  = optimisticAssets.filter((a) => !liveIds.has(a.id));
        if (additions.length > 0) {
          useGameStore.getState().setLocationAssets([...liveAssets, ...additions]);
        }

        // Audit Issue M fix: persist the mutated graph immediately so the
        // new NPC's npc_ids entry survives a hard reload before the next
        // 10-action auto-save.
        if (updatedState.world_graph) {
          saveWorldGraphAsync(sessionId, updatedState.world_graph);
        }
      }

      // ── 7c. After ARRIVING — refresh location assets for the next call ────
      // Fire-and-forget: when it lands, it populates the Zustand store so the
      // next narrator call sees ESTABLISHED WORLD ASSETS injected as fact.
      const arrivedAt =
        resolution.state_delta.world_state?.location_status === LocationStatus.ARRIVING
          ? resolution.state_delta.world_state.current_location_id ?? null
          : null;
      if (arrivedAt) {
        // Refresh the live cache so subsequent narrator beats see the
        // full Tier 1 / NPC roster.
        void getWorldAssetsForLocation(sessionId, arrivedAt).then((assets) => {
          useGameStore.getState().setLocationAssets(assets);
        });

        // ── 7c-1. Codex first-visit fallback ─────────────────────────────────
        // The codex entry for a location normally writes on first
        // DIALOGUE (step 7g) or first explicit EXAMINE. Both paths can
        // be skipped — a player who walks straight through still
        // hasn't catalogued it. Track visits here and, on every
        // ARRIVING, force the codex write so the location lands in
        // the encyclopedia even without NPC interaction. The
        // alreadyWritten gate keeps this idempotent — only the
        // first ARRIVING actually fires saveCodexEntry; subsequent
        // arrivals just bump the visit counter.
        const visitsKey = `codex_visits_${arrivedAt}`;
        const flagKey   = `codex_loc_${arrivedAt}`;
        const priorRaw  = updatedState.world_state.flags?.[visitsKey];
        const prior     = typeof priorRaw === "number" ? priorRaw : 0;
        const next      = prior + 1;
        const alreadyWritten = updatedState.world_state.flags?.[flagKey] === true;

        const flagsAfter: Record<string, boolean | number | string> = {
          ...updatedState.world_state.flags,
          [visitsKey]: next,
        };

        if (next >= 1 && !alreadyWritten) {
          const liveAssets = useGameStore.getState().locationAssets;
          const locationAsset = liveAssets.find(
            (a) =>
              a.category === AssetCategory.LOCATION &&
              (a.id === arrivedAt ||
               a.id === `location_${arrivedAt}` ||
               normalizeLocationId(a.first_seen_location ?? "") === arrivedAt)
          );
          if (locationAsset) {
            const lc = locationAsset.constitution;
            const description =
              (typeof lc.physical_description === "string" && lc.physical_description) ||
              (typeof lc.notes                === "string" && lc.notes) ||
              (typeof lc.atmosphere           === "string" && lc.atmosphere) ||
              "A location in the world.";
            void saveCodexEntry(sessionId, {
              id:                  locationAsset.id,
              category:            "LOCATION",
              name:                locationAsset.name,
              description,
              first_seen_location: arrivedAt,
              significance:        "NOTABLE",
            }).then(({ created }) => {
              if (created) {
                store.addMessage(
                  makeMessage("SYSTEM", `✦ ${locationAsset.name} added to codex`)
                );
              }
            });
            flagsAfter[flagKey] = true;
            console.log(
              "[GameLoop/7c-1] Location codex entry written via first-visit fallback:",
              locationAsset.name
            );
          }
        }

        updatedState = {
          ...updatedState,
          world_state: { ...updatedState.world_state, flags: flagsAfter },
        };
      } else {
        // Late-load fallback: if locationAssets is still empty at this point,
        // page.tsx's seed must have failed (network error, race, hard reload
        // restored masterState before the seed completed). Try once now so
        // subsequent narrator calls aren't blind.
        const liveAssets = useGameStore.getState().locationAssets;
        if (liveAssets.length === 0 && currentLocationId) {
          void getWorldAssetsForLocation(sessionId, currentLocationId).then((assets) => {
            if (assets.length > 0) {
              console.log("[GameLoop/7c] Late locationAssets load:", assets.length);
              useGameStore.getState().setLocationAssets(assets);
            }
          });
        }
      }

      // ── 7d. (REMOVED in Day 19E) NPC reveal pipeline ─────────────────────────
      // All NPCs now have real names from birth (WorldBible / RegionBible).
      // The narrator no longer emits revealed_npc_names; the asset's name is
      // its display name from the moment it's written. Codex / dialogue UI
      // read the name directly from locationAssets and never need a "reveal".

      // ── 7e. Trust changes from dialogue ──────────────────────────────────────
      // Resolve narrator-provided npc_key against whatever scheme the registry
      // is actually using (snake_case, asset-id, or name match). Seed a default
      // entry first if missing so the delta isn't silently dropped — common
      // when the NPC was introduced via codex_entries without going through
      // new_npcs.
      if (narratorResponse.trust_changes && narratorResponse.trust_changes.length > 0) {
        for (const tc of narratorResponse.trust_changes) {
          const found = findNpcInRegistry(updatedState.npc_registry, tc.npc_key);
          const key   = found?.key ?? tc.npc_key;
          if (!found) {
            const matchingAsset = useGameStore.getState().locationAssets.find(
              (a) =>
                a.category === AssetCategory.CHARACTER &&
                (a.id === key || a.name.toLowerCase() === tc.npc_key.toLowerCase())
            );
            updatedState = seedNpcRegistry(
              updatedState,
              key,
              matchingAsset?.name ?? tc.npc_key,
              matchingAsset?.constitution.role
            );
          }
          updatedState = updateNPCTrust(updatedState, key, tc.delta);
        }
      }

      // 7f removed — NPC portrait generation is gone. The Dialogue Modal
      // shows a silhouette placeholder when no portrait is set.

      // ── 7g. Dialogue options — store for the Dialogue Modal ──────────────────
      // Show after every DIALOGUE action; clear after any non-DIALOGUE action.
      // Preserve the existing NPC name + portrait across consecutive turns with
      // the same NPC so the modal doesn't flash blank between turns.
      {
        const dialogueOpts = narratorResponse.dialogue_options ?? [];
        if (isDialogueAction && dialogueOpts.length > 0) {
          const newNpcName       = parsedAction.primary_target ?? null;
          const gsBefore         = useGameStore.getState();
          const existingNpc      = gsBefore.currentDialogueNpc;
          const existingPortrait = gsBefore.currentNpcPortrait;

          // FIX 1: When the player clicks a dialogue option, the Intent Parser
          // sees only the option's speech text and sets primary_target to null
          // (it's classifying speech, not extracting "talk to X"). Fall back to
          // the NPC we were already conversing with so the modal stays anchored
          // to the same character across consecutive option clicks.
          const effectiveNpcName =
            newNpcName ??
            (isDialogueAction && existingNpc ? existingNpc : null);

          // "Continuing" means: same NPC as last turn (case-insensitive match).
          // When the player addresses a different NPC, we always swap.
          const continuingSameNpc =
            !!existingNpc &&
            !!effectiveNpcName &&
            existingNpc.toLowerCase() === effectiveNpcName.toLowerCase();

          // FIX (UX 4) — switching to a different NPC invalidates any
          // cached items_for_sale from the previous merchant. If we
          // don't clear here, the trade button would briefly show with
          // the old merchant's wares while the player is talking to
          // someone unrelated. Run BEFORE setDialogueOptions so the
          // store dispatches arrive in a single render pass.
          if (!continuingSameNpc && gsBefore.currentTradeItems.length > 0) {
            console.log(
              "[GameLoop/7g] NPC switch detected — clearing prior items_for_sale"
            );
            gsBefore.setTradeItems([]);
          }

          // Resolve the NPC asset for portrait fallback.
          const currentAssets = gsBefore.locationAssets;
          const npcAsset = effectiveNpcName
            ? currentAssets.find(
                (a) =>
                  a.category === AssetCategory.CHARACTER &&
                  a.name.toLowerCase() === effectiveNpcName.toLowerCase()
              ) ?? null
            : null;

          // Day 19E: reveal pipeline removed — NPCs have real names from
          // birth, so the effective name is always the asset's current name
          // (with same-NPC continuation falling back to the stored existing).
          const npcName = continuingSameNpc ? existingNpc : effectiveNpcName;
          // Portrait lookup is null after the art system removal — the modal
          // shows a silhouette placeholder. Preserved across consecutive
          // same-NPC turns purely so the existingPortrait wiring stays
          // future-proof if a new portrait pipeline is added later.
          const portrait =
            continuingSameNpc && existingPortrait
              ? existingPortrait
              : null;

          // currentDialogueNpcKey MUST always be the FULL canonical
          // asset-id form ("character_<slug>"). Audit Issue Q fix: prefer
          // the actual stored asset.id whenever a CHARACTER asset matches
          // by name — re-deriving the slug via normalizeAssetId can drift
          // from the WorldBible's NPCDefinition.id (e.g. when the AI used
          // unusual punctuation in the original id). Re-derivation stays
          // as the fallback for genuinely new NPCs without an asset yet.
          const matchByName = effectiveNpcName
            ? gsBefore.locationAssets.find(
                (a) =>
                  a.category === AssetCategory.CHARACTER &&
                  a.name.toLowerCase() === effectiveNpcName.toLowerCase()
              )
            : null;
          const npcRegistryKey: string | null = matchByName?.id
            ?? (effectiveNpcName
              ? normalizeAssetId(AssetCategory.CHARACTER, effectiveNpcName)
              : null);

          // Seed a neutral entry when no variant of this key exists in the
          // registry yet. findNpcInRegistry covers all historical schemes
          // (raw, snake_case, prefixed, unprefixed) so we don't accidentally
          // create a duplicate next to a legacy record.
          if (
            npcRegistryKey &&
            npcName &&
            !findNpcInRegistry(updatedState.npc_registry, npcRegistryKey)
          ) {
            const matchingAsset = gsBefore.locationAssets.find(
              (a) =>
                a.category === AssetCategory.CHARACTER &&
                (a.id === npcRegistryKey || a.name.toLowerCase() === npcName.toLowerCase())
            );
            updatedState = seedNpcRegistry(
              updatedState,
              npcRegistryKey,
              npcName,
              matchingAsset?.constitution.role
            );
            console.log(`[GameLoop/7g] Seeded npc_registry entry for ${npcName} → ${npcRegistryKey}`);

            // FIX 2: patch the live store IMMEDIATELY so the next action's
            // resolveDialogue (which reads state from the store BEFORE step 10
            // commits updatedState) sees the seeded entry. Without this, the
            // resolver would log "NPC not in registry" on every consecutive
            // dialogue beat against this same character.
            const currentMaster = useGameStore.getState().masterState;
            if (currentMaster) {
              useGameStore.getState().setMasterState({
                ...currentMaster,
                npc_registry: updatedState.npc_registry,
              });
            }

            // Day 17 — codex populates on encounter. First dialogue with this
            // NPC writes the codex entry from the world_asset's constitution.
            // ignoreDuplicates makes this idempotent — runs only when the
            // registry seed runs (i.e. truly the first beat with this NPC).
            //
            // FIX 2: pre-seeded NPCs may have first_seen_location pointing
            // somewhere the current locationAssets snapshot doesn't include
            // by direct name match. Broaden the lookup to also match on
            // normalizeAssetId(asset.name) === npcRegistryKey so seed NPCs
            // are reliably found even when their name slug differs slightly
            // from what the player typed.
            const liveAssets = useGameStore.getState().locationAssets;
            // Audit Issue H fix: add a fourth fallback that uses the
            // current graph node's npc_ids when none of the name-based
            // lookups matched. WorldBible NPCs with placeholder targets
            // (Issue G symptom) reach this path with an effectiveNpcName
            // that doesn't match any stored asset; the npc_ids list is
            // the authoritative roster for the current node.
            const currentGraphNode =
              updatedState.world_graph?.nodes[updatedState.world_graph.current_node_id] ?? null;
            const nodeNpcAsset =
              (currentGraphNode?.npc_ids ?? [])
                .map((id) =>
                  liveAssets.find(
                    (a) => a.id === id && a.category === AssetCategory.CHARACTER
                  )
                )
                .find((a): a is WorldAsset => !!a) ?? null;

            // FIX 4 — codex lookup chain. The asset stored by
            // apply-world-bible always has id "character_<slug>", but the
            // registry key derived at dialogue time may be the bare slug
            // (without prefix) when the WorldBible NPC's name normalizes
            // to a different form than the canonical id. Try every
            // sensible id permutation BEFORE falling back to name / node
            // npc_ids so the codex write succeeds on the first plausible
            // hit instead of getting silently skipped.
            const keyWithoutPrefix = npcRegistryKey
              ? npcRegistryKey.replace(/^character_/, "")
              : null;
            const keyWithPrefix = npcRegistryKey
              ? (npcRegistryKey.startsWith("character_")
                  ? npcRegistryKey
                  : `character_${npcRegistryKey}`)
              : null;

            const npcCodexAsset =
              // 1. Exact id match against the registry key.
              liveAssets.find(
                (a) =>
                  a.category === AssetCategory.CHARACTER &&
                  npcRegistryKey !== null &&
                  a.id === npcRegistryKey
              )
              // 2. character_-prefixed id (registry key was a bare slug).
              ?? liveAssets.find(
                (a) =>
                  a.category === AssetCategory.CHARACTER &&
                  keyWithPrefix !== null &&
                  a.id === keyWithPrefix
              )
              // 3. Unprefixed id (registry key was already prefixed but the
              // asset row stored the bare slug — older saves).
              ?? liveAssets.find(
                (a) =>
                  a.category === AssetCategory.CHARACTER &&
                  keyWithoutPrefix !== null &&
                  a.id === keyWithoutPrefix
              )
              // 4. Name match (existing) — covers stubs and most NPCs whose
              // asset.id and asset.name normalize to the same slug.
              ?? liveAssets.find(
                (a) =>
                  a.category === AssetCategory.CHARACTER &&
                  effectiveNpcName !== null &&
                  a.name.toLowerCase() === effectiveNpcName.toLowerCase()
              )
              // 5. Asset-name normalized to npcRegistryKey — catches
              // assets whose display name differs slightly from the
              // referenced name (e.g. honorific mismatches).
              ?? liveAssets.find(
                (a) =>
                  a.category === AssetCategory.CHARACTER &&
                  normalizeAssetId(AssetCategory.CHARACTER, a.name) === npcRegistryKey
              )
              // 6. matchingAsset (resolved earlier in the seed block).
              ?? matchingAsset
              // 7. currentNode.npc_ids fallback — pick the first CHARACTER
              // from the live roster. Only correct when the player's
              // descriptor (parsed by the AI as primary_target) couldn't
              // be matched any other way.
              ?? nodeNpcAsset;

            if (npcCodexAsset) {
              const c = npcCodexAsset.constitution;
              const description = [
                typeof c.role        === "string" ? c.role        : "",
                typeof c.personality === "string" ? c.personality : "",
                typeof c.notes       === "string" ? c.notes       : "",
              ]
                .map((s) => s.trim())
                .filter(Boolean)
                .join(" ");
              // FIX 6 — only emit the SYSTEM beat when the row was
              // genuinely new. saveCodexEntry's `created` flag detects
              // pre-existing entries up front so re-prompts on the
              // same NPC don't spam the feed.
              void saveCodexEntry(sessionId, {
                id:                  npcCodexAsset.id,
                category:            "CHARACTER",
                name:                npcCodexAsset.name,
                description:         description || "A character encountered in the world.",
                first_seen_location: updatedState.world_state.current_location_id,
                significance:        "NOTABLE",
              }).then(({ created }) => {
                if (created) {
                  store.addMessage(
                    makeMessage("SYSTEM", `✦ ${npcCodexAsset.name} added to codex`)
                  );
                }
              });
              console.log("[GameLoop/7g] Codex entry written for NPC:", npcCodexAsset.name);

              // FIX 7 — when an NPC codex entry is written for the first
              // time, also write the current location's codex entry if
              // it hasn't been recorded yet. This is now the only path
              // (alongside narrator-emitted codex_entries in step 7b)
              // through which a location enters the codex — pure
              // navigation no longer counts. Gated by a world_state
              // flag so meeting a 2nd NPC at the same location doesn't
              // re-emit the codex notification.
              const locId    = updatedState.world_state.current_location_id;
              const flagKey  = `codex_loc_${locId}`;
              const alreadyWritten =
                updatedState.world_state.flags?.[flagKey] === true;
              if (!alreadyWritten) {
                const liveAssetsForLoc = useGameStore.getState().locationAssets;
                const locationAsset = liveAssetsForLoc.find(
                  (a) =>
                    a.category === AssetCategory.LOCATION &&
                    (a.id === locId ||
                     a.id === `location_${locId}` ||
                     normalizeLocationId(a.first_seen_location ?? "") === locId)
                );
                if (locationAsset) {
                  const lc = locationAsset.constitution;
                  const locDescription =
                    (typeof lc.physical_description === "string" && lc.physical_description) ||
                    (typeof lc.notes                === "string" && lc.notes) ||
                    (typeof lc.atmosphere           === "string" && lc.atmosphere) ||
                    "A location in the world.";
                  // FIX 6 — same dedup as the NPC codex above. The
                  // codex_loc_<id> flag already gates this branch on
                  // first NPC interaction at the location, but we
                  // still want the feed beat suppressed if the row
                  // existed for any reason (e.g. narrator emitted it
                  // earlier in step 7b).
                  void saveCodexEntry(sessionId, {
                    id:                  locationAsset.id,
                    category:            "LOCATION",
                    name:                locationAsset.name,
                    description:         locDescription,
                    first_seen_location: locId,
                    significance:        "NOTABLE",
                  }).then(({ created }) => {
                    if (created) {
                      store.addMessage(
                        makeMessage("SYSTEM", `✦ ${locationAsset.name} added to codex`)
                      );
                    }
                  });
                  updatedState = {
                    ...updatedState,
                    world_state: {
                      ...updatedState.world_state,
                      flags: { ...updatedState.world_state.flags, [flagKey]: true },
                    },
                  };
                  console.log(
                    "[GameLoop/7g] Location codex entry written via NPC interaction:",
                    locationAsset.name
                  );
                }
              }
            } else {
              console.log(
                "[GameLoop/7g] No world_asset found for NPC:",
                effectiveNpcName,
                "— codex entry skipped"
              );
            }
          }

          store.setDialogueOptions(dialogueOpts, npcName, portrait, npcRegistryKey);
          // Verification log — confirms the canonical key actually reaches
          // the store. After this lands, currentDialogueNpcKey should be the
          // "character_<slug>" form matching the narrator's asset_id, so
          // step 7d's two-channel match resolves on identity reveals.
          console.log(
            "[GameLoop/7g] setDialogueOptions called with npcKey:",
            effectiveNpcName
              ? normalizeAssetId(AssetCategory.CHARACTER, effectiveNpcName)
              : null
          );
        } else if (!isDialogueAction) {
          // SMALL FIX 1: covers EVERY non-DIALOGUE action. MOVE, ATTACK,
          // EXAMINE, INTERACT, USE_ITEM, CUSTOM (e.g. "I leave and find
          // someone else") all set isDialogueAction=false → modal clears.
          // The player walking away ends the conversation, as it should.
          store.clearDialogueOptions();
        }
      }

      // ── 7h. Day 16 — TRADE: items_for_sale → Trade Modal ────────────────────
      // The narrator emits items_for_sale when resolveInteract flagged
      // trade_available. Push them into the store so the Trade Modal opens.
      // Subsequent non-trade actions don't auto-clear — the player closes the
      // modal explicitly so they can browse over multiple turns.
      if (narratorResponse.items_for_sale && narratorResponse.items_for_sale.length > 0) {
        store.setTradeItems(narratorResponse.items_for_sale);
        console.log(
          "[GameLoop/7h] items_for_sale received:",
          narratorResponse.items_for_sale.length
        );
      }

      // ── 8. Merge new NPCs into registry ────────────────────────────────────
      // 8b. Add any items the narrator granted — guarded against management actions.
      const isLoreAction =
        parsedAction.action_type === ActionType.USE_ITEM &&
        (() => {
          const lookup = (parsedAction.item_used ?? parsedAction.primary_target ?? "").trim().toLowerCase();
          const item = updatedState.player_state.inventory.find(
            (i) => i.id === lookup || i.name.toLowerCase() === lookup
          );
          return item?.type === ItemType.LORE;
        })();
      const isMgmtIntent = /\b(equip|unequip|drop|read)\b/i.test(parsedAction.inferred_intent);

      if (
        !isLoreAction &&
        !isMgmtIntent &&
        narratorResponse.items_acquired &&
        narratorResponse.items_acquired.length > 0
      ) {
        for (const item of narratorResponse.items_acquired) {
          updatedState = addToInventory(updatedState, item);
          store.addMessage(
            makeMessage(
              "SYSTEM",
              `[ ${item.rarity} item added to pack: ${item.name} ]`
            )
          );
          // DISCOVERY log entry per item acquired.
          const rarityLabel = RARITY_LABELS[item.rarity] ?? item.rarity;
          updatedState = persistLogEntry(
            updatedState,
            LogEntryType.DISCOVERY,
            `Found: ${item.name} (${rarityLabel})`
          );
        }
      }

      // (new_npcs handling moved to step 7b-2 — Issues J + D + N.)

      // ── 9. Append a structured log entry for this beat ────────────────────
      // Extract first sentence (up to 120 chars) as fallback for log content.
      const firstSentence =
        (narratorResponse.narrative_text.match(/^[^.!?]*[.!?]/) ?? [])[0]?.trim() ??
        narratorResponse.narrative_text.slice(0, 120);

      if (resolution.outcome_type.startsWith("ATTACK")) {
        // COMBAT entry: compact roll+outcome format.
        const ctx2      = resolution.narrative_context;
        const roll2     = typeof ctx2.roll      === "number" ? ctx2.roll      : null;
        const mod2      = typeof ctx2.modifier  === "number" ? ctx2.modifier  : 0;
        const total2    = typeof ctx2.total     === "number" ? ctx2.total     : (roll2 ?? 0) + mod2;
        const diff2     = typeof ctx2.difficulty === "number" ? ctx2.difficulty : null;
        const damage2   = typeof ctx2.damage    === "number" ? ctx2.damage    : 0;
        const sign2     = mod2 >= 0 ? `+${mod2}` : `${mod2}`;
        const diffStr2  = diff2 !== null ? ` vs ${diff2}` : "";
        const label2    = ctx2.critical_hit  ? "Crit!"  :
                          ctx2.critical_miss ? "Miss!"  :
                          resolution.success ? "Hit!"   : "Miss!";
        const dmgStr2   = damage2 > 0 ? ` (${damage2} dmg)` : "";
        updatedState = persistLogEntry(updatedState, LogEntryType.COMBAT,
          `Attack: ${roll2}${sign2}=${total2}${diffStr2} — ${label2}${dmgStr2}`);
      } else if (parsedAction.action_type === ActionType.DIALOGUE) {
        // DIALOGUE entry priority: log_summary → last quoted speech → first
        // sentence. The first quote in narrator prose is usually atmospheric
        // (e.g. "Oh, this?"); the LAST quote is typically the meaningful NPC
        // line that should land in the log book.
        const npcLabel  = parsedAction.primary_target ? `${parsedAction.primary_target}: ` : "";
        // Array.from instead of [...] — the project's tsconfig doesn't enable
        // downlevelIteration so iterator spread on matchAll() won't compile.
        const allQuotes = Array.from(narratorResponse.narrative_text.matchAll(/"([^"]*)"/g));
        const lastQuote = allQuotes.length > 0
          ? allQuotes[allQuotes.length - 1][1].trim()
          : null;
        const quotedText = narratorResponse.log_summary
          ?? lastQuote
          ?? firstSentence;
        updatedState = persistLogEntry(updatedState, LogEntryType.DIALOGUE, `${npcLabel}${quotedText}`);
      } else {
        // STORY entry: use narrator's log_summary when present, else first sentence.
        const storyContent = narratorResponse.log_summary ?? firstSentence;
        updatedState = persistLogEntry(updatedState, LogEntryType.STORY, storyContent);
      }

      // ── 9b. Capture recent feed messages for session restoration ─────────────
      // Grab the last 8 NARRATIVE/DIALOGUE messages from the live feed and store
      // them in log_book.recent_messages so they can be restored on page reload.
      {
        const allMsgs = useGameStore.getState().messages;
        const narrativeMsgs = allMsgs.filter(
          (m) => m.type === "NARRATIVE" || m.type === "DIALOGUE"
        );
        const recent: StoredMessage[] = narrativeMsgs
          .slice(-8)
          .map((m) => ({
            id:        m.id,
            type:      m.type as "NARRATIVE" | "DIALOGUE",
            content:   m.content,
            timestamp: m.timestamp instanceof Date ? m.timestamp.toISOString() : String(m.timestamp),
            metadata:  m.metadata,
          }));
        // Audit Issue I fix: make the cap explicit in the log so
        // "recent_messages: 8" no longer reads like a stuck counter.
        // The 8-message window is the designed restoration replay.
        console.log(
          `[GameLoop/9b] recent_messages window (last 8 of ${narrativeMsgs.length}): ${recent.length}`
        );
        updatedState = {
          ...updatedState,
          log_book: { ...updatedState.log_book, recent_messages: recent },
        };
      }

      // Fire-and-forget: persist world_state immediately after MOVE or any
      // action that mutated world flags (locked doors, discovered secrets, etc.).
      // Prevents current_location_id and flag changes from being lost on reload.
      {
        const wsKeys = Object.keys(resolution.state_delta?.world_state ?? {});
        if (wsKeys.some((k) => k !== "location_status")) {
          saveWorldStateAsync(updatedState.metadata.session_id, updatedState.world_state);
        }
      }

      // Fire-and-forget: persist the full log_book (entries + recent_messages)
      // immediately after every narrative action so both survive a hard refresh
      // without waiting for the 10-action auto-save.
      saveLogEntriesAsync(updatedState.metadata.session_id, updatedState.log_book);

      // Bump last_played so the session sorts correctly on reload.
      updatedState = {
        ...updatedState,
        metadata: { ...updatedState.metadata, last_played: new Date().toISOString() },
      };

      // ── 10. Commit local state; auto-save every 10 narrative actions ───────
      store.setMasterState(updatedState);
      autoSaveActionCount++;
      if (autoSaveActionCount % AUTO_SAVE_INTERVAL === 0) {
        await persistState(updatedState, store.addMessage);
      }
    } catch (err) {
      // Catch-all for unexpected errors — never crash the UI.
      console.error("Game loop error:", err);
      store.addMessage(
        makeMessage("SYSTEM", "Something went wrong. Please try again.")
      );
    } finally {
      store.setProcessing(false);
    }
  }, []);

  // ── Day 16 — Trade actions ─────────────────────────────────────────────────
  // Buy / sell are dispatched from the TradeModal. They mutate masterState and
  // currentTradeItems directly via the store, log a DISCOVERY entry, and
  // fire-and-forget the world-state persist. They never go through the
  // narrator — pure mechanical commerce.

  const buyItem = useCallback((item: Item) => {
    const gs = useGameStore.getState();
    const state = gs.masterState;
    if (!state) return;

    const currencyKey = GENRE_CURRENCY_KEY[state.metadata.genre];
    if (!currencyKey) {
      gs.addMessage(makeMessage("SYSTEM", "This genre does not use currency."));
      return;
    }
    const balance = state.player_state.resources[currencyKey] ?? 0;
    const cost    = typeof item.value === "number" ? item.value : 0;
    if (balance < cost) {
      gs.addMessage(makeMessage("SYSTEM", `You can't afford ${item.name} (need ${cost}, have ${balance}).`));
      return;
    }

    // Add a single copy with quantity 1 (merchant offer is per-item).
    const purchased: Item = { ...item, quantity: 1, equipped: false };
    let next = addToInventory(state, purchased);
    next = {
      ...next,
      player_state: {
        ...next.player_state,
        resources: { ...next.player_state.resources, [currencyKey]: balance - cost },
      },
    };
    next = persistLogEntry(next, LogEntryType.DISCOVERY, `Bought: ${item.name} (${cost})`);

    gs.setMasterState(next);
    gs.setTradeItems(gs.currentTradeItems.filter((i) => i.id !== item.id));
    gs.addMessage(makeMessage("SYSTEM", `[ Bought: ${item.name} for ${cost} ]`));
  }, []);

  const sellItem = useCallback((item: Item) => {
    const gs = useGameStore.getState();
    const state = gs.masterState;
    if (!state) return;

    const currencyKey = GENRE_CURRENCY_KEY[state.metadata.genre];
    if (!currencyKey) {
      gs.addMessage(makeMessage("SYSTEM", "This genre does not use currency."));
      return;
    }

    const owned = state.player_state.inventory.find((i) => i.id === item.id);
    if (!owned) return;

    const sellPrice = Math.max(1, Math.floor(((item.value ?? 0)) * 0.5));
    let next        = removeFromInventory(state, item.id, 1);
    const balance   = next.player_state.resources[currencyKey] ?? 0;
    next = {
      ...next,
      player_state: {
        ...next.player_state,
        resources: { ...next.player_state.resources, [currencyKey]: balance + sellPrice },
      },
    };
    next = persistLogEntry(next, LogEntryType.DISCOVERY, `Sold: ${item.name} for ${sellPrice}`);

    gs.setMasterState(next);
    gs.addMessage(makeMessage("SYSTEM", `[ Sold: ${item.name} for ${sellPrice} ]`));
  }, []);

  /**
   * Navigation redesign — direct, UI-driven movement.
   *
   * The text-input pipeline never produces a real MOVE action anymore
   * (see step 2d's MOVE intercept). Movement is dispatched here:
   *   - NavigationBar card taps → navigateTo(nodeId)
   *   - WorldMap clicks         → navigateTo(nodeId)
   *   - LOCATION highlight clicks → navigateTo(nodeId) (when nodeId known)
   *
   * Behaviour:
   *   1. Validates nodeId against the live world_graph OR the world
   *      bible's adjacent_regions outline list.
   *   2. Routes through submitAction with `forceMoveToNode: nodeId` —
   *      submitAction skips parseIntent / MOVE intercept and feeds a
   *      synthetic MOVE ParsedAction into resolveAction. Whether the
   *      destination is a known graph connection or an undiscovered
   *      adjacent region, classifyMove + resolveMove pick the right
   *      branch (GRAPH_NAVIGATE vs WORLD_EXPLORE → step 4d Region
   *      expansion) downstream.
   */
  const navigateTo = useCallback((nodeId: string) => {
    const gs    = useGameStore.getState();
    const state = gs.masterState;
    if (!state) return;

    // Bug 5 — defense-in-depth no-op for re-navigation to the current
    // node. WorldMap and NavigationBar should already filter this, but
    // a stray click handler shouldn't be able to fire a second ARRIVING
    // beat for the player's existing location.
    const currentNodeId = state.world_graph?.current_node_id;
    if (nodeId === currentNodeId) {
      console.log("[navigateTo] no-op: already at", nodeId);
      return;
    }

    // Fix 3 — close any open dialogue or trade modal before leaving the
    // location. Modals belong to the location the player is leaving;
    // carrying them across navigation produces stale partner refs and
    // a merchant inventory that doesn't belong to the new place.
    gs.clearDialogueOptions();
    gs.setTradeItems([]);

    const graph = state.world_graph;
    const node  = graph?.nodes[nodeId];
    const adjacentOutline = state.metadata.world_bible?.adjacent_regions?.find(
      (r) => r.id === nodeId
    );

    if (!node && !adjacentOutline) {
      console.warn("[navigateTo] node id not found in graph or adjacent_regions:", nodeId);
      return;
    }

    // FIX 7 — log when navigating to an undiscovered adjacent region so
    // we can verify RegionBible expansion fires in the game loop (step 4d).
    const isUndiscoveredRegion =
      !!adjacentOutline || (node?.is_expandable === true && !node?.discovered);
    if (isUndiscoveredRegion) {
      console.log(
        "[navigateTo] adjacent region detected:", nodeId,
        "triggering RegionBible expansion"
      );
    }

    void submitAction("", { forceMoveToNode: nodeId });
  }, [submitAction]);

  /**
   * FIX (UX 4) — open trade with the named merchant WITHOUT routing
   * through the intent parser or resolveDialogue. Trade is always
   * available for merchants — trust affects price, not access — so a
   * stat check on the trade button is wrong by design.
   *
   * Flow:
   *   1. Open the trade panel immediately so the player gets visual
   *      feedback while we fetch items.
   *   2. If items_for_sale is already populated, we're done.
   *   3. Otherwise synthesize an INTERACT/trade_available resolution
   *      and call narrateAction directly. Items returned in the
   *      narrator's items_for_sale flow into setTradeItems and the
   *      panel populates without ever firing a stat check.
   */
  const openTrade = useCallback(async (npcName: string) => {
    const gs    = useGameStore.getState();
    const state = gs.masterState;
    if (!state) return;

    gs.openTradePanel();

    if (gs.currentTradeItems.length > 0) {
      // Already populated — panel just re-opens with existing wares.
      return;
    }

    gs.setProcessing(true, `Trading with ${npcName}...`);
    try {
      const tradeAction: ParsedAction = {
        action_type:     ActionType.INTERACT,
        primary_target:  npcName,
        inferred_intent: `open trade with ${npcName}`,
        confidence:      1,
      };
      const tradeResolution: ResolutionResult = {
        success:      true,
        outcome_type: "INTERACT_SUCCESS",
        state_delta:  {},
        narrative_context: {
          target:           npcName,
          trade_available:  true,
          object_confirmed: true,
          object_name:      npcName,
          object_exists_message:
            "This is a merchant. Trade is open. Populate items_for_sale.",
        },
      };
      const verbosity = gs.verbosity;
      const liveAssets = gs.locationAssets;
      const wcd        = state.metadata.world_consistency;
      const lastNarrative = gs.lastNarrativeText;

      const response = await narrateAction(
        tradeResolution,
        state,
        lastNarrative,
        tradeAction,
        liveAssets,
        verbosity,
        wcd,
      );

      if (response.items_for_sale && response.items_for_sale.length > 0) {
        gs.setTradeItems(response.items_for_sale);
        console.log(
          "[openTrade] items_for_sale received:",
          response.items_for_sale.length
        );
      } else {
        console.warn(
          "[openTrade] narrator returned no items_for_sale — trade panel stays empty."
        );
      }
    } catch (err) {
      console.warn("[openTrade] narrator call failed:", err);
    } finally {
      gs.setProcessing(false);
    }
  }, []);

  return {
    submitAction,
    navigateTo,
    isProcessing,
    processingStep,
    messages,
    masterState,
    buyItem,
    sellItem,
    openTrade,
  };
}
