import type { AuditEntry, Quantity } from "@/lib/contracts";
import { helsinkiDate } from "@/lib/agent/dates";
import { eventGroup, type EventGroup } from "@/lib/console/format/log";
import { count, eur } from "@/lib/console/format/money";
import { ruleName } from "@/lib/console/format/rules";
import { day, hourMinute } from "@/lib/console/format/time";
import type { Activity } from "@/lib/store/types";
import { isKeyless } from "./names";
import type { ControlAgent, ControlOverview, DailyPoint, OutcomeCounts, PlainBar, RuleStat, RunResult, UnmetReason, UnmetRequest } from "./types";

/* ---------- Words ---------- */

/** "cooking_cream" -> "Cooking cream" */
export function conceptLabel(concept: string | undefined): string {
  if (!concept) return "Unrecognised product";
  const words = concept.replace(/[_-]+/g, " ").trim();
  return words ? words[0].toUpperCase() + words.slice(1) : "Unrecognised product";
}

const UNIT: Record<string, string> = { l: "l", kg: "kg", pcs: "pcs", pc: "pcs" };

/** [{ amount: 4550, unit: "l" }] -> "4,550 l"; several units are joined with " + ". */
export function quantityText(quantity: Quantity | Quantity[] | undefined): string {
  const list = quantity === undefined ? [] : Array.isArray(quantity) ? quantity : [quantity];
  if (list.length === 0) return "–";
  return list.map((item) => `${count(item.amount)} ${UNIT[item.unit] ?? item.unit}`).join(" + ");
}

export const REASONS: { key: UnmetReason; label: string; because: string }[] = [
  { key: "cutoff_passed", label: "Cut-off passed", because: "the order cut-off had passed" },
  { key: "short_stock", label: "Short of stock", because: "stock ran short" },
  { key: "not_found", label: "Not in the assortment", because: "we do not stock what they asked for" },
];

export function reasonLabel(reason: UnmetReason): string {
  return REASONS.find((item) => item.key === reason)?.label ?? reason;
}

/** 0.6 -> "60%" */
export function percent(rate: number): string {
  if (!Number.isFinite(rate)) return "–";
  return `${Math.round(rate * 100)}%`;
}

/** Seconds as a short duration: "35 s", "4 min", "2 h 5 min". */
export function seconds(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return "–";
  const s = Math.round(value);
  if (s < 60) return `${s} s`;
  const minutes = Math.round(s / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return minutes % 60 ? `${hours} h ${minutes % 60} min` : `${hours} h`;
}

/** How long ago, in words: "just now", "4 min ago", "3 h ago", "2 days ago". */
export function ago(iso: string | undefined, nowMs: number): string {
  if (!iso) return "–";
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "–";
  const s = Math.max(0, Math.round((nowMs - then) / 1000));
  if (s < 45) return "just now";
  const minutes = Math.round(s / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${count(n)} ${n === 1 ? one : many}`;
}

/* ---------- Figures ---------- */

export interface WeekFigures {
  /** Requests that started in the seven days. */
  requests: number;
  /** Of those requests, the ones that led to an order; never more than `requests`. */
  ordered: number;
  /** Orders placed in the seven days that are confirmed, and their net value. */
  confirmed: number;
  confirmedNet: number;
  /** The first day of the window, "2026-11-08". */
  since: string | undefined;
  today: DailyPoint | undefined;
}

/** The seven-day series summed. Money is summed in whole cents. */
export function weekFigures(daily: DailyPoint[]): WeekFigures {
  return {
    requests: daily.reduce((sum, day) => sum + day.requests, 0),
    ordered: daily.reduce((sum, day) => sum + day.ordered, 0),
    confirmed: daily.reduce((sum, day) => sum + day.confirmed, 0),
    confirmedNet: daily.reduce((cents, day) => cents + Math.round(day.confirmedNet * 100), 0) / 100,
    since: daily[0]?.date,
    today: daily[daily.length - 1],
  };
}

/** Unserved requests that started inside the series' window (Helsinki dates), so they sit beside the week's figures. */
export function unmetInWeek(unmet: UnmetRequest[], daily: DailyPoint[]): UnmetRequest[] {
  const dates = new Set(daily.map((day) => day.date));
  return unmet.filter((item) => dates.has(helsinkiDate(new Date(item.at))));
}

export function orderCount(orders: OutcomeCounts): number {
  return orders.confirmed_auto + orders.confirmed_after_approval + orders.waiting + orders.rejected + orders.blocked + orders.refused;
}

export interface ReasonTotal {
  key: UnmetReason;
  label: string;
  count: number;
  net: number;
  /** Requests with no known price, so no euros could be put on them. */
  unpriced: number;
}

/** Unserved requests grouped by reason, in the fixed order of REASONS. */
export function reasonTotals(unmet: UnmetRequest[]): ReasonTotal[] {
  return REASONS.map(({ key, label }) => {
    const rows = unmet.filter((item) => item.reason === key);
    return {
      key,
      label,
      count: rows.length,
      net: rows.reduce((cents, item) => cents + Math.round((item.estimatedLostNet ?? 0) * 100), 0) / 100,
      unpriced: rows.filter((item) => item.estimatedLostNet === undefined).length,
    };
  });
}

/** Unserved requests per product concept, so a demand bar can show the part that went unserved. */
export function unservedByConcept(unmet: UnmetRequest[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of unmet) if (item.concept) counts.set(item.concept, (counts.get(item.concept) ?? 0) + 1);
  return counts;
}

export function unmetNet(unmet: UnmetRequest[]): number {
  return unmet.reduce((cents, item) => cents + Math.round((item.estimatedLostNet ?? 0) * 100), 0) / 100;
}

/** The reason that cost the most euros; by count when nothing was priced. */
export function mainReason(unmet: UnmetRequest[]): ReasonTotal | undefined {
  const totals = reasonTotals(unmet).filter((item) => item.count > 0);
  if (totals.length === 0) return undefined;
  return [...totals].sort((a, b) => b.net - a.net || b.count - a.count)[0];
}

export interface Verdict {
  lead: string;
  reason: string;
}

/** The overview in one line: what agents bought in the last 7 days, then what went unserved in them and why. */
export function overviewVerdict(overview: ControlOverview): Verdict {
  const week = weekFigures(overview.daily);
  const buyers = overview.agents.filter((agent) => agent.confirmedNet > 0).length;
  const suspended = overview.agents.filter((agent) => agent.status === "suspended").length;
  const lead =
    overview.agents.length === 0
      ? "No agent has connected yet."
      : week.confirmedNet > 0
        ? `${buyers === 1 ? "1 agent" : `${count(buyers)} agents`} bought ${eur(week.confirmedNet)} in the last 7 days.`
        : "Agents connected, but nothing was bought in the last 7 days.";
  const unmet = unmetInWeek(overview.unmet, overview.daily);
  const main = mainReason(unmet);
  const lost = unmetNet(unmet);
  const parts: string[] = [];
  if (main) {
    parts.push(
      lost > 0
        ? `${eur(lost)} of demand went unserved, mostly because ${REASONS.find((r) => r.key === main.key)?.because}.`
        : `${plural(unmet.length, "request")} went unserved, mostly because ${REASONS.find((r) => r.key === main.key)?.because}.`,
    );
  } else if (overview.agents.length > 0) {
    parts.push("Every request was served.");
  }
  if (suspended > 0) parts.push(`${plural(suspended, "agent is", "agents are")} paused.`);
  return { lead, reason: parts.join(" ") };
}

/* ---------- Rules ---------- */

/**
 * A fired rule's name as the wholesaler reads it. The allergen rule asks a person when a product has no allergen
 * declaration and blocks when a product contains a never-buy allergen; the ask case gets its own name so the two
 * rows never read as the same rule twice.
 */
export function ruleTitle(rule: Pick<RuleStat, "rule" | "title" | "tier">): string {
  if (rule.rule === "dietary.allergens" && rule.tier === "ask") return "Allergen data missing";
  const name = ruleName(rule.rule);
  // The buyer's console names rules in the buyer's voice; Valio Aimo reads them about the buyer.
  return name === rule.rule ? rule.title : name.replace(/^Your\b/, "Buyer's");
}

/* ---------- Days ---------- */

/**
 * When a call happened, as a list shows it: "16:35" today, "Fri 16:35" earlier this week, "Mon 2 Nov 16:35" before
 * that. Days are Helsinki days.
 */
export function callTime(iso: string, nowMs: number): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "–";
  const time = hourMinute(iso);
  const then = helsinkiDate(at);
  const today = helsinkiDate(new Date(nowMs));
  if (then === today) return time;
  const days = Math.round((Date.parse(`${today}T12:00:00Z`) - Date.parse(`${then}T12:00:00Z`)) / 86_400_000);
  return days > 0 && days < 7 ? `${weekday(then)} ${time}` : `${day(iso)} ${time}`;
}

const WEEKDAY = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short" });

/** "2026-11-14" -> "Sat" */
export function weekday(date: string): string {
  const parsed = new Date(`${date}T12:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? date : WEEKDAY.format(parsed);
}

/* ---------- Outcomes ---------- */

export type OutcomeSlot = keyof OutcomeCounts;

export const OUTCOMES: { key: OutcomeSlot; label: string }[] = [
  { key: "confirmed_auto", label: "Confirmed automatically" },
  { key: "confirmed_after_approval", label: "Confirmed after approval" },
  { key: "waiting", label: "Waiting for the customer" },
  { key: "rejected", label: "Turned down by the customer" },
  { key: "blocked", label: "Blocked by a rule" },
  { key: "refused", label: "Refused" },
];

const OUTCOME_BAR: Record<OutcomeSlot, { label: string; tone: PlainBar["tone"] }> = {
  confirmed_auto: { label: "Confirmed alone", tone: "good" },
  confirmed_after_approval: { label: "Approved by a person", tone: "good" },
  waiting: { label: "Waiting for the customer", tone: "warn" },
  rejected: { label: "Turned down", tone: "neutral" },
  blocked: { label: "Blocked by a rule", tone: "lost" },
  refused: { label: "Refused", tone: "lost" },
};

/** Orders by how they ended, one plain bar each; outcomes with no order are left out. */
export function orderBars(orders: OutcomeCounts): PlainBar[] {
  return OUTCOMES.filter((item) => orders[item.key] > 0).map((item) => ({ key: item.key, count: orders[item.key], ...OUTCOME_BAR[item.key] }));
}

/** An agent with a key that called in the last 24 hours; a keyless caller is never counted as active. */
export function isActiveAgent(agent: Pick<ControlAgent, "status" | "agent">): boolean {
  return agent.status === "active" && !isKeyless(agent.agent);
}

/**
 * Status in words for the agents table. Calls made without a key can search and quote but never order,
 * so that caller reads "Read-only" rather than active or idle.
 */
export function statusWord(agent: Pick<ControlAgent, "status"> & { agent?: { id: string } }): { word: string; tone: "success" | "neutral" | "danger" } {
  if (agent.status === "suspended") return { word: "Paused", tone: "danger" };
  if (agent.agent && isKeyless(agent.agent)) return { word: "Read-only", tone: "neutral" };
  return agent.status === "active" ? { word: "Active", tone: "success" } : { word: "Idle", tone: "neutral" };
}

/* ---------- Live calls ---------- */

const TOOL_VERB: Record<string, string> = {
  search_catalog: "Search",
  get_product: "Product",
  request_quote: "Quote",
  get_mandate: "Mandate",
  place_order: "Order",
  get_order: "Status",
};

export function toolVerb(tool: string | undefined): string {
  return (tool && TOOL_VERB[tool]) || "Call";
}

/** Newest first by instant (not by string), then by id, so the order never flickers between polls. */
export function newestFirst(a: Pick<Activity, "at" | "id">, b: Pick<Activity, "at" | "id">): number {
  return Date.parse(b.at) - Date.parse(a.at) || b.id.localeCompare(a.id);
}

/** Tool calls from every buyer's agent, newest first, without repeats. */
export function liveCalls(lists: Activity[][], limit: number): Activity[] {
  const seen = new Set<string>();
  const calls: Activity[] = [];
  for (const item of lists.flat()) {
    if (item.kind !== "tool" || seen.has(item.id)) continue;
    seen.add(item.id);
    calls.push(item);
  }
  return calls.sort(newestFirst).slice(0, limit);
}

/** What an agent asked for: its quotes, newest first; its searches when it never asked for a quote. */
export function recentAsks(activity: Activity[], agentId: string, limit: number): Activity[] {
  const own = activity.filter((item) => item.agent.id === agentId && item.kind === "tool").sort(newestFirst);
  const quotes = own.filter((item) => item.tool === "request_quote");
  return (quotes.length > 0 ? quotes : own.filter((item) => item.tool === "search_catalog")).slice(0, limit);
}

/** The distinct buyers behind the connected agents, in the order the agents are listed. */
export function buyersOf(agents: ControlAgent[]): { id: string; name: string }[] {
  const seen = new Map<string, string>();
  for (const agent of agents) if (agent.buyer && !seen.has(agent.buyer.id)) seen.set(agent.buyer.id, agent.buyer.name);
  return [...seen].map(([id, name]) => ({ id, name }));
}

/* ---------- Audit ---------- */

export interface AuditFilter {
  buyer: string | "all";
  group: EventGroup | "all";
}

/** Entries newest first, narrowed by buyer and by event group. */
export function filterAudit(entries: AuditEntry[], filter: AuditFilter): AuditEntry[] {
  return [...entries]
    .sort((a, b) => b.seq - a.seq)
    .filter((entry) => filter.buyer === "all" || entry.refs.buyerId === filter.buyer)
    .filter((entry) => filter.group === "all" || eventGroup(entry.event) === filter.group);
}

/** "laituri-audit-2026-11-14-nordic-harbour-hotels.json" */
export function exportName(dateIso: string, buyerName: string | undefined): string {
  const slug = (buyerName ?? "all-buyers")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `laituri-audit-${dateIso.slice(0, 10)}-${slug || "all-buyers"}.json`;
}

/* ---------- Two kitchens ---------- */

export interface KitchenOutcome {
  buyer: string;
  word: string;
  tone: "success" | "waiting" | "danger" | "neutral";
  summary: string;
  orderId?: string;
}

/**
 * A purchase summary without the order id the agent puts in front: "Order ord_x confirmed: 3 cases …" -> "3 cases …",
 * "Order ord_x was blocked: may contain sesame. Nothing was ordered." -> "may contain sesame. Nothing was ordered.",
 * capitalised. The id stays on the outcome, behind technical details.
 */
export function plainSummary(summary: string): string {
  const text = summary.replace(/^Order \S+ (?:confirmed|was blocked|was rejected):\s*/, "").replace(/^Order \S+ is\s+/, "");
  return text ? text[0].toUpperCase() + text.slice(1) : text;
}

/** The two kitchens of the scene, in the order their agents speak. */
export const KITCHENS = ["Nordic Harbour Hotels", "Kaisla School Kitchens"];

/** The newest step a kitchen's agent took since the run started, while its outcome is still coming. */
export function latestStep(activity: Activity[], buyer: string, startedAt: string | undefined): string | undefined {
  if (!startedAt) return undefined;
  const steps = activity.filter((item) => item.buyer?.name === buyer && item.at >= startedAt).sort((a, b) => b.at.localeCompare(a.at));
  return steps[0]?.title;
}

/**
 * How each kitchen's purchase ended, in the order the run made them. `buyerOf` names the buyer behind an order;
 * without an order the scene's own order is used: the hotel speaks first, then the school kitchens.
 */
export function kitchenOutcomes(results: RunResult[] | undefined, buyerOf: (orderId: string) => string | undefined): KitchenOutcome[] {
  return (results ?? []).map((result, index) => {
    const buyer = (result.orderId && buyerOf(result.orderId)) || KITCHENS[index] || `Customer ${index + 1}`;
    const base = { buyer, summary: plainSummary(result.summary), orderId: result.orderId };
    switch (result.status) {
      case "confirmed":
        return { ...base, word: "Confirmed", tone: "success" };
      case "waiting":
        return { ...base, word: "Waiting for approval", tone: "waiting" };
      case "blocked":
        return { ...base, word: "Stopped by a rule", tone: "danger" };
      default:
        return { ...base, word: "Not ordered", tone: "neutral" };
    }
  });
}

/** The words the agents were given: the title of the first purchase made after the run started. */
export function runSentence(activity: Activity[], startedAt: string | undefined): string | undefined {
  if (!startedAt) return undefined;
  const titles = activity.filter((item) => item.run && item.at >= startedAt).sort((a, b) => a.at.localeCompare(b.at));
  return titles[0]?.run?.title;
}
