import type { Offer, Product, RequestCheck } from "@/lib/contracts";
import {
  approvalCheck,
  budgetCheck,
  claimChecks,
  dateCheck,
  productCheck,
  quantityCheck,
  wordChecks,
  type OfferedLine,
} from "./requirements";
import type { BuyerWords } from "./words";

export { readBuyerWords, unexplainedWords, type BuyerWords } from "./words";
export type { OfferedLine } from "./requirements";

/**
 * The wholesaler's comparison of the buyer's words with one offer: product, every claim and exclusion, brand,
 * stated attributes, other words, quantity, date, budget and an order to wait, each held against the products the
 * offer would deliver. Lines that deliver nothing are left out.
 */
export function checkRequest(words: BuyerWords, offer: Pick<Offer, "deliveryDate" | "totals">, lines: OfferedLine[]): RequestCheck[] {
  const delivering = lines.filter(({ line }) => line.quantity > 0);
  const compared = delivering.length > 0 ? delivering : lines;
  return [
    productCheck(words, compared),
    ...claimChecks(words, compared),
    ...wordChecks(words, compared),
    quantityCheck(words, lines),
    dateCheck(words, offer),
    budgetCheck(words, offer),
    approvalCheck(words),
  ].filter((check): check is RequestCheck => check !== undefined);
}

const LABEL: Record<RequestCheck["requirement"], string> = {
  product: "Product",
  claim: "Claim",
  brand: "Brand",
  attribute: "Attribute",
  wording: "Other words",
  quantity: "Quantity",
  date: "Delivery date",
  budget: "Budget",
  approval: "Approval",
};

/** "Budget: asked at most €50.00, offered €88.20 with VAT". */
export function describeCheck(check: RequestCheck): string {
  const answer = check.result === "unchecked" ? `not checked (${check.offered})` : `offered ${check.offered}`;
  return `${LABEL[check.requirement]}: asked ${check.asked}, ${answer}`;
}

/** The product each line would deliver and, for a substitute, the product it replaces. */
export function offeredLines(lines: { line: OfferedLine["line"]; product?: Product }[], get: (id: string) => Product | undefined): OfferedLine[] {
  return lines.map(({ line, product }) => {
    const replaced = line.substituteFor ? get(line.substituteFor.productId) : undefined;
    return { line, product, ...(replaced ? { replaced } : {}) };
  });
}
