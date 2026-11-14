import "../store/temp-data-dir";
import { beforeEach, describe, expect, it } from "vitest";
import type { Actor } from "@/lib/contracts";
import { appendAudit, forgetHead } from "@/lib/audit";
import { checkChain, forgetHead as forgetBrowserHead } from "@/lib/console/verify";
import type { Jwks } from "@/lib/console/types";
import { store } from "@/lib/store";
import { jwks } from "@/lib/trust";

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
