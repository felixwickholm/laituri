import type { Product } from "@/lib/contracts";

/** Lower case, trademark signs removed, decimal commas turned into points. */
export function fold(text: string): string {
  return text
    .toLowerCase()
    .replace(/[®™©]/g, "")
    .replace(/(\d),(\d)/g, "$1.$2")
    .replace(/\s+/g, " ")
    .trim();
}

/** All names of a product in one searchable string. */
export function productText(product: Pick<Product, "name">): string {
  return fold([product.name.en, product.name.fi, product.name.sv ?? ""].join(" | "));
}

/** Words of a query: letters and digits only, hyphens split words ("lactose-free" -> "lactose free"). */
export function words(text: string): string[] {
  return fold(text)
    .replace(/[^\p{L}\p{N}.%]+/gu, " ")
    .split(" ")
    .map((w) => w.replace(/^\.+|\.+$/g, ""))
    .filter(Boolean);
}

export function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
