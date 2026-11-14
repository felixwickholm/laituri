import type { Mandate, Order } from "@/lib/contracts";
import type { PurchaseResult, PurchaseStatus } from "@/lib/agent/types";
import { spokenSummary } from "@/lib/voice/spoken-summary";
import type { DemoRun } from "./types";

const STATUS: Record<Order["status"], PurchaseStatus> = {
  confirmed: "confirmed",
  pending_approval: "waiting",
  blocked: "blocked",
  rejected: "failed",
};

/** The first order the run placed: created at or after the moment it started. */
export function orderOfRun(orders: Order[], startedAtMs: number): Order | undefined {
  return orders
    .filter((order) => Date.parse(order.createdAt) >= startedAtMs)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
}

/** What to say aloud when a run the person asked for by voice has finished. */
export function spokenRunResult(run: DemoRun, orders: Order[], startedAtMs: number, mandate?: Mandate): string {
  if (run.status === "failed") return "Something went wrong, so nothing was ordered.";
  const order = orderOfRun(orders, startedAtMs);
  if (!order) return run.summary?.trim() || "Done. Nothing needed ordering.";
  const result: PurchaseResult = { status: STATUS[order.status], orderId: order.id, summary: run.summary ?? "", steps: [] };
  return spokenSummary(result, { order, mandate });
}
