import type { MenuPlan, MenuPlanRequest } from "@/lib/contracts";
import { fixtureCatalog } from "@/lib/catalog";
import { BUYER_IDS, defaultMandate } from "@/lib/mandate";
import { planMenu, type PlanDeps } from "@/lib/menu";
import { pantryFor } from "@/lib/pantry";
import { RecordedUpstream } from "@/lib/valio";

/** Saturday morning, as the recorded wholesaler answers were taken: delivery Monday, orders close Sunday 17:00. */
export const NOW = new Date("2026-11-14T09:00:00+02:00");

const catalog = fixtureCatalog();
const upstream = new RecordedUpstream();

export type Kitchen = keyof typeof BUYER_IDS;

/** A plan in recorded mode for a demo kitchen, with its own mandate and stock and no orders yet. */
export function plan(request: MenuPlanRequest, kitchen: Kitchen = "nordicHarbour", extra: Partial<PlanDeps> = {}): Promise<MenuPlan> {
  const buyerId = BUYER_IDS[kitchen];
  return planMenu(request, {
    catalog,
    upstream,
    mandate: defaultMandate(buyerId),
    orders: [],
    pantry: pantryFor(buyerId),
    now: NOW,
    ...extra,
  });
}

/** Every sentence the plan says to a person. */
export function sentences(result: MenuPlan): string[] {
  const texts = [
    result.understood,
    ...result.notes,
    ...result.menus.flatMap((menu) => [
      menu.tagline,
      ...menu.fits.map((fit) => fit.sentence),
      ...menu.warnings,
      ...menu.shoppingList.flatMap((line) => (line.swap ? [line.swap.reason] : [])),
      ...(menu.changes ? [menu.changes.sentence] : []),
    ]),
  ];
  return texts.flatMap((text) => text.split(/(?<=[.?!])\s+/));
}

export function wordCount(sentence: string): number {
  return sentence.split(/\s+/).filter(Boolean).length;
}
