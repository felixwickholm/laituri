import type { MenuPlan, MenuPlanRequest } from "@/lib/contracts";
import { catalog } from "@/lib/catalog";
import { now } from "@/lib/clock";
import { currentMandate } from "@/lib/mandate";
import { pantryFor } from "@/lib/pantry";
import { store } from "@/lib/store";
import { upstream } from "@/lib/valio";
import { modelWordsReader } from "./model-reader";
import { planMenu } from "./plan";

/** Plans a menu for one buyer of the current workspace, under that buyer's mandate in force and with its stock. */
export async function planMenuFor(buyerId: string, request: MenuPlanRequest): Promise<MenuPlan> {
  const [{ mandate }, orders] = await Promise.all([currentMandate(buyerId), store().orders.list()]);
  return planMenu(request, {
    catalog: catalog(),
    upstream: upstream(),
    mandate,
    orders,
    pantry: pantryFor(buyerId),
    now: now(),
    readWords: modelWordsReader(),
  });
}
