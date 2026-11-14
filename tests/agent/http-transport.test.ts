import { afterEach, describe, expect, it, vi } from "vitest";
import type { Order } from "@/lib/contracts";
import { TransportError, httpTransport } from "@/lib/agent";
import { orderResponse } from "@/lib/http/order-response";
import { problem } from "@/lib/http/respond";

const blocked = {
  id: "ord_blocked",
  status: "blocked",
  decision: { outcome: "blocked", checks: [{ rule: "mandate.validity", status: "block", message: "The mandate is not valid." }] },
} as unknown as Order;

const ORDER = { offerJws: "a.b.c", mandateJws: "d.e.f", idempotencyKey: "key-0001" };

function answer(response: Response) {
  vi.stubGlobal("fetch", vi.fn(async () => response));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("HTTP transport", () => {
  it("reads the blocked order out of a 422 answer, so the agent can say which rule stopped it", async () => {
    answer(orderResponse(blocked));
    expect(await httpTransport("http://laituri.test", "token").placeOrder(ORDER)).toEqual(blocked);
  });

  it("returns a pending order from a 202 answer", async () => {
    const pending = { ...blocked, status: "pending_approval" } as Order;
    answer(orderResponse(pending));
    expect(await httpTransport("http://laituri.test", "token").placeOrder(ORDER)).toEqual(pending);
  });

  it("still throws for other problems", async () => {
    answer(problem(409, "idempotency_conflict", "This idempotency key was already used for a different offer."));
    await expect(httpTransport("http://laituri.test", "token").placeOrder(ORDER)).rejects.toBeInstanceOf(TransportError);
  });
});
