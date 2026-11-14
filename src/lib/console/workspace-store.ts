"use client";

import { useSyncExternalStore } from "react";
import { api } from "./api";
import type { WorkspaceInfo } from "./types";

/** Every call moves a sandbox's expiry on, so a fresh read once a minute keeps "time left" honest. */
const REFRESH_MS = 60_000;

type Listener = () => void;

/**
 * This browser's workspace: its own sandbox, or the shared one while it looks there. Kept apart from the console
 * poller, so pages that do not poll (connect, the landing page) can still show the visitor's own agent keys.
 */
class WorkspaceStore {
  private info: WorkspaceInfo | undefined;
  private listeners = new Set<Listener>();
  private timer: ReturnType<typeof setInterval> | undefined;

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    if (this.listeners.size === 1) {
      void this.refresh();
      this.timer = setInterval(() => void this.refresh(), REFRESH_MS);
    }
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) clearInterval(this.timer);
    };
  };

  getSnapshot = (): WorkspaceInfo | undefined => this.info;
  getServerSnapshot = (): WorkspaceInfo | undefined => undefined;

  private set(info: WorkspaceInfo): void {
    this.info = info;
    for (const listener of this.listeners) listener();
  }

  async refresh(): Promise<void> {
    try {
      this.set(await api.workspace());
    } catch {
      // Keep the last known workspace; the next refresh tries again.
    }
  }

  /** Switches the browser's view and returns the workspace it now looks at. */
  async setView(view: "shared" | "sandbox"): Promise<WorkspaceInfo> {
    const info = await api.setView(view);
    this.set(info);
    return info;
  }
}

export const workspaceStore = new WorkspaceStore();

/** This browser's workspace, undefined until the first answer arrives. */
export function useWorkspace(): WorkspaceInfo | undefined {
  return useSyncExternalStore(workspaceStore.subscribe, workspaceStore.getSnapshot, workspaceStore.getServerSnapshot);
}
