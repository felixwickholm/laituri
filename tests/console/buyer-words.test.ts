import { describe, expect, it } from "vitest";
import type { AuditEntry, OfferLine } from "@/lib/contracts";
import { roundingNote } from "@/lib/console/format/packs";
import { ruleChecklist } from "@/lib/console/format/rules";
import { callWords, stepText } from "@/lib/console/format/run-view";
import { brandOf, substitutionTag } from "@/lib/console/format/substitution";
import { agentSuspension, suspensionLine } from "@/lib/console/suspension";
import { pendingOrder } from "./fixtures";

const AGENT = "agent:harbour-purchasing";

function entry(seq: number, event: AuditEntry["event"], data: Record<string, unknown>): AuditEntry {
  return {
    seq,
    at: "2026-11-14T10:04:00.000Z",
    actor: { type: "supplier", id: "op", name: "Valio Aimo operator" },
    event,
    summary: "",
    refs: {},
    data,
    prevHash: "",
    hash: "",
    signature: "",
  };
}

describe("agentSuspension", () => {
  it("is the newest suspension of this agent, with its reason and operator", () => {
    const audit = [entry(1, "agent.suspended", { agentId: AGENT, reason: "Unusual order volume", operator: { name: "Anna Virtanen" } })];
    const suspension = agentSuspension(audit, AGENT);
    expect(suspension).toEqual({ suspendedAt: "2026-11-14T10:04:00.000Z", reason: "Unusual order volume", by: "Anna Virtanen" });
    expect(suspensionLine(suspension!)).toMatch(/^Since .+, by Anna Virtanen\. Reason: Unusual order volume\.$/);
  });

  it("ends when the agent is resumed, and ignores other agents", () => {
    expect(agentSuspension([entry(1, "agent.suspended", { agentId: AGENT }), entry(2, "agent.resumed", { agentId: AGENT })], AGENT)).toBeUndefined();
    expect(agentSuspension([entry(1, "agent.suspended", { agentId: "agent:other" })], AGENT)).toBeUndefined();
    expect(agentSuspension([entry(1, "agent.suspended", { agentId: AGENT })], undefined)).toBeUndefined();
  });

  it("says when no reason was given", () => {
    expect(suspensionLine({ suspendedAt: "2026-11-14T10:04:00.000Z" })).toMatch(/No reason was given\.$/);
  });
});

function line(patch: Partial<OfferLine>): OfferLine {
  return { ...pendingOrder().offer.lines[0], ...patch };
}

describe("substitutionTag", () => {
  const substitute = (name: string, asked: string) =>
    line({ name, substituteFor: { productId: "1", name: asked, reason: "short", likeForLike: true, priceChangePct: 0 } });

  it("says the brand changed when another maker's product came instead", () => {
    const order = pendingOrder();
    order.offer.lines = [substitute("Valio Eila® 1 l", "Arla Milkdrink 1L")];
    expect(substitutionTag(order)).toBe("Brand changed");
  });

  it("says substituted for the same maker's other product, and nothing when all is as asked", () => {
    const order = pendingOrder();
    order.offer.lines = [substitute("Valio Arki Eila 1 l", "Valio Eila 1 l")];
    expect(substitutionTag(order)).toBe("Substituted");
    expect(substitutionTag(pendingOrder())).toBeUndefined();
    expect(brandOf("Arla® Milkdrink")).toBe("arla");
  });
});

describe("roundingNote", () => {
  const ciabatta = line({ name: "Dafgårds ciabatta 58g", quantity: 3, salesUnit: "KI", content: { amount: 13.92, unit: "kg" } });
  const check = (asked: string, offered: string) => [{ requirement: "quantity" as const, asked, offered, result: "met" as const, certain: false }];

  it("says in words when whole cases come to more than was asked", () => {
    expect(roundingNote({ lines: [ciabatta], requestCheck: check("10 kg", "13.92 kg") })).toBe("Asked 10\u00a0kg. Whole cases only: 3 cases = 13.92\u00a0kg.");
  });

  it("stays quiet when the amount is what was asked or cannot be compared", () => {
    expect(roundingNote({ lines: [line({})], requestCheck: check("1,800 l", "1,800 l") })).toBeUndefined();
    expect(roundingNote({ lines: [ciabatta] })).toBeUndefined();
    expect(roundingNote({ lines: [ciabatta, ciabatta], requestCheck: check("10 kg", "27.84 kg") })).toBeUndefined();
  });
});

describe("ruleChecklist", () => {
  it("counts the passed rules and names each one in the order checked", () => {
    const list = ruleChecklist(pendingOrder());
    expect(list).toMatchObject({ passed: 2, total: 3 });
    expect(list.rules.map((rule) => [rule.name, rule.status])).toEqual([
      ["Offer signature", "pass"],
      ["Per-order limit", "ask"],
      ["Product match", "pass"],
    ]);
  });
});

describe("stepText", () => {
  it("puts a refused call in a purchasing lead's words, with no tool name", () => {
    expect(stepText("Refused search_catalog: the agent is suspended")).toBe("Valio Aimo refused a catalogue search: the agent is suspended.");
    expect(stepText("Refused POST /api/v1/quotes: the agent is suspended.")).toBe("Valio Aimo refused a quote request: the agent is suspended.");
    expect(callWords("place_order")).toBe("an order");
    expect(stepText("Looking for milk.")).toBe("Looking for milk.");
    expect(stepText("Offer signed by Valio Aimo: 1,600 × milk = 1,600 l, 1,834.16 EUR with VAT. Valid 15 minutes.")).toBe(
      "Offer signed by Valio Aimo: 1,600 × milk = 1,600\u00a0l. Valid 15 minutes.",
    );
  });
});

describe("feedTime", () => {
  it("shows the time alone today and the weekday on an earlier day", async () => {
    const { feedTime } = await import("@/lib/console/format/time");
    const now = Date.parse("2026-11-14T10:00:00.000Z");
    expect(feedTime("2026-11-14T07:12:00.000Z", now)).toBe("09:12");
    expect(feedTime("2026-11-13T14:35:00.000Z", now)).toBe("Fri 16:35");
  });
});

describe("refused orders", () => {
  it("are their own outcome, with the reason, and never count as blocked by the mandate", async () => {
    const { orderOutcome, weekStats } = await import("@/lib/console/format/orders");
    const { blockedLine } = await import("@/lib/console/format/rules");
    const refused = pendingOrder({ status: "blocked", refusal: { code: "invalid_signature", message: "Refused: the offer signature does not verify." } });
    expect(orderOutcome(refused)).toMatchObject({ key: "refused", label: "Refused", rule: "The offer signature does not verify." });
    expect(blockedLine(refused)).toBe("Refused. The offer signature does not verify.");
    expect(weekStats([refused], Date.parse("2026-11-14T08:00:00.000Z")).blocked).toBe(0);
  });
});

describe("approvals", () => {
  it("says how long the price is held when the wholesaler signed a hold", async () => {
    const { priceHoldLine } = await import("@/lib/console/format/approval");
    expect(priceHoldLine({ priceHold: { heldUntil: "2026-11-14T12:30:00.000Z", jws: "x" } })).toBe("Price held until 14:30");
    expect(priceHoldLine({})).toBeUndefined();
  });

  it("reads an approval the re-check stopped, with the signed alternatives", async () => {
    const { stoppedApproval } = await import("@/lib/console/format/approval");
    const order = pendingOrder({ status: "blocked" });
    order.decision = { outcome: "blocked", checks: [{ rule: "delivery.partial", status: "block", message: "Only 51 of 200 are in stock." }] };
    const alternative = { tier: "good", meaning: "", tradeoff: "Another brand, 4% dearer.", signed: { offer: pendingOrder().offer, jws: "x" } };
    const view = stoppedApproval({ code: "approval_blocked", order, alternatives: [alternative] });
    expect(view?.reason).toBe("Not approved: only 51 of 200 are in stock.");
    expect(view?.alternatives[0]).toMatchObject({ net: "€1,818.00 net", tradeoff: "Another brand, 4% dearer." });
    expect(stoppedApproval({ detail: "x" })).toBeUndefined();
  });
});

describe("matchedFacts", () => {
  it("shows a substituted requirement with the delivered product and the substitution rule", async () => {
    const { matchedFacts } = await import("@/lib/console/format/proof");
    const order = pendingOrder();
    order.offer.requestCheck = [{ requirement: "brand", asked: "Arla", offered: "Valio Eila 1 l", result: "substituted", certain: false }];
    order.decision.checks.push({ rule: "substitution.policy", status: "pass", message: "Like-for-like substitutes are allowed." });
    const [fact] = matchedFacts(order);
    expect(fact).toMatchObject({ label: "Brand", result: "substituted", ok: false });
    expect(fact.detail).toBe("Asked Arla · substituted with Valio Eila 1 l. Like-for-like substitutes are allowed");
  });
});
