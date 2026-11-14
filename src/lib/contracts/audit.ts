import { z } from "zod";
import { IsoDateTime, Jws } from "./common";

export const AuditEvent = z.enum([
  "agent.connected",
  "agent.suspended",
  "agent.resumed",
  "catalog.searched",
  "offer.issued",
  "order.requested",
  "policy.evaluated",
  "order.confirmed",
  "order.blocked",
  "approval.requested",
  "approval.granted",
  "approval.rejected",
  "mandate.updated",
  "access.refused",
  "basket.started",
  "basket.line_resolved",
  "handoff.requested",
  "handoff.answered",
]);
export type AuditEvent = z.infer<typeof AuditEvent>;

export const Actor = z.object({
  type: z.enum(["agent", "human", "supplier"]),
  id: z.string(),
  name: z.string(),
});
export type Actor = z.infer<typeof Actor>;

/**
 * One link in the append-only log. contentDigest covers actor, summary, refs, data and the seeded mark; hash covers
 * seq, at, event, prevHash and contentDigest, so a reader shown only a stub can still verify the chain.
 */
export const AuditEntry = z.object({
  seq: z.number().int(),
  at: IsoDateTime,
  actor: Actor,
  event: AuditEvent,
  summary: z.string().describe("What happened and why, in one plain sentence"),
  refs: z.object({
    offerId: z.string().optional(),
    orderId: z.string().optional(),
    mandateId: z.string().optional(),
    buyerId: z.string().optional(),
  }),
  data: z.record(z.string(), z.unknown()).describe("Structured evidence for this step"),
  seeded: z.literal(true).optional().describe("Demo history written at start-up; covered by the hash like every other field"),
  prevHash: z.string(),
  contentDigest: z.string().optional().describe(
    "SHA-256 over the canonical JSON of actor, summary, refs, data and seeded. Absent only on entries written before digests were added",
  ),
  hash: z.string().describe("SHA-256 over the canonical JSON of seq, at, event, prevHash and contentDigest (before digests: of the whole entry)"),
  signature: Jws.describe("Wholesaler signature over seq and hash"),
});
export type AuditEntry = z.infer<typeof AuditEntry>;

/**
 * Another buyer's entry as an agent token reads it: no actor, summary, refs or data, but every field the chain needs.
 * legacy: written before content digests, so only its link and signature can be checked, not its event or time.
 */
export const AuditStub = AuditEntry.pick({ seq: true, at: true, event: true, prevHash: true, contentDigest: true, hash: true, signature: true })
  .extend({ redacted: z.literal(true), legacy: z.literal(true).optional() });
export type AuditStub = z.infer<typeof AuditStub>;

/** What GET /api/v1/audit returns per entry: the entry in full, or a stub when the reader may not see its content. */
export const AuditRecord = z.union([AuditEntry, AuditStub]);
export type AuditRecord = z.infer<typeof AuditRecord>;

export const AuditVerification = z.object({
  valid: z.boolean(),
  entries: z.number().int(),
  head: z.string().optional().describe("Hash of the newest entry"),
  brokenAt: z.number().int().optional().describe("seq of the first entry that fails"),
  reason: z.string().optional(),
});
export type AuditVerification = z.infer<typeof AuditVerification>;
