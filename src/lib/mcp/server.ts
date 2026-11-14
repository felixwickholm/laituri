import { helsinkiDate } from "@/lib/agent/dates";
import { now } from "@/lib/clock";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema, type CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { ZodError } from "zod";
import type { AgentRef } from "@/lib/gateway";
import { errorMessage, isGatewayError } from "@/lib/gateway/errors";
import { inlineSchema } from "@/lib/openapi/components";
import { API_VERSION } from "@/lib/openapi/document";
import { SCHEMAS } from "@/lib/openapi/schemas";
import { findTool, TOOLS } from "./tools";

export const SERVER_NAME = "laituri-valio-aimo";

export const INSTRUCTIONS = [
  "This server lets you buy food-service products from the wholesaler Valio Aimo for your buyer.",
  "1. search_catalog to turn the need into product codes; check the interpretation confidence.",
  "2. get_mandate to learn your limits and get the mandate JWS.",
  "3. request_quote for a signed fixed-price offer; read availability, notes and alternatives.",
  "4. place_order with the offer JWS unchanged, the mandate JWS and a new idempotency key.",
  "If the order is pending_approval, stop and tell your human. Orders are simulated; verify_audit proves every step.",
  "Hits come best buy first when the match is clear. One offer gives one order.",
].join("\n");

/** Dates in requests are YYYY-MM-DD, so the agent is told which day it is at the wholesaler. */
function instructions(): string {
  const today = now();
  const weekday = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Helsinki", weekday: "long" }).format(today);
  return `${INSTRUCTIONS}\nToday is ${weekday} ${helsinkiDate(today)} in Finland. Send dates as YYYY-MM-DD.`;
}

function toolList() {
  return TOOLS.map((tool) => ({
    name: tool.name,
    title: tool.title,
    description: tool.description,
    inputSchema: inlineSchema(tool.input, "input") as { type: "object" },
    outputSchema: inlineSchema(tool.output, "output") as { type: "object" },
    annotations: { title: tool.title, readOnlyHint: tool.name !== "place_order" && tool.name !== "request_quote" },
  }));
}

function failure(message: string): CallToolResult {
  return { isError: true, content: [{ type: "text", text: message }] };
}

function describeError(error: unknown): string {
  if (error instanceof ZodError) {
    const issue = error.issues[0];
    const where = issue?.path.length ? ` at ${issue.path.join(".")}` : "";
    return `The input is not valid${where}: ${issue?.message ?? "unknown problem"}.`;
  }
  if (isGatewayError(error)) return error.message;
  console.error(error);
  return `The call failed: ${errorMessage(error)}`;
}

/** A fresh MCP server bound to one caller. Stateless: one server per HTTP request. */
export function createMcpServer(agent: AgentRef): Server {
  const server = new Server(
    { name: SERVER_NAME, title: "Valio Aimo agent ordering (Laituri)", version: API_VERSION },
    { capabilities: { tools: {} }, instructions: instructions() },
  );

  server.setRequestHandler(ListToolsRequestSchema, () => ({ tools: toolList() }));

  server.setRequestHandler(CallToolRequestSchema, async (request): Promise<CallToolResult> => {
    const tool = findTool(request.params.name);
    if (!tool) return failure(`There is no tool called ${request.params.name}.`);
    try {
      const input = tool.input.parse(request.params.arguments ?? {});
      const raw = await tool.run(agent, input as never);
      // Parsing drops internal fields so the result matches the published output schema.
      const parsed = SCHEMAS[tool.output].safeParse(raw);
      const structured = (parsed.success ? parsed.data : raw) as Record<string, unknown>;
      return {
        structuredContent: structured,
        content: [{ type: "text", text: tool.summarize(structured as never) }],
      };
    } catch (error) {
      return failure(describeError(error));
    }
  });

  return server;
}
