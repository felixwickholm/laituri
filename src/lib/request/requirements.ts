import type { Offer, OfferLine, Product, RequestCheck, RequestCheckResult, RequestRequirement } from "@/lib/contracts";
import { shortDay } from "@/lib/agent/dates";
import { amount, displayName, euro } from "@/lib/agent/words";
import { unexplainedWords, type BuyerWords } from "./words";

/** One line of an offer with the products behind it. */
export interface OfferedLine {
  line: OfferLine;
  product?: Product;
  /** The product the words named: for a substitute, the product it replaces. */
  named?: Product;
}

/** Tolerance for sums of litres and kilograms. */
const EPSILON = 1e-6;

function result(
  requirement: RequestRequirement,
  asked: string,
  offered: string,
  outcome: RequestCheckResult,
  certain = false,
): RequestCheck {
  return { requirement, asked, offered, result: outcome, certain: outcome === "unmet" && certain };
}

function namesOf(lines: OfferedLine[]): string {
  return lines.map(({ line }) => displayName(line.name)).join(" and ") || "nothing";
}

export function claimWord(claim: string): string {
  return claim.replace(/_/g, "-");
}

export function productCheck(words: BuyerWords, lines: OfferedLine[]): RequestCheck {
  const offered = namesOf(lines);
  if (words.productId) {
    const code = words.productId;
    const same = lines.every(({ line }) => line.productId === code || line.substituteFor?.productId === code);
    return result("product", `product ${code}`, offered, same ? "met" : "unmet", true);
  }
  const { concept, otherConcepts, leftovers } = words.query;
  if (concept && otherConcepts.length > 0) {
    return result("product", `${concept.label} and ${otherConcepts.join(", ").replace(/_/g, " ")}`, offered, "unchecked");
  }
  if (concept) {
    const other = lines.find(({ product }) => product?.concept !== concept.id);
    if (!other) return result("product", concept.label, offered, "met");
    return result("product", concept.label, offered, other.product?.concept ? "unmet" : "unchecked", true);
  }
  // No product type in the words: the product is named by its words, so every word must be in its names.
  if (leftovers.length === 0) return result("product", words.phrase || "no product named", offered, "unchecked");
  const named = lines.every(({ named }) => named !== undefined && unexplainedWords(words, named).length === 0);
  return result("product", words.phrase, offered, named ? "met" : "unchecked");
}

export function claimChecks(words: BuyerWords, lines: OfferedLine[]): RequestCheck[] {
  return words.claims.map((claim) => {
    const asked = claimWord(claim);
    if (lines.some(({ product }) => !product)) return result("claim", asked, "no product data", "unchecked");
    const lacking = lines.filter(({ product }) => !product?.claims.includes(claim));
    if (lacking.length === 0) return result("claim", asked, asked, "met");
    return result("claim", asked, `not ${asked}: ${namesOf(lacking)}`, "unmet", true);
  });
}

/** Words the catalogue could not explain, checked against the product names. Only when a product type or code was named. */
export function wordingCheck(words: BuyerWords, lines: OfferedLine[]): RequestCheck | undefined {
  const { leftovers, concept } = words.query;
  if (leftovers.length === 0 || (!concept && !words.productId)) return undefined;
  const asked = leftovers.map((word) => `"${word}"`).join(", ");
  if (lines.some(({ named }) => !named)) return result("wording", asked, "no product data", "unchecked");
  const missing = [...new Set(lines.flatMap(({ named }) => unexplainedWords(words, named!)))];
  if (missing.length === 0) return result("wording", asked, `in the name of ${namesOf(lines)}`, "met");
  return result("wording", asked, `${missing.map((word) => `"${word}"`).join(", ")} not understood`, "unchecked");
}

/** Litres, kilos or sales units in one sales unit of the line, as the words count them. */
function perUnit({ line, product }: OfferedLine, unit: "l" | "kg" | "sales_unit"): number | undefined {
  if (unit === "sales_unit") return 1;
  if (line.content?.unit === unit && line.quantity > 0) return line.content.amount / line.quantity;
  return product?.content?.unit === unit ? product.content.amount : undefined;
}

function quantityText(value: number, unit: "l" | "kg" | "sales_unit"): string {
  return `${amount(Math.round(value * 1000) / 1000)} ${unit === "sales_unit" ? "units" : unit}`;
}

/**
 * The offer covers the need and runs over by at most one lot. Too little is certain, and refused, when the agent
 * itself asked for less than half the need; a shortfall in stock goes to a person.
 */
export function quantityCheck(words: BuyerWords, lines: OfferedLine[]): RequestCheck | undefined {
  const need = words.quantity;
  if (!need) return undefined;
  const asked = quantityText(need.amount, need.unit);
  const sizes = lines.map((offered) => perUnit(offered, need.unit));
  if (sizes.some((size) => size === undefined)) return result("quantity", asked, "not convertible to the asked unit", "unchecked");
  const sum = (units: (offered: OfferedLine) => number) => lines.reduce((total, offered, i) => total + units(offered) * sizes[i]!, 0);
  const offered = sum(({ line }) => line.quantity);
  const requested = sum(({ line }) => line.availability.requested);
  const lot = Math.max(0, ...lines.map((offered, i) => (offered.product?.lotSize || 1) * sizes[i]!));
  const offeredText = quantityText(offered, need.unit);
  if (offered >= need.amount - EPSILON && offered - need.amount <= lot + EPSILON) return result("quantity", asked, offeredText, "met");
  if (offered > need.amount) return result("quantity", asked, `${offeredText}, more than one lot over`, "unmet");
  const farTooLittle = requested < need.amount / 2 - EPSILON;
  return result("quantity", asked, offeredText, "unmet", farTooLittle);
}

export function dateCheck(words: BuyerWords, offer: Pick<Offer, "deliveryDate">): RequestCheck | undefined {
  if (!words.deliverBy) return undefined;
  const asked = `by ${shortDay(words.deliverBy)}`;
  if (!offer.deliveryDate) return result("date", asked, "no delivery date", "unchecked");
  return result("date", asked, shortDay(offer.deliveryDate), offer.deliveryDate <= words.deliverBy ? "met" : "unmet");
}

/** A ceiling in euros is held against the total with VAT, the most the buyer pays. */
export function budgetCheck(words: BuyerWords, offer: Pick<Offer, "totals">): RequestCheck | undefined {
  if (words.budget === undefined) return undefined;
  const gross = offer.totals.gross.amount;
  return result("budget", `at most ${euro(words.budget)}`, `${euro(gross)} with VAT`, gross <= words.budget + 0.005 ? "met" : "unmet");
}

export function approvalCheck(words: BuyerWords): RequestCheck | undefined {
  if (!words.waitForPerson) return undefined;
  return result("approval", "a person approves before ordering", "an order the agent could place alone", "unmet");
}
