import { parseIntent, IntentParserError } from "../intent-parser";
import { createNewMasterState } from "../state-factory";
import { Genre, Difficulty, ActionType } from "@/types/game";
import type { ParsedAction } from "@/types/game";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const MASTER_STATE = createNewMasterState(
  Genre.FANTASY,
  "Aria",
  "knight",
  Difficulty.NORMAL
);

const VALID_RESPONSE: ParsedAction = {
  action_type:     ActionType.MOVE,
  primary_target:  "north",
  inferred_intent: "The player wants to move north.",
  confidence:      0.95,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function mockFetchOk(body: unknown) {
  global.fetch = jest.fn().mockResolvedValueOnce({
    ok:   true,
    json: async () => body,
  });
}

function mockFetchFail() {
  global.fetch = jest.fn().mockResolvedValueOnce({
    ok:   false,
    json: async () => ({ error: "Internal server error" }),
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("parseIntent", () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it("returns a ParsedAction with correct shape for valid input", async () => {
    mockFetchOk(VALID_RESPONSE);

    const result = await parseIntent("go north", MASTER_STATE);

    expect(result.action_type).toBe(ActionType.MOVE);
    expect(typeof result.inferred_intent).toBe("string");
    expect(result.inferred_intent.length).toBeGreaterThan(0);
    expect(typeof result.confidence).toBe("number");
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it("throws a validation error for empty input", async () => {
    await expect(parseIntent("", MASTER_STATE)).rejects.toThrow(IntentParserError);
    await expect(parseIntent("   ", MASTER_STATE)).rejects.toThrow(IntentParserError);
  });

  it("throws a validation error with code VALIDATION for empty input", async () => {
    try {
      await parseIntent("", MASTER_STATE);
    } catch (err) {
      expect(err).toBeInstanceOf(IntentParserError);
      expect((err as IntentParserError).code).toBe("VALIDATION");
    }
  });

  it("throws a validation error for input over 500 characters", async () => {
    const longInput = "a".repeat(501);
    await expect(parseIntent(longInput, MASTER_STATE)).rejects.toThrow(IntentParserError);
  });

  it("throws a validation error with code VALIDATION for over-length input", async () => {
    try {
      await parseIntent("x".repeat(501), MASTER_STATE);
    } catch (err) {
      expect(err).toBeInstanceOf(IntentParserError);
      expect((err as IntentParserError).code).toBe("VALIDATION");
    }
  });

  it("returns a CUSTOM fallback action on API failure", async () => {
    mockFetchFail();

    const result = await parseIntent("do something", MASTER_STATE);

    expect(result.action_type).toBe(ActionType.CUSTOM);
    expect(result.inferred_intent).toBe("do something");
    expect(result.confidence).toBe(0.5);
  });

  it("returns a CUSTOM fallback action on network error", async () => {
    global.fetch = jest.fn().mockRejectedValueOnce(new Error("Network failure"));

    const result = await parseIntent("attack the goblin", MASTER_STATE);

    expect(result.action_type).toBe(ActionType.CUSTOM);
    expect(result.inferred_intent).toBe("attack the goblin");
  });

  it("trims whitespace before sending", async () => {
    mockFetchOk(VALID_RESPONSE);

    await parseIntent("  go north  ", MASTER_STATE);

    const body = JSON.parse(
      (global.fetch as jest.Mock).mock.calls[0][1].body as string
    ) as { input: string };
    expect(body.input).toBe("go north");
  });

  it("accepts exactly 500-character input without throwing", async () => {
    mockFetchOk(VALID_RESPONSE);
    const exactly500 = "a".repeat(500);
    await expect(parseIntent(exactly500, MASTER_STATE)).resolves.toBeDefined();
  });
});
