import Anthropic from "@anthropic-ai/sdk";
import { Genre } from "@/types/game";
import type {
  NPCDefinition,
  QuestCompletionCondition,
  QuestDiscoveryTrigger,
  SideQuest,
} from "@/types/game";

/**
 * Day 23D — side-quest generator core (V8.66).
 *
 * Takes RegionBible quest-hook NPCs + world context and expands each
 * NPC's quest_seed into a full SideQuest object via haiku. Returns the
 * array of generated quests. Both the public HTTP route
 * (/api/game/generate-side-quests) and apply-regional-bible call this
 * function directly so the apply flow gets quests written into the
 * persisted master_state in a single transaction, without depending on
 * serverless fire-and-forget execution.
 *
 * Pure-async: takes its dependencies (the Anthropic client) as args so
 * the route can build a client from request env and the apply route
 * can share its own. Returns [] on any error — the apply flow never
 * fails just because side-quest generation hiccupped.
 */

export interface SideQuestGenerationContext {
  world_name:         string;
  archetype:          string;
  threat_description: string;
  genre:              Genre;
  tone:               string;
}

const SYSTEM_PROMPT =
  "You are a side-quest writer for a procedurally generated RPG. " +
  "Given an NPC and a 1-sentence seed describing their situation, " +
  "you write ONE complete side quest with title, objective, completion " +
  "condition, and optional reward hint. Quests must feel native to " +
  "the world's tone, not generic fetch tasks. Respond ONLY with valid " +
  "JSON matching the schema. No markdown, no code fences, no prose.";

const DISCOVERY_TRIGGERS: QuestDiscoveryTrigger[] = ["npc_dialogue", "npc_rumor"];
const COMPLETION_TYPES: QuestCompletionCondition["type"][] = [
  "item", "location", "enemy_defeated", "npc_return",
];

function stripJsonFences(raw: string): string {
  return raw
    .trim()
    .replace(/^```(?:json)?\n?/i, "")
    .replace(/\n?```$/i, "")
    .trim();
}

function buildPrompt(
  npcs:     NPCDefinition[],
  regionId: string,
  ctx:      SideQuestGenerationContext,
): string {
  const npcBlocks = npcs.map((npc, i) => [
    `NPC ${i + 1}:`,
    `  id:               ${npc.id}`,
    `  name:             ${npc.name}`,
    `  role:             ${npc.role}`,
    `  home_location_id: ${npc.home_location_id}`,
    `  personality:      ${npc.personality}`,
    `  seed:             "${npc.quest_seed ?? "(missing — invent a plausible situation)"}"`,
  ].join("\n")).join("\n\n");

  return `WORLD CONTEXT (informs tone — never break this):
  world:      ${ctx.world_name}
  archetype:  ${ctx.archetype}   (internal — never named in quest copy)
  threat:     ${ctx.threat_description}
  genre:      ${ctx.genre}
  tone:       ${ctx.tone}

REGION CONTEXT:
  region_id: ${regionId}

QUEST-HOOK NPCs (${npcs.length}):

${npcBlocks}

TASK
Write ONE SideQuest for EACH NPC above. Output JSON shape:

{
  "side_quests": [
    {
      "id":                "${regionId}_<npc-slug>_quest",
      "title":             "Evocative title — NOT 'Retrieve Item Quest' or 'Help Innkeeper'",
      "status":            "active",
      "source_type":       "npc",
      "source_id":         "<the NPC's id>",
      "giver_name":        "<the NPC's display name>",
      "region_id":         "${regionId}",
      "discovery_trigger": "npc_dialogue" or "npc_rumor",
      "current_objective": "1 sentence — what to DO now. Directional, never a map pin. Pure prose.",
      "completion_condition": {
        "type":       "item" | "location" | "enemy_defeated" | "npc_return",
        "target_id":  "<id of the item / location / enemy / npc that completes the quest>"
      },
      "reward_hint":       "1 sentence — what the player might get. Optional; omit field if no reward.",
      "entries":           [],
      "can_fail":          false,
      "discovered":        false
    }
  ]
}

GUIDELINES

Title: evocative noun phrase rooted in the seed's situation. Examples:
  GOOD: "The Waiting Shipment" / "Three Seasons in the Barrow"
  BAD:  "Help Marta" / "Retrieve Medicines"

discovery_trigger:
  "npc_dialogue" when the seed implies the NPC directly asks for help.
  "npc_rumor"    when the seed is a situation they describe without
    asking. Default to "npc_dialogue" when ambiguous.

current_objective: 1 sentence, present tense, directional. NEVER a
location coordinate. Examples:
  GOOD: "Find out what happened to the eastern pass shipment."
  BAD:  "Travel northeast for 12 units and search the road."

completion_condition.type — pick based on the seed:
  item            — quest ends when player has a specific item
  location        — quest ends when player visits a specific node
  enemy_defeated  — quest ends when player kills a specific enemy
  npc_return      — quest ends when player returns to source NPC

completion_condition.target_id — best-guess id based on the seed's
content. If too vague to pin a target, default to "<npc.id>_return"
with type "npc_return".

reward_hint: omit when the seed gives no clear payoff. When set,
1 sentence, tonal. NOT a generic "gold and items".

KEEP RESPONSE UNDER 600 TOKENS. Be concise. No reasoning prose
outside the JSON. No markdown. Pure JSON only.`;
}

function validateAndNormalize(raw: unknown, regionId: string): SideQuest[] {
  if (!raw || typeof raw !== "object") return [];
  const o = raw as { side_quests?: unknown };
  if (!Array.isArray(o.side_quests)) return [];

  const out: SideQuest[] = [];
  for (const entry of o.side_quests) {
    if (!entry || typeof entry !== "object") continue;
    const q = entry as Record<string, unknown>;
    const id       = typeof q.id        === "string" ? q.id.trim()        : "";
    const title    = typeof q.title     === "string" ? q.title.trim()     : "";
    const sourceId = typeof q.source_id === "string" ? q.source_id.trim() : "";
    if (!id || !title || !sourceId) continue;

    const objective =
      typeof q.current_objective === "string" && q.current_objective.trim()
        ? q.current_objective.trim()
        : "Investigate further.";

    const triggerRaw = typeof q.discovery_trigger === "string" ? q.discovery_trigger : "npc_dialogue";
    const discovery_trigger: QuestDiscoveryTrigger =
      (DISCOVERY_TRIGGERS as string[]).includes(triggerRaw)
        ? (triggerRaw as QuestDiscoveryTrigger)
        : "npc_dialogue";

    let completion_condition: QuestCompletionCondition | undefined;
    if (q.completion_condition && typeof q.completion_condition === "object") {
      const cc = q.completion_condition as Record<string, unknown>;
      const typeRaw   = typeof cc.type      === "string" ? cc.type      : "";
      const targetRaw = typeof cc.target_id === "string" ? cc.target_id : "";
      if ((COMPLETION_TYPES as string[]).includes(typeRaw) && targetRaw.trim()) {
        completion_condition = {
          type:      typeRaw as QuestCompletionCondition["type"],
          target_id: targetRaw.trim(),
        };
      }
    }

    const giverName  = typeof q.giver_name  === "string" && q.giver_name.trim()
      ? q.giver_name.trim()
      : undefined;
    const rewardHint = typeof q.reward_hint === "string" && q.reward_hint.trim()
      ? q.reward_hint.trim()
      : undefined;

    out.push({
      id,
      title,
      status:            "active",
      source_type:       "npc",
      ...(giverName ? { giver_name: giverName } : {}),
      source_id:         sourceId,
      region_id:         regionId,
      discovery_trigger,
      ...(completion_condition ? { completion_condition } : {}),
      ...(rewardHint ? { reward_hint: rewardHint } : {}),
      current_objective: objective,
      entries:           [],
      can_fail:          false,
      discovered:        false,
    });
  }
  return out;
}

/**
 * Filter the input NPC array to those with quest_hook: true. Public so
 * apply-regional-bible can short-circuit the generation call when zero
 * hooks exist (saves the haiku round-trip).
 */
export function filterQuestHookNpcs(npcs: NPCDefinition[]): NPCDefinition[] {
  return npcs.filter((n) => n && n.quest_hook === true);
}

/**
 * Core generator. Returns the parsed + validated SideQuest array.
 * Empty array on parse failure / Anthropic error — never throws so
 * the apply flow can call this without a try/catch.
 */
export async function generateSideQuests(params: {
  npcs:     NPCDefinition[];
  regionId: string;
  ctx:      SideQuestGenerationContext;
  client:   Anthropic;
}): Promise<SideQuest[]> {
  const { npcs, regionId, ctx, client } = params;
  const hookNpcs = filterQuestHookNpcs(npcs);
  if (hookNpcs.length === 0) return [];

  try {
    const message = await client.messages.create({
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 800,
      system:     SYSTEM_PROMPT,
      messages:   [{ role: "user", content: buildPrompt(hookNpcs, regionId, ctx) }],
    });
    const rawText = message.content[0]?.type === "text" ? message.content[0].text : "";

    let parsed: unknown;
    try {
      parsed = JSON.parse(stripJsonFences(rawText));
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "JSON parse failed";
      console.error(`[SideQuests] parse failed for ${regionId}:`, errMsg);
      return [];
    }

    return validateAndNormalize(parsed, regionId);
  } catch (err) {
    console.error("[SideQuests] Anthropic call failed:", err);
    return [];
  }
}

/**
 * Dedup helper. Returns the merged SideQuest array — existing quests
 * are preserved verbatim (player progress lives on the existing
 * objects), new quests are appended. Idempotent: re-applying the same
 * RegionBible never adds the same quest twice.
 */
export function mergeSideQuests(
  existing: SideQuest[],
  fresh:    SideQuest[],
): SideQuest[] {
  const haveIds = new Set(existing.map((q) => q.id));
  const additions = fresh.filter((q) => !haveIds.has(q.id));
  return [...existing, ...additions];
}
