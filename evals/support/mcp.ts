import { AGENT_AUTH, post, type Reply } from "./router";

const PROTOCOL = "2025-06-18";
let nextId = 1;

export interface RpcResult<T> {
  reply: Reply;
  result?: T;
  error?: { code: number; message: string };
}

export interface ToolResult {
  isError?: boolean;
  structuredContent?: Record<string, unknown>;
  content?: { type: string; text?: string }[];
}

/** One JSON-RPC call to the stateless MCP endpoint, as the agent. */
export async function rpc<T>(method: string, params: unknown = {}, headers: Record<string, string> = AGENT_AUTH): Promise<RpcResult<T>> {
  const reply = await post("/mcp", { jsonrpc: "2.0", id: nextId++, method, params }, { ...headers, "mcp-protocol-version": PROTOCOL });
  const body = reply.body as { result?: T; error?: { code: number; message: string } } | undefined;
  return { reply, result: body?.result, error: body?.error };
}

export function callTool(name: string, args: Record<string, unknown>): Promise<RpcResult<ToolResult>> {
  return rpc<ToolResult>("tools/call", { name, arguments: args });
}
