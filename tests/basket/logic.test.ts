import { existsSync } from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import * as approvalRoute from "@/app/api/v1/approvals/[orderId]/route";
import * as basketRoute from "@/app/api/v1/baskets/[basketId]/route";
import * as resolveRoute from "@/app/api/v1/baskets/[basketId]/lines/[lineId]/resolve/route";
import * as basketsRoute from "@/app/api/v1/baskets/route";
import * as weeklyRoute from "@/app/api/v1/baskets/weekly/route";
import * as session from "@/app/api/v1/console/session/route";
import * as handoffsRoute from "@/app/api/v1/handoffs/route";
import * as mandateRoute from "@/app/api/v1/mandate/route";
import * as orderRoute from "@/app/api/v1/orders/[id]/route";
import * as overview from "@/app/api/v1/supplier/overview/route";
import * as suggestionsRoute from "@/app/api/v1/suggestions/route";
import type { Basket, BasketLine, Handoff, Order, Suggestion, SupplierOverview } from "@/lib/contracts";
import { catalog } from "@/lib/catalog";
import { catalogPath } from "@/lib/catalog/load";
import { BUYER_IDS } from "@/lib/mandate";
import { toBasketRequest } from "@/lib/shop-console/cart";
import { Browser } from "../http/browser";

// Every sandbox copies the seeded weeks: last week's standing orders, four weeks of drift, first-time rule on.
process.env.LAITURI_SEED = "on";
process.env.LAITURI_DEMO_STEP_MS = "0";

const hasFixtures = existsSync(path.resolve("fixtures/upstream/price.json"));
const UHT_MILK = "462775";

async function read<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

async function finished(browser: Browser, basketId: string, query = ""): Promise<Basket> {
  for (let attempt = 0; attempt < 2000; attempt++) {
    const basket = await read<Basket>(await browser.call(basketRoute.GET, `/api/v1/baskets/${basketId}${query}`, { params: { basketId } }));
    if (basket.status === "done") return basket;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`Basket ${basketId} did not finish.`);
}

async function startWeekly(browser: Browser): Promise<string> {
  const started = await browser.call(weeklyRoute.POST, "/api/v1/baskets/weekly", { method: "POST" });
  expect(started.status).toBe(202);
  return (await read<{ basketId: string }>(started)).basketId;
}

async function startBasket(browser: Browser, body: unknown, query = ""): Promise<Basket> {
  const started = await browser.call(basketsRoute.POST, `/api/v1/baskets${query}`, { body });
  expect(started.status).toBe(202);
  return finished(browser, (await read<{ basketId: string }>(started)).basketId, query);
}

function resolve(browser: Browser, basket: Basket, line: BasketLine, optionId: string): Promise<Response> {
  return browser.call(resolveRoute.POST, `/api/v1/baskets/${basket.id}/lines/${line.id}/resolve`, {
    body: { optionId },
    params: { basketId: basket.id, lineId: line.id },
  });
}

async function patchMandate(browser: Browser, patch: unknown, buyer?: string): Promise<void> {
  const response = await browser.call(mandateRoute.PUT, `/api/v1/mandate${buyer ? `?buyer=${buyer}` : ""}`, { method: "PUT", body: patch });
  expect(response.status).toBe(200);
}

async function order(browser: Browser, orderId: string): Promise<Order> {
  return read<Order>(await browser.call(orderRoute.GET, `/api/v1/orders/${orderId}`, { params: { id: orderId } }));
}

const lineOf = (basket: Basket, words: string) => basket.lines.find((line) => line.words === words)!;
const optionOf = (line: BasketLine, kind: string) => line.options?.find((option) => option.kind === kind);
const UHT_LINE = { deliverBy: "2026-11-16", lines: [{ words: "lactose-free UHT skimmed milk", quantity: { amount: 200, unit: "l" }, productId: UHT_MILK }] };

/** Signs in as the demo approver; the browser keeps its sandbox. */
async function signedIn(): Promise<Browser> {
  const browser = new Browser();
  await browser.call(session.POST, "/api/v1/console/session", { body: { demo: true } });
  return browser;
}

describe.skipIf(!hasFixtures)("basket logic", { timeout: 60_000 }, () => {
  describe("swaps a person is offered", () => {
    it("never offers an alternative that breaks one of the mandate's never rules", async () => {
      const browser = await signedIn();
      // Only the Valio skimmed milk carries low_salt: the wholesaler's split with 51 Arla UHT litres breaks the rule.
      await patchMandate(browser, { dietary: { requiredClaims: ["low_salt"] } });
      const basket = await startBasket(browser, UHT_LINE);
      const [line] = basket.lines;
      const offered = (line.options ?? []).filter((option) => option.kind === "substitute");
      expect(offered).toEqual([]);
      expect(line.options?.some((option) => option.kind === "skip")).toBe(true);
    });

    it("keeps the waiting order, and the line, when the chosen swap is blocked", async () => {
      const browser = await signedIn();
      const basket = await startBasket(browser, UHT_LINE);
      const [line] = basket.lines;
      const split = optionOf(line, "substitute")!;
      expect(line).toMatchObject({ state: "orange", reasonCode: "substitute_needs_ok" });
      // The person puts the Arla milk on the never-buy list after the basket was worked: the split now breaks it.
      await patchMandate(browser, { dietary: { neverBuy: { products: [{ productId: UHT_MILK, name: "Arla Milkdrink" }], words: [] } } });
      const response = await resolve(browser, basket, line, split.id);
      expect(response.status).toBe(200);
      const after = (await read<Basket>(response)).lines[0];
      expect(after).toMatchObject({ state: "orange", orderId: line.orderId, reason: "On your never-buy list. Your waiting order is kept." });
      expect(after.resolved).toBeUndefined();
      expect(after.options?.map((option) => option.id)).not.toContain(split.id);
      expect(optionOf(after, "approve")).toBeTruthy();
      expect((await order(browser, line.orderId!)).status).toBe("pending_approval");
    });

    it("places the chosen swap first, then rejects the waiting order", async () => {
      const browser = await signedIn();
      const basket = await startBasket(browser, UHT_LINE);
      const [line] = basket.lines;
      const after = (await read<Basket>(await resolve(browser, basket, line, optionOf(line, "substitute")!.id))).lines[0];
      expect(after).toMatchObject({ state: "green", reason: "Swapped by the purchasing manager. Ordered." });
      expect(after.orderId).not.toBe(line.orderId);
      expect((await order(browser, line.orderId!)).status).toBe("rejected");
      expect((await order(browser, after.orderId!)).status).toBe("confirmed");
    });
  });

  describe("the weekly order", () => {
    let browser: Browser;
    let first: string;
    let weekly: Basket;

    beforeAll(async () => {
      browser = await signedIn();
      first = await startWeekly(browser);
      weekly = await finished(browser, first);
    }, 60_000);

    it("runs once per delivery day: starting it again answers with the same basket", async () => {
      const again = await startWeekly(browser);
      expect(again).toBe(first);
      const { baskets } = await read<{ baskets: Basket[] }>(await browser.call(basketsRoute.GET, "/api/v1/baskets"));
      expect(baskets.filter((basket) => basket.source === "weekly" && basket.deliverBy === weekly.deliverBy)).toHaveLength(1);
    });

    it("no longer suggests starting it once this week's basket exists", async () => {
      const { suggestions } = await read<{ suggestions: Suggestion[] }>(await browser.call(suggestionsRoute.GET, "/api/v1/suggestions"));
      expect(suggestions.some((suggestion) => suggestion.kind === "weekly_due")).toBe(false);
    });

    it("orders last week's product for every regular line, so nothing asks as new", async () => {
      const { baskets } = await read<{ baskets: Basket[] }>(await browser.call(basketsRoute.GET, `/api/v1/baskets?buyer=${BUYER_IDS.nordicHarbour}`));
      const last = baskets.filter((basket) => basket.source === "weekly" && basket.id !== weekly.id && basket.lines.length > 10)[0];
      const regular = weekly.lines.filter((line) => last.lines.some((old) => old.words === line.words));
      expect(regular).toHaveLength(18);
      for (const line of regular) expect(line.product?.id).toBe(lineOf(last, line.words).product?.id);
      expect(weekly.lines.filter((line) => line.reasonCode === "new_product")).toEqual([]);
    });

    it("stops a line that drifted from the usual amount or price, for a person to approve", async () => {
      // Butter is 250 kg against 60 kg last week; oat drink's 60 l is 20% over its four-week median of 50 l, so it is usual.
      expect(weekly.totals).toMatchObject({ lines: 20, green: 17, orange: 2, red: 1 });
      expect(lineOf(weekly, "butter")).toMatchObject({ state: "orange", reasonCode: "drift", reason: "Up 317% on your usual week." });
      expect(lineOf(weekly, "oat drink")).toMatchObject({ state: "green" });
      const drifted = weekly.lines.filter((line) => line.reasonCode === "drift");
      for (const line of drifted) {
        expect(line.orderId).toBeUndefined();
        expect(optionOf(line, "approve")).toBeTruthy();
      }
      const butter = lineOf(weekly, "butter");
      const after = lineOf(await read<Basket>(await resolve(browser, weekly, butter, optionOf(butter, "approve")!.id)), "butter");
      expect(after).toMatchObject({ state: "green", reason: "Approved by the purchasing manager. Ordered." });
      expect((await order(browser, after.orderId!)).approval?.decision).toBe("approved");
    });
  });

  it("settles a line whose order was approved elsewhere, and refuses to order it again", async () => {
    const browser = await signedIn();
    const basket = await startBasket(browser, UHT_LINE);
    const [line] = basket.lines;
    const approved = await browser.call(approvalRoute.POST, `/api/v1/approvals/${line.orderId}`, {
      body: { decision: "approved" },
      params: { orderId: line.orderId! },
    });
    expect((await read<Order>(approved)).status).toBe("confirmed");
    const now = await finished(browser, basket.id);
    expect(now.lines[0]).toMatchObject({ state: "green", reasonCode: "ordered", orderId: line.orderId });
    expect(now.lines[0].options ?? []).toEqual([]);
    expect(now.totals).toMatchObject({ green: 1, orange: 0 });
    const again = await resolve(browser, basket, line, optionOf(line, "substitute")!.id);
    expect(again.status).toBeGreaterThanOrEqual(400);
    expect((await order(browser, line.orderId!)).status).toBe("confirmed");
  });

  it("orders what is in stock and says what was not ordered", async () => {
    const browser = await signedIn();
    const body = { deliverBy: "2026-11-16", lines: [{ words: "Fazer protein oat drink", quantity: { amount: 10, unit: "pcs" }, productId: "474929" }] };
    const basket = await startBasket(browser, body);
    const [line] = basket.lines;
    const after = await read<Basket>(await resolve(browser, basket, line, optionOf(line, "quantity")!.id));
    expect(after.lines[0]).toMatchObject({ state: "green", reason: "Ordered 3 of 10 pcs. 7 pcs not ordered." });
    expect(after.totals.netOrdered).toBe(after.lines[0].net);
  });

  // Needs the full catalogue from `npm run setup`: the committed fixture catalogue has only the sesame-trace ciabatta.
  it.skipIf(!existsSync(catalogPath()))("never picks a product the school kitchens' mandate rules out, and still offers a safe swap of the same kind", async () => {
    const browser = await signedIn();
    const query = `?buyer=${BUYER_IDS.kaisla}`;
    // The recorded stock has only the sesame-trace ciabatta; live, the search finds a sesame-free one in stock.
    const basket = await startBasket(browser, { deliverBy: "2026-11-16", lines: [{ words: "ciabatta rolls", quantity: { amount: 10, unit: "kg" } }] }, query);
    const [line] = basket.lines;
    const product = catalog().get(line.product!.id)!;
    expect(product.name.en.toLowerCase()).toContain("ciabatta");
    expect([...product.allergens.contains, ...product.allergens.mayContain]).not.toContain("sesame");
    expect(line.reasonCode).not.toBe("allergen");

    const pinned = await startBasket(browser, { deliverBy: "2026-11-16", lines: [{ words: "ciabatta rolls", quantity: { amount: 10, unit: "kg" }, productId: "471464" }] }, query);
    expect(pinned.lines[0]).toMatchObject({ state: "red", reasonCode: "allergen" });
    const swap = optionOf(pinned.lines[0], "substitute")!;
    expect(swap.detail).toBe("Same kind of product without sesame. Passes your rules.");
  });

  it("confirms the exact product a person picked in the shop", async () => {
    const browser = await signedIn();
    const pick = (productId: string, packs: number) => {
      const product = catalog().get(productId)!;
      return { productId, name: product.name.en, pack: "", salesUnit: product.salesUnit, packs, step: 1, content: product.content as { amount: number; unit: "l" | "kg" } };
    };
    const request = toBasketRequest([pick("464411", 10), pick("464306", 24), pick("469270", 2), pick("468465", 12)], "2026-11-16");
    for (const line of request.lines) expect(line.words).not.toMatch(/\d\s?(g|kg|l)\b/);
    const basket = await startBasket(browser, request);
    for (const line of basket.lines) expect(line.reasonCode).not.toBe("request_unclear");
  });

  it("tells the kitchen when Valio Aimo answers after the cut-off, and drops 'your order' without one", async () => {
    const browser = await signedIn();
    const basket = await startBasket(browser, UHT_LINE);
    const created = await read<Handoff>(await browser.call(handoffsRoute.POST, "/api/v1/handoffs", { body: { basketId: basket.id, lineId: "line_1", words: "Help?" } }));
    expect(created.openHours.sentence).toBe(
      "Valio Aimo answers on Monday from 8:00, after the order cut-off (Sun 17:00). Decide yourself to keep Monday's delivery.",
    );
    const plain = await read<Handoff>(await browser.call(handoffsRoute.POST, "/api/v1/handoffs", { body: { words: "A question." } }));
    expect(plain.openHours.sentence).toBe("Valio Aimo answers on Monday from 8:00.");
  });

  it("counts only lines no person touched as ordered without a person", async () => {
    const browser = await signedIn();
    const basket = await startBasket(browser, UHT_LINE);
    await resolve(browser, basket, basket.lines[0], optionOf(basket.lines[0], "substitute")!.id);
    const view = await read<SupplierOverview>(await browser.call(overview.GET, "/api/v1/supplier/overview"));
    expect(view.baskets!.autoShare).toBeLessThan(1);
    const { baskets } = await read<{ baskets: Basket[] }>(await browser.call(basketsRoute.GET, `/api/v1/baskets?buyer=${BUYER_IDS.laine}`));
    // The seeded weeks: every line the owner approved is marked as resolved by a person.
    const approved = baskets.flatMap((one) => one.lines).filter((line) => line.reason.startsWith("Approved by"));
    expect(approved.length).toBeGreaterThan(0);
    expect(approved.every((line) => line.resolved?.by)).toBe(true);
  });

  it("shows the Valio operator every buyer's baskets", async () => {
    const browser = new Browser();
    await browser.call(session.POST, "/api/v1/console/session", { body: { demo: true, role: "operator" } });
    const { baskets } = await read<{ baskets: Basket[] }>(await browser.call(basketsRoute.GET, "/api/v1/baskets"));
    expect(new Set(baskets.map((basket) => basket.buyer.id))).toEqual(new Set([BUYER_IDS.nordicHarbour, BUYER_IDS.kaisla, BUYER_IDS.laine]));
  });
});
