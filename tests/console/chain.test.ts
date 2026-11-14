import { describe, expect, it } from "vitest";
import { linkState } from "@/lib/console/format/chain";

describe("linkState", () => {
  const broken = { state: "broken" as const, entries: 36, brokenAt: 34, reason: "Entry 34 was changed after it was written." };

  it("breaks at the changed entry and distrusts everything written after it", () => {
    expect(linkState(33, broken)).toBe("verified");
    expect(linkState(34, broken)).toBe("broken");
    expect(linkState(35, broken)).toBe("untrusted");
  });

  it("follows the whole-chain state otherwise", () => {
    expect(linkState(5, { state: "verified", entries: 9 })).toBe("verified");
    expect(linkState(5, { state: "checking", entries: 9 })).toBe("unknown");
  });
});
