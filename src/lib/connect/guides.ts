import { AUTH_HEADER, DEMO_KEY, PATHS, PROMPT, orderBody, quoteBody, searchBody } from "./requests";

export type AppId = "claude-code" | "claude" | "chatgpt" | "cursor" | "grok" | "gemini" | "vscode" | "http";

export interface CodeBlock {
  value: string;
  /** What the copy button copies, in words, for its accessible name. */
  label: string;
  /** Prose and one-line commands wrap at spaces (the copy stays one line); configs keep their lines and scroll inside the block. */
  wrap?: boolean;
}

export interface Step {
  text: string;
  code?: CodeBlock;
}

export interface Guide {
  steps: Step[];
  /** Shown under the steps when the origin cannot be reached from the app's own servers. */
  localNote?: string;
  /** Machine-readable documents for this way of connecting. */
  links?: { href: string; label: string }[];
}

export const mcpUrl = (origin: string) => `${origin}${PATHS.mcp}`;

/** For chat apps that cannot send a header: the demo key travels in the address. */
export const mcpUrlWithKey = (origin: string) => `${mcpUrl(origin)}?key=${DEMO_KEY}`;

export function isLocalOrigin(origin: string): boolean {
  try {
    const host = new URL(origin).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host.endsWith(".local");
  } catch {
    return false;
  }
}

export function claudeCodeCommand(origin: string): string {
  return `claude mcp add --transport http laituri ${mcpUrl(origin)} --header "Authorization: ${AUTH_HEADER}"`;
}

const pretty = (value: unknown) => JSON.stringify(value, null, 2);

export function cursorConfig(origin: string): string {
  return pretty({ mcpServers: { laituri: { url: mcpUrl(origin), headers: { Authorization: AUTH_HEADER } } } });
}

export function vscodeConfig(origin: string): string {
  return pretty({ servers: { laituri: { type: "http", url: mcpUrl(origin), headers: { Authorization: AUTH_HEADER } } } });
}

export function geminiConfig(origin: string): string {
  return pretty({ mcpServers: { laituri: { httpUrl: mcpUrl(origin), headers: { Authorization: AUTH_HEADER } } } });
}

const CURL_HEADERS = `-H "Authorization: ${AUTH_HEADER}" \\\n  -H "Content-Type: application/json"`;

export function curlSearch(origin: string, deliverBy: string): string {
  return `curl -s ${origin}${PATHS.search} \\\n  ${CURL_HEADERS} \\\n  -d '${JSON.stringify(searchBody(deliverBy))}'`;
}

export function curlQuote(origin: string, deliverBy: string): string {
  return (
    `OFFER=$(curl -s ${origin}${PATHS.quotes} \\\n  ${CURL_HEADERS} \\\n` +
    `  -d '${JSON.stringify(quoteBody(deliverBy))}' | jq -r .primary.jws)`
  );
}

export function curlOrder(origin: string): string {
  const body = JSON.stringify(orderBody("$OFFER", "$MANDATE")).replaceAll('"', '\\"');
  return (
    `MANDATE=$(curl -s ${origin}${PATHS.mandate} -H "Authorization: ${AUTH_HEADER}" | jq -r .jws)\n` +
    `curl -s ${origin}${PATHS.orders} \\\n  ${CURL_HEADERS} \\\n` +
    `  -H "Idempotency-Key: milk-$(date +%s)" \\\n  -d "${body}"`
  );
}

const PROMPT_STEP: Step = { text: "Ask your agent to buy. Its calls show up under Connected right now.", code: { value: PROMPT, label: "Copy prompt", wrap: true } };

const LOCAL_NOTE =
  "This page runs on your own machine. Chat apps connect from their servers, so use the public address of a deployed Laituri.";

function connectorGuide(origin: string, where: string): Guide {
  return {
    steps: [
      { text: "Copy the connector address. It carries the demo agent's key.", code: { value: mcpUrlWithKey(origin), label: "Copy connector address" } },
      { text: where },
      PROMPT_STEP,
    ],
    localNote: isLocalOrigin(origin) ? LOCAL_NOTE : undefined,
  };
}

/** The numbered steps for one agent app, built from this page's own origin. */
export function guideFor(app: AppId, origin: string, deliverBy: string): Guide {
  switch (app) {
    case "claude-code":
      return {
        steps: [
          { text: "Add Laituri as an MCP server. Run this in a terminal.", code: { value: claudeCodeCommand(origin), label: "Copy command", wrap: true } },
          { text: "Start Claude Code and type /mcp. Laituri shows as connected with seven tools." },
          PROMPT_STEP,
        ],
      };
    case "claude":
      return connectorGuide(origin, "In Claude, open Settings, then Connectors, and choose Add custom connector. Name it Laituri and paste the address.");
    case "chatgpt":
      return connectorGuide(
        origin,
        "In ChatGPT, open Settings, then Apps and Connectors. Turn on developer mode, create a connector named Laituri and paste the address.",
      );
    case "grok":
      return connectorGuide(origin, "In Grok, open Settings, then Connectors, and add a custom connector. Name it Laituri and paste the address.");
    case "cursor":
      return {
        steps: [
          { text: "Paste this into .cursor/mcp.json in your project, or ~/.cursor/mcp.json for every project.", code: { value: cursorConfig(origin), label: "Copy mcp.json" } },
          { text: "Open Cursor Settings, then MCP. Laituri shows with seven tools." },
          PROMPT_STEP,
        ],
      };
    case "vscode":
      return {
        steps: [
          { text: "Paste this into .vscode/mcp.json in your workspace.", code: { value: vscodeConfig(origin), label: "Copy mcp.json" } },
          { text: "Choose Start above the server entry, then open Copilot Chat in Agent mode." },
          PROMPT_STEP,
        ],
      };
    case "gemini":
      return {
        steps: [
          { text: "Add this to ~/.gemini/settings.json. Merge it if the file already has mcpServers.", code: { value: geminiConfig(origin), label: "Copy settings" } },
          { text: "Run gemini and type /mcp. Laituri shows with seven tools." },
          PROMPT_STEP,
        ],
      };
    case "http":
      return {
        steps: [
          { text: "Search the catalogue for the need.", code: { value: curlSearch(origin, deliverBy), label: "Copy search command" } },
          { text: "Get a signed fixed-price offer and keep it. This uses jq.", code: { value: curlQuote(origin, deliverBy), label: "Copy quote command" } },
          { text: "Read the mandate and place the order with both signatures.", code: { value: curlOrder(origin), label: "Copy order command" } },
        ],
        links: [
          { href: PATHS.llms, label: "llms.txt" },
          { href: PATHS.openapi, label: "OpenAPI 3.1 document" },
        ],
      };
  }
}
