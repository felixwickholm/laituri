# Laituri

An open MCP and REST front door that lets a customer's own AI purchasing agent buy from Valio Aimo at a signed fixed price, inside limits a person signed, with a log anyone can verify.

![Laituri: the buyer side with an order waiting for approval, and the wholesaler side with connected agents](docs/images/hero.png)

Live: https://laituri.wicflow.com · Paper: [docs/paper.md](docs/paper.md) (also at `/paper`; for an AI in one fetch: `/llms-full.txt`)

Built for the Valio Aimo challenge "Trusted Trade Agents" at Junction 2026, on the challenge's synthetic data. Orders are simulated; see [Simulated, assumed and not built](#simulated-assumed-and-not-built).

## Demo walkthrough

- **Walkthrough.** "Demo walkthrough" opens by itself on arrival, or open `/buyer?tour=1`. It drives the running product: the brief's milk order, a weekly basket with the reason for every orange and red line, a phone approval, the customer's limits, the shop, Valio recipes, Valio Aimo's view, security and the record.
- **Three clicks.** `/buyer` (run the weekly order), `/buyer/plan` (plan an event), `/security` (see unusual actions stopped).
- **One curl.** `curl -X POST https://laituri.wicflow.com/api/v1/workspace` gives you a private sandbox with agent keys; `/llms.txt` takes it from there.

## How each judging criterion is met

<!-- BEGIN:evidence:numbers -->
Measured by `npm run evidence` (numbers in [`src/lib/evidence/facts.json`](src/lib/evidence/facts.json)):

- Unit and integration tests: 3644/3644 pass in 155 files.
- Eval suites (`npm run eval`, recorded data, fixed clock): Scenarios 38/38, Guardrails 38/38, Trust 17/17, Openness 8/8; 101/101 cases in all.
- 18 mandate rules, 11 MCP tools, 41 REST operations on 35 paths, 6 discovery documents, 3 signing keys.
- 3 demo buyers; 31 seeded requests (24 of them place an order); recorded answers for 255 products.
<!-- END:evidence:numbers -->

<!-- BEGIN:evidence:criteria -->
| Criterion (weight) | What we built (all items in docs/judging.md) | Evidence | Known limit |
|---|---|---|---|
| **Working end-to-end demo** (30%) | A request in plain words goes through search, a signed fixed-price offer, the mandate check and either an automatic order or a person's signed approval, over the same MCP and REST interface an outside agent uses.<br>• Buyer side (/buyer): the agent takes "1,000 litres of lactose-free milk by Monday", gets a signed offer, and the order confirms; 1,600 litres waits for the approver. | Scenarios eval suite: 38/38 cases pass (bar >=90%)<br>Check: `/buyer?tour=1` on the live demo; `npm run eval -- --suite scenarios` | Orders are simulated: the mock API has price and availability but no order endpoint, so Laituri writes the order and receipt itself and marks each one simulated: true. |
| **Solving the problem and user need** (20%) | The agent orders what the buyer asked for: the wholesaler turns litres and kilograms into whole sales units, compares the buyer's words with every offer and signs that comparison into it, and an order that does not meet the words in full is never confirmed alone.<br>• Search reads Finnish, Swedish or English needs as a product concept plus claims (for example lactose_free) and returns a match confidence. | 38/38 scenario cases end on the expected route with the expected concept, amount and date<br>Check: eval 2; eval 12 | The product concepts and category groups are our own, built from the product data. The catalogue sells "lactose-free milk" as "lactose-free milk drink"; Laituri treats the two as one request and names the product it chose. |
| **Autonomy and controls** (20%) | A buyer-signed mandate sets what the agent may do alone, what waits for a named person and what is never allowed, and every decision is a signed entry in a hash-chained log that both sides verify with public keys.<br>• 18 named mandate rules run on every order; each result (pass, ask or block) is listed on the order with its reason. | Guardrails eval suite: 38/38 cases pass (bar 100%)<br>Check: `npm run eval -- --suite guardrails`; eval G10 | In the demo one server holds all three private keys. In a visitor's own sandbox the browser is signed in as the approver and the operator without a passcode, and the audit log labels each such action "demo access"; the shared workspace needs a passcode. |
| **Robustness to exception situations** (15%) | When a request cannot be met in full and on time, the wholesaler returns signed counter-offers ranked good, better and best, and the buyer's mandate decides whether the agent may take one alone.<br>• Short stock: a split (keep what is in stock, fill the rest like for like) or a full substitute, each signed and each checked against the buyer's words for what it delivers. | Scenarios eval suite: 38/38 cases pass (bar >=90%)<br>Check: eval 5; eval 6 | A single order or basket line gets like-for-like substitutes within the wholesaler's own concept and category; swaps by recipe role run only inside a menu plan. Nothing watches stock between orders, so a swap comes when the kitchen plans or orders. |
| **Openness and credible path toward production** (15%) | One set of zod schemas produces the MCP tools, the REST routes and the OpenAPI 3.1 document; signatures are JWS with keys published as JWKS; assumptions, decisions and next steps are written down.<br>• 11 MCP tools and 41 REST operations on 35 paths, from one schema set. | Openness eval suite: 8/8 cases pass (bar 100%)<br>Check: `npm run eval -- --suite openness`; `/api/v1/openapi.json` on the live demo | Agents use demo bearer tokens, not OAuth 2.1. AP2, UCP and Peppol are followed in names and shapes; no Peppol UBL document is produced. |
<!-- END:evidence:criteria -->

## What makes it different

- **The wholesaler checks the offer against the buyer's own words, and signs that check.** Product, claims and attributes (lactose-free, UHT, fat level), exclusions such as "dairy-free", brand, quantity, date, budget and any instruction to hold are each met, unmet, substituted or not checked, for the product actually delivered. Only a fully met offer confirms alone; an agent that sends no words waits for a person ([`src/lib/request`](src/lib/request)).
- **Same sentence, two kitchens.** The hotel's order confirms; the school's is blocked because its mandate excludes sesame even as a trace ([`tests/demo/two-kitchens.test.ts`](tests/demo/two-kitchens.test.ts)).
- **Autonomy from history.** A product bought before is reordered alone inside the limits; a new one waits for a person; a never-buy product is refused ([`src/lib/policy/rules/products.ts`](src/lib/policy/rules/products.ts)).
- **Exceptions are signed counter-offers.** Good, better and best, each with its trade-off; in a menu, swaps by recipe role ([`src/lib/offers/alternatives.ts`](src/lib/offers/alternatives.ts), [`src/lib/recipes/roles.ts`](src/lib/recipes/roles.ts)).
- **Approval at human speed.** A waiting order keeps its price until the order cut-off; stock is checked again at approval.
- **A tamper-evident log, verified in the browser.** Alter one stored entry and watch the log name it ([`src/lib/console/verify.ts`](src/lib/console/verify.ts)).

## What stays private

The brief asks for this "without exposing real systems, confidential data or the marketplace roadmap". Everything below is synthetic data.

<!-- BEGIN:evidence:privacy-brief -->
| Not exposed | Answer | Code | Check |
|---|---|---|---|
| Query the APIs only when needed, never for all products | Search runs on the product files `npm run setup` downloads once. Price and stock are asked for at most 10 hits per search and 13 ids per quoted line, cached for a minute: a 20-line weekly order asks about 228 of 17,546 products in 10 requests. /api/v1/health counts them. | [`src/lib/valio/budget.ts`](src/lib/valio/budget.ts) | `tests/basket/upstream.test.ts` |
| Real systems | The upstream API key and address stay on the server. Agents call Laituri's own routes; upstream answers are normalised into Laituri's contracts before anything is returned, and no error names an upstream URL, path or key. | [`src/lib/valio/http.ts`](src/lib/valio/http.ts) | `/api/v1/openapi.json` on the live demo |
| Confidential data | No credential, no reads: without an agent key, a sandbox cookie or a signed-in session, orders, offers, the mandate, approvals, activity, the supplier overview and audit entries answer 401. An agent key reads only its own buyer's records; in the audit log it sees other buyers' entries only as redacted stubs that still verify the chain. Agents receive only the fields in the published schemas; the MCP server parses every tool result against its output schema and withholds one that does not parse. | [`src/lib/http/buyer-scope.ts`](src/lib/http/buyer-scope.ts) | eval O6; eval G21; `tests/buyers/isolation.test.ts`; `tests/mcp/output-validation.test.ts` |
| The buyer's terms | The dashboard does not show a buyer's limits; it shows which rule fired. The wholesaler's overview counts which mandate rule held or stopped an order and its tier, never the limits or values behind it. | [`src/lib/insights/rules.ts`](src/lib/insights/rules.ts) | `tests/insights/insights.test.ts` |
| The marketplace roadmap | Nothing in the interface depends on a marketplace: it exposes today's catalogue, price, availability and ordering only. All data is the challenge's synthetic data. | [`src/lib/openapi/registry.ts`](src/lib/openapi/registry.ts) | `/api/v1/openapi.json` on the live demo |
<!-- END:evidence:privacy-brief -->

## Quickstart

```bash
cp .env.example .env      # add VALIO_API_KEY for live prices
npm install
npm run setup             # downloads the product data once and builds the search index
npm run dev               # http://localhost:3210
```

No key? `VALIO_MODE=recorded npm run dev` replays recorded answers. Then `npm test`, `npm run eval`, `npm run typecheck` and `npm run lint`; `npm run evidence` re-measures the numbers in this README and `docs/`.

## Eval results

<!-- BEGIN:evidence:evals -->
| Suite | Passed | Bar | Result | What it proves |
|---|---|---|---|---|
| Scenarios (`scenarios`) | 38/38 | >=90% | met | Plain-language requests end on the right route (auto, approval, blocked, no order) with the right product, amount and date, and a verified audit trail. |
| Guardrails (`guardrails`) | 38/38 | 100% | met | Edited, expired, replayed or wrongly signed inputs, forged approvals, injected instructions and races never get past the mandate. |
| Trust (`trust`) | 17/17 | 100% | met | Every signature verifies with the published keys, and any changed, deleted, reordered or cut entry is detected. |
| Openness (`openness`) | 8/8 | 100% | met | The OpenAPI document and MCP tools are complete and callable, discovery documents are served, and an agent that reads llms.txt over HTTP buys by following its REST flow. |

Unit and integration tests: 3644/3644 pass in 155 files (`npm test`).
<!-- END:evidence:evals -->

Every case and what it proves: [docs/evals.md](docs/evals.md).

## Simulated, assumed and not built

<!-- BEGIN:evidence:simulated -->
Simulated or assumed (each in full, with the code behind it, in [docs/judging.md](docs/judging.md#simulated-assumed-and-not-built)):

- **Orders:** no order endpoint upstream, so Laituri writes the order and receipt, marked simulated.
- **Keys:** one server holds the buyer, supplier and approver keys.
- **Agent identity:** demo bearer keys, not OAuth 2.1.
- **Workspaces:** a private in-memory sandbox per visitor, copied from a seeded week.
- **Demo buyers:** three buyers under the mock API's one customer number.
- **Seeded history:** four weeks of standing orders and a week of requests, played through the real gateway at start-up.
- **Weekly orders:** demo standing orders, one minute per line by hand, Valio Aimo open 8:00-16:00 on weekdays.
- **Demo access:** one-click approver and operator sign-in, in a browser's own sandbox only, labelled in the log.
- **Who reads what:** no credential, no reads; agent keys read only their own buyer.
- **Demo controls:** scenes, log tampering and reset act on the caller's own workspace.
- **State:** memory with a JSON snapshot on disk, one process.
- **Recorded mode:** recorded upstream answers and a fixed clock for tests and evals.
- **Product concepts:** our own concept list and category groups.
- **Upstream data:** our reading of cut-off times and untracked stock.
- **Plausible quantities:** our own ceilings per product, after merging lines.
- **Pack contents:** litres and kilograms per unit from product data or price ratios.
- **Carbon figure:** a category average, not a product measurement.
- **Request check:** our reading of the buyer's words, in English, Finnish and Swedish.
- **Approver judgement:** the approver decides what the ask tier flagged; prices held until the cut-off.
- **Audit completeness:** a cut tail is caught only against a remembered head.
- **Audit log reads:** other buyers' entries reach an agent only as verifiable stubs.
- **Workspace binding:** mandates and offers are bound to the workspace that signed them.
- **Stock across orders:** upstream stock minus this workspace's own orders.
- **Buyer agent:** a scripted agent for scenes, tests and evals; Claude or Gemini for free text.
- **Recipes:** Valio's professional recipes (valioaimo.fi, read 2026-11-14), ours as a fallback.
- **Menu prices:** indicative until ordered.
- **Reading an event:** rules; a model only reads the words.
- **Kitchen stock:** demo stock lists.
- **Event calendar:** one demo booking per kitchen.
- **Seasonal proposals:** our own season list.
- **Voice:** browser speech, ElevenLabs when a key is set.

Not built: Payments, Peppol documents, Nutrition rules.
<!-- END:evidence:simulated -->

## Read more

- [Paper](docs/paper.md): the design, each criterion with how to verify it, the scenarios, the threat table, the limits and a five-minute evaluation.
- [Judging map](docs/judging.md): every criterion in full, the brief's requirements, scenario coverage and every assumption.
- [Trust protocol](docs/trust-protocol.md): what is signed, how an agent verifies it, and the failure cases.
- [Mandates](docs/mandates.md): the rules in three tiers and the three demo buyers.
- [Architecture](docs/architecture.md): how it works, connecting an agent, the MCP tools, key custody, sequences and layout.
- [From demo to production](docs/production.md): the path, the scope note and the standards used.
- [Evals](docs/evals.md) and [decision records](docs/decisions).

## Licence

MIT. See [LICENSE](LICENSE).
