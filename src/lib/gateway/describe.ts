import type { Fulfilment, Offer, Order, QuoteRequest, QuoteResponse, SearchResponse } from "@/lib/contracts";
import type { Catalog } from "@/lib/catalog/types";
import { ISSUER } from "@/lib/offers/assemble";
import { count, day, eur, offerSubject, productName } from "@/lib/offers/format";
import type { Activity } from "@/lib/store/types";

const FULFILMENT: Record<Fulfilment, string> = {
  full: "Full offer",
  partial: "Partial offer",
  late: "Late delivery",
  substituted: "Offer with substitutes",
  unavailable: "Not available",
};

const UNIT: Record<string, string> = { l: "l", kg: "kg", sales_unit: "units" };

export function searchDetail(response: SearchResponse): string {
  const [best] = response.hits;
  if (!best) return "No products found";
  const products = response.hits.length === 1 ? "1 product" : `${response.hits.length} products`;
  return `${products}, best match ${productName(best.product)}`;
}

export function quoteTitle(request: QuoteRequest, catalog: Pick<Catalog, "get">): string {
  if (request.lines.length > 1) return `Asked for a quote for ${request.lines.length} lines`;
  const [line] = request.lines;
  const product = catalog.get(line.productId);
  const name = product ? productName(product) : `product ${line.productId}`;
  return `Asked for a quote for ${count(line.quantity.amount)} ${UNIT[line.quantity.unit]} of ${name}`;
}

export function quoteDetail(response: QuoteResponse): string {
  const { offer } = response.primary;
  const alternatives = response.alternatives.length;
  const extra = alternatives === 0 ? "" : `, ${alternatives} ${alternatives === 1 ? "alternative" : "alternatives"}`;
  return `${FULFILMENT[offer.fulfilment]}, ${eur(offer.totals.net.amount)} net${extra}`;
}

/** offer.issued audit summary: "Valio Aimo offered 1,000 x Valio Eila 1 l for 1,010.00 EUR, delivered Monday 16 Nov." */
export function offerSummary(offer: Offer, alternatives: number): string {
  const more = alternatives > 0 ? ` ${alternatives} ${alternatives === 1 ? "alternative was" : "alternatives were"} offered.` : "";
  if (offer.fulfilment === "unavailable") {
    return `${ISSUER} could not offer ${offerSubject(offer)}.${offer.notes[0] ? ` ${offer.notes[0]}` : ""}${more}`;
  }
  const when = offer.deliveryDate ? `, delivered ${day(offer.deliveryDate)}` : "";
  const exception = offer.fulfilment === "full" ? "" : ` ${offer.notes[0] ?? ""}`.trimEnd();
  return `${ISSUER} offered ${offerSubject(offer)} for ${eur(offer.totals.net.amount)}${when}.${exception}${more}`;
}

export function orderTitle(order: Order): string {
  return `Placed an order for ${offerSubject(order.offer)}`;
}

function firstMessage(order: Order, status: "ask" | "block"): string | undefined {
  return order.decision.checks.find((check) => check.status === status)?.message;
}

export function orderDetail(order: Order): string {
  switch (order.status) {
    case "confirmed":
      return `Confirmed, ${eur(order.offer.totals.net.amount)} net, receipt signed`;
    case "pending_approval":
      return `Waiting for approval: ${firstMessage(order, "ask") ?? "a human must decide"}`;
    case "blocked":
      return `Blocked: ${firstMessage(order, "block") ?? "the order is outside the mandate"}`;
    case "rejected":
      return "Rejected";
  }
}

export function orderStatus(order: Order): Activity["status"] {
  if (order.status === "confirmed") return "ok";
  if (order.status === "pending_approval") return "waiting";
  return "blocked";
}
