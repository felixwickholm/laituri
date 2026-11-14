import { Mandate } from "@/lib/contracts";
import { NotFoundError } from "@/lib/gateway/errors";
import { store } from "@/lib/store";
import { TOKEN_TYPE, trust } from "@/lib/trust";
import { REFUSALS } from "@/lib/orders/refusals";
import type { Refusal } from "@/lib/contracts";
import { workspaceAudience } from "@/lib/workspace/context";
import { fromClaims, toClaims } from "./claims";
import { PRIMARY_BUYER_ID, defaultMandate, isKnownBuyer } from "./defaults";

export { BUYER_IDS, PRIMARY_BUYER_ID, buyerIds, buyerParty, defaultMandate, isKnownBuyer } from "./defaults";
export { MANDATE_VCT, MandateClaims, fromClaims, toClaims } from "./claims";

export interface MandateReading {
  valid: boolean;
  mandate?: Mandate;
  reason?: string;
  /** Set when the mandate is refused as invalid: its signature fails, or it was signed for another workspace. */
  refusal?: Refusal;
}

export type MandatePatch = {
  [K in keyof Omit<Mandate, "id" | "version">]?: Mandate[K] extends unknown[]
    ? Mandate[K]
    : Mandate[K] extends object
      ? Partial<Mandate[K]>
      : Mandate[K];
};

/** Signs the mandate with the buyer key, for the current workspace only. */
export function issueMandate(mandate: Mandate): Promise<string> {
  return trust().sign("buyer", toClaims(Mandate.parse(mandate), workspaceAudience()), TOKEN_TYPE.mandate);
}

/** The buyer signature and claims, whatever workspace the mandate was signed for. */
async function readSigned(jws: string): Promise<MandateReading & { audience?: string }> {
  const verified = await trust().verify<unknown>("buyer", jws, TOKEN_TYPE.mandate);
  if (!verified.valid) {
    return { valid: false, reason: `${REFUSALS.mandateSignature.message.replace(/\.$/, "")}: ${verified.reason}.`, refusal: REFUSALS.mandateSignature };
  }
  const { mandate, audience, reason } = fromClaims(verified.payload);
  return mandate ? { valid: true, mandate, audience } : { valid: false, reason };
}

/** Verifies the buyer signature, the claims and that the mandate was signed for this workspace. Never throws. */
export async function readMandate(jws: string): Promise<MandateReading> {
  const { audience, ...reading } = await readSigned(jws);
  if (reading.valid && audience !== workspaceAudience()) {
    return { valid: false, reason: "The mandate was signed for another workspace.", refusal: REFUSALS.mandateElsewhere };
  }
  return reading;
}

/**
 * A buyer's stored mandate, the primary buyer's when none is named. A stored mandate signed for another audience
 * (a sandbox starts as a copy of the seeded template; older stores carry none) is signed again, unchanged, for this
 * workspace. The default is issued and stored when none is stored or the stored one no longer verifies.
 */
export async function currentMandate(buyerId: string = PRIMARY_BUYER_ID): Promise<{ mandate: Mandate; jws: string }> {
  if (!isKnownBuyer(buyerId)) throw new NotFoundError(`No buyer with the id ${buyerId} is known.`);
  const stored = await store().mandates.get(buyerId);
  const reading = stored ? await readSigned(stored) : undefined;
  if (stored && reading?.valid && reading.mandate?.buyer.id === buyerId) {
    if (reading.audience === workspaceAudience()) return { mandate: reading.mandate, jws: stored };
    return keep(reading.mandate, buyerId);
  }
  return keep(defaultMandate(buyerId), buyerId);
}

async function keep(mandate: Mandate, buyerId: string): Promise<{ mandate: Mandate; jws: string }> {
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
  return keep(next, buyerId);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
