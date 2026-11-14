# Trust protocol

The brief asks for "the minimum data/verification standard for an external agent to trust Valio Aimo's claims on stock, price and origin without a manual check". This is Laituri's answer. Every step uses public standards (JWS, JWKS, SHA-256) and can be done by an agent that has never talked to us before.

## What is signed, and by whom

| Claim | Where it is | Signed by | `typ` |
|---|---|---|---|
| Fixed net price per sales unit, line totals, tax | `offer.lines[].unitPrice`, `lineNet`, `offer.totals` | Supplier key | `offer+jwt` |
| Stock: units requested and available, status | `offer.lines[].availability` | Supplier key | `offer+jwt` |
| Delivery date and order cut-off | `availability.deliveryDate`, `availability.orderBy`, `offer.deliveryDate`, `offer.orderBy` | Supplier key | `offer+jwt` |
| Origin, labels, delivery reliability, category-average CO2 | `offer.lines[].facts` | Supplier key | `offer+jwt` |
| Who the offer is for, when it expires | `offer.buyer`, `offer.customerNumber`, `offer.expiresAt` | Supplier key | `offer+jwt` |
| What the agent may do alone | the mandate | Buyer key | `mandate+jwt` |
| A person lifted a limit | the approval, bound to the offer's hash | Approver key | `approval+jwt` |
| The order was accepted on these terms | the receipt, bound to the offer's hash and an audit entry | Supplier key | `receipt+jwt` |
| What happened, in order | each audit entry's `{seq, hash}` | Supplier key | `audit+jwt` |
| How long the log was at a moment | the checkpoint | Supplier key | `checkpoint+jwt` |

Contracts: [`src/lib/contracts/offer.ts`](../src/lib/contracts/offer.ts), [`src/lib/contracts/facts.ts`](../src/lib/contracts/facts.ts), [`src/lib/orders/receipt.ts`](../src/lib/orders/receipt.ts), [`src/lib/audit/chain.ts`](../src/lib/audit/chain.ts).

## Verification steps for an agent

1. **Get the keys.** `GET /.well-known/jwks.json`. Keep the keys whose `role` is `supplier` (offers, receipts, log) and `buyer` (mandates). Keys are EC P-256; the algorithm is ES256 only.
2. **Get an offer.** `request_quote` or `POST /api/v1/quotes`. The answer has `primary.jws` and, when the request cannot be met in full and on time, `alternatives[].signed.jws`.
3. **Verify the offer.** Read the protected header: `alg` must be `ES256`, `kid` must name a supplier key, `typ` must be `offer+jwt`. Verify the signature over the payload. Use the payload, not any unsigned copy next to it.
4. **Check time.** `expiresAt` must be in the future (offers live 15 minutes). For each line, `availability.orderBy` must be in the future, or that delivery date can no longer be ordered.
5. **Check fit.** Compare the payload with the need: `availability.status` is `available` for a full offer; `deliveryDate` is on or before `deliverBy`; `facts.labels` and `facts.countryOfOrigin` meet the buyer's wishes.
6. **Order with the bytes unchanged.** Send the JWS exactly as received. The gateway verifies it again and refuses a changed, expired, foreign or already used offer.
7. **Verify the receipt.** A confirmed order has `receiptJws`, signed by the supplier key, with `offerHash` (SHA-256 of the canonical offer), `orderId`, `responseCode` and `auditSeq`.
8. **Check the log.** `GET /api/v1/audit/verify` re-checks every hash link and every entry signature. `GET /api/v1/audit/checkpoint` returns a signed `{size, head}`. Keep it; a later verification that finds fewer entries, or a different entry at that size whatever the log's length, shows the log was cut or rewritten.

## Failure cases and how they are caught

| Attempt | Result | Eval |
|---|---|---|
| Price or quantity edited in the offer | `offer.signature` blocks the order | G1, G2 |
| Origin or a label edited in the offer | `offer.signature` blocks the order | T14 |
| Offer signed by another key | `offer.signature` blocks | G4 |
| Offer used after `expiresAt` | `offer.expiry` blocks | G3 |
| The same offer ordered twice | Second order blocked: one offer gives one order | G9 |
| Mandate edited to raise a limit | `mandate.signature` blocks | G5 |
| Mandate signed by the agent's own key | `mandate.signature` blocks | G6 |
| One byte changed in a receipt | Signature check fails | T8 |
| An audit entry changed, deleted or reordered | Verification names the entry | T9, T10, T11, T13 |
| The newest audit entries cut off, the log cut and extended, or rewritten from an earlier entry | Detected against the remembered head | T12, T15, T16 |
| A waiting order approved after the mandate changed to exclude it | The approval re-checks the mandate in force and blocks the order | G22 |

Run them: `npm run eval -- --suite trust` and `npm run eval -- --suite guardrails`.

## What this does not prove

- That the wholesaler's stock figure is true in the warehouse. The signature proves the wholesaler said it and nobody changed it; in production the wholesaler is accountable for what it signs.
- That the CO2 figure belongs to the product. It is the category average, and the field name says so (`categoryAverageCo2PerKg`).
- Completeness against a verifier that has never seen the log before. That needs an external anchor (SCITT), listed in the production path.
