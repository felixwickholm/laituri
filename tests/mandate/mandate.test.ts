import "../store/temp-data-dir";
import { beforeEach, describe, expect, it } from "vitest";
import {
  BUYER_IDS,
  PRIMARY_BUYER_ID,
  currentMandate,
  defaultMandate,
  issueMandate,
  MANDATE_VCT,
  readMandate,
  toClaims,
  updateMandate,
} from "@/lib/mandate";
import { store } from "@/lib/store";
import { trust } from "@/lib/trust";

describe("mandate", () => {
  beforeEach(() => store().reset());

  it("round-trips through a buyer signature", async () => {
    const mandate = defaultMandate();
    const reading = await readMandate(await issueMandate(mandate));
    expect(reading.valid).toBe(true);
    expect(reading.mandate).toEqual(mandate);
  });

  it("uses AP2 open checkout claims", async () => {
    const jws = await issueMandate(defaultMandate());
    const claims = JSON.parse(Buffer.from(jws.split(".")[1], "base64url").toString());
    expect(claims.vct).toBe(MANDATE_VCT);
    expect(claims.iss).toBe("fi:ovt:003712345678");
    expect(claims.sub).toBe("agent:harbour-purchasing");
    expect(claims.jti).toBe(defaultMandate().id);
    expect(claims.constraints.map((c: { type: string }) => c.type)).toContain("fi.valio.spend_limit");
    expect(claims.constraints.every((c: { type: string }) => c.type.startsWith("fi.valio."))).toBe(true);
  });

  it("rejects a tampered mandate", async () => {
    const [header, payload, signature] = (await issueMandate(defaultMandate())).split(".");
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString());
    claims.mandate.limits.perOrder.amount = 999999;
    const forged = `${header}.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.${signature}`;
    const reading = await readMandate(forged);
    expect(reading.valid).toBe(false);
    expect(reading.reason).toContain("signature does not match");
  });

  it("rejects a mandate signed by the wrong role", async () => {
    const jws = await trust().sign("supplier", toClaims(defaultMandate()));
    expect((await readMandate(jws)).valid).toBe(false);
  });

  it("issues the default once and then reuses it", async () => {
    const first = await currentMandate();
    const second = await currentMandate();
    expect(first.jws).toBe(second.jws);
    expect(await store().mandates.get(PRIMARY_BUYER_ID)).toBe(first.jws);
  });

  it("updates, bumps the version and re-signs", async () => {
    const before = await currentMandate();
    const after = await updateMandate({ limits: { perOrder: { amount: 2000, currency: "EUR" } } });
    expect(after.mandate.version).toBe(before.mandate.version + 1);
    expect(after.mandate.limits.perOrder.amount).toBe(2000);
    expect(after.mandate.limits.perWeek.amount).toBe(5000);
    expect((await readMandate(after.jws)).mandate).toEqual(after.mandate);
    expect((await currentMandate()).jws).toBe(after.jws);
  });

  it("keeps one signed mandate per buyer, each with its own terms", async () => {
    const [harbour, kaisla, laine] = await Promise.all(Object.values(BUYER_IDS).map((id) => currentMandate(id)));
    expect(harbour.mandate.buyer.id).toBe(PRIMARY_BUYER_ID);
    expect(kaisla.mandate).toMatchObject({
      limits: { perOrder: { amount: 800 }, perWeek: { amount: 3000 } },
      dietary: { excludeAllergens: ["peanut", "nuts", "sesame"], blockMayContain: true },
      substitution: { policy: "like_for_like", maxPriceIncreasePct: 5 },
      approval: { approver: { name: "Antti Korhonen, Food Service Manager" } },
    });
    expect(laine.mandate).toMatchObject({
      limits: { perOrder: { amount: 400 }, perWeek: { amount: 1200 } },
      substitution: { policy: "none" },
      approval: { approver: { name: "Sofia Laine, Owner" }, firstTimeProducts: true },
    });
    expect(await store().mandates.get(BUYER_IDS.kaisla)).toBe(kaisla.jws);
    expect((await readMandate(laine.jws)).mandate).toEqual(laine.mandate);
  });

  it("changes one buyer's mandate without touching another's", async () => {
    const before = await currentMandate(BUYER_IDS.nordicHarbour);
    const after = await updateMandate({ limits: { perWeek: { amount: 2500, currency: "EUR" } } }, BUYER_IDS.kaisla);
    expect(after.mandate).toMatchObject({ buyer: { id: BUYER_IDS.kaisla }, version: 2, limits: { perWeek: { amount: 2500 } } });
    expect((await currentMandate(BUYER_IDS.nordicHarbour)).jws).toBe(before.jws);
  });

  it("refuses an unknown buyer", async () => {
    await expect(currentMandate("fi:ovt:unknown")).rejects.toMatchObject({ status: 404 });
  });
});
