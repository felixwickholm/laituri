"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => undefined;

/** This page's own origin; the server's guess is used until the browser takes over. */
export function useOrigin(serverOrigin: string): string {
  return useSyncExternalStore(subscribe, () => window.location.origin, () => serverOrigin);
}
