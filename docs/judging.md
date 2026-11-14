# Judging map

The Valio Aimo challenge "Trusted Trade Agents" names five judging criteria. This page maps each to what was built, where it is in the code, how to check it and what was measured. It is generated from [`src/lib/evidence`](../src/lib/evidence) by `npm run evidence`, and a test fails when it is out of date. The same data is on `/evidence` and `/evidence.json`.

<!-- BEGIN:evidence:judging -->
## The five criteria

### Working end-to-end demo (30%)

A request in plain words goes through search, a signed fixed-price offer, the mandate check and either an automatic order or a person's signed approval, over the same MCP and REST interface an outside agent uses.

What we built:

- Buyer side (/buyer): the agent takes "1,000 litres of lactose-free milk by Monday", gets a signed offer, and the order confirms; 1,600 litres waits for the approver.
- Approval on a phone-sized page (/approve/{orderId}): the approver's decision is signed with the approver key.
- Wholesaler side (/valio): connected agents, demand, unmet requests and the same audit log.
- A guided walkthrough (/buyer?tour=1) drives these steps in the running product, not in a video.
- Price and availability come from the challenge's mock API in live mode, or from recorded answers for 255 products in recorded mode.
- An outside process buys over plain HTTP with scripts/buyer-agent.ts.

Where in the code: [`src/lib/gateway/gateway.ts`](../src/lib/gateway/gateway.ts), [`src/lib/agent/purchase.ts`](../src/lib/agent/purchase.ts), [`src/lib/orders/place.ts`](../src/lib/orders/place.ts), [`src/lib/demo/scenarios.ts`](../src/lib/demo/scenarios.ts), [`src/lib/tour/steps.ts`](../src/lib/tour/steps.ts), [`src/app/buyer/page.tsx`](../src/app/buyer/page.tsx), [`src/app/approve/[orderId]/page.tsx`](../src/app/approve/%5BorderId%5D/page.tsx), [`scripts/buyer-agent.ts`](../scripts/buyer-agent.ts).

How to check: `/buyer?tour=1` on the live demo; `npm run eval -- --suite scenarios`; eval O8; `npx tsx scripts/buyer-agent.ts "1,000 litres of lactose-free milk by Monday"`.

Measured:

- Scenarios eval suite: 25/25 cases pass (bar >=90%).
- An agent that knows only the text of /llms.txt, fetched over HTTP from a server started for the eval, runs the curl lines of its REST flow in order (URLs, headers and bodies as written, filling each <field from step N> from that step's answer), searches, quotes and orders the milk, and the order confirms (eval O8).

Known limit: Orders are simulated: the mock API has price and availability but no order endpoint, so Laituri writes the order and receipt itself and marks each one simulated: true.

### Solving the problem and user need (20%)

The agent orders what the buyer asked for: the wholesaler turns litres and kilograms into whole sales units, compares the buyer's words with every offer and signs that comparison into it, and an order that does not meet the words in full is never confirmed alone.

What we built:

- Search reads Finnish, Swedish or English needs as a product concept plus claims (for example lactose_free) and returns a match confidence.
- Pack maths: 1,000 l becomes 1,000 x 1 l; the scenario evals accept at most one lot more than asked.
- Request check: product, every claim, words not understood, quantity (at most one lot over), date, a budget ("under 50 euros", "alle 50 euroa") and an order to wait ("ask me first", "älä tilaa ennen kuin hyväksyn"), each met, unmet or unchecked, signed inside the offer and shown on the order.
- The match.confidence rule refuses a certain mismatch (wrong product, a missing claim, far too little) and sends anything unmet, unchecked or uncertain to a person with the requirement named.
- 3 demo buyers with their own signed mandates (Nordic Harbour Hotels, Kaisla School Kitchens, Ravintola Laine). The same sentence confirms for the hotel and is blocked for the school kitchens, which exclude sesame even as a trace.
- Every offer line carries the product's country of origin, labels, delivery reliability and category-average CO2 inside the signature; search can rank a clear match by price, reliability or sustainability.

Where in the code: [`src/lib/catalog/search.ts`](../src/lib/catalog/search.ts), [`src/lib/offers/packs.ts`](../src/lib/offers/packs.ts), [`src/lib/request/index.ts`](../src/lib/request/index.ts), [`src/lib/gateway/confidence.ts`](../src/lib/gateway/confidence.ts), [`src/components/order/RequestProof.tsx`](../src/components/order/RequestProof.tsx), [`src/lib/mandate/defaults.ts`](../src/lib/mandate/defaults.ts), [`src/lib/contracts/facts.ts`](../src/lib/contracts/facts.ts), [`src/components/valio/TwoKitchens.tsx`](../src/components/valio/TwoKitchens.tsx).

How to check: eval 2; eval 12; eval 19; eval 22; `tests/request/fidelity.test.ts`; `tests/demo/two-kitchens.test.ts`; `tests/offers/packs.test.ts`.

Measured:

- 25/25 scenario cases end on the expected route with the expected concept, amount and date.
- 3 demo buyers, 31 seeded requests played through the real gateway.

Known limit: The product concepts and category groups are our own, built from the product data. The catalogue sells "lactose-free milk" as "lactose-free milk drink"; Laituri treats the two as one request and names the product it chose.

### Autonomy and controls (20%)

A buyer-signed mandate sets what the agent may do alone, what waits for a named person and what is never allowed, and every decision is a signed entry in a hash-chained log that both sides verify with public keys.

What we built:

- 15 named mandate rules run on every order; each result (pass, ask or block) is listed on the order with its reason.
- Three tiers: the agent orders alone, a person is asked, or the order is refused.
- Approvals are signed with the approver key. Agent credentials cannot approve, over REST or MCP.
- An agent cannot raise its own limit: a changed mandate without the buyer's signature is refused.
- The wholesaler can suspend an agent; every refused call, the suspension and the resumption are signed audit entries.
- The buyer (/buyer/log) and the wholesaler (/valio/audit) read the same log; the browser re-checks the chain and every signature with the published keys.

Where in the code: [`src/lib/policy/evaluate.ts`](../src/lib/policy/evaluate.ts), [`src/lib/policy/rules`](../src/lib/policy/rules), [`src/lib/mandate/index.ts`](../src/lib/mandate/index.ts), [`src/lib/orders/approval.ts`](../src/lib/orders/approval.ts), [`src/lib/gateway/suspension.ts`](../src/lib/gateway/suspension.ts), [`src/lib/audit/chain.ts`](../src/lib/audit/chain.ts), [`src/lib/audit/verify.ts`](../src/lib/audit/verify.ts), [`src/lib/console/verify.ts`](../src/lib/console/verify.ts).

How to check: `npm run eval -- --suite guardrails`; eval G10; eval G5; `/buyer/mandate` on the live demo; `tests/gateway/suspension.test.ts`.

Measured:

- Guardrails eval suite: 28/28 cases pass (bar 100%).
- Trust eval suite: 16/16 cases pass (bar 100%).
- 15 mandate rules, 3 signing keys (supplier, buyer, approver).

Known limit: In the demo one server holds all three private keys, and the approver signs in with a passcode or one-click demo access that the audit log labels as such.

### Robustness to exception situations (15%)

When a request cannot be met in full and on time, the wholesaler returns signed counter-offers ranked good, better and best, and the buyer's mandate decides whether the agent may take one alone.

What we built:

- Short stock: a split (keep what is in stock, fill the rest like for like) or a full substitute, each signed.
- Order cut-off passed: the offer as asked is blocked and on-time alternatives come with it.
- Late delivery within the mandate's grace days asks a person; later is refused.
- A substitute that is not like for like, or costs more than the mandate's cap, asks a person; a mandate with no substitutes refuses it.
- Edited, expired, replayed or wrongly signed offers are refused.
- Simultaneous orders over the weekly limit: only what fits confirms, the rest waits.
- Instructions written into the request text do not change the route.

Where in the code: [`src/lib/offers/alternatives.ts`](../src/lib/offers/alternatives.ts), [`src/lib/offers/substitutes.ts`](../src/lib/offers/substitutes.ts), [`src/lib/policy/rules/fulfilment.ts`](../src/lib/policy/rules/fulfilment.ts), [`src/lib/orders/lock.ts`](../src/lib/orders/lock.ts), [`src/components/order/Alternatives.tsx`](../src/components/order/Alternatives.tsx).

How to check: eval 5; eval 6; eval 13; eval G20; eval G14.

Measured:

- Scenarios eval suite: 25/25 cases pass (bar >=90%).
- Guardrails eval suite: 28/28 cases pass (bar 100%).

Known limit: Substitutes are chosen like for like within the wholesaler's own concept and category, not through recipe logic.

### Openness and credible path toward production (15%)

One set of zod schemas produces the MCP tools, the REST routes and the OpenAPI 3.1 document; signatures are JWS with keys published as JWKS; assumptions, decisions and next steps are written down.

What we built:

- 7 MCP tools and 23 REST operations on 21 paths, from one schema set.
- 6 discovery documents: OpenAPI is served beside the JWKS, agent card, AI catalog, UCP profile, OAuth protected-resource metadata and llms.txt.
- An outside agent that knows only the text of llms.txt, fetched over HTTP, buys the milk by following its REST flow.
- Standards table separates "used" (implemented and tested) from "follows" (names and shapes taken from the standard).
- Decision records in docs/decisions; assumptions and the path to production in this README and on /evidence.
- MIT licence.

Where in the code: [`src/lib/contracts`](../src/lib/contracts), [`src/lib/mcp/tools.ts`](../src/lib/mcp/tools.ts), [`src/lib/openapi/registry.ts`](../src/lib/openapi/registry.ts), [`src/lib/discovery`](../src/lib/discovery), [`src/lib/trust/jws.ts`](../src/lib/trust/jws.ts), [`docs/decisions`](../docs/decisions).

How to check: `npm run eval -- --suite openness`; `/api/v1/openapi.json` on the live demo; `/.well-known/jwks.json` on the live demo; `/llms.txt` on the live demo.

Measured:

- Openness eval suite: 8/8 cases pass (bar 100%).
- Unit and integration tests: 733/733 pass in 90 files.

Known limit: Agents use demo bearer tokens, not OAuth 2.1. AP2, UCP and Peppol are followed in names and shapes; no Peppol UBL document is produced.

## Core requirements

| Brief | Status | Answer | Where | Check |
|---|---|---|---|---|
| Product, price & availability lookup: a structured way for an external agent to search for and retrieve what's available and at what price. | Covered | search_catalog and get_product (MCP), POST /api/v1/products/search and GET /api/v1/products/{id} (REST). Hits carry an indicative live price, stock, delivery date and order cut-off, plus pack maths for the stated need. 7 MCP tools in all. | [`src/lib/catalog/search.ts`](../src/lib/catalog/search.ts)<br>[`src/lib/gateway/preview.ts`](../src/lib/gateway/preview.ts)<br>[`src/lib/mcp/tools.ts`](../src/lib/mcp/tools.ts) | eval O6; `/api/v1/openapi.json` on the live demo |
| Requesting price & availability, then placing an order: a defined interaction for moving from inquiry to commitment, based on fixed prices rather than a negotiated quote. | Covered | request_quote returns an offer signed by the wholesaler key with a fixed net price, valid 15 minutes. place_order takes that offer unchanged plus the signed mandate and an idempotency key. One offer gives one order. Over REST the answer says the outcome: 201 confirmed, 202 waiting for a person, 422 blocked with the blocked order in the problem body. | [`src/lib/offers/quote.ts`](../src/lib/offers/quote.ts)<br>[`src/lib/offers/assemble.ts`](../src/lib/offers/assemble.ts)<br>[`src/lib/orders/place.ts`](../src/lib/orders/place.ts) | eval 1; eval G1; eval G9 |
| Permission & human-approval management: what the agent may decide on its own, and what must go to a human for sign-off. | Covered | A buyer-signed mandate with 15 rules in three tiers (alone, ask a person, never). Orders in the ask tier wait for the named approver, whose decision is signed with the approver key. | [`src/lib/policy/evaluate.ts`](../src/lib/policy/evaluate.ts)<br>[`src/lib/mandate/defaults.ts`](../src/lib/mandate/defaults.ts)<br>[`src/lib/orders/approval.ts`](../src/lib/orders/approval.ts)<br>[`src/app/approve/[orderId]/page.tsx`](../src/app/approve/%5BorderId%5D/page.tsx) | eval 4; eval G10; `/buyer/mandate` on the live demo |

## Optional directions

| Brief | Status | Answer | Where | Check |
|---|---|---|---|---|
| Delivery time & sustainability comparison: not just price, but delivery reliability and the certificates/sustainability labels already shown in the webshop. (Category-level carbon-footprint ranges are a stretch goal.) | Covered | Every search hit and every signed offer line carries country of origin, labels, delivery reliability (0 to 1) and the category-average CO2 per kg. Search ranks a clear match by price, reliability or sustainability. The CO2 figure is a category average, not a range and not a product measurement. | [`src/lib/contracts/facts.ts`](../src/lib/contracts/facts.ts)<br>[`src/lib/catalog/facts.ts`](../src/lib/catalog/facts.ts)<br>[`src/lib/gateway/ranking.ts`](../src/lib/gateway/ranking.ts) | eval T14; `tests/offers/facts.test.ts` |
| Substitution and other exception handling: what happens when the exact request can't be met. | Covered | Short stock, a passed order cut-off and late delivery each return signed alternatives with a tier (good, better, best), the tier's meaning and the trade-off in one sentence. The mandate decides whether a substitute may be taken alone. | [`src/lib/offers/alternatives.ts`](../src/lib/offers/alternatives.ts)<br>[`src/lib/policy/rules/fulfilment.ts`](../src/lib/policy/rules/fulfilment.ts) | eval 5; eval 6 |
| Traceability and explainability: a human-readable record of what the agent did and why. | Covered | Each step appends a signed entry with a one-sentence summary to a hash chain. Each order lists every rule with its result and reason. The agent's runs show each tool call in plain words. | [`src/lib/audit/chain.ts`](../src/lib/audit/chain.ts)<br>[`src/lib/orders/summaries.ts`](../src/lib/orders/summaries.ts)<br>[`src/components/agent/RunBlock.tsx`](../src/components/agent/RunBlock.tsx)<br>[`src/app/buyer/log/page.tsx`](../src/app/buyer/log/page.tsx) | eval T6; `/buyer/log` on the live demo |

## Problems the brief asks to tackle

| Brief | Status | Answer | Where | Check |
|---|---|---|---|---|
| Trust protocol: the minimum data/verification standard for an external agent to trust Valio Aimo's claims on stock, price and origin without a manual check. | Covered | Price, stock, delivery date, order cut-off, origin and labels are inside one offer signed with ES256; the public keys are at /.well-known/jwks.json; the offer expires after 15 minutes and gives one order. docs/trust-protocol.md lists the verification steps. | [`docs/trust-protocol.md`](../docs/trust-protocol.md)<br>[`src/lib/contracts/offer.ts`](../src/lib/contracts/offer.ts)<br>[`src/lib/trust/jws.ts`](../src/lib/trust/jws.ts)<br>[`src/lib/discovery/jwks.ts`](../src/lib/discovery/jwks.ts) | eval T2; eval T14; `/.well-known/jwks.json` on the live demo |
| Guardrails model: which decisions require human sign-off (spend threshold, substitutions outside stated preferences) vs. fully autonomous. | Covered | Spend per order and per week, category, allergens and claims, substitution policy and price cap, partial and late delivery, match confidence and first-time products: 15 rules, each with a defined tier. | [`src/lib/policy/rules/spend.ts`](../src/lib/policy/rules/spend.ts)<br>[`src/lib/policy/rules/fulfilment.ts`](../src/lib/policy/rules/fulfilment.ts)<br>[`src/lib/policy/rules/products.ts`](../src/lib/policy/rules/products.ts)<br>[`src/lib/policy/rules/trust.ts`](../src/lib/policy/rules/trust.ts) | `npm run eval -- --suite guardrails`; `tests/policy/evaluate.test.ts` |
| Response logic: how an agent handles partial availability and substitution ranking ("good-better-best") within Valio Aimo's own assortment. | Covered | good is the cheapest like-for-like product that covers the need on time; better keeps what is in stock and fills the rest, or takes the most reliable product; best is an organic or Finnish-label product. Each meaning is returned with the alternative. | [`src/lib/offers/alternatives.ts`](../src/lib/offers/alternatives.ts)<br>[`src/components/order/Alternatives.tsx`](../src/components/order/Alternatives.tsx) | eval 5; `tests/offers/quote.test.ts` |
| Audit trail: a usable, human-readable log of an agent's purchasing decisions, for both buyer and Valio Aimo. | Covered | One signed hash chain, read by the buyer at /buyer/log and by the wholesaler at /valio/audit (filter by buyer, export as JSON). Anyone can verify it with the published keys. | [`src/app/buyer/log/page.tsx`](../src/app/buyer/log/page.tsx)<br>[`src/app/valio/audit/page.tsx`](../src/app/valio/audit/page.tsx)<br>[`src/lib/audit/verify.ts`](../src/lib/audit/verify.ts)<br>[`src/lib/console/verify.ts`](../src/lib/console/verify.ts) | eval T6; eval T10; `/valio/audit` on the live demo |

## Without exposing real systems, confidential data or the marketplace roadmap

| Not exposed | Status | Answer | Where | Check |
|---|---|---|---|---|
| Real systems | Covered | The upstream API key and address stay on the server. Agents call Laituri's own routes; upstream answers are normalised into Laituri's contracts before anything is returned. | [`src/lib/valio/http.ts`](../src/lib/valio/http.ts)<br>[`src/lib/valio/normalise.ts`](../src/lib/valio/normalise.ts) | `/api/v1/openapi.json` on the live demo |
| Confidential data | Partly | Agents receive only the fields defined in the published schemas; the MCP server parses every tool result against its output schema, which drops any other field, and a result that does not parse is withheld and answered as a tool error. For an agent token, orders, offers, the mandate and approvals are scoped to its own buyer. The audit log is one public chain whose entries carry summaries with other buyers' products, quantities and prices (see Public audit log under Simulated, assumed and not built). | [`src/lib/contracts`](../src/lib/contracts)<br>[`src/lib/mcp/server.ts`](../src/lib/mcp/server.ts)<br>[`src/lib/http/buyer-scope.ts`](../src/lib/http/buyer-scope.ts)<br>[`src/app/api/v1/offers/[id]/route.ts`](../src/app/api/v1/offers/%5Bid%5D/route.ts) | eval O6; eval G21; `tests/buyers/isolation.test.ts`; `tests/mcp/output-validation.test.ts` |
| The buyer's terms | Covered | The wholesaler's overview counts which mandate rule held or stopped an order and its tier, never the limits or values behind it. | [`src/lib/insights/rules.ts`](../src/lib/insights/rules.ts)<br>[`src/lib/contracts/supplier.ts`](../src/lib/contracts/supplier.ts) | `tests/insights/insights.test.ts` |
| The marketplace roadmap | Covered | Nothing in the interface depends on a marketplace: it exposes today's catalogue, price, availability and ordering only. All data is the challenge's synthetic data. | [`src/lib/openapi/registry.ts`](../src/lib/openapi/registry.ts)<br>[`fixtures/upstream`](../fixtures/upstream) | `/api/v1/openapi.json` on the live demo |

## Example scenarios

| Example scenario in the brief | Status | What exists | Where |
|---|---|---|---|
| Need → recipe → order | Not built | No recipe model and no kitchen stock data. The ordering step at the end is what Laituri provides. | None |
| Last-minute event | Partly | "By tomorrow" requests, passed order cut-offs and late dates are flagged with signed on-time alternatives. No recipe logic: alternatives are like for like. | [`src/lib/policy/rules/fulfilment.ts`](../src/lib/policy/rules/fulfilment.ts), [`src/lib/offers/alternatives.ts`](../src/lib/offers/alternatives.ts), eval 6, eval 13 |
| Supplier stock-out | Partly | Short stock returns a signed split or substitute with a one-sentence trade-off. It answers at quote time, not before the kitchen asks, and substitutes are like for like rather than recipe-compatible. | [`src/lib/offers/alternatives.ts`](../src/lib/offers/alternatives.ts), eval 5 |
| Proactive selling agent | Not built | The wholesaler side shows unmet demand (what agents asked for and could not get), which such an agent would start from. Nothing is pushed to buyers' agents. | [`src/lib/insights/requests.ts`](../src/lib/insights/requests.ts), [`src/app/valio/demand/page.tsx`](../src/app/valio/demand/page.tsx), `/valio/demand` on the live demo |
| Allergen-safe substitution under pressure | Partly | The school kitchens' mandate excludes peanut, nuts and sesame, also as traces, and every line, substitutes included, is checked. Missing allergen data blocks the line. Nutrition rules are not modelled. | [`src/lib/policy/rules/products.ts`](../src/lib/policy/rules/products.ts), [`src/lib/mandate/defaults.ts`](../src/lib/mandate/defaults.ts), eval 9b, `tests/demo/two-kitchens.test.ts` |
| Standing order drift detection | Not built | No standing orders. The nearest control is the weekly spend limit and the rule that sends a first-time product to a person. | [`src/lib/policy/rules/spend.ts`](../src/lib/policy/rules/spend.ts), eval 14, eval 18 |

## Simulated, assumed and not built

Simulated or assumed:

- **Orders.** Orders are simulated. The mock API has price and availability but no order endpoint, so Laituri creates the order, the receipt and the log entry itself and marks every order simulated: true. ([`src/lib/orders/confirm.ts`](../src/lib/orders/confirm.ts))
- **Keys.** One server holds all three private keys (buyer, supplier, approver) in .data/keys, so one deployment plays all three parties. In production each party keeps its own key. ([`src/lib/trust/keys.ts`](../src/lib/trust/keys.ts))
- **Agent identity.** Agents use demo bearer tokens instead of OAuth 2.1: in the shared workspace the fixed demo-agent-token, demo-kaisla-token and demo-laine-token, one per demo buyer; in each visitor's sandbox random keys, one per buyer, that work only there. The OAuth protected-resource metadata is already published. ([`src/lib/http/agent.ts`](../src/lib/http/agent.ts), [`src/lib/workspace/sandboxes.ts`](../src/lib/workspace/sandboxes.ts), [`src/app/.well-known/oauth-protected-resource/route.ts`](../src/app/.well-known/oauth-protected-resource/route.ts))
- **Workspaces.** Every browser gets its own sandbox: an in-memory copy of all mutable state (offers, orders, audit chain, activity, demand, mandates, suspensions, demo runs), named by a random HttpOnly cookie and copied from a seeded template written once at start-up, so it starts with the same verifiable week. At most 300 sandboxes live at once (LAITURI_SANDBOX_MAX); the least recently used is dropped first, and one unused for 60 minutes (LAITURI_SANDBOX_IDLE_MINUTES) is replaced by a fresh copy. Sandboxes are never written to disk. Calls without a cookie or sandbox key, such as the documented curl flows, reach the one shared workspace, which is persisted. The catalogue, the signing keys and the upstream client are shared by all. ([`src/lib/workspace/context.ts`](../src/lib/workspace/context.ts), [`src/lib/workspace/sandboxes.ts`](../src/lib/workspace/sandboxes.ts), [`src/lib/http/workspace.ts`](../src/lib/http/workspace.ts), [`src/proxy.ts`](../src/proxy.ts))
- **Demo buyers.** 3 demo buyers (Nordic Harbour Hotels, Kaisla School Kitchens, Ravintola Laine) trade under the mock API's one customer number; the signed buyer id keeps them apart. ([`src/lib/mandate/defaults.ts`](../src/lib/mandate/defaults.ts))
- **Seeded history.** On an empty state the server plays 31 requests by the demo buyers over about a week through the real gateway, at past times. Every offer, order, approval and audit entry is signed and chained as in live use, and marked seeded. LAITURI_SEED=off turns it off. ([`src/lib/seed/plan.ts`](../src/lib/seed/plan.ts), [`src/lib/seed/index.ts`](../src/lib/seed/index.ts))
- **Demo access.** In their own sandbox, and only there, one click signs a visitor in as the hotel's approver or as the wholesaler's operator without a passcode; each approval, mandate change, suspension or resumption made that way says "demo access" in the audit log. The session is bound to that sandbox, and an agent holding only a sandbox key cannot get its cookie or a session. The shared workspace takes the passcodes (LAITURI_APPROVER_PASSCODE, LAITURI_OPERATOR_PASSCODE); without one, a production server offers no sign-in there and only a local development server signs anyone in. LAITURI_DEMO_ACCESS=off disables demo access. ([`src/lib/http/sign-in.ts`](../src/lib/http/sign-in.ts), [`src/lib/http/console-session.ts`](../src/lib/http/console-session.ts), [`src/lib/http/operator-session.ts`](../src/lib/http/operator-session.ts))
- **Open reading.** Orders, approvals, the mandate and the audit log can be read without signing in, so anyone can watch. They hold synthetic data only. Production puts every read behind each party's own access control. ([`src/lib/http/buyer-scope.ts`](../src/lib/http/buyer-scope.ts))
- **Demo controls.** Starting a scene, altering one log entry to show detection and resetting act on the caller's own workspace and refuse agent credentials. In a sandbox the browser may use them freely; in the shared workspace altering the log and resetting need the approver. Suspending or resuming an agent needs a wholesaler operator session everywhere. The altered entry is put back after five minutes. A production deployment has none of these controls open. ([`src/lib/demo/tamper.ts`](../src/lib/demo/tamper.ts), [`src/app/api/v1/demo/reset/route.ts`](../src/app/api/v1/demo/reset/route.ts), [`src/app/api/v1/supplier/agents/[agentId]/suspension/route.ts`](../src/app/api/v1/supplier/agents/%5BagentId%5D/suspension/route.ts))
- **State.** State is kept in memory with a JSON snapshot on disk. An order, an approval, a mandate change, a suspension and each audit entry are written to disk (temporary file, fsync, rename) before the call returns, and a failed write fails the call. Offers, activity and demand records are saved a moment later. An unreadable snapshot is kept aside under a new name and reported by /api/v1/health, and the service starts empty. One process serialises order decisions, so two orders cannot pass a limit together. ([`src/lib/store/memory.ts`](../src/lib/store/memory.ts), [`src/lib/store/snapshot.ts`](../src/lib/store/snapshot.ts), [`src/lib/orders/lock.ts`](../src/lib/orders/lock.ts))
- **Recorded mode.** Without an API key, recorded price and availability answers for 255 products replay with a fixed clock. Tests and evals always use this mode. ([`src/lib/valio/recorded.ts`](../src/lib/valio/recorded.ts), [`fixtures/upstream`](../fixtures/upstream))
- **Product concepts.** Category groups and the product concept list are our own, built from the product data. "Lactose-free milk" is sold as "lactose-free milk drink"; Laituri treats them as one request and shows the product name it chose. ([`src/lib/catalog/build/groups.ts`](../src/lib/catalog/build/groups.ts), [`src/lib/catalog/lexicon.ts`](../src/lib/catalog/lexicon.ts))
- **Upstream data.** A closingTime in the past means that delivery date can no longer be ordered. An available amount of 9999999999 or 999999 means the wholesaler does not track stock, not that stock is unlimited: the signed offer line says stock: "untracked" and gives no available count. Availability returns the next delivery date whatever date is asked; Laituri compares it with the requested date. ([`src/lib/valio/normalise.ts`](../src/lib/valio/normalise.ts))
- **Plausible quantities.** One order line may ask for at most 20,000 l, 20,000 kg or 20,000 sales units (LAITURI_MAX_LINE_LITRES, LAITURI_MAX_LINE_KG, LAITURI_MAX_LINE_UNITS); a larger quantity, or a delivery date before today, is refused at quote time with 422. A line on untracked stock above 25 % of its ceiling waits for a person (delivery.partial). The ceilings are our assumption, not the wholesaler's. ([`src/lib/offers/limits.ts`](../src/lib/offers/limits.ts), [`src/lib/policy/rules/fulfilment.ts`](../src/lib/policy/rules/fulfilment.ts))
- **Pack contents.** Litres or kilograms per sales unit come from the product's unit data, else from the price divided by the comparison price. ([`src/lib/offers/packs.ts`](../src/lib/offers/packs.ts))
- **Carbon figure.** The CO2 figure is the average for the product's category (categoryAverageCo2PerKg), not a measurement of the product. ([`src/lib/contracts/facts.ts`](../src/lib/contracts/facts.ts))
- **Request check.** The wholesaler compares the buyer's words, sent as the quote's intent, with every offer before it signs it: the product, every claim, words it does not understand, the quantity (covers the need, at most one lot over), the date, a budget and an order to wait for a person. Each is met, unmet or unchecked and is signed inside the offer. An order is confirmed alone only when all are met; a certain mismatch (wrong product, a missing claim, less than half the need asked for) blocks it, and anything else waits for the approver with the requirement named. The agent's stated match confidence never counts for more than the wholesaler finds. What the goods are for ("for the breakfast buffets") is kept as context and not checked. An agent that sends no words gets no request check, and its order can still be confirmed alone inside the mandate. ([`src/lib/request/index.ts`](../src/lib/request/index.ts), [`src/lib/request/requirements.ts`](../src/lib/request/requirements.ts), [`src/lib/policy/rules/products.ts`](../src/lib/policy/rules/products.ts), [`src/lib/gateway/confidence.ts`](../src/lib/gateway/confidence.ts))
- **Approver judgement.** An approval re-checks the order against the mandate in force at that moment. What the ask tier flagged, such as a weekly limit or a category the mandate no longer lists, is the approver's to decide, so an approver can approve several waiting orders that together pass the weekly limit; each order shows the limit it passed. A never-tier rule, an invalid or expired mandate, or an offer that expired or was used stops the approval, and the order is blocked with a signed audit entry. ([`src/lib/orders/approval.ts`](../src/lib/orders/approval.ts), [`src/lib/orders/recheck.ts`](../src/lib/orders/recheck.ts))
- **Audit completeness.** Verification proves that entries were not changed, reordered or removed from the middle. A verifier that remembers a head (size and hash) checks that the entry at that size still carries that hash in any later log, so a log that was cut, cut and extended, or rewritten from an earlier entry is detected whatever its length. The service will not append onto a tail that fails its hash, link, signature or remembered head. While the log does not verify, approvals are paused. ([`src/lib/audit/verify.ts`](../src/lib/audit/verify.ts), [`src/lib/audit/tail.ts`](../src/lib/audit/tail.ts), [`src/lib/audit/chain.ts`](../src/lib/audit/chain.ts), [`src/lib/audit/head.ts`](../src/lib/audit/head.ts), [`src/lib/gateway/gateway.ts`](../src/lib/gateway/gateway.ts))
- **Public audit log.** The audit log is one public chain, so anyone can verify all of it: every reader, with any token or none, reads every buyer's entries. Each entry names its buyer and carries a one-sentence summary and structured data: what was searched for, the products and quantities offered and ordered, offer and order totals in euros, delivery dates, the mandate checks that held or stopped an order with their messages (which can quote a buyer's limit), and each mandate change. Between buyers that is commercially sensitive. Production keeps the one chain but gives each buyer only its own entries, each with an inclusion proof against a signed checkpoint, and keeps summaries free of prices and quantities. ([`src/app/api/v1/audit/route.ts`](../src/app/api/v1/audit/route.ts), [`src/lib/orders/summaries.ts`](../src/lib/orders/summaries.ts), [`src/lib/gateway/describe.ts`](../src/lib/gateway/describe.ts))
- **Buyer agent.** The fixed demo scenes, the tests and the evals use a scripted buyer agent, so results repeat. Free-text requests use Claude or Gemini when a key is set, else the scripted agent. ([`src/lib/agent/purchase.ts`](../src/lib/agent/purchase.ts), [`src/lib/agent/llm/engine.ts`](../src/lib/agent/llm/engine.ts))
- **Voice.** Spoken input uses the browser's Web Speech API. Spoken answers use the browser's voice, or ElevenLabs when a key is set on the server. ([`src/lib/voice/speech-to-text.ts`](../src/lib/voice/speech-to-text.ts), [`src/lib/voice/text-to-speech.ts`](../src/lib/voice/text-to-speech.ts))

Not built:

- **Recipes.** No recipe model: substitutes are like for like, not recipe-compatible.
- **Kitchen stock.** The agent does not read the kitchen's own stock or ERP.
- **Proactive selling.** No wholesaler agent that pushes products to buyers' agents.
- **Standing orders.** No recurring orders and no drift detection.
- **Payments.** No agentic payment (x402 or similar); orders follow the buyer's existing account terms.
- **Peppol documents.** The receipt carries Peppol order-response codes, but no UBL document is produced.
- **Nutrition rules.** Allergens and claims are checked; nutrition values are not.
<!-- END:evidence:judging -->
