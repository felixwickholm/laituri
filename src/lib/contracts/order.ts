import { z } from "zod";
import { IsoDateTime, Jws } from "./common";
import { Offer } from "./offer";
import { Decision } from "./policy";

export const OrderStatus = z.enum(["confirmed", "pending_approval", "rejected", "blocked"]);
export type OrderStatus = z.infer<typeof OrderStatus>;

export const PlaceOrderRequest = z.object({
  offerJws: Jws.describe("The signed offer exactly as received"),
  mandateJws: Jws.describe("The buyer-signed mandate that authorises this agent"),
  idempotencyKey: z.string().min(8).describe("Repeat the same key to retry safely"),
});
export type PlaceOrderRequest = z.infer<typeof PlaceOrderRequest>;

export const Approval = z.object({
  decidedBy: z.object({ id: z.string(), name: z.string() }),
  decision: z.enum(["approved", "rejected"]),
  decidedAt: IsoDateTime,
  note: z.string().max(500).optional(),
  jws: Jws.describe("The approver's signature over the order id, offer id and decision"),
});
export type Approval = z.infer<typeof Approval>;

export const Order = z.object({
  id: z.string(),
  status: OrderStatus,
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
  mandateId: z.string(),
  agent: z.object({ id: z.string(), name: z.string() }),
  buyer: z.object({ id: z.string(), name: z.string() }),
  offer: Offer,
  decision: Decision,
  approval: Approval.optional(),
  receiptJws: Jws.optional().describe("Wholesaler-signed order confirmation; present when confirmed"),
  simulated: z.literal(true).describe("The challenge environment has no order endpoint; commitment is simulated here"),
  seeded: z.literal(true).optional().describe("Demo history written at start-up through the real order path, not live use"),
});
export type Order = z.infer<typeof Order>;

export const ApprovalDecisionRequest = z.object({
  decision: z.enum(["approved", "rejected"]),
  note: z.string().max(500).optional(),
});
export type ApprovalDecisionRequest = z.infer<typeof ApprovalDecisionRequest>;
