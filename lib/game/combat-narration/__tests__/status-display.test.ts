// Prompt 5 — getStatusDisplayName: canonical capitalization + WCD
// status_effect_alias resolution (the "rootblight" rule).

import { getStatusDisplayName } from "../status-display";

describe("getStatusDisplayName", () => {
  it("returns the capitalized canonical id when no WCD is supplied", () => {
    expect(getStatusDisplayName("poisoned", undefined)).toBe("Poisoned");
  });

  it("returns the world alias when the WCD declares one for the id", () => {
    const wcd = {
      status_effect_aliases: [
        { canonical_id: "poisoned" as const, world_name: "Rootblight" },
      ],
    };
    expect(getStatusDisplayName("poisoned", wcd)).toBe("Rootblight");
  });

  it("falls back to the capitalized id when the WCD has no matching alias", () => {
    const wcd = {
      status_effect_aliases: [
        { canonical_id: "poisoned" as const, world_name: "Rootblight" },
      ],
    };
    expect(getStatusDisplayName("burning", wcd)).toBe("Burning");
  });

  it("falls back to the capitalized id when status_effect_aliases is empty", () => {
    expect(
      getStatusDisplayName("burning", { status_effect_aliases: [] })
    ).toBe("Burning");
  });
});
