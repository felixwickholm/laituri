import { randomBytes } from "node:crypto";
import type { Fulfilment, Offer, OfferLine, QuoteRequest, SignedOffer } from "@/lib/contracts";
import type { BuiltLine, OfferDeps } from "./types";

export const ISSUER = "Valio Aimo";
export const SOURCE_SYSTEM = "Valio Aimo mock API";
const VALIDITY_MS = 15 * 60 * 1000;
const BASE32 = "abcdefghijklmnopqrstuvwxyz234567";

/** Prefix plus 10 random base32 characters, for example "off_k3m9x2q7ab". */
export function newId(prefix: string): string {
  const bytes = randomBytes(10);
  let id = prefix;
  for (const byte of bytes) id += BASE32[byte & 31];
  return id;
}

function money(cents: number) {
  return { amount: cents / 100, currency: "EUR" as const };
}

function totals(lines: OfferLine[]): Offer["totals"] {
  let net = 0;
  let tax = 0;
  for (const line of lines) {
    const lineCents = Math.round(line.lineNet.amount * 100);
    net += lineCents;
    tax += Math.round((lineCents * line.taxRate) / 100);
  }
  return { net: money(net), tax: money(tax), gross: money(net + tax) };
}

function fulfilment(lines: OfferLine[], deliverBy: string): Fulfilment {
  if (lines.every((line) => line.quantity === 0)) return "unavailable";
  if (lines.some((line) => line.quantity === 0 || line.availability.status === "partial")) return "partial";
  if (lines.some((line) => (line.availability.deliveryDate ?? "") > deliverBy)) return "late";
  if (lines.some((line) => line.substituteFor)) return "substituted";
  return "full";
}

function latest(values: (string | undefined)[], pick: (a: string, b: string) => boolean): string | undefined {
  return values.reduce<string | undefined>((best, value) => {
    if (!value) return best;
    return !best || pick(value, best) ? value : best;
  }, undefined);
}

export interface OfferInput {
  request: Pick<QuoteRequest, "deliverBy" | "intent" | "matchConfidence">;
  customerNumber: string;
  lines: BuiltLine[];
  now: Date;
}

/** Turn built lines into a fixed-price offer. Dates and cut-offs only count lines that deliver something. */
export function assembleOffer({ request, customerNumber, lines, now }: OfferInput): Offer {
  const offerLines = lines.map((built) => built.line);
  const delivering = offerLines.filter((line) => line.quantity > 0);
  const orderBy = latest(delivering.map((l) => l.availability.orderBy), (a, b) => Date.parse(a) < Date.parse(b));
  const cap = now.getTime() + VALIDITY_MS;
  const expiresAt = orderBy && Date.parse(orderBy) < cap ? new Date(Date.parse(orderBy)) : new Date(cap);
  const issuedAt = now.toISOString();
  return {
    id: newId("off_"),
    issuer: ISSUER,
    customerNumber,
    issuedAt,
    expiresAt: expiresAt.toISOString(),
    intent: request.intent,
    matchConfidence: request.matchConfidence ?? "high",
    deliverBy: request.deliverBy,
    deliveryDate: latest(delivering.map((l) => l.availability.deliveryDate), (a, b) => a > b),
    orderBy,
    fulfilment: fulfilment(offerLines, request.deliverBy),
    lines: offerLines,
    totals: totals(offerLines),
    notes: lines.flatMap((built) => built.notes),
    source: { system: SOURCE_SYSTEM, pricedAt: issuedAt },
  };
}

/** Sign with the wholesaler key and keep the offer so orders can refer back to it. */
export async function issueOffer(offer: Offer, deps: Pick<OfferDeps, "trust" | "store">): Promise<SignedOffer> {
  const jws = await deps.trust.sign("supplier", offer, { typ: "offer+jwt" });
  const signed = { offer, jws };
  await deps.store.offers.put(signed);
  return signed;
}
