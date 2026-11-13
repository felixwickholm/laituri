import { describe, expect, it } from "vitest";
import { isoWeek, isoWeekKey, sameIsoWeek } from "@/lib/policy";

describe("ISO week", () => {
  it("numbers weeks per ISO 8601", () => {
    expect(isoWeekKey(new Date("2026-11-14T09:00:00+02:00"))).toBe("2026-W46");
    expect(isoWeek(new Date("2027-01-01T12:00:00+02:00"))).toEqual({ year: 2026, week: 53 });
    expect(isoWeek(new Date("2025-12-29T12:00:00+02:00"))).toEqual({ year: 2026, week: 1 });
  });

  it("uses the buyer's local date", () => {
    // Sunday 23:30 UTC is already Monday in Helsinki.
    expect(isoWeekKey(new Date("2026-11-15T23:30:00Z"))).toBe("2026-W47");
    expect(sameIsoWeek(new Date("2026-11-09T08:00:00+02:00"), new Date("2026-11-15T22:00:00+02:00"))).toBe(true);
  });
});
