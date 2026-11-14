import { describe, expect, it } from "vitest";
import { liveStatus, type CallRecord } from "@/lib/connect/activity";

const NOW = Date.parse("2026-11-14T12:00:00.000Z");

const call = (patch: Partial<CallRecord> = {}): CallRecord => ({
  id: "act_1",
  at: "2026-11-14T11:59:30.000Z",
  agent: { id: "agent:harbour", name: "Harbour purchasing agent" },
  kind: "tool",
  tool: "search_catalog",
  title: "Searched",
  status: "ok",
  client: "Claude Code",
  ...patch,
});

describe("liveStatus", () => {
  it("says it is checking until the health check answers", () => {
    expect(liveStatus("checking", [], NOW)).toMatchObject({ tone: "neutral", word: "Checking" });
  });

  it("shows a calm ready state as soon as the server answers, before any call", () => {
    expect(liveStatus("online", [], NOW)).toEqual({ tone: "success", word: "Ready", line: "The server is up. Waiting for your first call." });
  });

  it("names the newest caller and its app once a call has come in, even if the health check failed", () => {
    expect(liveStatus("offline", [call()], NOW)).toEqual({ tone: "success", word: "Connected", line: "Harbour purchasing agent via Claude Code, 30 s ago." });
    expect(liveStatus("online", [call({ client: undefined })], NOW).line).toBe("Harbour purchasing agent, 30 s ago.");
  });

  it("says plainly when the server did not answer", () => {
    expect(liveStatus("offline", [], NOW)).toMatchObject({ tone: "danger", word: "No answer" });
  });
});
