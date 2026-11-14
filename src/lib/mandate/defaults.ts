import type { Mandate } from "@/lib/contracts";
import { now } from "@/lib/clock";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Buyer organisation ids (OVT e-invoice addresses) of the three demo buyers. */
export const BUYER_IDS = {
  nordicHarbour: "fi:ovt:003712345678",
  kaisla: "fi:ovt:003723456789",
  laine: "fi:ovt:003734567890",
} as const;

/** The buyer a call means when it names none: every route, scene and eval that predates several buyers. */
export const PRIMARY_BUYER_ID = BUYER_IDS.nordicHarbour;

type Terms = Omit<Mandate, "version" | "supplier" | "validFrom" | "validUntil">;

/** The mock API knows one customer, so every demo buyer trades under it; the signed buyer id keeps them apart. */
function customerNumber(): string {
  return process.env.VALIO_CUSTOMER ?? "123";
}

function nordicHarbour(): Terms {
  return {
    id: "mandate:nordic-harbour:purchasing",
    buyer: { id: BUYER_IDS.nordicHarbour, name: "Nordic Harbour Hotels", customerNumber: customerNumber() },
    agent: { id: "agent:harbour-purchasing", name: "Harbour purchasing agent" },
    limits: {
      perOrder: { amount: 1500, currency: "EUR" },
      perWeek: { amount: 5000, currency: "EUR" },
    },
    categories: {
      allowed: ["dairy", "cheese", "bakery", "produce", "dry_goods", "beverages", "eggs", "plant_based"],
    },
    dietary: {
      excludeAllergens: ["peanut", "nuts"],
      blockMayContain: false,
      requiredClaims: [],
    },
    substitution: { policy: "like_for_like", maxPriceIncreasePct: 10 },
    delivery: { allowPartial: false, maxDelayDays: 1 },
    approval: {
      approver: { id: "user:maria.lind", name: "Maria Lind, Head of Purchasing" },
      firstTimeProducts: false,
      requireRequestWords: true,
    },
  };
}

/** Municipal school kitchens: lower limits, no nuts or sesame even as traces, and lunch must arrive on the day. */
function kaisla(): Terms {
  return {
    id: "mandate:kaisla-school-kitchens:menu",
    buyer: { id: BUYER_IDS.kaisla, name: "Kaisla School Kitchens", customerNumber: customerNumber() },
    agent: { id: "agent:kaisla-menu-planner", name: "Kaisla menu planner" },
    limits: {
      perOrder: { amount: 800, currency: "EUR" },
      perWeek: { amount: 3000, currency: "EUR" },
    },
    categories: {
      allowed: ["dairy", "cheese", "bakery", "produce", "dry_goods", "eggs", "plant_based", "fish", "meat", "fats_oils"],
    },
    dietary: {
      excludeAllergens: ["peanut", "nuts", "sesame"],
      blockMayContain: true,
      requiredClaims: [],
    },
    substitution: { policy: "like_for_like", maxPriceIncreasePct: 5 },
    delivery: { allowPartial: false, maxDelayDays: 0 },
    approval: {
      approver: { id: "user:antti.korhonen", name: "Antti Korhonen, Food Service Manager" },
      firstTimeProducts: false,
      requireRequestWords: true,
    },
  };
}

/** A 60-seat restaurant: small limits, no substitutes, and the owner sees every product the first time. */
function laine(): Terms {
  return {
    id: "mandate:ravintola-laine:kitchen",
    buyer: { id: BUYER_IDS.laine, name: "Ravintola Laine", customerNumber: customerNumber() },
    agent: { id: "agent:laine-kitchen-assistant", name: "Laine kitchen assistant" },
    limits: {
      perOrder: { amount: 400, currency: "EUR" },
      perWeek: { amount: 1200, currency: "EUR" },
    },
    categories: {
      allowed: ["dairy", "cheese", "bakery", "produce", "dry_goods", "eggs", "plant_based", "fish", "meat", "fats_oils", "coffee_tea", "baking_spices"],
    },
    dietary: {
      excludeAllergens: [],
      blockMayContain: false,
      requiredClaims: [],
    },
    substitution: { policy: "none", maxPriceIncreasePct: 0 },
    delivery: { allowPartial: true, maxDelayDays: 1 },
    approval: {
      approver: { id: "user:sofia.laine", name: "Sofia Laine, Owner" },
      firstTimeProducts: true,
      requireRequestWords: true,
    },
  };
}

const TERMS: Record<string, () => Terms> = {
  [BUYER_IDS.nordicHarbour]: nordicHarbour,
  [BUYER_IDS.kaisla]: kaisla,
  [BUYER_IDS.laine]: laine,
};

/** Every demo buyer id, primary first. */
export function buyerIds(): string[] {
  return Object.keys(TERMS);
}

export function isKnownBuyer(buyerId: string): boolean {
  return buyerId in TERMS;
}

/** A demo buyer's id and name. A mandate change cannot alter either. */
export function buyerParty(buyerId: string = PRIMARY_BUYER_ID): { id: string; name: string } {
  const { buyer } = defaultMandate(buyerId);
  return { id: buyer.id, name: buyer.name };
}

/** A demo buyer's standing authority, valid 15 days either side of now. */
export function defaultMandate(buyerId: string = PRIMARY_BUYER_ID): Mandate {
  const terms = TERMS[buyerId];
  if (!terms) throw new Error(`No demo buyer has the id ${buyerId}.`);
  const at = now().getTime();
  return {
    ...terms(),
    version: 1,
    supplier: "Valio Aimo",
    validFrom: new Date(at - 15 * DAY_MS).toISOString(),
    validUntil: new Date(at + 15 * DAY_MS).toISOString(),
  };
}
