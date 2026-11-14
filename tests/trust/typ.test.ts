import "../store/temp-data-dir";
import { describe, expect, it } from "vitest";
import { CompactSign } from "jose";
import type { Actor } from "@/lib/contracts";
import { appendAudit, forgetHead, verifyAuditLog } from "@/lib/audit";
import { quote } from "@/lib/offers";
import { readOffer } from "@/lib/orders/read-offer";
import { store } from "@/lib/store";
import { jwks, TOKEN_TYPE, trust, verifyWithJwks, type SignerRole } from "@/lib/trust";
import { roleKey } from "@/lib/trust/keys";
import { QUOTE_CONTEXT, makeDeps } from "../support/deps";
import { DELIVER_BY } from "../support/products";

/** Which key signs each kind of token. */
const SIGNER: Record<keyof typeof TOKEN_TYPE, SignerRole> = {
  offer: "supplier",
  mandate: "buyer",
  approval: "approver",
  receipt: "supplier",
  audit: "supplier",
  checkpoint: "supplier",
      priceHold: "supplier",
  session: "approver",
};

const KINDS = Object.keys(TOKEN_TYPE) as (keyof typeof TOKEN_TYPE)[];
const SUBSTITUTIONS = KINDS.flatMap((given) => KINDS.filter((expected) => expected !== given).map((expected) => [given, expected] as const));

describe("token types", () => {
  it.each(KINDS)("accepts a %s token where that type is expected", async (kind) => {
    const jws = await trust().sign(SIGNER[kind], { kind }, TOKEN_TYPE[kind]);
    expect(await trust().verify(SIGNER[kind], jws, TOKEN_TYPE[kind])).toMatchObject({ valid: true, payload: { kind } });
  });

  it.each(SUBSTITUTIONS)("refuses a %s token presented as a %s token", async (given, expected) => {
    const jws = await trust().sign(SIGNER[given], { kind: given }, TOKEN_TYPE[given]);
    // The signing key is the one the expected type uses, so only the typ header can tell them apart.
    const result = await trust().verify(SIGNER[expected], jws, TOKEN_TYPE[expected]);
    expect(result.valid).toBe(false);
  });

  it("names the wrong type as the reason when the key matches", async () => {
    const receipt = await trust().sign("supplier", { orderId: "ord_1" }, TOKEN_TYPE.receipt);
    expect(await trust().verify("supplier", receipt, TOKEN_TYPE.offer)).toMatchObject({ valid: false, reason: expect.stringContaining("wrong token type") });
  });

  it("checks the type with the public key set when one is expected", async () => {
    const entry = await trust().sign("supplier", { seq: 1, hash: "h" }, TOKEN_TYPE.audit);
    const keys = await jwks("supplier");
    expect((await verifyWithJwks(entry, keys, TOKEN_TYPE.audit)).valid).toBe(true);
    expect(await verifyWithJwks(entry, keys, TOKEN_TYPE.checkpoint)).toMatchObject({ valid: false, reason: expect.stringContaining("wrong token type") });
  });

  it("refuses a correctly signed token with no type header", async () => {
    const key = await roleKey("supplier");
    const untyped = await new CompactSign(new TextEncoder().encode(JSON.stringify({ id: "off_1" })))
      .setProtectedHeader({ alg: "ES256", kid: key.kid })
      .sign(key.privateKey);
    expect(await trust().verify("supplier", untyped, TOKEN_TYPE.offer)).toMatchObject({ valid: false, reason: expect.stringContaining("wrong token type") });
  });
});

describe("token types where tokens are used", () => {
  async function anOffer() {
    const { deps } = makeDeps();
    const { primary } = await quote({ lines: [{ productId: "464306", quantity: { amount: 10, unit: "l" } }], deliverBy: DELIVER_BY }, QUOTE_CONTEXT, deps);
    return primary.offer;
  }

  it.each(["receipt", "audit", "checkpoint"] as const)("does not take an offer payload signed as a %s token as an offer", async (kind) => {
    const offer = await anOffer();
    const jws = await trust().sign("supplier", offer, TOKEN_TYPE[kind]);
    expect(await readOffer(jws, { trust: trust() })).toMatchObject({ valid: false, reason: expect.stringContaining("wrong token type") });
    expect((await readOffer(await trust().sign("supplier", offer, TOKEN_TYPE.offer), { trust: trust() })).valid).toBe(true);
  });

  it("breaks the audit chain where an entry carries an offer-typed signature", async () => {
    await store().reset();
    forgetHead();
    const actor: Actor = { type: "agent", id: "agent:typ", name: "Type test agent" };
    for (const summary of ["One.", "Two.", "Three."]) await appendAudit({ actor, event: "catalog.searched", summary });
    const second = (await store().audit.list())[1];
    const signature = await trust().sign("supplier", { seq: second.seq, hash: second.hash }, TOKEN_TYPE.offer);
    await store().audit.replace(second.seq, { ...second, signature });
    expect(await verifyAuditLog()).toMatchObject({ valid: false, brokenAt: 2 });
  });
});
