import type { Product } from "@/lib/contracts";
import { assignConcept } from "../lexicon";
import { fold } from "../text";
import { contentOf } from "./content";
import { categoryGroup } from "./groups";
import { rawName, type RawProduct } from "./raw-product";
import { allergensOf, claimsOf, labelsOf, temperatureOf } from "./vocabulary";

export interface ProductExtras {
  co2PerKg?: number;
  deliveryReliability?: number;
}

/** Units sold by weight may be ordered in fractions; for everything else a lot below one means "any whole unit". */
function lotSize(raw: RawProduct): number {
  const lot = raw.allowedLotSize ?? 1;
  if (raw.salesUnit === "KG") return lot > 0 ? lot : 0.01;
  return lot >= 1 ? lot : 1;
}

function origin(raw: RawProduct): string | undefined {
  const code = raw.countryOfOrigin?.trim();
  return code && /^[a-z]{2}$/i.test(code) ? code.toUpperCase() : undefined;
}

/** Turns one record of the wholesaler's product download into the slim, agent-readable product. */
export function toProduct(raw: RawProduct, extras: ProductExtras = {}): Product {
  const en = rawName(raw, "en");
  const fi = rawName(raw, "fi");
  const sv = rawName(raw, "sv");
  const name = { en: en ?? fi ?? sv ?? raw.id, fi: fi ?? en ?? sv ?? raw.id, ...(sv ? { sv } : {}) };
  const text = fold([name.en, name.fi, name.sv ?? ""].join(" | "));
  const group = categoryGroup(raw.category);
  const claims = claimsOf(raw, text);
  const substitutes = [...new Set((raw.substitutions ?? []).map((s) => s.substituteProduct))].filter((id) => id !== raw.id);
  const brand = raw.synkkaData.brand?.trim();
  return {
    id: raw.id,
    gtin: raw.salesUnitGtin || raw.synkkaData.gtin || undefined,
    name,
    brand: brand || undefined,
    vendor: raw.vendorName,
    category: raw.category,
    categoryGroup: group,
    concept: assignConcept(text, raw.category),
    origin: origin(raw),
    salesUnit: raw.salesUnit,
    baseUnit: raw.baseUnit,
    units: raw.units.map((u) => ({ unit: u.unitId, ...(u.gtin ? { gtin: u.gtin } : {}), sizeInBaseUnits: u.sizeInBaseUnits })),
    lotSize: lotSize(raw),
    content: contentOf(raw, name.en, group !== "non_food"),
    temperature: temperatureOf(raw),
    allergens: allergensOf(raw, claims, text),
    claims,
    labels: labelsOf(raw),
    substitutes,
    co2PerKg: extras.co2PerKg,
    deliveryReliability: extras.deliveryReliability,
  };
}
