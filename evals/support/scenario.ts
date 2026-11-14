import type { Order, Quantity, QuoteRequest, RuleId } from "@/lib/contracts";
import { DEMO_AGENT, gatewayTransport, runPurchase, type AgentTransport, type PurchaseStatus } from "@/lib/agent";
import { catalog } from "@/lib/catalog";
import { gateway } from "@/lib/gateway";
import type { MandatePatch } from "@/lib/orders/types";
import { PINNED_NOW, type Verdict } from "../harness";
import { Checks } from "./checks";
import { auditVerifies, expectedEvents, nonPassing, orderEvents } from "./flow";
import { EXTRAS, type ExtraName } from "./scenario-extras";
import { addDays, coveredAmount, lineText, lotExcessLimit } from "./quantities";

export type Route = "auto" | "approval" | "blocked" | "no_order";

type QuoteLine = QuoteRequest["lines"][number];

export interface Scenario {
  id: string;
  request: string;
  expect: {
    route: Route[];
    concept?: string;
    claims?: string[];
    need?: Quantity;
    /** When the goods must arrive: by the date the words mean on the pinned clock, or one day after it. */
    delivery?: { by: string; arrives: "on_time" | "one_day_late" };
    /** Checks that must ask or block on the order. */
    rules?: RuleId[];
    agent?: PurchaseStatus;
  };
  /** Mandate change in force for this case; the state reset restores the default afterwards. */
  mandate?: MandatePatch;
  /** Requests ordered earlier in the same week. */
  before?: string[];
  /** The agent's order request is sent three times with one idempotency key. */
  sendTwice?: boolean;
  /** The agent quotes this line instead of what it found, as a careless model might; the buyer's words go with it. */
  misquote?: QuoteLine;
  extra?: ExtraName;
  note?: string;
  live?: boolean;
}

const QUIET = { note: () => undefined, pause: async () => undefined };

function routeOf(order: Order | undefined): Route {
  if (!order) return "no_order";
  if (order.status === "confirmed") return "auto";
  return order.status === "pending_approval" ? "approval" : "blocked";
}

/** Sends each order request twice at once and once more after, as a flaky network would. */
function resending(base: AgentTransport, replies: Order[]): AgentTransport {
  return {
    ...base,
    async placeOrder(request) {
      const first = await Promise.all([base.placeOrder(request), base.placeOrder(request)]);
      const again = await base.placeOrder(request);
      replies.push(...first, again);
      return first[0];
    },
  };
}

/** Quotes a fixed line whatever the agent chose, keeping the buyer's words and claiming a certain match. */
function misquoting(base: AgentTransport, line: QuoteLine): AgentTransport {
  return { ...base, requestQuote: (request) => base.requestQuote({ ...request, lines: [line], matchConfidence: "high" }) };
}

function checkProducts(order: Order, expect: Scenario["expect"], checks: Checks): void {
  for (const line of order.offer.lines.filter((l) => l.quantity > 0)) {
    const product = catalog().get(line.productId);
    if (expect.concept) {
      checks.expect(product?.concept === expect.concept, `${line.productId} is ${product?.concept ?? "unknown"}, expected ${expect.concept}`);
    }
    for (const claim of expect.claims ?? []) {
      checks.expect(Boolean(product?.claims.includes(claim)), `${line.productId} lacks ${claim}`);
    }
  }
}

function checkQuantity(order: Order, need: Quantity, checks: Checks): void {
  const covered = coveredAmount(order.offer.lines, need.unit);
  const limit = lotExcessLimit(order.offer.lines, need.unit);
  if (!checks.expect(covered !== undefined, `ordered lines have no ${need.unit} content`) || covered === undefined) return;
  checks.expect(covered >= need.amount - 1e-9, `ordered ${covered} ${need.unit}, less than ${need.amount}`);
  checks.expect(covered - need.amount <= limit + 1e-9, `ordered ${covered} ${need.unit}, more than one lot over ${need.amount}`);
}

/**
 * The expected date is written out for the pinned clock. A live run has today's clock, so there the date the agent
 * asked for stands in, and the note says so.
 */
function checkDelivery(order: Order, delivery: NonNullable<Scenario["expect"]["delivery"]>, checks: Checks): string {
  const pinned = process.env.LAITURI_NOW === PINNED_NOW;
  const by = pinned ? delivery.by : order.offer.deliverBy;
  const dates = [...new Set(order.offer.lines.filter((l) => l.quantity > 0).map((l) => l.availability.deliveryDate ?? "none"))];
  const ok = delivery.arrives === "on_time" ? dates.every((d) => d !== "none" && d <= by) : dates.every((d) => d === addDays(by, 1));
  checks.expect(ok, `delivery ${dates.join(",")} for ${by}, expected ${delivery.arrives.replace(/_/g, " ")}`);
  return `${dates.join(",")}${pinned ? "" : ` (live: by ${by}, the agent's date)`}`;
}

export async function runScenario(scenario: Scenario): Promise<Verdict> {
  const checks = new Checks();
  const base = gatewayTransport(DEMO_AGENT);
  if (scenario.mandate) await gateway().updateMandate(scenario.mandate);
  for (const earlier of scenario.before ?? []) {
    const result = await runPurchase(earlier, base, QUIET);
    checks.expect(result.status === "confirmed", `earlier request ended ${result.status}`);
  }
  const countBefore = (await gateway().listOrders()).length;
  const replies: Order[] = [];
  const asked = scenario.misquote ? misquoting(base, scenario.misquote) : base;
  const result = await runPurchase(scenario.request, scenario.sendTwice ? resending(asked, replies) : asked, QUIET);
  const order = result.orderId ? await gateway().getOrder(DEMO_AGENT, result.orderId) : undefined;
  const countAfter = (await gateway().listOrders()).length;
  const { expect } = scenario;
  const route = routeOf(order);

  const why = order ? `${lineText(order.offer.lines)}, ${nonPassing(order)}, confidence ${order.offer.matchConfidence}` : result.summary;
  checks.expect(expect.route.includes(route), `route ${route}, expected ${expect.route.join(" or ")} (${why})`);
  if (expect.agent) checks.expect(result.status === expect.agent, `agent ended ${result.status}, expected ${expect.agent}`);
  checks.expect(countAfter - countBefore === (order ? 1 : 0), `${countAfter - countBefore} orders recorded`);
  checks.note(route === "no_order" ? `no order: agent ${result.status}` : `${route}: ${lineText(order!.offer.lines)}`);

  if (order) {
    checkProducts(order, expect, checks);
    if (expect.need) checkQuantity(order, expect.need, checks);
    if (expect.delivery) checks.note(`delivery ${checkDelivery(order, expect.delivery, checks)}`);
    for (const rule of expect.rules ?? []) {
      const status = order.decision.checks.find((check) => check.rule === rule)?.status ?? "missing";
      checks.expect(status === "ask" || status === "block", `${rule} ${status}, expected ask or block`);
    }
    if (expect.rules?.length) checks.note(`flagged ${nonPassing(order)}`);
    const events = await orderEvents(order);
    const wanted = expectedEvents(order);
    checks.expect(events.join(">") === wanted.join(">"), `audit ${events.join(" > ")}, expected ${wanted.join(" > ")}`);
  }
  if (scenario.sendTwice) {
    const ids = new Set(replies.map((reply) => reply.id));
    checks.expect(replies.length === 3 && ids.size === 1, `three sends gave ${ids.size} distinct orders`);
    checks.note(`3 sends, ${ids.size} order`);
  }
  if (scenario.extra) await EXTRAS[scenario.extra]({ checks, order, scenario });
  checks.expect(await auditVerifies(), "audit log does not verify");
  checks.note("audit verified");
  if (scenario.note) checks.note(scenario.note);
  return checks.verdict(order ? `${route} (${order.status})` : `no_order (${result.status})`);
}
