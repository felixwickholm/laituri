import type { Product, ProductFacts } from "@/lib/contracts";

/**
 * What the wholesaler vouches for about a product, from its product data. The carbon figure is the average of the
 * product's category, so it is named as one and never presented as a measurement of this product.
 */
export function productFacts(product: Product | undefined): ProductFacts {
  if (!product) return { labels: [] };
  return {
    ...(product.origin ? { countryOfOrigin: product.origin } : {}),
    labels: [...product.labels],
    ...(product.deliveryReliability !== undefined ? { deliveryReliability: product.deliveryReliability } : {}),
    ...(product.co2PerKg !== undefined ? { categoryAverageCo2PerKg: product.co2PerKg } : {}),
  };
}
