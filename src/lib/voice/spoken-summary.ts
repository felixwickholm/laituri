import type { Mandate, Offer, OfferLine, Order } from "@/lib/contracts";
import type { PurchaseResult } from "@/lib/agent/types";
import { amount, displayName } from "@/lib/agent/words";

/** The order and mandate behind a result, when the caller has them. Without them the sentences stay general. */
export interface SpokenContext {
  order?: Order;
  mandate?: Mandate;
}

const UNIT_WORDS: Record<"l" | "kg", [string, string]> = { l: ["litre", "litres"], kg: ["kilo", "kilos"] };
const PACK_SIZE = /\s+\d+(?:[.,]\d+)?\s*(?:l|dl|ml|kg|g)$/i;

function euros(value: number): string {
  return `${amount(Math.round(value * 100) / 100)} euros`;
}

function weekday(isoDate: string): string {
  return new Intl.DateTimeFormat("en-GB", { weekday: "long", timeZone: "UTC" }).format(new Date(`${isoDate}T12:00:00Z`));
}

/** "1,000 litres of Valio Eila lactose-free milk drink", without the pack size a listener does not need. */
function lineWords(line: OfferLine): string {
  const name = displayName(line.name).replace(PACK_SIZE, "");
  if (!line.content) return `${amount(line.quantity)} ${line.quantity === 1 ? "pack" : "packs"} of ${name}`;
  const [one, many] = UNIT_WORDS[line.content.unit];
  return `${amount(line.content.amount)} ${line.content.amount === 1 ? one : many} of ${name}`;
}

function goods(offer: Offer): string {
  return offer.lines.filter((line) => line.quantity > 0).map(lineWords).join(" and ");
}

function lowerFirst(text: string): string {
  return text ? text[0].toLowerCase() + text.slice(1) : text;
}

function confirmed({ order }: SpokenContext): string {
  if (!order) return "Done. The order is confirmed and it was inside your mandate.";
  const { offer } = order;
  const when = offer.deliveryDate ? `arrive ${weekday(offer.deliveryDate)}` : "are ordered";
  return `Done. ${goods(offer)} ${when} for ${euros(offer.totals.net.amount)}. It was inside your mandate.`;
}

function waiting({ order, mandate }: SpokenContext): string {
  const ask = order?.decision.checks.find((check) => check.status === "ask");
  if (order && mandate && ask?.rule === "spend.per_order") {
    const over = order.offer.totals.net.amount - mandate.limits.perOrder.amount;
    return `This one needs you: it is ${euros(over)} over your per-order limit.`;
  }
  return ask ? `This one needs you: ${lowerFirst(ask.message)}` : "This one needs you: the order waits for your approval.";
}

function blocked({ order }: SpokenContext): string {
  const block = order?.decision.checks.find((check) => check.status === "block");
  return `Nothing was ordered. ${block?.message ?? "The order is outside your mandate."}`;
}

/** One or two sentences to read aloud when a purchase run has finished. */
export function spokenSummary(result: PurchaseResult, context: SpokenContext = {}): string {
  switch (result.status) {
    case "confirmed":
      return confirmed(context);
    case "waiting":
      return waiting(context);
    case "blocked":
      return blocked(context);
    case "failed":
      return "Something went wrong, so nothing was ordered.";
    case "needs_input":
    case "not_found":
      return result.summary;
  }
}
