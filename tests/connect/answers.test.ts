import { describe, expect, it } from "vitest";
import { blockedReasons, problemSentence, readOrderAnswer } from "@/lib/connect/answers";

const check = (status: string, message: string) => ({ rule: "limit.per_order", status, message });

/** A 422 as the order route answers it: problem fields, plus the blocked order itself. */
const blocked = (checks: ReturnType<typeof check>[]) => ({
  type: "urn:laituri:problem:order_blocked",
  title: "Order blocked",
  status: 422,
  detail: "The order was blocked.",
  code: "order_blocked",
  order: { id: "ord_9", status: "blocked", decision: { outcome: "blocked", checks } },
});

describe("order answers", () => {
  it("reads 201 as confirmed and 202 as waiting for a person", () => {
    expect(readOrderAnswer(201, { id: "ord_1", status: "confirmed" })).toEqual({
      tone: "ok",
      summary: "Ordered inside your limits. Valio Aimo signed the receipt. Order ord_1.",
    });
    expect(readOrderAnswer(202, { id: "ord_2", status: "pending_approval" })).toEqual({
      tone: "waiting",
      summary: "Needs you. A person approves it before it is ordered. Order ord_2.",
    });
  });

  it("names every rule that blocked the order, and only those", () => {
    const body = blocked([
      check("pass", "Inside the per-order limit."),
      check("block", "The offer expired at 10:15."),
      check("ask", "First order of this product."),
      check("block", "The mandate is for another agent"),
    ]);
    expect(readOrderAnswer(422, body)).toEqual({
      tone: "blocked",
      summary: "Blocked, nothing was ordered. The offer expired at 10:15. The mandate is for another agent. Order ord_9.",
    });
  });

  it("still says the order was blocked when no rule sentence came with it", () => {
    expect(readOrderAnswer(422, blocked([]))).toEqual({ tone: "blocked", summary: "Blocked, nothing was ordered. Order ord_9." });
  });

  it("reads any other refusal as its problem sentence", () => {
    expect(readOrderAnswer(409, { code: "offer_used", detail: "This offer was already used for an order." })).toEqual({
      tone: "error",
      summary: "This offer was already used for an order.",
    });
    expect(readOrderAnswer(500, null)).toEqual({ tone: "error", summary: "The server answered 500." });
  });

  it("collects block sentences from a decision and ignores a malformed one", () => {
    expect(blockedReasons({ decision: { checks: [check("block", "Over the weekly limit.")] } })).toEqual(["Over the weekly limit."]);
    expect(blockedReasons({ decision: { checks: "none" } })).toEqual([]);
    expect(blockedReasons(undefined)).toEqual([]);
  });
});

describe("problem sentences", () => {
  it("prefers the problem's own detail, such as why a quote was refused", () => {
    expect(problemSentence(422, { code: "delivery_date_past", detail: "The delivery date 2026-11-01 has already passed." })).toBe(
      "The delivery date 2026-11-01 has already passed.",
    );
  });

  it("falls back to plain words for the status when the body has no sentence", () => {
    expect(problemSentence(0, null)).toBe("The request did not reach the server.");
    expect(problemSentence(401, {})).toBe("The server did not recognise the agent key.");
    expect(problemSentence(418, { detail: "" })).toBe("The server answered 418.");
  });
});
