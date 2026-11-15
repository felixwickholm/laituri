import type { CreateBasketRequest } from "@/lib/contracts";
import { gatewayTransport } from "@/lib/agent";
import { RunCancelled } from "@/lib/demo/activity";
import { demoState } from "@/lib/demo/state";
import { currentMandate } from "@/lib/mandate";
import { store } from "@/lib/store";
import { workspaceState } from "@/lib/workspace/context";
import { openBasket, runBasket } from "./engine";
import { basketStepMs } from "./pace";
import { prefetchMarket } from "./prefetch";
import type { BasketAgent, StoredBasket } from "./types";
import { weeklyBasketFor } from "./weekly";

export { resolveLine } from "./resolve";
export { getBasket, listBaskets, settleFromOrders, storedBasket } from "./records";
export { weeklyDraft, weeklyRequest, weeklyStarted } from "./weekly";
export { toBasket } from "./view";
export type { BasketAgent, StoredBasket } from "./types";

/** The agent a buyer's mandate names, as it works a basket from the given client application. */
export async function buyerAgent(buyerId: string, client?: string): Promise<BasketAgent> {
  const { mandate } = await currentMandate(buyerId);
  return { ...mandate.agent, buyer: { id: mandate.buyer.id, name: mandate.buyer.name }, ...(client ? { client } : {}) };
}

type Started = { basket: StoredBasket; done: Promise<StoredBasket | undefined> };

/** Weekly baskets started in this workspace, by buyer and delivery day, while they are worked and after. */
const weeklyStarts = workspaceState("basket.weekly-starts", () => new Map<string, Promise<Started>>());

/**
 * Opens a basket and starts working it in the background, in the caller's workspace. `done` settles when every line
 * finished; a demo reset stops it at its next step. A standing weekly order runs once per buyer and delivery day:
 * starting it again, even while the first run is working, answers with that basket instead of ordering every line twice.
 */
export async function startBasket(request: CreateBasketRequest, agent: BasketAgent): Promise<Started> {
  if (request.source !== "weekly") return begin(request, agent);
  const starts = weeklyStarts();
  const key = `${agent.buyer.id}\n${request.deliverBy}`;
  const previous = starts.get(key);
  // Chained, so two starts at once see each other: the second waits for the first and answers with its basket.
  const started = (async (): Promise<Started> => {
    const before = previous ? await previous.catch(() => undefined) : undefined;
    if (before && (await store().baskets.get(before.basket.id))) return before;
    const existing = weeklyBasketFor(await store().baskets.list(), agent.buyer.id, request.deliverBy);
    if (existing) return { basket: existing, done: Promise.resolve(existing) };
    return begin(request, agent);
  })();
  starts.set(key, started);
  return started;
}

async function begin(request: CreateBasketRequest, agent: BasketAgent): Promise<Started> {
  const basket = await openBasket(request, agent);
  const generation = demoState().generation;
  const ms = basketStepMs();
  const pause = async () => {
    if (ms > 0) await new Promise((resolve) => setTimeout(resolve, ms));
    if (demoState().generation !== generation) throw new RunCancelled();
  };
  const { mandate } = await currentMandate(agent.buyer.id);
  const prefetch = () => prefetchMarket(basket, mandate.buyer.customerNumber);
  // A reset bumps the generation; a sandbox restore may also swap the state object itself. Either ends the run.
  const state = demoState();
  const alive = () => demoState() === state && state.generation === generation;
  const done = runBasket(basket, { agent, transport: gatewayTransport(agent), pause, prefetch, alive }).catch(() => undefined);
  return { basket, done };
}

