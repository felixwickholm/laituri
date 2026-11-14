import { createHash, randomBytes } from "node:crypto";
import { createVolatileStore } from "@/lib/store/memory";
import { afterAuditWrites } from "@/lib/audit/chain";
import { GatewayError } from "@/lib/gateway/errors";
import { inWorkspace, inheritedSlots, newWorkspace, type Workspace } from "./context";
import type { SandboxLimits } from "./limits";

/** A sandbox's credential for one demo buyer's agent. Random: it neither derives from nor reveals the browser cookie. */
export interface AgentKey {
  buyerId: string;
  key: string;
}

export interface SandboxInfo {
  expiresAt: string;
  agentKeys: AgentKey[];
}

export interface Sandboxes {
  /**
   * The sandbox the browser secret names. Made from the template when there is none, or when it expired; `admit` runs
   * just before a new one is made and may throw to refuse it.
   */
  forSecret(secret: string, admit?: () => void): Promise<Workspace>;
  /** A new sandbox for a client without a browser, such as curl or an agent's own code. Reached only by its agent keys. */
  forClient(): Promise<Workspace>;
  /** The sandbox and buyer an agent key belongs to; undefined for any other token. */
  byAgentKey(key: string): { workspace: Workspace; buyerId: string } | undefined;
  /** Expiry and agent keys of a live sandbox. */
  info(workspace: Workspace): SandboxInfo | undefined;
  /** Puts the template's copy back into one sandbox, leaving every other sandbox alone. */
  restore(workspace: Workspace): Promise<void>;
  /** Sandboxes held in memory, an idle one included until it is next asked for. */
  size(): number;
  /** Sandboxes used within the idle limit. */
  active(): number;
}

export interface SandboxOptions {
  limits: SandboxLimits;
  /** The seeded workspace every sandbox starts as a copy of. */
  template: () => Promise<Workspace>;
  buyerIds: () => string[];
  clock?: () => number;
}

interface Entry {
  secretDigest: string;
  workspace: Workspace;
  agentKeys: AgentKey[];
  lastUsedAt: number;
}

/** Every sandbox is in use: a new one would push out a visitor who is still working, so none is made. */
export class SandboxesFullError extends GatewayError {
  constructor() {
    super("Every demo sandbox is in use right now. Try again in a few minutes.", 503, "sandboxes_full");
  }
}

const randomText = (bytes: number) => randomBytes(bytes).toString("base64url");

/** Only a digest of the browser secret is kept, so a memory dump does not hand out sandboxes. */
const digest = (secret: string) => createHash("sha256").update(secret).digest("hex");

/** Four letters and digits without look-alikes, enough to tell sandboxes apart on screen. */
function publicLabel(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(4);
  return `Sandbox ${[...bytes].map((byte) => alphabet[byte % alphabet.length]).join("")}`;
}

/**
 * In-memory sandboxes, at most `limits.max` at once. Only a sandbox unused for `limits.idleMs` is dropped: when every
 * one is still in use, a new one is refused with 503 instead of evicting a visitor who is working. Get-or-create runs without an await in between, so concurrent
 * first requests with one secret end in one sandbox.
 */
export function createSandboxes(options: SandboxOptions): Sandboxes {
  const clock = options.clock ?? Date.now;
  /** By secret digest, least recently used first. */
  const bySecret = new Map<string, Entry>();
  const byKey = new Map<string, Entry>();

  function drop(entry: Entry): void {
    bySecret.delete(entry.secretDigest);
    for (const { key } of entry.agentKeys) byKey.delete(key);
  }

  function expired(entry: Entry): boolean {
    return clock() - entry.lastUsedAt > options.limits.idleMs;
  }

  function touch(entry: Entry): void {
    entry.lastUsedAt = clock();
    bySecret.delete(entry.secretDigest);
    bySecret.set(entry.secretDigest, entry);
  }

  function makeRoom(): void {
    for (const entry of bySecret.values()) if (expired(entry)) drop(entry);
    if (bySecret.size >= options.limits.max) throw new SandboxesFullError();
  }

  function create(secretDigest: string, template: Workspace): Entry {
    const workspace = newWorkspace(
      { id: `ws_${randomText(12)}`, kind: "sandbox", label: publicLabel(), store: createVolatileStore(template.store.copyState()) },
      inheritedSlots(template),
    );
    const agentKeys = options.buyerIds().map((buyerId) => ({ buyerId, key: `lsk_${randomText(24)}` }));
    const entry: Entry = { secretDigest, workspace, agentKeys, lastUsedAt: clock() };
    bySecret.set(secretDigest, entry);
    for (const agentKey of agentKeys) byKey.set(agentKey.key, entry);
    return entry;
  }

  function entryOf(workspace: Workspace): Entry | undefined {
    return [...bySecret.values()].find((entry) => entry.workspace === workspace);
  }

  return {
    async forSecret(secret, admit) {
      const template = await options.template();
      const secretDigest = digest(secret);
      const entry = bySecret.get(secretDigest);
      if (entry && !expired(entry)) {
        touch(entry);
        return entry.workspace;
      }
      makeRoom();
      admit?.();
      if (entry) drop(entry);
      return create(secretDigest, template).workspace;
    },

    async forClient() {
      const template = await options.template();
      makeRoom();
      return create(digest(randomText(32)), template).workspace;
    },

    byAgentKey(key) {
      const entry = byKey.get(key);
      if (!entry || expired(entry)) return undefined;
      touch(entry);
      const buyerId = entry.agentKeys.find((agentKey) => agentKey.key === key)?.buyerId;
      return buyerId ? { workspace: entry.workspace, buyerId } : undefined;
    },

    info(workspace) {
      const entry = entryOf(workspace);
      if (!entry) return undefined;
      return { expiresAt: new Date(entry.lastUsedAt + options.limits.idleMs).toISOString(), agentKeys: entry.agentKeys };
    },

    async restore(workspace) {
      const template = await options.template();
      await inWorkspace(workspace, () => afterAuditWrites(() => workspace.store.replaceState(template.store.copyState())));
      for (const [name, slot] of inheritedSlots(template)) workspace.slots.set(name, slot);
    },

    size: () => bySecret.size,
    active: () => [...bySecret.values()].filter((entry) => !expired(entry)).length,
  };
}
