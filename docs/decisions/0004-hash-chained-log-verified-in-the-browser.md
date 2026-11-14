# 4. A hash-chained log, verified in the browser

- Status: accepted
- Code: [`src/lib/audit`](../../src/lib/audit), [`src/lib/console/verify.ts`](../../src/lib/console/verify.ts), [`src/lib/trust/canonical.ts`](../../src/lib/trust/canonical.ts)

## Context and problem statement

The brief asks for an audit trail "for both buyer and Valio Aimo". If only the wholesaler's server says the log is intact, the buyer has to trust the party it is checking.

## Considered options

1. A database table with an "audited" flag.
2. A log signed per entry.
3. A hash chain: each entry carries the previous entry's hash, a SHA-256 digest of its content, its own SHA-256 over sequence, time, event, previous hash and content digest, and a supplier signature over `{seq, hash}`; plus signed checkpoints.

## Decision outcome

Option 3, and the check runs in the reader's browser. The buyer's log page and the wholesaler's audit page both fetch the entries and the JWKS and re-check every link and signature locally. The same verification runs on the server at `/api/v1/audit/verify`.

## Consequences

- Good: a changed, deleted or reordered entry is named, on either side, without trusting the server.
- Good: approvals pause, and no order confirms alone, while the log does not verify.
- Good: because the signed hash covers a content digest, an agent can be given other buyers' entries as redacted stubs and still verify the whole chain.
- Bad: a cut tail is detected only against a head the verifier saw before; a new verifier needs an external anchor (SCITT, in the production path).
- Neutral: the demo lets visitors alter one entry to show detection; it is put back after five minutes.

## Confirmation

Evals T6, T9 to T13. Tests in [`tests/audit`](../../tests/audit) and [`tests/console/chain.test.ts`](../../tests/console/chain.test.ts).
