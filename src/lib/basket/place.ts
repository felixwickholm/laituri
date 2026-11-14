import type { Basket, CreateBasketRequest } from "@/lib/contracts";
import type { AgentRef } from "@/lib/gateway";
import { currentMandate } from "@/lib/mandate";
import { startBasket } from "./index";
import { toBasket } from "./view";

/** How long an agent's call waits for its basket before it gets the lines as far as they got. */
export const PLACE_BASKET_WAIT_MS = 30_000;

/**
 * A basket placed by an agent over MCP: worked as that agent, for its key's buyer, and answered once every line
 * finished or the wait ran out, whichever comes first.
 */
export async function placeBasket(agent: AgentRef, buyerId: string, input: Omit<CreateBasketRequest, "source" | "menuId">): Promise<Basket> {
  const { mandate } = await currentMandate(buyerId);
  const buyer = { id: mandate.buyer.id, name: mandate.buyer.name };
  const { basket, done } = await startBasket({ ...input, source: "agent" }, { id: agent.id, name: agent.name, buyer, ...(agent.client ? { client: agent.client } : {}) });
  let timer: ReturnType<typeof setTimeout> | undefined;
  const waited = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, PLACE_BASKET_WAIT_MS);
  });
  await Promise.race([done, waited]);
  clearTimeout(timer);
  return toBasket(basket);
}
