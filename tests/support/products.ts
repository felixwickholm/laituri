import type { Product } from "@/lib/contracts";
import type { UpstreamAvailability, UpstreamPrice } from "@/lib/valio/types";

export const NOW = "2026-11-14T09:00:00+02:00";
export const DELIVER_BY = "2026-11-16";
const MONDAY = "2026-11-16";
const CUTOFF = "2026-11-14T14:00:00+02:00";

interface Spec {
  id: string;
  en: string;
  brand: string;
  concept: string;
  claims?: string[];
  contains?: string[];
  labels?: string[];
  salesUnit?: string;
  lotSize?: number;
  content?: Product["content"];
  reliability?: number;
  categoryGroup?: string;
}

function product(spec: Spec): Product {
  return {
    id: spec.id,
    name: { en: spec.en, fi: spec.en },
    brand: spec.brand,
    vendor: spec.brand === "Arla" ? "Arla Oy" : "Valio Oy",
    category: "10400",
    categoryGroup: spec.categoryGroup ?? "dairy",
    concept: spec.concept,
    origin: "FI",
    salesUnit: spec.salesUnit ?? "ST",
    baseUnit: "ST",
    units: [],
    lotSize: spec.lotSize ?? 1,
    content: spec.content ?? { amount: 1, unit: "l" },
    temperature: "chilled",
    allergens: { contains: spec.contains ?? ["milk"], mayContain: [], freeFrom: [] },
    claims: spec.claims ?? ["lactose_free"],
    labels: spec.labels ?? [],
    substitutes: [],
    deliveryReliability: spec.reliability,
  };
}

export const PRODUCTS: Product[] = [
  product({ id: "464306", en: "Valio Eila 1 l", brand: "Valio", concept: "lactose_free_milk", reliability: 0.95 }),
  product({ id: "464401", en: "Arla Lactose Free Milk 1 l", brand: "Arla", concept: "lactose_free_milk", reliability: 0.99 }),
  product({ id: "463335", en: "Valio Organic Eila 1 l", brand: "Valio", concept: "lactose_free_milk", labels: ["eu_organic"], reliability: 0.9 }),
  product({ id: "462775", en: "Valio Eila Fat Free UHT 1 l", brand: "Valio", concept: "lactose_free_milk", reliability: 0.97 }),
  product({ id: "465039", en: "Valio Eila 5 x 1 l", brand: "Valio", concept: "lactose_free_milk", salesUnit: "KI", content: { amount: 5, unit: "l" } }),
  product({ id: "464073", en: "Almond Milk Drink 1 l", brand: "Valio", concept: "lactose_free_milk", contains: ["milk", "nuts"] }),
  product({ id: "464398", en: "Valio Milk 1 l", brand: "Valio", concept: "milk", claims: [] }),
  product({ id: "470001", en: "Valio Butter 500 g", brand: "Valio", concept: "butter", claims: [], lotSize: 4, content: { amount: 0.5, unit: "kg" } }),
];

function price(productId: string, net: number, comparison: number, per: "l" | "kg" = "l"): UpstreamPrice {
  return { productId, found: true, net, taxRate: 13.5, comparison: { amount: comparison, per }, contractPrice: true };
}

function stock(productId: string, available: number, extra: Partial<UpstreamAvailability> = {}): UpstreamAvailability {
  return {
    productId,
    deliverable: true,
    salesBlock: false,
    logisticModel: "Stock",
    available,
    availableDate: MONDAY,
    orderBy: CUTOFF,
    ...extra,
  };
}

export const PRICES: UpstreamPrice[] = [
  price("464306", 1.01, 1.01),
  price("464401", 1.05, 1.05),
  price("463335", 1.4, 1.4),
  price("462775", 0.99, 0.99),
  price("465039", 5, 1),
  price("464073", 0.8, 0.8),
  price("464398", 0.9, 0.9),
  price("470001", 4, 8, "kg"),
];

export const AVAILABILITY: UpstreamAvailability[] = [
  stock("464306", Infinity),
  stock("464401", Infinity),
  stock("463335", 5000),
  stock("462775", 51),
  stock("465039", Infinity, { logisticModel: "Terminal", orderBy: "2026-11-12T12:00:00+02:00" }),
  stock("464073", Infinity),
  stock("464398", Infinity),
  stock("470001", 500),
];
