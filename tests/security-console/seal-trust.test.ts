import { describe, expect, it } from "vitest";
import { FACTS } from "@/lib/evidence";
import { sealView } from "@/lib/security-console/seal";
import { testedLines, tokenTypes, upstreamLine } from "@/lib/security-console/trust";

describe("the record's seal", () => {
  it("says untouched with the entry count", () => {
    expect(sealView({ state: "verified", entries: 1234 }, 1234, false)).toEqual({ state: "verified", title: "Untouched", line: "1,234 entries. Checked on this device." });
  });

  it("names the changed entry", () => {
    expect(sealView({ state: "broken", entries: 40, brokenAt: 12, reason: "hash" }, 40, false).line).toBe("Entry 12 no longer matches its seal.");
  });

  it("names the earlier break when the page's replay found one too", () => {
    expect(sealView({ state: "broken", entries: 40, brokenAt: 30, reason: "hash" }, 40, false, 12).line).toBe("Entry 12 no longer matches its seal.");
  });

  it("says entries are missing when the break is past the newest entry", () => {
    expect(sealView({ state: "broken", entries: 30, brokenAt: 41, reason: "cut" }, 30, false).title).toBe("Entries are missing");
  });

  it("shows checking while the replay runs", () => {
    expect(sealView({ state: "verified", entries: 3 }, 3, true).state).toBe("checking");
  });
});

describe("tested", () => {
  it("reads the guardrail and trust counts from the measured facts", () => {
    const lines = testedLines(FACTS);
    expect(lines.map((line) => line.id)).toEqual(["guardrails", "trust"]);
    const guardrails = FACTS.evals.suites.find((suite) => suite.id === "guardrails");
    expect(lines[0].figure).toBe(`${guardrails?.passed} of ${guardrails?.total}`);
  });

  it("lists the signed token types", () => {
    expect(tokenTypes()).toContain("offer+jwt");
  });
});

describe("upstream line", () => {
  it("renders only when the health answer carries the counts", () => {
    expect(upstreamLine({ status: "ok", upstream: { ok: true } })).toBeUndefined();
    expect(upstreamLine(undefined)).toBeUndefined();
    expect(upstreamLine({ upstream: { calls: 80, productsAsked: 43 }, catalogueSize: 17546 })).toBe(
      "Valio Aimo’s price and stock systems are asked only about the few products a request needs: 43 of 17,546 this week.",
    );
  });
});
