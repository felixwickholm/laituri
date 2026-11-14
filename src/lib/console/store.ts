"use client";

import { useSyncExternalStore } from "react";
import type { ApprovalDecisionRequest, Order } from "@/lib/contracts";
import type { MandatePatch } from "@/lib/orders/types";
import { ApiError, CREDENTIAL_REQUIRED, api } from "./api";
import { withoutRole } from "./session";
import { workspaceStore } from "./workspace-store";
import type { ChainState, ConsoleSession, ConsoleSnapshot, DemoRun, Scenario, SessionRole, SignInCredentials, SignedMandate } from "./types";
import { checkChain, forgetHead } from "./verify";

const POLL_MS = 1000;
const HEALTH_EVERY = 10;
const MANDATE_EVERY = 5;

const EMPTY: ConsoleSnapshot = {
  ready: false,
  online: true,
  locked: false,
  activity: [],
  orders: [],
  audit: [],
  chain: { state: "empty" },
};

type Listener = () => void;

function isCredentialRequired(reason: unknown): boolean {
  return reason instanceof ApiError && reason.status === 401 && (reason.code === undefined || reason.code === CREDENTIAL_REQUIRED);
}

/** One poller for the whole console. Polls once a second while the tab is visible. */
class ConsoleStore {
  private snapshot: ConsoleSnapshot = EMPTY;
  private listeners = new Set<Listener>();
  private texts = { activity: "", orders: "", audit: "" };
  private timer: ReturnType<typeof setTimeout> | undefined;
  private ticks = 0;
  /** Bumped by every sign-in and sign-out, so a session read that started earlier cannot undo it. */
  private sessionEpoch = 0;
  private busy = false;
  private verifyVersion = 0;

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    if (this.listeners.size === 1) this.start();
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) this.stop();
    };
  };

  getSnapshot = (): ConsoleSnapshot => this.snapshot;
  getServerSnapshot = (): ConsoleSnapshot => EMPTY;

  private set(patch: Partial<ConsoleSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch };
    for (const listener of this.listeners) listener();
  }

  private start(): void {
    document.addEventListener("visibilitychange", this.onVisibility);
    void this.tick();
  }

  private stop(): void {
    document.removeEventListener("visibilitychange", this.onVisibility);
    clearTimeout(this.timer);
  }

  private onVisibility = (): void => {
    clearTimeout(this.timer);
    if (document.visibilityState === "visible") void this.tick();
  };

  private schedule(): void {
    clearTimeout(this.timer);
    if (document.visibilityState === "visible" && this.listeners.size > 0) {
      this.timer = setTimeout(() => void this.tick(), POLL_MS);
    }
  }

  /** One polling round. Each slice fails on its own, so one missing route leaves the others live. */
  async tick(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    const round = this.ticks++;
    const sessionEpoch = this.sessionEpoch;
    try {
      // Every slice in one round, so the mandate and keys do not wait behind the lists on the first load.
      const [activity, orders, audit, jwks, health, mandate, run, session] = await Promise.allSettled([
        api.activityText(),
        api.ordersText(),
        api.auditText(),
        this.snapshot.jwks ? undefined : api.jwks(),
        round % HEALTH_EVERY === 0 ? api.health() : undefined,
        round % MANDATE_EVERY === 0 || !this.snapshot.mandate ? api.mandate() : undefined,
        this.snapshot.run?.status === "running" ? api.run(this.snapshot.run.id) : undefined,
        round % HEALTH_EVERY === 0 ? api.session() : undefined,
      ]);
      const lists = [activity, orders, audit];
      const patch: Partial<ConsoleSnapshot> = {
        ready: true,
        online: lists.some((result) => result.status === "fulfilled"),
        // Without a credential every read answers 401: the shell says so once; the screens stay quiet.
        locked: lists.every((result) => result.status === "rejected" && isCredentialRequired(result.reason)),
      };
      if (activity.status === "fulfilled" && activity.value !== this.texts.activity) {
        this.texts.activity = activity.value;
        patch.activity = api.parseActivity(activity.value).sort((a, b) => a.at.localeCompare(b.at));
      }
      if (orders.status === "fulfilled" && orders.value !== this.texts.orders) {
        this.texts.orders = orders.value;
        patch.orders = api.parseOrders(orders.value);
      }
      let auditChanged = false;
      if (audit.status === "fulfilled" && audit.value !== this.texts.audit) {
        this.texts.audit = audit.value;
        patch.audit = api.parseAudit(audit.value).sort((a, b) => a.seq - b.seq);
        auditChanged = true;
      }
      // A sign-in or sign-out during this round wins over the session read that started before it.
      if (session.status === "fulfilled" && session.value && sessionEpoch === this.sessionEpoch) patch.session = session.value;
      if (jwks.status === "fulfilled" && jwks.value) patch.jwks = jwks.value;
      if (health.status === "fulfilled" && health.value) patch.health = health.value;
      if (mandate.status === "fulfilled" && mandate.value) patch.mandate = mandate.value;
      if (run.status === "fulfilled" && run.value) patch.run = run.value;
      const jwksArrived = Boolean(patch.jwks);
      this.set(patch);
      if (auditChanged || jwksArrived) void this.verify();
    } finally {
      this.busy = false;
      this.schedule();
    }
  }

  private async verify(): Promise<ChainState> {
    const version = ++this.verifyVersion;
    const { audit, jwks } = this.snapshot;
    if (audit.length > 0 && this.snapshot.chain.state === "empty") this.set({ chain: { state: "checking", entries: audit.length } });
    const chain = await checkChain(audit, jwks);
    if (version === this.verifyVersion) this.set({ chain });
    return chain;
  }

  /** Runs the browser check again on the log as it is now, for a person who wants to see it happen. */
  verifyNow(): Promise<ChainState> {
    return this.verify();
  }

  /** Starts a run and returns its id, so a caller can follow exactly the run it started. */
  async startRun(body: { scenario?: Scenario; request?: string }): Promise<string> {
    const { runId } = await api.startRun(body);
    const run: DemoRun = { id: runId, status: "running", request: body.request ?? "", scenario: body.scenario };
    this.set({ run });
    void this.tick();
    return runId;
  }

  /** Sends a signed decision. The caller applies the result once its row has collapsed. */
  decide(order: Order, body: ApprovalDecisionRequest): Promise<Order> {
    return api.decide(order.id, body);
  }

  apply(order: Order): void {
    this.set({ orders: this.snapshot.orders.map((item) => (item.id === order.id ? order : item)) });
    void this.tick();
  }

  async saveMandate(patch: MandatePatch): Promise<SignedMandate> {
    const mandate = await api.updateMandate(patch);
    this.set({ mandate });
    void this.tick();
    return mandate;
  }

  async signIn(credentials: SignInCredentials): Promise<ConsoleSession> {
    const session = await api.signIn(credentials);
    this.sessionEpoch++;
    this.set({ session });
    return session;
  }

  /** Signs out one role, or both when none is named. */
  async signOut(role?: SessionRole): Promise<void> {
    await api.signOut(role);
    this.markSignedOut(role);
  }

  /** The server said the session is gone; show the person as signed out for that role. */
  markSignedOut(role?: SessionRole): void {
    this.sessionEpoch++;
    const { session } = this.snapshot;
    if (session) this.set({ session: withoutRole(session, role) });
  }

  /** Looks at the shared workspace or back at this browser's sandbox, and reloads every slice from there. */
  async setView(view: "shared" | "sandbox"): Promise<void> {
    await workspaceStore.setView(view);
    await this.reload();
    this.set({ session: await api.session() });
  }

  async tamper(): Promise<number> {
    const { seq } = await api.tamper();
    await this.tick();
    return seq;
  }

  /** Puts the changed log entry back and checks the log again. */
  async restoreLog(): Promise<void> {
    await api.restoreLog();
    await this.tick();
  }

  async reset(): Promise<void> {
    await api.reset();
    await this.reload();
  }

  /** Drops every slice and the remembered log head, then reads them all again. */
  private async reload(): Promise<void> {
    forgetHead();
    this.texts = { activity: "", orders: "", audit: "" };
    this.verifyVersion++;
    this.set({ activity: [], orders: [], audit: [], chain: { state: "empty" }, run: undefined, mandate: undefined, jwks: undefined });
    this.ticks = 0;
    await this.tick();
  }
}

export const consoleStore = new ConsoleStore();

export function useConsole(): ConsoleSnapshot {
  return useSyncExternalStore(consoleStore.subscribe, consoleStore.getSnapshot, consoleStore.getServerSnapshot);
}
