import { describe, expect, it } from "vitest";
import { resolveTargets, runOf } from "@/lib/tour/targets";

describe("tour targets", () => {
  it("points at the run the tour started, by its id", () => {
    expect(resolveTargets([runOf("milk")], { milk: "run_abc-1" })).toEqual(['[data-tour="runs"] .run[data-demo-run="run_abc-1"]']);
  });

  it("leaves a run target out until the tour has started that run, so no other run is spotlit", () => {
    expect(resolveTargets([runOf("over-limit"), ".live-agent"], { milk: "run_1" })).toEqual([".live-agent"]);
  });

  it("keeps characters that could break out of the selector out of it", () => {
    expect(resolveTargets([runOf("milk")], { milk: 'run_1"] *' })).toEqual(['[data-tour="runs"] .run[data-demo-run="run_1"]']);
  });
});
