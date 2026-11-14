# 1. MCP and REST from one schema set

- Status: accepted
- Code: [`src/lib/contracts`](../../src/lib/contracts), [`src/lib/mcp/tools.ts`](../../src/lib/mcp/tools.ts), [`src/lib/openapi/registry.ts`](../../src/lib/openapi/registry.ts), [`src/lib/gateway`](../../src/lib/gateway)

## Context and problem statement

Outside agents differ. Some speak the Model Context Protocol, some only plain HTTP, and a wholesaler may later want a service agent of its own. The brief leaves the production interface open ("a traditional API, an MCP-style agentic interface or a full service agent"). Two hand-written interfaces would drift apart.

## Considered options

1. REST only, with an OpenAPI document.
2. MCP only.
3. Both, generated from one set of zod schemas, behind one gateway.

## Decision outcome

Option 3. Every request and response is a zod schema in `src/lib/contracts`. The OpenAPI 3.1 document is built from the operation registry; each MCP tool names the REST operation it mirrors and uses the same input and output schemas. REST routes, MCP tools and the screens all call the same gateway.

## Consequences

- Good: the interface choice stays open; a new transport is one more caller of the gateway.
- Good: discovery documents (agent card, AI catalog) list the tools from the same source.
- Bad: zod is the source of truth, so schema changes are code changes, not document edits.

## Confirmation

Evals O1 to O6: the OpenAPI document is valid and complete, every registered path answers, every MCP tool is callable and its result validates against its output schema. `npm run eval -- --suite openness`.
