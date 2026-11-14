# Laituri

Laituri is the agent front door for a food-service wholesaler: a customer's own purchasing agent searches, gets a wholesaler-signed fixed-price offer and orders over MCP or REST, inside a mandate the buyer signed. Larger or unusual orders wait for a named person, the wholesaler can watch and suspend agents, and every step lands in a signed hash chain anyone can verify.

## Run, test, evaluate

- `npm install`, then `VALIO_MODE=recorded npm run dev` (no key needed) or `npm run setup && npm run dev` with `VALIO_API_KEY` in `.env`. Port 3210.
- `npm test` (vitest), `npm run eval` (four suites, recorded data, fixed clock), `npm run typecheck`, `npm run lint`.
- `npm run evidence` re-measures tests and evals and regenerates the numbered blocks in README.md and docs/. Run it after changing tests, evals, tools, routes, rules, buyers or the seed plan; `tests/evidence` fails while a block is stale.

## Where things live

- Schemas for every request and response: `src/lib/contracts`. REST, MCP and OpenAPI are built from them.
- One gateway behind REST, MCP and the screens: `src/lib/gateway`. Routes: `src/app/api/v1`; MCP: `src/lib/mcp`.
- Search: `src/lib/catalog`. Offers, pack maths, alternatives: `src/lib/offers`. Orders and approvals: `src/lib/orders`.
- Mandate rules: `src/lib/policy`. Demo buyers and their mandates: `src/lib/mandate`.
- Keys and signatures: `src/lib/trust`. Audit chain: `src/lib/audit`. Wholesaler overview: `src/lib/insights`.
- Demo history: `src/lib/seed`. Buyer agents (scripted and model-driven): `src/lib/agent`. Voice: `src/lib/voice`.
- Screens: `/` landing, `/buyer`, `/valio`, `/connect`, `/approve/[orderId]`, `/evidence`; walkthrough in `src/lib/tour` and `src/components/tour`.
- What the docs and `/evidence` claim: `src/lib/evidence` (one source). Mocks and assumptions are listed there under `simulated`.

## Invariants

- An agent never signs or approves. Only the buyer key signs mandates, only the approver key signs approvals.
- An offer is single use and expires; an order must carry it unchanged.
- Every call that searches, quotes, orders, approves or changes a mandate goes through the gateway. Only two read-only routes read the store directly: `GET /api/v1/offers/{id}` and `/api/v1/health`.
- The upstream API key stays on the server.
- No number in README.md or docs/ is typed by hand: it comes from `src/lib/evidence/facts.json` through `npm run evidence`.
- Tests and evals use recorded data and never call a paid service.

## For a reviewer, by judging criterion

- Working end-to-end demo: `/buyer?tour=1`; `src/lib/orders/place.ts`; `npm run eval -- --suite scenarios`.
- Solving the problem and user need: `src/lib/catalog/search.ts`, `src/lib/offers/packs.ts`, `src/components/order/RequestProof.tsx`.
- Autonomy and controls: `src/lib/policy`, `src/lib/mandate`, `src/lib/audit`; `npm run eval -- --suite guardrails`.
- Robustness to exception situations: `src/lib/offers/alternatives.ts`; evals 5, 6, 13.
- Openness and credible path toward production: `src/lib/contracts`, `src/lib/mcp/tools.ts`, `/api/v1/openapi.json`, `docs/decisions`; `npm run eval -- --suite openness`.
- The full map: `docs/judging.md`.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
