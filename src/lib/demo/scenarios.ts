import { runPurchase, type PurchaseResult } from "@/lib/agent";
import { breakMandate } from "./break-mandate";
import type { ScenarioContext, ScenarioId, ScenarioOutcome } from "./state";

export const MILK_REQUEST = "1,000 litres of lactose-free milk by Monday";
export const OVER_LIMIT_REQUEST = "1,600 litres of lactose-free milk by Monday";
/** Product 462775 has only 51 units in stock, so the wholesaler answers with a signed alternative. */
export const SHORT_STOCK_REQUEST = "200 units of product 462775 by Monday";

export interface Scenario {
  title: string;
  run(ctx: ScenarioContext): Promise<ScenarioOutcome>;
}

async function purchases(ctx: ScenarioContext, requests: { label?: string; text: string }[]): Promise<ScenarioOutcome> {
  const results: PurchaseResult[] = [];
  for (const { label, text } of requests) {
    if (label) await ctx.hooks.note(label);
    results.push(await runPurchase(text, ctx.transport, ctx.hooks));
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
        { label: "Purchase 1 of 2: a large milk order.", text: OVER_LIMIT_REQUEST },
        { label: "Purchase 2 of 2: a product with only 51 in stock.", text: SHORT_STOCK_REQUEST },
      ]),
  },
  "break-mandate": {
    title: "The agent tries to break its mandate four ways",
    run: breakMandate,
  },
};

/** A free-text request from the console. */
export function freeText(request: string): Scenario {
  return { title: request, run: (ctx) => purchases(ctx, [{ text: request }]) };
}
