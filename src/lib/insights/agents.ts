import type { AgentSuspension, Order } from "@/lib/contracts";
import type { Activity } from "@/lib/store/types";
import { netOf, outcomeCounts } from "./orders";
import type { ConnectedAgent, Party } from "./types";

/** An agent counts as active while its last call is younger than this. */
const ACTIVE_MS = 24 * 60 * 60 * 1000;

interface Trail {
  agent: Party;
  buyer?: Party;
  activity: Activity[];
  orders: Order[];
}

function trails(activity: Activity[], orders: Order[]): Map<string, Trail> {
  const byAgent = new Map<string, Trail>();
  const trail = (agent: Party) => {
    const found = byAgent.get(agent.id) ?? { agent, activity: [], orders: [] };
    byAgent.set(agent.id, found);
    return found;
  };
  for (const item of [...activity].sort((a, b) => a.at.localeCompare(b.at))) {
    const found = trail(item.agent);
    found.agent = item.agent;
    found.buyer = item.buyer ?? found.buyer;
    found.activity.push(item);
  }
  for (const order of orders) {
    const found = trail(order.agent);
    found.buyer ??= order.buyer;
    found.orders.push(order);
  }
  return byAgent;
}

/** Distinct values, most recent first. */
function recentFirst(values: string[]): string[] {
  return [...new Set([...values].reverse())];
}

function status(lastSeen: string, now: Date, suspension?: AgentSuspension): Pick<ConnectedAgent, "status" | "suspendedAt" | "reason"> {
  if (suspension) return { status: "suspended", suspendedAt: suspension.suspendedAt, ...(suspension.reason ? { reason: suspension.reason } : {}) };
  return { status: now.getTime() - Date.parse(lastSeen) <= ACTIVE_MS ? "active" : "idle" };
}

function summarise({ agent, buyer, activity, orders }: Trail, now: Date, suspension?: AgentSuspension): ConnectedAgent {
  const times = [...activity.map((item) => item.at), ...orders.map((order) => order.createdAt)].sort();
  const lastSeen = times[times.length - 1];
  const tools = activity.filter((item) => item.kind === "tool");
  return {
    agent,
    ...(buyer ? { buyer } : {}),
    clients: recentFirst(activity.flatMap((item) => (item.client ? [item.client] : []))),
    firstSeen: times[0],
    lastSeen,
    calls: tools.length,
    quotes: tools.filter((item) => item.tool === "request_quote" && item.status === "ok").length,
    orders: outcomeCounts(orders),
    confirmedNet: netOf(orders.filter((order) => order.status === "confirmed")),
    ...status(lastSeen, now, suspension),
  };
}

/** Every agent that reached the wholesaler, most recently seen first, with any suspension the wholesaler holds on it. */
export function connectedAgents(activity: Activity[], orders: Order[], now: Date, suspensions: AgentSuspension[] = []): ConnectedAgent[] {
  const suspended = new Map(suspensions.map((suspension) => [suspension.agent.id, suspension]));
  return [...trails(activity, orders).values()]
    .map((trail) => summarise(trail, now, suspended.get(trail.agent.id)))
    .sort((a, b) => b.lastSeen.localeCompare(a.lastSeen));
}
