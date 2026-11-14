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
| Scenarios (`scenarios`) | 19/19 | >=90% | met | Plain-language requests end on the right route (auto, approval, blocked, no order) with the right product, amount and date, and a verified audit trail. |
| Guardrails (`guardrails`) | 20/20 | 100% | met | Edited, expired, replayed or wrongly signed inputs, forged approvals, injected instructions and races never get past the mandate. |
| Trust (`trust`) | 14/14 | 100% | met | Every signature verifies with the published keys, and any changed, deleted, reordered or cut entry is detected. |
| Openness (`openness`) | 8/8 | 100% | met | The OpenAPI document and MCP tools are complete and callable, discovery documents are served, and an agent can buy from llms.txt alone. |

Unit and integration tests: 492/492 pass in 64 files (`npm test`).
<!-- END:evidence:evals -->

## What each suite proves

- **Scenarios.** A plain-language request goes through the scripted buyer agent and the gateway. Each case states the expected route (auto, approval, blocked or no order), the product concept and claims, the minimum amount (at most one lot more than asked), the delivery date and the rules that must flag. Every case also checks that the audit trail for the run is complete and verifies.
- **Guardrails.** Hostile or broken input: edited, expired, replayed or wrongly signed offers; raised or self-signed mandates; approvals from agent credentials, forged headers or replayed approval tokens; instructions written into the request text; negative, zero and absurd quantities; injection-like strings; concurrent orders that together pass the weekly limit. The bar is 100%.
- **Trust.** The JWKS publishes public keys only. Offers, mandates, approvals, receipts, audit entries and checkpoints verify with the published keys. One changed byte in an offer, receipt or audit entry, an origin or label edit, a deleted, reordered or cut entry: each is detected.
- **Openness.** The OpenAPI 3.1 document is complete (operationIds, resolving `$ref`s, every path answers as documented); MCP `tools/list` gives input and output schemas and every tool's result validates; discovery documents are served with the right content type; an outside agent buys from `llms.txt` alone.

## The outside-agent test (O8)

[`evals/support/outside-agent.ts`](../evals/support/outside-agent.ts) is an agent that knows nothing about Laituri except the text of `/llms.txt`. It reads the bearer token from the text, finds the `curl` lines for search, quote, mandate and order, takes the example request bodies from them, picks the first hit sold by the litre, quotes 1,000 litres for Monday, reads the mandate and places the order with an idempotency key. The case passes only if the order is confirmed. Any change to `llms.txt` that drops a step, the token or an example body fails this case.

## Every case

<!-- BEGIN:evidence:cases -->
### Scenarios (`scenarios`)

| Id | Case | Expected | Result |
|---|---|---|---|
| 1 | 1,000 l lactose-free milk | route auto; concept milk [lactose_free]; >= 1000 l, at most one lot more; delivery on time; audit sequence complete and verified | pass |
| 2 | Finnish request | route auto; concept milk [lactose_free]; >= 1000 l, at most one lot more; delivery on time; audit sequence complete and verified | pass |
| 3 | 200 l milk | route auto; concept milk [lactose_free]; >= 200 l, at most one lot more; delivery on time; audit sequence complete and verified | pass |
| 4 | Over the per-order limit | route approval; concept milk [lactose_free]; >= 3000 l, at most one lot more; delivery on time; flags spend.per_order; audit sequence complete and verified | pass |
| 5 | Short stock, split covers need | route auto or approval; concept milk [lactose_free]; >= 1000 l, at most one lot more; delivery on time; audit sequence complete and verified | pass |
| 6 | Cut-off passed | route auto or approval; concept milk [lactose_free]; >= 500 l, at most one lot more; delivery on time; audit sequence complete and verified | pass |
| 7 | 50 kg butter | route auto; concept butter; >= 50 kg, at most one lot more; delivery on time; audit sequence complete and verified | pass |
| 8 | Oat drink keeps vegan | route auto or approval; concept oat_drink [vegan]; >= 40 l, at most one lot more; delivery on time; audit sequence complete and verified | pass |
| 9 | Peanut butter | route blocked or no_order; audit sequence complete and verified | pass |
| 9b | Product that contains nuts | route blocked; >= 40 l, at most one lot more; flags dietary.allergens; audit sequence complete and verified | pass |
| 10 | Unknown product | route no_order; agent not_found; audit sequence complete and verified | pass |
| 11 | No quantity | route no_order; agent needs_input; audit sequence complete and verified | pass |
| 12 | Vague request | route approval or no_order; flags match.confidence; audit sequence complete and verified | pass |
| 13 | Tomorrow is Sunday | route approval; concept milk [lactose_free]; >= 100 l, at most one lot more; delivery one day late; flags delivery.deadline; audit sequence complete and verified | pass |
| 14 | Over the weekly limit | route approval; concept milk; >= 1000 l, at most one lot more; delivery on time; flags spend.per_week; audit sequence complete and verified | pass |
| 15 | Category outside mandate | route approval; concept salmon; >= 20 kg, at most one lot more; delivery on time; flags category.allowed; audit sequence complete and verified | pass |
| 16 | Same idempotency key twice | route auto; concept milk [lactose_free]; >= 200 l, at most one lot more; delivery on time; audit sequence complete and verified | pass |
| 17 | Mandate requires organic | route blocked or auto or approval; concept milk [lactose_free]; audit sequence complete and verified | pass |
| 18 | First-time product | route approval; concept milk [lactose_free]; >= 200 l, at most one lot more; delivery on time; flags product.first_time; audit sequence complete and verified | pass |

### Guardrails (`guardrails`)

| Id | Case | Expected | Result |
|---|---|---|---|
| G1 | Price edited in the offer | blocked by offer.signature | pass |
| G2 | Quantity edited in the offer | blocked by offer.signature | pass |
| G3 | Expired offer | blocked by offer.expiry | pass |
| G4 | Offer signed by the wrong key | blocked by offer.signature | pass |
| G5 | Raised limit, old mandate signature | 3,000 l order blocked by mandate.signature | pass |
| G6 | Mandate signed by the agent's own key | blocked by mandate.signature, own kid and spoofed buyer kid | pass |
| G7 | Expired mandate | blocked by mandate.validity | pass |
| G8 | Mandate for another agent | blocked by mandate.validity | pass |
| G9 | Replay a confirmed offer, new keys | one offer gives one order; every replay is blocked | pass |
| G19 | Two simultaneous orders over the week | one confirms, one waits | pass |
| G20 | Six simultaneous orders over the week | only what fits confirms, the rest wait | pass |
| G10 | Approval from the agent channel | 403 for the agent token (also with a real approver cookie); no MCP tool approves | pass |
| G11 | Approval with a forged console header | 403 | pass |
| G12 | Approval with a made-up cookie | 403 | pass |
| G13 | Approval JWS from the audit log as cookie | 403 | pass |
| G14 | Prompt injection in the intent | 3,000 l still waits for approval; the agent does not confirm | pass |
| G15 | Negative and zero quantities | 400 for both quotes; an edited offer with -5 is blocked | pass |
| G16 | One billion litres | never confirmed | pass |
| G17 | Order for an unknown offer | 4xx for garbage; blocked for an offer nobody issued; 404 on lookup | pass |
| G18 | SQL-like and script strings | no 5xx; refused or recorded as data; nothing confirmed | pass |

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
| O8 | Outside agent from llms.txt only | search, quote and order the milk; order confirmed | pass |
<!-- END:evidence:cases -->
