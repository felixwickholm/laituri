import { COMPONENT_PREFIX, componentSchemas } from "./components";
import { OPERATIONS, type Operation } from "./registry";

export const API_VERSION = "0.1.0";

const ERROR_TEXT: Record<number, string> = {
  400: "The request does not match the schema",
  401: "No credential was sent (code credential_required), or the bearer token is not known",
  403: "Not allowed for this caller",
  404: "Not found",
  409: "Conflicts with the current state or an earlier idempotency key",
  429: "Too many requests from this address; Retry-After says when to try again",
  502: "The wholesaler API did not answer",
};

const ref = (name: string) => ({ $ref: COMPONENT_PREFIX + name });

function operationObject(op: Operation) {
  const responses: Record<string, unknown> = {
    [String(op.status ?? 200)]: {
      description: op.summary,
      content: { [op.responseType ?? "application/json"]: { schema: ref(op.response), ...example(op.example?.response) } },
    },
  };
  for (const outcome of op.outcomes ?? []) {
    const mediaType = outcome.problem ? "application/problem+json" : "application/json";
    responses[String(outcome.status)] = { description: outcome.description, content: { [mediaType]: { schema: ref(outcome.response) } } };
  }
  for (const status of op.errors) {
    responses[String(status)] = {
      description: ERROR_TEXT[status] ?? "Error",
      content: { "application/problem+json": { schema: ref("Problem") } },
    };
  }
  return {
    operationId: op.operationId,
    summary: op.summary,
    ...(op.description ? { description: op.description } : {}),
    tags: [op.tag],
    ...(op.parameters?.length
      ? {
          parameters: op.parameters.map((p) => ({
            name: p.name,
            in: p.in,
            required: p.required ?? false,
            description: p.description,
            schema: { type: p.type },
          })),
        }
      : {}),
    ...(op.body
      ? {
          requestBody: {
            required: true,
            content: { "application/json": { schema: ref(op.body), ...example(op.example?.request) } },
          },
        }
      : {}),
    responses,
    security: securityOf(op),
    "x-audience": op.audience,
  };
}

/** Who may call: a bearer key (anonymous allowed for agent calls), any reader credential, a session, or anyone. */
function securityOf(op: Operation) {
  if (op.audience === "reader") return [{ bearer: [] }, { sandboxCookie: [] }, { approverSession: [] }, { operatorSession: [] }];
  if (op.audience === "human") return [{ approverSession: [] }];
  if (op.audience === "operator") return [{ operatorSession: [] }, ...(op.method === "get" ? [{ approverSession: [] }, { sandboxCookie: [] }] : [])];
  return op.scope ? [{ bearer: [op.scope] }, {}] : [];
}

function example(value: unknown) {
  return value === undefined ? {} : { example: value };
}

/** OpenAPI 3.1 description of the REST surface, built from the operation registry and the zod contracts. */
export function openApiDocument(origin: string) {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const op of OPERATIONS) {
    (paths[op.path] ??= {})[op.method] = operationObject(op);
  }
  return {
    openapi: "3.1.0",
    jsonSchemaDialect: "https://json-schema.org/draft/2020-12/schema",
    info: {
      title: "Valio Aimo agent ordering (Laituri)",
      version: API_VERSION,
      summary: "Search, quote and order from the wholesaler through signed offers and a buyer mandate.",
      description:
        "Flow: search products, request a signed quote, place the order with the offer and mandate JWS. " +
        "Every step is written to a signed, hash-chained audit log. MCP is available at /mcp.",
    },
    servers: [{ url: origin }],
    tags: ["Catalogue", "Ordering", "Approvals", "Mandate", "Audit", "Supplier", "System"].map((name) => ({ name })),
    paths,
    components: {
      schemas: componentSchemas(),
      securitySchemes: {
        bearer: {
          type: "http",
          scheme: "bearer",
          description:
            "Demo: POST /api/v1/workspace creates a private sandbox and returns one agent key per demo buyer; a key works only in its sandbox and reads only its own buyer's records. " +
            "The shared demo workspace has fixed public tokens: demo-agent-token (Nordic Harbour Hotels), demo-kaisla-token (Kaisla School Kitchens), demo-laine-token (Ravintola Laine). " +
            "Production: OAuth 2.1 access tokens with scopes catalog:read, quote:create, order:place.",
        },
        sandboxCookie: {
          type: "apiKey",
          in: "cookie",
          name: "laituri_workspace",
          description: "The browser's own sandbox, set on its first page load. It reads everything in that sandbox. Never issued to a client without a browser.",
        },
        approverSession: {
          type: "apiKey",
          in: "cookie",
          name: "laituri_approver",
          description: "A buyer approver's signed session from POST /api/v1/console/session, valid only in the workspace that issued it.",
        },
        operatorSession: {
          type: "apiKey",
          in: "cookie",
          name: "laituri_operator",
          description: "The wholesaler operator's signed session from POST /api/v1/console/session, valid only in the workspace that issued it.",
        },
      },
    },
    "x-assumptions": [
      "Orders are simulated. The wholesaler test API has no order endpoint, so every order carries simulated: true.",
      "Cut-off rule: a delivery date whose order closing time has passed is not orderable; the offer reports cutoff_passed.",
      "Untracked stock sentinel: an available amount of 9999999999 or 999999 means the wholesaler does not track stock; the offer line says stock: untracked and gives no available count.",
    ],
  };
}
