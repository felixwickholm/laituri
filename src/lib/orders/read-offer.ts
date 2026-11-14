import { Offer, type Order } from "@/lib/contracts";
import { ValidationError } from "@/lib/gateway/errors";
import { TOKEN_TYPE } from "@/lib/trust/types";
import { REFUSALS } from "./refusals";
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
 * Verify the wholesaler's signature on an offer. An altered offer is still returned (as read, refused as invalid)
 * so the order can be recorded as refused. Only an offer that cannot be read at all is a request error.
 */
export async function readOffer(jws: string, deps: Pick<OrderDeps, "trust">): Promise<OfferRead & { offer: Offer }> {
  const verified = await deps.trust.verify<unknown>("supplier", jws, TOKEN_TYPE.offer);
  const parsed = Offer.safeParse(verified.valid ? verified.payload : decodeUnverified(jws));
  if (!parsed.success) {
    if (verified.valid) throw new ValidationError("The signed offer does not have the expected content.");
    throw new ValidationError("The offer could not be read. Send the offer JWS exactly as received.");
  }
  if (verified.valid) return { valid: true, offer: parsed.data };
  const refusal = REFUSALS.offerSignature;
  return { valid: false, offer: parsed.data, reason: `${refusal.message.replace(/\.$/, "")}: ${verified.reason ?? "unknown reason"}.`, refusal };
}

/**
 * An order may use only an offer this workspace issued: signed for its audience and kept, byte for byte, in its own
 * store. A signed offer copied from another workspace is refused, so one offer can never be ordered in two.
 */
export async function issuedHere<T extends OfferRead & { offer: Offer }>(
  read: T,
  jws: string,
  deps: Pick<OrderDeps, "store" | "audience">,
): Promise<T> {
  if (!read.valid) return read;
  const kept = await deps.store.offers.get(read.offer.id);
  if (read.offer.audience === deps.audience() && kept?.jws === jws) return read;
  const refusal = REFUSALS.offerElsewhere;
  return { ...read, valid: false, reason: refusal.message, refusal };
}

/** A fixed-price offer covers one order. A second order needs a new quote, so stock is not promised twice. */
export function singleUse<T extends OfferRead>(read: T, orders: Order[]): T {
  if (!read.valid || !read.offer) return read;
  const used = orders.find((o) => o.offer.id === read.offer?.id && (o.status === "confirmed" || o.status === "pending_approval"));
  return used ? { ...read, valid: false, reason: `This offer was already used for order ${used.id}. Ask for a new quote.` } : read;
}
