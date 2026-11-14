# 3. Signed fixed-price offers, single use, with expiry

- Status: accepted
- Code: [`src/lib/offers/assemble.ts`](../../src/lib/offers/assemble.ts), [`src/lib/orders/place.ts`](../../src/lib/orders/place.ts), [`src/lib/policy/rules/trust.ts`](../../src/lib/policy/rules/trust.ts)

## Context and problem statement

The brief asks for ordering "based on fixed prices rather than a negotiated quote". An agent needs to trust price, stock and date without a manual check, and the wholesaler must not be bound by a stale or edited price.

## Considered options

1. The agent orders by product code and quantity; the price is whatever it is at order time.
2. A quote id the server looks up.
3. An offer the wholesaler signs, valid for a short time, ordered by presenting it unchanged.

## Decision outcome

Option 3. Each offer is a compact JWS signed with the supplier key (ES256). It holds the fixed net price, availability, delivery date, cut-off, product facts, the buyer it is for and `expiresAt` (15 minutes). An order must carry the offer bytes unchanged; one offer gives one order. The offer also names the workspace that issued it inside the signature, and only that workspace accepts it. When an order waits for a person, the wholesaler signs a separate statement that holds the price until the order cut-off for the delivery date, never beyond it.

## Consequences

- Good: the agent can verify price and stock offline with the published keys; any edit breaks the signature.
- Good: the wholesaler's exposure is bounded by the expiry and single use.
- Good: alternatives are offers too, so a counter-offer is as binding as the original.
- Bad: an order waiting for approval can outlive its offer; it is then rejected and the reason logged. Seeded week-ahead requests hold the price until that date's cut-off and say so in the signed expiry.

## Confirmation

Evals G1 to G4 and G9 (edited price or quantity, expired offer, wrong key, replay), T2 and T7. `npm run eval -- --suite guardrails`.
