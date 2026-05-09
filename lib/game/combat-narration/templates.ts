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
  } = {}
): string | null {
  switch (event.type) {
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
  // damage_dealt is negative for heal events — see combat-engine.
  const heal = event.damage_dealt != null ? Math.abs(event.damage_dealt) : 0;
  const name = itemName ?? event.weapon_or_item ?? "a potion";
  if (heal > 0) return `You drink ${name}. +${heal} HP.`;
  return `You drink ${name}. No effect.`;
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
