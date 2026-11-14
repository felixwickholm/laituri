import type { Product, Quantity } from "@/lib/contracts";
import { parseRequest } from "@/lib/agent/parse-request";
import { parseQuery, type ParsedQuery } from "@/lib/catalog/query";
import { wordMatch } from "@/lib/catalog/rank";
import { productText, words as wordsOf } from "@/lib/catalog/text";

/** Everything in a buyer's words that an offer can be held to. */
export interface BuyerWords {
  quantity?: Quantity;
  /** The latest delivery date, only when the words state one. */
  deliverBy?: string;
  /** The most the buyer will pay, in euros. */
  budget?: number;
  waitForPerson: boolean;
  /** A wholesaler product code named in the words. */
  productId?: string;
  /** The product in the buyer's words. */
  phrase: string;
  /** The product words as the catalogue reads them: concept, claims and the words no rule explained. */
  query: ParsedQuery;
  /** Claims named anywhere in the words, the purpose included ("for the vegan breakfast"). */
  claims: string[];
}

/** Reads the buyer's words as they stood at `at`, so "by Monday" means the Monday after the quote. */
export function readBuyerWords(text: string, at: Date): BuyerWords {
  const parsed = parseRequest(text, at);
  const query = parseQuery(parsed.phrase);
  const purposeClaims = parsed.purpose ? parseQuery(parsed.purpose).claims : [];
  return {
    quantity: parsed.quantity,
    deliverBy: parsed.deliverByStated ? parsed.deliverBy : undefined,
    budget: parsed.budget,
    waitForPerson: parsed.waitForPerson,
    productId: parsed.productId,
    phrase: parsed.phrase,
    query,
    claims: [...new Set([...query.claims, ...purposeClaims])],
  };
}

/** Words of the request that a product's names do not contain, for example a brand the product is not. */
export function unexplainedWords(words: BuyerWords, product: Pick<Product, "name">): string[] {
  const names = wordsOf(productText(product));
  return words.query.leftovers.filter((word) => !wordMatch(names, word));
}
