# 2. A buyer-signed mandate presented by the agent

- Status: accepted
- Code: [`src/lib/mandate`](../../src/lib/mandate), [`src/lib/policy`](../../src/lib/policy), [`src/lib/orders/place.ts`](../../src/lib/orders/place.ts)

## Context and problem statement

The wholesaler must know what an agent may do alone. The limits belong to the buyer: they say how much a kitchen trusts its own agent. If they were only a setting at the wholesaler, the buyer could not prove what it allowed, and the agent could not show its authority to anyone else.

## Considered options

1. Limits stored at the wholesaler per customer.
2. Limits inside the agent's prompt or configuration.
3. A mandate signed with the buyer's key, which the agent presents with every order.

## Decision outcome

Option 3. The mandate is a JWT shaped like an AP2 open checkout mandate (`vct`, `constraints[]`, `exp`), signed with the buyer key. The agent fetches it and sends it unchanged with each order. The order module verifies the buyer signature, checks that the mandate is the version in force and names this agent, then runs every rule against it.

## Consequences

- Good: the agent cannot raise its own limit; a changed mandate needs a new buyer signature.
- Good: the same signed document is evidence for the buyer, the wholesaler and an auditor.
- Good: the wholesaler's overview counts which rule fired, not the limits behind it.
- Bad: in the demo one server holds the buyer key. In production the buyer signs in its own system.
- Neutral: the production path also keeps a copy in the customer master, so both sides hold the same signed terms.

## Confirmation

Evals G5 to G8 (raised limit with the old signature, mandate signed by the agent's key, expired mandate, mandate for another agent). Eval T3 (mandate signature). `npm run eval -- --suite guardrails`.
