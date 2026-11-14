import { helsinkiDate } from "@/lib/agent/dates";
import { count, eur } from "@/lib/console/format/money";
import type { OrderStats } from "@/lib/contracts";
import type { Activity } from "@/lib/store/types";
import { plural, reasonTotals } from "./format";
import type { DailyPoint, PlainBar, UnmetReason, UnmetRequest } from "./types";

/*
 * "Where demand went": the week's requests, how Valio Aimo answered them, and what the answers turned into.
 * Stage 0 is every request; stage 1 splits them into served (a signed offer in full, or a signed alternative) and
 * unserved by reason; stage 2 splits the served ones into those that led to an order and those that did not;
 * stage 3 shows the orders by outcome. Counts are kept per stage and never invented: stage 3 counts orders, not
 * requests (one request can lead to several orders), so its bands share the "Led to an order" band by proportion.
 */

export type FlowNodeId =
  | "requests"
  | "in_full"
  | "alternative"
  | UnmetReason
  | "ordered"
  | "no_order"
  | "confirmed_auto"
  | "confirmed_after_approval"
  | "waiting"
  | "stopped"
  | "refused"
  | "confirmed"
  | "not_confirmed";

/** What a node's colour means: the accent for trade that happened, neutrals for nothing, amber and red for state. */
export type FlowTone =
  | "base"
  | "served"
  | "served-soft"
  | "neutral"
  | "unserved"
  | "confirmed"
  | "confirmed-soft"
  | "waiting"
  | "stopped"
  | "refused";

export type FlowStage = 0 | 1 | 2 | 3;

export interface FlowNode {
  id: FlowNodeId;
  stage: FlowStage;
  label: string;
  /** The true count, in `unit`. */
  count: number;
  unit: "request" | "order";
  /** Net EUR, when known: order net, or the estimated net of unserved requests that had a price. */
  net?: number;
  /** Unserved requests with no known price, so no euros were put on them. */
  unpriced?: number;
  /** A further line for the tooltip, e.g. how a folded node splits. */
  detail?: string;
  tone: FlowTone;
  /** Geometry weight in request units: for request nodes the count, for order nodes their share of the ordered band. */
  weight: number;
}

export interface FlowLink {
  source: FlowNodeId | "served";
  target: FlowNodeId;
  weight: number;
}

export interface FlowModel {
  nodes: FlowNode[];
  links: FlowLink[];
  requests: number;
  served: number;
  ordered: number;
  orders: number;
  /** The one line under the diagram that keeps stage 3 honest; absent when there are no orders. */
  note?: string;
}

export interface FlowInput {
  /** Requests that started in the window. */
  requests: number;
  /** Of those, the ones that led to at least one order. */
  ordered: number;
  /**
   * Of those, the ones answered only with a signed alternative (derived, see `alternativeRequests`). Absent when
   * unknown: served requests then stay one "Signed offer" node rather than a guessed split.
   */
  alternatives?: number;
  /** Unserved requests in the same window. */
  unmet: UnmetRequest[];
  /** Orders by outcome as the overview reports them: over all time, not over the window. */
  orders: OrderStats["byOutcome"];
  /** Orders placed in the window, from the daily series: how many, how many confirmed, and their net. */
  week: { orders: number; confirmed: number; confirmedNet: number };
}

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, Math.round(value)));
const cents = (...amounts: number[]) => amounts.reduce((sum, amount) => sum + Math.round(amount * 100), 0) / 100;

type Outcome = { id: FlowNodeId; label: string; tone: FlowTone; count: number; net?: number; detail?: string };

/**
 * The last column. The overview's outcome split covers all time while the flow covers seven days, so the split is
 * used only when it holds exactly the window's orders (same count, same confirmed count and net). Otherwise the
 * window's own figures give two honest nodes, confirmed and not confirmed, with no guessed split.
 */
export function orderOutcomes(o: OrderStats["byOutcome"], week: FlowInput["week"]): Outcome[] {
  const total = o.confirmed_auto.count + o.confirmed_after_approval.count + o.waiting.count + o.rejected.count + o.blocked.count + o.refused.count;
  const confirmed = o.confirmed_auto.count + o.confirmed_after_approval.count;
  const exact = total === week.orders && confirmed === week.confirmed && cents(o.confirmed_auto.net, o.confirmed_after_approval.net) === cents(week.confirmedNet);
  if (!exact) {
    return [
      { id: "confirmed", label: "Confirmed", tone: "confirmed", count: week.confirmed, net: week.confirmedNet, detail: "Alone or after approval" },
      {
        id: "not_confirmed",
        label: "Not confirmed",
        tone: "neutral",
        count: Math.max(0, week.orders - week.confirmed),
        detail: "Waiting, stopped or refused; the split for this window is not available",
      },
    ];
  }
  return [
    { id: "confirmed_auto", label: "Confirmed alone", tone: "confirmed", ...o.confirmed_auto, detail: "No person was needed" },
    { id: "confirmed_after_approval", label: "A person approved", tone: "confirmed-soft", ...o.confirmed_after_approval, detail: "A person approved it first" },
    { id: "waiting", label: "Needs the customer", tone: "waiting", ...o.waiting, detail: "A person at the customer decides" },
    {
      id: "stopped",
      label: "Stopped",
      tone: "stopped",
      count: o.blocked.count + o.rejected.count,
      net: cents(o.blocked.net, o.rejected.net),
      detail: [
        o.blocked.count > 0 ? `${count(o.blocked.count)} blocked by the customer's rules` : "",
        o.rejected.count > 0 ? `${count(o.rejected.count)} rejected by a person` : "",
      ]
        .filter(Boolean)
        .join(" · "),
    },
    { id: "refused", label: "Refused", tone: "refused", ...o.refused, detail: "A seal did not match, or the price or limits came from elsewhere" },
  ];
}

/** The flow's nodes and links. Every count is clamped so no stage holds more than the one before it. */
export function demandFlow(input: FlowInput): FlowModel {
  const requests = Math.max(0, Math.round(input.requests));
  const reasons = reasonTotals(input.unmet).filter((reason) => reason.count > 0);
  let left = requests;
  const unserved = reasons.map((reason) => {
    const taken = Math.min(left, reason.count);
    left -= taken;
    return { ...reason, count: taken };
  });
  const served = left;
  const split = input.alternatives !== undefined;
  const alternative = split ? clamp(input.alternatives ?? 0, 0, served) : 0;
  const ordered = clamp(input.ordered, 0, served);
  const outcomes = orderOutcomes(input.orders, input.week);
  const orders = outcomes.reduce((sum, item) => sum + item.count, 0);
  const shown = ordered > 0 && orders > 0 ? outcomes.filter((item) => item.count > 0) : [];

  const all: FlowNode[] = [
    { id: "requests", stage: 0, label: "Requests", count: requests, unit: "request", tone: "base", weight: requests },
    { id: "in_full", stage: 1, label: split ? "Fixed price, as asked" : "Fixed price", count: served - alternative, unit: "request", tone: "served", weight: served - alternative },
    {
      id: "alternative",
      stage: 1,
      label: "Other product",
      count: alternative,
      unit: "request",
      tone: "served-soft",
      weight: alternative,
      detail: "Counted from quotes that offered alternatives",
    },
    ...unserved.map(
      (reason): FlowNode => ({
        id: reason.key,
        stage: 1,
        label: reason.label,
        count: reason.count,
        unit: "request",
        tone: "unserved",
        weight: reason.count,
        ...(reason.count > reason.unpriced ? { net: reason.net } : {}),
        ...(reason.unpriced > 0 ? { unpriced: reason.unpriced } : {}),
      }),
    ),
    { id: "ordered", stage: 2, label: "Led to an order", count: ordered, unit: "request", tone: "served", weight: ordered },
    { id: "no_order", stage: 2, label: "No order", count: served - ordered, unit: "request", tone: "neutral", weight: served - ordered },
    ...shown.map(
      (item): FlowNode => ({
        id: item.id,
        stage: 3,
        label: item.label,
        count: item.count,
        unit: "order",
        tone: item.tone,
        ...(item.net !== undefined ? { net: item.net } : {}),
        weight: (item.count / orders) * ordered,
        ...(item.detail ? { detail: item.detail } : {}),
      }),
    ),
  ];
  const nodes = all.filter((node) => node.count > 0 || node.id === "requests");

  const links: FlowLink[] = nodes
    .filter((node) => node.stage > 0)
    .map((node) => ({
      source: node.stage === 1 ? "requests" : node.stage === 2 ? "served" : "ordered",
      target: node.id,
      weight: node.weight,
    }));

  return {
    nodes,
    links,
    requests,
    served,
    ordered,
    orders,
    ...(shown.length > 0
      ? {
          note:
            orders === ordered
              ? `${plural(ordered, "request")} led to ${plural(orders, "order")}.`
              : `${plural(ordered, "request")} led to ${plural(orders, "order")}: one request can lead to several, so the last column shows each outcome's share of orders.`,
        }
      : {}),
  };
}

/** A node's figure line: "21", "12 · €2,057.90", "3 · €619.20 est.", "3 · no price". */
export function nodeFigure(node: Pick<FlowNode, "count" | "net" | "unit" | "unpriced" | "tone">): string {
  const parts = [count(node.count)];
  if (node.net !== undefined && node.net > 0) parts.push(node.tone === "unserved" ? `${eur(node.net)} est.` : eur(node.net));
  else if (node.unpriced && node.unpriced === node.count) parts.push("no price");
  return parts.join(" · ");
}

/** The tooltip and screen-reader lines for a node. */
export function nodeLines(node: FlowNode, model: Pick<FlowModel, "requests" | "served" | "orders">): string[] {
  const of =
    node.unit === "order"
      ? `${plural(node.count, "order")} of ${count(model.orders)}`
      : node.stage === 2
        ? `${plural(node.count, "request")} of ${count(model.served)} served`
        : node.stage === 0
          ? plural(node.count, "request")
          : `${plural(node.count, "request")} of ${count(model.requests)}`;
  const lines = [of];
  if (node.net !== undefined && node.net > 0) lines.push(node.tone === "unserved" ? `${eur(node.net)} net, estimated` : `${eur(node.net)} net`);
  if (node.unpriced) lines.push(`${plural(node.unpriced, "request")} without a price`);
  if (node.detail) lines.push(node.detail);
  return lines;
}

/** The one sentence a mini flow is read out as. */
export function flowSummary(model: FlowModel): string {
  if (model.requests === 0) return "No requests yet.";
  const unserved = model.requests - model.served;
  return `${plural(model.requests, "request")}: ${count(model.served)} served with a signed offer, ${count(unserved)} could not be served; ${count(model.ordered)} led to ${plural(model.orders, "order")}.`;
}

/**
 * Requests answered only with a signed alternative. The overview does not split served requests, so this is
 * derived from the activity feed: quotes in the window whose result names alternatives ("…, 3 alternatives"),
 * one per request (the run it belongs to). The caller clamps it to the served count.
 */
export function alternativeRequests(activity: Activity[], daily: Pick<DailyPoint, "date">[]): number {
  const dates = new Set(daily.map((day) => day.date));
  const seen = new Set<string>();
  for (const item of activity) {
    if (item.kind !== "tool" || item.tool !== "request_quote" || item.status !== "ok") continue;
    if (!/\b[1-9]\d* alternatives?\b/.test(item.detail ?? "")) continue;
    if (!dates.has(helsinkiDate(new Date(item.at)))) continue;
    seen.add(item.run?.id ?? item.id);
  }
  return seen.size;
}

/* ---------- Geometry ---------- */

export interface FlowBox {
  width: number;
  height: number;
  /** Width of a node bar. */
  node: number;
  /** Vertical gap between nodes in a column. */
  gap: number;
  /** Room kept right of the last column for its labels. */
  labelRoom: number;
  /** How the room between the four columns is shared, left to right; equal when absent. */
  spans?: [number, number, number];
}

export interface PlacedNode extends FlowNode {
  x: number;
  y: number;
  h: number;
}

export interface PlacedLink extends FlowLink {
  /** A cubic path along the link's centre; drawn as a stroke `width` wide. */
  path: string;
  width: number;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

export interface FlowLayout {
  nodes: PlacedNode[];
  links: PlacedLink[];
  /** The x of each stage's bars. */
  columns: number[];
  /** Pixels per request. */
  scale: number;
}

const MIN_BAR = 2;

/** Places the nodes in four columns and runs a link between them. Pure: same model and box, same pixels. */
export function layoutFlow(model: FlowModel, box: FlowBox): FlowLayout {
  const room = Math.max(0, box.width - box.labelRoom - box.node);
  const spans = box.spans ?? [1, 1, 1];
  const total = spans[0] + spans[1] + spans[2];
  const columns = [0, spans[0], spans[0] + spans[1], total].map((part) => Math.round((part / total) * room));
  const stage = (s: FlowStage) => model.nodes.filter((node) => node.stage === s);
  const served = stage(1).filter((node) => node.tone === "served" || node.tone === "served-soft");
  const unserved = stage(1).filter((node) => node.tone === "unserved");
  // Stage 1 is the tallest column: the served block (one block, its two parts touching) and one gap per unserved node.
  const scale = model.requests > 0 ? Math.max(0, box.height - box.gap * unserved.length) / model.requests : 0;
  const placed = new Map<FlowNodeId, PlacedNode>();
  const place = (node: FlowNode, y: number) => {
    const h = node.weight > 0 ? Math.max(MIN_BAR, node.weight * scale) : 0;
    placed.set(node.id, { ...node, x: columns[node.stage], y, h });
    return y + h;
  };

  // The requests bar sits centred against stage 1, which is as tall as the box.
  for (const node of stage(0)) place(node, (box.gap * unserved.length) / 2);

  let y = 0;
  for (const node of served) y = place(node, y);
  for (const node of unserved) y = place(node, y + box.gap);

  y = 0;
  stage(2).forEach((node, index) => {
    y = place(node, index === 0 ? 0 : y + box.gap);
  });

  const orderedNode = placed.get("ordered");
  y = orderedNode?.y ?? 0;
  stage(3).forEach((node, index) => {
    y = place(node, index === 0 ? y : y + box.gap);
  });

  const links: PlacedLink[] = [];
  const outOffset = new Map<string, number>();
  for (const link of model.links) {
    const target = placed.get(link.target);
    if (!target || link.weight <= 0) continue;
    const width = Math.max(MIN_BAR, link.weight * scale);
    const sourceTop = link.source === "served" ? 0 : (placed.get(link.source)?.y ?? 0);
    const sourceX = link.source === "served" ? columns[1] : (placed.get(link.source)?.x ?? 0);
    const used = outOffset.get(link.source) ?? 0;
    outOffset.set(link.source, used + width);
    const x0 = sourceX + box.node;
    const x1 = target.x;
    const y0 = sourceTop + used + width / 2;
    const y1 = target.y + target.h / 2;
    const mid = (x0 + x1) / 2;
    links.push({ ...link, width, x0, x1, y0, y1, path: `M${r(x0)},${r(y0)}C${r(mid)},${r(y0)} ${r(mid)},${r(y1)} ${r(x1)},${r(y1)}` });
  }
  return { nodes: [...placed.values()], links, columns, scale };
}

const r = (value: number) => Math.round(value * 10) / 10;

/**
 * Label centres for one column, pushed apart so no two are closer than `space`, kept inside [top, bottom].
 * Input order is kept; each label stays as near its node as the others allow.
 */
export function spreadLabels(centres: number[], space: number, top: number, bottom: number): number[] {
  const out = centres.map((centre) => Math.max(top + space / 2, centre));
  for (let i = 1; i < out.length; i += 1) out[i] = Math.max(out[i], out[i - 1] + space);
  const overflow = out.length > 0 ? out[out.length - 1] - (bottom - space / 2) : 0;
  if (overflow > 0) {
    out[out.length - 1] -= overflow;
    for (let i = out.length - 2; i >= 0; i -= 1) out[i] = Math.min(out[i], out[i + 1] - space);
  }
  return out;
}

/* ---------- Stacked form (phones) ---------- */

export interface FlowRow {
  key: string;
  label: string;
  total: string;
  parts: FlowNode[];
}

/** The same flow as three stacked bars, for a phone: requests by answer, served by result, orders by outcome. */
export function flowRows(model: FlowModel): FlowRow[] {
  const stage = (s: FlowStage) => model.nodes.filter((node) => node.stage === s);
  const rows: FlowRow[] = [
    { key: "answer", label: "Requests", total: count(model.requests), parts: stage(1) },
    { key: "result", label: "Served", total: count(model.served), parts: stage(2) },
    { key: "orders", label: "Orders", total: count(model.orders), parts: stage(3) },
  ];
  return rows.filter((row) => row.parts.length > 0);
}

/**
 * The week's requests as one plain bar per outcome: ordered, priced but not ordered, and lost by reason. Counts come
 * from the flow model, so they add up to the week's requests and never exceed it.
 */
export function requestBars(model: FlowModel): PlainBar[] {
  const node = (id: FlowNodeId) => model.nodes.find((item) => item.id === id);
  const bars: PlainBar[] = [
    { key: "ordered", label: "Ordered", count: node("ordered")?.count ?? 0, tone: "good" },
    { key: "no_order", label: "Priced, not ordered", count: node("no_order")?.count ?? 0, tone: "neutral" },
  ];
  for (const item of model.nodes.filter((entry) => entry.tone === "unserved")) {
    const priced = item.net !== undefined && item.net > 0;
    bars.push({
      key: item.id,
      label: `Lost: ${item.label.toLowerCase()}`,
      count: item.count,
      tone: "lost",
      ...(priced ? { note: `${eur(item.net ?? 0)} est.` } : item.unpriced ? { note: "no price" } : {}),
    });
  }
  return bars.filter((bar) => bar.count > 0);
}
