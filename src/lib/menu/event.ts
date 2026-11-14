import type { DietaryNeed, MenuPlanRequest } from "@/lib/contracts";
import { addDays, shortDay } from "@/lib/agent/dates";
import { ValidationError } from "@/lib/gateway/errors";
import { isDietaryNeed } from "./dietary";
import { readEventWords, type ReadEvent } from "./parse";

/** Reads free words into an event; a model may do it, validated, or nothing is returned and the rules read them. */
export type WordsReader = (words: string, today: string) => Promise<ReadEvent | undefined>;

export interface PlannedEvent {
  /** Absent when the words gave no guest count: the plan then asks for it. */
  guests?: number;
  date: string;
  occasion?: string;
  dietary: DietaryNeed[];
  courses?: number;
  budgetPerGuest?: number;
  notes: string[];
}

/** With no date in the words, the planner plans a week ahead and says so. */
const DEFAULT_DAYS_AHEAD = 7;
const MAX_GUESTS = 2000;

function fromStructured(request: Extract<MenuPlanRequest, { guests: number }>, today: string): ReadEvent & { notes: string[] } {
  const notes: string[] = [];
  const dietary = (request.dietary ?? []).flatMap((given): DietaryNeed[] => {
    if (isDietaryNeed(given)) return [given];
    const read = readEventWords(given, today).dietary;
    if (read.length === 0) notes.push(`Not understood as a dietary need: ${given.slice(0, 30)}.`);
    return read;
  });
  return { guests: request.guests, date: request.date, occasion: request.occasion, dietary, notes };
}

/**
 * A model's reading is used when it parses, but every dietary need the rules read is kept as well: a model may add a
 * need, never drop one. Its occasion is mapped to the planner's own words when they match.
 */
async function fromWords(words: string, today: string, reader?: WordsReader): Promise<ReadEvent & { notes: string[] }> {
  const byRules = readEventWords(words, today);
  const byModel = reader ? await reader(words, today).catch(() => undefined) : undefined;
  if (!byModel) return { ...byRules, notes: [] };
  const occasion = byModel.occasion ? readEventWords(byModel.occasion, today).occasion ?? byModel.occasion : byRules.occasion;
  return {
    guests: byModel.guests ?? byRules.guests,
    date: byModel.date ?? byRules.date,
    occasion,
    dietary: [...new Set([...byRules.dietary, ...byModel.dietary])],
    courses: byModel.courses ?? byRules.courses,
    budgetPerGuest: byRules.budgetPerGuest ?? byModel.budgetPerGuest,
    notes: ["A model read your words. Dishes and prices come from rules."],
  };
}

/** The event to plan for, from words or fields, with plain notes on anything assumed. */
export async function plannedEvent(request: MenuPlanRequest, today: string, reader?: WordsReader): Promise<PlannedEvent> {
  const read = "words" in request ? await fromWords(request.words, today, reader) : fromStructured(request, today);
  if (read.guests && read.guests > MAX_GUESTS) throw new ValidationError(`Plan up to ${MAX_GUESTS} guests at a time.`);
  const notes = [...read.notes];
  let date = read.date;
  if (!date) {
    date = addDays(today, DEFAULT_DAYS_AHEAD);
    notes.push(`No date given. Planned for ${shortDay(date)}.`);
  }
  if (date < today) throw new ValidationError(`The date ${date} has passed. Give a date from today on.`);
  return {
    guests: read.guests,
    date,
    occasion: read.occasion,
    dietary: [...new Set(read.dietary)],
    courses: read.courses,
    budgetPerGuest: "budgetPerGuest" in request ? request.budgetPerGuest : read.budgetPerGuest,
    notes,
  };
}
