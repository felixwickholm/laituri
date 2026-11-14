import { createHash } from "node:crypto";
import { bearerToken } from "@/lib/http/agent";
import { clientFromInfo } from "@/lib/http/client-app";

/** Enough callers for a demo; the oldest is forgotten first. */
const MAX_REMEMBERED = 500;

const holder = globalThis as typeof globalThis & { __laituriMcpClients?: Map<string, string> };
const remembered = (holder.__laituriMcpClients ??= new Map<string, string>());

/** One caller: its credential (hashed, never kept as is) and its User-Agent. */
function callerKey(headers: Headers): string {
  const token = bearerToken(headers);
  const credential = token ? createHash("sha256").update(token).digest("hex") : "anonymous";
  return `${credential}|${headers.get("user-agent") ?? ""}`;
}

interface Message {
  method?: unknown;
  params?: { name?: unknown; clientInfo?: { name?: unknown; title?: unknown } };
}

/** The JSON-RPC messages in a body, one message or a batch; none when it is not JSON. */
function messagesOf(body: string): Message[] {
  try {
    const parsed: unknown = JSON.parse(body);
    return (Array.isArray(parsed) ? parsed : [parsed]).filter((message): message is Message => typeof message === "object" && message !== null);
  } catch {
    return [];
  }
}

/** The client name in an initialize request's clientInfo, if the body (one message or a batch) holds one. */
export function initializeClient(body: string): string | undefined {
  const initialize = messagesOf(body).find((message) => message.method === "initialize");
  return clientFromInfo(initialize?.params?.clientInfo);
}

/** The MCP call as the audit log names it: "MCP tools/call request_quote", or "MCP initialize". */
export function mcpCall(body: string): string {
  const calls = messagesOf(body).map((message) => {
    const method = typeof message.method === "string" ? message.method : "message";
    return typeof message.params?.name === "string" ? `${method} ${message.params.name}` : method;
  });
  return `MCP ${calls.join(", ") || "request"}`;
}

/**
 * The client application behind an MCP request. The server is stateless, so only the initialize request carries
 * clientInfo; later requests from the same credential and User-Agent are matched to it.
 */
export function mcpClient(headers: Headers, body: string): string | undefined {
  const key = callerKey(headers);
  const reported = initializeClient(body);
  if (!reported) return remembered.get(key);
  remembered.delete(key);
  remembered.set(key, reported);
  if (remembered.size > MAX_REMEMBERED) remembered.delete(remembered.keys().next().value as string);
  return reported;
}
