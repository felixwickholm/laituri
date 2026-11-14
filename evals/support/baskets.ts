import type { Basket, BasketLine, BasketLineRequest, ReasonCode, WorkspaceInfo } from "@/lib/contracts";
import { buyerAgent, startBasket, toBasket, weeklyRequest } from "@/lib/basket";
import { passesNeverRules } from "@/lib/basket/safe-swap";
import { weeklyDeliverBy } from "@/lib/basket/weekly";
import { displayName } from "@/lib/agent/words";
import { fixtureCatalogPath, readProductFile } from "@/lib/catalog/load";
import { now } from "@/lib/clock";
import { gateway } from "@/lib/gateway";
import { BUYER_IDS } from "@/lib/mandate";
import { seedIfEmpty } from "@/lib/seed";
import { WORKSPACE_COOKIE, newWorkspaceSecret } from "@/lib/workspace/cookie";
import type { EvalCase } from "../harness";
import { Checks } from "./checks";
import { auditVerifies, confirmedOutsideMandate, monday, nonPassing } from "./flow";
import { guardrail, outcomeText } from "./hostile";
import { call, get, ok, post } from "./router";

const PRODUCTS = readProductFile(fixtureCatalogPath());
const MAX_POLLS = 400;
/** Alpro almond drink: contains nuts, so Nordic Harbour's mandate blocks it and a nut-free swap is offered. */
const ALMOND_DRINK = "461360";
/** The challenge sheet's own example, word for word. */
const SHEET_SENTENCE = "I need 1,000 litres of lactose-free milk by Monday. Find an option that meets our requirements based on price and availability.";

interface LineExpectation {
  words: string;
  state: BasketLine["state"];
  reasonCode: ReasonCode;
  /** A substitute option that must pass every never rule of the mandate. */
  safeSwap?: true;
}

interface WeeklyCase {
  id: string;
  name: string;
  buyerId: string;
  counts: { green: number; orange: number; red: number };
  lines: LineExpectation[];
}

/** The seeded weeks give history and drift; the evals otherwise start empty. */
async function seedWeeks(): Promise<void> {
  const before = process.env.LAITURI_SEED;
  process.env.LAITURI_SEED = "on";
  try {
    const status = await seedIfEmpty();
    if (status.state !== "seeded") throw new Error(`Seeding ended ${status.state}.`);
  } finally {
    if (before === undefined) delete process.env.LAITURI_SEED;
    else process.env.LAITURI_SEED = before;
  }
}

async function runBasket(buyerId: string, request: Parameters<typeof startBasket>[0]): Promise<Basket> {
  const { done } = await startBasket(request, await buyerAgent(buyerId));
  const basket = await done;
  if (!basket) throw new Error("The basket stopped before it finished.");
  return toBasket(basket);
}

/** Every line its own order, nothing confirmed outside the mandate, the log intact. */
async function checkGuarantees(basket: Basket, checks: Checks): Promise<void> {
  const ordered = basket.lines.filter((line) => line.orderId);
  checks.expect(new Set(ordered.map((line) => line.orderId)).size === ordered.length, "two lines share one order");
  const outside = await confirmedOutsideMandate();
  checks.expect(outside.length === 0, `confirmed outside the mandate: ${outside.map(nonPassing).join(" | ")}`);
  checks.expect(await auditVerifies(), "audit log does not verify");
  const long = basket.lines.find((line) => line.reason.split(/\s+/).length > 14);
  checks.expect(!long, `reason over 14 words: ${long?.reason}`);
}

async function checkWeekly(spec: WeeklyCase): Promise<{ basket: Basket; checks: Checks }> {
  await seedWeeks();
  const basket = await runBasket(spec.buyerId, weeklyRequest(spec.buyerId, weeklyDeliverBy(now())));
  const checks = new Checks();
  const { green, orange, red } = basket.totals;
  checks.expect(green === spec.counts.green && orange === spec.counts.orange && red === spec.counts.red,
    `${green} green, ${orange} orange, ${red} red, expected ${spec.counts.green}/${spec.counts.orange}/${spec.counts.red}`);
  const { mandate } = await gateway().getMandate(spec.buyerId);
  for (const expected of spec.lines) {
    const line = basket.lines.find((candidate) => candidate.words === expected.words);
    checks.expect(line?.state === expected.state && line.reasonCode === expected.reasonCode,
      `${expected.words}: ${line?.state} ${line?.reasonCode}, expected ${expected.state} ${expected.reasonCode}`);
    if (!expected.safeSwap) continue;
    const swap = line?.options?.find((option) => option.kind === "substitute");
    const name = swap?.label.replace(/^Take (.*) instead$/, "$1");
    const product = PRODUCTS.find((candidate) => displayName(candidate.name.en || candidate.name.fi) === name);
    checks.expect(Boolean(swap && product && passesNeverRules(product, mandate)), `${expected.words}: no swap that passes the never rules`);
  }
  await checkGuarantees(basket, checks);
  checks.note(basket.summary);
  return { basket, checks };
}

function weeklyCase(spec: WeeklyCase): EvalCase {
  return {
    id: spec.id,
    name: spec.name,
    expected: `${spec.counts.green} green, ${spec.counts.orange} orange, ${spec.counts.red} red; ${spec.lines.map((line) => `${line.words} ${line.reasonCode}`).join("; ")}; every line its own order; audit verified`,
    async run() {
      const { basket, checks } = await checkWeekly(spec);
      return checks.verdict(`${basket.totals.green}/${basket.totals.orange}/${basket.totals.red}`);
    },
  };
}

const SHEET_IN_BASKET: EvalCase = {
  id: "W4",
  name: "The sheet's sentence inside a basket",
  expected: "the sentence as one line among others: green, 1,000 l of lactose-free milk; audit verified",
  async run() {
    const lines = [
      { words: SHEET_SENTENCE, quantity: { amount: 1000, unit: "l" as const } },
      { words: "eggs", quantity: { amount: 36, unit: "kg" as const } },
      { words: "lactose-free whipping cream", quantity: { amount: 35, unit: "l" as const } },
    ];
    const basket = await runBasket(BUYER_IDS.nordicHarbour, { deliverBy: monday(), source: "manual", lines });
    const checks = new Checks();
    const milk = basket.lines[0];
    checks.expect(milk.state === "green" && milk.packs === "1,000 x 1 l = 1,000 l", `the sentence ended ${milk.state} (${milk.reason}) with ${milk.packs}`);
    checks.expect(basket.totals.green === 3, `${basket.totals.green} of 3 lines green`);
    await checkGuarantees(basket, checks);
    checks.note(`${milk.product?.name}: ${milk.packs}, ${basket.summary}`);
    return checks.verdict(milk.state);
  },
};

/** The weekly basket of each demo buyer on the recorded data, after the seeded weeks. */
export const BASKET_CASES: EvalCase[] = [
  weeklyCase({
    id: "W1", name: "Nordic Harbour's weekly order", buyerId: BUYER_IDS.nordicHarbour, counts: { green: 17, orange: 2, red: 1 },
    lines: [
      { words: "1,000 litres of lactose-free milk", state: "green", reasonCode: "ordered" },
      // 250 kg against 60 kg last week: held back for a person before ordering (it is over the order limit too).
      { words: "butter", state: "orange", reasonCode: "drift" },
      { words: "lactose-free UHT skimmed milk", state: "orange", reasonCode: "substitute_needs_ok" },
      { words: "Alpro almond drink", state: "red", reasonCode: "allergen", safeSwap: true },
    ],
  }),
  weeklyCase({
    id: "W2", name: "Kaisla's weekly order", buyerId: BUYER_IDS.kaisla, counts: { green: 14, orange: 1, red: 1 },
    lines: [
      { words: "lactose-free milk for school lunches", state: "orange", reasonCode: "over_limit" },
      { words: "ciabatta rolls", state: "red", reasonCode: "allergen", safeSwap: true },
    ],
  }),
  weeklyCase({
    id: "W3", name: "Ravintola Laine's weekly order", buyerId: BUYER_IDS.laine, counts: { green: 11, orange: 1, red: 0 },
    lines: [
      { words: "lactose-free cooking cream", state: "green", reasonCode: "ordered" },
      { words: "espresso coffee beans", state: "orange", reasonCode: "new_product" },
    ],
  }),
  SHEET_IN_BASKET,
];

/** A visitor's own sandbox, signed in as its approver, with the primary buyer's agent key. */
async function sandbox(): Promise<{ cookie: string; auth: Record<string, string> }> {
  const workspace = `${WORKSPACE_COOKIE}=${newWorkspaceSecret()}`;
  const key = ok<WorkspaceInfo>(await get("/api/v1/workspace", { cookie: workspace }), "Workspace").agentKeys[0].key;
  const signedIn = await post("/api/v1/console/session", { demo: true }, { cookie: workspace });
  ok(signedIn, "Demo approver sign-in");
  const session = signedIn.headers.get("set-cookie")?.split(";")[0] ?? "";
  return { cookie: `${workspace}; ${session}`, auth: { authorization: `Bearer ${key}` } };
}

async function finished(basketId: string, headers: Record<string, string>): Promise<Basket> {
  for (let poll = 0; poll < MAX_POLLS; poll++) {
    const basket = ok<Basket>(await get(`/api/v1/baskets/${basketId}`, headers), "Basket");
    if (basket.status === "done") return basket;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`Basket ${basketId} did not finish.`);
}

async function placed(lines: BasketLineRequest[], auth: Record<string, string>): Promise<Basket> {
  const started = ok<{ basketId: string }>(await post("/api/v1/baskets", { deliverBy: monday(), lines }, auth), "Basket");
  return finished(started.basketId, auth);
}

const resolveUrl = (basket: Basket, line: BasketLine) => `/api/v1/baskets/${basket.id}/lines/${line.id}/resolve`;

export const BASKET_GUARDRAILS = [
  guardrail("G40", "A basket's lines in parallel over the weekly limit", "only what fits the week confirms; the rest waits by spend.per_week", async (hostile, checks) => {
    const { cookie, auth } = await sandbox();
    ok(await call("PUT", "/api/v1/mandate", { body: { limits: { perWeek: { amount: 2000, currency: "EUR" } } }, headers: { cookie } }), "Mandate change");
    const lines = Array.from({ length: 6 }, () => ({ words: "lactose-free milk", quantity: { amount: 400, unit: "l" as const } }));
    const basket = await placed(lines, auth);
    const confirmed = basket.lines.filter((line) => line.state === "green").reduce((sum, line) => sum + (line.net ?? 0), 0);
    checks.expect(confirmed <= 2000, `confirmed ${confirmed} EUR, over the 2,000 EUR week`);
    checks.expect(basket.totals.green === 4, `${basket.totals.green} lines confirmed, expected the 4 that fit`);
    const waiting = basket.lines.filter((line) => line.state === "orange");
    checks.expect(waiting.length === 2 && waiting.every((line) => line.reasonCode === "over_limit"), `waiting lines: ${waiting.map((line) => line.reasonCode).join(", ")}`);
    return `${basket.summary} Confirmed ${confirmed.toFixed(2)} EUR of a 2,000 EUR week.`;
  }),
  guardrail("G41", "Resolve a basket line with an option it does not have", "400 for a foreign option, 403 for an agent key, 401 without any credential; the line still waits", async (hostile, checks) => {
    const { cookie, auth } = await sandbox();
    const basket = await placed([
      { words: "lactose-free milk", quantity: { amount: 1600, unit: "l" } },
      { words: "Alpro almond drink", quantity: { amount: 40, unit: "l" }, productId: ALMOND_DRINK },
    ], auth);
    const [milk, almond] = basket.lines;
    const approve = milk.options?.find((option) => option.kind === "approve")?.id ?? "";
    const foreign = almond.options?.find((option) => option.kind === "substitute")?.id ?? "";
    checks.expect(foreign !== "", "the almond line offers no swap to borrow");
    const wrong = await hostile.try("an option from another line", () => post(resolveUrl(basket, milk), { optionId: foreign }, { cookie }));
    const asAgent = await hostile.try("approve with the agent key", () => post(resolveUrl(basket, milk), { optionId: approve }, { ...auth, cookie }));
    const noSession = await hostile.try("approve without a session", () => post(resolveUrl(basket, milk), { optionId: approve }));
    checks.expect(wrong.status === 400, `foreign option: ${outcomeText(wrong)}`);
    checks.expect(asAgent.status === 403, `agent key: ${outcomeText(asAgent)}`);
    checks.expect(noSession.status === 401, `no session: ${outcomeText(noSession)}`);
    const after = await finished(basket.id, auth);
    checks.expect(after.lines[0].state === "orange" && !after.lines[0].resolved, `the line is ${after.lines[0].state}`);
    return `${outcomeText(wrong)} / ${outcomeText(asAgent)} / ${outcomeText(noSession)}; line still ${after.lines[0].state}`;
  }),
];
