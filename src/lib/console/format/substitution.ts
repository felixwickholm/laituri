import type { Check, Order } from "@/lib/contracts";
import { count } from "./money";
import { shortProductName } from "./product";

const SHORT = /Only (\d[\d,]*) of (\d[\d,]*)/i;
const PER: Record<"l" | "kg", string> = { l: "per litre", kg: "per kg" };
const WEEKDAY = new Intl.DateTimeFormat("en-GB", { weekday: "long", timeZone: "UTC" });

type Line = Order["offer"]["lines"][number];

function rule(order: Order, id: Check["rule"]): Check | undefined {
  return order.decision.checks.find((check) => check.rule === id);
}

/** Why the product asked for fell short: "Arla Milkdrink … 1 l had 51 of the 200 needed." */
function shortfall(line: Line): string {
  const asked = line.substituteFor;
  if (!asked) return "";
  const short = asked.reason.match(SHORT);
  return short ? `${shortProductName(asked.name)} had ${short[1]} of the ${short[2]} needed.` : asked.reason;
}

/** "57% cheaper per litre", "4% dearer per kg", "the same price per litre". */
function price(line: Line): string {
  const pct = Math.round(line.substituteFor?.priceChangePct ?? 0);
  const per = line.comparisonPrice ? ` ${PER[line.comparisonPrice.per]}` : "";
  if (pct === 0) return `the same price${per}`;
  return `${Math.abs(pct)}% ${pct < 0 ? "cheaper" : "dearer"}${per}`;
}

/** "in full on Monday" when the substitute arrives complete, else just the day. */
function arrival(line: Line): string {
  const date = line.availability.deliveryDate;
  const full = line.availability.status === "available" ? "in full" : "in part";
  return date ? `${full} on ${WEEKDAY.format(new Date(`${date}T12:00:00Z`))}` : full;
}

function kind(line: Line): string {
  return line.substituteFor?.likeForLike
    ? "the same kind of product with the same claims and no new allergen"
    : "a different kind of product";
}

/** What the alternative is: the kept part of the original, if any, and the substitute. */
function alternative(order: Order, line: Line): string {
  const kept = order.offer.lines.find((other) => other.productId === line.substituteFor?.productId && other.quantity > 0);
  const what = `${kind(line)}, ${price(line)}, ${arrival(line)}`;
  const name = shortProductName(line.name);
  return kept
    ? `The signed alternative keeps those ${count(kept.quantity)} and fills the rest with ${name}: ${what}.`
    : `The signed alternative, ${name}, is ${what}.`;
}

/** What the buyer's own mandate said about it, from the checks signed on the order. */
function mandateSays(order: Order): string | undefined {
  const policy = rule(order, "substitution.policy");
  const cost = rule(order, "substitution.price");
  if (policy?.status === "block") return "Your rules allow no substitutes, so it was not ordered.";
  if (policy?.status === "ask") return "Your rules ask a person to approve a substitute that is not like for like.";
  if (cost?.status === "ask") {
    const limit = cost.limit ? ` ${cost.limit.replace(/^\+/, "").replace(/\s%$/, "%")}` : "";
    return `It costs more than your${limit} limit for substitutes, so a person decides.`;
  }
  if (policy?.status !== "pass") return undefined;
  return policy.limit === "like_for_like"
    ? "Your rules allow a like-for-like substitute."
    : "Your rules allow a substitute within your price limit.";
}

function substitute(order: Order | undefined): Line | undefined {
  return order?.offer.lines.find((item) => item.substituteFor);
}

/**
 * What the agent took instead and why the buyer's rules let it, without the shortfall:
 * "The signed alternative, Eila … 1 l, is the same kind of product with the same claims and no new allergen,
 * 57% cheaper per litre, in full on Monday. Your rules allow a like-for-like substitute."
 * Undefined when no line of the order is a substitute.
 */
export function substitutionChoice(order: Order | undefined): string | undefined {
  const line = substitute(order);
  if (!order || !line) return undefined;
  return [alternative(order, line), mandateSays(order)].filter(Boolean).join(" ");
}

/**
 * Why the agent took a substitute, in the buyer's interest, built only from what the signed order carries:
 * the shortfall ("Arla Milkdrink … 1 l had 51 of the 200 needed."), then {@link substitutionChoice}.
 */
export function substitutionReason(order: Order | undefined): string | undefined {
  const line = substitute(order);
  const choice = substitutionChoice(order);
  return line && choice ? `${shortfall(line)} ${choice}` : undefined;
}

/** The maker's name, the first word of a product name once the trademark marks are gone: "Arla", "Valio". */
export function brandOf(name: string): string {
  return name.replace(/[®™©]/g, "").trim().split(/\s+/)[0]?.toLowerCase() ?? "";
}

export type SubstitutionTag = "Brand changed" | "Substituted";

/**
 * The tag on an order whose product is not the one asked for: "Brand changed" when the substitute is another
 * maker's, "Substituted" for the same maker's other product. Undefined when every line is what was asked.
 */
export function substitutionTag(order: Pick<Order, "offer"> | undefined): SubstitutionTag | undefined {
  const lines = order?.offer.lines.filter((line) => line.substituteFor && line.quantity > 0) ?? [];
  if (lines.length === 0) return undefined;
  return lines.some((line) => brandOf(line.name) !== brandOf(line.substituteFor?.name ?? "")) ? "Brand changed" : "Substituted";
}
