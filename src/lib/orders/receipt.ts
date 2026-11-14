import type { Order } from "@/lib/contracts";
import { TOKEN_TYPE } from "@/lib/trust/types";
import type { OrderDeps } from "./types";

export type ResponseCode = "AP" | "CA" | "RE";

/** Peppol order response code: AP accepted as offered, CA accepted with change. */
export function responseCode(order: Order): ResponseCode {
  return order.offer.fulfilment === "full" ? "AP" : "CA";
}

export interface ReceiptPayload {
  type: "order_receipt";
  orderId: string;
  offerId: string;
  offerHash: string;
  mandateId: string;
  status: "confirmed";
  responseCode: ResponseCode;
  totals: Order["offer"]["totals"];
  deliveryDate?: string;
  issuedAt: string;
  auditSeq: number;
}

/** The wholesaler's signed order confirmation. auditSeq points at the order.confirmed audit entry. */
export async function signReceipt(
  order: Order,
  auditSeq: number,
  deps: Pick<OrderDeps, "trust" | "hash" | "now">,
): Promise<string> {
  const payload: ReceiptPayload = {
    type: "order_receipt",
    orderId: order.id,
    offerId: order.offer.id,
    offerHash: await deps.hash(order.offer),
    mandateId: order.mandateId,
    status: "confirmed",
    responseCode: responseCode(order),
    totals: order.offer.totals,
    deliveryDate: order.offer.deliveryDate,
    issuedAt: deps.now().toISOString(),
    auditSeq,
  };
  return deps.trust.sign("supplier", payload, TOKEN_TYPE.receipt);
}
