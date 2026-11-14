import { z } from "zod";
import { IsoDateTime, Jws } from "./common";

export const AuditEvent = z.enum([
  "agent.connected",
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
]);
export type AuditEvent = z.infer<typeof AuditEvent>;

export const Actor = z.object({
  type: z.enum(["agent", "human", "supplier"]),
  id: z.string(),
  name: z.string(),
});
export type Actor = z.infer<typeof Actor>;

/** One link in the append-only log. hash covers every field above it plus prevHash. */
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
  }),
  data: z.record(z.string(), z.unknown()).describe("Structured evidence for this step"),
  prevHash: z.string(),
  hash: z.string().describe("SHA-256 over the canonical JSON of this entry without hash and signature"),
  signature: Jws.describe("Wholesaler signature over hash"),
});
export type AuditEntry = z.infer<typeof AuditEntry>;

export const AuditVerification = z.object({
  valid: z.boolean(),
  entries: z.number().int(),
  head: z.string().optional().describe("Hash of the newest entry"),
  brokenAt: z.number().int().optional().describe("seq of the first entry that fails"),
  reason: z.string().optional(),
});
export type AuditVerification = z.infer<typeof AuditVerification>;
