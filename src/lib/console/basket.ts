import type { Basket, BasketLine, CreateBasketRequest, LineOption, LineState, WeeklyDraft } from "@/lib/contracts";

interface Quantity {
  amount: number;
  unit: string;
}
import { count, eurWhole } from "./format/money";
import { helsinkiDate, weekStart } from "./format/week";

type LightTone = "success" | "waiting" | "danger" | "neutral";

/** Each line state as a word and a tone; the screens add the icon. Colour is never the only sign. */
export const LINE_STATE: Record<LineState, { word: string; tone: LightTone }> = {
  green: { word: "Ordered", tone: "success" },
  orange: { word: "Needs you", tone: "waiting" },
  red: { word: "Blocked", tone: "danger" },
  working: { word: "Working", tone: "neutral" },
};

interface LineGroups {
  needsYou: BasketLine[];
  blocked: BasketLine[];
  ordered: BasketLine[];
  working: BasketLine[];
}

/** The lines in reading order: what needs a person first, then what is blocked, then what is done. */
export function groupLines(lines: BasketLine[]): LineGroups {
  return {
    needsYou: lines.filter((line) => line.state === "orange"),
    blocked: lines.filter((line) => line.state === "red"),
    ordered: lines.filter((line) => line.state === "green"),
    working: lines.filter((line) => line.state === "working"),
  };
}

function lines(n: number): string {
  return n === 1 ? "1 line" : `${count(n)} lines`;
}

/** The counts as the lines say them, so a stale `totals` never disagrees with the list below it. */
export function lineCounts(basket: Pick<Basket, "lines">): Record<LineState, number> {
  const tally: Record<LineState, number> = { green: 0, orange: 0, red: 0, working: 0 };
  for (const line of basket.lines) tally[line.state] += 1;
  return tally;
}

/** The page's verdict in one plain sentence: "Your agent ordered 17 lines. 2 need you. 1 is blocked." */
export function basketVerdict(basket: Pick<Basket, "lines" | "status">): string {
  const n = lineCounts(basket);
  const total = basket.lines.length;
  if (basket.status === "running" || n.working > 0) {
    const done = total - n.working;
    return `Your agent is working on ${lines(total)}. ${done === 1 ? "1 is" : `${count(done)} are`} done.`;
  }
  if (n.green === total) return `Your agent ordered all ${lines(total)}.`;
  const parts = [`Your agent ordered ${lines(n.green)}.`];
  if (n.orange > 0) parts.push(`${count(n.orange)} ${n.orange === 1 ? "needs" : "need"} you.`);
  if (n.red > 0) parts.push(`${count(n.red)} ${n.red === 1 ? "is" : "are"} blocked.`);
  return parts.join(" ");
}

/** "Done in 8 s. About 20 min by hand." Only the hand estimate while the agent still works. */
export function timeSaved(totals: Pick<Basket["totals"], "secondsTaken" | "minutesByHand">, running: boolean): string {
  const byHand = `About ${count(totals.minutesByHand)} min by hand.`;
  if (running || totals.secondsTaken === undefined) return byHand;
  const seconds = Math.max(1, Math.round(totals.secondsTaken));
  const took = seconds < 60 ? `${seconds} s` : `${Math.round(seconds / 60)} min`;
  return `Done in ${took}. ${byHand}`;
}

/** "€3,240 of your €9,000 weekly limit used." */
export function limitUsed(spent: number, weeklyLimit: number): string {
  return `${eurWhole(spent)} of your ${eurWhole(weeklyLimit)} weekly limit used.`;
}

/** The orb's caption while lines are worked: "Working on line 9 of 20." */
export function workingCaption(basket: Pick<Basket, "lines">): string {
  const total = basket.lines.length;
  const done = basket.lines.filter((line) => line.state !== "working").length;
  return total === 0 ? "Starting the order." : `Working on line ${Math.min(done + 1, total)} of ${total}.`;
}

/** "1,000 l", "20 kg", "40 pcs" */
export function quantity(amount: Quantity): string {
  return `${count(amount.amount)} ${amount.unit}`;
}

/** The options a person can take on a line, hand-off excluded; the screens add "Ask Valio Aimo" themselves. */
function choices(line: BasketLine): LineOption[] {
  return (line.options ?? []).filter((option) => option.kind !== "handoff");
}

/** The option shown as the primary button: the first the server lists. Undefined when the line has none. */
export function primaryOption(line: BasketLine): LineOption | undefined {
  return choices(line)[0];
}

/** Every other option, for the "More" menu. */
export function moreOptions(line: BasketLine): LineOption[] {
  return choices(line).slice(1);
}

/** A line a person can still act on. */
export function isOpen(line: BasketLine): boolean {
  return (line.state === "orange" || line.state === "red") && !line.resolved;
}

/** "Line: 20 kg almond flour. Blocked: contains nuts. Your rules say no." The hand-off's context, filled in. */
export function handoffContext(line: Pick<BasketLine, "words" | "asked" | "state" | "reason">): string {
  const what = line.words.toLowerCase().includes(String(line.asked.amount)) ? line.words : `${quantity(line.asked)} ${line.words}`;
  const reason = line.reason.trim();
  const lead = line.state === "red" ? "Blocked" : "Needs you";
  const head = `Line: ${what.replace(/\.$/, "")}.`;
  if (reason.includes(":")) return `${head} ${lead}. ${reason}`;
  return `${head} ${lead}: ${reason[0]?.toLowerCase() ?? ""}${reason.slice(1)}`;
}

const EVENT_WORDS = /\b(event|events|guests?|wedding|party|parties|banquet|birthday|gala|conference|reception|dinner for|lunch for|buffet|catering|menu for)\b|häät|häihin|juhla|juhliin|vieras|vierasta|illallinen|pikkujoulu|bröllop|fest|gäster|middag för/i;
const PEOPLE = /\bfor\s+\d+\s*(people|persons|pax|covers)?\b/i;

/** A sentence about an event or guests goes to the menu planner rather than the single-request agent. */
export function isEventRequest(words: string): boolean {
  return EVENT_WORDS.test(words) || (PEOPLE.test(words) && /\b(people|persons|pax|covers|guests)\b/i.test(words));
}

const WEEKLY_WORDS = /\b(weekly order|this week'?s (lines|order)|standing order|usual order|order the usual)\b/i;

/** "Order this week's lines" starts the standing weekly order. */
export function isWeeklyRequest(words: string): boolean {
  return WEEKLY_WORDS.test(words.replace(/’/g, "'"));
}

function inThisWeek(iso: string, nowMs: number): boolean {
  const at = Date.parse(iso);
  return !Number.isNaN(at) && helsinkiDate(at).date >= weekStart(nowMs);
}

/** The basket the page leads with: one the agent still works on, else this week's weekly order. */
export function currentBasket(baskets: Basket[], nowMs: number): Basket | undefined {
  const newest = [...baskets].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return newest.find((basket) => basket.status === "running") ?? newest.find((basket) => basket.source === "weekly" && inThisWeek(basket.createdAt, nowMs));
}

const WEEKDAY = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "long" });
const ZONED_WEEKDAY = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Helsinki", weekday: "long" });
const ZONED_TIME = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Helsinki", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/** "2026-11-16" -> "Monday" */
export function weekdayOf(date: string): string {
  const value = new Date(`${date.slice(0, 10)}T12:00:00Z`);
  return Number.isNaN(value.getTime()) ? "" : WEEKDAY.format(value);
}

/** "Sunday 17:00", Helsinki time. */
export function cutoffText(iso: string): string {
  const value = new Date(iso);
  return Number.isNaN(value.getTime()) ? "" : `${ZONED_WEEKDAY.format(value)} ${ZONED_TIME.format(value)}`;
}

/** "Your Monday order is ready: 20 lines. Closes Sunday 17:00." */
export function draftLead(draft: Pick<WeeklyDraft, "deliverBy" | "cutoff" | "lines">): string {
  const ready = `Your ${weekdayOf(draft.deliverBy)} order is ready: ${lines(draft.lines.length)}.`;
  const closes = cutoffText(draft.cutoff);
  return closes ? `${ready} Closes ${closes}.` : ready;
}

/** The section heading over the draft or the basket: "Weekly order for Monday". */
export function basketHeading(basket: Pick<Basket, "title" | "deliverBy" | "source">): string {
  if (basket.source === "weekly") return `Weekly order for ${weekdayOf(basket.deliverBy)}`;
  return basket.title;
}

/** Every order id a basket placed, so the single-request lists can leave them out. */
export function basketOrderIds(baskets: Basket[]): Set<string> {
  return new Set(baskets.flatMap((basket) => basket.lines.map((line) => line.orderId).filter((id): id is string => Boolean(id))));
}

type DraftLine = WeeklyDraft["lines"][number];

/** What a person changed in the draft before sending: a new amount, or the line left out. */
export interface DraftEdit {
  amount?: number;
  removed?: boolean;
}

/** The draft as a basket request, with the person's edits applied. Lines at zero or left out are dropped. */
export function draftRequest(draft: WeeklyDraft, edits: Record<number, DraftEdit>): CreateBasketRequest {
  const lines = draft.lines.flatMap((line, index) => {
    const edit = edits[index] ?? {};
    const amount = edit.amount ?? line.quantity.amount;
    return edit.removed || !(amount > 0) ? [] : [{ words: line.words, quantity: { amount, unit: line.quantity.unit } }];
  });
  return { title: draft.title, deliverBy: draft.deliverBy, source: "manual", lines };
}

/** A short note on how a line moved since last week: "New this week." / "Last week 40 l." Same as last week says nothing. */
export function changeNote(line: DraftLine): string | undefined {
  if (line.note) return line.note;
  if (line.change === "new") return "New this week.";
  if (line.change === "same" || !line.lastWeek) return undefined;
  return `Last week ${quantity(line.lastWeek)}.`;
}
