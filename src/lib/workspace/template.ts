import { errorMessage } from "@/lib/gateway/errors";
import { now } from "@/lib/clock";
import { seedEnabled, seedHistory, type SeedStatus } from "@/lib/seed";
import { createVolatileStore } from "@/lib/store/memory";
import { inWorkspace, newWorkspace, type Workspace } from "./context";

interface Template {
  workspace: Workspace;
  /** What the history every sandbox copies holds. */
  status: SeedStatus;
}

const holder = globalThis as typeof globalThis & { __laituriSandboxTemplate?: Promise<Template> };

function emptyTemplate(): Workspace {
  return newWorkspace({ id: "template", kind: "sandbox", label: "Sandbox template", store: createVolatileStore() });
}

/** The demo history is written once, through the real gateway; a sandbox then starts as a copy in milliseconds. */
async function build(): Promise<Template> {
  if (!seedEnabled()) return { workspace: emptyTemplate(), status: { state: "off" } };
  const workspace = emptyTemplate();
  try {
    const at = now().toISOString();
    const written = await inWorkspace(workspace, () => seedHistory());
    return { workspace, status: { state: "seeded", at, ...written } };
  } catch (error) {
    return { workspace: emptyTemplate(), status: { state: "failed", reason: errorMessage(error) } };
  }
}

function template(): Promise<Template> {
  return (holder.__laituriSandboxTemplate ??= build());
}

/** The seeded workspace every sandbox is copied from, built on first use (the server builds it at boot). */
export async function sandboxTemplate(): Promise<Workspace> {
  return (await template()).workspace;
}

export async function templateStatus(): Promise<SeedStatus> {
  return (await template()).status;
}
