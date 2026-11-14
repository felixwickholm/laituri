import type { AssistantTurn, AssistantTurnRequest } from "@/lib/contracts";
import { catalog } from "@/lib/catalog";
import { now } from "@/lib/clock";
import { currentMandate } from "@/lib/mandate";
import { planMenu } from "@/lib/menu";
import { pantryFor } from "@/lib/pantry";
import { store } from "@/lib/store";
import { upstream } from "@/lib/valio";
import { assistantReader } from "./model";
import { assistantTurn } from "./turn";

/**
 * One assistant turn for a buyer of the current workspace. The planner runs under that buyer's mandate in force and
 * with its stock, given the event as fields: the assistant has already read the words, so the planner does not ask a
 * model again.
 */
export async function assistantTurnFor(buyerId: string, request: AssistantTurnRequest): Promise<AssistantTurn> {
  const at = now();
  const pantry = pantryFor(buyerId);
  return assistantTurn(request, buyerId, {
    now: at,
    reader: assistantReader(),
    pantryWords: pantry.map((item) => item.words),
    plan: async (planRequest) => {
      const [{ mandate }, orders] = await Promise.all([currentMandate(buyerId), store().orders.list()]);
      return planMenu(planRequest, { catalog: catalog(), upstream: upstream(), mandate, orders, pantry, now: at });
    },
  });
}
