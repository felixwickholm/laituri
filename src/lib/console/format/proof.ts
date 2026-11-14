import type { Offer, OfferLine, Order, RequestCheck, RequestCheckResult } from "@/lib/contracts";
import { packText } from "./packs";
import { shortProductName } from "./product";
import { day } from "./time";

/** "1,000 × Valio Eila 1 l = 1,000 l"; "3 cases of Dafgårds ciabatta 58g = 13.92 kg" */
export function lineText(line: OfferLine): string {
  return packText(line, line.name);
}

/** "Asked: 1,000 l lactose-free milk by Mon 16 Nov" */
export function askedLine(offer: Offer): string {
  const want = offer.intent?.trim() || offer.lines.map((line) => line.substituteFor?.name ?? line.name).join(", ");
  const text = want.replace(/[.\s]+$/, "");
  return /\bby\b/i.test(text) ? `Asked: ${text}` : `Asked: ${text} by ${day(offer.deliverBy)}`;
}

/** "Offered: 1,000 × Valio Eila 1 l = 1,000 l, Mon 16 Nov" */
export function offeredLine(offer: Offer): string {
  const lines = offer.lines.map(lineText).join("; ");
  const when = offer.deliveryDate ? `, ${day(offer.deliveryDate)}` : "";
  return `Offered: ${lines}${when}`;
}

/** The offer for a list or card, with short product names: "1,600 × Arki Eila semi-skimmed lactose-free milk 1 l = 1,600 l". */
export function offerSubject(offer: Offer): string {
  return offer.lines.map((line) => packText(line, shortProductName(line.name))).join("; ");
}

/** "Offered: 1,600 × Arki Eila … milk 1 l = 1,600 l · Mon 16 Nov" */
export function offeredShort(offer: Offer): string {
  return `Offered: ${offerSubject(offer)}${offer.deliveryDate ? ` · ${day(offer.deliveryDate)}` : ""}`;
}

export interface MatchedFact {
  label: string;
  detail: string;
  /** met, unmet or unchecked, exactly as the wholesaler signed it in the offer. */
  result: RequestCheckResult;
  /** True only for a requirement the offer meets. */
  ok: boolean;
}

const LABEL: Record<RequestCheck["requirement"], string> = {
  product: "Product",
  claim: "Claim",
  wording: "Other words",
  quantity: "Quantity",
  date: "Date",
  budget: "Budget",
  approval: "Approval first",
};

/** Keeps a number with its unit: "1,800 l" -> "1,800\u00a0l". */
function joinUnits(text: string): string {
  return text.replace(/(\d) (l|kg|units)\b/g, "$1\u00a0$2");
}

function fact(check: RequestCheck): MatchedFact {
  const detail = check.result === "unchecked"
    ? `Not checked: ${check.offered}`
    : `Asked ${check.asked} · offered ${check.offered}`;
  return { label: LABEL[check.requirement], detail: joinUnits(detail), result: check.result, ok: check.result === "met" };
}

/**
 * The wholesaler's comparison of the buyer's words with the offer, as signed inside the offer: one fact per
 * requirement, never derived from the match confidence or the stock figures. No words means nothing was compared.
 */
export function matchedFacts(order: Order): MatchedFact[] {
  const checks = order.offer.requestCheck;
  if (!checks?.length) {
    return [{ label: "Request", result: "unchecked", ok: false, detail: "Not checked: the agent sent no buyer's words to compare" }];
  }
  return checks.map(fact);
}
