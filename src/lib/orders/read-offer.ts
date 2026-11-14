import { Offer, type Order } from "@/lib/contracts";
import { ValidationError } from "@/lib/gateway/errors";
import type { OfferRead, OrderDeps } from "./types";

/** Reads the payload of a compact JWS without checking the signature. Only for display and idempotency matching. */
export function decodeUnverified(jws: string): unknown {
  const parts = jws.split(".");
  if (parts.length !== 3) return undefined;
  try {
    return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch {
    return undefined;
  }
}

/**
 * Verify the wholesaler's signature on an offer. An altered offer is still returned (as read, marked invalid)
 * so the order can be recorded as blocked. Only an offer that cannot be read at all is a request error.
 */
export async function readOffer(jws: string, deps: Pick<OrderDeps, "trust">): Promise<OfferRead & { offer: Offer }> {
  const verified = await deps.trust.verify<unknown>("supplier", jws);
  const parsed = Offer.safeParse(verified.valid ? verified.payload : decodeUnverified(jws));
  if (!parsed.success) {
    if (verified.valid) throw new ValidationError("The signed offer does not have the expected content.");
    throw new ValidationError("The offer could not be read. Send the offer JWS exactly as received.");
  }
  if (verified.valid) return { valid: true, offer: parsed.data };
  return {
    valid: false,
    offer: parsed.data,
    reason: verified.reason ?? "The wholesaler's signature on the offer does not match its content.",
  };
}

/** A fixed-price offer covers one order. A second order needs a new quote, so stock is not promised twice. */
export function singleUse<T extends OfferRead>(read: T, orders: Order[]): T {
  if (!read.valid || !read.offer) return read;
  const used = orders.find((o) => o.offer.id === read.offer?.id && (o.status === "confirmed" || o.status === "pending_approval"));
  return used ? { ...read, valid: false, reason: `This offer was already used for order ${used.id}. Ask for a new quote.` } : read;
}
