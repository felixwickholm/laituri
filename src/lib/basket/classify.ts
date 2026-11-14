import type { Check, LineHistory, LineState, Mandate, Order, OfferLine, ReasonCode, RequestCheck, RuleId } from "@/lib/contracts";
import { euro } from "@/lib/agent/words";
import { shortDay } from "@/lib/agent/dates";
import { count } from "@/lib/offers/format";
import { listText } from "@/lib/policy/format";
import { STOCK_TAKEN } from "@/lib/policy/rules/trust";
import { NEVER_BUY_REASON } from "@/lib/policy/never-buy";

/** The colour, code and plain sentence of a line. */
export interface Verdict {
  state: LineState;
  reasonCode: ReasonCode;
  reason: string;
}

/** Why a line has no order: the agent stopped before ordering. */
export type NoOrder =
  | { kind: "not_found" }
  | { kind: "unclear" }
  | { kind: "too_much" }
  | { kind: "date_passed" }
  /** No offer covers the need on time; the primary line of the best match says why. */
  | { kind: "short"; line: OfferLine; alternatives: number }
  /** The wholesaler's price or stock service did not answer, even after a retry. */
  | { kind: "no_answer" }
  | { kind: "error" };

/** What the buyer's history says about the product a confirmed line ordered. */
export interface Familiarity {
  history: LineHistory;
  /** Last week's basket had the same product in the same quantity. */
  sameAsLastWeek: boolean;
}

const verdict = (state: LineState, reasonCode: ReasonCode, reason: string): Verdict => ({ state, reasonCode, reason });

function orderedReason(order: Order, known: Familiarity): string {
  if (order.offer.lines.some((line) => line.substituteFor && line.quantity > 0)) return "Ordered a like-for-like swap. Inside your limits.";
  if (known.sameAsLastWeek) return "Ordered. Same as last week.";
  const times = known.history.timesOrdered;
  if (times === 1) return "Ordered. You bought this once before.";
  if (times > 1) return `Ordered. You bought this ${count(times)} times.`;
  return "Ordered. Inside your limits.";
}

function failing(order: Order, status: Check["status"], rule: RuleId): Check | undefined {
  return order.decision.checks.find((check) => check.rule === rule && check.status === status);
}

function shortageOf(order: Order): string {
  const replaced = order.offer.lines.find((line) => line.substituteFor)?.substituteFor;
  const stock = replaced?.reason.match(/^Only (\S+) of/);
  return stock ? `Only ${stock[1]} in stock.` : "Not enough in stock.";
}

/** The first requirement in the buyer's words that the swap does not meet: "UHT", "Arla". */
function changedWord(order: Order): string | undefined {
  const open = (order.offer.requestCheck ?? []).find(
    (item: RequestCheck) => item.result === "unmet" && ["attribute", "claim", "brand"].includes(item.requirement),
  );
  return open?.asked.trim();
}

/** A waiting order: what the person is asked to decide, the most decisive rule first. */
function waiting(order: Order, mandate: Mandate): Verdict {
  const ask = (rule: RuleId) => failing(order, "ask", rule);
  const swapped = order.offer.lines.some((line) => line.substituteFor);
  if (ask("spend.per_order")) {
    const over = order.offer.totals.net.amount - mandate.limits.perOrder.amount;
    return verdict("orange", "over_limit", `${euro(Math.ceil(over), true)} over your order limit.`);
  }
  if (ask("spend.per_week")) return verdict("orange", "over_limit", "This would pass your weekly limit. Needs your OK.");
  const price = ask("substitution.price");
  if (price) return verdict("orange", "price_changed", `The swap costs ${price.observed?.replace(/^\+/, "").replace(" %", "%")} more. Needs your OK.`);
  if (ask("substitution.policy") || (swapped && ask("match.confidence"))) {
    const word = changedWord(order);
    return verdict("orange", "substitute_needs_ok", word ? `${shortageOf(order)} The swap is not ${word}.` : `${shortageOf(order)} The swap needs your OK.`);
  }
  if (ask("product.first_time")) return verdict("orange", "new_product", "New product. Check it once.");
  const partial = ask("delivery.partial");
  if (partial) {
    return partial.observed === "untracked stock"
      ? verdict("orange", "partial", "Stock is not counted for this much. Please check it.")
      : verdict("orange", "partial", "Not all of it is in stock. Needs your OK.");
  }
  if (ask("delivery.deadline")) {
    const date = order.offer.deliveryDate ?? order.offer.deliverBy;
    return verdict("orange", "no_stock_in_time", `Arrives ${shortDay(date)}, after your day. Needs your OK.`);
  }
  if (ask("category.allowed")) return verdict("orange", "request_unclear", "Outside your usual categories. Please check it.");
  if (ask("dietary.allergens")) return verdict("orange", "request_unclear", "No allergen list for this product. Please check it.");
  if (ask("audit.integrity")) return verdict("orange", "request_unclear", "The log does not verify. A person must decide.");
  return verdict("orange", "request_unclear", "Not sure this is what you meant. Please check it.");
}

/** A blocked order: the rule that stopped it, in the kitchen's words. */
function blocked(order: Order): Verdict {
  const block = (rule: RuleId) => failing(order, "block", rule);
  // The buyer named this very product: that is the reason to give, whatever else also stops it.
  if (block("product.never_buy")) return verdict("red", "refused", `${NEVER_BUY_REASON} Nothing was ordered.`);
  const allergen = block("dietary.allergens");
  if (allergen) {
    if (allergen.message.startsWith("Allergen data is missing")) return verdict("red", "allergen", "No allergen data. Your rules say no.");
    const what = listText((allergen.observed ?? "").split(", "));
    const may = allergen.message.includes(" may contain ");
    return verdict("red", "allergen", `${may ? "May contain" : "Contains"} ${what}. Your rules say no.`);
  }
  const claims = block("dietary.claims");
  if (claims) return verdict("red", "refused", `Not ${claims.observed?.replaceAll("_", " ") ?? "as required"}. Your rules require it.`);
  const expiry = block("offer.expiry");
  if (expiry?.observed === "cutoff_passed") return verdict("red", "cutoff_passed", "Order cut-off has passed. Nothing was ordered.");
  if (expiry?.observed === STOCK_TAKEN || expiry?.observed === "unavailable" || expiry?.observed === "blocked") {
    return verdict("red", "no_stock_in_time", "Not in stock in time. Nothing was ordered.");
  }
  if (block("delivery.deadline")) {
    const date = order.offer.deliveryDate;
    return verdict("red", "no_stock_in_time", date ? `Earliest delivery ${shortDay(date)}. That is too late.` : "No delivery date. Nothing was ordered.");
  }
  if (block("substitution.policy")) return verdict("red", "refused", "Your rules allow no swaps. Nothing was ordered.");
  if (block("match.confidence")) return verdict("red", "request_unclear", "The offer does not match your words. Nothing ordered.");
  return verdict("red", "refused", "The order was refused. Nothing was ordered.");
}

/** The verdict on a line whose order was placed, from the order as the mandate decided it. */
export function classifyOrder(order: Order, mandate: Mandate, known: Familiarity): Verdict {
  switch (order.status) {
    case "confirmed":
      return verdict("green", "ordered", orderedReason(order, known));
    case "pending_approval":
      return waiting(order, mandate);
    case "rejected":
      return verdict("red", "refused", `${order.approval ? "The purchasing manager" : "A person"} rejected it. Nothing ordered.`);
    case "blocked":
      return blocked(order);
  }
}

/** The verdict on a line the agent could not order. */
export function classifyNoOrder(reason: NoOrder): Verdict {
  switch (reason.kind) {
    case "not_found":
      return verdict("red", "not_found", "Nothing in the catalogue matches these words.");
    case "unclear":
      return verdict("red", "request_unclear", "Say what to order. Nothing was ordered.");
    case "too_much":
      return verdict("red", "refused", "Valio Aimo refused: too much for one order line.");
    case "date_passed":
      return verdict("red", "cutoff_passed", "That day has passed. Pick a later day.");
    case "no_answer":
      return verdict("red", "refused", "Valio Aimo did not answer. Try this line again.");
    case "error":
      return verdict("red", "refused", "Something went wrong. Nothing was ordered.");
    case "short": {
      const { status, available } = reason.line.availability;
      if (status === "partial" && available !== undefined && available > 0) {
        const next = reason.alternatives > 0 ? "A like-for-like swap is ready." : "Order what is there?";
        return verdict("orange", "partial", `Only ${count(available)} in stock. ${next}`);
      }
      if (status === "cutoff_passed") return verdict("red", "cutoff_passed", "Order cut-off has passed. Nothing else arrives in time.");
      return verdict("red", "no_stock_in_time", "Not in stock in time. Nothing was ordered.");
    }
  }
}
