import { realDeps } from "./deps";
import { createGateway } from "./gateway";
import type { Gateway } from "./types";

export { createGateway } from "./gateway";
export * from "./errors";
export type { AgentRef, Deps, Gateway, SearchInput } from "./types";

const holder = globalThis as typeof globalThis & { __laituriGateway?: Gateway };

/** The single front door used by the REST routes, the MCP server and the UI. */
export function gateway(): Gateway {
  return (holder.__laituriGateway ??= createGateway(realDeps()));
}
