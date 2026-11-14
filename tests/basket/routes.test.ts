import { AGENT_TOKEN, jsonRequest } from "../http/env";
import { existsSync } from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import * as basketRoute from "@/app/api/v1/baskets/[basketId]/route";
import * as resolveRoute from "@/app/api/v1/baskets/[basketId]/lines/[lineId]/resolve/route";
import * as basketsRoute from "@/app/api/v1/baskets/route";
import * as draftRoute from "@/app/api/v1/baskets/weekly/draft/route";
import * as weeklyRoute from "@/app/api/v1/baskets/weekly/route";
import * as session from "@/app/api/v1/console/session/route";
import * as answerRoute from "@/app/api/v1/handoffs/[handoffId]/answer/route";
import * as handoffsRoute from "@/app/api/v1/handoffs/route";
import * as overview from "@/app/api/v1/supplier/overview/route";
import * as workspace from "@/app/api/v1/workspace/route";
import * as verify from "@/app/api/v1/audit/verify/route";
import type { AuditVerification, Basket, BasketLine, Handoff, SupplierOverview, WeeklyDraft, WorkspaceInfo } from "@/lib/contracts";
import { Basket as BasketSchema, WeeklyDraft as DraftSchema } from "@/lib/contracts";
import { BUYER_IDS } from "@/lib/mandate";
import { Browser } from "../http/browser";

// Every sandbox copies the seeded weeks, so last week's standing orders and four weeks of drift are there.
process.env.LAITURI_SEED = "on";
process.env.LAITURI_DEMO_STEP_MS = "0";

const hasFixtures = existsSync(path.resolve("fixtures/upstream/price.json"));
const bearer = (key: string) => ({ authorization: `Bearer ${key}` });

async function read<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

/** Polls the basket until every line finished. */
async function finished(browser: Browser, basketId: string, headers: Record<string, string> = {}): Promise<Basket> {
  for (let attempt = 0; attempt < 400; attempt++) {
    const basket = await read<Basket>(await browser.call(basketRoute.GET, `/api/v1/baskets/${basketId}`, { params: { basketId }, headers }));
    if (basket.status === "done") return basket;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`Basket ${basketId} did not finish.`);
}

async function startWeekly(browser: Browser): Promise<Basket> {
  const started = await browser.call(weeklyRoute.POST, "/api/v1/baskets/weekly", { method: "POST" });
  expect(started.status).toBe(202);
  const { basketId } = await read<{ basketId: string }>(started);
  return finished(browser, basketId);
}

function resolve(browser: Browser, basket: Basket, line: BasketLine, optionId: string, headers: Record<string, string> = {}): Promise<Response> {
  return browser.call(resolveRoute.POST, `/api/v1/baskets/${basket.id}/lines/${line.id}/resolve`, {
    body: { optionId },
    headers,
    params: { basketId: basket.id, lineId: line.id },
  });
}

const lineOf = (basket: Basket, words: string) => basket.lines.find((line) => line.words === words)!;
const optionOf = (line: BasketLine, kind: string) => line.options!.find((option) => option.kind === kind)!;

describe.skipIf(!hasFixtures)("baskets over REST", { timeout: 60_000 }, () => {
  const browser = new Browser();
  let weekly: Basket;

  beforeAll(async () => {
    weekly = await startWeekly(browser);
    await browser.call(session.POST, "/api/v1/console/session", { body: { demo: true } });
  }, 60_000);

  it("works Nordic Harbour's weekly order to 17 green, 2 orange and 1 red, each line its own order", async () => {
    expect(BasketSchema.parse(weekly)).toBeTruthy();
    expect(weekly.totals).toMatchObject({ lines: 20, green: 17, orange: 2, red: 1, working: 0, minutesByHand: 20 });
    expect(weekly.summary).toBe("17 of 20 lines ordered. 2 need you. 1 is blocked.");
    // 250 kg against 60 kg last week: held back before ordering, for a person to approve.
    expect(lineOf(weekly, "butter")).toMatchObject({ state: "orange", reasonCode: "drift", reason: "Up 317% on your usual week." });
    expect(lineOf(weekly, "butter").orderId).toBeUndefined();
    expect(lineOf(weekly, "lactose-free UHT skimmed milk")).toMatchObject({ state: "orange", reasonCode: "substitute_needs_ok", reason: "Only 51 in stock. The swap is not UHT." });
    expect(lineOf(weekly, "Alpro almond drink")).toMatchObject({ state: "red", reasonCode: "allergen", reason: "Contains nuts. Your rules say no." });
    expect(lineOf(weekly, "1,000 litres of lactose-free milk")).toMatchObject({ state: "green", reason: "Ordered. Same as last week.", packs: "1,000 x 1 l = 1,000 l" });
    expect(lineOf(weekly, "1,000 litres of lactose-free milk").history?.timesOrdered).toBeGreaterThan(0);
    const orders = weekly.lines.map((line) => line.orderId).filter(Boolean);
    expect(new Set(orders).size).toBe(19);
    for (const line of weekly.lines.filter((candidate) => candidate.state !== "green")) {
      expect(line.options?.some((option) => option.kind === "handoff")).toBe(true);
    }
  });

  it("refuses to resolve without the approver session, and for an agent key", async () => {
    const butter = lineOf(weekly, "butter");
    const stranger = new Browser();
    expect((await resolve(stranger, weekly, butter, optionOf(butter, "approve").id)).status).toBe(403);
    const agent = await resolve(browser, weekly, butter, optionOf(butter, "approve").id, bearer(AGENT_TOKEN));
    expect(agent.status).toBe(403);
    expect((await read<{ code: string }>(agent)).code).toBe("agent_not_allowed");
  });

  it("refuses an option that is not on the line", async () => {
    const butter = lineOf(weekly, "butter");
    const almond = lineOf(weekly, "Alpro almond drink");
    const response = await resolve(browser, weekly, butter, optionOf(almond, "substitute").id);
    expect(response.status).toBe(400);
  });

  it("approves the drifted line, over the order limit too, with the approver's signature", async () => {
    const butter = lineOf(weekly, "butter");
    const after = await read<Basket>(await resolve(browser, weekly, butter, optionOf(butter, "approve").id));
    expect(lineOf(after, "butter")).toMatchObject({ state: "green", reason: "Approved by the purchasing manager. Ordered.", resolved: { by: "Maria Lind, Head of Purchasing" } });
    expect(after.summary).toBe("18 of 20 lines ordered. 1 needs you. 1 is blocked.");
  });

  it("takes the nut-free swap on the allergen line, and never anything with nuts", async () => {
    const almond = lineOf(weekly, "Alpro almond drink");
    const swap = optionOf(almond, "substitute");
    expect(swap.label).toBe("Take Alpro Rice drink 1L instead");
    const after = await read<Basket>(await resolve(browser, weekly, almond, swap.id));
    expect(lineOf(after, "Alpro almond drink")).toMatchObject({ state: "green", reasonCode: "ordered", product: { name: "Alpro Rice drink 1L" } });
  });

  it("leaves the swap out with a signed rejection, and logs it", async () => {
    const milk = lineOf(weekly, "lactose-free UHT skimmed milk");
    const after = await read<Basket>(await resolve(browser, weekly, milk, optionOf(milk, "skip").id));
    expect(lineOf(after, "lactose-free UHT skimmed milk")).toMatchObject({ state: "red", reason: "Left out by the purchasing manager." });
    expect(after.summary).toBe("19 of 20 lines ordered. 1 left out.");
    expect(await read<AuditVerification>(await browser.call(verify.GET, "/api/v1/audit/verify"))).toMatchObject({ valid: true });
  });

  it("refuses a second resolution of a resolved line", async () => {
    const milk = lineOf(weekly, "lactose-free UHT skimmed milk");
    expect((await resolve(browser, weekly, milk, optionOf(milk, "approve").id)).status).toBe(400);
  });

  it("orders what is in stock, or the wholesaler's signed split, when a person chooses it", async () => {
    const body = {
      deliverBy: "2026-11-16",
      lines: [
        { words: "Fazer protein oat drink", quantity: { amount: 10, unit: "pcs" }, productId: "474929" },
        { words: "lactose-free UHT skimmed milk", quantity: { amount: 200, unit: "l" }, productId: "462775" },
      ],
    };
    const started = await browser.call(basketsRoute.POST, "/api/v1/baskets", { body });
    const basket = await finished(browser, (await read<{ basketId: string }>(started)).basketId);
    const [protein, milk] = basket.lines;
    expect(protein).toMatchObject({ state: "orange", reasonCode: "partial", reason: "Only 3 in stock. Order what is there?" });
    const take = optionOf(protein, "quantity");
    expect(take.label).toBe("Order 3 now");
    const afterTake = await read<Basket>(await resolve(browser, basket, protein, take.id));
    expect(afterTake.lines[0]).toMatchObject({ state: "green", reason: "Ordered 3 of 10 pcs. 7 pcs not ordered.", packs: expect.stringMatching(/^3 x /) });

    const split = optionOf(milk, "substitute");
    const afterSplit = await read<Basket>(await resolve(browser, basket, milk, split.id));
    expect(afterSplit.lines[1]).toMatchObject({ state: "green", reason: "Swapped by the purchasing manager. Ordered.", packs: "51 x 1 l = 51 l + 149 x 1 l = 149 l" });
    expect(afterSplit.summary).toBe("2 of 2 lines ordered.");
  });

  it("shows the draft with last week's quantities and drift", async () => {
    const draft = DraftSchema.parse(await read<WeeklyDraft>(await browser.call(draftRoute.GET, "/api/v1/baskets/weekly/draft")));
    expect(draft.deliverBy).toBe("2026-11-16");
    expect(draft.lines).toHaveLength(20);
    expect(draft.lines.find((line) => line.words === "butter")).toMatchObject({ change: "more", lastWeek: { amount: 60, unit: "kg" } });
    expect(draft.lines.find((line) => line.words === "Alpro almond drink")?.change).toBe("new");
    expect(draft.drift.map((item) => item.sentence)).toEqual([
      "Oat drink is up 50% in four weeks.",
      "Cream is up 40% in four weeks.",
      "Eggs: 36 kg again, same as the last three weeks.",
    ]);
  });

  it("keeps baskets to their workspace and their buyer", async () => {
    const other = new Browser();
    const elsewhere = await other.call(basketRoute.GET, `/api/v1/baskets/${weekly.id}`, { params: { basketId: weekly.id } });
    expect(elsewhere.status).toBe(404);
    const { agentKeys } = await read<WorkspaceInfo>(await browser.call(workspace.GET, "/api/v1/workspace"));
    const kaislaKey = agentKeys.find((key) => key.buyer.id === BUYER_IDS.kaisla)!.key;
    const asKaisla = await browser.call(basketRoute.GET, `/api/v1/baskets/${weekly.id}`, { params: { basketId: weekly.id }, headers: bearer(kaislaKey) });
    expect(asKaisla.status).toBe(404);
    const list = await read<{ baskets: Basket[] }>(await browser.call(basketsRoute.GET, "/api/v1/baskets", { headers: bearer(kaislaKey) }));
    expect(list.baskets.every((basket) => basket.buyer.id === BUYER_IDS.kaisla)).toBe(true);
  });

  it("starts a basket from an agent key as that key's buyer, marked as from an agent", async () => {
    const { agentKeys } = await read<WorkspaceInfo>(await browser.call(workspace.GET, "/api/v1/workspace"));
    const laineKey = agentKeys.find((key) => key.buyer.id === BUYER_IDS.laine)!.key;
    const body = { deliverBy: "2026-11-16", lines: [{ words: "lactose-free cooking cream", quantity: { amount: 20, unit: "l" } }] };
    const started = await browser.call(basketsRoute.POST, "/api/v1/baskets", { body, headers: bearer(laineKey) });
    expect(started.status).toBe(202);
    const done = await finished(browser, (await read<{ basketId: string }>(started)).basketId, bearer(laineKey));
    expect(done).toMatchObject({ source: "agent", buyer: { id: BUYER_IDS.laine } });
  });

  it("hands a line to a person at Valio Aimo, who answers with an operator session", async () => {
    const draftless = await read<Basket>(await browser.call(basketRoute.GET, `/api/v1/baskets/${weekly.id}`, { params: { basketId: weekly.id } }));
    const butter = lineOf(draftless, "butter");
    const created = await browser.call(handoffsRoute.POST, "/api/v1/handoffs", {
      body: { basketId: weekly.id, lineId: butter.id, words: "Can you hold the butter price until Monday?" },
    });
    expect(created.status).toBe(201);
    const handoff = await read<Handoff>(created);
    expect(handoff).toMatchObject({ status: "open", from: "Purchasing manager", openHours: { open: false } });
    // The butter was approved above: nothing waits, so nothing is said to be safe.
    expect(handoff.openHours.sentence).toBe("Valio Aimo answers on Monday from 8:00.");

    expect((await browser.call(handoffsRoute.GET, "/api/v1/handoffs", { headers: bearer(AGENT_TOKEN) })).status).toBe(403);
    const refused = await browser.call(answerRoute.POST, `/api/v1/handoffs/${handoff.id}/answer`, { body: { words: "Yes." }, params: { handoffId: handoff.id } });
    expect(refused.status).toBe(403);

    await browser.call(session.POST, "/api/v1/console/session", { body: { demo: true, role: "operator" } });
    const answered = await read<Handoff>(await browser.call(answerRoute.POST, `/api/v1/handoffs/${handoff.id}/answer`, {
      body: { words: "Yes, held until Monday 16:00." },
      params: { handoffId: handoff.id },
    }));
    expect(answered).toMatchObject({ status: "answered", answer: { words: "Yes, held until Monday 16:00." } });
    const other = new Browser();
    expect((await read<{ handoffs: Handoff[] }>(await other.call(handoffsRoute.GET, "/api/v1/handoffs"))).handoffs).toHaveLength(0);
  });

  it("counts basket lines and open hand-offs in the wholesaler overview", async () => {
    const view = await read<SupplierOverview>(await browser.call(overview.GET, "/api/v1/supplier/overview"));
    expect(view.baskets?.count).toBeGreaterThanOrEqual(13);
    // Lines a person approved, swapped or left out do not count as ordered without a person.
    expect(view.baskets?.autoShare).toBeGreaterThan(0.7);
    expect(view.baskets?.autoShare).toBeLessThan(0.9);
    expect(view.handoffs).toEqual({ open: 0 });
  });

  it("refuses a basket without any credential", async () => {
    const response = await basketsRoute.POST(jsonRequest("/api/v1/baskets", { body: { deliverBy: "2026-11-16", lines: [{ words: "milk", quantity: { amount: 1, unit: "l" } }] } }));
    expect(response.status).toBe(401);
  });
});
