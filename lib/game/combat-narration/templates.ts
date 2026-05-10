import type { CombatEvent } from "@/types/game";

/**
 * Day 20 Combat — templated narration (combat-spec §10).
 *
 * Routine combat events (hit / miss / fumble / defend / use_item /
 * failed flee) get instant code-generated lines pulled from a small
 * variant pool. The combat narrator API only fires on dramatic
 * events (crit / kill / victory / defeat / successful flee /
 * combat_start) — everything else stays in templates so the action
 * loop feels snappy.
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
): string | null {
  switch (event.type) {
    case "combat_start":
      return renderCombatStart(context);
    case "round_start":
      return renderRoundSeparator(context.roundNumber);
    case "player_turn_start":
      return "─── Your turn ───";
    case "enemy_phase_start":
      return "─── Enemies' turn ───";
    case "player_attack": {
      const targetId = event.target;
      const resolved =
        typeof targetId === "string" && targetId !== "PLAYER"
          ? context.enemyName?.(targetId)
          : undefined;
      return renderPlayerAttack(event, resolved ?? "the enemy");
    }
    case "enemy_attack": {
      const resolved =
        event.actor !== "PLAYER"
          ? context.enemyName?.(event.actor)
          : undefined;
      return renderEnemyAttack(event, resolved ?? "The enemy");
    }
    case "defend":
      return "You raise your guard.";
    case "use_item":
      return renderUseItem(event, context.itemName);
    case "flee_attempt":
      // Successful flee is dramatic — leave to LLM. Failed is templated.
      if (event.outcome === "fled_failed") return renderFleeFail(event);
      return null;
    default:
      return null;
  }
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
  if (typeof round === "number" && round > 0) {
    return `─── Round ${round} ───`;
  }
  // Fallback when round number wasn't threaded through.
  return "─── New round ───";
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
 * Day 20.3 TASK 3 — CRITICAL HIT banner string (line 1 of the
 * two-line crit render). The LLM prose follows on line 2. Damage
 * suffix interpolated from event.damage_dealt; falls back to the
 * generic banner when damage isn't carried.
 */
export function renderCritBanner(event: CombatEvent): string {
  const dmg = event.damage_dealt;
  if (typeof dmg === "number" && dmg > 0) {
    return `⚔ CRITICAL HIT — ${dmg} damage.`;
  }
  return "⚔ CRITICAL HIT.";
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
