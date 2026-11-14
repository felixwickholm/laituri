# 5. Exceptions as signed counter-offers

- Status: accepted
- Code: [`src/lib/offers/alternatives.ts`](../../src/lib/offers/alternatives.ts), [`src/lib/offers/substitutes.ts`](../../src/lib/offers/substitutes.ts), [`src/lib/policy/rules/fulfilment.ts`](../../src/lib/policy/rules/fulfilment.ts)

## Context and problem statement

When the exact request cannot be met (short stock, a passed cut-off, late delivery), the agent needs options it can act on and the buyer needs to know which ones it may take alone. A free-text suggestion cannot be ordered or checked.

## Considered options

1. Return an error and let the agent search again.
2. Substitute silently.
3. Return the honest primary offer plus a ranked list of alternatives, each a signed offer with a tier, the tier's meaning and the trade-off.

## Decision outcome

Option 3. Tiers follow the brief's "good-better-best": good is the cheapest like-for-like product that covers the need on time; better keeps what is in stock and fills the rest, or takes the most reliable product; best is an organic or Finnish-label product. A tier is skipped when no valid candidate exists. The mandate's substitution policy, price cap and delivery rules decide whether the agent may take one alone.

## Consequences

- Good: the agent orders an alternative exactly like an offer; the same checks apply.
- Good: the trade-off sentence is shown to the person who approves.
- Bad: candidates are like for like within the wholesaler's concept and category, not recipe-aware.

## Confirmation

Evals 5 (short stock, split), 6 (cut-off passed), 13 (late delivery). Tests in [`tests/offers/quote.test.ts`](../../tests/offers/quote.test.ts).
