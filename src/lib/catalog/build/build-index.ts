import { Product } from "@/lib/contracts";
import type { RawProduct } from "./raw-product";
import { toProduct } from "./to-product";

/** Reads a two-column "productId,value" CSV into a map. The header row and blank values are skipped. */
export function parseValueCsv(csv: string): Map<string, number> {
  const out = new Map<string, number>();
  for (const line of csv.split(/\r?\n/).slice(1)) {
    const [id, value] = line.split(",");
    const number = Number(value);
    if (id && value?.trim() && Number.isFinite(number)) out.set(id.trim(), number);
  }
  return out;
}

export interface BuildInput {
  products: RawProduct[];
  reliabilityCsv: string;
  carbonCsv: string;
}

/** Builds the slim index and checks every record against the Product contract. */
export function buildIndex({ products, reliabilityCsv, carbonCsv }: BuildInput): Product[] {
  const reliability = parseValueCsv(reliabilityCsv);
  const carbon = parseValueCsv(carbonCsv);
  return products
    .filter((raw) => !raw.deleted)
    .map((raw) =>
      Product.parse(
        toProduct(raw, { deliveryReliability: reliability.get(raw.id), co2PerKg: carbon.get(raw.id) }),
      ),
    );
}
