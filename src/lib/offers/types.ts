import type { OfferLine, Product } from "@/lib/contracts";
import type { Catalog } from "@/lib/catalog/types";
import type { Store } from "@/lib/store/types";
import type { Signer } from "@/lib/orders/types";
import type { UpstreamAvailability, UpstreamClient, UpstreamPrice } from "@/lib/valio/types";

export interface OfferDeps {
  catalog: Pick<Catalog, "get" | "substitutesFor">;
  upstream: UpstreamClient;
  trust: Signer;
  /** Offers are kept to be ordered later; orders are read for the stock they already hold. */
  store: Pick<Store, "offers" | "orders">;
  now: () => Date;
  /** The workspace audience the offer is signed for; an order in any other workspace refuses it. */
  audience: () => string;
  /** How long a new offer holds its price, in milliseconds; 15 minutes when absent or undefined. */
  offerValidityMs?: () => number | undefined;
}

export interface QuoteContext {
  customerNumber: string;
  /** The buyer the offer is made for, from the calling agent's mandate. */
  buyer: { id: string; name: string };
}

/** Live wholesaler answers for every product considered in one quote. */
export interface Market {
  prices: Map<string, UpstreamPrice>;
  /** The wholesaler's stock less what this workspace's own orders hold. */
  availability: Map<string, UpstreamAvailability>;
  /** Units this workspace's own orders hold, by product, for the date each product can be delivered. */
  held: Map<string, number>;
  now: Date;
  deliverBy: string;
}

/** An offer line plus the plain-language notes that explain it. */
export interface BuiltLine {
  line: OfferLine;
  notes: string[];
  product?: Product;
}
