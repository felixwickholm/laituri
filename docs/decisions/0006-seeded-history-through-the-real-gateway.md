# 6. Seeded history through the real gateway

- Status: accepted
- Code: [`src/lib/seed`](../../src/lib/seed), [`src/lib/provenance.ts`](../../src/lib/provenance.ts), [`src/instrumentation.ts`](../../src/instrumentation.ts)

## Context and problem statement

A wholesaler's overview with no traffic shows nothing, and a judge has minutes. Inserting fake rows would show screens the real code never produced, and the log would not verify.

## Considered options

1. Fixture rows written straight into the store.
2. An empty start; the visitor generates all traffic.
3. A plan of requests by the demo buyers, played through the real gateway at past times.

## Decision outcome

Option 3. On an empty state the server plays the plan in [`src/lib/seed/plan.ts`](../../src/lib/seed/plan.ts): searches, quotes, orders and approver decisions, with a moved clock and recorded upstream answers. Every offer, order, approval and audit entry is signed and chained as in live use and marked `seeded`. `LAITURI_SEED=off` keeps a fresh start empty; tests and evals turn it off.

## Consequences

- Good: everything on screen was produced by the same code an outside agent hits, and the log verifies.
- Good: the wholesaler's agents, demand and unmet requests have content from the first visit.
- Bad: seeded records are synthetic history; the screens and the API mark them so.

## Confirmation

[`tests/seed/seed.test.ts`](../../tests/seed/seed.test.ts), [`tests/audit/seeded.test.ts`](../../tests/audit/seeded.test.ts).
