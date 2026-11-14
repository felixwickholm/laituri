import { describe, expect, it } from "vitest";
import { UNKNOWN_CLIENT, clientFromInfo, clientFromUserAgent, clientLabel } from "@/lib/http/client-app";

describe("client application label", () => {
  it("names known MCP clients by product and keeps others as reported", () => {
    expect(clientFromInfo({ name: "claude-code" })).toBe("Claude Code");
    expect(clientFromInfo({ name: "claude-ai" })).toBe("Claude");
    expect(clientFromInfo({ name: "openai-mcp" })).toBe("ChatGPT");
    expect(clientFromInfo({ name: "cursor-vscode" })).toBe("Cursor");
    expect(clientFromInfo({ name: "my-agent", title: "Kitchen Planner" })).toBe("Kitchen Planner");
    expect(clientFromInfo({ name: "my-agent" })).toBe("my-agent");
    expect(clientFromInfo({ name: 42 })).toBeUndefined();
    expect(clientFromInfo(undefined)).toBeUndefined();
  });

  it("maps common User-Agent headers", () => {
    expect(clientFromUserAgent("curl/8.7.1")).toBe("curl");
    expect(clientFromUserAgent("python-requests/2.32")).toBe("Python script");
    expect(clientFromUserAgent("node")).toBe("Node.js script");
    expect(clientFromUserAgent("Mozilla/5.0 (Macintosh)")).toBe("Browser");
    expect(clientFromUserAgent("Something/1.0")).toBeUndefined();
  });

  it("prefers MCP clientInfo, then X-Agent-Client, then the User-Agent", () => {
    const all = { mcp: "Claude Code", header: "ChatGPT", userAgent: "curl/8" };
    expect(clientLabel(all)).toBe("Claude Code");
    expect(clientLabel({ ...all, mcp: undefined })).toBe("ChatGPT");
    expect(clientLabel({ userAgent: "curl/8" })).toBe("curl");
    expect(clientLabel({ header: "   " })).toBe(UNKNOWN_CLIENT);
    expect(clientLabel({})).toBe(UNKNOWN_CLIENT);
  });

  it("keeps a reported name short and on one line", () => {
    expect(clientLabel({ header: `My\n agent ${"x".repeat(100)}` })).toHaveLength(60);
  });
});
