import { buyerIds } from "@/lib/mandate";
import { sandboxLimits } from "./limits";
import { CREATION_WINDOW_MS, browserCreationsPerWindow, createCreationLimit, creationsPerWindow, type CreationLimit } from "./creation-limit";
import { createSandboxes, type Sandboxes } from "./sandboxes";
import { sandboxTemplate } from "./template";

export { currentWorkspace, inWorkspace, sharedWorkspace, workspaceAudience, workspaceState, type Workspace, type WorkspaceKind } from "./context";
export { SandboxesFullError, type AgentKey, type SandboxInfo } from "./sandboxes";
export { sandboxTemplate, templateStatus } from "./template";

const holder = globalThis as typeof globalThis & {
  __laituriSandboxes?: Sandboxes;
  __laituriSandboxCreation?: CreationLimit;
  __laituriBrowserSandboxCreation?: CreationLimit;
};

/** The process's sandboxes, limited by LAITURI_SANDBOX_MAX and LAITURI_SANDBOX_IDLE_MINUTES. */
export function sandboxes(): Sandboxes {
  return (holder.__laituriSandboxes ??= createSandboxes({ limits: sandboxLimits(), template: sandboxTemplate, buyerIds }));
}

/** How many sandboxes one client address may make without a browser, per LAITURI_SANDBOX_CREATE_PER_10_MIN. */
export function sandboxCreationLimit(): CreationLimit {
  return (holder.__laituriSandboxCreation ??= createCreationLimit({ max: creationsPerWindow, windowMs: CREATION_WINDOW_MS }));
}

/** How many sandboxes browsers from one client address may start, per LAITURI_SANDBOX_BROWSER_PER_10_MIN. */
export function browserSandboxCreationLimit(): CreationLimit {
  return (holder.__laituriBrowserSandboxCreation ??= createCreationLimit({ max: browserCreationsPerWindow, windowMs: CREATION_WINDOW_MS }));
}
