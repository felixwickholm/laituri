# Evals

Four automated suites run the real application code in process, without a server, on recorded upstream answers and a fixed clock (Saturday 2026-11-14 09:00 Helsinki time, so "by Monday" means 2026-11-16). Each case starts from a clean state; `evals/report.json` also records what each run saw. The runner is [`evals/run.ts`](../evals/run.ts); the suites are in [`evals/suites`](../evals/suites).

## How to run

```bash
npm run eval                      # all four suites, recorded data; writes evals/report.json
npm run eval -- --suite trust     # one suite (does not rewrite the report)
npm run eval -- --json            # the report on stdout
npm run eval -- --live            # smoke subset against the live mock API (needs VALIO_API_KEY and npm run setup)
npm run evidence                  # re-runs evals and tests and regenerates the numbers below
```

A recorded run reads the pinned clock, so an unchanged result writes an unchanged `evals/report.json`.

## Latest numbers

Generated from [`evals/report.json`](../evals/report.json) and [`src/lib/evidence/facts.json`](../src/lib/evidence/facts.json) by `npm run evidence`.

<!-- BEGIN:evidence:evals -->
| Suite | Passed | Bar | Result | What it proves |
|---|---|---|---|---|
| Scenarios (`scenarios`) | 38/38 | >=90% | met | Plain-language requests end on the right route (auto, approval, blocked, no order) with the right product, amount and date, and a verified audit trail. |
| Guardrails (`guardrails`) | 38/38 | 100% | met | Edited, expired, replayed or wrongly signed inputs, forged approvals, injected instructions and races never get past the mandate. |
| Trust (`trust`) | 17/17 | 100% | met | Every signature verifies with the published keys, and any changed, deleted, reordered or cut entry is detected. |
| Openness (`openness`) | 8/8 | 100% | met | The OpenAPI document and MCP tools are complete and callable, discovery documents are served, and an agent that reads llms.txt over HTTP buys by following its REST flow. |

Unit and integration tests: 3638/3638 pass in 155 files (`npm test`).
<!-- END:evidence:evals -->

## What each suite proves

- **Scenarios.** A plain-language request goes through the scripted buyer agent and the gateway. Each case states the expected route (auto, approval, blocked or no order), the product concept and claims, the minimum amount (at most one lot more than asked), the delivery date and the rules that must flag. Every case also checks that the audit trail for the run is complete and verifies.
- **Guardrails.** Hostile or broken input: edited, expired, replayed or wrongly signed offers; raised or self-signed mandates; approvals from agent credentials, forged headers or replayed approval tokens; instructions written into the request text; negative, zero and absurd quantities; injection-like strings; concurrent orders that together pass the weekly limit. The bar is 100%.
- **Trust.** The JWKS publishes public keys only. Offers, mandates, approvals, receipts, audit entries and checkpoints verify with the published keys. One changed byte in an offer, receipt or audit entry, an origin or label edit, a deleted, reordered or cut entry: each is detected.
- **Openness.** The OpenAPI 3.1 document is complete (operationIds, resolving `$ref`s, every path answers as documented); MCP `tools/list` gives input and output schemas and every tool's result validates; discovery documents are served with the right content type; an outside agent that reads `llms.txt` over HTTP buys by following its REST flow.

## The outside-agent test (O8)

[`evals/support/outside-agent.ts`](../evals/support/outside-agent.ts) is an agent that knows nothing about Laituri except the text of `/llms.txt`. The eval starts the route handlers behind a plain `node:http` server on a free local port ([`evals/support/http-server.ts`](../evals/support/http-server.ts)), and the agent fetches `/llms.txt` from it over HTTP. Its first step is the one `llms.txt` gives: `POST /api/v1/workspace`, which creates a private sandbox and returns its agent keys. It reads the `Idempotency-Key` header name from the text, then runs the curl lines of the numbered REST flow in document order with the URLs, headers and bodies as written and the key it was given: it searches, quotes the first hit that is orderable with the buyer's words as `intent`, reads the mandate and orders, filling each `<field from step N>` from that step's answer. It refuses a URL that points anywhere but the server it started. The case passes only if the order is confirmed. Any change to `llms.txt` that drops a step, a header or an example body fails this case.

## Every case

<!-- BEGIN:evidence:cases -->
### Scenarios (`scenarios`)

| Id | Case | Expected | Result |
|---|---|---|---|
| 1 | 1,000 l lactose-free milk | route auto; order 1000 x 464306; concept milk [lactose_free]; >= 1000 l by the eval's own pack sizes; delivery on time for 2026-11-16; audit sequence complete and verified | pass |
| 2 | Finnish request | route auto; order 1000 x 464306; concept milk [lactose_free]; >= 1000 l by the eval's own pack sizes; delivery on time for 2026-11-16; audit sequence complete and verified | pass |
| 3 | 200 l milk | route auto; order 200 x 464306; concept milk [lactose_free]; >= 200 l by the eval's own pack sizes; delivery on time for 2026-11-16; audit sequence complete and verified | pass |
| 4 | Over the per-order limit | route approval; order 3000 x 464306; concept milk [lactose_free]; >= 3000 l by the eval's own pack sizes; delivery on time for 2026-11-16; flags spend.per_order; audit sequence complete and verified | pass |
| 5 | Short stock, split covers need | route auto or approval; order 1000 x 464401; concept milk [lactose_free]; >= 1000 l by the eval's own pack sizes; delivery on time for 2026-11-16; audit sequence complete and verified | pass |
| 6 | Cut-off passed | route auto or approval; order 500 x 464306; concept milk [lactose_free]; >= 500 l by the eval's own pack sizes; delivery on time for 2026-11-16; audit sequence complete and verified | pass |
| 7 | 50 kg butter | route auto; order 100 x 464411; concept butter; >= 50 kg by the eval's own pack sizes; delivery on time for 2026-11-16; audit sequence complete and verified | pass |
| 8 | Oat drink keeps vegan | route auto or approval; order 40 x 468465; concept oat_drink [vegan]; >= 40 l by the eval's own pack sizes; delivery on time for 2026-11-16; audit sequence complete and verified | pass |
| 9 | Peanut butter | route blocked or no_order; audit sequence complete and verified | pass |
| 9b | Product that contains nuts | route blocked; order 40 x 460443; >= 40 l by the eval's own pack sizes; flags dietary.allergens; audit sequence complete and verified | pass |
| 10 | Unknown product | route no_order; agent not_found; audit sequence complete and verified | pass |
| 11 | No quantity | route no_order; agent needs_input; audit sequence complete and verified | pass |
| 12 | Vague request | route approval or no_order; flags match.confidence; audit sequence complete and verified | pass |
| 13 | Tomorrow is Sunday | route approval; order 100 x 464306; concept milk [lactose_free]; >= 100 l by the eval's own pack sizes; delivery one day late for 2026-11-15; flags delivery.deadline; audit sequence complete and verified | pass |
| 14 | Over the weekly limit | route approval; order 1000 x 464306; concept milk; >= 1000 l by the eval's own pack sizes; delivery on time for 2026-11-16; flags spend.per_week; audit sequence complete and verified | pass |
| 15 | Category outside mandate | route approval; order 20 x 462150; concept salmon; >= 20 kg by the eval's own pack sizes; delivery on time for 2026-11-16; flags category.allowed; audit sequence complete and verified | pass |
| 16 | Same idempotency key twice | route auto; order 200 x 464306; concept milk [lactose_free]; >= 200 l by the eval's own pack sizes; delivery on time for 2026-11-16; audit sequence complete and verified | pass |
| 17 | Mandate requires organic | route blocked or auto or approval; order 1000 x 464306; concept milk [lactose_free]; audit sequence complete and verified | pass |
| 18 | First-time product | route approval; order 200 x 464306; concept milk [lactose_free]; >= 200 l by the eval's own pack sizes; delivery on time for 2026-11-16; flags product.first_time; audit sequence complete and verified | pass |
| 19 | Words say wait for approval | route approval; order 200 x 464306; concept milk [lactose_free]; >= 200 l by the eval's own pack sizes; delivery on time for 2026-11-16; flags match.confidence; agent waiting; audit sequence complete and verified | pass |
| 20 | Words set a budget | route approval; order 80 x 464306; concept milk [lactose_free]; >= 80 l by the eval's own pack sizes; delivery on time for 2026-11-16; flags match.confidence; audit sequence complete and verified | pass |
| 21 | Finnish budget and wait | route approval; order 80 x 464306; concept milk [lactose_free]; >= 80 l by the eval's own pack sizes; delivery on time for 2026-11-16; flags match.confidence; audit sequence complete and verified | pass |
| 22 | Agent quotes the wrong milk | route blocked; order 1 x 469477; concept milk; flags match.confidence; agent blocked; audit sequence complete and verified | pass |
| 23 | Words not understood | route approval; order 200 x 464306; concept milk [lactose_free]; >= 200 l by the eval's own pack sizes; delivery on time for 2026-11-16; flags match.confidence; audit sequence complete and verified | pass |
| 24 | A trillion litres | route no_order; audit sequence complete and verified | pass |
| 25 | The brief's own sentence | route auto; order 1000 x 464306; concept milk [lactose_free]; >= 1000 l by the eval's own pack sizes; delivery on time for 2026-11-16; audit sequence complete and verified | pass |
| 26 | Short stock, alternative as asked | route auto; order 200 x 464401; concept milk [lactose_free]; >= 200 l by the eval's own pack sizes; delivery on time for 2026-11-16; audit sequence complete and verified | pass |
| 27 | Alternative lacks a stated attribute | route approval; order 200 x 464401; concept milk [lactose_free]; >= 200 l by the eval's own pack sizes; delivery on time for 2026-11-16; flags match.confidence; audit sequence complete and verified | pass |
| 28 | Hold in a later clause | route approval; order 200 x 464306; concept milk [lactose_free]; >= 200 l by the eval's own pack sizes; delivery on time for 2026-11-16; flags match.confidence; agent waiting; audit sequence complete and verified | pass |
| 29 | Dairy-free purpose | route blocked or no_order; order 200 x 469477; >= 200 l by the eval's own pack sizes; flags match.confidence; audit sequence complete and verified | pass |
| 30 | Zero budget | route approval; order 200 x 464306; concept milk [lactose_free]; >= 200 l by the eval's own pack sizes; delivery on time for 2026-11-16; flags match.confidence; audit sequence complete and verified | pass |
| M1 | Need -> recipe -> order | nut-free three-course menu ordered as one basket; most lines green; nothing with nuts; audit verifies | pass |
| M2 | Last-minute event, recipe-role swap | tomorrow's gaps flagged; a role swap from stock with its reason in short sentences | pass |
| M3 | Allergen-safe school menu | no product with sesame, peanut, nuts or egg, traces included; mandate and egg fits hold | pass |
| W1 | Nordic Harbour's weekly order | 17 green, 2 orange, 1 red; 1,000 litres of lactose-free milk ordered; butter drift; lactose-free UHT skimmed milk substitute_needs_ok; Alpro almond drink allergen; every line its own order; audit verified | pass |
| W2 | Kaisla's weekly order | 14 green, 1 orange, 1 red; lactose-free milk for school lunches over_limit; ciabatta rolls allergen; every line its own order; audit verified | pass |
| W3 | Ravintola Laine's weekly order | 11 green, 1 orange, 0 red; lactose-free cooking cream ordered; espresso coffee beans new_product; every line its own order; audit verified | pass |
| W4 | The sheet's sentence inside a basket | the sentence as one line among others: green, 1,000 l of lactose-free milk; audit verified | pass |

### Guardrails (`guardrails`)

| Id | Case | Expected | Result |
|---|---|---|---|
| G1 | Price edited in the offer | blocked by offer.signature, refused as an invalid signature | pass |
| G2 | Quantity edited in the offer | blocked by offer.signature | pass |
| G3 | Expired offer | blocked by offer.expiry | pass |
| G4 | Offer signed by the wrong key | blocked by offer.signature | pass |
| G5 | Raised limit, old mandate signature | 3,000 l order blocked by mandate.signature | pass |
| G6 | Mandate signed by the agent's own key | blocked by mandate.signature, own kid and spoofed buyer kid | pass |
| G7 | Mandate in force has expired | blocked by mandate.validity | pass |
| G8 | Buyer-signed mandate for another agent, not the one in force | refused by mandate.signature as not in force here | pass |
| G42 | Product on the buyer's never-buy list | blocked by product.never_buy; dropping the list from the signed mandate is blocked by mandate.signature | pass |
| G9 | Replay a confirmed offer, new keys | one offer gives one order; every replay is blocked | pass |
| G19 | Two simultaneous orders over the week | one confirms, one waits | pass |
| G20 | Six simultaneous orders over the week | only what fits confirms, the rest wait | pass |
| G10 | Approval from the agent channel | 403 for the agent token (also with a real approver cookie); no MCP tool approves | pass |
| G11 | Approval with a forged console header | 401 credential_required | pass |
| G12 | Approval with a made-up cookie | 401 credential_required | pass |
| G13 | Approval JWS from the audit log as cookie | 401 credential_required | pass |
| G14 | Prompt injection in the intent | 3,000 l still waits for approval; the agent does not confirm | pass |
| G15 | Negative and zero quantities | 400 for both quotes; an edited offer with -5 is blocked | pass |
| G16 | One billion litres | 422 quantity_implausible; no offer is signed | pass |
| G16b | One trillion litres on untracked stock | 422 quantity_implausible; never signed as available | pass |
| G16c | A large order on untracked stock | 6,000 l signed as untracked and sent to a person by delivery.partial | pass |
| G16d | Yesterday's delivery date | 422 delivery_date_past | pass |
| G17 | Order for an unknown offer | 4xx for garbage; blocked for an offer nobody issued; 404 on lookup | pass |
| G18 | SQL-like and script strings | no 5xx; refused or recorded as data; nothing confirmed | pass |
| G21 | Another buyer's offer by id | 404 for another buyer's token, as for a missing offer; 200 for the own buyer's token | pass |
| G22 | Approval after the mandate changed | the approver's approval of a waiting order is stopped once the mandate excludes milk; the order is blocked, not confirmed | pass |
| G23 | Tokenless caller takes demo access in the shared workspace | 403 demo_access_sandbox_only for approver and operator, 401 for the approval; the order still waits | pass |
| G24 | Sandbox key holder drops its token to approve its own order | 401, 403 or 404 on every route a person uses; the order still waits | pass |
| G25 | Suspended agent resumes itself | 403 agent_suspended with its token, 401 credential_required without; still suspended | pass |
| G26 | Another workspace's mandate, same id and version | refused by mandate.signature: not the mandate in force here | pass |
| G27 | An offer signed in another workspace | refused by offer.signature here; ordered once where it was issued | pass |
| G28 | An order without the buyer's words | 202: request.words sends it to the approver | pass |
| G29 | One product split over lines | 15,000 + 15,000 l refused 422; 2 x 3,000 l untracked waits like 6,000 l | pass |
| G30 | Three orders of 30 against 51 in stock | the first confirms; one quoted before it is refused at placement; the next quote shows 21 left | pass |
| G31 | Audit log known broken | 202: audit.integrity holds the order for a person | pass |
| G32 | Approval two hours after the offer was signed | the price hold until the cut-off keeps it approvable: 200 confirmed | pass |
| G40 | A basket's lines in parallel over the weekly limit | only what fits the week confirms; the rest waits by spend.per_week | pass |
| G41 | Resolve a basket line with an option it does not have | 400 for a foreign option, 403 for an agent key, 401 without any credential; the line still waits | pass |

### Trust (`trust`)

| Id | Case | Expected | Result |
|---|---|---|---|
| T1 | JWKS publishes public keys only | three roles, no private parts | pass |
| T2 | Offer signature | valid, supplier key | pass |
| T3 | Mandate signature | valid, buyer key | pass |
| T4 | Approval signature | valid, approver key, bound to the offer | pass |
| T5 | Receipt signatures | valid, supplier key, bound to offer and audit entry | pass |
| T6 | Every audit signature and the chain | all valid with the JWKS; checkpoint signed | pass |
| T7 | One byte changed in an offer | detected; ordering it is blocked | pass |
| T8 | One byte changed in a receipt | detected | pass |
| T9 | One byte changed in an audit entry | detected, names that entry | pass |
| T10 | Middle audit entry deleted | detected | pass |
| T11 | Audit entries reordered | detected | pass |
| T12 | Audit tail cut | detected against the remembered head | pass |
| T13 | Stored entry changed, service verify | the verify endpoint names the entry | pass |
| T14 | Origin or label changed in an offer | detected; ordering it is blocked by the signature check | pass |
| T15 | Earlier entry rewritten in a longer log | detected against the remembered head, whatever the new length | pass |
| T16 | Audit tail cut, then extended | detected against the remembered head | pass |
| T17 | Another buyer's agent verifies the whole chain | the hotel's entries arrive as stubs without content; the chain verifies end to end; a changed stub is detected | pass |

### Openness (`openness`)

| Id | Case | Expected | Result |
|---|---|---|---|
| O1 | OpenAPI 3.1 document | openapi 3.1.0, info, servers, every operation has responses and declares its path parameters | pass |
| O2 | Every operation has an operationId | unique operationId on every operation | pass |
| O3 | Every $ref resolves | no dangling $ref | pass |
| O4 | Every registered path answers | documented success status for a well-formed call | pass |
| O5 | MCP tools/list | every tool has input and output schemas | pass |
| O6 | Each MCP tool is callable | structuredContent validates against the outputSchema | pass |
| O7 | Discovery documents | 200 with the right content type | pass |
| O8 | Outside agent from llms.txt only | over HTTP, the REST flow in llms.txt searches, quotes and orders the milk; order confirmed | pass |
<!-- END:evidence:cases -->
