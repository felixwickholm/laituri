import { now } from "@/lib/clock";

const DATE = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Helsinki" });

/** The date line under a page title, in Helsinki: "Saturday 14 November". */
export function pageDate(at: Date = now()): string {
  return DATE.format(at);
}
