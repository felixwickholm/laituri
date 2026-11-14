import { AsyncLocalStorage } from "node:async_hooks";
import { clientAddress } from "./client-address";

/** What a request's deeper code may need to know about its caller without being handed the request. */
export interface Caller {
  address: string;
}

// On globalThis, like the workspace context: every route bundle must see one context.
const holder = globalThis as typeof globalThis & { __laituriCallerContext?: AsyncLocalStorage<Caller> };
const context = (holder.__laituriCallerContext ??= new AsyncLocalStorage<Caller>());

/** Runs `work`, and everything it starts, background work included, for the caller of `headers`. */
export function asCaller<T>(headers: Headers, work: () => Promise<T>): Promise<T> {
  return context.run({ address: clientAddress(headers) }, work);
}

/** The current request's client address; "unknown" outside a request (scripts, tests that call libraries directly). */
export function callerAddress(): string {
  return context.getStore()?.address ?? "unknown";
}
