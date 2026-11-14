import { workspaceState } from "@/lib/workspace/context";
import { realDeps } from "./deps";
import { createGateway } from "./gateway";
import type { Gateway } from "./types";

export { createGateway } from "./gateway";
export * from "./errors";
export type { AgentRef, Deps, Gateway, Operator, SearchInput } from "./types";

const workspaceGateway = workspaceState<Gateway>("gateway", () => createGateway(realDeps()));

/** The single front door used by the REST routes, the MCP server and the UI, one per workspace. */
export function gateway(): Gateway {
  return workspaceGateway();
}
