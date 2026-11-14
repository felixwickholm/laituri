import { beforeEach, describe, expect, it, vi } from "vitest";
import { AssistantTurn, type AssistantTurnRequest, type MenuOption, type MenuPlan, type MenuPlanRequest } from "@/lib/contracts";
import { assistantTurn, basketFor, type ModelReading, type Reader } from "@/lib/assistant";
import { recommendedMenu } from "@/lib/assistant/cards";
import { readTurn } from "@/lib/assistant/rules";
import { inWorkspace } from "@/lib/workspace/context";
import { newWorkspace } from "@/lib/workspace/context";
import { createMemoryStore } from "@/lib/store/memory";
import { BUYER_IDS } from "@/lib/mandate";
import { pantryFor } from "@/lib/pantry";
import { NOW, plan } from "../menu/support";

const BUYER = BUYER_IDS.nordicHarbour;
let workspace = newWorkspace({ id: "t", kind: "sandbox", label: "test", store: createMemoryStore() });

beforeEach(() => {
  workspace = newWorkspace({ id: `t${Math.random()}`, kind: "sandbox", label: "test", store: createMemoryStore() });
});

function deps(reader?: Reader, planner = (request: MenuPlanRequest) => plan(request)) {
  return { now: NOW, reader, plan: vi.fn(planner), pantryWords: pantryFor(BUYER).map((item) => item.words) };
}

async function say(words: string, conversationId?: string, d = deps(), extra: Partial<AssistantTurnRequest> = {}) {
  const turn = await inWorkspace(workspace, () => assistantTurn({ words, conversationId, ...extra }, BUYER, d));
  return AssistantTurn.parse(turn);
}

function sentences(text: string): number {
  return text.split(/(?<=[.?!])\s+/).filter(Boolean).length;
}

describe("event assistant, rules only", () => {
  it("plans menus from one Finnish sentence and answers in Finnish", async () => {
    const turn = await say("Meillä on häät lauantaina, 80 vierasta, kaksi keliaakikkoa");
    expect(turn.engine).toBe("rules");
    expect(turn.language).toBe("fi");
    const menus = turn.cards.filter((card) => card.kind === "menu");
    expect(menus).toHaveLength(3);
    expect(turn.reply).toMatch(/^3 menua 80 vieraalle lauantaina 21\.11\., gluteeniton\./);
    expect(sentences(turn.reply)).toBeLessThanOrEqual(2);
    const recommended = menus.find((card) => card.kind === "menu" && card.recommended);
    expect(recommended && recommended.kind === "menu" && recommended.id).toMatch(/^menu:three_course:/);
    expect(turn.cards.some((card) => card.kind === "shopping")).toBe(true);
    expect(turn.actions.filter((action) => action.kind === "order_menu")).toHaveLength(3);
  });

  it("asks only for what it needs, once, then plans", async () => {
    const first = await say("We have a wedding coming up");
    expect(first.language).toBe("en");
    expect(first.asks).toEqual(["guests", "date"]);
    expect(first.reply).toBe("How many guests, and on which day?");
    expect(first.cards.filter((card) => card.kind === "menu")).toHaveLength(0);
    const second = await say("80", first.conversationId);
    expect(second.cards.filter((card) => card.kind === "menu")).toHaveLength(3);
    expect(second.asks).toEqual(["diets"]);
    expect(second.reply).toMatch(/Any allergies or special diets\?$/);
    const third = await say("No allergies", first.conversationId);
    expect(third.asks).toBeUndefined();
  });

  it("chooses a menu by words, then orders it with one sentence", async () => {
    const first = await say("Wedding for 80 on Saturday, no nuts");
    const id = first.conversationId;
    const chosen = await say("The classic one", id);
    const card = chosen.cards.find((entry) => entry.kind === "menu" && entry.chosen);
    expect(card && card.kind === "menu" && card.tier).toBe("better");
    expect(chosen.reply).toMatch(/Shall I order it\?$/);
    const order = await say("Order it", id);
    const action = order.actions.find((entry) => entry.kind === "order_menu" && entry.now);
    expect(action?.kind).toBe("order_menu");
    if (action?.kind !== "order_menu") return;
    expect(action.menuId).toBe(card && card.kind === "menu" ? card.id : "");
    expect(action.basket.source).toBe("menu");
    expect(action.basket.deliverBy).toBe("2026-11-20");
    expect(action.basket.lines.length).toBeGreaterThan(0);
    for (const line of action.basket.lines) expect(line.quantity.amount).toBeGreaterThan(0);
  });

  it("a tapped menu is chosen without words", async () => {
    const first = await say("Dinner for 40 tomorrow, no allergies");
    const menu = first.cards.find((card) => card.kind === "menu" && card.tier === "best");
    const tapped = await say("Special", first.conversationId, deps(), { menuId: menu && menu.kind === "menu" ? menu.id : "" });
    expect(tapped.cards.find((card) => card.kind === "menu" && card.chosen)).toMatchObject({ tier: "best" });
  });

  it("shows what changes when the guest count moves", async () => {
    const first = await say("Wedding for 80 on Saturday, gluten-free");
    const second = await say("Actually 72 guests", first.conversationId);
    expect(second.reply).toMatch(/^Updated from 80 to 72 guests\./);
    const changed = second.cards.find((card) => card.kind === "menu" && card.changes);
    expect(changed && changed.kind === "menu" && changed.changes).toMatch(/72 guests instead of 80/);
  });

  it("finds recipes, safe for the stated diets", async () => {
    const first = await say("Lunch for 30 on Friday, gluten-free");
    const recipes = await say("Show me a salmon recipe", first.conversationId);
    const cards = recipes.cards.filter((card) => card.kind === "recipe");
    expect(cards.length).toBeGreaterThan(0);
    for (const card of cards) if (card.kind === "recipe") expect(card.labels).toContain("gluten_free");
    expect(recipes.actions.some((action) => action.kind === "open_recipe")).toBe(true);
  });

  it("starts with ideas and example sentences when nothing is known", async () => {
    const turn = await say("hello");
    expect(turn.reply).toBe("Tell me about the event: what it is, how many guests and when.");
    expect(turn.actions.filter((action) => action.kind === "reply").length).toBeGreaterThan(0);
    const ideas = await say("What should we serve?", turn.conversationId);
    expect(ideas.cards.filter((card) => card.kind === "recipe").length).toBeGreaterThan(0);
  });

  it("keeps the conversation bounded and per buyer", async () => {
    let id: string | undefined;
    for (let at = 0; at < 12; at += 1) id = (await say(at % 2 ? "80" : "hello", id)).conversationId;
    const last = await say("hello", id);
    expect(last.turns.length).toBeLessThanOrEqual(4);
    const other = await inWorkspace(workspace, () => assistantTurn({ words: "hello", conversationId: id }, BUYER_IDS.kaisla, deps()));
    expect(other.conversationId).not.toBe(id);
  });

  it("answers 429 after too many turns in the window", async () => {
    const d = deps();
    let error: unknown;
    try {
      for (let at = 0; at < 50; at += 1) await say("hello", undefined, d);
    } catch (caught) {
      error = caught;
    }
    expect(error).toMatchObject({ status: 429, code: "rate_limited" });
  });
});

describe("event assistant with a model", () => {
  const reading = (value: Partial<ModelReading>): Reader => ({
    model: "gemini-test",
    read: vi.fn(async () => ({ language: "en", intent: "event", dietary: [], ...value }) as ModelReading),
  });

  it("uses the model's reading, keeps every need the rules read, and never lets it set facts", async () => {
    const reader = reading({ language: "en", intent: "event", guests: 60, occasion: "birthday", dietary: ["lactose_free"], opener: "Happy birthday!" });
    const d = deps(reader);
    const turn = await say("Birthday party, sixty-ish people on Friday, no nuts please", undefined, d);
    expect(turn.engine).toBe("gemini");
    expect(turn.model).toBe("gemini-test");
    const event = turn.cards.find((card) => card.kind === "event");
    expect(event).toMatchObject({ guests: 60, occasion: "birthday" });
    expect(event && event.kind === "event" && event.dietary).toEqual(expect.arrayContaining(["nut_free", "lactose_free"]));
    expect(d.plan).toHaveBeenCalledWith(expect.objectContaining({ guests: 60, dietary: expect.arrayContaining(["nut_free", "lactose_free"]) }));
    // Prices in the reply are the planner's.
    const menus = turn.cards.filter((card) => card.kind === "menu");
    const recommended = menus.find((card) => card.kind === "menu" && card.recommended);
    expect(turn.reply).toContain(recommended && recommended.kind === "menu" ? `€${recommended.costPerGuest.toFixed(2)}` : "missing");
  });

  it("puts the model's opener only in front of a question", async () => {
    const turn = await say("We are planning a wedding", undefined, deps(reading({ intent: "event", occasion: "wedding", opener: "Congratulations!" })));
    expect(turn.reply).toBe("Congratulations! How many guests, and on which day?");
  });

  it("falls back to the rules when the model fails", async () => {
    const broken: Reader = { model: "gemini-test", read: vi.fn(async () => { throw new Error("down"); }) };
    const turn = await say("Häät lauantaina 80 vierasta", undefined, deps(broken));
    expect(turn.engine).toBe("rules");
    expect(turn.cards.filter((card) => card.kind === "menu")).toHaveLength(3);
  });
});

describe("event assistant logic", () => {
  it("reads 'ihmiselle' as a guest count, and asks for a person only on whole phrases", () => {
    expect(readTurn("Häät lauantaina 80 ihmiselle", "2026-11-14", "fi", false)).toMatchObject({ intent: "event", guests: 80 });
    expect(readTurn("Hääjuhla 120 vieraalle 5.6.", "2026-11-14", "fi", false)).toMatchObject({ intent: "event", guests: 120 });
    for (const words of ["Haluan puhua ihmisen kanssa", "Voinko puhua myyjän kanssa?", "I want to talk to a person", "Can I speak to a human?"]) {
      expect(readTurn(words, "2026-11-14", "en", false).intent, words).toBe("human");
    }
  });

  it("reads 'budget 15 € per guest' as a budget, not 15 guests", () => {
    expect(readTurn("budget 15 € per guest", "2026-11-14", "en", false)).toMatchObject({ guests: undefined, budgetPerGuest: 15 });
  });

  it("writes a Finnish date without a double period", async () => {
    const turn = await say("Häät lauantaina 80 vierasta, ei allergioita");
    expect(turn.reply).not.toMatch(/\.\./);
    expect(turn.reply).toMatch(/lauantaina 21\.11\. /);
  });

  it("orders kitchen amounts in kilograms and litres, and delivers when the plan says", async () => {
    const planned = await plan({ guests: 20, date: "2026-11-15", occasion: "dinner" });
    const option = planned.menus[0];
    const grams = { ...option.shoppingList[0], toOrder: { amount: 500, unit: "g" }, quantity: { amount: 500, unit: "g" } } as unknown as MenuOption["shoppingList"][number];
    const decilitres = { ...option.shoppingList[0], words: "milk", toOrder: { amount: 15, unit: "dl" } } as unknown as MenuOption["shoppingList"][number];
    const basket = basketFor(planned, { ...option, shoppingList: [grams, decilitres] }, "2026-11-14");
    expect(basket.lines.map((line) => line.quantity)).toEqual([{ amount: 0.5, unit: "kg" }, { amount: 1.5, unit: "l" }]);
    expect(basket.deliverBy).toBe("2026-11-15");
  });

  it("recommends the best menu within the budget, and the middle one without a budget", () => {
    const menu = (tier: MenuOption["tier"], kind: string, cost: number, main = true) =>
      ({ id: `menu:${kind}:1`, tier, costPerGuest: cost, courses: main ? [{ course: "main", recipe: {} }] : [] }) as unknown as MenuOption;
    const planned = { menus: [menu("good", "buffet", 2), menu("better", "two_course", 4), menu("best", "three_course", 6)] } as unknown as MenuPlan;
    expect(recommendedMenu(planned, { dietary: [], budgetPerGuest: 5 })?.tier).toBe("better");
    expect(recommendedMenu(planned, { dietary: [], budgetPerGuest: 10 })?.tier).toBe("best");
    expect(recommendedMenu(planned, { dietary: [] })?.tier).toBe("better");
    const noMain = { menus: [menu("good", "buffet", 2), menu("better", "two_course", 4, false), menu("best", "three_course", 6)] } as unknown as MenuPlan;
    expect(recommendedMenu(noMain, { dietary: [], budgetPerGuest: 5 })?.tier).toBe("good");
    expect(recommendedMenu(noMain, { dietary: [] })?.tier).not.toBe("better");
  });

  it("does not present a cost with unpriced items as the full food cost, in either language", async () => {
    const en = await say("Wedding for 80 on Saturday, no allergies");
    const recommended = en.cards.find((card) => card.kind === "menu" && card.recommended);
    const planned = await plan({ guests: 80, date: "2026-11-21", occasion: "wedding", dietary: [] });
    const option = planned.menus.find((menu) => recommended?.kind === "menu" && menu.id === recommended.id)!;
    expect(option.unpriced).toBeGreaterThan(0);
    expect(en.reply).toContain(`not counting ${option.unpriced} items without a price`);
    const fi = await say("Häät lauantaina 80 vierasta, ei allergioita");
    expect(fi.reply).toContain(`ilman ${option.unpriced} hinnatonta tuotetta`);
  });

  it("suggests no menu, and says why, when no menu has a main course", async () => {
    const noMains = async (request: MenuPlanRequest) => {
      const planned = await plan(request);
      return { ...planned, menus: planned.menus.map((menu) => ({ ...menu, courses: menu.courses.filter((course) => course.course !== "main") })) };
    };
    const turn = await say("Dinner for 40 on Friday, no allergies", undefined, deps(undefined, noMains));
    expect(turn.reply).toBe("No menu has a main course that fits your rules. Change one detail.");
    expect(turn.cards.some((card) => card.kind === "menu" && card.recommended)).toBe(false);
    const order = await say("Order it", turn.conversationId, deps(undefined, noMains));
    expect(order.actions.some((action) => action.kind === "order_menu" && action.now)).toBe(false);
  });
});
