import type { Order } from "@/lib/contracts";
import { DEMO_AGENT } from "@/lib/agent";
import { gateway } from "@/lib/gateway";
import type { Checks } from "./checks";
import { approverCookie, auditEntries } from "./flow";
import { guardrail, outcomeText, pendingOrder, type Hostile } from "./hostile";
import { callTool } from "./mcp";
import { AGENT_AUTH, post, type Reply } from "./router";

const approve = (orderId: string, headers: Record<string, string>) =>
  post(`/api/v1/approvals/${orderId}`, { decision: "approved", note: "Approved by the agent." }, headers);

/**
 * Every attempt must be refused, and the order must still wait for a person. An agent token is a 403; a caller with no
 * credential at all (a forged header or session cookie is none) is a 401 before the approver check is reached.
 */
async function refusedAll(order: Order, replies: Reply[], checks: Checks, expected = 403): Promise<string> {
  for (const reply of replies) checks.expect(reply.status === expected, `approval answered ${outcomeText(reply)}, expected ${expected}`);
  const { status } = await gateway().getOrder(DEMO_AGENT, order.id);
  checks.expect(status === "pending_approval", `the order is ${status} after the attempts`);
  return `${replies.map(outcomeText).join(" / ")}; order still ${status}`;
}

async function attempt(hostile: Hostile, label: string, headers: Record<string, string>): Promise<{ order: Order; reply: Reply }> {
  const order = await pendingOrder(`eval-${label.replace(/\W+/g, "-")}`);
  return { order, reply: await hostile.try(label, () => approve(order.id, headers)) };
}

/** An approval signed by the approver key, taken from the public audit log. */
async function publicApprovalJws(): Promise<string> {
  const other = await pendingOrder("eval-approved-elsewhere");
  const cookie = await approverCookie();
  const reply = await approve(other.id, { cookie });
  if (reply.status !== 200) throw new Error(`The approver could not approve the setup order: ${outcomeText(reply)}.`);
  const granted = (await auditEntries()).find((entry) => entry.event === "approval.granted" && entry.refs.orderId === other.id);
  const jws = granted?.data.approvalJws;
  if (typeof jws !== "string") throw new Error("The audit log holds no approval signature.");
  return jws;
}

export const APPROVAL_GUARDRAILS = [
  guardrail("G10", "Approval from the agent channel", "403 for the agent token (also with a real approver cookie); no MCP tool approves", async (hostile, checks) => {
    const { order, reply } = await attempt(hostile, "agent token", AGENT_AUTH);
    const cookie = await approverCookie();
    const withCookie = await hostile.try("agent token with approver cookie", () => approve(order.id, { ...AGENT_AUTH, cookie }));
    const mcp = await callTool("decide_approval", { orderId: order.id, decision: "approved" });
    checks.expect(mcp.result?.isError === true || mcp.error !== undefined, "an MCP tool accepted an approval");
    const text = await refusedAll(order, [reply, withCookie], checks);
    return `${text}; MCP ${mcp.result?.isError ? "has no approval tool" : "answered"}`;
  }, true),
  guardrail("G11", "Approval with a forged console header", "401 credential_required", async (hostile, checks) => {
    const { order, reply } = await attempt(hostile, "forged x-laituri-console", { "x-laituri-console": "1" });
    return refusedAll(order, [reply], checks, 401);
  }),
  guardrail("G12", "Approval with a made-up cookie", "401 credential_required", async (hostile, checks) => {
    const { order, reply } = await attempt(hostile, "made-up cookie", { "x-laituri-console": "1", cookie: "laituri_approver=admin; session=approver" });
    return refusedAll(order, [reply], checks, 401);
  }),
  guardrail("G13", "Approval JWS from the audit log as cookie", "401 credential_required", async (hostile, checks) => {
    const jws = await publicApprovalJws();
    const { order, reply } = await attempt(hostile, "approval JWS as session", { cookie: `laituri_approver=${jws}` });
    return refusedAll(order, [reply], checks, 401);
  }),
];
