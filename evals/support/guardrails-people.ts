import type { Order, QuoteResponse } from "@/lib/contracts";
import type { WorkspaceInfo } from "@/lib/contracts";
import type { SignedMandate } from "@/lib/orders/types";
import { WORKSPACE_COOKIE, newWorkspaceSecret } from "@/lib/workspace/cookie";
import type { Checks } from "./checks";
import { MILK_ID, monday, operatorCookie, orderFrom } from "./flow";
import { guardrail, outcomeText, pendingOrder } from "./hostile";
import { AGENT_AUTH, get, ok, post, type Reply } from "./router";

const HARBOUR_AGENT = "agent:harbour-purchasing";
const codeOf = (reply: Reply) => (reply.body as { code?: string } | undefined)?.code;

function refusedWith(reply: Reply, status: number, code: string | undefined, checks: Checks, label: string): void {
  checks.expect(reply.status === status && (code === undefined || codeOf(reply) === code), `${label}: ${outcomeText(reply)}, expected ${status} ${code ?? ""}`.trim());
}

/** A visitor's browser as the proxy leaves it: a cookie naming a new sandbox. */
function newSandboxCookie(): string {
  return `${WORKSPACE_COOKIE}=${newWorkspaceSecret()}`;
}

/** A 3,000 l order, over the per-order limit, placed with the sandbox's own key for the primary buyer. */
async function pendingInSandbox(key: string): Promise<Order> {
  const auth = { authorization: `Bearer ${key}` };
  const body = { lines: [{ productId: MILK_ID, quantity: { amount: 3000, unit: "l" } }], deliverBy: monday() };
  const quote = ok<QuoteResponse>(await post("/api/v1/quotes", body, auth), "Sandbox quote");
  const { jws } = ok<SignedMandate>(await get("/api/v1/mandate", auth), "Sandbox mandate");
  const order = orderFrom(await post("/api/v1/orders", { offerJws: quote.primary.jws, mandateJws: jws, idempotencyKey: "eval-g24-sandbox" }, auth));
  if (order?.status !== "pending_approval") throw new Error(`The sandbox setup order is ${order?.status ?? "missing"}, not pending_approval.`);
  return order;
}

export const PEOPLE_GUARDRAILS = [
  guardrail("G23", "Tokenless caller takes demo access in the shared workspace", "403 demo_access_sandbox_only for approver and operator; the order still waits", async (hostile, checks) => {
    const order = await pendingOrder("eval-g23-shared");
    const approver = await hostile.try("demo approver, no cookie", () => post("/api/v1/console/session", { demo: true }));
    const operator = await hostile.try("demo operator, no cookie", () => post("/api/v1/console/session", { demo: true, role: "operator" }));
    refusedWith(approver, 403, "demo_access_sandbox_only", checks, "demo approver");
    refusedWith(operator, 403, "demo_access_sandbox_only", checks, "demo operator");
    const cookie = approver.headers.get("set-cookie")?.split(";")[0] ?? "";
    const approve = await hostile.try("approve after the attempt", () => post(`/api/v1/approvals/${order.id}`, { decision: "approved" }, { cookie }));
    refusedWith(approve, 403, "approver_sign_in_required", checks, "approval");
    const after = ok<Order>(await get(`/api/v1/orders/${order.id}`, AGENT_AUTH), "Order");
    checks.expect(after.status === "pending_approval", `the order is ${after.status}`);
    return `${outcomeText(approver)} / ${outcomeText(operator)} / approve ${outcomeText(approve)}; order still ${after.status}`;
  }, true),

  guardrail("G24", "Sandbox key holder drops its token to approve its own order", "403 or 404 on every route a person uses; the order still waits", async (hostile, checks) => {
    const owner = newSandboxCookie();
    const key = ok<WorkspaceInfo>(await get("/api/v1/workspace", { cookie: owner }), "Workspace").agentKeys[0].key;
    const auth = { authorization: `Bearer ${key}` };
    const order = await pendingInSandbox(key);
    const decide = (headers: Record<string, string>) => post(`/api/v1/approvals/${order.id}`, { decision: "approved" }, headers);

    const workspace = await hostile.try("read the workspace with the key", () => get("/api/v1/workspace", auth));
    const noToken = await hostile.try("approve with no token and no cookie", () => decide({}));
    const demoNoCookie = await hostile.try("demo access with no cookie", () => post("/api/v1/console/session", { demo: true }));
    // A sandbox of its own is open to anyone, so demo access there succeeds; it must not reach the owner's order.
    const ownSandbox = newSandboxCookie();
    const signedIn = await post("/api/v1/console/session", { demo: true }, { cookie: ownSandbox });
    ok(signedIn, "Demo access in its own sandbox");
    const session = signedIn.headers.get("set-cookie")?.split(";")[0] ?? "";
    const elsewhere = await hostile.try("approve from its own sandbox", () => decide({ cookie: `${ownSandbox}; ${session}` }));
    const withKey = await hostile.try("approve with the key and the session", () => decide({ ...auth, cookie: `${ownSandbox}; ${session}` }));

    refusedWith(workspace, 403, "agent_not_allowed", checks, "workspace with key");
    refusedWith(noToken, 403, "approver_sign_in_required", checks, "no token");
    refusedWith(demoNoCookie, 403, "demo_access_sandbox_only", checks, "demo without cookie");
    refusedWith(elsewhere, 404, undefined, checks, "approval from another sandbox");
    refusedWith(withKey, 403, "agent_not_allowed", checks, "approval with the key");
    const after = ok<Order>(await get(`/api/v1/orders/${order.id}`, auth), "Sandbox order");
    checks.expect(after.status === "pending_approval", `the sandbox order is ${after.status}`);
    return `${[workspace, noToken, demoNoCookie, elsewhere, withKey].map(outcomeText).join(" / ")}; order still ${after.status}`;
  }),

  guardrail("G25", "Suspended agent resumes itself", "403 agent_suspended with its token, 403 operator_sign_in_required without; still suspended", async (hostile, checks) => {
    ok(await post("/api/v1/products/search", { query: "maito" }, AGENT_AUTH), "Search");
    const cookie = await operatorCookie();
    const url = `/api/v1/supplier/agents/${encodeURIComponent(HARBOUR_AGENT)}/suspension`;
    ok(await post(url, { suspended: true, reason: "Eval G25." }, { cookie }), "Suspension");

    const withToken = await hostile.try("resume with its token", () => post(url, { suspended: false }, AGENT_AUTH));
    const withoutToken = await hostile.try("resume without a token", () => post(url, { suspended: false }));
    refusedWith(withToken, 403, "agent_suspended", checks, "with token");
    refusedWith(withoutToken, 403, "operator_sign_in_required", checks, "without token");
    const stillRefused = await post("/api/v1/products/search", { query: "maito" }, AGENT_AUTH);
    refusedWith(stillRefused, 403, "agent_suspended", checks, "a call after the attempts");
    ok(await post(url, { suspended: false }, { cookie }), "Resumption");
    return `${outcomeText(withToken)} / ${outcomeText(withoutToken)}; next call ${outcomeText(stillRefused)}`;
  }),
];
