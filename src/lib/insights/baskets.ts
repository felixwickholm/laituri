import type { SupplierOverview } from "@/lib/contracts";
import type { InsightInput } from "./types";

/**
 * Baskets worked, their lines, and the share of finished lines ordered without a person: green and never resolved by
 * one. A line a person approved, swapped or changed is green too, but a person did it. Each line is also counted as a
 * request above.
 */
export function basketStats(baskets: NonNullable<InsightInput["baskets"]>): NonNullable<SupplierOverview["baskets"]> {
  const lines = baskets.flatMap((basket) => basket.lines);
  const finished = lines.filter((line) => line.state !== "working");
  const auto = finished.filter((line) => line.state === "green" && !line.resolved).length;
  return { count: baskets.length, lines: lines.length, autoShare: finished.length ? Math.round((auto / finished.length) * 1000) / 1000 : 0 };
}

/**
 * The orders a person chose on a basket line (a swap, what is in stock, a drifted line). The buyer's agent placed
 * each and the mandate let it confirm, but a person decided it, as the signed `basket.line_resolved` entry records.
 */
export function chosenByPerson(baskets: NonNullable<InsightInput["baskets"]>): Set<string> {
  return new Set(baskets.flatMap((basket) => basket.lines.flatMap((line) => (line.resolved && line.orderId ? [line.orderId] : []))));
}
