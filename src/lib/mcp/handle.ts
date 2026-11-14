import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { resolveAgent } from "@/lib/http/agent";
import { errorResponse } from "@/lib/http/respond";
import { resolveWorkspace } from "@/lib/http/workspace";
import { inWorkspace } from "@/lib/workspace/context";
import { mcpCall, mcpClient } from "./clients";
import { createMcpServer } from "./server";

export const CORS_HEADERS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, GET, DELETE, OPTIONS",
  "access-control-allow-headers":
    "content-type, accept, authorization, mcp-protocol-version, mcp-session-id, last-event-id, x-agent-name, x-agent-client",
  "access-control-expose-headers": "mcp-session-id, mcp-protocol-version",
  "access-control-max-age": "86400",
};

export function withCors(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(CORS_HEADERS)) headers.set(key, value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

/** The transport insists on both types; plain HTTP clients often send neither. Responses are always JSON here. */
function withAcceptHeader(request: Request, body: string): Request {
  const headers = new Headers(request.headers);
  headers.set("accept", "application/json, text/event-stream");
  return new Request(request.url, { method: "POST", headers, body });
}

/**
 * Chat apps take a server address but no custom header, so the demo accepts the agent's key in the address (?key=).
 * A header wins when both are sent. Production uses OAuth instead.
 */
function withKeyFromAddress(request: Request): Headers {
  const headers = new Headers(request.headers);
  const key = new URL(request.url).searchParams.get("key");
  if (key && !headers.has("authorization")) headers.set("authorization", `Bearer ${key}`);
  return headers;
}

/**
 * Handles one stateless MCP POST: a fresh server and transport per request, JSON responses, no sessions.
 * It runs in the workspace the agent's key belongs to, like a REST call.
 */
export async function handleMcpPost(request: Request): Promise<Response> {
  const headers = withKeyFromAddress(request);
  let resolved;
  try {
    resolved = await resolveWorkspace(headers);
  } catch (error) {
    return withCors(errorResponse(error));
  }
  return inWorkspace(resolved.workspace, () => serveMcp(request, headers));
}

async function serveMcp(request: Request, headers: Headers): Promise<Response> {
  const body = await request.text();
  let agent;
  try {
    agent = await resolveAgent(headers, mcpCall(body), mcpClient(headers, body));
  } catch (error) {
    return withCors(errorResponse(error));
  }
  const server = createMcpServer(agent);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  try {
    await server.connect(transport);
    const response = await transport.handleRequest(withAcceptHeader(request, body));
    return withCors(response);
  } finally {
    await transport.close();
    await server.close();
  }
}

export function mcpMethodNotAllowed(): Response {
  return withCors(
    new Response(
      JSON.stringify({
        jsonrpc: "2.0",
        error: { code: -32000, message: "This server is stateless. Send JSON-RPC requests with POST." },
        id: null,
      }),
      { status: 405, headers: { "content-type": "application/json", allow: "POST, OPTIONS" } },
    ),
  );
}

export function mcpPreflight(): Response {
  return withCors(new Response(null, { status: 204 }));
}
