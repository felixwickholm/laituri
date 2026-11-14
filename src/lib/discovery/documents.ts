import { TOOLS } from "@/lib/mcp/tools";
import { API_VERSION } from "@/lib/openapi/document";
import { publicKeySet } from "./jwks";

export const SERVICE_NAME = "Valio Aimo agent ordering (Laituri demo)";
export const SERVICE_DESCRIPTION =
  "Lets a buyer's purchasing agent search the Valio Aimo catalogue, get wholesaler-signed fixed-price offers " +
  "and place orders inside a buyer-signed mandate. Every step is signed and hash-chained. Orders are simulated.";
export const SCOPES = ["catalog:read", "quote:create", "order:place"] as const;

export const endpoints = (origin: string) => ({
  mcp: `${origin}/mcp`,
  rest: `${origin}/api/v1`,
  openapi: `${origin}/api/v1/openapi.json`,
  jwks: `${origin}/.well-known/jwks.json`,
  llms: `${origin}/llms.txt`,
});

const bearerScheme = {
  type: "http",
  scheme: "bearer",
  description:
    "Demo tokens, one per buyer: demo-agent-token, demo-kaisla-token, demo-laine-token. Production: OAuth 2.1 with scopes catalog:read, quote:create, order:place.",
};

/** A2A v1-style agent card. */
export function agentCard(origin: string) {
  const urls = endpoints(origin);
  return {
    protocolVersion: "1.0",
    name: SERVICE_NAME,
    description: SERVICE_DESCRIPTION,
    version: API_VERSION,
    provider: { organization: "Valio Aimo (demo)", url: origin },
    documentationUrl: urls.llms,
    supportedInterfaces: [
      { protocolBinding: "MCP", transport: "streamable-http", url: urls.mcp },
      { protocolBinding: "HTTP+JSON", url: urls.rest, specification: urls.openapi },
    ],
    capabilities: { streaming: false, pushNotifications: false },
    defaultInputModes: ["application/json", "text/plain"],
    defaultOutputModes: ["application/json"],
    skills: TOOLS.map((tool) => ({
      id: tool.name,
      name: tool.title,
      description: tool.description,
      tags: ["procurement", "food-service", "wholesale"],
    })),
    securitySchemes: { bearer: bearerScheme },
    security: [{ bearer: [...SCOPES] }],
  };
}

export function aiCatalog(origin: string) {
  const urls = endpoints(origin);
  return {
    version: "1.0",
    entries: [
      {
        id: "valio-aimo-ordering",
        name: SERVICE_NAME,
        description: SERVICE_DESCRIPTION,
        type: "mcp",
        url: urls.mcp,
        transport: "streamable-http",
        documentation: urls.llms,
        agentCard: `${origin}/.well-known/agent-card.json`,
      },
    ],
  };
}

/** Minimal commerce profile. Capabilities map to the MCP tools and REST operations. */
export async function ucpProfile(origin: string) {
  const urls = endpoints(origin);
  return {
    status: "demo",
    name: SERVICE_NAME,
    version: API_VERSION,
    services: [
      { type: "rest", url: urls.rest, spec: urls.openapi },
      { type: "mcp", url: urls.mcp, transport: "streamable-http" },
    ],
    capabilities: TOOLS.map((tool) => ({
      name: tool.name,
      mcpTool: tool.name,
      restOperation: tool.operationId,
    })),
    keys: (await publicKeySet(["supplier"])).keys,
    notes: ["Orders are simulated.", "Offers are signed by the supplier key and valid for 15 minutes."],
  };
}

export function protectedResource(origin: string) {
  return {
    resource: origin,
    authorization_servers: [],
    scopes_supported: [...SCOPES],
    bearer_methods_supported: ["header"],
    resource_name: SERVICE_NAME,
    resource_documentation: endpoints(origin).llms,
    note: "This demo uses static bearer tokens, one per buyer (demo-agent-token, demo-kaisla-token, demo-laine-token). Production uses OAuth 2.1 with these scopes.",
  };
}
