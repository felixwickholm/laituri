import { runPurchase, type PurchaseOptions, type PurchaseResult } from "@/lib/agent";
import { runBuyerAgent } from "@/lib/agent/llm";
import { inRun } from "@/lib/gateway/recorder";
import { BUYER_IDS } from "@/lib/mandate";
import { newId } from "@/lib/offers/assemble";
import { breakMandate } from "./break-mandate";
import type { ScenarioAgent, ScenarioContext, ScenarioId, ScenarioOutcome } from "./state";

export const MILK_REQUEST = "1,000 litres of lactose-free milk by Monday";
export const OVER_LIMIT_REQUEST = "1,600 litres of lactose-free milk by Monday";
export const SHORT_STOCK_REQUEST = "200 litres of Arla lactose-free UHT milk by Monday";
/**
 * The buyer means Arla's fat-free UHT milk drink, which has only 51 units in stock.
 * Search would rightly steer to a product in stock, so the request names the product code to show the counter-offer.
 */
const SHORT_STOCK_PRODUCT = "462775";
export const BREAK_MANDATE_TITLE = "Try to break the rules, five ways";
export const TWO_KITCHENS_TITLE = "Same sentence, two kitchens";
/**
 * Dafgårds ciabatta (471464) may contain sesame. The hotel excludes only peanut and nuts, so its order confirms;
 * the school kitchens exclude sesame even as a trace (blockMayContain), so the same order is blocked.
 */
export const TWO_KITCHENS_REQUEST = "10 kg of ciabatta rolls by Monday";
/** The hotel speaks first, then the school kitchens. */
const TWO_KITCHENS = [BUYER_IDS.nordicHarbour, BUYER_IDS.kaisla];

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
async function purchases(ctx: ScenarioAgent, list: Purchase[]): Promise<ScenarioOutcome> {
  const results: PurchaseResult[] = [];
  for (const { text, options } of list) {
    const run = { id: newId("run_"), title: capitalise(text.trim()) };
    results.push(await inRun(run, () => runPurchase(text, ctx.transport, ctx.hooks, options)));
    await ctx.hooks.pause();
  }
  return { summary: results.map((result) => result.summary).join(" "), results };
}

/** The same words from each buyer's own agent, one run per buyer. Only the mandates differ. */
async function sameSentence(ctx: ScenarioContext, text: string, buyerIds: string[]): Promise<ScenarioOutcome> {
  const outcomes: ScenarioOutcome[] = [];
  for (const buyerId of buyerIds) outcomes.push(await purchases(await ctx.agentOf(buyerId), [{ text }]));
  return { summary: outcomes.map((outcome) => outcome.summary).join(" "), results: outcomes.flatMap((outcome) => outcome.results) };
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
  "two-kitchens": {
    title: TWO_KITCHENS_TITLE,
    run: (ctx) => sameSentence(ctx, TWO_KITCHENS_REQUEST, TWO_KITCHENS),
  },
};

/** A free-text request from the console, run by the selected engine. The fixed scenes above stay scripted. */
export function freeText(request: string): Scenario {
  return {
    title: request,
    async run(ctx) {
      const run = { id: newId("run_"), title: capitalise(request.trim()) };
      const result = await inRun(run, () => runBuyerAgent(request, ctx.transport, ctx.hooks));
      return { summary: result.summary, results: [result] };
    },
  };
}
