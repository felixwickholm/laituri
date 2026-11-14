import { describe, expect, it } from "vitest";
import type { Activity } from "@/lib/store/types";
import { callLine, offerNets } from "@/lib/supplier-console/calls";

function call(tool: string, title: string, detail?: string, extra: Partial<Activity> = {}): Activity {
  return {
    id: `${tool}-${title}`,
    at: "2026-11-14T08:00:00.000Z",
    agent: { id: "agent:a", name: "A" },
    kind: "tool",
    tool,
    title,
    status: "ok",
    ...(detail ? { detail } : {}),
    ...extra,
  };
}

const NONE = new Map<string, number>();

describe("call lines", () => {
  it("says what a search looked for, and when nothing was found", () => {
    expect(callLine(call("search_catalog", "Searched the catalogue for 'vegan feta'", "No products found"), NONE).sentence).toBe("Search · vegan feta · nothing found");
    expect(callLine(call("search_catalog", "Searched the catalogue for 'butter'", "6 products, best match Valio butter"), NONE).sentence).toBe("Search · butter");
  });

  it("says what a quote asked for and how it was answered", () => {
    const full = call("request_quote", "Asked for a quote for 200 l of Valio Hyvä suomalainen Arki® Eila® skimmed milk drink 1 l lactose free", "Full offer, 220.00 EUR net");
    expect(callLine(full, NONE).sentence).toBe("Quote · 200 l Arki Eila skimmed lactose-free milk 1 l · €220.00");
    const partial = call("request_quote", "Asked for a quote for 40 l of Arla Whipping cream 1 L ESL lactose free", "Partial offer, 272.69 EUR net, 3 alternatives");
    expect(callLine(partial, NONE).sentence).toMatch(/^Quote · 40 l .+ · partial, 3 alternatives$/);
    const none = call("request_quote", "Asked for a quote for 15 kg of Valio Edam 17 % e1 kg slices", "Not available, 0.00 EUR net");
    expect(callLine(none, NONE).sentence).toMatch(/· not available$/);
  });

  it("never cuts a long product name with an ellipsis", () => {
    const long = call("request_quote", "Asked for a quote for 10 l of Valio cooking cream alternative 15 % 1 l lactose free with a very long tail", "Full offer, 17.90 EUR net");
    expect(callLine(long, NONE).sentence).not.toContain("…");
  });

  it("states an order's outcome and its net from the quoted offer", () => {
    const quote = call("request_quote", "Asked for a quote for 900 l of milk", "Full offer, 909.00 EUR net", { refs: { offerId: "off_1" } });
    const nets = offerNets([quote]);
    expect(nets.get("off_1")).toBe(909);
    const held = call("place_order", "Placed an order for 900 x milk", "Waiting for approval: 1 product has not been ordered before.", {
      status: "waiting",
      refs: { offerId: "off_1", orderId: "ord_1" },
    });
    expect(callLine(held, nets)).toEqual({ sentence: "Order held for approval · €909.00", tone: "waiting" });
    const blocked = call("place_order", "Placed an order for 5 x ciabatta", "Blocked: may contain sesame.", { status: "blocked" });
    expect(callLine(blocked, NONE)).toEqual({ sentence: "Order blocked by the buyer's rules", tone: "danger" });
    const confirmed = call("place_order", "Placed an order for 10 x carrots", "Confirmed, 111.80 EUR net, receipt signed");
    expect(callLine(confirmed, NONE).sentence).toBe("Order confirmed · €111.80");
  });

  it("falls back to the tool's verb and the tidied title", () => {
    expect(callLine(call("get_product", "Read Valio® butter"), NONE).sentence).toBe("Product · Read Valio butter");
  });
});
