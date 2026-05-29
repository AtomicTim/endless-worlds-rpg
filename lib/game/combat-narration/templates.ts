import type { CombatEvent, CombatEventRolls } from "@/types/game";

/**
 * Day 20.4 TASK 2 — return shape for renderRoutineCombatEvent and
 * renderCritBanner. `primary` is the always-rendered event line;
 * `rolls` is an optional dimmed-mono parenthetical suffix
 * surfacing the d20 / damage breakdown for that event. StoryFeed
 * renders both spans separately.
 */
export interface RoutineEventResult {
  primary: string;
  rolls:   string | null;
}

/**
 * Day 20 Combat — templated narration (combat-spec §10).
 *
 * Routine combat events (hit / miss / fumble / defend / use_item /
 * failed flee) get instant code-generated lines pulled from a small
 * variant pool. The combat narrator API only fires on dramatic
 * events (kill / victory / defeat / successful flee) — everything
 * else, including crits (HF1 FIX 1) and combat_start, stays in
 * templates so the action loop feels snappy.
 *
 * Variant selection is deterministic per event: the same event
 * always renders the same string. This matters because the story
 * feed may re-render (React key changes, scroll, etc.) and we don't
 * want phrasing to flicker between renders.
 */

/**
 * Discriminated by event.type + event.outcome. Returns null when
 * the event isn't a routine line (callers fall back to LLM prose).
 */
export function renderRoutineCombatEvent(
  event: CombatEvent,
  context: {
    /** Resolves enemy `instance_id` → display name for interpolation. */
    enemyName?: (instanceId: string) => string | undefined;
    /** Player display name — defaults to "you" / "your". */
    playerName?: string;
    /** Item display name for use_item events. */
    itemName?:  string;
    /** combat_start: list of names of every spawned enemy, in order. */
    enemyNames?: string[];
    /** combat_start / encounter banner: human-readable location name. */
    locationName?: string;
    /** round_start: 1-based round counter. */
    roundNumber?: number;
  } = {}
): RoutineEventResult | null {
  // Helper: wrap a primary string with the standard rolls suffix
  // computed from event.rolls. Events without a rolls payload (or
  // events where rolls don't apply, like turn separators) get null.
  const wrap = (primary: string | null): RoutineEventResult | null => {
    if (primary == null) return null;
    return { primary, rolls: buildRollsSuffix(event) };
  };

  switch (event.type) {
    case "combat_start":
      // No rolls on combat_start; the encounter banner is informational.
      return { primary: renderCombatStart(context), rolls: null };
    case "round_start":
      return { primary: renderRoundSeparator(context.roundNumber), rolls: null };
    // PR-11v-e — phase separators dropped from the feed entirely. The
    // combat panel header pill (Your Turn / Enemy Turn) is the
    // canonical phase indicator; an extra centred line in the feed
    // just adds noise on top of it.
    case "player_turn_start":
      return null;
    case "enemy_phase_start":
      return null;
    case "player_attack": {
      const targetId = event.target;
      const resolved =
        typeof targetId === "string" && targetId !== "PLAYER"
          ? context.enemyName?.(targetId)
          : undefined;
      return wrap(renderPlayerAttack(event, resolved ?? "the enemy"));
    }
    case "enemy_attack": {
      const resolved =
        event.actor !== "PLAYER"
          ? context.enemyName?.(event.actor)
          : undefined;
      return wrap(renderEnemyAttack(event, resolved ?? "The enemy"));
    }
    case "defend":
      return { primary: "You raise your guard.", rolls: null };
    case "use_item":
      return wrap(renderUseItem(event, context.itemName));
    case "flee_attempt":
      // Successful flee is dramatic — leave to LLM. Failed is templated.
      if (event.outcome === "fled_failed") return wrap(renderFleeFail(event));
      return null;
    // ── Prompt 5 — status effect beats ─────────────────────────────────────
    // Terse by design: these fire frequently and compete with combat
    // prose. No rolls suffix — the lines carry the damage inline.
    case "status_applied":
      return { primary: renderStatusApplied(event, context), rolls: null };
    case "status_tick":
      return { primary: renderStatusTick(event, context), rolls: null };
    case "status_saved":
      return { primary: renderStatusSaved(event), rolls: null };
    case "status_expired":
      return { primary: renderStatusExpired(event), rolls: null };
    // ── PR-11v-c — ability dispatch + no-charges feedback ─────────────────
    // context_note carries the full summary from summariseAbilityResolution
    // (e.g. "Hunter's Arrow — 4 damage", "Relic Pulse — healed 8 HP",
    // "Shield Bash — self: fortified"). When present, render it directly
    // with the ✦ glyph; otherwise fall back to a bare-name line.
    case "ability_used": {
      const note = typeof event.context_note === "string"
        ? event.context_note.trim() : "";
      const name = event.weapon_or_item ?? "ability";
      const primary = note.length > 0
        ? `✦ ${note}`
        : `✦ You use ${name}.`;
      return { primary, rolls: null };
    }
    case "ability_no_charges": {
      const name = event.weapon_or_item ?? "ability";
      return { primary: `✦ ${name} — no charges remaining.`, rolls: null };
    }
    default:
      return null;
  }
}

// ── Prompt 5 — status effect renderers ─────────────────────────────────────
// The status name is the raw canonical id for now (event.weapon_or_item);
// world-alias skinning at narration time lands in P7 with WCD integration.

/** Canonical buff ids — status_expired phrases buffs differently. */
const STATUS_BUFF_IDS = new Set(["fortified", "hastened", "focused"]);

/** Pull the status id off a status event (engine stores it in
 *  weapon_or_item). Defensive fallback so a malformed event still
 *  renders a readable line. */
function statusIdOf(event: CombatEvent): string {
  return event.weapon_or_item ?? "effect";
}

function renderStatusApplied(
  event:   CombatEvent,
  context: { enemyName?: (instanceId: string) => string | undefined }
): string {
  const id = statusIdOf(event);
  if (event.target === "PLAYER") {
    const source =
      (event.actor !== "PLAYER" ? context.enemyName?.(event.actor) : undefined)
      ?? "An enemy";
    return `${source} inflicts ${id} on you.`;
  }
  // Enemy is the target (forward-compat — the engine applies status to
  // the player only today).
  const enemyName =
    (typeof event.target === "string" ? context.enemyName?.(event.target) : undefined)
    ?? "the enemy";
  return `You afflict ${enemyName} with ${id}.`;
}

function renderStatusTick(
  event:   CombatEvent,
  context: { enemyName?: (instanceId: string) => string | undefined }
): string {
  const id  = statusIdOf(event);
  const dmg = event.damage_dealt ?? 0;
  if (event.target === "PLAYER") {
    return `${id} deals ${dmg} damage.`;
  }
  const enemyName =
    (typeof event.target === "string" ? context.enemyName?.(event.target) : undefined)
    ?? "the enemy";
  return `${id} deals ${dmg} damage to ${enemyName}.`;
}

function renderStatusSaved(event: CombatEvent): string {
  return `You shake off the ${statusIdOf(event)}.`;
}

function renderStatusExpired(event: CombatEvent): string {
  const id = statusIdOf(event);
  if (STATUS_BUFF_IDS.has(id)) return `${id} wears off.`;
  return `The ${id} fades.`;
}

// ── Day 20.4 TASK 2 — roll suffix builder ──────────────────────────────────

/**
 * Build the dimmed-mono parenthetical suffix that surfaces the
 * d20 / damage breakdown for a CombatEvent. Returns null for events
 * with no rolls payload (turn separators, defend, combat_start).
 *
 * Day 20.4.2 TASK 5 — D&D-style display:
 *   • Show raw d20 + explicit modifier + total + DC, so the player
 *     can see WHY a "high-looking" raw roll might have failed.
 *   • Modifier sign: positive → `+N`, negative → `+(-N)`, zero → `+0`.
 *     The explicit "+(N)" wrapper for negatives makes them parse
 *     unambiguously next to the `+` prefix character.
 *   • Nat-1 (fumble) and Nat-20 (crit) skip the modifier/total — the
 *     outcome is locked by the raw die so the math doesn't matter.
 *   • Math.round(target_dc) for display; raw float still drives the
 *     engine's pass/fail check (flee DC can land on 10.666...).
 *
 * Formats by outcome (Day 20.4.2):
 *   hit:    "(d20: 17, +2 → 19 vs 12 | 1d6+2)"
 *   miss:   "(d20: 4, +2 → 6 vs 12)"
 *   fumble: "(d20: 1)"                              [nat-1, auto-miss]
 *   crit:   "(d20: 20 | 6 (max) + 3 (1d6) + 2)"     [nat-20, auto-hit]
 *   heal:   "(1d8: 4 +4 = 8)"
 *   flee:   "(d20: 12, +(-2) → 10 vs 10)"
 */
function buildRollsSuffix(event: CombatEvent): string | null {
  const r: CombatEventRolls | undefined = event.rolls;
  if (!r) return null;

  // Use-item heal: no d20, just the heal die roll + flat +4 + sum.
  if (event.type === "use_item") {
    if (typeof r.damage_die_roll === "number" && r.damage_die) {
      const total = r.damage_die_roll + 4;
      return `(${r.damage_die}: ${r.damage_die_roll} +4 = ${total})`;
    }
    return null;
  }

  if (typeof r.d20 !== "number") return null;

  // Fumble: nat 1 — auto-miss. Modifier irrelevant.
  if (event.outcome === "fumble") {
    return `(d20: ${r.d20})`;
  }

  // Crit: d20 = 20 — auto-hit. Show damage breakdown.
  if (event.outcome === "crit") {
    const parts: string[] = [`d20: ${r.d20}`];
    if (
      typeof r.crit_max_damage === "number" &&
      typeof r.damage_die_roll === "number" &&
      r.damage_die
    ) {
      const strMod = typeof r.str_modifier === "number" ? r.str_modifier : 0;
      parts.push(
        `${r.crit_max_damage} (max) + ${r.damage_die_roll} (${r.damage_die}) + ${strMod}`
      );
    }
    return `(${parts.join(" | ")})`;
  }

  // Hit / miss / fled / fled_failed — show full d20 math.
  const mod   = typeof r.d20_modifier === "number" ? r.d20_modifier : 0;
  const total = r.d20 + mod;
  const dc    = typeof r.target_dc === "number" ? Math.round(r.target_dc) : null;
  const modStr = formatModifier(mod);

  if (event.outcome === "hit") {
    const parts: string[] = [`d20: ${r.d20}, ${modStr} → ${total}`];
    if (dc !== null) parts[0] += ` vs ${dc}`;
    if (r.damage_die && typeof r.str_modifier === "number") {
      const sign = r.str_modifier >= 0 ? "+" : "";
      parts.push(`${r.damage_die}${sign}${r.str_modifier}`);
    } else if (r.damage_die) {
      parts.push(r.damage_die);
    }
    return `(${parts.join(" | ")})`;
  }

  // Miss / fled / fled_failed — d20 math against DC.
  if (dc !== null) {
    return `(d20: ${r.d20}, ${modStr} → ${total} vs ${dc})`;
  }
  return `(d20: ${r.d20})`;
}

/**
 * Format a d20 modifier for the display suffix.
 *   positive: "+2"
 *   negative: "+(-2)" — wrap the negative so it parses next to the
 *             always-leading "+" character ("d20: 12, +(-2) → 10")
 *   zero:     "+0"
 */
function formatModifier(mod: number): string {
  if (mod > 0) return `+${mod}`;
  if (mod < 0) return `+(${mod})`;
  return "+0";
}

// ── combat_start banner (Day 20.1 TASK 2) ──────────────────────────────────

/**
 * Build the encounter banner from a list of enemy names + optional
 * location name. Templated (not LLM) per locked design — at the
 * moment of "what's happening?" the player wants clarity, not
 * flavor. Format:
 *   1 enemy:    "You encounter X at <location>."
 *   2 enemies:  "You encounter X and Y at <location>."
 *   3+ enemies: "You encounter X, Y, and Z at <location>."
 *   no location: drop the " at <location>" suffix.
 */
function renderCombatStart(ctx: {
  enemyNames?:   string[];
  locationName?: string;
}): string {
  const names = ctx.enemyNames ?? [];
  const where = ctx.locationName?.trim();
  const list = formatEnemyList(names);
  if (!list) {
    // No names supplied — defensive default. Combat still renders
    // with a generic banner instead of an empty line.
    return where ? `You encounter foes at ${where}.` : "Foes appear.";
  }
  return where
    ? `You encounter ${list} at ${where}.`
    : `You encounter ${list}.`;
}

function formatEnemyList(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  // 3+ — Oxford-comma list.
  const head = names.slice(0, -1).join(", ");
  const tail = names[names.length - 1];
  return `${head}, and ${tail}`;
}

function renderRoundSeparator(round: number | undefined): string {
  // PR-11v-e — strip the decorative dashes. StoryFeed renders this
  // event with its own styled centred-rule separator.
  if (typeof round === "number" && round > 0) {
    return `round ${round}`;
  }
  return "new round";
}

// ── Variant pools ──────────────────────────────────────────────────────────
// Pools are tagged-template-style strings with `{target}`, `{actor}`, and
// `{dmg}` placeholders. Interpolation happens in renderer helpers below.
// Strings (vs functions) keep the pool flat and side-step lint quibbles
// over unused parameters in the variants that don't reference an arg.

const PLAYER_HIT_VARIANTS = [
  "You strike {target} — {dmg} damage.",
  "Your blade bites — {dmg} damage.",
  "A clean hit on {target} — {dmg} damage.",
  "You connect — {dmg} damage.",
];

const PLAYER_MISS_VARIANTS = [
  "Your strike goes wide.",
  "{Target} twists away.",
  "You miss.",
  "Your swing finds only air.",
];

const PLAYER_FUMBLE_VARIANTS = [
  "You stumble — your blade clatters.",
  "You overextend, badly.",
];

const ENEMY_HIT_VARIANTS = [
  "{Actor} lands a hit — {dmg} damage.",
  "{Actor} claws at you — {dmg} damage.",
  "{Actor} strikes — {dmg} damage.",
  "{Actor}'s blade finds you — {dmg} damage.",
];

const ENEMY_MISS_VARIANTS = [
  "{Actor}'s swipe misses.",
  "You sidestep.",
  "{Actor}'s blade scrapes off your guard.",
  "The attack glances off.",
];

const FLEE_FAIL_VARIANTS = [
  "You can't break free.",
  "The enemies block your retreat.",
];

/** Substitute named placeholders into a variant template. */
function fill(
  template: string,
  vars: { target?: string; actor?: string; dmg?: number }
): string {
  return template
    .replace("{target}", vars.target ?? "")
    .replace("{Target}", vars.target ? capitalize(vars.target) : "")
    .replace("{actor}",  vars.actor  ?? "")
    .replace("{Actor}",  vars.actor  ? capitalize(vars.actor)  : "")
    .replace("{dmg}",    String(vars.dmg ?? 0));
}

// ── Renderers ──────────────────────────────────────────────────────────────

function renderPlayerAttack(event: CombatEvent, target: string): string | null {
  if (event.outcome === "fumble") return pickVariant(PLAYER_FUMBLE_VARIANTS, event);
  if (event.outcome === "miss")   return fill(pickVariant(PLAYER_MISS_VARIANTS, event), { target });
  if (event.outcome === "hit") {
    const dmg = event.damage_dealt ?? 0;
    return fill(pickVariant(PLAYER_HIT_VARIANTS, event), { target, dmg });
  }
  // Crit / kill = LLM-narrated. Return null so the caller knows.
  return null;
}

function renderEnemyAttack(event: CombatEvent, actor: string): string | null {
  if (event.outcome === "fumble") return `${actor} stumbles.`;
  if (event.outcome === "miss")   return fill(pickVariant(ENEMY_MISS_VARIANTS, event), { actor });
  if (event.outcome === "hit") {
    const dmg = event.damage_dealt ?? 0;
    return fill(pickVariant(ENEMY_HIT_VARIANTS, event), { actor, dmg });
  }
  // Crit / kill = LLM.
  return null;
}

function renderUseItem(event: CombatEvent, itemName?: string): string {
  // Day 20.3 TASK 2 — "Restored N HP" instead of "+N HP" (clearer
  // wording per locked design). Falls back to "You use <item>." for
  // non-heal consumables (Day 21+ items).
  // damage_dealt is negative for heal events — see combat-engine.
  const heal = event.damage_dealt != null ? Math.abs(event.damage_dealt) : 0;
  const name = itemName ?? event.weapon_or_item ?? "an item";
  if (heal > 0) return `You use ${name}. Restored ${heal} HP.`;
  return `You use ${name}.`;
}

/**
 * CRITICAL HIT banner. HF1 FIX 1 — this is the ONLY line a crit
 * renders: rule 54's two-line render (banner + LLM prose) is reversed,
 * so there is no second narrate-combat line. Returns the banner string
 * + an optional rolls suffix for inline display. Damage in the banner
 * interpolates from event.damage_dealt (the resolved final damage);
 * the rolls suffix shows the breakdown (max + bonus + str_mod).
 */
export function renderCritBanner(event: CombatEvent): RoutineEventResult {
  const dmg = event.damage_dealt;
  const primary = typeof dmg === "number" && dmg > 0
    ? `⚔ CRITICAL HIT — ${dmg} damage.`
    : "⚔ CRITICAL HIT.";
  return { primary, rolls: buildRollsSuffix(event) };
}

/**
 * Day 20.3 TASK 5 — Victory / Defeat / Escaped banner word
 * (line 1 of the two-line resolution render). Short, title-case;
 * StoryFeed CSS handles uppercasing + font sizing + centering.
 */
export function renderResolutionBanner(event: CombatEvent): string | null {
  switch (event.type) {
    case "victory":      return "Victory";
    case "defeat":       return "Defeat";
    case "flee_success": return "Escaped";
    default:             return null;
  }
}

function renderFleeFail(event: CombatEvent): string {
  return pickVariant(FLEE_FAIL_VARIANTS, event);
}

// ── Deterministic variant picker ───────────────────────────────────────────

/**
 * Pick a variant from a pool deterministically. The hash uses the
 * event timestamp, so the same event always renders the same line
 * across re-renders. Falls back to a stable seed for events with no
 * timestamp (defensive — every CombatEvent has one in practice).
 */
function pickVariant<T>(pool: T[], event: CombatEvent): T {
  if (pool.length === 0) throw new Error("pickVariant: empty pool");
  if (pool.length === 1) return pool[0];
  const seed = event.timestamp || 1;
  // Simple integer hash. Doesn't need to be cryptographic — just
  // distribute a millisecond timestamp evenly across the pool.
  const hashed = Math.abs(Math.imul(seed, 2654435761)) >>> 0;
  return pool[hashed % pool.length];
}

function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ── PR-11v-e — resolution + kill prose templates ─────────────────────────
// Replaces the narrate-combat API call. The LLM round-trip added 1-2s of
// dead air after every victory / defeat / kill while the result was
// almost always close to one of these canonical lines. Trading the
// flexibility for instant feedback was the right call once the combat
// loop got fast enough that LLM latency was the dominant pacing cost.

/** Victory prose. Names the last enemy in the roster — typically the
 *  boss / final foe the player just dropped. Falls back to "the enemy"
 *  when the roster is empty or names are missing. */
export function renderVictoryProse(enemyNames: string[]): string {
  const last = enemyNames.filter(Boolean).pop() ?? "the enemy";
  return `${last} collapses. The silence that follows is yours.`;
}

/** Defeat prose. Generic by design — the player teleports to safety
 *  next, so the line bridges into the destination info line below. */
export function renderDefeatProse(): string {
  return "Darkness takes you. You wake somewhere safer.";
}

/** Flee_success prose. Generic — short, decisive, no enemy reference
 *  (the player turned their back on them). */
export function renderFleeProse(): string {
  return "You break free and don't look back.";
}

/** Per-kill prose. Used when a kill event appears without a victory in
 *  the same batch (multi-enemy fights, mid-combat takedowns). */
export function renderKillLine(enemyName: string): string {
  return `${enemyName} is defeated.`;
}
