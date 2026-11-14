import "../store/temp-data-dir";
import { beforeEach, describe, expect, it } from "vitest";
import type { Actor } from "@/lib/contracts";
import { appendAudit, forgetHead } from "@/lib/audit";
import { checkChain, checkSignature, forgetHead as forgetBrowserHead } from "@/lib/console/verify";
import type { Jwks } from "@/lib/console/types";
import { publicKeySet } from "@/lib/discovery/jwks";
import { store } from "@/lib/store";
import { jwks, TOKEN_TYPE, trust } from "@/lib/trust";

const agent: Actor = { type: "agent", id: "agent:test", name: "Test agent" };

async function writeLog(summaries: string[]) {
  await store().reset();
  forgetHead();
  for (const summary of summaries) await appendAudit({ actor: agent, event: "catalog.searched", summary });
  return store().audit.list();
}

describe("the browser's chain check", () => {
  beforeEach(() => forgetBrowserHead());

  it("reports a longer log that replaced an entry it saw earlier", async () => {
    const keys = (await jwks("supplier")) as unknown as Jwks;
    expect(await checkChain(await writeLog(["Search 1.", "Search 2."]), keys)).toMatchObject({ state: "verified", entries: 2 });
    const fork = await checkChain(await writeLog(["Search 1.", "Forged 2.", "Forged 3."]), keys);
    expect(fork).toMatchObject({ state: "broken", brokenAt: 2 });
  });
});

describe("the browser's signature check", () => {
  it("accepts an object only with its own token type and its owner's key", async () => {
    const keys = (await publicKeySet()) as unknown as Jwks;
    const offer = await trust().sign("supplier", { ok: true }, TOKEN_TYPE.offer);
    expect(await checkSignature(offer, keys, "offer")).toMatchObject({ valid: true, role: "supplier" });
    expect(await checkSignature(offer, keys, "receipt")).toMatchObject({ valid: false, reason: "wrong token type" });
    expect(await checkSignature(offer, keys, "audit")).toMatchObject({ valid: false, reason: "wrong token type" });
    const mandate = await trust().sign("buyer", { ok: true }, TOKEN_TYPE.mandate);
    expect(await checkSignature(mandate, keys, "mandate")).toMatchObject({ valid: true, role: "buyer" });
    const forged = await trust().sign("supplier", { ok: true }, TOKEN_TYPE.mandate);
    expect(await checkSignature(forged, keys, "mandate")).toMatchObject({ valid: false, role: "supplier", reason: "signed with the supplier key" });
  });
});
