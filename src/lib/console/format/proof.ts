import type { Offer, OfferLine, Order } from "@/lib/contracts";
import { count, eur } from "./money";
import { day, hourMinute } from "./time";

const CLAIM_WORDS: Record<string, string> = {
  lactose_free: "lactose-free",
  low_lactose: "low-lactose",
  gluten_free: "gluten-free",
  vegan: "vegan",
  organic: "organic",
};

export function contentText(line: OfferLine): string | undefined {
  return line.content ? `${count(line.content.amount)} ${line.content.unit}` : undefined;
}

/** "1,000 × Valio Eila 1 l = 1,000 l" */
export function lineText(line: OfferLine): string {
  const content = contentText(line);
  return `${count(line.quantity)} × ${line.name}${content ? ` = ${content}` : ""}`;
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

/** Short one-line comparison for inbox rows: "Asked by Mon 16 Nov · Offered for Mon 16 Nov, €1,812.00". */
export function compareLine(offer: Offer): string {
  const when = offer.deliveryDate ? day(offer.deliveryDate) : "no date";
  return `Asked by ${day(offer.deliverBy)} · Offered ${when}, ${eur(offer.totals.net.amount)} net`;
}

export interface MatchedFact {
  label: string;
  detail: string;
  ok: boolean;
}

/** The claim the person cares about: the mandate's required claims, or a claim named in the request. */
function claimFact(order: Order): MatchedFact | undefined {
  const claims = order.decision.checks.find((item) => item.rule === "dietary.claims");
  if (claims?.limit && claims.limit !== "none") {
    const detail = claims.limit
      .split(",")
      .map((claim) => CLAIM_WORDS[claim.trim()] ?? claim.trim().replace(/_/g, " "))
      .join(", ");
    return { label: "Claim", ok: claims.status === "pass", detail };
  }
  const intent = order.offer.intent?.toLowerCase() ?? "";
  const named = Object.values(CLAIM_WORDS).find((word) => intent.includes(word));
  if (!named) return undefined;
  const match = order.decision.checks.find((item) => item.rule === "match.confidence");
  const ok = match?.status !== "ask";
  return { label: "Claim", ok, detail: `${named}, match ${order.offer.matchConfidence}` };
}

/** The facts a person checks when comparing request and offer, each with a pass mark. */
export function matchedFacts(order: Order): MatchedFact[] {
  const { offer } = order;
  const short = offer.lines.filter((line) => line.availability.available < line.availability.requested);
  const facts: MatchedFact[] = [
    {
      label: "Quantity",
      ok: short.length === 0,
      detail: short.length === 0
        ? offer.lines.map((line) => contentText(line) ?? `${count(line.quantity)} ${line.salesUnit}`).join(", ")
        : `${count(short[0].availability.available)} of ${count(short[0].availability.requested)} available`,
    },
  ];
  const claim = claimFact(order);
  if (claim) facts.push(claim);
  const onTime = Boolean(offer.deliveryDate && offer.deliveryDate <= offer.deliverBy);
  facts.push({ label: "Date", ok: onTime, detail: offer.deliveryDate ? day(offer.deliveryDate) : "No delivery date" });
  facts.push({ label: "Price", ok: true, detail: `${eur(offer.totals.net.amount)} net, fixed until ${hourMinute(offer.expiresAt)}` });
  return facts;
}
