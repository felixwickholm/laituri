import { z } from "zod";
import {
  ApprovalDecisionRequest,
  AuditEntry,
  AuditVerification,
  Mandate,
  Money,
  Order,
  PlaceOrderRequest,
  Product,
  QuoteRequest,
  QuoteResponse,
  SearchRequest,
  SearchResponse,
  SignedOffer,
} from "@/lib/contracts";

/** Schemas the front door adds around the frozen contracts (wrappers, health, problems). */

export const ProblemSchema = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number().int(),
  detail: z.string().describe("What went wrong, in one plain sentence"),
  code: z.string().describe("Stable machine-readable error code"),
  violations: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
});

export const SignedMandate = z.object({
  jws: z.string().describe("Buyer-signed mandate JWT. Pass it unchanged as mandateJws when placing an order."),
  mandate: Mandate,
});

const mandateShape = Mandate.omit({ id: true, version: true }).shape;
/** Every top-level field is optional; nested objects merge one level deep. */
export const MandatePatchBody = z
  .object(
    Object.fromEntries(
      Object.entries(mandateShape).map(([key, schema]) => [
        key,
        (schema instanceof z.ZodObject ? schema.partial() : schema).optional(),
      ]),
    ),
  )
  .strict();

export const PlaceOrderBody = PlaceOrderRequest.extend({
  idempotencyKey: PlaceOrderRequest.shape.idempotencyKey
    .optional()
    .describe("Repeat the same key to retry safely. May be sent as the Idempotency-Key header instead."),
});

export const OrderList = z.object({ orders: z.array(Order) });

export const AuditLog = z.object({ entries: z.array(AuditEntry) });

export const Checkpoint = z.object({
  checkpoint: z.object({
    size: z.number().int().describe("Number of entries in the log"),
    head: z.string().describe("Hash of the newest entry"),
    at: z.string(),
  }),
  jws: z.string().describe("Wholesaler signature over the checkpoint"),
});

export const AuditProof = z.object({
  verification: AuditVerification,
  checkpoint: Checkpoint,
});

export const ActivityItem = z.object({
  id: z.string(),
  at: z.string(),
  agent: z.object({ id: z.string(), name: z.string() }),
  kind: z.enum(["tool", "note"]),
  tool: z.string().optional(),
  title: z.string(),
  detail: z.string().optional(),
  status: z.enum(["ok", "waiting", "blocked", "error"]),
  refs: z.object({ offerId: z.string().optional(), orderId: z.string().optional() }).optional(),
  durationMs: z.number().optional(),
});

export const ActivityList = z.object({ activity: z.array(ActivityItem) });

export const Health = z.object({
  status: z.enum(["ok", "degraded"]),
  mode: z.enum(["live", "recorded"]).describe("live calls the wholesaler API; recorded replays saved responses"),
  upstream: z.object({ ok: z.boolean(), latencyMs: z.number().optional(), error: z.string().optional() }),
  catalog: z.object({ ready: z.boolean(), size: z.number().int() }),
  time: z.string(),
});

export const ResetResult = z.object({ ok: z.literal(true), detail: z.string() });

/** Every named schema, keyed by its component name. Operations and tools refer to these names. */
export const SCHEMAS = {
  Money,
  Product,
  SearchRequest,
  SearchResponse,
  QuoteRequest,
  QuoteResponse,
  SignedOffer,
  PlaceOrderRequest,
  PlaceOrderBody,
  Order,
  OrderList,
  ApprovalDecisionRequest,
  Mandate,
  SignedMandate,
  MandatePatch: MandatePatchBody,
  AuditEntry,
  AuditLog,
  AuditVerification,
  Checkpoint,
  AuditProof,
  ActivityItem,
  ActivityList,
  Health,
  ResetResult,
  Problem: ProblemSchema,
} satisfies Record<string, z.ZodType>;

export type SchemaName = keyof typeof SCHEMAS;
