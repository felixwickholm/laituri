import { count } from "@/lib/offers/format";

/** One week of a standing order: what each line asked for. */
export interface WeekOfOrders {
  lines: { label: string; amount: number; unit: string }[];
}

/** A move smaller than this share is noise, not drift. */
const DRIFT_SHARE = 0.2;
/** A line ordered the same this many weeks running is worth saying so. */
const STEADY_WEEKS = 4;
/** At most this many moves, then one steady line. */
const MAX_MOVES = 2;

const NUMBER_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];

function inWords(value: number): string {
  return NUMBER_WORDS[value] ?? count(value);
}

interface Finding {
  weight: number;
  sentence: string;
}

/** The amounts of one line, oldest first, over the weeks that ordered it in the same unit. */
function series(weeks: WeekOfOrders[], label: string, unit: string): number[] {
  return weeks.flatMap((week) => week.lines.filter((line) => line.label === label && line.unit === unit).map((line) => line.amount));
}

/**
 * How a standing order moved over the weeks given, oldest first: "Cream is up 40% in four weeks." for a line that
 * grew or shrank by a fifth or more, "Eggs: 36 kg again, same as the last three weeks." for one that never changed.
 * The two largest moves, then one steady line. Pure.
 */
export function driftSentences(weeks: WeekOfOrders[]): string[] {
  const latest = weeks.at(-1)?.lines ?? [];
  const findings: Finding[] = [];
  for (const { label, unit } of latest) {
    const amounts = series(weeks, label, unit);
    if (amounts.length < 3) continue;
    const first = amounts[0];
    const last = amounts[amounts.length - 1];
    const share = first > 0 ? (last - first) / first : 0;
    if (Math.abs(share) >= DRIFT_SHARE) {
      const direction = share > 0 ? "up" : "down";
      findings.push({ weight: Math.abs(share), sentence: `${label} is ${direction} ${Math.round(Math.abs(share) * 100)}% in ${inWords(amounts.length)} weeks.` });
      continue;
    }
    const steady = amounts.slice(-STEADY_WEEKS);
    if (steady.length === STEADY_WEEKS && steady.every((amount) => amount === last)) {
      findings.push({ weight: 0, sentence: `${label}: ${count(last)} ${unit} again, same as the last ${inWords(STEADY_WEEKS - 1)} weeks.` });
    }
  }
  const moves = findings.filter((finding) => finding.weight > 0).sort((a, b) => b.weight - a.weight);
  const steady = findings.filter((finding) => finding.weight === 0);
  return [...moves.slice(0, MAX_MOVES), ...steady.slice(0, 1)].map((finding) => finding.sentence);
}

/** A weekly line's amount this week against the weeks before, and its unit price against last week. */
export interface LineDriftInput {
  amount: number;
  /** The amounts asked in the earlier weeks, oldest first; the last four count. */
  usual: number[];
  /** Net price per litre, kilo or sales unit, now and last week. */
  price?: { now: number; last: number };
  /** The share a price may rise before a person checks it. */
  cap: number;
}

/** An amount this far above or below the usual median stops the line for a person. */
const AMOUNT_DRIFT = 0.5;
/** The weeks the usual amount is the median of. */
const USUAL_WEEKS = 4;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/**
 * Why a standing-order line should wait for a person: an amount at least half again above or below the median of the
 * last four weeks, or a unit price that rose more than `cap` since last week. Undefined when the line looks usual. Pure.
 */
export function lineDrift({ amount, usual, price, cap }: LineDriftInput): string | undefined {
  const weeks = usual.slice(-USUAL_WEEKS).filter((value) => value > 0);
  if (weeks.length) {
    const typical = median(weeks);
    const share = (amount - typical) / typical;
    if (Math.abs(share) >= AMOUNT_DRIFT) {
      if (Math.abs(amount - 2 * typical) < 0.01 * typical) return "Twice your usual amount. Check it.";
      const span = weeks.length === 1 ? "week" : `${count(weeks.length)} weeks`;
      return `${share > 0 ? "Up" : "Down"} ${Math.round(Math.abs(share) * 100)}% on your usual ${span}.`;
    }
  }
  if (price && price.last > 0) {
    const rise = price.now / price.last - 1;
    if (rise > cap + 1e-9) return `Price up ${Math.round(rise * 100)}% on last week. Check it.`;
  }
  return undefined;
}
