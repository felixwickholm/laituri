import type { Suite } from "../harness";
import { runScenario, type Scenario } from "../support/scenario";

const LITRES = (amount: number) => ({ amount, unit: "l" as const });
const KILOS = (amount: number) => ({ amount, unit: "kg" as const });

/**
 * Buyer requests run through the scripted buyer agent over the in-process gateway.
 * route lists the acceptable outcomes: auto (confirmed inside the mandate), approval (waits for a person),
 * blocked (refused, nothing ordered) or no_order (the agent stops before ordering).
 * rules are checks that must not pass on the order. Where the recorded catalogue holds no product for the
 * request as written, note says which product stands in.
 */
export const SCENARIOS: Scenario[] = [
  { id: "1", live: true, request: "1,000 l lactose-free milk by Monday",
    expect: { route: ["auto"], concept: "milk", claims: ["lactose_free"], need: LITRES(1000), delivery: "on_time" } },
  { id: "2", request: "1000 litraa laktoositonta maitoa maanantaiksi",
    expect: { route: ["auto"], concept: "milk", claims: ["lactose_free"], need: LITRES(1000), delivery: "on_time" } },
  { id: "3", request: "200 l lactose-free milk by Monday",
    expect: { route: ["auto"], concept: "milk", claims: ["lactose_free"], need: LITRES(200), delivery: "on_time" } },
  { id: "4", live: true, request: "3,000 l lactose-free milk by Monday",
    expect: { route: ["approval"], concept: "milk", claims: ["lactose_free"], need: LITRES(3000), delivery: "on_time", rules: ["spend.per_order"] } },
  { id: "5", request: "1,000 l of product 462775 by Monday", extra: "partialSplit",
    note: "462775 has 51 units in stock",
    expect: { route: ["auto", "approval"], concept: "milk", claims: ["lactose_free"], need: LITRES(1000), delivery: "on_time" } },
  { id: "6", live: true, request: "500 l of product 465039 by Monday", extra: "cutoffPassed",
    expect: { route: ["auto", "approval"], concept: "milk", claims: ["lactose_free"], need: LITRES(500), delivery: "on_time" } },
  { id: "7", request: "50 kg butter by Monday",
    expect: { route: ["auto"], concept: "butter", need: KILOS(50), delivery: "on_time" } },
  { id: "8", request: "40 l oat drink by Monday",
    expect: { route: ["auto", "approval"], concept: "oat_drink", claims: ["vegan"], need: LITRES(40), delivery: "on_time" } },
  { id: "9", request: "20 kg peanut butter by Monday",
    expect: { route: ["blocked", "no_order"] } },
  { id: "9b", request: "40 l of product 460443 by Monday",
    note: "no peanut butter in the recording; Alpro almond drink 460443 contains nuts",
    expect: { route: ["blocked"], need: LITRES(40), rules: ["dietary.allergens"] } },
  { id: "10", request: "unobtainium 3000",
    expect: { route: ["no_order"], agent: "not_found" } },
  { id: "11", request: "milk for Monday",
    expect: { route: ["no_order"], agent: "needs_input" } },
  { id: "12", request: "some dairy stuff, about a thousand",
    expect: { route: ["approval", "no_order"], rules: ["match.confidence"] } },
  { id: "13", request: "100 l lactose-free milk by tomorrow",
    expect: { route: ["approval"], concept: "milk", claims: ["lactose_free"], need: LITRES(100), delivery: "one_day_late", rules: ["delivery.deadline"] } },
  { id: "14", request: "1,000 l lactose-free milk by Monday",
    before: ["1,000 l lactose-free milk by Monday"], mandate: { limits: { perWeek: { amount: 2000, currency: "EUR" } } },
    note: "weekly limit set to 2,000 EUR; an earlier 1,000 l order this week",
    expect: { route: ["approval"], concept: "milk", need: LITRES(1000), delivery: "on_time", rules: ["spend.per_week"] } },
  { id: "15", request: "20 kg salmon by Monday",
    note: "no cleaning products in the recording; salmon is in fish, outside the mandate",
    expect: { route: ["approval"], concept: "salmon", need: KILOS(20), delivery: "on_time", rules: ["category.allowed"] } },
  { id: "16", request: "200 l lactose-free milk by Monday", sendTwice: true,
    expect: { route: ["auto"], concept: "milk", claims: ["lactose_free"], need: LITRES(200), delivery: "on_time" } },
  { id: "17", request: "1,000 l lactose-free milk by Monday", extra: "organicOrBlocked",
    mandate: { dietary: { requiredClaims: ["organic"] } },
    expect: { route: ["blocked", "auto", "approval"], concept: "milk", claims: ["lactose_free"] } },
  { id: "18", request: "200 l lactose-free milk by Monday",
    mandate: { approval: { firstTimeProducts: true } },
    expect: { route: ["approval"], concept: "milk", claims: ["lactose_free"], need: LITRES(200), delivery: "on_time", rules: ["product.first_time"] } },
];

const NAMES: Record<string, string> = {
  "1": "1,000 l lactose-free milk", "2": "Finnish request", "3": "200 l milk", "4": "Over the per-order limit",
  "5": "Short stock, split covers need", "6": "Cut-off passed", "7": "50 kg butter", "8": "Oat drink keeps vegan",
  "9": "Peanut butter", "9b": "Product that contains nuts", "10": "Unknown product", "11": "No quantity",
  "12": "Vague request", "13": "Tomorrow is Sunday", "14": "Over the weekly limit", "15": "Category outside mandate",
  "16": "Same idempotency key twice", "17": "Mandate requires organic", "18": "First-time product",
};

function expectedText(scenario: Scenario): string {
  const { route, rules, concept, claims, need, delivery, agent } = scenario.expect;
  return [
    `route ${route.join(" or ")}`,
    concept && `concept ${concept}${claims?.length ? ` [${claims.join(", ")}]` : ""}`,
    need && `>= ${need.amount} ${need.unit}, at most one lot more`,
    delivery && `delivery ${delivery.replace(/_/g, " ")}`,
    rules?.length && `flags ${rules.join(", ")}`,
    agent && `agent ${agent}`,
    "audit sequence complete and verified",
  ].filter(Boolean).join("; ");
}

export const scenariosSuite: Suite = {
  id: "scenarios",
  name: "Scenarios",
  bar: 0.9,
  cases: SCENARIOS.map((scenario) => ({
    id: scenario.id,
    name: NAMES[scenario.id] ?? scenario.request,
    expected: expectedText(scenario),
    live: scenario.live,
    run: () => runScenario(scenario),
  })),
};
