"use client";

import { useEffect } from "react";
import { api } from "@/lib/console/api";
import { consoleStore } from "@/lib/console/store";
import { rolesToSignIn } from "./sandbox-sign-in";

let started: Promise<void> | undefined;

/** Signs both roles in for this sandbox, one after the other so the second answer carries both sessions. */
async function signInSandbox(): Promise<void> {
  const session = await api.session();
  for (const role of rolesToSignIn(session)) await consoleStore.signIn({ demo: true, role });
}

/** Runs the sandbox sign-in once per page load, before the person needs it. Renders nothing. */
export function SandboxSignIn() {
  useEffect(() => {
    started ??= signInSandbox().catch(() => {
      started = undefined;
    });
  }, []);
  return null;
}

/** Signs in again after the view or the sandbox changed (start over, back from the shared workspace). */
export function signInSandboxAgain(): Promise<void> {
  started = signInSandbox().catch(() => {
    started = undefined;
  });
  return started;
}
