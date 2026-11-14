import { afterEach, describe, expect, it } from "vitest";
import { prepareEnvironment } from "../../evals/harness";

prepareEnvironment("recorded");

const { catalog } = await import("@/lib/catalog");
const { gateway } = await import("@/lib/gateway");
const { SCENARIOS } = await import("../../evals/suites/scenarios");
const { runScenario } = await import("../../evals/support/scenario");

const MILK = "464306";
const original = structuredClone(catalog().get(MILK)!.content);

afterEach(() => {
  catalog().get(MILK)!.content = structuredClone(original);
});

/**
 * The scenario suite must catch a pack-size error in the application, not grade it with the same error: here the
 * catalogue is told one carton of milk holds 10 litres, so the agent orders 100 cartons for 1,000 litres.
 */
describe("the scenario suite measures orders with its own pack facts", () => {
  it("passes scenario 1 on the true catalogue", async () => {
    await gateway().reset();
    expect((await runScenario(SCENARIOS[0])).pass).toBe(true);
  });

  it("fails scenario 1 when the catalogue says a 1 l carton holds 10 l", async () => {
    await gateway().reset();
    catalog().get(MILK)!.content = { amount: 10, unit: "l" };
    const verdict = await runScenario(SCENARIOS[0]);
    expect(verdict.pass).toBe(false);
    expect(verdict.evidence).toMatch(/ordered 100 l, less than 1000|expected 1000 x 464306/);
  });
});
