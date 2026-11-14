import type { AuditVerification, Offer, OfferPreview, Order, Product, ProductFacts, QuoteResponse, SearchResponse } from "@/lib/contracts";
import type { SignedMandate } from "@/lib/orders/types";
import { eur } from "@/lib/offers/format";

/** Compact text versions of tool results, for clients that read only text content. */

function productLine(product: Product): string {
  const content = product.content ? `, ${product.content.amount} ${product.content.unit} per ${product.salesUnit}` : "";
  const claims = product.claims.length ? `, claims: ${product.claims.join(", ")}` : "";
  return `${product.id} ${product.name.en || product.name.fi}${content}, lot size ${product.lotSize}${claims}`;
}

function previewText(preview: OfferPreview | undefined): string {
  if (!preview) return "";
  const per = preview.comparisonPrice ? `, ${eur(preview.comparisonPrice.amount)} per ${preview.comparisonPrice.per}` : "";
  const need = preview.unitsNeeded !== undefined ? `, ${preview.unitsNeeded} units needed` : "";
  const total = preview.estimatedNet ? ` (about ${eur(preview.estimatedNet.amount)} net)` : "";
  const when = preview.availability.deliveryDate ? ` for ${preview.availability.deliveryDate}` : "";
  const status = preview.orderable ? `orderable${when}` : `${preview.availability.status.replace("_", " ")}${when}`;
  return `; indicative ${eur(preview.unitPrice.amount)} per unit${per}${need}${total}, ${status}`;
}

/** "; origin FI, labels organic, 99 % delivery reliability, category average 1.1 kg CO2-eq per kg". */
function factsText(facts: ProductFacts): string {
  const parts = [
    facts.countryOfOrigin ? `origin ${facts.countryOfOrigin}` : undefined,
    facts.labels.length ? `labels ${facts.labels.join(", ")}` : undefined,
    facts.deliveryReliability !== undefined ? `${Math.round(facts.deliveryReliability * 100)} % delivery reliability` : undefined,
    facts.categoryAverageCo2PerKg !== undefined ? `category average ${facts.categoryAverageCo2PerKg} kg CO2-eq per kg` : undefined,
  ].filter(Boolean);
  return parts.length ? `; ${parts.join(", ")}` : "";
}

export function searchText(response: SearchResponse): string {
  const { interpretation: i } = response;
  const head = `Understood as ${i.concept ?? "no single product type"}${i.claims.length ? ` with ${i.claims.join(", ")}` : ""} (confidence ${i.confidence}).`;
  const note = i.note ? ` ${i.note}` : "";
  const hits = response.hits.map((hit, n) => `${n + 1}. ${productLine(hit.product)}${previewText(hit.offerPreview)}${factsText(hit.facts)}`);
  if (!hits.length) return `${head}${note} No products matched.`;
  return [`${head}${note}`, ...hits, "Next: call request_quote with a productId and the quantity in l, kg or sales_unit."].join("\n");
}

export function productText(product: Product): string {
  return productLine(product);
}

function offerLine(offer: Offer): string {
  const date = offer.deliveryDate ? `delivery ${offer.deliveryDate}` : "no delivery date";
  return `offer ${offer.id}: ${offer.fulfilment}, net ${eur(offer.totals.net.amount)}, ${date}, expires ${offer.expiresAt}`;
}

export function quoteText(response: QuoteResponse): string {
  const { offer, jws } = response.primary;
  const lines = [`Primary ${offerLine(offer)}.`];
  for (const note of offer.notes) lines.push(`Note: ${note}`);
  lines.push(`Primary offer JWS: ${jws}`);
  response.alternatives.forEach((alt, n) => {
    lines.push(`Alternative ${n + 1} (${alt.tier}: ${alt.meaning}) ${offerLine(alt.signed.offer)}. ${alt.tradeoff}`);
    lines.push(`Alternative ${n + 1} JWS: ${alt.signed.jws}`);
  });
  lines.push("Next: pass the chosen JWS unchanged as offerJws to place_order, with the mandate JWS from get_mandate.");
  return lines.join("\n");
}

export function mandateText({ mandate, jws }: SignedMandate): string {
  return [
    `Mandate ${mandate.id} v${mandate.version} from ${mandate.buyer.name} for ${mandate.agent.name} (${mandate.agent.id}).`,
    `Valid ${mandate.validFrom} to ${mandate.validUntil}.`,
    `Alone up to ${eur(mandate.limits.perOrder.amount)} per order and ${eur(mandate.limits.perWeek.amount)} per week.`,
    `Allowed categories: ${mandate.categories.allowed.join(", ")}. Excluded allergens: ${mandate.dietary.excludeAllergens.join(", ") || "none"}.`,
    `Substitutes: ${mandate.substitution.policy}, at most ${mandate.substitution.maxPriceIncreasePct} % dearer. Partial delivery ${mandate.delivery.allowPartial ? "allowed" : "not allowed"}.`,
    `Mandate JWS: ${jws}`,
  ].join("\n");
}

export function orderText(order: Order): string {
  const asks = order.decision.checks.filter((c) => c.status === "ask" || c.status === "block").map((c) => `${c.rule}: ${c.message}`);
  const head = `Order ${order.id} is ${order.status} (${order.decision.outcome}), net ${eur(order.offer.totals.net.amount)}. Simulated order.`;
  const next =
    order.status === "pending_approval"
      ? `Stop here and tell the human that order ${order.id} waits for the buyer's approver. Do not retry with another key. Poll get_order later.`
      : order.status === "confirmed"
        ? "Confirmed. The signed receipt is in receiptJws."
        : "Nothing was ordered.";
  return [head, ...asks, next].join("\n");
}

export function auditText(result: { verification: AuditVerification; checkpoint: { checkpoint: { size: number; head: string } } }): string {
  const v = result.verification;
  const state = v.valid ? `valid across ${v.entries} entries` : `broken at entry ${v.brokenAt}: ${v.reason}`;
  return `Audit chain is ${state}. Signed checkpoint: size ${result.checkpoint.checkpoint.size}, head ${result.checkpoint.checkpoint.head}.`;
}
