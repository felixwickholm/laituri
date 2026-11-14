import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/console/api";
import { demoOffered, isDemoSession, passcodeOffered, roleSession, signInError, withoutRole } from "@/lib/console/session";
import type { ConsoleSession } from "@/lib/console/types";

const SIGNED_OUT: ConsoleSession = { signedIn: false, mode: "open", demoAccess: true, workspace: "sandbox", operator: { signedIn: false, mode: "open" } };

const BOTH: ConsoleSession = {
  ...SIGNED_OUT,
  signedIn: true,
  approver: { id: "user:maria", name: "Maria Lind" },
  buyer: { id: "buyer:harbour", name: "Nordic Harbour Hotels" },
  demo: true,
  operator: { signedIn: true, operator: { id: "operator:valio-aimo", name: "Valio Aimo operator (demo access)" }, demo: true, mode: "open" },
};

describe("the session for each side", () => {
  it("reads the approver and the operator in one shape", () => {
    expect(roleSession(BOTH, "approver")).toEqual({ signedIn: true, name: "Maria Lind", demo: true, mode: "open" });
    expect(roleSession(BOTH, "operator")).toMatchObject({ signedIn: true, demo: true });
    expect(roleSession(undefined, "operator").signedIn).toBe(false);
    expect(isDemoSession(BOTH, "operator")).toBe(true);
    expect(isDemoSession(SIGNED_OUT)).toBe(false);
  });

  it("offers demo access only when the server says so", () => {
    expect(demoOffered(SIGNED_OUT)).toBe(true);
    expect(demoOffered({ ...SIGNED_OUT, demoAccess: false })).toBe(false);
    expect(demoOffered(undefined)).toBe(false);
  });

  it("offers the passcode when one is set, or on an open server without demo access, never when closed", () => {
    expect(passcodeOffered(SIGNED_OUT, "approver")).toBe(false);
    expect(passcodeOffered({ ...SIGNED_OUT, demoAccess: false }, "approver")).toBe(true);
    expect(passcodeOffered({ ...SIGNED_OUT, operator: { signedIn: false, mode: "passcode" } }, "operator")).toBe(true);
    expect(passcodeOffered({ ...SIGNED_OUT, demoAccess: false, mode: "closed" }, "approver")).toBe(false);
  });

  it("signs out one side and keeps the other", () => {
    expect(withoutRole(BOTH, "operator")).toMatchObject({ signedIn: true, operator: { signedIn: false, mode: "open" } });
    expect(withoutRole(BOTH, "approver")).toMatchObject({ signedIn: false, approver: undefined, operator: { signedIn: true } });
    expect(withoutRole(BOTH)).toMatchObject({ signedIn: false, operator: { signedIn: false } });
  });

  it("says why a sign-in failed in the server's words", () => {
    expect(signInError(new ApiError(403, "The passcode is not correct.", "wrong_passcode"))).toBe("That passcode is not correct.");
    expect(signInError(new ApiError(403, "Demo access works only in your own sandbox.", "demo_access_sandbox_only"))).toBe("Demo access works only in your own sandbox.");
    expect(signInError(new TypeError("fetch failed"))).toBe("Sign-in did not reach the server.");
  });
});
