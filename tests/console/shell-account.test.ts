import { describe, expect, it } from "vitest";
import { accountFor, demoFacts, engineChip, initials, sharedLocked } from "@/lib/console/format/workspace";
import type { ConsoleSession } from "@/lib/console/types";

const SIGNED_OUT: ConsoleSession = { signedIn: false, mode: "open", demoAccess: true, workspace: "sandbox", operator: { signedIn: false, mode: "open" } };

const DEMO: ConsoleSession = {
  ...SIGNED_OUT,
  signedIn: true,
  approver: { id: "user:maria", name: "Maria Lind" },
  demo: true,
  operator: { signedIn: true, operator: { id: "operator:valio-aimo", name: "Valio Aimo operator (demo access)" }, demo: true, mode: "open" },
};

const PASSCODE: ConsoleSession = { ...DEMO, demo: false, mode: "passcode", operator: { ...DEMO.operator, demo: false, mode: "passcode" } };

describe("the account row", () => {
  it("names the approver on the buyer side and the operator on the Valio Aimo side, with demo access as the role", () => {
    expect(accountFor(DEMO, "approver", "Maria Lind")).toEqual({ signedIn: true, name: "Maria Lind", role: "Approver", initials: "ML" });
    expect(accountFor(DEMO, "operator", "Maria Lind")).toEqual({ signedIn: true, name: "Valio Aimo operator", role: "Operator", initials: "VA" });
  });

  it("shows the role title after a passcode sign-in", () => {
    expect(accountFor(PASSCODE, "approver", "Maria Lind").role).toBe("Approver");
    expect(accountFor(PASSCODE, "operator", "Maria Lind").role).toBe("Operator");
  });

  it("falls back to the mandate's approver while signed out", () => {
    expect(accountFor(SIGNED_OUT, "approver", "Maria Lind, Head of Purchasing")).toMatchObject({ signedIn: false, name: "Maria Lind" });
    expect(accountFor(undefined, "operator", "Maria Lind").signedIn).toBe(false);
  });

  it("takes at most two initials", () => {
    expect(initials("Anna Maria Lind")).toBe("AM");
    expect(initials("  ")).toBe("");
  });
});

describe("the demo menu", () => {
  it("names the engine in words and keeps the model id apart", () => {
    expect(engineChip(undefined)).toBeUndefined();
    expect(engineChip({ status: "ok", mode: "live", agent: { engine: "scripted" } })).toEqual({ label: "Built-in agent" });
    expect(engineChip({ status: "ok", mode: "live", agent: { engine: "gemini", model: "gemini-2.5-flash" } })).toEqual({ label: "AI model: Gemini", model: "gemini-2.5-flash" });
    expect(engineChip({ status: "ok", mode: "live", agent: { engine: "claude" } })?.label).toBe("AI model: Claude");
  });

  it("says prices are live or recorded, and that orders are simulated", () => {
    expect(demoFacts("live")[0].value).toBe("Live from Valio Aimo");
    expect(demoFacts("recorded")[0].value).toBe("Recorded from Valio Aimo");
    expect(demoFacts("live")[1].value).toBe("Simulated, never shipped");
    expect(demoFacts(undefined).map((fact) => fact.label)).toEqual(["Prices and stock", "Orders", "Before today"]);
  });
});

describe("the shared workspace lock", () => {
  it("locks the shared workspace without a passcode session, and never the visitor's own sandbox", () => {
    expect(sharedLocked({ kind: "shared" }, SIGNED_OUT)).toBe(true);
    expect(sharedLocked({ kind: "shared" }, undefined)).toBe(true);
    expect(sharedLocked({ kind: "sandbox" }, SIGNED_OUT)).toBe(false);
    expect(sharedLocked(undefined, SIGNED_OUT)).toBe(false);
  });

  it("opens with a passcode session for either role, but not with a demo session left from the sandbox", () => {
    expect(sharedLocked({ kind: "shared" }, PASSCODE)).toBe(false);
    expect(sharedLocked({ kind: "shared" }, { ...SIGNED_OUT, operator: { signedIn: true, demo: false, mode: "passcode" } })).toBe(false);
    expect(sharedLocked({ kind: "shared" }, DEMO)).toBe(true);
  });
});
