import { runPurchase, type PurchaseOptions, type PurchaseResult } from "@/lib/agent";
import { inRun } from "@/lib/gateway/recorder";
import { newId } from "@/lib/offers/assemble";
import { breakMandate } from "./break-mandate";
import type { ScenarioContext, ScenarioId, ScenarioOutcome } from "./state";

export const MILK_REQUEST = "1,000 litres of lactose-free milk by Monday";
export const OVER_LIMIT_REQUEST = "1,600 litres of lactose-free milk by Monday";
export const SHORT_STOCK_REQUEST = "200 litres of Arla lactose-free UHT milk by Monday";
/**
 * The buyer means Arla's fat-free UHT milk drink, which has only 51 units in stock.
 * Search would rightly steer to a product in stock, so the request names the product code to show the counter-offer.
 */
const SHORT_STOCK_PRODUCT = "462775";
export const BREAK_MANDATE_TITLE = "Try to break the mandate, four ways";

export interface Scenario {
  title: string;
  run(ctx: ScenarioContext): Promise<ScenarioOutcome>;
}

interface Purchase {
  text: string;
  options?: PurchaseOptions;
}

function capitalise(text: string): string {
  return text ? text[0].toUpperCase() + text.slice(1) : text;
}

/** One purchase is one run: its notes and the gateway's records share a run id and the buyer's words as title. */
async function purchases(ctx: ScenarioContext, list: Purchase[]): Promise<ScenarioOutcome> {
  const results: PurchaseResult[] = [];
  for (const { text, options } of list) {
    const run = { id: newId("run_"), title: capitalise(text.trim()) };
    results.push(await inRun(run, () => runPurchase(text, ctx.transport, ctx.hooks, options)));
    await ctx.hooks.pause();
  }
  return { summary: results.map((result) => result.summary).join(" "), results };
}

export const SCENARIOS: Record<ScenarioId, Scenario> = {
  milk: {
    title: MILK_REQUEST,
    run: (ctx) => purchases(ctx, [{ text: MILK_REQUEST }]),
  },
  "over-limit": {
    title: "An order over the limit, then a product that is short of stock",
    run: (ctx) =>
      purchases(ctx, [
        { text: OVER_LIMIT_REQUEST },
        { text: SHORT_STOCK_REQUEST, options: { productId: SHORT_STOCK_PRODUCT } },
      ]),
  },
  "break-mandate": {
    title: BREAK_MANDATE_TITLE,
    run: (ctx) => inRun({ id: newId("run_"), title: BREAK_MANDATE_TITLE }, () => breakMandate(ctx)),
  },
};

/** A free-text request from the console. */
export function freeText(request: string): Scenario {
  return { title: request, run: (ctx) => purchases(ctx, [{ text: request }]) };
}
