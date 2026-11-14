# From demo to production

## Scope

The brief says that whether Valio Aimo's production interface becomes a traditional API, an MCP-style agentic interface or a service agent of its own is outside the challenge's scope. Laituri does not choose: the MCP tools, the REST routes and the OpenAPI document are generated from one set of zod schemas in [`src/lib/contracts`](../src/lib/contracts), behind one gateway ([`src/lib/gateway`](../src/lib/gateway)). A service agent of Valio Aimo's own would be one more client of the same gateway. What we mock is the order entry: the challenge's API has price and availability only, so Laituri writes the order and receipt itself ([decision 1](decisions/0001-mcp-and-rest-from-one-schema-set.md)).

## Steps

Generated from [`src/lib/evidence/scope.ts`](../src/lib/evidence/scope.ts) by `npm run evidence`.

<!-- BEGIN:evidence:production -->
1. **Real order entry.** Replace the simulated order with the ERP's order entry and return its order number in the signed receipt. Builds on [`src/lib/orders/confirm.ts`](../src/lib/orders/confirm.ts).
2. **OAuth 2.1 per agent.** Scoped tokens (catalog:read, quote:create, order:place) in place of demo tokens. The scopes are already declared in the OpenAPI document and the protected-resource metadata. Builds on [`src/lib/discovery/documents.ts`](../src/lib/discovery/documents.ts), [`src/lib/openapi/registry.ts`](../src/lib/openapi/registry.ts).
3. **Key custody per party.** The wholesaler runs Laituri with the supplier key only; the buyer signs mandates in its own system; the approver signs with a personal credential. Builds on [`src/lib/trust/keys.ts`](../src/lib/trust/keys.ts).
4. **Buyer identity.** A verifiable organisation credential (the planned EU Business Wallet) instead of a demo key.
5. **Mandate copy at the wholesaler.** Keep the signed mandate in the customer master as well, so both sides hold the same signed copy. Builds on [`src/lib/mandate/index.ts`](../src/lib/mandate/index.ts).
6. **Database.** Transactions and row locks in place of the single-process store. Builds on [`src/lib/store/types.ts`](../src/lib/store/types.ts).
7. **External audit anchor.** Anchor audit checkpoints in an external transparency service (SCITT), so completeness no longer depends on the verifier's memory. Builds on [`src/lib/audit/checkpoint.ts`](../src/lib/audit/checkpoint.ts).
8. **Peppol ordering.** Order and order-response documents for customers that already trade over Peppol; the response codes are already in the receipt. Builds on [`src/lib/orders/receipt.ts`](../src/lib/orders/receipt.ts).
<!-- END:evidence:production -->

## Standards used

"Used" means implemented and tested here. "Follows" means the names, shapes or codes are taken from the standard so a later full implementation does not change the interface.

| Area | Choice |
|---|---|
| Agent interface | Used: Model Context Protocol (Streamable HTTP) and REST described by OpenAPI 3.1 |
| Signatures | Used: JWS compact, ES256, keys published as JWKS (RFC 7515, 7517, 7638) |
| Mandate | Follows AP2 (Agent Payments Protocol): a signed JWT shaped like its Open Checkout Mandate (`vct`, `constraints[]`, `aud`, `exp`) |
| Commerce vocabulary | Follows UCP (Universal Commerce Protocol) terms for catalogue, checkout and order, including escalation to a person |
| Order response | Follows Peppol BIS Ordering: the signed receipt carries its response code (AP accepted, CA accepted with change, RE rejected). No UBL document is produced yet |
| Identifiers | Used: GS1 GTIN for products. Follows: OVT (Finnish e-invoice address) and GLN (GS1 location number) for parties |
| Errors | Used: RFC 9457 problem details |
| Discovery | Used: agent card, AI catalog, `llms.txt`, OAuth protected-resource metadata |

Design decisions and their trade-offs: [decisions](decisions).
