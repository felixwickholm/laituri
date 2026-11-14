import "../store/temp-data-dir";
import { beforeEach, describe, expect, it } from "vitest";
import type { Actor } from "@/lib/contracts";
import { appendAudit, forgetHead } from "@/lib/audit";
import type { Jwks } from "@/lib/console/types";
import { checkChain, forgetHead as forgetBrowserHead } from "@/lib/console/verify";
import { REPLAY_IDLE, replayReducer, replayView, runReplay, type ReplayEvent } from "@/lib/console/verify-replay";
import { store } from "@/lib/store";
import { jwks } from "@/lib/trust";

const agent: Actor = { type: "agent", id: "agent:test", name: "Test agent" };

async function writeLog(n: number) {
  await store().reset();
  forgetHead();
  for (let i = 1; i <= n; i++) await appendAudit({ actor: agent, event: "catalog.searched", summary: `Search ${i}.` });
  return store().audit.list();
}

describe("the replay model", () => {
  it("counts up through the step under way and shows the steps before it as done", () => {
    const events: ReplayEvent[] = [{ type: "start", total: 149 }, { type: "keys", keys: 3 }, { type: "next" }, { type: "progress", done: 87 }];
    const view = replayView(events.reduce(replayReducer, REPLAY_IDLE));
    expect(view.map((step) => step.status)).toEqual(["done", "active", "waiting"]);
    expect(view[0].line).toBe("3 keys from Valio Aimo");
    expect(view[1].line).toBe("Checked 87 of 149 signatures");
    expect(view[1].fraction).toBeCloseTo(87 / 149);
  });

  it("marks the step where the log broke, and every step done when it verifies", () => {
    const base: ReplayEvent[] = [{ type: "start", total: 5 }, { type: "keys", keys: 1 }, { type: "next" }, { type: "next" }];
    const failing: ReplayEvent[] = [...base, { type: "broken", brokenAt: 4, reason: "Entry 4 was changed after it was written." }];
    const broken = replayView(failing.reduce(replayReducer, REPLAY_IDLE));
    expect(broken.map((step) => step.status)).toEqual(["done", "done", "failed"]);
    expect(broken[2].line).toBe("Entry 4 was changed after it was written.");
    const passing: ReplayEvent[] = [...base, { type: "verified" }];
    const verified = replayView(passing.reduce(replayReducer, REPLAY_IDLE));
    expect(verified.map((step) => step.line)).toEqual(["1 key from Valio Aimo", "5 of 5 signatures valid", "5 of 5 links intact"]);
    expect(replayView(REPLAY_IDLE).every((step) => step.status === "waiting")).toBe(true);
  });
});

describe("runReplay", () => {
  beforeEach(() => forgetBrowserHead());

  it("checks every signature and every link of a real log", async () => {
    const keys = (await jwks("supplier")) as unknown as Jwks;
    const entries = await writeLog(4);
    const events: ReplayEvent[] = [];
    const result = await runReplay(entries, (event) => events.push(event), { fetchKeys: async () => keys, confirm: () => checkChain(entries, keys) });
    expect(result).toBe("verified");
    expect(replayView(events.reduce(replayReducer, REPLAY_IDLE)).map((step) => step.line)).toEqual([
      `${keys.keys.length === 1 ? "1 key" : `${keys.keys.length} keys`} from Valio Aimo`,
      "4 of 4 signatures valid",
      "4 of 4 links intact",
    ]);
  });

  it("stops at the changed entry in the link step", async () => {
    const keys = (await jwks("supplier")) as unknown as Jwks;
    const entries = await writeLog(4);
    const changed = entries.map((item) => (item.seq === 3 ? { ...item, summary: "Forged." } : item));
    const events: ReplayEvent[] = [];
    const result = await runReplay(changed, (event) => events.push(event), { fetchKeys: async () => keys, confirm: () => checkChain(changed, keys) });
    expect(result).toBe("broken");
    const state = events.reduce(replayReducer, REPLAY_IDLE);
    expect(state).toMatchObject({ status: "broken", brokenAt: 3, step: 2 });
  });
});
