import { describe, expect, it } from "vitest";
import { orderOfRun, spokenRunResult } from "@/lib/console/orb-speech";
import type { DemoRun } from "@/lib/console/types";
import { blockedOrder, pendingOrder } from "./fixtures";

const STARTED = Date.parse("2026-11-14T06:59:00.000Z");
const RUN: DemoRun = { id: "run_1", status: "done", request: "1,800 l milk", summary: "Waiting for approval." };

describe("spokenRunResult", () => {
  it("finds the order the run placed", () => {
    const earlier = pendingOrder({ id: "ord_0", createdAt: "2026-11-14T06:00:00.000Z" });
    expect(orderOfRun([earlier, pendingOrder()], STARTED)?.id).toBe("ord_1");
  });

  it("says why an order waits for a person", () => {
    expect(spokenRunResult(RUN, [pendingOrder()], STARTED)).toBe("This one needs you: order total 1,818.00 EUR is over the 1,500.00 EUR limit.");
  });

  it("says nothing was ordered when a rule blocked it", () => {
    expect(spokenRunResult(RUN, [blockedOrder()], STARTED)).toBe("Nothing was ordered. Hazelnut spread contains nuts.");
  });

  it("falls back to the run's own summary, and admits failure", () => {
    expect(spokenRunResult(RUN, [], STARTED)).toBe("Waiting for approval.");
    expect(spokenRunResult({ ...RUN, status: "failed" }, [], STARTED)).toBe("Something went wrong, so nothing was ordered.");
  });
});
