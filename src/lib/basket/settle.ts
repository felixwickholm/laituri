import type { LineOption, Mandate, Order } from "@/lib/contracts";
import { appendAudit } from "@/lib/audit";
import { now } from "@/lib/clock";
import { displayName } from "@/lib/agent/words";
import { classifyOrder } from "./classify";
import { productHistory } from "./history";
import type { StoredBasket, StoredLine } from "./types";
import { count } from "@/lib/offers/format";
import { packsText } from "./units";

/**
 * Writes the order a person's choice led to onto its line: green with who did it when it is confirmed, else the
 * colour and reason the mandate gives. The line has no options left. Returns the line's new reason.
 */
export function settleLine(line: StoredLine, order: Order, mandate: Mandate, orders: Order[], who: string, verb: string): string {
  const delivered = order.offer.lines.filter((offered) => offered.quantity > 0);
  const main = delivered.find((offered) => offered.substituteFor) ?? delivered[0] ?? order.offer.lines[0];
  const history = productHistory(orders, order.buyer.id, main.productId, order.id);
  const verdict = classifyOrder(order, mandate, { history, sameAsLastWeek: false });
  const reason = verdict.state === "green" ? `${verb} by ${who}. Ordered.` : verdict.reason;
  Object.assign(line, {
    state: verdict.state,
    reasonCode: verdict.reasonCode,
    reason,
    product: { id: main.productId, name: displayName(main.name) },
    packs: packsText(delivered),
    net: order.offer.totals.net.amount,
    orderId: order.id,
    offerId: order.offer.id,
    history,
    options: [],
    held: {},
  });
  return reason;
}

/** The person who chose an option, as the audit entry names them. */
export interface Chooser {
  id: string;
  name: string;
  /** How they signed in, when the entry must say so. */
  via?: string;
}

/**
 * A choice a "never" rule refused: the line stays open with its waiting order, and the signed audit entry names the
 * person, the option and why it ordered nothing.
 */
export async function recordRefusedChoice(basket: StoredBasket, line: StoredLine, option: LineOption, person: Chooser, sentence: string): Promise<void> {
  await appendAudit({
    actor: { type: "human", id: person.id, name: person.name },
    event: "basket.line_resolved",
    summary: `${person.name} chose "${option.label}" for ${line.words} in "${basket.title}". It was refused: ${sentence}`,
    refs: { buyerId: basket.buyer.id, ...(line.orderId ? { orderId: line.orderId } : {}) },
    data: { basketId: basket.id, lineId: line.id, optionId: option.id, kind: option.kind, state: line.state, refused: true, ...(person.via ? { via: person.via } : {}) },
  });
}

/** Marks the line resolved and writes the signed audit entry that names the person and the option. */
export async function recordResolution(basket: StoredBasket, line: StoredLine, option: LineOption, person: Chooser, sentence: string): Promise<void> {
  if (option.kind !== "handoff") line.resolved = { optionId: option.id, by: person.name, at: now().toISOString(), sentence };
  await appendAudit({
    actor: { type: "human", id: person.id, name: person.name },
    event: "basket.line_resolved",
    summary: `${person.name} chose "${option.label}" for ${line.words} in "${basket.title}". ${sentence}`,
    refs: { buyerId: basket.buyer.id, ...(line.orderId ? { orderId: line.orderId } : {}) },
    data: { basketId: basket.id, lineId: line.id, optionId: option.id, kind: option.kind, state: line.state, ...(person.via ? { via: person.via } : {}) },
  });
}

/**
 * A line a person chose to order only what is in stock for: what was ordered of what was asked, and what was not.
 * "Ordered 51 of 200 l. 149 l not ordered." Undefined when the order's amount cannot be read in the line's unit.
 */
export function shortfallReason(line: Pick<StoredLine, "asked">, order: Order): string | undefined {
  const delivered = order.offer.lines.filter((offered) => offered.quantity > 0);
  const { amount: asked, unit } = line.asked;
  const inUnit = unit === "pcs"
    ? delivered.reduce((sum, offered) => sum + offered.quantity, 0)
    : delivered.every((offered) => offered.content?.unit === unit)
      ? delivered.reduce((sum, offered) => sum + (offered.content?.amount ?? 0), 0)
      : undefined;
  if (inUnit === undefined || inUnit >= asked) return undefined;
  const got = Math.round(inUnit * 1000) / 1000;
  const missing = Math.round((asked - inUnit) * 1000) / 1000;
  return `Ordered ${count(got)} of ${count(asked)} ${unit}. ${count(missing)} ${unit} not ordered.`;
}
