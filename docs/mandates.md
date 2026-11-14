# Mandates: allowed, ask, never

A buyer signs a mandate with its own key. The mandate says what the buyer's agent may order alone, what waits for a named person and what is never allowed. The agent presents the mandate with every order, and the wholesaler checks the order against every rule. The rule ids are in [`src/lib/contracts/policy.ts`](../src/lib/contracts/policy.ts); the rules are in [`src/lib/policy/rules`](../src/lib/policy/rules).

## The three tiers

| Rule | Ask a person | Never |
|---|---|---|
| Spend per order, per week | Over the limit | |
| Category | Outside the allowed list | |
| Allergens, required claims | Food with no allergen declaration | Excluded allergen (also as a trace when the mandate says so), missing allergen data, missing required claim |
| Substitution | Not like for like, or price up more than the cap | Any substitute, another brand included, when the policy says none |
| Partial delivery, late delivery | Partial not allowed; late within the grace days | Later than the grace days |
| Request match | Low confidence; a requirement in the buyer's words not met or not checkable for the product delivered (an attribute such as UHT or a fat level, a budget, a date, an instruction to hold, words not understood) | The offer certainly fails the words: wrong product, a missing claim, less than half the need asked for |
| Buyer's words (request.words) | The offer carries no buyer words, so it could not be checked against them | |
| First-time product | First order of a product when the mandate asks for it | |
| Audit log (audit.integrity) | The workspace's audit log does not verify; no order confirms alone until it does | |
| Signatures, validity, expiry | | Invalid, replaced or expired mandate, or one from another workspace; altered, expired or already used offer, or one another workspace issued; wrong agent; cut-off passed |

The buyer's words decide brand changes too. When the words name a brand and another brand would be delivered, the request check marks it substituted. Under `like_for_like` the substitute of the same kind is allowed and the check names it; under `none` the order is blocked.

## The three demo mandates

They differ in kind ([`src/lib/mandate/defaults.ts`](../src/lib/mandate/defaults.ts)):

- **Nordic Harbour Hotels** has the largest limits and takes like-for-like substitutes up to 10 % dearer.
- **Kaisla School Kitchens** excludes peanut, nuts and sesame even as traces and accepts no late delivery.
- **Ravintola Laine** takes no substitutes, and its owner approves every first-time product.

All three require the buyer's words with every order (request.words).

An agent cannot raise its own limit, change a price or approve its own order. Each attempt is refused and written to the audit log.
