import type { Basket } from "@/lib/contracts";
import { SCRIPTED_CLIENT } from "@/lib/http/client-app";
import { operatorSession } from "@/lib/http/operator-session";
import { readerBuyer } from "@/lib/http/buyer-scope";
import { bearerToken } from "@/lib/http/agent";
import { readingAgent } from "@/lib/http/reader";
import { buyerAgent } from "./index";
import { listBaskets } from "./records";
import type { BasketAgent } from "./types";

/**
 * The agent that works a basket a request starts. An agent key: that key's agent for its own buyer, with the client it
 * called from. A browser in its sandbox or a signed-in person: the agent the chosen buyer's mandate names.
 */
export async function basketCaller(request: Request): Promise<BasketAgent> {
  if (bearerToken(request.headers)) {
    const agent = await readingAgent(request, "baskets");
    if (agent.buyer) return { id: agent.id, name: agent.name, buyer: agent.buyer, client: agent.client };
  }
  return buyerAgent(await readerBuyer(request, "baskets"), SCRIPTED_CLIENT);
}

/**
 * The baskets a request may read. The wholesaler's signed-in operator, naming no buyer, sees every buyer's baskets in
 * the workspace, as the Valio screens show them. An agent key reads only its own buyer's; a buyer's session or sandbox
 * reads the buyer it names, else its own.
 */
export async function basketsFor(request: Request): Promise<Basket[]> {
  const named = new URL(request.url).searchParams.get("buyer")?.trim();
  if (!bearerToken(request.headers) && !named && (await operatorSession(request.headers)).signedIn) return listBaskets();
  return listBaskets(await readerBuyer(request, "baskets"));
}
