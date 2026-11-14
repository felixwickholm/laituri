import { describe, expect, it } from "vitest";
import { createVolatileStore } from "@/lib/store/memory";
import { inWorkspace, newWorkspace, workspaceState, type Workspace } from "@/lib/workspace/context";
import { newWorkspaceSecret } from "@/lib/workspace/cookie";
import { createSandboxes } from "@/lib/workspace/sandboxes";

const BUYERS = ["buyer:a", "buyer:b", "buyer:c"];
const IDLE_MS = 60_000;
const inheritedHead = workspaceState<{ size?: number }>("test.head", () => ({}), { inherit: true });
const freshCounter = workspaceState<{ calls: number }>("test.counter", () => ({ calls: 0 }));

async function seededTemplate(): Promise<Workspace> {
  const template = newWorkspace({ id: "template", kind: "sandbox", label: "Template", store: createVolatileStore() });
  await inWorkspace(template, async () => {
    await template.store.mandates.put("buyer:a", "signed-mandate");
    inheritedHead().size = 7;
    freshCounter().calls = 3;
  });
  return template;
}

function setup(max = 3) {
  const clock = { now: 0 };
  const template = seededTemplate();
  const sandboxes = createSandboxes({ limits: { max, idleMs: IDLE_MS }, template: () => template, buyerIds: () => BUYERS, clock: () => clock.now });
  return { sandboxes, clock };
}

describe("sandboxes", () => {
  it("gives one secret one sandbox, even when its first requests arrive together", async () => {
    const { sandboxes } = setup();
    const secret = newWorkspaceSecret();
    const [first, second] = await Promise.all([sandboxes.forSecret(secret), sandboxes.forSecret(secret)]);
    expect(first).toBe(second);
    expect(await sandboxes.forSecret(secret)).toBe(first);
    expect(sandboxes.size()).toBe(1);
  });

  it("starts each sandbox as a deep copy of the template, apart from every other", async () => {
    const { sandboxes } = setup();
    const one = await sandboxes.forSecret(newWorkspaceSecret());
    const two = await sandboxes.forSecret(newWorkspaceSecret());
    expect(one.id).not.toBe(two.id);
    expect(one.label).not.toBe(two.label);
    expect(await one.store.mandates.get("buyer:a")).toBe("signed-mandate");
    await one.store.mandates.put("buyer:a", "changed");
    expect(await two.store.mandates.get("buyer:a")).toBe("signed-mandate");
    await inWorkspace(one, async () => {
      expect(inheritedHead().size).toBe(7);
      expect(freshCounter().calls).toBe(0);
      inheritedHead().size = 9;
    });
    await inWorkspace(two, async () => expect(inheritedHead().size).toBe(7));
  });

  it("gives each sandbox random agent keys, one per buyer, that reveal nothing of the browser secret", async () => {
    const { sandboxes } = setup();
    const secret = newWorkspaceSecret();
    const workspace = await sandboxes.forSecret(secret);
    const keys = sandboxes.info(workspace)!.agentKeys;
    expect(keys.map((key) => key.buyerId)).toEqual(BUYERS);
    for (const { key, buyerId } of keys) {
      expect(key).toMatch(/^lsk_[A-Za-z0-9_-]{32}$/);
      expect(key).not.toContain(secret.slice(0, 8));
      expect(sandboxes.byAgentKey(key)).toEqual({ workspace, buyerId });
    }
    const other = sandboxes.info(await sandboxes.forSecret(newWorkspaceSecret()))!.agentKeys;
    expect(other.map((key) => key.key)).not.toEqual(expect.arrayContaining([keys[0].key]));
    expect(sandboxes.byAgentKey("demo-agent-token")).toBeUndefined();
  });

  it("evicts the least recently used sandbox when full, and forgets its keys", async () => {
    const { sandboxes, clock } = setup(2);
    const [oldest, newer] = [newWorkspaceSecret(), newWorkspaceSecret()];
    const first = await sandboxes.forSecret(oldest);
    const firstKey = sandboxes.info(first)!.agentKeys[0].key;
    clock.now = 10;
    await sandboxes.forSecret(newer);
    clock.now = 20;
    await sandboxes.forSecret(newer);
    clock.now = 30;
    await sandboxes.forSecret(newWorkspaceSecret());
    expect(sandboxes.size()).toBe(2);
    expect(sandboxes.byAgentKey(firstKey)).toBeUndefined();
    const replaced = await sandboxes.forSecret(oldest);
    expect(replaced).not.toBe(first);
  });

  it("replaces a sandbox left unused past the idle limit with a fresh one, silently", async () => {
    const { sandboxes, clock } = setup();
    const secret = newWorkspaceSecret();
    const first = await sandboxes.forSecret(secret);
    const key = sandboxes.info(first)!.agentKeys[0].key;
    expect(sandboxes.info(first)!.expiresAt).toBe(new Date(IDLE_MS).toISOString());
    clock.now = IDLE_MS - 1;
    expect(await sandboxes.forSecret(secret)).toBe(first);
    expect(sandboxes.active()).toBe(1);
    clock.now = 2 * IDLE_MS;
    expect(sandboxes.active()).toBe(0);
    expect(sandboxes.byAgentKey(key)).toBeUndefined();
    const fresh = await sandboxes.forSecret(secret);
    expect(fresh).not.toBe(first);
    expect(await fresh.store.mandates.get("buyer:a")).toBe("signed-mandate");
  });

  it("restores one sandbox to the template and leaves the others alone", async () => {
    const { sandboxes } = setup();
    const one = await sandboxes.forSecret(newWorkspaceSecret());
    const two = await sandboxes.forSecret(newWorkspaceSecret());
    await one.store.mandates.put("buyer:a", "changed");
    await two.store.mandates.put("buyer:a", "changed too");
    await inWorkspace(one, async () => void (inheritedHead().size = 1));
    await sandboxes.restore(one);
    expect(await one.store.mandates.get("buyer:a")).toBe("signed-mandate");
    expect(await two.store.mandates.get("buyer:a")).toBe("changed too");
    await inWorkspace(one, async () => expect(inheritedHead().size).toBe(7));
  });

  it("makes a sandbox for a client without a browser secret, with keys that reach only it, under the same eviction", async () => {
    const { sandboxes } = setup(2);
    const made = await sandboxes.forClient();
    const keys = sandboxes.info(made)?.agentKeys ?? [];
    expect(made.kind).toBe("sandbox");
    expect(keys).toHaveLength(3);
    expect(sandboxes.byAgentKey(keys[0].key)?.workspace).toBe(made);
    expect(await sandboxes.forClient()).not.toBe(made);
    await sandboxes.forClient();
    expect(sandboxes.size()).toBe(2);
    expect(sandboxes.byAgentKey(keys[0].key)).toBeUndefined();
  });
});
