import type { OfferLine } from "@/lib/contracts";
import type { Market } from "./types";

/** Stock that earlier lines of one offer already took, by product, so a later line sees only what is left. */
export interface StockLedger {
  claim(lines: OfferLine[]): void;
  /** The market as the next line sees it: each product's available units less what earlier lines took. */
  view(): Market;
}

export function stockLedger(market: Market): StockLedger {
  const claimed = new Map<string, number>();
  return {
    claim(lines) {
      for (const line of lines) claimed.set(line.productId, (claimed.get(line.productId) ?? 0) + line.quantity);
    },
    view() {
      if (claimed.size === 0) return market;
      const availability = new Map(market.availability);
      for (const [productId, units] of claimed) {
        const stock = availability.get(productId);
        // An untracked limit (Infinity) stays untracked.
        if (stock && Number.isFinite(stock.available)) availability.set(productId, { ...stock, available: Math.max(0, stock.available - units) });
      }
      return { ...market, availability };
    },
  };
}
