import { describe, expect, it } from "vitest";
import type { WorkspaceInfo } from "@/lib/contracts";
import { engineLine } from "@/lib/console/format/engine";
import { timeLeft, workspaceLine } from "@/lib/console/format/workspace";

const NOW = Date.parse("2026-11-14T10:00:00.000Z");

function info(patch: Partial<WorkspaceInfo>): WorkspaceInfo {
  return { kind: "sandbox", label: "Sandbox Q7MX", createdAt: "2026-11-14T09:00:00.000Z", agentKeys: [], mcpUrl: "http://localhost/mcp", ...patch };
}

describe("the workspace indicator", () => {
  it("names a sandbox as private to this browser, with the time it has left", () => {
    expect(workspaceLine(info({ expiresAt: "2026-11-14T10:58:00.000Z" }), NOW)).toEqual({
      label: "Sandbox Q7MX",
      privacy: "private to this browser",
      timeLeft: "58 min left",
      shared: false,
    });
  });

  it("says the shared workspace is seen by everyone and read-only", () => {
    expect(workspaceLine(info({ kind: "shared", label: "Shared" }), NOW)).toMatchObject({ label: "Shared workspace", shared: true });
  });

  it("rounds the time left to the minute, never below one, and shows hours past sixty minutes", () => {
    expect(timeLeft("2026-11-14T10:00:20.000Z", NOW)).toBe("1 min left");
    expect(timeLeft("2026-11-14T09:59:00.000Z", NOW)).toBe("1 min left");
    expect(timeLeft("2026-11-14T11:30:00.000Z", NOW)).toBe("1 h 30 min left");
    expect(timeLeft("2026-11-14T12:00:00.000Z", NOW)).toBe("2 h left");
    expect(timeLeft("not a date", NOW)).toBeUndefined();
  });
});

describe("the agent engine line", () => {
  it("names the engine the server reports, and nothing before it has answered", () => {
    expect(engineLine(undefined)).toBeUndefined();
    expect(engineLine({ status: "ok", mode: "recorded" })).toBeUndefined();
    expect(engineLine({ status: "ok", mode: "recorded", agent: { engine: "scripted" } })).toEqual({ text: "Agent engine: scripted" });
    expect(engineLine({ status: "ok", mode: "live", agent: { engine: "gemini", model: "gemini-2.5-flash" } })).toEqual({ text: "Agent engine: Gemini", model: "gemini-2.5-flash" });
    expect(engineLine({ status: "ok", mode: "live", agent: { engine: "claude", model: "claude-sonnet-5-5" } })?.text).toBe("Agent engine: Claude");
  });
});
