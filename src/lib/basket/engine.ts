import type { CreateBasketRequest } from "@/lib/contracts";
import type { AgentTransport } from "@/lib/agent";
import { appendAudit } from "@/lib/audit";
import { now } from "@/lib/clock";
import { appendNote } from "@/lib/demo/activity";
import { inRun } from "@/lib/gateway/recorder";
import { newId } from "@/lib/offers/assemble";
import { agentActor } from "@/lib/orders/summaries";
import { seededMark } from "@/lib/provenance";
import { store } from "@/lib/store";
import { previousBasket } from "./history";
import { workLine, type LineContext } from "./line";
import type { BasketAgent, LineOutcome, StoredBasket, StoredLine } from "./types";
import { quantityLabel } from "./units";
import { earlierWeeks } from "./weekly";
import { measuringUpstream } from "@/lib/valio/meter";

/** Lines worked at once: enough to finish a weekly order quickly, few enough to follow on screen. */
export const BASKET_CONCURRENCY = 4;

export interface BasketRun {
  agent: BasketAgent;
  transport: AgentTransport;
  pause(): Promise<void>;
  /** Lines at once; the seed works one at a time so its backdated clock stays in order. */
  concurrency?: number;
  /** Asks the wholesaler about every line's candidates in one batch before the lines start. */
  prefetch?: () => Promise<unknown>;
}

const DEFAULT_TITLES = { weekly: "Weekly order", menu: "Menu order", manual: "Order", agent: "Order from your agent" } as const;

function newLine(request: CreateBasketRequest["lines"][number], index: number): StoredLine {
  return {
    id: `line_${index + 1}`,
    words: request.words,
    asked: { amount: request.quantity.amount, unit: request.quantity.unit },
    state: "working",
    reason: "Looking for it.",
    request,
    held: {},
  };
}

function apply(line: StoredLine, outcome: LineOutcome): void {
  const { options, ...fields } = outcome;
  Object.assign(line, fields);
  line.options = options.map((offered) => offered.option);
  line.held = Object.fromEntries(options.map((offered) => [offered.option.id, offered.held]));
}

/** Runs `work` over `items` with at most `limit` at once; each item's own order is kept by index. */
async function pool<T>(items: T[], limit: number, work: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const worker = async () => {
    while (next < items.length) await work(items[next++]);
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

/** A new basket for one buyer, stored as working before any line is looked at. */
export async function openBasket(request: CreateBasketRequest, agent: BasketAgent): Promise<StoredBasket> {
  const source = request.source ?? "manual";
  const basket: StoredBasket = {
    id: newId("bsk_"),
    title: request.title ?? DEFAULT_TITLES[source],
    source,
    ...(request.menuId ? { menuId: request.menuId } : {}),
    buyer: agent.buyer,
    deliverBy: request.deliverBy,
    createdAt: now().toISOString(),
    status: "running",
    lines: request.lines.map(newLine),
    agent,
    usage: { calls: 0, productsAsked: 0 },
    ...seededMark(),
  };
  await store().baskets.put(basket);
  await appendAudit({
    actor: agentActor(agent),
    event: "basket.started",
    summary: `${agent.name} started "${basket.title}" for ${agent.buyer.name}: ${basket.lines.length} lines for ${basket.deliverBy}.`,
    refs: { buyerId: agent.buyer.id },
    data: { basketId: basket.id, source, deliverBy: basket.deliverBy, lines: basket.lines.map((line) => `${quantityLabel(line.request.quantity)} ${line.words}`) },
  });
  return basket;
}

/**
 * Works every line as the buyer's agent, a few at a time, saving each line as it turns colour. Every line is its own
 * signed offer and order through the gateway, so the mandate, the request check, stock and the audit chain apply to each.
 */
export async function runBasket(basket: StoredBasket, run: BasketRun): Promise<StoredBasket> {
  const all = await store().baskets.list();
  const ctx: LineContext = {
    transport: run.transport,
    pause: run.pause,
    orders: () => store().orders.list(),
    previous: previousBasket(all, basket),
    ...(basket.source === "weekly" ? { weeks: earlierWeeks(all, basket) } : {}),
  };
  await inRun({ id: `run_${basket.id}`, title: basket.title }, () => measuringUpstream(basket.usage, async () => {
    // A failed batch only means each line asks for itself.
    await run.prefetch?.().catch(() => undefined);
    await pool(basket.lines, run.concurrency ?? BASKET_CONCURRENCY, async (line) => {
      apply(line, await workLine(line, basket, ctx));
      await store().baskets.put(basket);
      const status = line.state === "green" ? "ok" : line.state === "orange" ? "waiting" : "blocked";
      await appendNote(run.agent, `${line.words}: ${line.reason}`, status);
    });
  }));
  basket.status = "done";
  basket.finishedAt = now().toISOString();
  await store().baskets.put(basket);
  return basket;
}
