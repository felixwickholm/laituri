import { nextWeekday } from "@/lib/agent/dates";
import { BUYER_IDS } from "@/lib/mandate";
import type { CalendarEvent } from "./build";

const THURSDAY = 4;
const FRIDAY = 5;
const SATURDAY = 6;

/**
 * One booked event per demo kitchen, always in the coming week. Simulated: a real kitchen would connect its booking
 * or event calendar here.
 */
export function demoCalendar(buyerId: string, today: string): CalendarEvent[] {
  switch (buyerId) {
    case BUYER_IDS.nordicHarbour:
      return [{ date: nextWeekday(today, FRIDAY), guests: 80, occasion: "dinner", dietary: ["nut_free"] }];
    case BUYER_IDS.kaisla:
      return [{ date: nextWeekday(today, THURSDAY), guests: 120, occasion: "school lunch", dietary: ["nut_free", "sesame_free"] }];
    case BUYER_IDS.laine:
      return [{ date: nextWeekday(today, SATURDAY), guests: 60, occasion: "wedding", dietary: [] }];
    default:
      return [];
  }
}
