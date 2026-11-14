import { AGENT_TOKEN, jsonRequest } from "../http/env";
import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/mcp/route";
import { gateway } from "@/lib/gateway";
import type { SignedMandate } from "@/lib/orders/types";

const PROTOCOL = "2025-06-18";

async function callTool(name: string) {
  const request = jsonRequest("/mcp", {
    body: { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: {} } },
    headers: { authorization: `Bearer ${AGENT_TOKEN}`, "mcp-protocol-version": PROTOCOL },
  });
  return (await (await POST(request)).json()) as { result: { isError?: boolean; structuredContent?: unknown; content: { text: string }[] } };
}

describe("MCP output validation", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("answers a tool error, never the raw object, when a result does not match the output schema", async () => {
    const { mandate } = await gateway().getMandate();
    // A wrong type for jws makes the result invalid; the extra field must never reach the caller.
    const malformed = { mandate, jws: 42, internalCostPrice: 0.42 } as unknown as SignedMandate;
    vi.spyOn(gateway(), "getMandate").mockResolvedValue(malformed);
    const { result } = await callTool("get_mandate");
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toBeUndefined();
    expect(result.content[0].text).toBe("The get_mandate result did not match its published schema, so it was withheld.");
    expect(JSON.stringify(result)).not.toMatch(/internal/);
  });
});
