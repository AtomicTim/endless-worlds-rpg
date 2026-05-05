import type { ParsedAction } from "@/types/game";

export type DialogueTone = NonNullable<ParsedAction["dialogue_tone"]>;

/**
 * Single canonical heuristic for tone classification — used by:
 *   - the parse-intent server route's quoted-input fast-path
 *   - the resolver's fallback when an action has no parser-supplied tone
 *
 * Lives in one place so server + client agree. The matching prefers
 * specific markers (threats, deception cues) over general ones; falls
 * back to "neutral" when nothing matches.
 *
 * Speech is the player's actual quoted utterance — the markers are
 * tuned for what a player typically writes, not for the narrator's
 * inferred_intent prose. Both call sites pass the speech-side string
 * (parse-intent passes the trimmed quote, resolver passes the
 * inferred_intent which embeds the quote as `says: "..."`).
 */
export function inferToneFromSpeech(speech: string): DialogueTone {
  const lower = speech.toLowerCase();
  if (/\b(threat|kill|hurt|burn|destroy|crush|shoot|stab|swear|or else|don't make me|i'll make you|i will end|intimidate|intimidation|bully|scare)\b/.test(lower)) {
    return "intimidating";
  }
  if (/\b(lie|trick|fool|fake|pretend|swear i didn't|i don't know anything|wasn't me|never met|deceive|deception|bluff|manipulate|cheat|seduce)\b/.test(lower)) {
    return "deceptive";
  }
  if (/\b(persuade|persuasion|convince|please believe|trust me|i promise|let me explain|deal|bargain|reward|in return|charm|beg|plead)\b/.test(lower)) {
    return "persuasive";
  }
  if (lower.includes("?") || /\b(what|how|why|where|when|who|which|do you|did you|have you|is it|are you|tell me)\b/.test(lower)) {
    return "curious";
  }
  if (/\b(thank you|thanks|hello|hi|please|kind|wonderful|appreciate|good day|greetings|nice to)\b/.test(lower)) {
    return "friendly";
  }
  return "neutral";
}
