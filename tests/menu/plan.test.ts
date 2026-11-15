import { describe, expect, it } from "vitest";
import { MenuPlan, type MenuOption } from "@/lib/contracts";
import { fixtureCatalog } from "@/lib/catalog";
import { RECIPES } from "@/lib/recipes";
import { BUYER_IDS, defaultMandate } from "@/lib/mandate";
import { evaluate } from "@/lib/policy";
import { basketFor } from "@/lib/assistant";
import { recommendedMenu } from "@/lib/assistant/cards";
import { deliverByFor } from "@/lib/menu-console/format";
import { input as policyInput, line as policyLine, offer as policyOffer } from "../policy/fixtures";
import { plan, sentences, wordCount } from "./support";

const catalog = fixtureCatalog();
const NUTS = ["nuts", "almond", "peanut"];
const GLUTEN = ["gluten", "wheat", "rye", "barley", "spelt"];

function productsOf(menu: MenuOption) {
  return menu.shoppingList.flatMap((line) => (line.product && line.toOrder.amount > 0 ? [catalog.get(line.product.id)!] : []));
}

function mains(menu: MenuOption): string[] {
  return menu.courses.filter((course) => course.course === "main").map((course) => course.recipe.id);
}

describe("planning a menu: need -> recipe -> order", () => {
  it("reads 'Dinner for 80 on Friday, no nuts' and returns three different menus, good to best by cost per guest", async () => {
    const result = MenuPlan.parse(await plan({ words: "Dinner for 80 on Friday, no nuts" }));
    expect(result.understood).toBe("A dinner for 80 guests on Friday 20 Nov, no nuts.");
    expect(result.event).toEqual({ guests: 80, date: "2026-11-20", occasion: "dinner", dietary: ["nut_free"] });
    expect(result.menus.map((menu) => menu.tier)).toEqual(["good", "better", "best"]);
    const costs = result.menus.map((menu) => menu.costPerGuest);
    expect([...costs].sort((a, b) => a - b)).toEqual(costs);
    expect(new Set(result.menus.map((menu) => menu.id)).size).toBe(3);
    const allMains = result.menus.flatMap(mains);
    expect(new Set(allMains).size).toBe(allMains.length);
    for (const menu of result.menus) {
      expect(menu.costPerGuest).toBeGreaterThan(0);
      expect(menu.shoppingList.length).toBeGreaterThan(0);
      expect(menu.fits).toContainEqual(menu.unpriced ? { ok: false, sentence: "No nuts in any dish so far. Check the open ingredients." } : { ok: true, sentence: "No nuts in any dish." });
    }
    expect(result.notes).toContain("Prices are indicative net prices. You get signed prices when you order.");
  });

  it("never serves a dish or buys a product with nuts when the event says no nuts", async () => {
    for (const words of ["Dinner for 80 on Friday, no nuts", "80 hengen illallinen perjantaina, ei pähkinää"]) {
      const result = await plan({ words });
      for (const menu of result.menus) {
        for (const { recipe } of menu.courses) expect(recipe.allergens.filter((a) => NUTS.includes(a))).toEqual([]);
        for (const product of productsOf(menu)) {
          expect([...product.allergens.contains, ...product.allergens.mayContain].filter((a) => NUTS.includes(a))).toEqual([]);
        }
      }
    }
  });

  it("makes every dish gluten-free for coeliac guests, by swaps it states, or leaves the dish out and says why", async () => {
    const result = await plan({ words: "Wedding dinner for 80 on Friday, two guests are coeliac, no nuts" });
    expect(result.event.dietary).toEqual(["nut_free", "gluten_free"]);
    for (const menu of result.menus) {
      for (const { recipe } of menu.courses) expect(recipe.labels).toContain("gluten_free");
      for (const product of productsOf(menu)) {
        expect([...product.allergens.contains, ...product.allergens.mayContain].filter((a) => GLUTEN.includes(a))).toEqual([]);
      }
      expect(menu.fits).toContainEqual(
        menu.unpriced ? { ok: false, sentence: "Every dish is gluten-free so far. Check the open ingredients." } : { ok: true, sentence: "Every dish is gluten-free." },
      );
    }
    const swaps = result.menus.flatMap((menu) => menu.shoppingList.flatMap((line) => (line.swap ? [line.swap] : [])));
    for (const swap of swaps) expect(swap.reason.length).toBeGreaterThan(10);
    expect(result.menus.flatMap((menu) => menu.warnings).some((warning) => / left out\. /.test(warning))).toBe(true);
  });

  it.each([
    ["We have a wedding on Saturday with 80 guests. Three courses."],
    ["Meillä on häät lauantaina, 80 vierasta, kolme ruokalajia"],
  ])("plans the mentor's wedding as one three-course dinner with cream cake: %s", async (words) => {
    const result = await plan({ words });
    expect(result.understood).toBe("A wedding for 80 guests on Saturday 21 Nov, three courses.");
    const threeCourse = result.menus.find((menu) => menu.id.startsWith("menu:three_course:"))!;
    expect(threeCourse.courses.map((course) => course.course)).toEqual(["starter", "main", "side", "dessert"]);
    const dessert = threeCourse.courses.find((course) => course.course === "dessert")!.recipe;
    expect(`${dessert.name} ${dessert.nameFi}`).toMatch(/cake|kakku/i);
    expect(dessert.source?.name).toBe("Valio");
    expect(result.notes).toContain("You asked for three courses: see the three-course menu.");
  });

  it("scales the shopping list to the guests and takes the kitchen's stock off the order", async () => {
    const result = await plan({ guests: 80, date: "2026-11-20", occasion: "dinner" });
    for (const line of result.menus.flatMap((menu) => menu.shoppingList)) {
      const have = line.inPantry?.amount ?? 0;
      if (!line.swap) expect(line.toOrder.amount).toBeCloseTo(Math.max(0, Math.round((line.quantity.amount - have) * 10) / 10), 5);
    }
    const stocked = result.menus.flatMap((menu) => menu.shoppingList).filter((line) => (line.inPantry?.amount ?? 0) > 0);
    expect(stocked.length).toBeGreaterThan(0);
    expect(result.notes).toContain("Amounts include 5 % for waste, rounded up.");
  });

  it("flags what cannot arrive for an event tomorrow and swaps by recipe logic from the kitchen's stock", async () => {
    const result = await plan({ words: "Unexpected booking: dinner for 40 tomorrow" });
    expect(result.event.date).toBe("2026-11-15");
    const lines = result.menus.flatMap((menu) => menu.shoppingList);
    expect(lines.some((line) => line.availability === "missing")).toBe(true);
    const fromStock = lines.filter((line) => line.swap?.reason.includes("in stock"));
    expect(fromStock.length).toBeGreaterThan(0);
    expect(fromStock.every((line) => line.availability === "ok" && line.toOrder.amount === 0)).toBe(true);
    for (const menu of result.menus) {
      expect(menu.warnings).toContain("The event is very soon. Some items cannot arrive in time.");
      expect(menu.fits.find((fit) => fit.sentence.includes("cannot arrive"))?.ok).toBe(false);
    }
  });

  it("keeps a school kitchen's menu free of sesame, peanut and nuts, traces included, under its own mandate", async () => {
    const result = await plan({ words: "School lunch for 120 pupils on Thursday" }, "kaisla");
    for (const menu of result.menus) {
      for (const product of productsOf(menu)) {
        const all = [...product.allergens.contains, ...product.allergens.mayContain];
        expect(all.filter((a) => ["sesame", "peanut", "nuts", "almond"].includes(a)), product.name.en).toEqual([]);
      }
      expect(menu.fits).toContainEqual(
        menu.unpriced
          ? { ok: false, sentence: "Every matched product meets your allergen rules. Check the open ingredients." }
          : { ok: true, sentence: "Every product meets your allergen rules." },
      );
      for (const { recipe } of menu.courses) expect(recipe.id).not.toBe("goat-cheese-crostini");
    }
  });

  it("serves only vegan dishes for a vegan event", async () => {
    const result = await plan({ guests: 30, date: "2026-11-20", dietary: ["vegan"] });
    for (const menu of result.menus) {
      for (const { recipe } of menu.courses) expect(recipe.labels).toContain("vegan");
      expect(menu.fits).toContainEqual(menu.unpriced ? { ok: false, sentence: "Every dish is vegan so far. Check the open ingredients." } : { ok: true, sentence: "Every dish is vegan." });
    }
  });

  it("states honestly when the menu is over the budget per guest", async () => {
    const result = await plan({ guests: 80, date: "2026-11-20", budgetPerGuest: 1 });
    const best = result.menus.find((menu) => menu.tier === "best")!;
    expect(best.fits.at(-1)?.ok).toBe(false);
    expect(best.fits.at(-1)?.sentence).toMatch(/^[\d.,]+ EUR per guest over your budget\.$/);
  });

  it("speaks in short sentences: none longer than 14 words", async () => {
    const plans = await Promise.all([
      plan({ words: "Wedding dinner for 80 on Friday, two guests are coeliac, no nuts" }),
      plan({ words: "Unexpected booking: dinner for 40 tomorrow" }),
      plan({ words: "Lunch for 120 on Thursday, vegan" }, "kaisla"),
    ]);
    for (const sentence of plans.flatMap(sentences)) expect(wordCount(sentence), sentence).toBeLessThanOrEqual(14);
  });

  it("asks for the guest count instead of failing, saying what it read", async () => {
    const result = MenuPlan.parse(await plan({ words: "School lunch on Thursday, no nuts or sesame" }));
    expect(result).toMatchObject({
      understood: "A school lunch on Thursday 19 Nov, no nuts and no sesame.",
      event: { date: "2026-11-19", occasion: "school lunch", dietary: ["nut_free", "sesame_free"] },
      needs: ["guests"],
      question: "How many guests?",
      menus: [],
    });
    expect(result.event.guests).toBeUndefined();
  });

  it("refuses a date that has passed, in plain words", async () => {
    await expect(plan({ guests: 10, date: "2026-11-01" })).rejects.toThrow(/has passed/);
  });

  it("gives the food cost per guest of every ingredient, apart from what remains to order", async () => {
    const result = await plan({ words: "Dinner for 80 on Friday, no nuts" });
    for (const menu of result.menus) {
      expect(menu.totalNet).toBeCloseTo(menu.costPerGuest * 80, 0);
      const ordered = menu.shoppingList.reduce((sum, line) => sum + (line.estNet ?? 0), 0);
      expect(menu.toOrderNet).toBeCloseTo(ordered, 2);
      expect(menu.warnings.filter((warning) => warning.startsWith("No price"))).toEqual([]);
      for (const line of menu.shoppingList.filter((entry) => entry.toOrder.amount > 0)) expect(line.estNet, line.words).toBeGreaterThan(0);
    }
    // Stock is in the food cost but not in what remains to order.
    const stocked = result.menus.flatMap((menu) => menu.shoppingList).filter((line) => line.inPantry && line.toOrder.amount === 0);
    expect(stocked.length).toBeGreaterThan(0);
    expect(stocked.every((line) => line.estNet === undefined)).toBe(true);
  });

  it("serves at a wedding only dishes tagged for celebrations", async () => {
    const result = await plan({ words: "We have a wedding on Saturday with 80 guests. Three courses." });
    const tagged = new Set(RECIPES.filter((recipe) => recipe.occasions.includes("celebration")).map((recipe) => recipe.id));
    for (const menu of result.menus) for (const { recipe } of menu.courses) expect(tagged.has(recipe.id), recipe.name).toBe(true);
    expect(result.menus.flatMap((menu) => menu.courses.map((course) => course.recipe.id))).not.toContain("gram-pancakes");
  });

  it("gives every product a display name in sentence case", async () => {
    const result = await plan({ words: "Dinner for 80 on Friday" });
    const products = result.menus.flatMap((menu) => menu.shoppingList.flatMap((line) => (line.product ? [line.product] : [])));
    for (const product of products) expect(product.displayName).not.toMatch(/^[A-Z]{2,} [A-Z]{2,}/);
  });

  it("plans a week ahead when no date is given, and says so", async () => {
    const result = await plan({ words: "Buffet for 50, no nuts" });
    expect(result.event.date).toBe("2026-11-21");
    expect(result.notes).toContain("No date given. Planned for Sat 21 Nov.");
  });

  it("uses only recipes from the library", async () => {
    const ids = new Set(RECIPES.map((recipe) => recipe.id));
    const result = await plan({ words: "Dinner for 80 on Friday" });
    for (const menu of result.menus) for (const { recipe } of menu.courses) expect(ids.has(recipe.id)).toBe(true);
  });
});

describe("event changes", () => {
  it("says what changes when the guest count drops on the same menu", async () => {
    const first = await plan({ words: "We have a wedding on Saturday with 80 guests. Three courses." });
    const chosen = first.menus.find((menu) => menu.id.startsWith("menu:three_course:"))!;
    const second = await plan({ guests: 72, date: "2026-11-21", occasion: "wedding", previous: { menuId: chosen.id, guests: 80 } });
    const same = second.menus.find((menu) => menu.id === chosen.id)!;
    expect(same.changes?.sentence).toMatch(/^72 guests instead of 80: \d+ lines get smaller\.$/);
    expect(same.changes?.lines.every((line) => line.to.amount < line.from.amount)).toBe(true);
    const other = second.menus.find((menu) => menu.id !== chosen.id)!;
    expect(other.changes?.sentence).toMatch(/other dishes/);
  });

  it("ignores a previous menu id it did not make", async () => {
    const result = await plan({ guests: 80, date: "2026-11-20", previous: { menuId: "not-a-menu", guests: 60 } });
    expect(result.menus.every((menu) => menu.changes === undefined)).toBe(true);
    expect(result.notes).toContain("That earlier menu id is unknown, so no changes are shown.");
  });
});

describe("planner logic", () => {
  it("names its own delivery day, and both order paths use it for an event tomorrow", async () => {
    const result = MenuPlan.parse(await plan({ guests: 20, date: "2026-11-15", occasion: "dinner" }));
    expect(result.deliverBy).toBe("2026-11-15");
    expect(result.notes).toContain("Delivery by Sunday 15 Nov, the day itself.");
    const option = result.menus[0];
    expect(basketFor(result, option, "2026-11-14").deliverBy).toBe("2026-11-15");
    expect(deliverByFor(result, "2026-11-14")).toBe("2026-11-15");
    const later = await plan({ guests: 20, date: "2026-11-21", occasion: "dinner" });
    expect(later.deliverBy).toBe("2026-11-20");
    expect(basketFor(later, later.menus[0], "2026-11-14").deliverBy).toBe("2026-11-20");
  });

  it("chooses products that carry the kitchen's required labels, and says honestly when one cannot", async () => {
    const base = defaultMandate(BUYER_IDS.nordicHarbour);
    const strict = { ...base, dietary: { ...base.dietary, requiredClaims: ["lactose_free"] } };
    const loose = await plan({ words: "Dinner for 80 on Friday" });
    const result = await plan({ words: "Dinner for 80 on Friday" }, "nordicHarbour", { mandate: strict });
    const carried = (menus: MenuOption[]) => menus.flatMap(productsOf).filter((product) => product.claims.includes("lactose_free")).length;
    expect(carried(result.menus)).toBeGreaterThanOrEqual(carried(loose.menus));
    for (const menu of result.menus) {
      const products = productsOf(menu);
      const fit = menu.fits.find((entry) => /lactose-free/.test(entry.sentence) && !/dish/.test(entry.sentence))!;
      expect(fit, menu.name).toBeDefined();
      const policy = evaluate(policyInput({ mandate: strict, products, offer: policyOffer({}, products.map((p) => policyLine({ productId: p.id, name: p.name.en }))) }));
      const blocked = policy.checks.find((check) => check.rule === "dietary.claims")!.status === "block";
      expect(fit.ok, fit.sentence).toBe(!blocked);
      expect(fit.sentence).toEqual(blocked ? expect.stringMatching(/^\d+ products? (?:is|are) not labelled lactose-free\. Your rules block (?:it|them)\.$/) : "Every product is lactose-free.");
    }
    expect(loose.menus.every((menu) => !menu.fits.some((entry) => /labelled/.test(entry.sentence)))).toBe(true);
  });

  it("keeps a main course in every menu by reusing one, and never offers a menu without a main as suggested", async () => {
    const result = await plan({ words: "Lunch for 40 on Tuesday, vegetarian" });
    for (const menu of result.menus) expect(mains(menu).length, menu.name).toBeGreaterThan(0);
    const none = await plan({ guests: 40, date: "2026-11-20", dietary: ["vegan", "gluten_free", "soy_free", "egg_free"] });
    const incomplete = none.menus.filter((menu) => mains(menu).length === 0);
    for (const menu of incomplete) expect(menu.fits).toContainEqual({ ok: false, sentence: "No main course fits your rules." });
    const order = none.menus.map((menu) => mains(menu).length === 0);
    expect(order).toEqual([...order].sort((a, b) => Number(a) - Number(b)));
    const suggested = recommendedMenu(none, { guests: 40, dietary: ["vegan"] });
    if (suggested) expect(mains(suggested).length).toBeGreaterThan(0);
  });

  it("says plainly when the cost per guest leaves out items it could not price", async () => {
    const result = MenuPlan.parse(await plan({ words: "Wedding dinner for 80 on Saturday, no nuts" }));
    const noted = result.menus.filter((menu) => menu.costNote);
    expect(noted.length).toBeGreaterThan(0);
    for (const menu of noted) {
      expect(menu.unpriced).toBeGreaterThan(0);
      expect(menu.costNote).toBe(`The cost leaves out ${menu.unpriced} ${menu.unpriced === 1 ? "item" : "items"} we could not price.`);
    }
    for (const menu of result.menus.filter((entry) => !entry.costNote)) expect(menu.unpriced ?? 0).toBe(0);
  });

  it("names lines to buy separately in English when the recipe line has an English name", async () => {
    const result = await plan({ words: "Lunch for 40 on Tuesday, vegetarian" });
    const separate = result.menus.flatMap((menu) => menu.warnings).filter((warning) => warning.startsWith("Buy separately"));
    for (const warning of separate) expect(warning).not.toMatch(/kuohukerma/);
    expect(result.menus.flatMap((menu) => menu.warnings)).not.toContain("1 line has no product here. They are not in the cost.");
  });

  it("serves festive dishes at a Christmas party and a wedding: no pizza, kebab or plain mince sauce", async () => {
    for (const words of ["Christmas party for 40 on Friday", "Pikkujoulut 60 hengelle perjantaina", "Wedding dinner for 80 on Saturday, no nuts"]) {
      const result = await plan({ words });
      for (const menu of result.menus) {
        for (const { recipe } of menu.courses) expect(`${recipe.name}`, `${words}: ${menu.name}`).not.toMatch(/pizza|kebab|minced meat sauce|nacho/i);
      }
    }
  });

  it("varies the side between the menus and never serves a pancake as the side of a dinner", async () => {
    for (const words of ["Dinner for 40 on Friday", "Wedding dinner for 80 on Saturday, no nuts"]) {
      const result = await plan({ words });
      const sides = result.menus.flatMap((menu) => menu.courses.filter((course) => course.course === "side").map((course) => course.recipe.id));
      expect(new Set(sides).size, `${words}: ${sides.join(", ")}`).toBeGreaterThan(1);
      expect(sides).not.toContain("valio-blinipannari");
    }
  });
});

describe("menu checks with ingredients still open", () => {
  it("lists the open ingredients first and speaks only for the matched products", async () => {
    const result = await plan({ guests: 80, date: "2026-11-20" });
    const open = result.menus.filter((menu) => menu.unpriced);
    for (const menu of open) {
      expect(menu.fits[0].ok).toBe(false);
      expect(menu.fits[0].sentence).toMatch(/no matching product yet/);
      expect(menu.fits.map((fit) => fit.sentence)).not.toContain("The total is inside your weekly limit.");
      expect(menu.fits.some((fit) => fit.sentence.startsWith("Everything can arrive"))).toBe(false);
    }
  });
});
