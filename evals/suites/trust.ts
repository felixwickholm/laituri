import type { AuditEntry, AuditRecord, Offer, Order } from "@/lib/contracts";
import { isStub } from "@/lib/audit";
import { replacePayload } from "@/lib/demo/forge";
import type { ReceiptPayload } from "@/lib/orders";
import { store } from "@/lib/store";
import { TOKEN_TYPE, sha256Hex } from "@/lib/trust";
import type { EvalCase, Suite } from "../harness";
import { Checks } from "../support/checks";
import { mandate, orderFrom, placeOrder } from "../support/flow";
import { changeOneByte } from "../support/jws";
import { get, ok } from "../support/router";
import { rewriteLog } from "../support/rewrite";
import { buildTrail, verifyAs, verifyEntries, type Trail } from "../support/trail";

type Body = (trail: Trail, checks: Checks) => Promise<string>;

function trustCase(id: string, name: string, expected: string, body: Body): EvalCase {
  return {
    id,
    name,
    expected,
    async run() {
      const checks = new Checks();
      const actual = await body(await buildTrail(), checks);
      checks.note(actual);
      return checks.verdict(actual);
    },
  };
}

const middle = (entries: AuditEntry[]) => entries[Math.floor(entries.length / 2)];

async function receiptChecks(order: Order, trail: Trail, checks: Checks): Promise<string> {
  const result = await verifyAs<ReceiptPayload>(order.receiptJws ?? "", trail.jwks, "supplier", TOKEN_TYPE.receipt);
  checks.expect(result.valid, `receipt of the ${order.approval ? "approved" : "auto"} order: ${result.reason}`);
  checks.expect(result.payload?.offerHash === (await sha256Hex(order.offer)), "receipt offerHash does not match the offer");
  const confirmed = trail.entries.find((entry) => entry.seq === result.payload?.auditSeq);
  checks.expect(confirmed?.event === "order.confirmed" && confirmed.refs.orderId === order.id, "receipt auditSeq does not point at the confirmation");
  return `${result.payload?.responseCode} seq ${result.payload?.auditSeq}`;
}

const CASES: EvalCase[] = [
  trustCase("T1", "JWKS publishes public keys only", "three roles, no private parts", async ({ jwks }, checks) => {
    const roles = jwks.keys.map((key) => (key as { role?: string }).role).sort();
    checks.expect(roles.join() === "approver,buyer,supplier", `roles ${roles.join(",")}`);
    checks.expect(jwks.keys.every((key) => !("d" in key)), "a key exposes its private part");
    return `${jwks.keys.length} keys: ${roles.join(", ")}`;
  }),
  trustCase("T2", "Offer signature", "valid, supplier key", async ({ offer, jwks }, checks) => {
    const result = await verifyAs<{ id: string }>(offer.jws, jwks, "supplier", TOKEN_TYPE.offer);
    checks.expect(result.valid && result.payload?.id === offer.offer.id, `offer: ${result.reason ?? "payload is another offer"}`);
    return `${result.role} ${result.typ}`;
  }),
  trustCase("T3", "Mandate signature", "valid, buyer key", async ({ mandateJws, jwks }, checks) => {
    const result = await verifyAs<{ vct: string }>(mandateJws, jwks, "buyer", TOKEN_TYPE.mandate);
    checks.expect(result.valid, `mandate: ${result.reason}`);
    return `${result.role} ${result.typ} ${result.payload?.vct}`;
  }),
  trustCase("T4", "Approval signature", "valid, approver key, bound to the offer", async ({ approved, jwks }, checks) => {
    const result = await verifyAs<{ orderId: string; offerHash: string }>(approved.approval?.jws ?? "", jwks, "approver", TOKEN_TYPE.approval);
    checks.expect(result.valid, `approval: ${result.reason}`);
    checks.expect(result.payload?.orderId === approved.id, "approval names another order");
    checks.expect(result.payload?.offerHash === (await sha256Hex(approved.offer)), "approval offerHash does not match the offer");
    return `${result.role} ${result.typ}`;
  }),
  trustCase("T5", "Receipt signatures", "valid, supplier key, bound to offer and audit entry", async (trail, checks) => {
    return `auto ${await receiptChecks(trail.auto, trail, checks)}; approved ${await receiptChecks(trail.approved, trail, checks)}`;
  }),
  trustCase("T6", "Every audit signature and the chain", "all valid with the JWKS; checkpoint signed", async ({ entries, jwks, head, checkpointJws }, checks) => {
    const verification = await verifyEntries(entries, jwks, head);
    checks.expect(verification.valid, `chain: ${verification.reason}`);
    const signed = await Promise.all(entries.map((entry) => verifyAs(entry.signature, jwks, "supplier", TOKEN_TYPE.audit)));
    checks.expect(signed.every((s) => s.valid), `${signed.filter((s) => !s.valid).length} audit signatures fail`);
    checks.expect((await verifyAs(checkpointJws, jwks, "supplier", TOKEN_TYPE.checkpoint)).valid, "checkpoint signature fails");
    return `${entries.length} entries verified, head matches checkpoint`;
  }),
  trustCase("T7", "One byte changed in an offer", "detected; ordering it is blocked", async ({ offer, jwks }, checks) => {
    const changed = changeOneByte(offer.jws);
    const result = await verifyAs(changed, jwks, "supplier", TOKEN_TYPE.offer);
    checks.expect(!result.valid, "changed offer still verifies");
    const reply = await placeOrder(changed, (await mandate()).jws, "eval-t7-changed");
    checks.expect(orderFrom(reply)?.status === "blocked" || reply.status === 400, `ordering it answered ${reply.status}`);
    return `${result.reason}; order ${orderFrom(reply)?.status ?? reply.status}`;
  }),
  trustCase("T8", "One byte changed in a receipt", "detected", async ({ auto, jwks }, checks) => {
    const result = await verifyAs(changeOneByte(auto.receiptJws ?? ""), jwks, "supplier", TOKEN_TYPE.receipt);
    checks.expect(!result.valid, "changed receipt still verifies");
    return result.reason ?? "verified";
  }),
  trustCase("T9", "One byte changed in an audit entry", "detected, names that entry", async ({ entries, jwks }, checks) => {
    const target = middle(entries);
    const changed = entries.map((entry) => (entry === target ? { ...entry, summary: `X${entry.summary.slice(1)}` } : entry));
    const verification = await verifyEntries(changed, jwks);
    checks.expect(!verification.valid && verification.brokenAt === target.seq, `brokenAt ${verification.brokenAt}, expected ${target.seq}`);
    return `changed ${target.seq}: ${verification.reason}`;
  }),
  trustCase("T10", "Middle audit entry deleted", "detected", async ({ entries, jwks, head }, checks) => {
    const target = middle(entries);
    const verification = await verifyEntries(entries.filter((entry) => entry !== target), jwks, head);
    checks.expect(!verification.valid && verification.brokenAt === target.seq + 1, `brokenAt ${verification.brokenAt}, expected ${target.seq + 1}`);
    return `deleted ${target.seq}: ${verification.reason}`;
  }),
  trustCase("T11", "Audit entries reordered", "detected", async ({ entries, jwks, head }, checks) => {
    const at = entries.indexOf(middle(entries));
    const swapped = [...entries];
    [swapped[at], swapped[at + 1]] = [swapped[at + 1], swapped[at]];
    const verification = await verifyEntries(swapped, jwks, head);
    checks.expect(!verification.valid, "reordered log still verifies");
    return `swapped ${entries[at].seq} and ${entries[at + 1].seq}: ${verification.reason}`;
  }),
  trustCase("T12", "Audit tail cut", "detected against the remembered head", async ({ entries, jwks, head }, checks) => {
    const cut = await verifyEntries(entries.slice(0, -2), jwks, head);
    checks.expect(!cut.valid, "a log without its last two entries still verifies");
    checks.expect((await verifyEntries(entries.slice(0, -2), jwks)).valid, "the shortened chain should be internally consistent");
    return `kept ${entries.length - 2} of ${head.size}: ${cut.reason}`;
  }),
  trustCase("T13", "Stored entry changed, service verify", "the verify endpoint names the entry", async ({ entries }, checks) => {
    const target = middle(entries);
    await store().audit.replace(target.seq, { ...target, data: { ...target.data, totals: "changed" } });
    const verification = (await get("/api/v1/audit/verify")).body as { valid: boolean; brokenAt?: number; reason?: string };
    checks.expect(!verification.valid && verification.brokenAt === target.seq, `verify said brokenAt ${verification.brokenAt}, expected ${target.seq}`);
    return `changed ${target.seq}: ${verification.reason}`;
  }),
  trustCase("T14", "Origin or label changed in an offer", "detected; ordering it is blocked by the signature check", async ({ offer, jwks }, checks) => {
    const edits: [string, (line: Offer["lines"][number]) => Offer["lines"][number]][] = [
      ["origin", (line) => ({ ...line, facts: { labels: [], ...line.facts, countryOfOrigin: "XX" } })],
      ["label", (line) => ({ ...line, facts: { ...line.facts, labels: [...(line.facts?.labels ?? []), "organic"] } })],
    ];
    const { jws: mandateJws } = await mandate();
    const outcomes: string[] = [];
    for (const [what, edit] of edits) {
      const changed = replacePayload(offer.jws, (payload: Offer) => ({ ...payload, lines: payload.lines.map(edit) }));
      const result = await verifyAs(changed, jwks, "supplier", TOKEN_TYPE.offer);
      checks.expect(!result.valid, `an offer with a changed ${what} still verifies`);
      const order = orderFrom(await placeOrder(changed, mandateJws, `eval-t14-${what}`));
      const check = order?.decision.checks.find((c) => c.rule === "offer.signature");
      checks.expect(order?.status === "blocked" && check?.status === "block", `ordering the offer with a changed ${what} was not blocked by its signature`);
      outcomes.push(`${what}: ${result.reason}, order ${order?.status}`);
    }
    checks.expect(offer.offer.lines.every((line) => line.facts !== undefined), "the signed offer carries no product facts");
    return outcomes.join("; ");
  }),
  trustCase("T15", "Earlier entry rewritten in a longer log", "detected against the remembered head, whatever the new length", async ({ entries, jwks, head }, checks) => {
    const at = middle(entries).seq;
    const rewritten = await rewriteLog(entries, at - 1, entries.length - at + 3);
    checks.expect((await verifyEntries(rewritten, jwks)).valid, "the rewritten chain should be internally consistent");
    const verification = await verifyEntries(rewritten, jwks, head);
    checks.expect(!verification.valid && verification.brokenAt === head.size, `brokenAt ${verification.brokenAt}, expected ${head.size}`);
    return `rewrote from ${at}, ${rewritten.length} entries for ${head.size} remembered: ${verification.reason}`;
  }),
  trustCase("T16", "Audit tail cut, then extended", "detected against the remembered head", async ({ entries, jwks, head }, checks) => {
    const extended = await rewriteLog(entries, entries.length - 2, 3);
    checks.expect((await verifyEntries(extended, jwks)).valid, "the extended chain should be internally consistent");
    const verification = await verifyEntries(extended, jwks, head);
    checks.expect(!verification.valid, "a log cut and extended past the remembered head still verifies");
    return `kept ${entries.length - 2}, added 3, ${extended.length} entries for ${head.size} remembered: ${verification.reason}`;
  }),
  trustCase("T17", "Another buyer's agent verifies the whole chain", "the hotel's entries arrive as stubs without content; the chain verifies end to end; a changed stub is detected", async ({ jwks, head }, checks) => {
    const { entries } = ok<{ entries: AuditRecord[] }>(await get("/api/v1/audit", { authorization: "Bearer demo-kaisla-token" }), "Audit log for Kaisla");
    const stubs = entries.filter(isStub);
    checks.expect(stubs.length > 0, "the school's agent got no stubs");
    checks.expect(!JSON.stringify(stubs).includes("Nordic Harbour"), "a stub carries another buyer's content");
    const verification = await verifyEntries(entries, jwks, head);
    checks.expect(verification.valid, `chain with stubs: ${verification.reason}`);
    const target = stubs[Math.floor(stubs.length / 2)];
    const changed = entries.map((entry) => (entry === target ? { ...target, event: "approval.granted" as const } : entry));
    const broken = await verifyEntries(changed, jwks);
    checks.expect(!broken.valid && broken.brokenAt === target.seq, `a stub with a changed event: brokenAt ${broken.brokenAt}, expected ${target.seq}`);
    return `${stubs.length} of ${entries.length} entries as stubs, verified to the checkpoint head; changed stub ${target.seq} detected`;
  }),
];

export const trustSuite: Suite = { id: "trust", name: "Trust", bar: 1, liveAll: true, cases: CASES };
