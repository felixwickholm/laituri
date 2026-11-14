/**
 * The most product ids one request may send to the wholesaler's price and availability APIs. Search runs on the local
 * product files; only the best hits of a search, and only a quoted product with its closest substitutes, are asked.
 * The APIs are never asked for the whole catalogue.
 */
export const UPSTREAM_ID_CAP = {
  /** Hits of one search that get a live price and stock preview. */
  search: 10,
  /** Ids per quoted line: the product asked for and its twelve closest substitutes. */
  quoteLine: 13,
} as const;
