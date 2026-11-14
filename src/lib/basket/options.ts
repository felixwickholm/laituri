import type { Alternative, Offer, OfferLine, Order, SignedOffer } from "@/lib/contracts";
import { displayName } from "@/lib/agent/words";
import { count } from "@/lib/offers/format";
import type { SafeSwap } from "./safe-swap";
import type { HeldQuote, OfferedOption } from "./types";
import { packsText } from "./units";

/** The words and product of a line, which every option's re-quote keeps. */
export interface LineRef {
  id: string;
  words: string;
}

const cents = (amount: number) => Math.round(amount * 100) / 100;

export function approveOption(line: LineRef, order: Order, swap: boolean): OfferedOption {
  const replaced = order.offer.lines.find((offered) => offered.substituteFor);
  return {
    option: {
      id: `${line.id}-approve`,
      kind: "approve",
      label: swap ? "Approve the swap" : "Approve",
      detail: replaced?.substituteFor
        ? `${displayName(replaced.name)} instead of ${displayName(replaced.substituteFor.name)}.`
        : "Your signature confirms this order.",
      net: order.offer.totals.net.amount,
    },
    held: { kind: "approve", orderId: order.id },
  };
}

/**
 * Approve a line the agent held back before ordering (it drifted from the usual): nothing is ordered until the person
 * approves, and then the person who chose it signs the order if the mandate asks for a signature.
 */
export function orderOption(line: LineRef, signed: SignedOffer): OfferedOption {
  const offer = signed.offer;
  return {
    option: {
      id: `${line.id}-approve`,
      kind: "approve",
      label: "Approve",
      detail: "Nothing is ordered until you approve.",
      net: offer.totals.net.amount,
    },
    held: { kind: "approve", offerJws: signed.jws, quote: requoteOf(offer.lines, line.words) },
  };
}

function delivered(offer: Offer): number {
  return offer.lines.filter((offered) => offered.quantity > 0).length;
}

/** The products an offer delivers, as one key. */
function deliveredKey(offer: Offer): string {
  return offer.lines.filter((offered) => offered.quantity > 0).map((offered) => `${offered.productId}x${offered.quantity}`).sort().join("+");
}

/** Each of the wholesaler's signed alternatives, except one that delivers what the line's order already does. */
export function alternativeOptions(line: LineRef, alternatives: Alternative[], ordered?: Offer): OfferedOption[] {
  return alternatives
    .filter((alternative) => !ordered || deliveredKey(alternative.signed.offer) !== deliveredKey(ordered))
    .map((alternative, index) => {
      const offer = alternative.signed.offer;
      const swapped = offer.lines.find((offered) => offered.substituteFor && offered.quantity > 0) ?? offer.lines[0];
      return {
        option: {
          id: `${line.id}-swap-${index + 1}`,
          kind: "substitute" as const,
          label: delivered(offer) > 1 ? `Take ${count(swapped.quantity)} of ${displayName(swapped.name)} for the rest` : `Take ${displayName(swapped.name)} instead`,
          detail: alternative.tradeoff,
          net: offer.totals.net.amount,
        },
        held: { kind: "substitute" as const, offerJws: alternative.signed.jws, quote: requoteOf(offer.lines, line.words) },
      };
    });
}

/** A product of the same kind without the allergen, which the person may take instead. */
export function safeSwapOption(line: LineRef, swap: SafeSwap, allergens: string): OfferedOption {
  const offer = swap.signed.offer;
  return {
    option: {
      id: `${line.id}-safe`,
      kind: "substitute",
      label: `Take ${displayName(offer.lines[0].name)} instead`,
      detail: `Same kind of product without ${allergens}. Passes your rules.`,
      net: offer.totals.net.amount,
    },
    held: { kind: "substitute", offerJws: swap.signed.jws, quote: requoteOf(offer.lines, swap.words) },
  };
}

/** Order what the wholesaler has in stock now of the product asked for. */
export function quantityOption(line: LineRef, short: OfferLine): OfferedOption | undefined {
  const available = short.availability.available;
  if (available === undefined || available <= 0) return undefined;
  const each = short.content && short.quantity > 0 ? short.content.amount / short.quantity : undefined;
  const content = each !== undefined && short.content ? { amount: cents(each * available), unit: short.content.unit } : undefined;
  return {
    option: {
      id: `${line.id}-quantity`,
      kind: "quantity",
      label: `Order ${count(available)} now`,
      detail: `${packsText([{ quantity: available, salesUnit: short.salesUnit, content }])}, all that is in stock.`,
      net: cents(available * short.unitPrice.amount),
    },
    held: { kind: "quantity", quote: { lines: [{ productId: short.productId, quantity: { amount: available, unit: "sales_unit" } }], words: line.words } },
  };
}

export function skipOption(line: LineRef, orderId?: string): OfferedOption {
  return {
    option: {
      id: `${line.id}-skip`,
      kind: "skip",
      label: "Leave it out",
      detail: orderId ? "The waiting order is rejected. The choice is logged." : "Nothing is ordered. The choice is logged.",
    },
    held: { kind: "skip", ...(orderId ? { orderId } : {}) },
  };
}

export function handoffOption(line: LineRef): OfferedOption {
  return {
    option: { id: `${line.id}-handoff`, kind: "handoff", label: "Ask Valio Aimo", detail: "A person at Valio Aimo answers." },
    held: { kind: "handoff" },
  };
}

/** The lines of a signed offer as a fresh quote asks for them, in sales units. */
function requoteOf(lines: OfferLine[], words: string): HeldQuote {
  return {
    lines: lines.filter((offered) => offered.quantity > 0).map((offered) => ({ productId: offered.productId, quantity: { amount: offered.quantity, unit: "sales_unit" } })),
    words,
  };
}
