import type { Alternative, Order } from "@/lib/contracts";
import { eur } from "./money";
import { offerSubject } from "./proof";
import { blocks, blockSentence } from "./rules";
import { hourMinute } from "./time";

/** "Price held until 14:30", from the wholesaler's signed price hold; undefined when the order carries none. */
export function priceHoldLine(order: Pick<Order, "priceHold">): string | undefined {
  return order.priceHold ? `Price held until ${hourMinute(order.priceHold.heldUntil)}` : undefined;
}

export interface StoppedApproval {
  /** Why the approval did not go through, in one sentence. */
  reason: string;
  alternatives: { id: string; what: string; net: string; tradeoff: string }[];
}

function isOrder(value: unknown): value is Order {
  return typeof value === "object" && value !== null && "decision" in value && "offer" in value;
}

/**
 * An approval the re-check stopped (409 approval_blocked), in plain words: why, and the wholesaler's fresh
 * alternatives. Undefined for any other answer.
 */
export function stoppedApproval(body: unknown): StoppedApproval | undefined {
  if (typeof body !== "object" || body === null) return undefined;
  const { order, alternatives } = body as { order?: unknown; alternatives?: unknown };
  if (!isOrder(order)) return undefined;
  const [first] = blocks(order);
  const reason = first ? `Not approved: ${blockSentence(first).replace(/^./, (c) => c.toLowerCase())}` : "Not approved: the re-check at approval stopped it.";
  const list = Array.isArray(alternatives) ? (alternatives as Alternative[]) : [];
  return {
    reason,
    alternatives: list.map((alternative) => ({
      id: alternative.signed.offer.id,
      what: offerSubject(alternative.signed.offer),
      net: `${eur(alternative.signed.offer.totals.net.amount)} net`,
      tradeoff: alternative.tradeoff,
    })),
  };
}
