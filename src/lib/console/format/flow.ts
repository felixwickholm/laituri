import type { Order } from "@/lib/contracts";
import { eur, count } from "./money";
import { offerSubject } from "./proof";
import { blocks, blockSentence } from "./rules";
import { day, hourMinute } from "./time";

export type FlowState = "done" | "current" | "failed" | "todo";

/** Valio Aimo's four named steps, in their words and order. */
type FlowName = "Request" | "Lookup" | "Order" | "Approval";

export interface FlowStep {
  name: FlowName;
  state: FlowState;
  /** One plain sentence from the order's own data. */
  sentence: string;
}

const COMPARED = /^Compared (?:live )?prices for (\d+) matches\.(?: (\d+) cannot be delivered in full on time\.)?/;

/** How many options the agent compared, and how many could not arrive in full, read from its own notes. */
function comparedFrom(stepTexts: string[]): { compared: number; short: number } | undefined {
  for (const text of stepTexts) {
    const match = text.match(COMPARED);
    if (match) return { compared: Number(match[1]), short: Number(match[2] ?? 0) };
  }
  return undefined;
}

function lookupSentence(order: Order, stepTexts: string[]): string {
  const compared = comparedFrom(stepTexts);
  const first = order.offer.lines[0];
  const when = order.offer.deliveryDate ? `, arrives ${day(order.offer.deliveryDate)}` : "";
  if (compared && compared.compared > 1) return `Compared ${count(compared.compared)} options. Picked ${first ? offerSubject(order.offer) : "one"}${when}.`;
  return `Found ${offerSubject(order.offer)}${when}.`;
}

function orderStep(order: Order): FlowStep {
  const net = eur(order.offer.totals.net.amount);
  if (order.refusal) return { name: "Order", state: "failed", sentence: "Not ordered. The price was not one Valio Aimo signed here." };
  if (order.status === "blocked") {
    const [first] = blocks(order);
    return { name: "Order", state: "failed", sentence: `Not ordered. ${first ? blockSentence(first) : "It is outside your limits."}` };
  }
  if (order.status === "confirmed") return { name: "Order", state: "done", sentence: `Ordered at a fixed price: ${net} net.` };
  if (order.status === "pending_approval") {
    return { name: "Order", state: "done", sentence: `Valio Aimo guarantees ${net} net until ${hourMinute(order.priceHold?.heldUntil ?? order.offer.expiresAt)}.` };
  }
  return { name: "Order", state: "done", sentence: `Valio Aimo offered a fixed price: ${net} net.` };
}

function approvalStep(order: Order): FlowStep {
  if (order.refusal || order.status === "blocked") return { name: "Approval", state: "todo", sentence: "Nobody can approve this. Your limits say no." };
  if (order.status === "pending_approval") return { name: "Approval", state: "current", sentence: "Waits for the purchasing manager." };
  if (order.status === "rejected") {
    return order.approval
      ? { name: "Approval", state: "failed", sentence: "Purchasing manager said no." }
      : { name: "Approval", state: "failed", sentence: "The price ran out before a decision." };
  }
  return order.approval
    ? { name: "Approval", state: "done", sentence: "Purchasing manager approved." }
    : { name: "Approval", state: "done", sentence: "Your agent, inside your limits." };
}

/** Request, Lookup, Order, Approval: what was asked, what was found, the fixed price, and who decided. */
export function flowSteps(order: Order, stepTexts: string[] = []): FlowStep[] {
  const asked = order.offer.intent?.trim();
  return [
    { name: "Request", state: "done", sentence: asked ? `“${asked}”` : `Your agent asked for ${offerSubject(order.offer)}.` },
    { name: "Lookup", state: "done", sentence: lookupSentence(order, stepTexts) },
    orderStep(order),
    approvalStep(order),
  ];
}

const LABEL_WORDS: Record<string, string> = {
  finnish_origin: "Finnish origin",
  hyvaa_suomesta: "Finnish origin",
  eu_organic: "Organic",
  organic: "Organic",
  luomu: "Organic",
  msc: "MSC fish",
  fairtrade: "Fairtrade",
  lactose_free: "Lactose free",
};

/** "eu_organic" -> "Organic"; an unknown label in plain words. */
export function labelWord(label: string): string {
  const key = label.toLowerCase();
  if (LABEL_WORDS[key]) return LABEL_WORDS[key];
  const words = key.replace(/[_-]+/g, " ").trim();
  return words ? words[0].toUpperCase() + words.slice(1) : label;
}

/** "Why this product" in two or three short lines: the choice, the comparison, reliability and labels. */
export function whyThisProduct(order: Order, stepTexts: string[] = []): string[] {
  const why: string[] = [];
  const line = order.offer.lines[0];
  const swapped = order.offer.lines.find((item) => item.substituteFor);
  const compared = comparedFrom(stepTexts);
  const cheapest = stepTexts.some((text) => text.startsWith("Cheapest match:"));
  if (swapped?.substituteFor) why.push(`A swap: ${swapped.substituteFor.reason.replace(/\.$/, "")}.`);
  else if (cheapest) why.push("The cheapest that arrives on time.");
  if (compared && compared.compared > 1) {
    why.push(
      compared.short > 0
        ? `Compared ${count(compared.compared)} options. ${count(compared.short)} could not arrive in full on time.`
        : `Compared ${count(compared.compared)} options.`,
    );
  }
  const facts = line?.facts;
  const extras: string[] = [];
  if (facts?.deliveryReliability !== undefined) extras.push(`Arrives in full and on time ${Math.round(facts.deliveryReliability * 100)}% of the time.`);
  const labels = [...new Set((facts?.labels ?? []).map(labelWord))];
  if (labels.length > 0) extras.push(`${labels.slice(0, 3).join(", ")}.`);
  return [...why, ...extras].slice(0, 3);
}
