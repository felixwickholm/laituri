import { endpoints } from "./documents";

/**
 * /llms.txt in the llmstxt.org shape: H1 name, a blockquote summary, detail without headings, then H2 link lists.
 * The detail alone is enough to search, quote and order with curl (eval O8 buys from this text and nothing else).
 */
export function llmsText(origin: string): string {
  const urls = endpoints(origin);
  const auth = `-H "Authorization: Bearer $KEY" -H "Content-Type: application/json"`;
  return `# Laituri: agent ordering for Valio Aimo (demo)

> An open front door that lets a buyer's purchasing agent buy from the food-service wholesaler Valio Aimo over MCP or REST.
> Prices and stock are live from the challenge's mock API. Offers are signed by the wholesaler. Orders are simulated (simulated: true).
> The agent orders alone only inside a buyer-signed mandate; larger or unusual orders wait for a named person. Every step is in a signed, hash-chained log.

Read first: the paper at ${origin}/paper explains the design, maps each judging criterion to code, checks and measured results,
and lists every limit. The whole picture in one fetch, as plain text: ${origin}/llms-full.txt.

Base URL: ${urls.rest}
OpenAPI 3.1: ${urls.openapi}
Public keys (JWKS): ${urls.jwks}

**Start here: create your own sandbox.** POST ${urls.rest}/workspace with no credential makes a private copy of the demo
and answers 201 with agentKeys: one key per demo buyer (Nordic Harbour Hotels first, then Kaisla School Kitchens and Ravintola Laine), each with its MCP address.
No account, no cookie: the keys are the only way in, they work only in that sandbox, and an unused sandbox is dropped after an hour.
Reading orders, offers, the mandate, approvals, activity or the audit log needs a key; without one the answer is 401 credential_required.
An agent key reads its own buyer's records; in the audit log it sees its buyer's entries in full and every other entry as a stub that still verifies.

**Connect by MCP.** Streamable HTTP, stateless, JSON responses: ${urls.mcp}
Header: Authorization: Bearer <key from your sandbox>. Clients that cannot send a header use the mcpUrl the sandbox returned (${urls.mcp}?key=...).
The shared demo workspace has fixed public tokens, used by the evals: demo-agent-token, demo-kaisla-token and demo-laine-token.
Everyone shares it, so its weekly spend grows as people test and nobody can approve there without the passcode: use your own sandbox.
Over REST, X-Agent-Client names your application (for example "Claude Code") in the wholesaler's view.
Tools: search_catalog, get_product, request_quote, get_mandate, place_order, place_basket, get_order, verify_audit, plan_menu, list_recipes, plan_event.

**REST flow: "1,000 litres of lactose-free milk by Monday".**

1. Create your sandbox and keep the first agent key (Nordic Harbour Hotels).
KEY=$(curl -s -X POST ${urls.rest}/workspace | jq -r '.agentKeys[0].key')

2. Search. Read interpretation.confidence. Hits carry offerPreview when the wholesaler has a price: indicative live price, stock, delivery date,
order cut-off and orderable. Pass need and deliverBy to get pack maths (unitsNeeded, estimatedNet). Only a signed offer fixes the price.
When the match is clear (confidence high), hits are sorted best buy first: orderable on time, then lowest price per litre or kilo.
Every hit has facts the wholesaler vouches for: countryOfOrigin, labels, deliveryReliability (0 to 1) and categoryAverageCo2PerKg
(the average of the product's category, not a measurement of the product). To rank a clear match by something other than price,
send "prefer": "reliability" or "prefer": "sustainability" (certified labels such as organic or msc first, then lower category CO2).
An uncertain match keeps its relevance order. Choose the first hit with offerPreview.orderable true.
curl -s ${urls.rest}/products/search ${auth} -d '{"query":"laktoositon maito 1 l","filters":{"claims":["lactose_free"]},"limit":5,"need":{"amount":1000,"unit":"l"},"deliverBy":"2026-11-16"}'

3. Quote for the product you chose, and send the buyer's own words as intent: the wholesaler checks the offer against them and signs that check.
Without intent the buyer's mandate sends the order to a person. Quantities in l or kg are converted to whole sales units. The response has primary (the offer
for what you asked) and alternatives (signed counter-offers when the request cannot be met in full and on time). primary has offer and jws. Each alternative has tier, meaning, tradeoff and signed, and signed has offer and jws.
Tiers: good is the cheapest like-for-like product, better keeps what is in stock and fills the rest or takes the most reliable product,
best is an organic or Finnish-label product. Every offer line carries the same facts as search, inside the signed offer.
The offer is valid for 15 minutes (offer.expiresAt). Keep the jws of the one you take exactly as returned.
curl -s ${urls.rest}/quotes ${auth} -d '{"lines":[{"productId":"464306","quantity":{"amount":1000,"unit":"l"}}],"deliverBy":"2026-11-16","intent":"1,000 litres of lactose-free milk by Monday","matchConfidence":"high"}'

4. Read your mandate. The response has mandate (readable limits) and jws. Keep jws.
curl -s ${urls.rest}/mandate ${auth}

5. Order. Send the offer jws and the mandate jws unchanged, and a key you choose.
curl -s ${urls.rest}/orders ${auth} -H "Idempotency-Key: milk-2026-11-16-001" -d '{"offerJws":"<primary.jws from step 3>","mandateJws":"<jws from step 4>"}'
With jq: OFFER=$(curl -s ... /quotes ... | jq -r .primary.jws); MANDATE=$(curl -s ... /mandate | jq -r .jws)

**Many lines at once: a weekly order.** POST ${urls.rest}/baskets with deliverBy and lines of words and quantities (unit l, kg or pcs),
or the MCP tool place_basket. Each line becomes its own signed offer and its own order under the mandate, four at a time.
The answer is 202 with basketId; GET ${urls.rest}/baskets/{basketId} shows each line green (ordered alone), orange (waits for a person) or red (not ordered), with a plain reason.
Orange and red lines are for your human; do not order them another way.
curl -s ${urls.rest}/baskets ${auth} -d '{"deliverBy":"2026-11-16","lines":[{"words":"lactose-free milk","quantity":{"amount":1000,"unit":"l"}},{"words":"eggs","quantity":{"amount":36,"unit":"kg"}}]}'

**Need -> recipe -> order: an event.** POST ${urls.rest}/menus/plan with the event in words (English or Finnish) or as guests, date and dietary,
or the MCP tool plan_menu. The answer says back what it understood and gives three menus (good, better, best by cost per guest) from the recipe library
(GET ${urls.rest}/recipes), fitted to your mandate and the guests' needs. A rule-breaking ingredient is swapped by its role in the recipe and the swap is stated.
Each menu has a shopping list net of the kitchen's stock (GET ${urls.rest}/pantry): words, quantity, toOrder, product, estNet and availability for the delivery date.
Prices are indicative; nothing is signed until you order. To order a menu, post its lines with toOrder above zero as a basket, using swap.words when a swap is set.
curl -s ${urls.rest}/menus/plan ${auth} -d '{"words":"Wedding dinner for 80 on Friday, two guests are coeliac, no nuts"}'
curl -s ${urls.rest}/baskets ${auth} -d '{"source":"menu","menuId":"<menus[i].id>","title":"Wedding dinner","deliverBy":"<the day before>","lines":[{"words":"salmon fillet","quantity":{"amount":13.5,"unit":"kg"}}]}'
Without a guest count the answer has needs ["guests"] and a question to ask; menus is then empty.
For a conversation instead, POST ${urls.rest}/assistant/turn {"words": ...} or the MCP tool plan_event, passing conversationId back each turn: a short reply, asks, menu cards and a ready order_menu basket.
When the guest count changes, plan again with "previous":{"menuId":"<menus[i].id>","guests":80}: each menu then lists what changes.

**Mandate rules.**

- Up to the per-order and per-week net limits the agent may order alone; above them a human must approve.
- Only allowed category groups; excluded allergens and required claims are hard rules.
- Substitutes must follow the substitution policy and the price limit.
- Late or partial delivery is checked against the requested date.
- An expired offer, a passed order cut-off or an altered offer or mandate blocks the order.

**Order outcomes.**

- 201 confirmed: receiptJws holds the wholesaler-signed receipt.
- 202 pending_approval: stop and tell your human. Do not retry with another key. Poll GET ${urls.rest}/orders/{id}.
- 422 order_blocked: nothing was ordered. The problem body carries the order; order.decision.checks says why.

The wholesaler can suspend an agent. While it is suspended every call answers 403 with the code agent_suspended; tell your human.
Retrying with the same Idempotency-Key returns the same order.
One signed offer gives one order. For another order, ask for a new quote. Always send the current mandate.

**Proof.** GET ${urls.rest}/audit/verify checks the hash chain and every signature. GET ${urls.rest}/audit/checkpoint returns a signed head.
To trust an offer without a manual check: verify its JWS (ES256) with the supplier key from the JWKS, check expiresAt and orderBy are in the future, and send it unchanged.
Errors are application/problem+json with a code and a plain detail.

## Docs

- [Paper](${origin}/paper): the design, each judging criterion with how to verify it, the example scenarios, the threat table and what is simulated
- [Everything in one file](${origin}/llms-full.txt): the paper and this guide as plain text
- [Evidence](${origin}/evidence): the five judging criteria with what was built, where in the code, how to check it and measured results
- [Connect an agent](${origin}/connect): set-up lines for MCP clients and plain HTTP, and a test order

## API

- [OpenAPI 3.1](${urls.openapi}): every REST operation with schemas and examples
- [MCP endpoint](${urls.mcp}): Streamable HTTP; the tools mirror the REST operations
- [JWKS](${urls.jwks}): public keys of the supplier, buyer and approver roles
- [Agent card](${origin}/.well-known/agent-card.json): interfaces, tools and security schemes
- [AI catalog](${origin}/.well-known/ai-catalog.json): the service in a catalogue listing
- [UCP profile](${origin}/.well-known/ucp): commerce capabilities in Universal Commerce Protocol terms
- [OAuth protected-resource metadata](${origin}/.well-known/oauth-protected-resource): the scopes a production deployment would grant

## Evidence

- [Evidence as JSON](${origin}/evidence.json): criteria, requirements, scenario coverage, assumptions and measured numbers
- [Audit verification](${urls.rest}/audit/verify): live check of the hash chain and every signature
- [Audit checkpoint](${urls.rest}/audit/checkpoint): a supplier-signed size and head hash to keep and compare

## Optional

- [Guided walkthrough](${origin}/buyer?tour=1): the order, approval, exception and log steps in the running product
- [Buyer side](${origin}/buyer): orders, mandate and log for the buyer's purchasing lead
- [Valio Aimo side](${origin}/valio): connected agents, demand, unmet requests and the audit log
`;
}
