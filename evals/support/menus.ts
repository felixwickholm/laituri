import { Basket, MenuPlan, type MenuOption } from "@/lib/contracts";
import { fixtureCatalog } from "@/lib/catalog";
import type { EvalCase, Verdict } from "../harness";
import { Checks } from "./checks";
import { auditVerifies } from "./flow";
import { AGENT_AUTH, get, post } from "./router";

const KAISLA_AUTH = { authorization: "Bearer demo-kaisla-token" };
const catalog = fixtureCatalog();
const MAX_POLLS = 200;

async function planned(body: unknown, headers: Record<string, string>, checks: Checks): Promise<MenuPlan | undefined> {
  const reply = await post("/api/v1/menus/plan", body, headers);
  const parsed = MenuPlan.safeParse(reply.body);
  checks.expect(reply.status === 200 && parsed.success, `plan answered ${reply.status}`);
  return parsed.success ? parsed.data : undefined;
}

function threeCourse(plan: MenuPlan): MenuOption | undefined {
  return plan.menus.find((menu) => menu.id.startsWith("menu:three_course:"));
}

function allergensOf(productId: string): string[] {
  const product = catalog.get(productId);
  return product ? [...product.allergens.contains, ...product.allergens.mayContain] : [];
}

function longest(texts: string[]): number {
  return Math.max(0, ...texts.flatMap((text) => text.split(/(?<=[.?!])\s+/)).map((sentence) => sentence.split(/\s+/).length));
}

/** Polls the basket until every line has finished. The evals run with no pause between steps. */
async function finished(basketId: string): Promise<Basket | undefined> {
  for (let poll = 0; poll < MAX_POLLS; poll++) {
    const parsed = Basket.safeParse((await get(`/api/v1/baskets/${basketId}`, AGENT_AUTH)).body);
    if (parsed.success && parsed.data.status === "done") return parsed.data;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  return undefined;
}

/** Need -> recipe -> order: plan a nut-free dinner for 80, take the three-course menu, order its list as one basket. */
async function needRecipeOrder(): Promise<Verdict> {
  const checks = new Checks();
  const plan = await planned({ words: "Dinner for 80 on Friday, no nuts" }, AGENT_AUTH, checks);
  const menu = plan && threeCourse(plan);
  if (!plan || !checks.expect(Boolean(menu), "no three-course menu")) return checks.verdict("no menu");
  const lines = menu!.shoppingList
    .filter((line) => line.toOrder.amount > 0)
    .map((line) => ({ words: line.swap?.words ?? line.words, quantity: line.toOrder, ...(line.product ? { productId: line.product.id } : {}) }));
  const started = await post("/api/v1/baskets", { source: "menu", menuId: menu!.id, title: menu!.name, deliverBy: "2026-11-19", lines }, AGENT_AUTH);
  const basketId = (started.body as { basketId?: string } | undefined)?.basketId;
  checks.expect(started.status === 202 && Boolean(basketId), `basket answered ${started.status}`);
  const basket = basketId ? await finished(basketId) : undefined;
  if (!checks.expect(Boolean(basket), "the basket did not finish")) return checks.verdict("basket unfinished");
  checks.expect(basket!.source === "menu" && basket!.menuId === menu!.id, "the basket lost its menu");
  checks.expect(basket!.lines.length === lines.length, `${basket!.lines.length} of ${lines.length} lines in the basket`);
  checks.expect(basket!.totals.green >= Math.ceil(lines.length / 2), `only ${basket!.totals.green} of ${lines.length} lines ordered alone`);
  const ordered = basket!.lines.filter((line) => line.state === "green" && line.product);
  const nuts = ordered.filter((line) => allergensOf(line.product!.id).some((a) => ["nuts", "almond", "peanut"].includes(a)));
  checks.expect(nuts.length === 0, `ordered with nuts: ${nuts.map((line) => line.words).join(", ")}`);
  checks.expect(await auditVerifies(), "the audit log does not verify");
  checks.note(`${menu!.name}: ${menu!.courses.map((course) => course.recipe.name).join(", ")}; ${basket!.summary}`);
  return checks.verdict(`${plan.understood} ${basket!.totals.green}/${lines.length} green, ${basket!.totals.orange} orange, ${basket!.totals.red} red`);
}

/** A booking for tomorrow: what cannot arrive is flagged, and recipe roles swap to what the kitchen already has. */
async function lastMinuteSwap(): Promise<Verdict> {
  const checks = new Checks();
  const plan = await planned({ words: "Unexpected booking: dinner for 40 tomorrow" }, AGENT_AUTH, checks);
  if (!plan) return checks.verdict("no plan");
  checks.expect(plan.event.date === "2026-11-15", `read the date as ${plan.event.date}`);
  const lines = plan.menus.flatMap((menu) => menu.shoppingList);
  const flagged = lines.filter((line) => line.availability !== "ok");
  const swaps = lines.filter((line) => line.swap && line.availability === "ok");
  checks.expect(flagged.length > 0, "nothing flagged as unable to arrive");
  checks.expect(swaps.length > 0, "no recipe-role swap");
  checks.expect(plan.menus.every((menu) => menu.warnings.includes("The event is very soon. Some items cannot arrive in time.")), "no warning");
  checks.expect(longest(swaps.map((line) => line.swap!.reason)) <= 14, "a swap reason has a sentence over 14 words");
  const example = swaps[0];
  if (example?.swap) checks.note(`${example.words} -> ${example.swap.words}: ${example.swap.reason}`);
  return checks.verdict(`${flagged.length} lines flagged, ${swaps.length} swapped by role`);
}

/** The school kitchen's mandate excludes sesame, peanut and nuts, traces included: no menu buys any of them. */
async function schoolAllergenSafe(): Promise<Verdict> {
  const checks = new Checks();
  const plan = await planned({ words: "School lunch for 120 pupils on Thursday, egg-free" }, KAISLA_AUTH, checks);
  if (!plan) return checks.verdict("no plan");
  checks.expect(plan.menus.length === 3, `${plan.menus.length} menus`);
  const excluded = ["sesame", "peanut", "nuts", "almond", "egg"];
  for (const menu of plan.menus) {
    for (const line of menu.shoppingList.filter((entry) => entry.product && entry.toOrder.amount > 0)) {
      const hit = allergensOf(line.product!.id).filter((a) => excluded.includes(a));
      checks.expect(hit.length === 0, `${menu.name} buys ${line.product!.name} (${hit.join(", ")})`);
    }
    for (const { recipe } of menu.courses) checks.expect(!recipe.allergens.includes("egg"), `${recipe.name} has egg`);
    // With ingredients still open the fit speaks only for the matched products, and says so.
    const mandateFit = menu.unpriced ? "Every matched product meets your allergen rules. Check the open ingredients." : "Every product meets your allergen rules.";
    checks.expect(menu.fits.some((fit) => fit.ok === !menu.unpriced && fit.sentence === mandateFit), `${menu.name}: mandate fit missing`);
    const eggFit = menu.unpriced ? "No egg in any dish so far. Check the open ingredients." : "No egg in any dish.";
    checks.expect(menu.fits.some((fit) => fit.ok === !menu.unpriced && fit.sentence === eggFit), `${menu.name}: egg fit missing`);
  }
  const dishes = plan.menus.flatMap((menu) => menu.courses.map((course) => course.recipe.name));
  checks.note(`dishes: ${[...new Set(dishes)].join(", ")}`);
  return checks.verdict(`${plan.understood} 3 menus, no excluded allergen or trace`);
}

/** The brief's recipe scenarios, run over REST against the recorded catalogue. */
export const MENU_CASES: EvalCase[] = [
  { id: "M1", name: "Need -> recipe -> order", expected: "nut-free three-course menu ordered as one basket; most lines green; nothing with nuts; audit verifies", run: needRecipeOrder },
  { id: "M2", name: "Last-minute event, recipe-role swap", expected: "tomorrow's gaps flagged; a role swap from stock with its reason in short sentences", run: lastMinuteSwap },
  { id: "M3", name: "Allergen-safe school menu", expected: "no product with sesame, peanut, nuts or egg, traces included; mandate and egg fits hold", run: schoolAllergenSafe },
];
