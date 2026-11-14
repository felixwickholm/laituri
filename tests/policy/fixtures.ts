import type { Mandate, Offer, OfferLine, Product } from "@/lib/contracts";
import type { EvaluateInput } from "@/lib/policy";

export const NOW = new Date("2026-11-14T09:00:00+02:00");

export function mandate(patch: Partial<Mandate> = {}): Mandate {
  return {
    id: "mandate:test",
    version: 1,
    buyer: { id: "fi:ovt:003712345678", name: "Nordic Harbour Hotels", customerNumber: "123" },
    agent: { id: "agent:harbour-purchasing", name: "Harbour purchasing agent" },
    supplier: "Valio Aimo",
    validFrom: "2026-11-01T00:00:00.000Z",
    validUntil: "2026-11-30T00:00:00.000Z",
    limits: { perOrder: { amount: 1500, currency: "EUR" }, perWeek: { amount: 5000, currency: "EUR" } },
    categories: { allowed: ["dairy", "bakery"] },
    dietary: { excludeAllergens: ["peanut", "nuts"], blockMayContain: false, requiredClaims: [] },
    substitution: { policy: "like_for_like", maxPriceIncreasePct: 10 },
    delivery: { allowPartial: false, maxDelayDays: 1 },
    approval: { approver: { id: "user:maria.lind", name: "Maria Lind" }, firstTimeProducts: false },
    ...patch,
  };
}

export function line(patch: Partial<OfferLine> = {}): OfferLine {
  return {
    productId: "464306",
    name: "Valio Arki lactose-free milk drink 1 l",
    categoryGroup: "dairy",
    quantity: 100,
    salesUnit: "ST",
    unitPrice: { amount: 1.01, currency: "EUR" },
    taxRate: 13.5,
    lineNet: { amount: 101, currency: "EUR" },
    availability: { status: "available", requested: 100, available: 100, deliveryDate: "2026-11-16" },
    ...patch,
  };
}

export function offer(patch: Partial<Offer> = {}, lines: OfferLine[] = [line()]): Offer {
  const net = patch.totals?.net.amount ?? 101;
  return {
    id: "offer-1",
    issuer: "Valio Aimo",
    customerNumber: "123",
    buyer: { id: "fi:ovt:003712345678", name: "Nordic Harbour Hotels" },
    issuedAt: "2026-11-14T06:55:00.000Z",
    expiresAt: "2026-11-14T07:10:00.000Z",
    matchConfidence: "high",
    deliverBy: "2026-11-16",
    deliveryDate: "2026-11-16",
    fulfilment: "full",
    lines,
    totals: { net: { amount: net, currency: "EUR" }, tax: { amount: 0, currency: "EUR" }, gross: { amount: net, currency: "EUR" } },
    notes: [],
    source: { system: "test", pricedAt: "2026-11-14T06:55:00.000Z" },
    ...patch,
  };
}

export function product(patch: Partial<Product> = {}): Product {
  return {
    id: "464306",
    name: { en: "Milk drink", fi: "Maitojuoma" },
    vendor: "Valio",
    category: "10400",
    categoryGroup: "dairy",
    salesUnit: "ST",
    baseUnit: "ST",
    units: [],
    lotSize: 1,
    allergens: { contains: ["milk"], mayContain: [], freeFrom: [] },
    claims: ["lactose_free"],
    labels: [],
    substitutes: [],
    ...patch,
  };
}

export function input(over: {
  mandate?: Mandate;
  offer?: Offer;
  products?: Product[];
  mandateValid?: boolean;
  offerValid?: boolean;
  agentId?: string;
  weekSpendNet?: number;
  ordered?: string[];
} = {}): EvaluateInput {
  const products = over.products ?? [product()];
  return {
    mandate: over.mandateValid === false ? { valid: false, reason: "The mandate signature is not valid." } : { valid: true, mandate: over.mandate ?? mandate() },
    offer: over.offerValid === false ? { valid: false, reason: "The offer signature is not valid." } : { valid: true, offer: over.offer ?? offer() },
    products: new Map(products.map((p) => [p.id, p])),
    agentId: over.agentId ?? "agent:harbour-purchasing",
    weekSpendNet: over.weekSpendNet ?? 0,
    orderedProductIds: new Set(over.ordered ?? ["464306"]),
    now: NOW,
  };
}
