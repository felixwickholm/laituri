import type { DemandOutcome, Quantity } from "@/lib/contracts";

export type { DemandOutcome };

/** One catalogue search or quote, as the wholesaler received it. Records are only ever appended. */
export interface DemandRecord {
  id: string;
  /** A search and the quotes that follow it for the same product type share one request id. */
  requestId: string;
  at: string;
  kind: "search" | "quote";
  buyer?: { id: string; name: string };
  agent: { id: string; name: string };
  client: string;
  /** The buyer's words: the search query, or the quote's intent. A quote sent without an intent has none. */
  words?: string;
  concept?: string;
  /** The products a search found, or the products a quote priced. */
  productIds: string[];
  quantity?: Quantity;
  deliverBy?: string;
  outcome: DemandOutcome;
  /** The primary offer a quote produced. */
  offerId?: string;
  /** Net EUR the wholesaler could not sell, when a price is known. */
  lostNet?: number;
  seeded?: true;
}
