import type { Order, RuleId } from "@/lib/contracts";
import type { EvalCase } from "../harness";
import { Checks } from "./checks";
import { auditEntries, auditVerifies, confirmedOutsideMandate, nonPassing, orderFrom, orderLitres } from "./flow";
import { isClientError, type Reply } from "./router";

interface Attempt {
  label: string;
  status: number;
  audited: boolean;
}

/** Records every hostile call: it must be refused with a 4xx problem, or leave an audit entry. */
export class Hostile {
  private readonly attempts: Attempt[] = [];

  async try(label: string, action: () => Promise<Reply>): Promise<Reply> {
    const before = (await auditEntries()).length;
    const reply = await action();
    const after = (await auditEntries()).length;
    this.attempts.push({ label, status: reply.status, audited: after > before });
    return reply;
  }

  /** The suite-wide rules: no 5xx, every attempt on record, nothing confirmed outside the mandate, chain intact. */
  async judge(checks: Checks): Promise<void> {
    for (const attempt of this.attempts) {
      const recorded = attempt.status < 500 && (isClientError(attempt.status) || attempt.audited);
      checks.expect(recorded, `${attempt.label}: ${attempt.status} and no audit entry`);
    }
    const outside = await confirmedOutsideMandate();
    checks.expect(outside.length === 0, `${outside.length} confirmed orders outside the mandate (${outside.map(nonPassing).join(" | ")})`);
    checks.expect(await auditVerifies(), "audit log does not verify");
  }
}

/** "422 blocked by offer.signature", "403 approver_sign_in_required", "202 pending_approval". */
export function outcomeText(reply: Reply): string {
  const order = orderFrom(reply);
  if (!order) {
    const code = (reply.body as { code?: string } | undefined)?.code ?? "";
    return `${reply.status} ${code}`.trim();
  }
  const blocks = order.decision?.checks.filter((check) => check.status === "block").map((check) => check.rule) ?? [];
  if (order.status !== "blocked") return `${reply.status} ${order.status}`;
  return `${reply.status} blocked by ${blocks[0] ?? "no rule"}${blocks.length > 1 ? ` (+${blocks.length - 1} more)` : ""}`;
}

/** A forged order must be refused before it is recorded (4xx) or recorded as blocked by the named rule, answering 422. */
export function expectRefused(reply: Reply, rule: RuleId, checks: Checks, label: string): void {
  const order = orderFrom(reply);
  if (!order) {
    checks.expect(isClientError(reply.status), `${label}: ${outcomeText(reply)}, expected a refusal`);
    return;
  }
  const status = order.decision?.checks.find((check) => check.rule === rule)?.status;
  checks.expect(
    order.status === "blocked" && status === "block" && reply.status === 422,
    `${label}: ${outcomeText(reply)}, expected 422 blocked by ${rule}`,
  );
}

/** A pending order that only a person may approve. 3,000 l is over the per-order limit. */
export async function pendingOrder(key: string): Promise<Order> {
  const order = await orderLitres(3000, key);
  if (order.status !== "pending_approval") throw new Error(`The setup order is ${order.status}, not pending_approval.`);
  return order;
}

type Body = (hostile: Hostile, checks: Checks) => Promise<string>;

/** One guardrail case: the body makes hostile calls and returns what happened; the shared rules are judged after. */
export function guardrail(id: string, name: string, expected: string, body: Body, live = false): EvalCase {
  return {
    id,
    name,
    expected,
    live,
    async run() {
      const hostile = new Hostile();
      const checks = new Checks();
      const actual = await body(hostile, checks);
      await hostile.judge(checks);
      checks.note(actual);
      return checks.verdict(actual);
    },
  };
}
