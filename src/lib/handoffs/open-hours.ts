import type { OpenHours } from "@/lib/contracts";
import { addDays, helsinkiDate, weekdayOf } from "@/lib/agent/dates";
import { helsinkiInstant } from "@/lib/seed/schedule";
import { clockTime, weekday } from "@/lib/offers/format";

/**
 * When a person at Valio Aimo answers: a demo assumption, Monday to Friday 8:00 to 16:00 Helsinki time.
 * Outside those hours the kitchen is told when someone will.
 */
export const OPEN_FROM_HOUR = 8;
export const OPEN_UNTIL_HOUR = 16;

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function helsinkiHour(at: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Helsinki", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(at);
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return part("hour") + part("minute") / 60;
}

const isWorkingDay = (date: string) => weekdayOf(date) !== 0 && weekdayOf(date) !== 6;

/** What the question is about, when it matters for the answer's timing. */
export interface HandoffTiming {
  /** The order cut-off of the delivery the question is about. */
  cutoff?: string;
  /** That delivery day, to name it. */
  deliverBy?: string;
  /** An order waits for the kitchen's decision; only then is "your order" safe. */
  hasOrder?: boolean;
}

/**
 * Whether a person answers at `at`, and a plain sentence that says when one will. When the next answer comes after
 * the order cut-off of the delivery asked about, the sentence says so: waiting would lose that delivery.
 */
export function openHours(at: Date, timing: HandoffTiming = {}): OpenHours {
  const today = helsinkiDate(at);
  const hour = helsinkiHour(at);
  if (isWorkingDay(today) && hour >= OPEN_FROM_HOUR && hour < OPEN_UNTIL_HOUR) {
    return { open: true, sentence: `A person at Valio Aimo answers today before ${OPEN_UNTIL_HOUR}:00.` };
  }
  let next = today;
  if (!isWorkingDay(today) || hour >= OPEN_UNTIL_HOUR) {
    next = addDays(today, 1);
    while (!isWorkingDay(next)) next = addDays(next, 1);
  }
  const when = next === today ? "today" : next === addDays(today, 1) ? "tomorrow" : `on ${WEEKDAY_NAMES[weekdayOf(next)]}`;
  const answers = `Valio Aimo answers ${when} from ${OPEN_FROM_HOUR}:00`;
  const opens = helsinkiInstant(next, `${String(OPEN_FROM_HOUR).padStart(2, "0")}:00`);
  if (timing.cutoff && opens.getTime() >= Date.parse(timing.cutoff)) {
    // Past the cut-off already, nothing waits safely: just say when someone answers.
    if (Date.parse(timing.cutoff) <= at.getTime()) return { open: false, sentence: `${answers}.` };
    const cutoff = `${weekday(helsinkiDate(new Date(timing.cutoff))).slice(0, 3)} ${clockTime(timing.cutoff)}`;
    const delivery = timing.deliverBy ? `${weekday(timing.deliverBy)}'s delivery` : "the delivery";
    return { open: false, sentence: `${answers}, after the order cut-off (${cutoff}). Decide yourself to keep ${delivery}.` };
  }
  return { open: false, sentence: timing.hasOrder ? `${answers}. Your order is safe until then.` : `${answers}.` };
}
