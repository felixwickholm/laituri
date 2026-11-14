import { DEMO_AGENT } from "@/lib/agent";
import { gateway } from "@/lib/gateway";
import { approverCookie } from "./flow";
import { guardrail, outcomeText, pendingOrder } from "./hostile";
import { post } from "./router";

export const RECHECK_GUARDRAILS = [
  guardrail("G22", "Approval after the mandate changed", "the approver's approval of a waiting order is stopped once the mandate excludes milk; the order is blocked, not confirmed", async (hostile, checks) => {
    const order = await pendingOrder("eval-recheck-milk");
    await gateway().updateMandate({ dietary: { excludeAllergens: ["milk"] } });
    const cookie = await approverCookie();
    const reply = await hostile.try("approve after the mandate excluded milk", () =>
      post(`/api/v1/approvals/${order.id}`, { decision: "approved" }, { cookie }));
    const after = await gateway().getOrder(DEMO_AGENT, order.id);
    const rule = after.decision.checks.find((check) => check.rule === "dietary.allergens")?.status;
    checks.expect(after.status === "blocked", `the order is ${after.status} after the approval`);
    checks.expect(rule === "block", `dietary.allergens ${rule ?? "missing"} on the re-check`);
    return `approval answered ${outcomeText(reply)}; order ${after.status}, dietary.allergens ${rule}`;
  }),
];
