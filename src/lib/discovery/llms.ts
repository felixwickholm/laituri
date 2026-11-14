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
Tools: search_catalog, get_product, request_quote, get_mandate, place_order, get_order, verify_audit.

## REST flow: "1,000 litres of lactose-free milk by Monday"
1. Search. Read interpretation.confidence and each hit's content per sales unit.
curl -s ${urls.rest}/products/search ${auth} -d '{"query":"laktoositon maito 1 l","filters":{"claims":["lactose_free"]},"limit":5}'

2. Quote. Quantities in l or kg are converted to whole sales units. Keep primary.jws exactly as returned.
curl -s ${urls.rest}/quotes ${auth} -d '{"lines":[{"productId":"464306","quantity":{"amount":1000,"unit":"l"}}],"deliverBy":"2026-11-16","intent":"1,000 litres of lactose-free milk by Monday","matchConfidence":"high"}'

3. Read your mandate. Keep its jws.
curl -s ${urls.rest}/mandate ${auth}

4. Order. Send the offer JWS and mandate JWS unchanged and a key you choose.
curl -s ${urls.rest}/orders ${auth} -H "Idempotency-Key: milk-2026-11-16-001" -d '{"offerJws":"<primary.jws>","mandateJws":"<mandate jws>"}'

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
Retrying with the same Idempotency-Key returns the same order.

## Proof
GET ${urls.rest}/audit/verify checks the hash chain and every signature. GET ${urls.rest}/audit/checkpoint returns a signed head.
Errors are application/problem+json with a code and a plain detail.
`;
}
