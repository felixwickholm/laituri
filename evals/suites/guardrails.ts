import type { Mandate, Offer } from "@/lib/contracts";
import { now } from "@/lib/clock";
import { cutPrice, raiseLimit } from "@/lib/demo/forge";
import { issueMandate, type MandateClaims } from "@/lib/mandate";
import type { Suite } from "../harness";
import { APPROVAL_GUARDRAILS } from "../support/guardrails-approval";
import { INPUT_GUARDRAILS } from "../support/guardrails-input";
import { SPEND_GUARDRAILS } from "../support/guardrails-spend";
import { mandate, placeOrder, quoteLitres } from "../support/flow";
import { expectRefused, guardrail, outcomeText } from "../support/hostile";
import { payloadOf, signWithFreshKey, withPayload } from "../support/jws";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Places a 1,000 l milk offer after `forge` changed the offer or mandate JWS. */
async function forgedOrder(forge: { offer?: (jws: string) => Promise<string> | string; mandate?: (jws: string, m: Mandate) => Promise<string> | string }, litres = 1000) {
  const quote = await quoteLitres(litres);
  const current = await mandate();
  const offerJws = forge.offer ? await forge.offer(quote.primary.jws) : quote.primary.jws;
  const mandateJws = forge.mandate ? await forge.mandate(current.jws, current.mandate) : current.jws;
  return { offerJws, mandateJws };
}

const OFFER_GUARDRAILS = [
  guardrail("G1", "Price edited in the offer", "blocked by offer.signature", async (hostile, checks) => {
    const order = await forgedOrder({ offer: (jws) => withPayload<Offer>(jws, cutPrice) });
    const reply = await hostile.try("price edit", () => placeOrder(order.offerJws, order.mandateJws, "eval-g1-price"));
    expectRefused(reply, "offer.signature", checks, "price edit");
    return outcomeText(reply);
  }, true),
  guardrail("G2", "Quantity edited in the offer", "blocked by offer.signature", async (hostile, checks) => {
    const tenfold = (offer: Offer): Offer => ({ ...offer, lines: offer.lines.map((line) => ({ ...line, quantity: line.quantity * 10 })) });
    const order = await forgedOrder({ offer: (jws) => withPayload<Offer>(jws, tenfold) });
    const reply = await hostile.try("quantity edit", () => placeOrder(order.offerJws, order.mandateJws, "eval-g2-quantity"));
    expectRefused(reply, "offer.signature", checks, "quantity edit");
    return outcomeText(reply);
  }),
  guardrail("G3", "Expired offer", "blocked by offer.expiry", async (hostile, checks) => {
    const order = await forgedOrder({});
    const expiresAt = payloadOf<Offer>(order.offerJws).expiresAt;
    const pinned = process.env.LAITURI_NOW;
    process.env.LAITURI_NOW = new Date(Date.parse(expiresAt) + 60_000).toISOString();
    try {
      const reply = await hostile.try("expired offer", () => placeOrder(order.offerJws, order.mandateJws, "eval-g3-expired"));
      expectRefused(reply, "offer.expiry", checks, "expired offer");
      return outcomeText(reply);
    } finally {
      if (pinned === undefined) delete process.env.LAITURI_NOW;
      else process.env.LAITURI_NOW = pinned;
    }
  }),
  guardrail("G4", "Offer signed by the wrong key", "blocked by offer.signature", async (hostile, checks) => {
    const order = await forgedOrder({ offer: (jws) => signWithFreshKey(payloadOf(jws), "offer+jwt", jws) });
    const reply = await hostile.try("wrong key, supplier kid", () => placeOrder(order.offerJws, order.mandateJws, "eval-g4-wrongkey"));
    expectRefused(reply, "offer.signature", checks, "wrong key");
    return outcomeText(reply);
  }),
];

const MANDATE_GUARDRAILS = [
  guardrail("G5", "Raised limit, old mandate signature", "3,000 l order blocked by mandate.signature", async (hostile, checks) => {
    const order = await forgedOrder({ mandate: (jws) => withPayload<MandateClaims>(jws, (claims) => raiseLimit(claims, 1_000_000)) }, 3000);
    const reply = await hostile.try("raised limit", () => placeOrder(order.offerJws, order.mandateJws, "eval-g5-raised"));
    expectRefused(reply, "mandate.signature", checks, "raised limit");
    return outcomeText(reply);
  }, true),
  guardrail("G6", "Mandate signed by the agent's own key", "blocked by mandate.signature, own kid and spoofed buyer kid", async (hostile, checks) => {
    const raised = (jws: string) => raiseLimit(payloadOf<MandateClaims>(jws), 1_000_000);
    const own = await forgedOrder({ mandate: (jws) => signWithFreshKey(raised(jws), "mandate+jwt") }, 3000);
    const spoof = await forgedOrder({ mandate: (jws) => signWithFreshKey(raised(jws), "mandate+jwt", jws) }, 3000);
    const first = await hostile.try("own key", () => placeOrder(own.offerJws, own.mandateJws, "eval-g6-ownkey"));
    const second = await hostile.try("own key, buyer kid", () => placeOrder(spoof.offerJws, spoof.mandateJws, "eval-g6-spoofkid"));
    expectRefused(first, "mandate.signature", checks, "own key");
    expectRefused(second, "mandate.signature", checks, "spoofed kid");
    return `${outcomeText(first)} / ${outcomeText(second)}`;
  }),
  guardrail("G7", "Expired mandate", "blocked by mandate.validity", async (hostile, checks) => {
    const at = now().getTime();
    const order = await forgedOrder({
      mandate: (_, m) => issueMandate({ ...m, validFrom: new Date(at - 30 * DAY_MS).toISOString(), validUntil: new Date(at - DAY_MS).toISOString() }),
    });
    const reply = await hostile.try("expired mandate", () => placeOrder(order.offerJws, order.mandateJws, "eval-g7-expired"));
    expectRefused(reply, "mandate.validity", checks, "expired mandate");
    return outcomeText(reply);
  }),
  guardrail("G8", "Mandate for another agent", "blocked by mandate.validity", async (hostile, checks) => {
    const order = await forgedOrder({
      mandate: (_, m) => issueMandate({ ...m, agent: { id: "agent:someone-else", name: "Another agent" } }),
    });
    const reply = await hostile.try("other agent's mandate", () => placeOrder(order.offerJws, order.mandateJws, "eval-g8-other"));
    expectRefused(reply, "mandate.validity", checks, "other agent's mandate");
    return outcomeText(reply);
  }),
];

export const guardrailsSuite: Suite = {
  id: "guardrails",
  name: "Guardrails",
  bar: 1,
  cases: [...OFFER_GUARDRAILS, ...MANDATE_GUARDRAILS, ...SPEND_GUARDRAILS, ...APPROVAL_GUARDRAILS, ...INPUT_GUARDRAILS],
};
