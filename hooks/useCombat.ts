"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useGameStore, makeMessage } from "@/lib/stores/game-store";
import { LocationStatus } from "@/types/game";
import type {
  CombatEvent, CombatState, FloorLootEntry, MasterState, PlayerState,
} from "@/types/game";
import {
  executePlayerAction as engineExecute,
  kickoffCombatIfEnemyFirst,
  PLAYER_ID,
  type CombatResolutionPayload,
  type PlayerActionInput,
} from "@/lib/game/combat-engine";
import {
  renderCritBanner,
  renderResolutionBanner,
  renderRoutineCombatEvent,
} from "@/lib/game/combat-narration/templates";
import type { FloatingDamageEntry } from "@/components/game/CombatMode/CombatantRow";
import { makeFloatingEntry } from "@/components/game/CombatMode/CombatMode";
import { toast } from "@/lib/game/toasts";

/**
 * Day 20 Combat — React hook layer.
 *
 * Wraps the pure combat-engine functions with game-store mutations.
 * The UI in Prompt 3 will call these hooks; for Prompt 2 they're
 * exercised by tests + the dev console.
 *
 * Also exposes `window.__forceEncounter(...ids)` in development mode
 * — sets a one-shot encounter override that the game loop's
 * encounter trigger reads on the next arrival. The helper registers
 * at module-load time (below) so it's available even before any
 * combat UI mounts; useGameLoop.ts imports `consumeForcedEncounter`
 * from this file, which triggers the module load on game start.
 */

// Module-level dev override slot. Read once and consumed by the
// encounter trigger in useGameLoop (or any other consumer).
let _forcedEncounterRoster: string[] | null = null;

/** Read + clear the dev-mode forced roster. Returns null when none queued. */
export function consumeForcedEncounter(): string[] | null {
  const v = _forcedEncounterRoster;
  _forcedEncounterRoster = null;
  return v;
}

/** Programmatic setter — mostly used by the window helper below. */
export function setForcedEncounter(ids: string[]): void {
  _forcedEncounterRoster = ids;
}

// ── Dev-only browser console helper ─────────────────────────────────────────
// Calling __forceEncounter from the browser console queues a roster;
// the next arrival's encounter trigger (useGameLoop step 7c-3) consumes
// it and starts combat with exactly those enemies, ignoring
// encounter_chance / weighted count. Gated on NODE_ENV="development"
// so production bundles never expose it.
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).__forceEncounter = (...enemyIds: string[]) => {
    _forcedEncounterRoster = enemyIds.length > 0 ? enemyIds : null;
    // eslint-disable-next-line no-console
    console.log(
      `[Combat] __forceEncounter armed: next arrival spawns [${enemyIds.join(", ")}].`
    );
  };
}

/**
 * Events whose outcomes get LLM-narrated prose. Everything else
 * uses the templated pool in lib/game/combat-narration/templates.
 * Spec §10 + Prompt 3 locked decision.
 *
 * Day 20.1 — combat_start dropped from this set; it now renders
 * via the templated encounter banner (templates.ts) for clarity
 * over flavor at the moment of "what's happening?".
 *
 * HF1 FIX 1 — crits dropped from this set. Rule 54's two-line crit
 * (templated banner + LLM prose) is reversed: a crit now renders ONLY
 * the templated banner line + roll-detail suffix — no narrate-combat
 * call, no prose paragraph.
 *
 * Exported for the hotfix regression test (combat-crit-no-llm).
 */
export function isDramaticEvent(ev: CombatEvent): boolean {
  if (ev.type === "victory")       return true;
  if (ev.type === "defeat")        return true;
  if (ev.type === "flee_success")  return true;
  if (ev.outcome === "kill")       return true;
  // HF1 FIX 1 — crit is no longer dramatic (banner-only, no LLM).
  // combat_start, round_start, player_turn_start, enemy_phase_start:
  // all templated, no LLM call.
  return false;
}

/** Pacing delay between turn-phase transitions (Day 20.1 TASK 4). */
const ENEMY_PHASE_DELAY_MS = 800;
const PLAYER_TURN_DELAY_MS = 800;
/** Pacing between successive enemy turns (one enemy resolves, brief
 *  pause, next enemy resolves). */
const ENEMY_TURN_GAP_MS    = 500;

/** Day 20.4.2 TASK 2 — minimum spacing (ms) between successive floats
 *  on the same host. If a new float arrives sooner, we stagger it so
 *  the visible animation start is at least this far past the prior. */
const FLOAT_MIN_SPACING_MS = 300;
/** Day 20.4.2 TASK 2 — visible animation length (mirrors the CSS).
 *  Used to schedule entry removal; the cleanup timeout adds any
 *  start_delay so the entry persists for the full animation. */
const FLOAT_ANIMATION_MS   = 1100;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Day 21 — id stamp for FloorLootEntry. Wraps crypto.randomUUID
 *  with a fallback so the hook can run in non-browser test contexts. */
function makeFloorLootId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    try { return crypto.randomUUID(); } catch { /* fall through */ }
  }
  return `floorloot_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Day 20.4.2 TASK 2 — sequential stagger for floating numbers.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Per-host bookkeeping for the float stagger. The hook keeps refs of
 * these maps; each emission updates lastEmittedAt and lastStartDelay
 * so the NEXT emission on the same host can compute its required
 * delay.
 *
 * Pure / exported for jest. Returns the start_delay (ms) the new
 * float should use:
 *   - If `lastAt` is undefined or the gap (now - lastAt) is at least
 *     FLOAT_MIN_SPACING_MS, no stagger is needed (delay = 0).
 *   - Otherwise, delay = (FLOAT_MIN_SPACING_MS - gap) + lastStartDelay.
 *     Adding the prior delay matters: when emissions arrive every
 *     ~100ms, each one must clear the prior animation start, not just
 *     the prior emission time.
 */
export function computeFloatStartDelay(
  now:            number,
  lastAt:         number | undefined,
  lastStartDelay: number | undefined
): number {
  if (typeof lastAt !== "number") return 0;
  const gap = now - lastAt;
  if (gap >= FLOAT_MIN_SPACING_MS) return 0;
  const prevDelay = typeof lastStartDelay === "number" ? lastStartDelay : 0;
  return (FLOAT_MIN_SPACING_MS - gap) + prevDelay;
}

export function useCombat() {
  const masterState = useGameStore((s) => s.masterState);
  const setMasterState = useGameStore((s) => s.setMasterState);
  const addMessage = useGameStore((s) => s.addMessage);

  // True while we're awaiting the engine + LLM fetches for the
  // dramatic events. UI gates the action bar on this so the player
  // can't submit a second action mid-resolution.
  const [isResolving, setIsResolving] = useState(false);

  // Day 20.1 TASK 5 — UI-facing phase indicator. Decoupled from
  // combat.current_turn_index because the engine auto-resolves enemy
  // turns synchronously: by the time setMasterState commits, the
  // index is already back at PLAYER. The drain loop then plays out
  // the events with pacing delays. displayPhase is set BEFORE each
  // delay so the header pill flips immediately at phase transitions
  // — the pill is the canonical turn indicator, the feed catches up.
  const [displayPhase, setDisplayPhase] = useState<"player" | "enemy">("player");

  // Day 20.4.2 TASK 3 — floating damage / heal numbers, keyed by host
  // id ("PLAYER" for the player, instance_id for enemies). Lifted up
  // from CombatMode into the hook so emission happens INSIDE the
  // projection pipeline, right next to the story-feed line for the
  // same event. Previously CombatMode watched combat.combat_log via
  // useEffect, which fired immediately on store commit — ahead of the
  // pacing delays in projectCombatEventsToFeed.
  const [floatingByActor, setFloatingByActor] =
    useState<Record<string, FloatingDamageEntry[]>>({});
  // Day 20.4.2 TASK 2 — per-host stagger bookkeeping. Refs (not state)
  // because we only read them inside the emit callback; they don't
  // drive any render directly.
  const lastEmittedAtRef  = useRef<Record<string, number>>({});
  const lastStartDelayRef = useRef<Record<string, number>>({});

  /**
   * Day 20.4.2 TASK 3 — push a float entry for one CombatEvent.
   * Routes through makeFloatingEntry (same helper CombatMode used to
   * call directly), computes the stagger start_delay, and schedules
   * removal at (animation duration + start_delay).
   *
   * Called from projectCombatEventsToFeed AFTER its pacing sleeps so
   * the visible float pops at the same moment the matching story-
   * feed line lands.
   */
  const emitFloat = useCallback((event: CombatEvent): void => {
    const entry = makeFloatingEntry(event);
    if (!entry) return;
    const hostId = entry.targetId;
    const now    = Date.now();
    const lastAt = lastEmittedAtRef.current[hostId];
    const lastDl = lastStartDelayRef.current[hostId];
    const start_delay = computeFloatStartDelay(now, lastAt, lastDl);
    // lastEmittedAt tracks EMISSION timestamps (now), not animation
    // start times (now + delay). Per the locked decision: even when
    // we delay the visible animation, the next emission's stagger
    // math measures against when *we pushed*, not when the prior
    // animation actually played. This keeps the math stable across
    // rapid bursts and aligns with the test seam in this file.
    lastEmittedAtRef.current[hostId]  = now;
    lastStartDelayRef.current[hostId] = start_delay;

    const payload: FloatingDamageEntry = { ...entry.payload, start_delay };
    setFloatingByActor((prev) => ({
      ...prev,
      [hostId]: [...(prev[hostId] ?? []), payload],
    }));
    // Cleanup: animation length + the delay it waited.
    setTimeout(() => {
      setFloatingByActor((prev) => {
        const list = (prev[hostId] ?? []).filter((x) => x.key !== payload.key);
        const next = { ...prev };
        if (list.length === 0) delete next[hostId];
        else next[hostId] = list;
        return next;
      });
    }, FLOAT_ANIMATION_MS + start_delay);
  }, []);

  /**
   * Submit a player combat action. Resolves through the engine,
   * splices state, then walks the emitted events: routine events
   * (and crits — HF1 FIX 1) get templated story-feed lines instantly,
   * dramatic events (kill/victory/defeat/flee_success) hit the
   * /api/game/narrate-combat endpoint for prose. The action bar
   * stays disabled until all narration has landed.
   */
  const submitCombatAction = useCallback(
    async (action: PlayerActionInput) => {
      const state = useGameStore.getState().masterState;
      if (!state || !state.combat?.active) {
        console.warn("[useCombat] submitCombatAction with no active combat — ignored.");
        return;
      }

      setIsResolving(true);
      try {
        const result = engineExecute({
          action,
          state:                   state.combat,
          player:                  state.player_state,
          world_genre:             state.metadata.genre,
          last_settlement_hub_id:  state.last_settlement_hub_id,
          navigation_trail:        state.navigation_trail,
          // Day 20.4 TASK 4 — defeat teleport fallbacks. Resolve the
          // starting region's settlement id from world_bible (or its
          // own id if settlement_id wasn't populated). world_graph
          // nodes flow through so handleDefeat / handleFleeSuccess
          // can resolve display names + parent region.
          defeat_fallback_node_id: defeatFallbackFor(state),
          world_graph_nodes:       state.world_graph?.nodes,
        });

        const next = applyCombatResult(
          state, result.newState, result.newPlayer, result.resolution
        );
        setMasterState(next);

        // UI-8 — capture the floor_loot entry id created by THIS victory
        // so the victory banner in the story feed can wire its
        // "Search the remains →" link to the right entry. applyCombatResult
        // appends the new entry to floor_loot; its id sits at the tail.
        const victoryLootEntryId: string | undefined =
          result.resolution?.kind === "victory" && next.floor_loot && next.floor_loot.length > 0
            ? next.floor_loot[next.floor_loot.length - 1].id
            : undefined;

        // UI-11 — combat-result toast on victory. XP delta = current xp
        // minus pre_combat_xp captured at encounter start (rule 31).
        if (result.resolution?.kind === "victory") {
          const xpGained = Math.max(0, result.newPlayer.xp - (state.combat.pre_combat_xp ?? 0));
          toast({
            type:    "combat_result",
            message: xpGained > 0 ? `Victory · +${xpGained} XP` : "Victory",
          });
        }

        // Project events into the story feed.
        await projectCombatEventsToFeed({
          events:           result.events,
          combat:           result.newState ?? state.combat,
          player:           result.newPlayer,
          world_genre:      String(state.metadata.genre),
          regionAtmosphere: regionAtmosphereFor(state),
          locationName:     resolveLocationName(state, state.combat.origin_node_id),
          addMessage,
          setDisplayPhase,
          emitFloat,
          victoryLootEntryId,
        });

        // After drain ends — if combat is still active, sync the pill
        // to the engine's authoritative turn index. (When combat
        // dismissed via victory/defeat/flee, the panel unmounts so
        // displayPhase doesn't matter.)
        if (result.newState?.active) {
          const isPlayer = result.newState.turn_order[result.newState.current_turn_index] === PLAYER_ID;
          setDisplayPhase(isPlayer ? "player" : "enemy");
        }
      } finally {
        setIsResolving(false);
      }
    },
    [setMasterState, addMessage, emitFloat]
  );

  /**
   * Day 20.2 TASK 1 — drive the initial enemy phase when the enemy
   * wins initiative. submitCombatAction can't fire because ActionBar
   * is disabled (isPlayerTurn=false), and executePlayerAction won't
   * loop without a player action — so without this kickoff the UI
   * deadlocks. Pulls the same projection pipeline as a regular
   * action so pacing/banner/displayPhase all line up.
   *
   * Safe to call even when player has initiative (engine returns a
   * no-op result). Caller is responsible for not calling twice for
   * the same encounter — the auto-fire useEffect below handles that
   * via a ref-tracked encounter_id set.
   */
  const kickoffCombat = useCallback(
    async () => {
      const state = useGameStore.getState().masterState;
      if (!state || !state.combat?.active) return;
      if (state.combat.turn_order[state.combat.current_turn_index] === PLAYER_ID) return;

      setIsResolving(true);
      try {
        const result = kickoffCombatIfEnemyFirst({
          state:                   state.combat,
          player:                  state.player_state,
          world_genre:             state.metadata.genre,
          last_settlement_hub_id:  state.last_settlement_hub_id,
          // Day 20.4 TASK 4 — defeat teleport fallbacks (also fire
          // when the kickoff phase KOs the player on first hit).
          defeat_fallback_node_id: defeatFallbackFor(state),
          world_graph_nodes:       state.world_graph?.nodes,
        });

        const next = applyCombatResult(
          state, result.newState, result.newPlayer, result.resolution
        );
        setMasterState(next);

        // UI-8 — kickoff can in principle reach a victory (e.g. the
        // enemy phase that opens combat one-shots an already-dying
        // foe). Capture the loot entry id the same way submit does.
        const victoryLootEntryId: string | undefined =
          result.resolution?.kind === "victory" && next.floor_loot && next.floor_loot.length > 0
            ? next.floor_loot[next.floor_loot.length - 1].id
            : undefined;

        await projectCombatEventsToFeed({
          events:           result.events,
          combat:           result.newState ?? state.combat,
          player:           result.newPlayer,
          world_genre:      String(state.metadata.genre),
          regionAtmosphere: regionAtmosphereFor(state),
          locationName:     resolveLocationName(state, state.combat.origin_node_id),
          addMessage,
          setDisplayPhase,
          emitFloat,
          victoryLootEntryId,
        });

        // After drain — sync display pill to authoritative state.
        if (result.newState?.active) {
          const isPlayer = result.newState.turn_order[result.newState.current_turn_index] === PLAYER_ID;
          setDisplayPhase(isPlayer ? "player" : "enemy");
        }
      } finally {
        setIsResolving(false);
      }
    },
    [setMasterState, addMessage, emitFloat]
  );

  // Day 20.2 TASK 1 — auto-fire the kickoff when a fresh combat
  // commits with enemy initiative. Tracks encounter_id in a ref so
  // each combat fires exactly once even if the effect re-runs from
  // store updates during the drain.
  const kickedOffEncounters = useRef<Set<string>>(new Set());
  useEffect(() => {
    const combat = masterState?.combat;
    if (!combat?.active) return;
    if (kickedOffEncounters.current.has(combat.encounter_id)) return;

    if (combat.turn_order[combat.current_turn_index] === PLAYER_ID) {
      // Player has initiative — record so we don't re-evaluate when
      // the index advances later in this encounter.
      kickedOffEncounters.current.add(combat.encounter_id);
      return;
    }

    // Enemy has initiative. Kick off exactly once.
    // Sync the pill to "enemy" SYNCHRONOUSLY here (before the async
    // kickoff fires) so the header doesn't flash "Your turn" while
    // we wait for the drain to start.
    setDisplayPhase("enemy");
    kickedOffEncounters.current.add(combat.encounter_id);
    void kickoffCombat();
  }, [masterState?.combat?.encounter_id, masterState?.combat?.active, kickoffCombat]);

  return {
    /** Active combat snapshot (undefined when not in combat). */
    combat: masterState?.combat,
    /** Convenience: is it the player's turn right now? UI gates on this. */
    isPlayerTurn:
      masterState?.combat?.active === true &&
      masterState.combat.turn_order[masterState.combat.current_turn_index] === PLAYER_ID,
    /** Engine + narration in flight; action bar should disable. */
    isResolving,
    /** Day 20.1 TASK 5 — UI-facing phase. Lags the engine's true
     *  turn pointer during the drain so the header pill matches the
     *  feed's pacing instead of jumping ahead. */
    displayPhase,
    /** Day 20.4.2 TASK 3 — floating damage / heal numbers, keyed by
     *  host id ("PLAYER" or enemy.instance_id). CombatMode reads this
     *  to render the FloatingDamage components above each portrait.
     *  Lifted up from CombatMode so emission happens INSIDE the
     *  projection pipeline (same moment as the story-feed line) and
     *  the multi-enemy stagger (TASK 2) can reach across events. */
    floatingByActor,
    submitCombatAction,
    /** Day 20.2 TASK 1 — exposed for the auto-fire useEffect.
     *  External callers shouldn't need to invoke directly; the
     *  hook fires it automatically when an encounter starts with
     *  enemy initiative. */
    kickoffCombat,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Combat events -> story feed projection
// ─────────────────────────────────────────────────────────────────────────────

interface ProjectArgs {
  events:           CombatEvent[];
  combat:           CombatState;
  player:           PlayerState;
  world_genre:      string;
  regionAtmosphere: string;
  /** Display name of the encounter's origin node — interpolated into
   *  the combat_start banner. */
  locationName?:    string;
  addMessage:       (m: ReturnType<typeof makeMessage>) => void;
  /** Day 20.1 TASK 5 — flips the header pill at phase transitions
   *  before the feed catches up. */
  setDisplayPhase:  (phase: "player" | "enemy") => void;
  /** Day 20.4.2 TASK 3 — push a floating damage/heal number for this
   *  event. Called AFTER pacing sleeps so the float pops at the same
   *  moment as the matching story-feed line lands. */
  emitFloat:        (event: CombatEvent) => void;
  /** UI-8 — id of the floor_loot entry created by this victory (when
   *  the resolution was a victory). Attached to the victory message
   *  metadata so the "Search the remains →" link in the StoryFeed
   *  victory banner can wire to the right entry. */
  victoryLootEntryId?: string;
}

/**
 * Day 20.3 TASK 4 — pre-scan helper. When a victory event is in the
 * batch, the killing crit's prose duplicates the victory line — feels
 * redundant. Build a Set of indices to skip:
 *   - the LAST crit/kill before the victory event has its prose
 *     suppressed (banner stays — it's still a crit)
 *   - kill events when victory is in the batch are dropped entirely
 *     (the victory banner already says everything the kill prose did)
 * Returns: { suppressProseAt, skipEntirely } sets keyed by index.
 */
export function planEventSuppression(events: CombatEvent[]): {
  suppressProseAt: Set<number>;
  skipEntirely:    Set<number>;
} {
  const suppressProseAt = new Set<number>();
  const skipEntirely    = new Set<number>();

  const victoryIdx = events.findIndex((e) => e.type === "victory");
  if (victoryIdx < 0) return { suppressProseAt, skipEntirely };

  // Drop kill events entirely when victory is present.
  for (let i = 0; i < victoryIdx; i += 1) {
    if (events[i].type === "kill") skipEntirely.add(i);
  }

  // Suppress prose on the last crit before the victory (the killing
  // blow). Banner still renders; LLM prose doesn't fire.
  for (let i = victoryIdx - 1; i >= 0; i -= 1) {
    if (events[i].outcome === "crit") {
      suppressProseAt.add(i);
      break;
    }
  }
  return { suppressProseAt, skipEntirely };
}

export async function projectCombatEventsToFeed(args: ProjectArgs): Promise<void> {
  const enemyNameByInstanceId = (id: string): string | undefined =>
    args.combat.enemies.find((e) => e.instance_id === id)?.name;

  // Day 20.3 TASK 4 — pre-scan the batch for the kill-event drop rule.
  // (HF1 FIX 1 — suppressProseAt is no longer consulted: crits emit a
  // banner only, with no prose to suppress. planEventSuppression still
  // computes it for its own pinned tests.)
  const { skipEntirely } = planEventSuppression(args.events);

  // Day 20.1 TASK 4 — pacing across enemy turns. Track which enemy
  // last acted so we can insert a 500ms gap between successive
  // distinct enemies (one resolves → pause → next resolves).
  let prevEnemyActor: string | null = null;

  for (let i = 0; i < args.events.length; i += 1) {
    const event = args.events[i];

    // Skip events flagged by the victory pre-scan (kill events when
    // victory is in the batch — banner says it all).
    if (skipEntirely.has(i)) continue;

    // Day 20.1 TASK 4 — pacing delays + pill sync at phase boundaries.
    // setDisplayPhase fires BEFORE the sleep so the header pill is
    // already in sync by the time the separator line lands in the feed.
    if (event.type === "enemy_phase_start") {
      args.setDisplayPhase("enemy");
      await sleep(ENEMY_PHASE_DELAY_MS);
      prevEnemyActor = null;
    } else if (event.type === "player_turn_start") {
      args.setDisplayPhase("player");
      await sleep(PLAYER_TURN_DELAY_MS);
      prevEnemyActor = null;
    } else if (event.type === "enemy_attack") {
      // 500ms gap between distinct enemies' turns. First enemy in a
      // phase doesn't get the pause (the 800ms enemy_phase_start delay
      // already covered the lead-in).
      if (prevEnemyActor !== null && prevEnemyActor !== event.actor) {
        await sleep(ENEMY_TURN_GAP_MS);
      }
      prevEnemyActor = event.actor;
    } else {
      // Reset enemy-actor tracking on any non-enemy_attack event so
      // a kill / round_start doesn't bleed actor identity across phases.
      prevEnemyActor = null;
    }

    // Day 20.4.2 TASK 3 — emit the floating number HERE, right after
    // pacing sleeps and before any addMessage for this event. This
    // syncs the visible float with the story-feed line for the same
    // event (V8.38 fired floats on store commit, way ahead of the
    // pacing-delayed feed lines — they appeared "out of order"). The
    // helper returns null for non-damage events so this is safe to
    // call on every iteration.
    args.emitFloat(event);

    // ── HF1 FIX 1 — CRITICAL HIT one-line render ─────────────────────
    // For player_attack / enemy_attack with outcome === "crit", push
    // ONLY the templated banner line (instant). Rule 54's two-line
    // crit (banner + LLM prose) is reversed: no narrate-combat call,
    // no narrative paragraph — the roll-detail suffix on the banner
    // already supplies the context.
    if (
      event.outcome === "crit" &&
      (event.type === "player_attack" || event.type === "enemy_attack")
    ) {
      const banner = renderCritBanner(event);
      args.addMessage(
        makeMessage("COMBAT", banner.primary, {
          ...makeCombatMessageMetadata(event),
          is_crit_banner: true,
          rolls_suffix:   banner.rolls,
        })
      );
      continue;
    }

    // ── Day 20.3 TASK 5 — Victory / Defeat / Escaped two-line render ─
    // Banner word first (instant), then shortened LLM prose below.
    // Day 20.4 TASK 4 — defeat / flee_success carry destination
    // metadata for the templated info line.
    if (
      event.type === "victory" ||
      event.type === "defeat" ||
      event.type === "flee_success"
    ) {
      const banner = renderResolutionBanner(event);
      const text = await fetchCombatNarration(event, args);
      args.addMessage(
        makeMessage("COMBAT", banner ?? "", {
          ...makeCombatMessageMetadata(event),
          is_resolution_banner: true,
          resolution_prose:     text,
          // Resolved by handleDefeat / handleFleeSuccess. StoryFeed
          // reads this to render "You wake at <Settlement> in
          // <Region>." or "You break to <Node>." below the prose.
          destination:          event.destination,
          // UI-8 — for victory events, the floor_loot entry id created
          // by THIS fight. StoryFeed reads it + looks up the live
          // entry in masterState.floor_loot to render the
          // "Search the remains →" link / inline loot list.
          ...(event.type === "victory" && args.victoryLootEntryId
            ? { floor_loot_entry_id: args.victoryLootEntryId }
            : {}),
        })
      );
      continue;
    }

    if (isDramaticEvent(event)) {
      // Dramatic non-resolution, non-crit (kill events when no
      // victory is present, defensive). Fetch LLM prose and push.
      const text = await fetchCombatNarration(event, args);
      if (text) {
        args.addMessage(
          makeMessage("COMBAT", text, makeCombatMessageMetadata(event))
        );
      }
      continue;
    }

    // Routine — pull a templated line. Falls back silently when the
    // template helper returns null (defensive against future event
    // types we haven't added templates for).
    const itemForTemplate =
      event.type === "use_item" && event.weapon_or_item
        ? event.weapon_or_item
        : undefined;
    const enemyNamesForBanner = event.type === "combat_start"
      ? args.combat.enemies.map((e) => e.name)
      : undefined;
    const locationNameForBanner = event.type === "combat_start"
      ? args.locationName
      : undefined;
    const roundForSeparator = event.type === "round_start"
      ? args.combat.round_number
      : undefined;
    const templated = renderRoutineCombatEvent(event, {
      enemyName:    enemyNameByInstanceId,
      playerName:   args.player.name,
      itemName:     itemForTemplate,
      enemyNames:   enemyNamesForBanner,
      locationName: locationNameForBanner,
      roundNumber:  roundForSeparator,
    });
    if (templated) {
      // Day 20.4 TASK 2 — pass the rolls suffix through metadata so
      // StoryFeed can render the dimmed-mono breakdown next to the
      // primary line.
      args.addMessage(
        makeMessage("COMBAT", templated.primary, {
          ...makeCombatMessageMetadata(event),
          rolls_suffix: templated.rolls,
        })
      );
    }
  }
}

/** Resolve a node id to its display name via world_graph. */
function resolveLocationName(state: MasterState, nodeId: string): string | undefined {
  return state.world_graph?.nodes[nodeId]?.name;
}

async function fetchCombatNarration(
  event: CombatEvent,
  args:  ProjectArgs
): Promise<string> {
  try {
    const res = await fetch("/api/game/narrate-combat", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        event,
        combat_context: {
          player_name:       args.player.name,
          player_class:      args.player.background,
          enemies: args.combat.enemies.map((e) => ({
            name:            e.name,
            description:     e.description,
            behavior_flavor: e.behavior_flavor,
            alive:           e.alive,
          })),
          region_atmosphere: args.regionAtmosphere,
        },
        genre: args.world_genre,
      }),
    });
    if (!res.ok) {
      console.error("[useCombat] narrate-combat failed:", await res.text());
      return fallbackForDramaticEvent(event);
    }
    const data = await res.json() as { text?: string };
    return data.text?.trim() || fallbackForDramaticEvent(event);
  } catch (err) {
    console.error("[useCombat] narrate-combat threw:", err);
    return fallbackForDramaticEvent(event);
  }
}

function fallbackForDramaticEvent(event: CombatEvent): string {
  switch (event.type) {
    case "combat_start": return "Combat begins.";
    case "victory":      return "The last foe falls.";
    case "defeat":       return "Darkness closes in.";
    case "flee_success": return "You break free.";
    case "kill":         return "The enemy collapses.";
    default:
      if (event.outcome === "crit") return "A critical strike lands.";
      return "";
  }
}

/** StoryMessage metadata payload — StoryFeed reads this to apply
 *  combat-specific styling per locked decisions §10. */
function makeCombatMessageMetadata(event: CombatEvent): Record<string, unknown> {
  return {
    combat:       true,
    event_type:   event.type,
    actor:        event.actor,
    target:       event.target,
    outcome:      event.outcome,
    damage_dealt: event.damage_dealt,
    // Day 20.4 — granular rolls forwarded through metadata so the
    // floating-damage hook + StoryFeed can read damage_die_roll /
    // crit_max_damage directly off the COMBAT message.
    rolls:        event.rolls,
  };
}

/**
 * Day 20.4 TASK 4 — secondary defeat-teleport target. Pulled from
 * the WorldBible's starting_region settlement so we always have a
 * named hub to fall back on, even when the player has not yet
 * arrived at any settlement (which would normally populate
 * last_settlement_hub_id via useGameLoop step 7c-2). Falls through
 * to the region zone id when settlement_id wasn't populated.
 */
function defeatFallbackFor(state: MasterState): string | undefined {
  const sr = state.metadata.world_bible?.starting_region;
  if (!sr) return undefined;
  return sr.settlement_id ?? sr.id;
}

function regionAtmosphereFor(state: MasterState): string {
  // Look at the current location asset's atmosphere if present;
  // safe to fall back to "" for the LLM (region context is just a
  // tonal hint, not a fact source).
  const wb = state.metadata.world_bible;
  if (!wb) return "";
  return wb.starting_region.atmosphere ?? "";
}

/**
 * Splice the engine's result into a fresh MasterState. Handles all
 * three resolution kinds (victory/defeat/flee) by clearing the
 * combat slice and applying the appropriate side-effects (teleport,
 * status change). Pure — caller commits via setMasterState.
 */
export function applyCombatResult(
  state:      MasterState,
  newCombat:  CombatState | undefined,
  newPlayer:  PlayerState,
  resolution: CombatResolutionPayload | undefined
): MasterState {
  // No resolution: combat continues, just splice in the new state.
  if (!resolution) {
    return { ...state, player_state: newPlayer, combat: newCombat };
  }

  switch (resolution.kind) {
    case "victory": {
      // Day 21 — drop a PENDING FloorLootEntry for the dead enemies.
      // The strip's SEARCH REMAINS button resolves it into real items
      // + gold. Player stays at origin_node_id; combat slice unsets.
      const pendingEntry: FloorLootEntry = {
        id:      makeFloorLootId(),
        node_id: resolution.pending_loot.node_id,
        items:   [],
        gold:    0,
        owner:   null,
        source:  "enemy",
        pending: {
          enemy_instance_ids: resolution.pending_loot.enemy_instance_ids,
          enemy_loot_refs:    resolution.pending_loot.enemy_loot_refs,
        },
      };
      return {
        ...state,
        player_state: newPlayer,
        combat:       undefined,
        floor_loot: [...(state.floor_loot ?? []), pendingEntry],
      };
    }
    case "defeat": {
      // Teleport to the death-warp target. Mark ARRIVING so the normal
      // post-arrival pipeline (asset reload, codex first-visit) fires
      // for the settlement scene.
      const targetId = resolution.teleport_to_node_id;
      return {
        ...state,
        player_state: newPlayer,
        combat:       undefined,
        world_state: {
          ...state.world_state,
          current_location_id: targetId,
          current_node_id:     targetId,
          location_status:     LocationStatus.ARRIVING,
        },
        ...(state.world_graph
          ? {
              world_graph: {
                ...state.world_graph,
                current_node_id: targetId,
              },
            }
          : {}),
      };
    }
    case "flee_success": {
      const targetId = resolution.teleport_to_node_id;
      return {
        ...state,
        player_state: newPlayer,
        combat:       undefined,
        world_state: {
          ...state.world_state,
          current_location_id: targetId,
          current_node_id:     targetId,
          location_status:     LocationStatus.ARRIVING,
        },
        ...(state.world_graph
          ? {
              world_graph: {
                ...state.world_graph,
                current_node_id: targetId,
              },
            }
          : {}),
      };
    }
  }
}
