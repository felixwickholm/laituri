import { describe, expect, it } from "vitest";
import { SHEET_FLOW, bonusIdeas, mustBuild, sheetName } from "@/app/evidence/sheet";
import { evidence } from "@/lib/evidence";

describe("the printed sheet on /evidence", () => {
  const e = evidence();

  it("runs the flow in the sheet's four words and order", () => {
    expect(SHEET_FLOW.map((item) => item.step)).toEqual(["Request", "Lookup", "Order", "Approval"]);
  });

  it("finds every must-build item and bonus idea in the evidence source", () => {
    expect(mustBuild(e.core).map((item) => item.name)).toEqual(["Lookup", "Request and order", "Permissions and approval"]);
    expect(bonusIdeas(e.optional).map((item) => item.name)).toEqual(["Compare more than price", "Handle exceptions", "Explain decisions"]);
  });

  it("matches each official criterion to the sheet's shorter name", () => {
    expect(e.criteria.map((criterion) => sheetName(criterion) ?? criterion.name)).toEqual([
      "Working end-to-end demo",
      "Solving the user's need",
      "Autonomy and controls (guardrails)",
      "Robustness to exceptions",
      "Openness and path to production",
    ]);
  });
});
