import { endpoints, SERVICE_NAME } from "./documents";

/** Plain-text guide for agents. Enough on its own to search, quote and order with curl. */
export function llmsText(origin: string): string {
  const urls = endpoints(origin);
  const auth = `-H "Authorization: Bearer demo-agent-token" -H "Content-Type: application/json"`;
  return `# ${SERVICE_NAME}

> A front door that lets a buyer's purchasing agent buy from the food-service wholesaler Valio Aimo.
> Prices and stock are live. Offers are signed by the wholesaler. Orders are simulated (simulated: true).

Base URL: ${urls.rest}
OpenAPI 3.1: ${urls.openapi}
Public keys (JWKS): ${urls.jwks}

## Connect by MCP
Streamable HTTP, stateless, JSON responses: ${urls.mcp}
Header: Authorization: Bearer demo-agent-token (without it you act as an unidentified agent and orders are blocked).
Clients that cannot send a header may put the demo key in the address: ${urls.mcp}?key=demo-agent-token
Two more demo buyers have their own token and mandate: demo-kaisla-token (Kaisla School Kitchens) and demo-laine-token (Ravintola Laine).
Over REST, X-Agent-Client names your application (for example "Claude Code") in the wholesaler's view.
Tools: search_catalog, get_product, request_quote, get_mandate, place_order, get_order, verify_audit.

## REST flow: "1,000 litres of lactose-free milk by Monday"
1. Search. Read interpretation.confidence. Hits carry offerPreview when the wholesaler has a price: indicative live price, stock, delivery date,
order cut-off and orderable. Pass need and deliverBy to get pack maths (unitsNeeded, estimatedNet). Only a signed offer fixes the price.
When the match is clear (confidence high), hits are sorted best buy first: orderable on time, then lowest price per litre or kilo.
Every hit has facts the wholesaler vouches for: countryOfOrigin, labels, deliveryReliability (0 to 1) and categoryAverageCo2PerKg
(the average of the product's category, not a measurement of the product). To rank a clear match by something other than price,
send "prefer": "reliability" or "prefer": "sustainability" (certified labels such as organic or msc first, then lower category CO2).
An uncertain match keeps its relevance order. Choose the first hit with offerPreview.orderable true.
curl -s ${urls.rest}/products/search ${auth} -d '{"query":"laktoositon maito 1 l","filters":{"claims":["lactose_free"]},"limit":5,"need":{"amount":1000,"unit":"l"},"deliverBy":"2026-11-16"}'

2. Quote for the product you chose. Quantities in l or kg are converted to whole sales units. The response has primary (the offer
for what you asked) and alternatives (signed counter-offers when the request cannot be met in full and on time). primary has offer and jws. Each alternative has tier, meaning, tradeoff and signed, and signed has offer and jws.
Tiers: good is the cheapest like-for-like product, better keeps what is in stock and fills the rest or takes the most reliable product,
best is an organic or Finnish-label product. Every offer line carries the same facts as search, inside the signed offer.
The offer is valid for 15 minutes (offer.expiresAt). Keep the jws of the one you take exactly as returned.
curl -s ${urls.rest}/quotes ${auth} -d '{"lines":[{"productId":"464306","quantity":{"amount":1000,"unit":"l"}}],"deliverBy":"2026-11-16","intent":"1,000 litres of lactose-free milk by Monday","matchConfidence":"high"}'

3. Read your mandate. The response has mandate (readable limits) and jws. Keep jws.
curl -s ${urls.rest}/mandate ${auth}

4. Order. Send the offer jws and the mandate jws unchanged, and a key you choose.
curl -s ${urls.rest}/orders ${auth} -H "Idempotency-Key: milk-2026-11-16-001" -d '{"offerJws":"<primary.jws from step 2>","mandateJws":"<jws from step 3>"}'
With jq: OFFER=$(curl -s ... /quotes ... | jq -r .primary.jws); MANDATE=$(curl -s ... /mandate | jq -r .jws)

## Mandate rules
- Up to the per-order and per-week net limits the agent may order alone; above them a human must approve.
- Only allowed category groups; excluded allergens and required claims are hard rules.
- Substitutes must follow the substitution policy and the price limit.
- Late or partial delivery is checked against the requested date.
- An expired offer, a passed order cut-off or an altered offer or mandate blocks the order.

## Order outcomes
- confirmed: receiptJws holds the wholesaler-signed receipt.
- pending_approval: stop and tell your human. Do not retry with another key. Poll GET ${urls.rest}/orders/{id}.
- blocked: nothing was ordered; decision.checks says why.
The wholesaler can suspend an agent. While it is suspended every call answers 403 with the code agent_suspended; tell your human.
Retrying with the same Idempotency-Key returns the same order.
One signed offer gives one order. For another order, ask for a new quote. Always send the current mandate.

## Proof
GET ${urls.rest}/audit/verify checks the hash chain and every signature. GET ${urls.rest}/audit/checkpoint returns a signed head.
Errors are application/problem+json with a code and a plain detail.
`;
}
