import { describe, expect, it } from "vitest";
import { rolesToSignIn } from "@/components/session/sandbox-sign-in";
import type { ConsoleSession } from "@/lib/console/types";

function session(patch: Partial<ConsoleSession> = {}): ConsoleSession {
  return {
    signedIn: false,
    mode: "open",
    demoAccess: true,
    buyers: [],
    workspace: "sandbox",
    operator: { signedIn: false, mode: "open" },
    ...patch,
  } as ConsoleSession;
}

describe("signing a sandbox in without asking", () => {
  it("signs both the purchasing manager and the Valio Aimo operator in, in a visitor's own sandbox", () => {
    expect(rolesToSignIn(session())).toEqual(["approver", "operator"]);
  });

  it("signs in only the role that is still missing", () => {
    expect(rolesToSignIn(session({ signedIn: true, demo: true }))).toEqual(["operator"]);
    expect(rolesToSignIn(session({ operator: { signedIn: true, demo: true, mode: "open" } }))).toEqual(["approver"]);
    expect(rolesToSignIn(session({ signedIn: true, operator: { signedIn: true, mode: "open" } }))).toEqual([]);
  });

  it("never signs anyone in where the server offers no demo access: the shared workspace and production keep the passcode", () => {
    expect(rolesToSignIn(session({ demoAccess: false, workspace: "shared", mode: "passcode" }))).toEqual([]);
    expect(rolesToSignIn(undefined)).toEqual([]);
  });
});
