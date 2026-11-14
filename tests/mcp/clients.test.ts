import { describe, expect, it } from "vitest";
import { initializeClient, mcpClient } from "@/lib/mcp/clients";

const initialize = (name: string) =>
  JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", clientInfo: { name, version: "1" } } });
const toolCall = JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "get_mandate", arguments: {} } });

describe("MCP client names", () => {
  it("reads clientInfo from an initialize request, alone or in a batch", () => {
    expect(initializeClient(initialize("claude-code"))).toBe("Claude Code");
    expect(initializeClient(`[${initialize("cursor-vscode")},${toolCall}]`)).toBe("Cursor");
    expect(initializeClient(toolCall)).toBeUndefined();
    expect(initializeClient("{not json")).toBeUndefined();
  });

  it("matches later calls to the client that initialized with the same credential and User-Agent", () => {
    const headers = new Headers({ authorization: "Bearer demo-kaisla-token", "user-agent": "agent-runtime/1" });
    expect(mcpClient(headers, initialize("openai-mcp"))).toBe("ChatGPT");
    expect(mcpClient(headers, toolCall)).toBe("ChatGPT");
    expect(mcpClient(new Headers({ authorization: "Bearer demo-laine-token", "user-agent": "agent-runtime/1" }), toolCall)).toBeUndefined();
  });
});
