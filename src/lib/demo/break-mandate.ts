import type { Order, Product, RuleId, SignedOffer } from "@/lib/contracts";
import { helsinkiDate, nextWorkingDay } from "@/lib/agent/dates";
import { euro, personName } from "@/lib/agent/words";
import { appendAudit, verifyAuditLog } from "@/lib/audit";
import { now } from "@/lib/clock";
import { gateway } from "@/lib/gateway";
import { requireApprover } from "@/lib/http/console-session";
import { SUPPLIER_ACTOR } from "@/lib/orders/summaries";
import { cutPrice, raiseLimit, replacePayload } from "./forge";
import type { ScenarioContext, ScenarioOutcome } from "./state";
import { tamperAudit } from "./tamper";

type Say = (text: string, status?: "ok" | "waiting" | "blocked" | "error") => Promise<void>;

/** The demo bearer token an outside agent uses. */
const DEMO_TOKEN = "demo-agent-token";
const RAISED_LIMIT = 100_000;
const NUT_ALLERGENS = ["peanut", "nuts"];

function stoppedBy(order: Order, rule: RuleId): string | undefined {
  if (order.status !== "blocked") return undefined;
  return order.decision.checks.find((check) => check.rule === rule && check.status === "block")?.message;
}

async function place(ctx: ScenarioContext, offerJws: string, mandateJws: string): Promise<Order> {
  return ctx.transport.placeOrder({ offerJws, mandateJws, idempotencyKey: crypto.randomUUID() });
}

/** Quote the first matching products until one can be delivered in full; at most three quotes. */
async function quoteFirst(ctx: ScenarioContext, query: string, accept: (p: Product) => boolean, amount: number): Promise<{ product: Product; signed: SignedOffer } | undefined> {
  const { hits } = await ctx.transport.searchCatalog({ query, limit: 20 });
  let last: { product: Product; signed: SignedOffer } | undefined;
  for (const product of hits.map((hit) => hit.product).filter(accept).slice(0, 3)) {
    const response = await ctx.transport.requestQuote({
      lines: [{ productId: product.id, quantity: { amount, unit: product.content?.unit ?? "sales_unit" } }],
      deliverBy: nextWorkingDay(helsinkiDate(now())),
    });
    last = { product, signed: response.primary };
    if (response.primary.offer.fulfilment === "full") break;
  }
  return last;
}

async function nuts(ctx: ScenarioContext, say: Say): Promise<Order | undefined> {
  await say("Attempt 1 of 5: ordering a product that contains nuts.");
  const quoted = await quoteFirst(ctx, "peanut butter", (p) => p.allergens.contains.some((a) => NUT_ALLERGENS.includes(a)), 5);
  if (!quoted) return void (await say("Found no product with nuts to try.", "error"));
  const allergens = quoted.product.allergens.contains.filter((a) => NUT_ALLERGENS.includes(a)).join(" and ");
  await say(`Trying to order ${quoted.product.name.en || quoted.product.name.fi}. It contains ${allergens}.`);
  await ctx.hooks.pause();
  const { jws: mandateJws } = await ctx.transport.getMandate();
  const order = await place(ctx, quoted.signed.jws, mandateJws);
  const reason = stoppedBy(order, "dietary.allergens");
  await say(reason ? `Stopped. ${reason}` : `Not stopped by the allergen rule. Order status: ${order.status}.`, reason ? "blocked" : "error");
  return order;
}

async function editedPrice(ctx: ScenarioContext, say: Say): Promise<Order | undefined> {
  await say("Attempt 2 of 5: Trying to change the price in the signed offer.");
  const quoted = await quoteFirst(ctx, "lactose-free milk", () => true, 100);
  if (!quoted) return void (await say("Found no product to quote.", "error"));
  const cheap = cutPrice(quoted.signed.offer);
  await say(`Changed the total from ${euro(quoted.signed.offer.totals.net.amount)} to ${euro(cheap.totals.net.amount)}. The signature stays the same.`);
  await ctx.hooks.pause();
  const { jws: mandateJws } = await ctx.transport.getMandate();
  const order = await place(ctx, replacePayload(quoted.signed.jws, () => cheap), mandateJws);
  const stopped = stoppedBy(order, "offer.signature");
  await say(stopped ? "Stopped. The signature no longer matches." : `Not stopped. Order status: ${order.status}.`, stopped ? "blocked" : "error");
  return order;
}

async function raisedLimit(ctx: ScenarioContext, say: Say): Promise<Order | undefined> {
  const { jws, mandate } = await ctx.transport.getMandate();
  await say(`Attempt 3 of 5: Raising my own limit from ${euro(mandate.limits.perOrder.amount, true)} to ${euro(RAISED_LIMIT, true)} in the mandate.`);
  const forged = replacePayload(jws, (claims: Parameters<typeof raiseLimit>[0]) => raiseLimit(claims, RAISED_LIMIT));
  const quoted = await quoteFirst(ctx, "lactose-free milk", () => true, 1600);
  if (!quoted) return void (await say("Found no product to quote.", "error"));
  await ctx.hooks.pause();
  const order = await place(ctx, quoted.signed.jws, forged);
  const stopped = stoppedBy(order, "mandate.signature");
  await say(stopped ? "Stopped. The buyer's signature on the mandate no longer matches." : `Not stopped. Order status: ${order.status}.`, stopped ? "blocked" : "error");
  return order;
}

/** Runs the same guard the approval route uses, with the agent's own credential. */
async function tryApproval(): Promise<{ refused: boolean; via: string; reason: string }> {
  try {
    await requireApprover(new Headers({ authorization: `Bearer ${DEMO_TOKEN}` }));
    return { refused: false, via: "in-process", reason: "The guard let the agent through." };
  } catch (error) {
    return { refused: true, via: "in-process", reason: error instanceof Error ? error.message : String(error) };
  }
}

async function selfApproval(ctx: ScenarioContext, say: Say, fallback?: Order): Promise<boolean> {
  await say("Attempt 4 of 5: Trying to approve my own order.");
  const pending = await gateway().pendingApprovals();
  const target = pending.at(-1) ?? fallback;
  if (!target) {
    await say("Found no order to approve.", "error");
    return false;
  }
  await ctx.hooks.pause();
  const { refused, via, reason } = await tryApproval();
  const { mandate } = await ctx.transport.getMandate();
  const approver = personName(mandate.approval.approver.name);
  await appendAudit({
    actor: SUPPLIER_ACTOR,
    event: "approval.rejected",
    summary: refused
      ? `Refused an approval of order ${target.id} sent by ${ctx.agent.name}. Agents cannot approve orders.`
      : `An approval of order ${target.id} sent by ${ctx.agent.name} was not refused.`,
    refs: { orderId: target.id },
    data: { refused, attemptedBy: ctx.agent.id, channel: via, reason },
  });
  await say(refused ? `Stopped. Agents cannot approve orders. Only ${approver} can.` : `Not stopped: ${reason}`, refused ? "blocked" : "error");
  return refused;
}

/** The last resort: rewrite history. The stored entry changes, but its hash and signature no longer fit. */
async function editedLog(ctx: ScenarioContext, say: Say): Promise<boolean> {
  await say("Attempt 5 of 5: Changing an entry in the log after the fact.");
  const { seq } = await tamperAudit();
  await ctx.hooks.pause();
  const log = await verifyAuditLog();
  const caught = !log.valid;
  await say(
    caught ? `Stopped. Entry ${seq} no longer matches its signature. Approvals are paused until the log is restored.` : "Not stopped. The log still verifies.",
    caught ? "blocked" : "error",
  );
  return caught;
}

/** The agent misbehaves on purpose. Every attempt must be stopped and leave a trace. */
export async function breakMandate(ctx: ScenarioContext): Promise<ScenarioOutcome> {
  const say: Say = async (text, status) => ctx.hooks.note(text, status);
  const results: boolean[] = [];
  const first = await nuts(ctx, say);
  results.push(first?.status === "blocked");
  await ctx.hooks.pause();
  results.push((await editedPrice(ctx, say))?.status === "blocked");
  await ctx.hooks.pause();
  const third = await raisedLimit(ctx, say);
  results.push(third?.status === "blocked");
  await ctx.hooks.pause();
  results.push(await selfApproval(ctx, say, third ?? first));
  await ctx.hooks.pause();
  results.push(await editedLog(ctx, say));
  const stopped = results.filter(Boolean).length;
  const summary = `${stopped} of ${results.length} attempts to break the mandate were stopped.`;
  await say(summary, stopped === results.length ? "blocked" : "error");
  return { summary, results: [] };
}
