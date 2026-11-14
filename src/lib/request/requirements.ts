import type { Offer, OfferLine, Product, RequestCheck, RequestCheckResult, RequestRequirement } from "@/lib/contracts";
import { shortDay } from "@/lib/agent/dates";
import { amount, displayName, euro } from "@/lib/agent/words";
import { wordMatch } from "@/lib/catalog/rank";
import { fold, productText, words as wordsOf } from "@/lib/catalog/text";
import { attributesIn, fatAttribute, type AttributeAnswer, type StatedAttribute } from "./attributes";
import type { BuyerWords } from "./words";

/** One line of an offer with the product it would deliver. */
export interface OfferedLine {
  line: OfferLine;
  /** The product delivered. */
  product?: Product;
  /** For a substitute line, the product it replaces. */
  replaced?: Product;
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

function nameOf({ line }: OfferedLine): string {
  return displayName(line.name);
}

function namesOf(lines: OfferedLine[]): string {
  return lines.map(nameOf).join(" and ") || "nothing";
}

function quoted(words: string[]): string {
  return words.map((word) => `"${word}"`).join(", ");
}

export function claimWord(claim: string): string {
  return claim.replace(/_/g, "-");
}

/** "milk" -> "dairy-free", "nuts" -> "nut-free". */
export function exclusionWord(allergen: string): string {
  if (allergen === "milk") return "dairy-free";
  return `${allergen.replace(/_/g, " ").replace(/s$/, "")}-free`;
}

export function productCheck(words: BuyerWords, lines: OfferedLine[]): RequestCheck {
  const offered = namesOf(lines);
  if (words.productId) {
    const code = words.productId;
    if (lines.every(({ line }) => line.productId === code)) return result("product", `product ${code}`, offered, "met");
    if (lines.every(({ line }) => line.productId === code || line.substituteFor?.productId === code)) {
      const substitutes = lines.filter(({ line }) => line.productId !== code);
      return result("product", `product ${code}`, `${namesOf(substitutes)} in place of product ${code}`, "substituted");
    }
    return result("product", `product ${code}`, offered, "unmet", true);
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
  // No product type in the words: the product is named by its words, so every word must be in the delivered product's names.
  if (leftovers.length === 0) return result("product", words.phrase || "no product named", offered, "unchecked");
  const named = lines.every(({ product }) => product !== undefined && leftovers.every((word) => wordMatch(wordsOf(productText(product)), word)));
  return result("product", words.phrase, offered, named ? "met" : "unchecked");
}

/** Claims the words ask for or rule out, and allergens they exclude, each held against every delivered product. */
export function claimChecks(words: BuyerWords, lines: OfferedLine[]): RequestCheck[] {
  if (lines.some(({ product }) => !product)) {
    const asked = [...words.claims.map(claimWord), ...words.negatedClaims.map((c) => `not ${claimWord(c)}`), ...words.exclusions.map(exclusionWord)];
    return asked.map((text) => result("claim", text, "no product data", "unchecked"));
  }
  const products = lines as (OfferedLine & { product: Product })[];
  const required = words.claims.map((claim) => {
    const asked = claimWord(claim);
    const lacking = products.filter(({ product }) => !product.claims.includes(claim));
    if (lacking.length === 0) return result("claim", asked, `${asked}: ${namesOf(products)}`, "met");
    return result("claim", asked, `not ${asked}: ${namesOf(lacking)}`, "unmet", true);
  });
  const ruledOut = words.negatedClaims.map((claim) => {
    const asked = `not ${claimWord(claim)}`;
    const carrying = products.filter(({ product }) => product.claims.includes(claim));
    if (carrying.length === 0) return result("claim", asked, `${asked}: ${namesOf(products)}`, "met");
    return result("claim", asked, `${claimWord(claim)}: ${namesOf(carrying)}`, "unmet", true);
  });
  return [...required, ...ruledOut, ...words.exclusions.map((allergen) => exclusionCheck(allergen, products))];
}

function exclusionCheck(allergen: string, lines: (OfferedLine & { product: Product })[]): RequestCheck {
  const asked = exclusionWord(allergen);
  const contains = lines.filter(({ product }) => product.allergens.contains.includes(allergen));
  if (contains.length) return result("claim", asked, `contains ${allergen.replace(/_/g, " ")}: ${namesOf(contains)}`, "unmet", true);
  const traces = lines.filter(({ product }) => product.allergens.mayContain.includes(allergen));
  if (traces.length) return result("claim", asked, `may contain ${allergen.replace(/_/g, " ")}: ${namesOf(traces)}`, "unmet");
  const undeclared = lines.filter(({ product }) => declaresNothing(product));
  if (undeclared.length) return result("claim", asked, `no allergen declaration: ${namesOf(undeclared)}`, "unchecked");
  return result("claim", asked, `${asked}: ${namesOf(lines)}`, "met");
}

function declaresNothing(product: Product): boolean {
  const { contains, mayContain, freeFrom } = product.allergens;
  return contains.length + mayContain.length + freeFrom.length === 0;
}

/** The brand of a product as one folded word: "Arla", else the vendor's first word. */
function brandOf(product: Product | undefined): string | undefined {
  const brand = product?.brand ?? product?.vendor.split(/\s+/)[0];
  return brand ? fold(brand) : undefined;
}

/** Words the products of the offer, or the products they replace, carry as a brand. */
function brandWords(words: string[], lines: OfferedLine[]): string[] {
  const brands = new Set(lines.flatMap(({ product, replaced }) => [brandOf(product), brandOf(replaced)]).filter(Boolean));
  return words.filter((word) => brands.has(word));
}

/**
 * A brand the words name, held against the brand delivered. Another brand on a substitute line is "substituted",
 * for the mandate's substitution rule to decide; another brand the agent chose itself is unmet.
 */
function brandCheck(brand: string, lines: OfferedLine[]): RequestCheck {
  const asked = `"${brand}"`;
  const other = lines.filter(({ product }) => brandOf(product) !== brand);
  if (other.length === 0) return result("brand", asked, `${brand} brand: ${namesOf(lines)}`, "met");
  const chosen = other.filter(({ line, replaced }) => !line.substituteFor || brandOf(replaced) !== brand);
  const offered = other.map((offered) => `${nameOf(offered)} (${offered.product?.brand ?? "another brand"})`).join(" and ");
  if (chosen.length) return result("brand", asked, `another brand: ${offered}`, "unmet");
  return result("brand", asked, `another brand of the same kind in place of ${brand}: ${offered}`, "substituted");
}

const ANSWER_RESULT: Record<AttributeAnswer, RequestCheckResult> = { yes: "met", no: "unmet", unknown: "unchecked" };
const ANSWER_ORDER: AttributeAnswer[] = ["no", "unknown", "yes"];

/** A stated attribute held against every delivered product: unmet if one lacks it, unchecked if one cannot tell. */
function attributeCheck(attribute: StatedAttribute, lines: OfferedLine[]): RequestCheck {
  const answers = lines.map((offered) => ({ offered, answer: offered.product ? attribute.has(offered.product) : ("unknown" as const) }));
  const worst = ANSWER_ORDER.find((answer) => answers.some((item) => item.answer === answer)) ?? "yes";
  const named = answers.filter((item) => item.answer === worst).map((item) => item.offered);
  const what = { yes: attribute.label, no: `not ${attribute.label}`, unknown: `${attribute.label} not stated` }[worst];
  return result("attribute", attribute.label, `${what}: ${namesOf(named)}`, ANSWER_RESULT[worst]);
}

/**
 * Words of the product phrase beyond product type and claims: a brand, a stated attribute (UHT or chilled, fat
 * level, pack type) and any other word, each held against the product that would be delivered.
 */
export function wordChecks(words: BuyerWords, lines: OfferedLine[]): RequestCheck[] {
  const { leftovers, concept, fat } = words.query;
  const brands = brandWords(leftovers, lines);
  const { attributes, rest } = attributesIn(leftovers.filter((word) => !brands.includes(word)));
  const stated = fat ? [fatAttribute(fat), ...attributes] : attributes;
  const checks = [...brands.map((brand) => brandCheck(brand, lines)), ...stated.map((attribute) => attributeCheck(attribute, lines))];
  // Without a product type or code the product check already holds the phrase's words against the names.
  const named = concept || words.productId ? rest : [];
  const wording = otherWordsCheck(named, words.unexplained, lines);
  return wording ? [...checks, wording] : checks;
}

/** Other words of the phrase must be in the delivered product's names; words elsewhere that no rule explained are not checked. */
function otherWordsCheck(phraseWords: string[], unexplained: string[], lines: OfferedLine[]): RequestCheck | undefined {
  if (phraseWords.length === 0 && unexplained.length === 0) return undefined;
  const asked = quoted([...phraseWords, ...unexplained]);
  if (lines.some(({ product }) => !product)) return result("wording", asked, "no product data", "unchecked");
  const missing = [...new Set(lines.flatMap(({ product }) => phraseWords.filter((word) => !wordMatch(wordsOf(productText(product!)), word))))];
  const open = [...missing, ...unexplained];
  if (open.length === 0) return result("wording", asked, `in the name of ${namesOf(lines)}`, "met");
  return result("wording", asked, `${quoted(open)} not understood`, "unchecked");
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
