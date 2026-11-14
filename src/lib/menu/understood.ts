import type { DietaryNeed } from "@/lib/contracts";
import { day } from "@/lib/offers/format";
import { NEED_PHRASE } from "./dietary";

const COURSE_WORDS: Record<number, string> = { 2: "two courses", 3: "three courses", 4: "four courses" };

function article(occasion: string): string {
  return /^[aeiou]/i.test(occasion) ? `An ${occasion}` : `A ${occasion}`;
}

function joined(phrases: string[]): string {
  if (phrases.length <= 1) return phrases.join("");
  return `${phrases.slice(0, -1).join(", ")} and ${phrases.at(-1)}`;
}

/** The request read back the way a person would repeat it: "A wedding for 80 guests on Saturday 21 Nov, three courses, no nuts." */
export function understoodSentence(event: { guests?: number; date: string; occasion?: string; dietary: DietaryNeed[] }, courses?: number): string {
  const guests = event.guests ? `${event.guests} guests` : "";
  const who = event.occasion ? [article(event.occasion), guests && `for ${guests}`].filter(Boolean).join(" ") : guests || "An event";
  const parts = [`${who} on ${day(event.date)}`];
  if (courses && COURSE_WORDS[courses]) parts.push(COURSE_WORDS[courses]);
  if (event.dietary.length) parts.push(joined(event.dietary.map((need) => NEED_PHRASE[need])));
  return `${parts.join(", ")}.`;
}
