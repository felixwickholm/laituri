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
- Workspaces: `src/lib/workspace` (the shared one on disk, one in-memory sandbox per browser). `route()` and the MCP handler resolve the workspace (`src/lib/http/workspace.ts`); `src/proxy.ts` gives a first page load its cookie. Module state that changes lives in `workspaceState`, never in a module-level variable.
- Who may act as a person: `src/lib/http/sign-in.ts`, `console-session.ts` (approver), `operator-session.ts` (wholesaler operator).
- Demo history: `src/lib/seed`. Buyer agents (scripted and model-driven): `src/lib/agent`. Voice: `src/lib/voice`.
- Screens: `/` landing, `/buyer`, `/valio`, `/connect`, `/approve/[orderId]`, `/evidence`; walkthrough in `src/lib/tour` and `src/components/tour`.
- What the docs and `/evidence` claim: `src/lib/evidence` (one source). Mocks and assumptions are listed there under `simulated`.

## Invariants

- An agent never signs or approves. Only the buyer key signs mandates, only the approver key signs approvals.
- Every signed object carries its own JWS `typ` (`TOKEN_TYPE` in `src/lib/trust`) and every verification requires it.
- Demo access exists only in a sandbox, for the browser holding its cookie; a session works only in the workspace that issued it. Suspending or resuming an agent needs an operator session.
- Domain errors are recognised by their brand (`isGatewayError`), never by `instanceof`: Next loads a module once per route bundle.
- An offer is single use and expires; an order must carry it unchanged.
- Every call that searches, quotes, orders, approves or changes a mandate goes through the gateway. Three read-only routes bypass it: `GET /api/v1/offers/{id}` reads the store, `/api/v1/audit/checkpoint` signs through the audit module and `/api/v1/health` reads status.
- A suspended agent's credential is refused with 403 `agent_suspended` on every route, these included: `route()` in `src/lib/http/handler.ts` checks it before the handler runs, and MCP checks it before any method. Without a credential, public documents stay readable.
- No credential, no reads: without an agent token, a sandbox cookie or a signed-in session, orders, offers, the mandate, approvals, activity, the supplier overview and audit entries answer 401. An agent token reads only its own buyer's records; another buyer's record answers 404 as if missing. In the audit log an agent token gets its own buyer's entries in full and every other entry as a redacted stub; each signed hash covers a digest of the content, so the stubs still verify the whole chain.
- An order is confirmed alone only when the signed offer meets every requirement in the buyer's words for the product actually delivered (`offer.requestCheck`, `src/lib/request`); an offer without the buyer's words waits for a person (`request.words`). An approval re-checks the mandate in force and the stock.
- Signed mandates and offers are bound to the workspace that signed them; an order needs the mandate in force there, byte for byte, and an offer that workspace issued.
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
