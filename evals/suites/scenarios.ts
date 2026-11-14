import type { Suite } from "../harness";
import { BASKET_CASES } from "../support/baskets";
import { MENU_CASES } from "../support/menus";
import { runScenario, type Scenario } from "../support/scenario";

const LITRES = (amount: number) => ({ amount, unit: "l" as const });
const KILOS = (amount: number) => ({ amount, unit: "kg" as const });

/** Dates as the words mean them on the pinned clock, Saturday 14 Nov 2026: "by Monday" and "by tomorrow". */
const BY_MONDAY = { by: "2026-11-16", arrives: "on_time" as const };
const DAY_AFTER_TOMORROW = { by: "2026-11-15", arrives: "one_day_late" as const };
/** Valio skimmed milk 1 l ESL: ordinary milk, not lactose-free, in stock in the recording. */
const ORDINARY_MILK = "469477";
/** Arla lactose-free fat-free UHT milk drink: 51 units in the recording. */
const SHORT_STOCK = "462775";
/** The products the scenarios order on the recording; their pack sizes are in support/packs.ts. */
const MILK = "464306";
const SKIMMED = "464401";
const BUTTER = "464411";
const OAT = "468465";
const ALMOND = "460443";
const SALMON = "462150";

/**
 * Buyer requests run through the scripted buyer agent over the in-process gateway.
 * route lists the acceptable outcomes: auto (confirmed inside the mandate), approval (waits for a person),
 * blocked (refused, nothing ordered) or no_order (the agent stops before ordering).
 * rules are checks that must not pass on the order. Where the recorded catalogue holds no product for the
 * request as written, note says which product stands in.
 */
export const SCENARIOS: Scenario[] = [
  { id: "1", live: true, request: "1,000 l lactose-free milk by Monday",
    expect: { order: [{ sku: MILK, units: 1000 }], route: ["auto"], concept: "milk", claims: ["lactose_free"], need: LITRES(1000), delivery: BY_MONDAY } },
  { id: "2", request: "1000 litraa laktoositonta maitoa maanantaiksi",
    expect: { order: [{ sku: MILK, units: 1000 }], route: ["auto"], concept: "milk", claims: ["lactose_free"], need: LITRES(1000), delivery: BY_MONDAY } },
  { id: "3", request: "200 l lactose-free milk by Monday",
    expect: { order: [{ sku: MILK, units: 200 }], route: ["auto"], concept: "milk", claims: ["lactose_free"], need: LITRES(200), delivery: BY_MONDAY } },
  { id: "4", live: true, request: "3,000 l lactose-free milk by Monday",
    expect: { order: [{ sku: MILK, units: 3000 }], route: ["approval"], concept: "milk", claims: ["lactose_free"], need: LITRES(3000), delivery: BY_MONDAY, rules: ["spend.per_order"] } },
  { id: "5", request: "1,000 l of product 462775 by Monday", extra: "partialSplit",
    note: "462775 has 51 units in stock",
    expect: { order: [{ sku: SKIMMED, units: 1000 }], route: ["auto", "approval"], concept: "milk", claims: ["lactose_free"], need: LITRES(1000), delivery: BY_MONDAY } },
  { id: "6", live: true, request: "500 l of product 465039 by Monday", extra: "cutoffPassed",
    expect: { order: [{ sku: MILK, units: 500 }], route: ["auto", "approval"], concept: "milk", claims: ["lactose_free"], need: LITRES(500), delivery: BY_MONDAY } },
  { id: "7", request: "50 kg butter by Monday",
    expect: { order: [{ sku: BUTTER, units: 100 }], route: ["auto"], concept: "butter", need: KILOS(50), delivery: BY_MONDAY } },
  { id: "8", request: "40 l oat drink by Monday",
    expect: { order: [{ sku: OAT, units: 40 }], route: ["auto", "approval"], concept: "oat_drink", claims: ["vegan"], need: LITRES(40), delivery: BY_MONDAY } },
  { id: "9", request: "20 kg peanut butter by Monday",
    expect: { route: ["blocked", "no_order"] } },
  { id: "9b", request: "40 l of product 460443 by Monday",
    note: "no peanut butter in the recording; Alpro almond drink 460443 contains nuts",
    expect: { order: [{ sku: ALMOND, units: 40 }], route: ["blocked"], need: LITRES(40), rules: ["dietary.allergens"] } },
  { id: "10", request: "unobtainium 3000",
    expect: { route: ["no_order"], agent: "not_found" } },
  { id: "11", request: "milk for Monday",
    expect: { route: ["no_order"], agent: "needs_input" } },
  { id: "12", request: "some dairy stuff, about a thousand",
    expect: { route: ["approval", "no_order"], rules: ["match.confidence"] } },
  { id: "13", request: "100 l lactose-free milk by tomorrow",
    expect: { order: [{ sku: MILK, units: 100 }], route: ["approval"], concept: "milk", claims: ["lactose_free"], need: LITRES(100), delivery: DAY_AFTER_TOMORROW, rules: ["delivery.deadline"] } },
  { id: "14", request: "1,000 l lactose-free milk by Monday",
    before: ["1,000 l lactose-free milk by Monday"], mandate: { limits: { perWeek: { amount: 2000, currency: "EUR" } } },
    note: "weekly limit set to 2,000 EUR; an earlier 1,000 l order this week",
    expect: { order: [{ sku: MILK, units: 1000 }], route: ["approval"], concept: "milk", need: LITRES(1000), delivery: BY_MONDAY, rules: ["spend.per_week"] } },
  { id: "15", request: "20 kg salmon by Monday",
    note: "no cleaning products in the recording; salmon is in fish, outside the mandate",
    expect: { order: [{ sku: SALMON, units: 20 }], route: ["approval"], concept: "salmon", need: KILOS(20), delivery: BY_MONDAY, rules: ["category.allowed"] } },
  { id: "16", request: "200 l lactose-free milk by Monday", sendTwice: true,
    expect: { order: [{ sku: MILK, units: 200 }], route: ["auto"], concept: "milk", claims: ["lactose_free"], need: LITRES(200), delivery: BY_MONDAY } },
  { id: "17", request: "1,000 l lactose-free milk by Monday", extra: "organicOrBlocked",
    mandate: { dietary: { requiredClaims: ["organic"] } },
    expect: { order: [{ sku: MILK, units: 1000 }], route: ["blocked", "auto", "approval"], concept: "milk", claims: ["lactose_free"] } },
  { id: "18", request: "200 l lactose-free milk by Monday",
    mandate: { approval: { firstTimeProducts: true } },
    expect: { order: [{ sku: MILK, units: 200 }], route: ["approval"], concept: "milk", claims: ["lactose_free"], need: LITRES(200), delivery: BY_MONDAY, rules: ["product.first_time"] } },
  { id: "19", request: "200 l lactose-free milk by Monday, do not order until I approve",
    expect: { order: [{ sku: MILK, units: 200 }], route: ["approval"], concept: "milk", claims: ["lactose_free"], need: LITRES(200), delivery: BY_MONDAY, rules: ["match.confidence"], agent: "waiting" } },
  { id: "20", request: "80 l lactose-free milk by Monday, under 50 euros",
    note: "the offer is about 92 EUR with VAT",
    expect: { order: [{ sku: MILK, units: 80 }], route: ["approval"], concept: "milk", claims: ["lactose_free"], need: LITRES(80), delivery: BY_MONDAY, rules: ["match.confidence"] } },
  { id: "21", request: "80 litraa laktoositonta maitoa maanantaiksi alle 50 euroa, älä tilaa ennen kuin hyväksyn",
    expect: { order: [{ sku: MILK, units: 80 }], route: ["approval"], concept: "milk", claims: ["lactose_free"], need: LITRES(80), delivery: BY_MONDAY, rules: ["match.confidence"] } },
  { id: "22", request: "1,000 l lactose-free milk by Monday", misquote: { productId: ORDINARY_MILK, quantity: { amount: 1, unit: "sales_unit" } },
    note: "the agent quotes one litre of ordinary milk with high confidence",
    expect: { order: [{ sku: ORDINARY_MILK, units: 1 }], route: ["blocked"], concept: "milk", rules: ["match.confidence"], agent: "blocked" } },
  { id: "23", request: "200 l lactose-free milk by Monday from a farm in Lapland",
    expect: { order: [{ sku: MILK, units: 200 }], route: ["approval"], concept: "milk", claims: ["lactose_free"], need: LITRES(200), delivery: BY_MONDAY, rules: ["match.confidence"] } },
  { id: "24", request: "1000000000000 l lactose-free milk by Monday",
    note: "the quote is refused with 422 quantity_implausible, so no offer is signed",
    expect: { route: ["no_order"] } },
  { id: "25", live: true, request: "I need 1,000 litres of lactose-free milk by Monday. Find an option that meets our requirements based on price and availability.",
    note: "the brief's own sentence, word for word",
    expect: { order: [{ sku: MILK, units: 1000 }], route: ["auto"], concept: "milk", claims: ["lactose_free"], need: LITRES(1000), delivery: BY_MONDAY } },
  { id: "26", request: "200 litres of lactose-free skimmed milk by Monday", productId: SHORT_STOCK,
    note: "the demo's short-stock scene: 51 of 200 in stock, the signed alternative matches every stated word",
    expect: { order: [{ sku: SKIMMED, units: 200 }], route: ["auto"], concept: "milk", claims: ["lactose_free"], need: LITRES(200), delivery: BY_MONDAY } },
  { id: "27", request: "200 litres of Arla lactose-free UHT milk by Monday", productId: SHORT_STOCK,
    note: "the like-for-like alternative is Valio and chilled: the brand is substituted, UHT is unmet",
    expect: { order: [{ sku: SKIMMED, units: 200 }], route: ["approval"], concept: "milk", claims: ["lactose_free"], need: LITRES(200), delivery: BY_MONDAY, rules: ["match.confidence"] } },
  { id: "28", request: "200 litres of lactose-free milk by Monday for breakfast; do not order yet",
    expect: { order: [{ sku: MILK, units: 200 }], route: ["approval"], concept: "milk", claims: ["lactose_free"], need: LITRES(200), delivery: BY_MONDAY, rules: ["match.confidence"], agent: "waiting" } },
  { id: "29", request: "200 litres of milk by Monday for a dairy-free breakfast",
    note: "every milk contains milk, so the offer certainly fails the words",
    expect: { order: [{ sku: ORDINARY_MILK, units: 200 }], route: ["blocked", "no_order"], need: LITRES(200), rules: ["match.confidence"] } },
  { id: "30", request: "200 litres of lactose-free milk by Monday, budget 0 euros",
    expect: { order: [{ sku: MILK, units: 200 }], route: ["approval"], concept: "milk", claims: ["lactose_free"], need: LITRES(200), delivery: BY_MONDAY, rules: ["match.confidence"] } },
];

const NAMES: Record<string, string> = {
  "1": "1,000 l lactose-free milk", "2": "Finnish request", "3": "200 l milk", "4": "Over the per-order limit",
  "5": "Short stock, split covers need", "6": "Cut-off passed", "7": "50 kg butter", "8": "Oat drink keeps vegan",
  "9": "Peanut butter", "9b": "Product that contains nuts", "10": "Unknown product", "11": "No quantity",
  "12": "Vague request", "13": "Tomorrow is Sunday", "14": "Over the weekly limit", "15": "Category outside mandate",
  "16": "Same idempotency key twice", "17": "Mandate requires organic", "18": "First-time product",
  "19": "Words say wait for approval", "20": "Words set a budget", "21": "Finnish budget and wait",
  "22": "Agent quotes the wrong milk", "23": "Words not understood", "24": "A trillion litres",
  "25": "The brief's own sentence", "26": "Short stock, alternative as asked", "27": "Alternative lacks a stated attribute",
  "28": "Hold in a later clause", "29": "Dairy-free purpose", "30": "Zero budget",
};

function expectedText(scenario: Scenario): string {
  const { route, rules, concept, claims, need, delivery, agent, order } = scenario.expect;
  return [
    `route ${route.join(" or ")}`,
    order && `order ${order.map(({ sku, units }) => `${units} x ${sku}`).join(" + ")}`,
    concept && `concept ${concept}${claims?.length ? ` [${claims.join(", ")}]` : ""}`,
    need && `>= ${need.amount} ${need.unit} by the eval's own pack sizes`,
    delivery && `delivery ${delivery.arrives.replace(/_/g, " ")} for ${delivery.by}`,
    rules?.length && `flags ${rules.join(", ")}`,
    agent && `agent ${agent}`,
    "audit sequence complete and verified",
  ].filter(Boolean).join("; ");
}

export const scenariosSuite: Suite = {
  id: "scenarios",
  name: "Scenarios",
  bar: 0.9,
  cases: [
    ...SCENARIOS.map((scenario) => ({
      id: scenario.id,
      name: NAMES[scenario.id] ?? scenario.request,
      expected: expectedText(scenario),
      live: scenario.live,
      run: () => runScenario(scenario),
    })),
    ...MENU_CASES,
    ...BASKET_CASES,
  ],
};
