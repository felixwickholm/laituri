import { describe, expect, it } from "vitest";
import { ANONYMOUS_AGENT } from "@/lib/http/agent";
import { SCRIPTED_CLIENT, UNKNOWN_CLIENT } from "@/lib/http/client-app";
import { KEYLESS_AGENT_ID, agentName, clientName, isKeyless } from "@/lib/supplier-console/names";

describe("client names", () => {
  it("names the command line and an unnamed app in plain words", () => {
    expect(clientName("curl")).toBe("Command line");
    expect(clientName(UNKNOWN_CLIENT)).toBe("Unknown app");
  });

  it("keeps every other app's own name", () => {
    expect(clientName("Claude Code")).toBe("Claude Code");
  });

  it("names the demo's scripted agent neutrally", () => {
    expect(clientName(SCRIPTED_CLIENT)).toBe("Laituri agent");
  });
});

describe("agent names", () => {
  it("knows the id the server logs keyless calls under", () => {
    expect(KEYLESS_AGENT_ID).toBe(ANONYMOUS_AGENT.id);
    expect(isKeyless(ANONYMOUS_AGENT)).toBe(true);
  });

  it("lists a caller without a key as such, keeping a name it gave", () => {
    expect(agentName(ANONYMOUS_AGENT)).toBe("No key presented");
    expect(agentName({ id: KEYLESS_AGENT_ID, name: "Test bot" })).toBe("Test bot · no key");
  });

  it("keeps a keyed agent's name from its mandate", () => {
    expect(agentName({ id: "agent:harbour-purchasing", name: "Harbour purchasing agent" })).toBe("Harbour purchasing agent");
  });
});
