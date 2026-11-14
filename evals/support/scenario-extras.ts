import type { Order } from "@/lib/contracts";
import { catalog } from "@/lib/catalog";
import type { Checks } from "./checks";
import { mandate, monday, nonPassing, placeOrder, quoteLitres, recordedOrder } from "./flow";
import { coveredAmount, lineText } from "./quantities";
import type { Scenario } from "./scenario";

interface ExtraContext {
  checks: Checks;
  order?: Order;
  scenario: Scenario;
}

function productIdIn(request: string): string {
  const id = request.match(/\b\d{6}\b/)?.[0];
  if (!id) throw new Error("The request names no product code.");
  return id;
}

/** Case 5: the primary is short, the wholesaler offers a split, and the split covers the need inside the rules. */
async function partialSplit({ checks, scenario }: ExtraContext): Promise<void> {
  const productId = productIdIn(scenario.request);
  const need = scenario.expect.need?.amount ?? 0;
  const quote = await quoteLitres(need, { productId });
  const primary = quote.primary.offer.lines[0];
  checks.expect(primary.availability.status === "partial", `primary line ${primary.availability.status}, expected partial`);
  checks.expect(quote.alternatives.length > 0, "no alternatives offered");
  const split = quote.alternatives.find(({ signed }) =>
    signed.offer.lines.length > 1 && signed.offer.lines.some((line) => line.productId === productId && line.quantity > 0));
  if (!checks.expect(Boolean(split), "no split alternative that keeps the short product") || !split) return;
  const covered = coveredAmount(split.signed.offer.lines, "l") ?? 0;
  checks.expect(covered >= need, `split covers ${covered} l of ${need}`);

  const { mandate: rules, jws } = await mandate();
  const order = recordedOrder(await placeOrder(split.signed.jws, jws, "eval-split-0001"), "Split order");
  const inRules = split.signed.offer.lines.every((line) =>
    !line.substituteFor || (line.substituteFor.likeForLike && line.substituteFor.priceChangePct <= rules.substitution.maxPriceIncreasePct));
  const wanted = inRules ? "confirmed" : "pending_approval";
  checks.expect(order.status === wanted, `split order ${order.status}, expected ${wanted} (${nonPassing(order)})`);
  checks.note(`primary partial ${primary.availability.available}/${primary.availability.requested}, ${quote.alternatives.length} alternatives`);
  checks.note(`split ${lineText(split.signed.offer.lines)} ${order.status}`);
}

/** Case 6: the primary's cut-off has passed; ordering it is blocked and an on-time alternative exists. */
async function cutoffPassed({ checks, scenario }: ExtraContext): Promise<void> {
  const productId = productIdIn(scenario.request);
  const quote = await quoteLitres(scenario.expect.need?.amount ?? 0, { productId });
  const status = quote.primary.offer.lines[0].availability.status;
  checks.expect(status === "cutoff_passed", `primary line ${status}, expected cutoff_passed`);
  const { jws } = await mandate();
  const order = recordedOrder(await placeOrder(quote.primary.jws, jws, "eval-cutoff-0001"), "Primary order");
  checks.expect(order.status === "blocked", `ordering the primary ended ${order.status}, expected blocked`);
  const deliverBy = monday();
  const onTime = quote.alternatives.filter(({ signed }) => signed.offer.lines.every((line) =>
    line.availability.status === "available" && Boolean(line.availability.deliveryDate) && line.availability.deliveryDate! <= deliverBy));
  checks.expect(onTime.length > 0, "no on-time alternative offered");
  checks.note(`primary ${status}, ordering it ${order.status} (${nonPassing(order)}); ${onTime.length} on-time alternatives`);
}

/** Case 17: either an organic product is chosen, or the order is blocked by the claims rule. */
async function organicOrBlocked({ checks, order }: ExtraContext): Promise<void> {
  if (!checks.expect(Boolean(order), "no order to judge") || !order) return;
  checks.note(`flagged ${nonPassing(order)}`);
  if (order.status === "blocked") {
    const status = order.decision.checks.find((check) => check.rule === "dietary.claims")?.status;
    checks.expect(status === "block", `blocked, but dietary.claims ${status}`);
    return;
  }
  const missing = order.offer.lines.filter((line) => !catalog().get(line.productId)?.claims.includes("organic"));
  checks.expect(missing.length === 0, `${order.status} with non-organic ${missing.map((line) => line.productId).join(", ")}`);
}

export const EXTRAS = { partialSplit, cutoffPassed, organicOrBlocked };
export type ExtraName = keyof typeof EXTRAS;
