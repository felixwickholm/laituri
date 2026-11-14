import { OrderStatus, type Order } from "@/lib/contracts";
import { gateway } from "@/lib/gateway";
import { mandate, placeOrder, quoteLitres } from "./flow";
import { guardrail, orderOf, outcomeText, type Hostile } from "./hostile";
import type { Checks } from "./checks";

const LITRES = 1000;
const cents = (value: number) => Math.round(value * 100);

/** Outcomes in a fixed order, so concurrent orders that finish in any order give the same text. */
const OUTCOMES = [...OrderStatus.options, "refused"] as const;

function tally(orders: (Order | undefined)[]): string {
  const outcomes = orders.map((order) => order?.status ?? "refused");
  return OUTCOMES.flatMap((outcome) => {
    const count = outcomes.filter((item) => item === outcome).length;
    return count ? [`${count} ${outcome}`] : [];
  }).join(", ");
}

/** Confirmed spend this run must stay inside the weekly limit, and only what fits may confirm. */
async function checkWeek(orders: (Order | undefined)[], expectedConfirmed: number, checks: Checks): Promise<void> {
  const { mandate: rules } = await mandate();
  const confirmed = orders.filter((order) => order?.status === "confirmed");
  const spent = confirmed.reduce((sum, order) => sum + cents(order!.offer.totals.net.amount), 0);
  checks.expect(spent <= cents(rules.limits.perWeek.amount), `confirmed ${spent / 100} EUR, over the ${rules.limits.perWeek.amount} EUR week`);
  checks.expect(confirmed.length === expectedConfirmed, `${confirmed.length} confirmed, expected ${expectedConfirmed}`);
  const others = orders.filter((order) => order?.status !== "confirmed");
  const parked = others.every((order) => order?.status === "pending_approval" &&
    order.decision.checks.find((check) => check.rule === "spend.per_week")?.status === "ask");
  checks.expect(parked, `orders beyond the limit ended ${tally(others)}, expected pending_approval by spend.per_week`);
}

/** n separate 1,000 l offers placed at the same moment. */
async function simultaneous(hostile: Hostile, checks: Checks, count: number, perWeek?: number): Promise<string> {
  if (perWeek) await gateway().updateMandate({ limits: { perWeek: { amount: perWeek, currency: "EUR" } } });
  const quotes = [];
  for (let i = 0; i < count; i++) quotes.push(await quoteLitres(LITRES));
  const { jws, mandate: rules } = await mandate();
  const replies = await Promise.all(
    quotes.map((quote, i) => hostile.try(`simultaneous order ${i + 1}`, () => placeOrder(quote.primary.jws, jws, `eval-burst-${count}-${i + 1}`))),
  );
  const net = quotes[0].primary.offer.totals.net.amount;
  const fits = Math.min(count, Math.floor(cents(rules.limits.perWeek.amount) / cents(net)));
  const orders = replies.map(orderOf);
  await checkWeek(orders, fits, checks);
  return `${count} at once, ${net} EUR each, week ${rules.limits.perWeek.amount} EUR: ${tally(orders)}`;
}

export const SPEND_GUARDRAILS = [
  guardrail("G9", "Replay a confirmed offer, new keys", "one offer gives one order; every replay is blocked", async (hostile, checks) => {
    const quote = await quoteLitres(LITRES);
    const { jws } = await mandate();
    const orders: (Order | undefined)[] = [];
    for (let i = 0; i < 4; i++) {
      const reply = await hostile.try(`replay ${i + 1}`, () => placeOrder(quote.primary.jws, jws, `eval-replay-${i + 1}`));
      orders.push(orderOf(reply));
      if (reply.status >= 300) checks.expect(false, `replay ${i + 1}: ${outcomeText(reply)}`);
    }
    const statuses = orders.map((order) => order?.status);
    checks.expect(statuses[0] === "confirmed", `first send ended ${statuses[0]}, expected confirmed`);
    checks.expect(statuses.slice(1).every((status) => status === "blocked"), `replays ended ${statuses.slice(1).join(", ")}, expected blocked`);
    return `4 sends of one offer: ${tally(orders)}`;
  }),
  guardrail("G19", "Two simultaneous orders over the week", "one confirms, one waits", (hostile, checks) =>
    simultaneous(hostile, checks, 2, 1500)),
  guardrail("G20", "Six simultaneous orders over the week", "only what fits confirms, the rest wait", (hostile, checks) =>
    simultaneous(hostile, checks, 6)),
];
