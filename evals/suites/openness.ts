import { OPERATIONS } from "@/lib/openapi/registry";
import type { EvalCase, Suite } from "../harness";
import { Checks } from "../support/checks";
import { callEveryTool, listTools } from "../support/mcp-tools";
import { callEveryOperation } from "../support/operations";
import { serveRoutes } from "../support/http-server";
import { outsideAgent } from "../support/outside-agent";
import { get } from "../support/router";

type Json = Record<string, unknown>;
type Body = (checks: Checks) => Promise<string>;

function opennessCase(id: string, name: string, expected: string, body: Body): EvalCase {
  return {
    id,
    name,
    expected,
    async run() {
      const checks = new Checks();
      const actual = await body(checks);
      checks.note(actual);
      return checks.verdict(actual);
    },
  };
}

async function openApi(): Promise<Json> {
  return (await get("/api/v1/openapi.json")).body as Json;
}

function operationsOf(doc: Json): { path: string; method: string; operation: Json }[] {
  return Object.entries(doc.paths as Json).flatMap(([path, item]) =>
    Object.entries(item as Json).map(([method, operation]) => ({ path, method, operation: operation as Json })));
}

function refsIn(node: unknown, found: string[] = []): string[] {
  if (Array.isArray(node)) node.forEach((item) => refsIn(item, found));
  else if (node && typeof node === "object") {
    for (const [key, value] of Object.entries(node)) {
      if (key === "$ref" && typeof value === "string") found.push(value);
      else refsIn(value, found);
    }
  }
  return found;
}

function resolves(doc: Json, ref: string): boolean {
  if (!ref.startsWith("#/")) return false;
  const target = ref.slice(2).split("/").reduce<unknown>((node, part) => (node as Json | undefined)?.[part.replace(/~1/g, "/").replace(/~0/g, "~")], doc);
  return target !== undefined;
}

const DISCOVERY: [path: string, type: string][] = [
  ["/.well-known/jwks.json", "application/json"],
  ["/.well-known/agent-card.json", "application/json"],
  ["/.well-known/ai-catalog.json", "application/json"],
  ["/.well-known/ucp", "application/json"],
  ["/.well-known/oauth-protected-resource", "application/json"],
  ["/llms.txt", "text/plain"],
];

const CASES: EvalCase[] = [
  opennessCase("O1", "OpenAPI 3.1 document", "openapi 3.1.0, info, servers, every operation has responses and declares its path parameters", async (checks) => {
    const doc = await openApi();
    checks.expect(doc.openapi === "3.1.0", `openapi is ${String(doc.openapi)}`);
    const info = doc.info as Json | undefined;
    checks.expect(Boolean(info?.title && info.version), "info lacks title or version");
    checks.expect(Array.isArray(doc.servers) && doc.servers.length > 0, "no servers");
    for (const { path, method, operation } of operationsOf(doc)) {
      checks.expect(Object.keys((operation.responses as Json) ?? {}).length > 0, `${method} ${path} has no responses`);
      const declared = ((operation.parameters as Json[]) ?? []).filter((p) => p.in === "path").map((p) => p.name);
      for (const name of path.match(/\{(\w+)\}/g)?.map((m) => m.slice(1, -1)) ?? []) {
        checks.expect(declared.includes(name), `${method} ${path} does not declare ${name}`);
      }
    }
    return `${operationsOf(doc).length} operations on ${Object.keys(doc.paths as Json).length} paths`;
  }),
  opennessCase("O2", "Every operation has an operationId", "unique operationId on every operation", async (checks) => {
    const ids = operationsOf(await openApi()).map(({ operation }) => operation.operationId);
    checks.expect(ids.every((id) => typeof id === "string" && id.length > 0), "an operation has no operationId");
    checks.expect(new Set(ids).size === ids.length, "operationIds repeat");
    return `${ids.length} unique operationIds`;
  }),
  opennessCase("O3", "Every $ref resolves", "no dangling $ref", async (checks) => {
    const doc = await openApi();
    const refs = refsIn(doc);
    const dangling = [...new Set(refs.filter((ref) => !resolves(doc, ref)))];
    checks.expect(dangling.length === 0, `dangling: ${dangling.join(", ")}`);
    return `${refs.length} refs, ${new Set(refs).size} distinct, all resolve`;
  }),
  opennessCase("O4", "Every registered path answers", "documented success status for a well-formed call", async (checks) => {
    const results = await callEveryOperation();
    for (const result of results.filter((r) => r.problem)) checks.expect(false, `${result.operation.operationId}: ${result.problem}`);
    checks.expect(results.length === OPERATIONS.length, `${results.length} of ${OPERATIONS.length} operations called`);
    return `${results.filter((r) => !r.problem).length}/${results.length} operations answered as documented`;
  }),
  opennessCase("O5", "MCP tools/list", "every tool has input and output schemas", async (checks) => {
    const tools = await listTools();
    checks.expect(tools.length > 0, "no tools listed");
    for (const tool of tools) {
      checks.expect(tool.inputSchema?.type === "object", `${tool.name} has no object input schema`);
      checks.expect(tool.outputSchema?.type === "object", `${tool.name} has no object output schema`);
    }
    return `${tools.length} tools: ${tools.map((t) => t.name).join(", ")}`;
  }),
  opennessCase("O6", "Each MCP tool is callable", "structuredContent validates against the outputSchema", async (checks) => {
    const results = await callEveryTool(await listTools());
    for (const result of results.filter((r) => !r.ok)) checks.expect(false, `${result.name}: ${result.problem}`);
    const methods = [...new Set(results.map((r) => r.how))].join(", ");
    return `${results.filter((r) => r.ok).length}/${results.length} tools valid (checked with ${methods})`;
  }),
  opennessCase("O7", "Discovery documents", "200 with the right content type", async (checks) => {
    for (const [path, type] of DISCOVERY) {
      const reply = await get(path);
      checks.expect(reply.status === 200 && reply.contentType.startsWith(type), `${path}: ${reply.status} ${reply.contentType}`);
      if (type === "application/json") checks.expect(reply.body !== undefined, `${path} is not JSON`);
    }
    return `${DISCOVERY.length} documents served`;
  }),
  opennessCase("O8", "Outside agent from llms.txt only", "over HTTP, the REST flow in llms.txt searches, quotes and orders the milk; order confirmed", async (checks) => {
    const server = await serveRoutes();
    try {
      const { order, steps } = await outsideAgent(server.origin);
      checks.expect(order.status === "confirmed", `the order is ${order.status}`);
      return steps.join("; ");
    } finally {
      await server.close();
    }
  }),
];

export const opennessSuite: Suite = { id: "openness", name: "Openness", bar: 1, cases: CASES };
