# Laituri

**The loading dock for AI agents.** An open, verifiable front door that lets a customer's own purchasing agent buy from Valio Aimo: look up products, get a signed fixed-price offer, and order, inside limits a person signed. When a limit is passed, a person signs off. Every step lands in a log anyone can verify.

Laituri is not a web shop and not a chatbot. It is the interface and the operating model between two parties' software.

> "1,000 litres of lactose-free milk by Monday."
> The agent searches, receives a wholesaler-signed offer for 1,000 x 1 l, presents its mandate, and the order confirms in seconds. Ask for more than the mandate allows, and the order waits for Maria.

## Run it

```bash
cp .env.example .env      # add VALIO_API_KEY
npm install
npm run setup             # downloads the product data once and builds the search index
npm run dev               # http://localhost:3210
```

No key? `VALIO_MODE=recorded npm run dev` replays recorded price and availability answers for 255 products.

| Command | What it does |
|---|---|
| `npm run dev` | Console at `/`, REST at `/api/v1`, MCP at `/mcp` |
| `npm test` | Unit and integration tests |
| `npm run eval` | The four automated eval suites, on recorded data with a fixed clock |
| `npm run eval -- --live` | Smoke subset against the live mock API |
| `npx tsx scripts/buyer-agent.ts "1,000 litres of lactose-free milk by Monday"` | An outside process buys over HTTP |

## Connect an agent

Point any MCP client at `https://<host>/mcp` (Streamable HTTP). Or read `/llms.txt` and use plain HTTP. The demo bearer token `demo-agent-token` identifies the agent named in the mandate.

| Tool (MCP) | REST | Purpose |
|---|---|---|
| `search_catalog` | `POST /api/v1/products/search` | Find products; pack maths and match confidence come back |
| `get_product` | `GET /api/v1/products/{id}` | One product with identifiers, allergens, claims |
| `request_quote` | `POST /api/v1/quotes` | Live price and availability as a signed fixed-price offer, plus signed alternatives |
| `get_mandate` | `GET /api/v1/mandate` | The signed mandate: what this agent may do alone |
| `place_order` | `POST /api/v1/orders` | Offer + mandate + idempotency key; returns confirmed, waiting or blocked |
| `get_order` | `GET /api/v1/orders/{id}` | Status and receipt |
| `verify_audit` | `GET /api/v1/audit/verify` | Chain check and signed checkpoint |

Discovery: `/api/v1/openapi.json`, `/.well-known/jwks.json`, `/.well-known/agent-card.json`, `/.well-known/ai-catalog.json`, `/.well-known/ucp`, `/llms.txt`.

## How it works

```mermaid
flowchart LR
  A[Buyer's agent<br/>any MCP or HTTP client] -->|search, quote, order| G
  subgraph Laituri
    G[Gateway<br/>REST + MCP, one schema set] --> C[Catalogue<br/>search, pack maths]
    G --> Q[Quote engine<br/>signed offers + alternatives]
    G --> O[Orders<br/>verify, policy, receipt]
    O --> P[Policy<br/>15 named rules]
    O --> L[Audit log<br/>hash chain, signed]
  end
  Q -->|price, availability| V[(Valio Aimo API)]
  H[Approver<br/>console] -->|signed approval| O
  L --> X[Anyone<br/>verifies with public keys]
```

1. **Search.** The catalogue turns "lactose-free milk" into a concept plus claims, ranks products, does the pack maths (1,000 l = 1,000 x 1 l) and states an honest match confidence.
2. **Quote.** Live price and availability become an offer signed by the wholesaler key, valid 15 minutes. When the request cannot be met in full and on time, signed alternatives come with it: a like-for-like substitute, a split, or a premium option.
3. **Order.** The agent sends the offer and its mandate, both unchanged. 15 rules run. Every rule is listed on the order with its result.
4. **Approve.** Anything in the "ask" tier waits in the approval inbox. The approval is signed with the approver key.
5. **Prove.** Each step appends a signed entry to a hash chain. The console re-checks the whole chain in the browser with the public keys.

### Three keys, three roles

| Key | Signs | Why |
|---|---|---|
| Buyer | The mandate | Only the buyer can widen what its agent may do |
| Supplier | Offers, receipts, audit entries | The price is fixed and cannot be edited on the way |
| Approver | Approvals and the console session | A person, not the agent, lifted the limit |

An agent cannot raise its own limit, change a price, or approve its own order. Each attempt is refused and recorded.

### The mandate: allowed, ask, never

| Rule | Ask a person | Never |
|---|---|---|
| Spend per order, per week | Over the limit | |
| Category | Outside the allowed list | |
| Allergens, required claims | Food with no allergen declaration | Excluded allergen, missing claim |
| Substitution | Not like-for-like, or price up more than the cap | Any substitute when the policy says none |
| Partial delivery, late delivery | Partial not allowed; late within the grace days | Later than the grace days |
| Match confidence, first-time product | Low confidence; first order of a product | |
| Signatures, validity, expiry | | Invalid mandate or offer, wrong agent, expired, cut-off passed |

## How each judging criterion is met

| Criterion | Where to look |
|---|---|
| Working end-to-end demo | Scene 1 in the console; `scripts/buyer-agent.ts`; `evals/` suite 1. Price and availability are live from the mock API. |
| Solving the need | Request-versus-offer proof on every order: asked amount, offered packs, claim, date, fixed price. Vague requests are never auto-ordered. |
| Autonomy and controls | `src/lib/policy` (15 rules), `src/lib/mandate`, approval inbox, signed approvals, `src/lib/audit`. |
| Exceptions | Cut-off passed, partial stock, substitution and late delivery return signed alternatives; see `src/lib/offers/alternatives.ts` and scene 2. |
| Openness and production path | MCP + REST from one schema set, OpenAPI 3.1, JWS/JWKS, discovery files; standards table and next steps below. |

## Standards used

| Area | Choice |
|---|---|
| Agent interface | Model Context Protocol (Streamable HTTP) and REST, OpenAPI 3.1 |
| Signatures | JWS compact, ES256, keys published as JWKS (RFC 7515, 7517, 7638) |
| Mandate | JWT shaped like the AP2 Open Checkout Mandate (`vct`, `constraints[]`, `exp`) |
| Commerce vocabulary | UCP catalog, checkout and order terms, including escalation to a person |
| Order response | Peppol BIS Ordering response codes: AP accepted, CA accepted with change, RE rejected |
| Identifiers | GS1 GTIN for products; OVT / GLN for parties |
| Errors | RFC 9457 problem details |
| Discovery | Agent card, AI catalog, `llms.txt`, OAuth protected-resource metadata |

## Assumptions, stated openly

- **Orders are simulated.** The mock API has price and availability only. Laituri creates the order, the receipt and the log itself and marks every order `simulated: true`.
- A `closingTime` in the past means that delivery date can no longer be ordered.
- An available amount of 9999999999 or 999999 means no tracked limit.
- Litres or kilograms per sales unit come from price divided by comparison price, with the product's unit data as fallback.
- Category groups (dairy, bakery, ...) and the product concept list are our own, built from the product data.
- Availability returns the next delivery date whatever date is asked. Laituri compares that date with the requested one.
- The demo uses a static bearer token for the agent and a passcode sign-in for the approver. Without `LAITURI_APPROVER_PASSCODE` the sign-in is open and the console says so; use that only locally.
- State is kept in memory with a JSON snapshot. One process serialises order decisions so two orders cannot pass a limit together.
- Audit verification proves that entries were not changed, reordered or removed from the middle. That the newest entries are still there is checked against the last head the verifier saw.

## From demo to production

1. Replace the simulated order with the real order entry of the ERP; return its number in the receipt.
2. OAuth 2.1 with scoped tokens per agent (`catalog:read`, `quote:create`, `order:place`); the metadata endpoint is already in place.
3. Keep the mandate limits in the customer master as well, so the supplier and the buyer hold the same signed copy.
4. Buyer identity from a verifiable organisation credential (EU Business Wallet) instead of a demo key.
5. Database with transactions and row locks in place of the single-process store.
6. Anchor audit checkpoints in an external transparency service (SCITT), so completeness no longer depends on the verifier's memory.
7. Peppol order and order-response documents for customers that already trade over Peppol.

## Layout

```
src/lib/contracts   zod schemas: the single source for REST, MCP and the console
src/lib/valio       upstream client (live and recorded)
src/lib/catalog     index, concept lexicon, search, substitutes
src/lib/offers      quote engine, pack maths, alternatives
src/lib/orders      placement, approvals, receipts
src/lib/policy      the 15 mandate rules
src/lib/mandate     signed mandate
src/lib/trust       keys, JWS, JWKS
src/lib/audit       hash chain, verification, checkpoint
src/lib/gateway     one facade behind REST, MCP and the console
src/lib/agent       a small scripted buyer agent used by the demo and the evals
src/app             console, REST routes, MCP endpoint, discovery files
evals               scenario, guardrail, trust and openness suites
```

MIT licence.
