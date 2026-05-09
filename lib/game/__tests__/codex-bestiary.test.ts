import { writeBestiaryEntry } from "../codex";
import type { CodexEntry } from "@/types/game";

// Mock the Supabase client used inside saveCodexEntry. Both calls
// (the existence pre-check and the upsert) hit `supabase.from("codex")`.
// We track the last upserted row so the test can assert against it.

interface UpsertCapture {
  row?:        Record<string, unknown>;
  conflict?:   string;
  ignoreDup?:  boolean;
}
const upsertCapture: UpsertCapture = {};
let preCheckExists = false;

jest.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: () => ({
      // Used by saveCodexEntry's existence pre-check. Returns
      // { data: { entry_id } | null } to signal whether the row
      // already exists.
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () =>
              preCheckExists
                ? { data: { entry_id: "captured" } }
                : { data: null },
          }),
        }),
      }),
      // Used by saveCodexEntry's upsert. Captures args for assertions.
      upsert: async (
        row: Record<string, unknown>,
        opts: { onConflict?: string; ignoreDuplicates?: boolean }
      ) => {
        upsertCapture.row       = row;
        upsertCapture.conflict  = opts?.onConflict;
        upsertCapture.ignoreDup = opts?.ignoreDuplicates;
        return { error: null };
      },
    }),
  }),
}));

const SESSION_ID = "session-123";
const ENEMY = {
  id:          "fantasy_goblin",
  name:        "Goblin",
  description: "A wiry green-skinned scrapper.",
  hp_range:    [6, 10] as [number, number],
  damage_die:  "1d6",
};

describe("writeBestiaryEntry", () => {
  beforeEach(() => {
    upsertCapture.row       = undefined;
    upsertCapture.conflict  = undefined;
    upsertCapture.ignoreDup = undefined;
    preCheckExists = false;
  });

  it("writes a BESTIARY codex row on first encounter (created=true)", async () => {
    const result = await writeBestiaryEntry(
      SESSION_ID,
      ENEMY,
      "the_thorned_cloister",
      "The Thorned Cloister"
    );
    expect(result.created).toBe(true);
    expect(upsertCapture.row).toBeDefined();
    expect(upsertCapture.row!.session_id).toBe(SESSION_ID);
    expect(upsertCapture.row!.category).toBe("BESTIARY");
    expect(upsertCapture.row!.name).toBe("Goblin");
    expect(upsertCapture.row!.first_seen_location).toBe("the_thorned_cloister");
    expect(upsertCapture.conflict).toBe("session_id,entry_id");
    expect(upsertCapture.ignoreDup).toBe(true);
  });

  it("includes HP range, damage die, and first-seen location in the description", async () => {
    await writeBestiaryEntry(
      SESSION_ID,
      ENEMY,
      "the_thorned_cloister",
      "The Thorned Cloister"
    );
    const desc = upsertCapture.row!.description as string;
    expect(desc.includes(ENEMY.description)).toBe(true);
    expect(desc.includes("HP: 6-10")).toBe(true);
    expect(desc.includes("Damage: 1d6")).toBe(true);
    expect(desc.includes("First seen: The Thorned Cloister")).toBe(true);
  });

  it("returns created=false on a repeat encounter (idempotency)", async () => {
    preCheckExists = true;  // simulate an existing row
    const result = await writeBestiaryEntry(
      SESSION_ID,
      ENEMY,
      "the_thorned_cloister",
      "The Thorned Cloister"
    );
    expect(result.created).toBe(false);
  });

  it("uses 'NOTABLE' significance", async () => {
    await writeBestiaryEntry(
      SESSION_ID,
      ENEMY,
      "the_thorned_cloister",
      "The Thorned Cloister"
    );
    expect(upsertCapture.row!.significance).toBe("NOTABLE");
  });

  it("type-checks against CodexEntry shape", () => {
    // Compile-time only: the returned shape from writeBestiaryEntry
    // is { created: boolean }. CodexEntry compatibility is enforced
    // by saveCodexEntry's parameter type. This guard just confirms
    // the test file can construct a CodexEntry of category BESTIARY.
    const probe: CodexEntry = {
      id:                  "bestiary_fantasy_goblin",
      category:            "BESTIARY",
      name:                "Goblin",
      description:         "test",
      first_seen_location: "x",
      significance:        "NOTABLE",
    };
    expect(probe.category).toBe("BESTIARY");
  });
});
