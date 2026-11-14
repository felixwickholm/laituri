import { newId } from "@/lib/offers/assemble";
import { seededMark } from "@/lib/provenance";
import type { Store } from "@/lib/store/types";
import type { DemandRecord } from "./types";

/** A quote this soon after the same caller's last request continues it, when it is for a product found there or of the same type. */
const FOLLOW_UP_MS = 15 * 60_000;

export type DemandInput = Omit<DemandRecord, "id" | "requestId" | "at" | "seeded">;

/** The request a new record belongs to, or undefined when it starts a new one. A search always starts one. */
export function continuedRequest(input: DemandInput, earlier: DemandRecord[], at: Date): string | undefined {
  if (input.kind !== "quote") return undefined;
  const last = earlier.findLast((record) => record.agent.id === input.agent.id && record.client === input.client);
  if (!last || at.getTime() - Date.parse(last.at) > FOLLOW_UP_MS) return undefined;
  const found = input.productIds.some((id) => last.productIds.includes(id));
  const sameType = input.concept !== undefined && input.concept === last.concept;
  return found || sameType ? last.requestId : undefined;
}

/** Appends one record to the request log. */
export async function logDemand(input: DemandInput, deps: { store: Pick<Store, "requests">; now: () => Date }): Promise<DemandRecord> {
  const at = deps.now();
  const requestId = continuedRequest(input, await deps.store.requests.list(), at) ?? newId("req_");
  const record: DemandRecord = { id: newId("dem_"), requestId, at: at.toISOString(), ...input, ...seededMark() };
  await deps.store.requests.append(record);
  return record;
}
