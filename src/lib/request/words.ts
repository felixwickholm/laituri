import type { Product, Quantity } from "@/lib/contracts";
import { parseRequest } from "@/lib/agent/parse-request";
import { parseQuery, type ParsedQuery } from "@/lib/catalog/query";
import { wordMatch } from "@/lib/catalog/rank";
import { productText, words as wordsOf } from "@/lib/catalog/text";
import { isHarmless } from "./harmless";

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
  /** Claims the words rule out anywhere: "not lactose-free". */
  negatedClaims: string[];
  /** Allergens the words exclude anywhere: "for a dairy-free breakfast" excludes milk. */
  exclusions: string[];
  /** Words outside the product phrase that no rule explained and that are not known to be harmless. */
  unexplained: string[];
}

const unique = (values: string[]) => [...new Set(values)];

/** Reads the buyer's words as they stood at `at`, so "by Monday" means the Monday after the quote. */
export function readBuyerWords(text: string, at: Date): BuyerWords {
  const parsed = parseRequest(text, at);
  const query = parseQuery(parsed.phrase);
  // The purpose and every other clause are read for requirements too; what they say beyond that must be harmless.
  const purpose = parsed.purpose ? [parseQuery(parsed.purpose)] : [];
  const clauses = parsed.otherClauses.map(parseQuery);
  const all = [query, ...purpose, ...clauses];
  return {
    quantity: parsed.quantity,
    deliverBy: parsed.deliverByStated ? parsed.deliverBy : undefined,
    budget: parsed.budget,
    waitForPerson: parsed.waitForPerson,
    productId: parsed.productId,
    phrase: parsed.phrase,
    query,
    claims: unique(all.flatMap((part) => part.claims)),
    negatedClaims: unique(all.flatMap((part) => part.negatedClaims)),
    exclusions: unique(all.flatMap((part) => part.exclusions)),
    unexplained: unique([...purpose.flatMap((part) => unexplainedIn(part, false)), ...clauses.flatMap((part) => unexplainedIn(part, true))]),
  };
}

/**
 * Words of a purpose or another clause that are neither a requirement nor harmless. A product type in a purpose is
 * the dish ("for the pasta bake"); in another clause it may be a second order line, which is not understood.
 */
function unexplainedIn(part: ParsedQuery, productTypesCount: boolean): string[] {
  const named = productTypesCount && part.concept ? [part.concept.label, ...part.otherConcepts] : [];
  return [...named, ...part.leftovers.filter((word) => !isHarmless(word))];
}

/** Words of the request that a product's names do not contain, for example a brand the product is not. */
export function unexplainedWords(words: BuyerWords, product: Pick<Product, "name">): string[] {
  const names = wordsOf(productText(product));
  return words.query.leftovers.filter((word) => !wordMatch(names, word));
}
