import { Mandate } from "@/lib/contracts";
import { NotFoundError } from "@/lib/gateway/errors";
import { store } from "@/lib/store";
import { trust } from "@/lib/trust";
import { fromClaims, toClaims } from "./claims";
import { PRIMARY_BUYER_ID, defaultMandate, isKnownBuyer } from "./defaults";

export { BUYER_IDS, PRIMARY_BUYER_ID, buyerIds, buyerParty, defaultMandate, isKnownBuyer } from "./defaults";
export { MANDATE_VCT, MandateClaims, fromClaims, toClaims } from "./claims";

export interface MandateReading {
  valid: boolean;
  mandate?: Mandate;
  reason?: string;
}

export type MandatePatch = {
  [K in keyof Omit<Mandate, "id" | "version">]?: Mandate[K] extends unknown[]
    ? Mandate[K]
    : Mandate[K] extends object
      ? Partial<Mandate[K]>
      : Mandate[K];
};

/** Signs the mandate with the buyer key. */
export function issueMandate(mandate: Mandate): Promise<string> {
  return trust().sign("buyer", toClaims(Mandate.parse(mandate)), { typ: "mandate+jwt" });
}

/** Verifies the buyer signature and parses the claims. Never throws. */
export async function readMandate(jws: string): Promise<MandateReading> {
  const verified = await trust().verify<unknown>("buyer", jws);
  if (!verified.valid) return { valid: false, reason: `The mandate signature is not valid: ${verified.reason}.` };
  const { mandate, reason } = fromClaims(verified.payload);
  return mandate ? { valid: true, mandate } : { valid: false, reason };
}

/**
 * A buyer's stored mandate, the primary buyer's when none is named. Issues and stores the default
 * when none is stored or the stored one no longer verifies.
 */
export async function currentMandate(buyerId: string = PRIMARY_BUYER_ID): Promise<{ mandate: Mandate; jws: string }> {
  if (!isKnownBuyer(buyerId)) throw new NotFoundError(`No buyer with the id ${buyerId} is known.`);
  const stored = await store().mandates.get(buyerId);
  if (stored) {
    const reading = await readMandate(stored);
    if (reading.valid && reading.mandate?.buyer.id === buyerId) return { mandate: reading.mandate, jws: stored };
  }
  const mandate = defaultMandate(buyerId);
  const jws = await issueMandate(mandate);
  await store().mandates.put(buyerId, jws);
  return { mandate, jws };
}

/** Applies a change to one buyer's mandate, bumps the version, re-signs and stores it. Nested objects merge one level deep. */
export async function updateMandate(patch: MandatePatch, buyerId: string = PRIMARY_BUYER_ID): Promise<{ mandate: Mandate; jws: string }> {
  const { mandate: current } = await currentMandate(buyerId);
  const merged: Record<string, unknown> = { ...current };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    const base = merged[key];
    merged[key] =
      isPlainObject(base) && isPlainObject(value) ? { ...base, ...value } : value;
  }
  // The buyer and its agent are who the mandate is between; a change of limits cannot move it to someone else.
  const next = Mandate.parse({ ...merged, id: current.id, version: current.version + 1, buyer: current.buyer, agent: current.agent });
  const jws = await issueMandate(next);
  await store().mandates.put(buyerId, jws);
  return { mandate: next, jws };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
