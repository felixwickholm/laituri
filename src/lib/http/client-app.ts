/** The label when a caller gives no way to tell which application it is. */
export const UNKNOWN_CLIENT = "Unknown client";

/** The label for the scripted buyer agent the console's scenes run in process. */
export const SCRIPTED_CLIENT = "Scripted buyer agent";

const MAX_LABEL = 60;

/** MCP clientInfo.name values, matched without regard to case. */
const MCP_CLIENTS: [RegExp, string][] = [
  [/^claude-code/i, "Claude Code"],
  [/^claude/i, "Claude"],
  [/^(openai|chatgpt)/i, "ChatGPT"],
  [/cursor/i, "Cursor"],
  [/^codex/i, "Codex"],
  [/^gemini/i, "Gemini CLI"],
  [/windsurf/i, "Windsurf"],
  [/(visual studio code|vscode)/i, "VS Code"],
  [/inspector/i, "MCP Inspector"],
];

/** User-Agent headers, first match wins. */
const USER_AGENTS: [RegExp, string][] = [
  [/^curl\//i, "curl"],
  [/claude-code/i, "Claude Code"],
  [/claude-user|anthropic/i, "Claude"],
  [/chatgpt|openai/i, "ChatGPT"],
  [/cursor/i, "Cursor"],
  [/postmanruntime/i, "Postman"],
  [/httpie/i, "HTTPie"],
  [/python-(requests|httpx)|aiohttp/i, "Python script"],
  [/^(node|undici)/i, "Node.js script"],
  [/^mozilla\//i, "Browser"],
];

function tidy(value: string | undefined): string | undefined {
  const text = value?.replace(/\s+/g, " ").trim().slice(0, MAX_LABEL);
  return text || undefined;
}

/** The name an MCP client reported in initialize: a known client by its product name, else as reported. */
export function clientFromInfo(info: { name?: unknown; title?: unknown } | undefined): string | undefined {
  const name = typeof info?.name === "string" ? tidy(info.name) : undefined;
  const title = typeof info?.title === "string" ? tidy(info.title) : undefined;
  if (!name) return title;
  return MCP_CLIENTS.find(([pattern]) => pattern.test(name))?.[1] ?? title ?? name;
}

export function clientFromUserAgent(userAgent: string | undefined): string | undefined {
  const value = tidy(userAgent);
  return value ? USER_AGENTS.find(([pattern]) => pattern.test(value))?.[1] : undefined;
}

export interface ClientSignals {
  /** From the MCP initialize request's clientInfo. */
  mcp?: string;
  /** The X-Agent-Client header. */
  header?: string;
  userAgent?: string;
}

/** Which application made a call: MCP clientInfo, else X-Agent-Client, else a known User-Agent. */
export function clientLabel(signals: ClientSignals): string {
  return tidy(signals.mcp) ?? tidy(signals.header) ?? clientFromUserAgent(signals.userAgent) ?? UNKNOWN_CLIENT;
}
