import type { Mandate } from "@/lib/contracts";
import { now } from "@/lib/clock";

const DAY_MS = 24 * 60 * 60 * 1000;

/** The demo buyer's standing authority, valid 15 days either side of now. */
export function defaultMandate(): Mandate {
  const at = now().getTime();
  return {
    id: "mandate:nordic-harbour:purchasing",
    version: 1,
    buyer: {
      id: "fi:ovt:003712345678",
      name: "Nordic Harbour Hotels",
      customerNumber: process.env.VALIO_CUSTOMER ?? "123",
    },
    agent: { id: "agent:harbour-purchasing", name: "Harbour purchasing agent" },
    supplier: "Valio Aimo",
    validFrom: new Date(at - 15 * DAY_MS).toISOString(),
    validUntil: new Date(at + 15 * DAY_MS).toISOString(),
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
    },
  };
}
