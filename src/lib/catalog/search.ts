import type { Product, ProductFilters, SearchHit, SearchRequest, SearchResponse } from "@/lib/contracts";
import { productFacts } from "./facts";
import { productImage } from "./images";
import { parseQuery, type ParsedQuery } from "./query";
import { rank, wordMatch, type Entry } from "./rank";
import { productText, words } from "./text";

type Confidence = SearchResponse["interpretation"]["confidence"];

export function toEntry(product: Product): Entry {
  const text = productText(product);
  return { product, text, words: words(text) };
}

function passesFilters(product: Product, claims: string[], filters: ProductFilters | undefined): boolean {
  if (!claims.every((c) => product.claims.includes(c))) return false;
  if (filters?.excludeAllergens?.some((a) => product.allergens.contains.includes(a.toLowerCase()))) return false;
  if (filters?.labels && !filters.labels.every((l) => product.labels.includes(l))) return false;
  if (filters?.categoryGroup && product.categoryGroup !== filters.categoryGroup) return false;
  if (filters?.temperature && product.temperature !== filters.temperature) return false;
  return true;
}

function describe(claims: string[], label: string): string {
  return [...claims.map((c) => c.replace(/_/g, "-")), label].join(" ");
}

interface Outcome {
  entries: Entry[];
  confidence: Confidence;
  note?: string;
  conceptUsed: boolean;
}

function byConcept(all: Entry[], parsed: ParsedQuery, accept: (e: Entry) => boolean, query: string): Outcome {
  const concept = parsed.concept!;
  const pool = all.filter((e) => e.product.concept === concept.id && accept(e));
  if (pool.length === 0) {
    return { entries: [], confidence: "low", conceptUsed: true, note: `No ${describe(parsed.claims, concept.label)} matches the request.` };
  }
  if (parsed.otherConcepts.length > 0) {
    return { entries: pool, confidence: "medium", conceptUsed: true, note: "The request names more than one product. Search for one product at a time." };
  }
  if (parsed.leftovers.length === 0) return { entries: pool, confidence: "high", conceptUsed: true };
  const narrowed = pool.filter((e) => parsed.leftovers.every((w) => wordMatch(e.words, w)));
  if (narrowed.length > 0) return { entries: narrowed, confidence: "high", conceptUsed: true };
  // Words such as "chocolate" in "milk chocolate" change the product: try the plain name match first.
  const byName = byWords(all, words(query).filter((w) => w.length >= 3), accept);
  if (byName.length > 0) {
    return { entries: byName, confidence: "medium", conceptUsed: false, note: "Matched product names word by word. Check that these are the right products." };
  }
  return {
    entries: pool,
    confidence: "medium",
    conceptUsed: true,
    note: `Showing ${concept.label}. These words were not understood: ${parsed.leftovers.join(", ")}.`,
  };
}

function byWords(all: Entry[], terms: string[], accept: (e: Entry) => boolean): Entry[] {
  if (terms.length === 0) return [];
  return all.filter((e) => accept(e) && terms.every((t) => wordMatch(e.words, t)));
}

function byName(all: Entry[], parsed: ParsedQuery, accept: (e: Entry) => boolean, query: string): Outcome {
  const terms = parsed.leftovers.filter((w) => w.length >= 3);
  if (terms.length === 0) {
    return { entries: [], confidence: "low", conceptUsed: false, note: "Say which product you need, for example milk or chicken fillet." };
  }
  const entries = byWords(all, terms, accept);
  if (entries.length === 0) {
    return { entries: [], confidence: "low", conceptUsed: false, note: `No product matches "${query.trim()}". Try another name for it.` };
  }
  const groups = new Set(entries.map((e) => e.product.categoryGroup));
  if (groups.size > 3) {
    return { entries, confidence: "low", conceptUsed: false, note: "The words match many kinds of products. Name the product type." };
  }
  return { entries, confidence: "medium", conceptUsed: false, note: "Matched product names word by word. Check that these are the right products." };
}

export function search(all: Entry[], request: SearchRequest): SearchResponse {
  const parsed = parseQuery(request.query);
  const claims = [...new Set([...parsed.claims, ...(request.filters?.claims ?? [])])];
  const accept = (e: Entry) => passesFilters(e.product, claims, request.filters);
  const outcome = parsed.concept ? byConcept(all, parsed, accept, request.query) : byName(all, parsed, accept, request.query);
  const concept = outcome.conceptUsed ? parsed.concept : undefined;
  const hits: SearchHit[] = outcome.entries
    .map((entry) => ({
      product: entry.product,
      ...rank(entry, { ...parsed, claims }, concept),
      facts: productFacts(entry.product),
      image: productImage(entry.product.id, entry.product.categoryGroup, entry.product.concept).src,
    }))
    .sort((a, b) => b.score - a.score || a.product.id.localeCompare(b.product.id))
    .slice(0, request.limit ?? 10);
  return {
    query: request.query,
    interpretation: { concept: concept?.id, claims, confidence: outcome.confidence, note: outcome.note },
    hits,
  };
}
