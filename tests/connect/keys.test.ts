import { describe, expect, it } from "vitest";
import type { WorkspaceInfo } from "@/lib/contracts";
import { buyersFirst, keyFor, keyNote } from "@/lib/connect/keys";
import { DEMO_KEY } from "@/lib/connect/requests";

const HARBOUR = "fi:ovt:003712345678";
const KAISLA = "fi:ovt:003723456789";

const entry = (id: string, name: string, key: string) => ({
  buyer: { id, name },
  agent: { id: `agent:${key}`, name: `${name} agent` },
  key,
  mcpUrl: `https://laituri.example/mcp?key=${key}`,
});

const sandbox: WorkspaceInfo = {
  kind: "sandbox",
  label: "Sandbox Q7MX",
  createdAt: "2026-11-14T08:00:00.000Z",
  expiresAt: "2026-11-14T09:00:00.000Z",
  agentKeys: [entry(KAISLA, "Kaisla School Kitchens", "lsk_kaisla"), entry(HARBOUR, "Nordic Harbour Hotels", "lsk_harbour")],
  mcpUrl: "https://laituri.example/mcp",
};

describe("agent keys", () => {
  it("uses this browser's own key for the chosen buyer", () => {
    expect(keyFor(sandbox, HARBOUR)).toBe("lsk_harbour");
    expect(keyFor(sandbox, KAISLA)).toBe("lsk_kaisla");
  });

  it("shows the shared public key only until the workspace answers, or for a buyer it does not list", () => {
    expect(keyFor(undefined, HARBOUR)).toBe(DEMO_KEY);
    expect(keyFor(sandbox, "fi:ovt:unknown")).toBe(DEMO_KEY);
  });

  it("lists the primary buyer first and keeps the others in the server's order", () => {
    expect(buyersFirst(sandbox, HARBOUR).map((key) => key.buyer.id)).toEqual([HARBOUR, KAISLA]);
    expect(buyersFirst(undefined, HARBOUR)).toEqual([]);
  });

  it("claims the key is the visitor's own only in a sandbox", () => {
    expect(keyNote("sandbox")).toBe("This key is yours. Its calls show up only for you.");
    expect(keyNote("shared")).toContain("shared workspace");
    expect(keyNote("shared")).not.toContain("yours");
    expect(keyNote(undefined)).toBeUndefined();
  });
});
