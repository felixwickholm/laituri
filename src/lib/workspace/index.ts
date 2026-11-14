import { buyerIds } from "@/lib/mandate";
import { sandboxLimits } from "./limits";
import { createSandboxes, type Sandboxes } from "./sandboxes";
import { sandboxTemplate } from "./template";

export { currentWorkspace, inWorkspace, sharedWorkspace, workspaceState, type Workspace, type WorkspaceKind } from "./context";
export type { AgentKey, SandboxInfo } from "./sandboxes";
export { sandboxTemplate, templateStatus } from "./template";

const holder = globalThis as typeof globalThis & { __laituriSandboxes?: Sandboxes };

/** The process's sandboxes, limited by LAITURI_SANDBOX_MAX and LAITURI_SANDBOX_IDLE_MINUTES. */
export function sandboxes(): Sandboxes {
  return (holder.__laituriSandboxes ??= createSandboxes({ limits: sandboxLimits(), template: sandboxTemplate, buyerIds }));
}
