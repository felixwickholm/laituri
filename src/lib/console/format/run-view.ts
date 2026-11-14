import type { Order } from "@/lib/contracts";
import type { RunBlock } from "../runs";
import { eur } from "./money";
import { blockSentence, shortName } from "./rules";
import { plainSentence } from "./sentence";
import { day } from "./time";

export type OutcomeTone = "success" | "waiting" | "danger" | "neutral";

export interface RunOutcome {
  word: string;
  detail?: string;
  tone: OutcomeTone;
}

export interface RunContext {
  orders: Map<string, Order>;
  /** The buyer's words for the active run, when the console started it. */
  activeRequest?: string;
  active: boolean;
  approver?: string;
}

function lastOrder(run: RunBlock, orders: Map<string, Order>): Order | undefined {
  return run.orderIds
    .map((id) => orders.get(id))
    .filter((order): order is Order => Boolean(order))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .pop();
}

function capitalise(text: string): string {
  return text ? text[0].toUpperCase() + text.slice(1) : text;
}

/** The block title: the buyer's request in their own words when it is known. */
export function runTitle(run: RunBlock, ctx: RunContext): string {
  if (run.title) return run.title;
  if (run.kind === "attempts") return "Try to break the rules";
  const intent = lastOrder(run, ctx.orders)?.offer.intent?.trim();
  if (intent) return capitalise(intent);
  if (ctx.active && ctx.activeRequest && !run.label) return capitalise(ctx.activeRequest);
  if (run.lookingFor) return capitalise(run.lookingFor);
  if (run.label) return capitalise(run.label);
  return run.steps[0]?.text ?? "Agent activity";
}

/** One state word and the key figure, always net: "Confirmed · €1,010.00 net · Mon 16 Nov". */
export function runOutcome(run: RunBlock, ctx: RunContext): RunOutcome {
  if (run.kind === "attempts") {
    const match = run.summary?.title.match(/^(\d+) of (\d+)/);
    if (match) {
      const all = match[1] === match[2];
      // Every attempt stopped is the good outcome: the rules held.
      return { word: all ? "All caught" : "Got through", detail: `${match[1]} of ${match[2]} attempts stopped`, tone: all ? "success" : "danger" };
    }
    const n = run.attempts.length;
    return { word: ctx.active ? "Working" : "Ended", detail: n ? `Attempt ${n}` : undefined, tone: "neutral" };
  }
  const order = lastOrder(run, ctx.orders);
  if (order) {
    const { totals, deliveryDate } = order.offer;
    switch (order.status) {
      case "confirmed": {
        const by = order.approval ? ` · approved by ${shortName(order.approval.decidedBy.name)}` : "";
        return { word: "Confirmed", detail: `${eur(totals.net.amount)}\u00a0net · ${day(deliveryDate)}${by}`, tone: "success" };
      }
      case "pending_approval":
        return { word: `Waiting for ${shortName(ctx.approver ?? "a person")}`, detail: `${eur(totals.net.amount)}\u00a0net`, tone: "waiting" };
      case "blocked": {
        const block = order.decision.checks.find((check) => check.status === "block");
        return { word: "Stopped", detail: block ? blockSentence(block) : "Outside the mandate", tone: "danger" };
      }
      default:
        return order.approval
          ? { word: `Rejected by ${shortName(order.approval.decidedBy.name)}`, detail: `${eur(totals.net.amount)}\u00a0net`, tone: "neutral" }
          : { word: "Expired", detail: "The offer ran out before a decision", tone: "neutral" };
    }
  }
  if (ctx.active) return { word: "Working", tone: "neutral" };
  const last = run.steps[run.steps.length - 1];
  if (last?.status === "error") return { word: "Failed", detail: plainSentence(last.text), tone: "danger" };
  if (last?.status === "blocked") return { word: "Stopped", detail: plainSentence(last.text), tone: "danger" };
  return { word: "Done", tone: "neutral" };
}

/** "search_catalog · 20 products, best match … · 4 ms" */
export function toolLine(tool: { tool?: string; detail?: string; title: string; durationMs?: number }): string {
  const parts = [tool.tool ?? "call", plainSentence(tool.detail ?? tool.title)];
  if (tool.durationMs !== undefined) parts.push(`${tool.durationMs} ms`);
  return parts.join(" · ");
}
