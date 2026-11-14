import { z } from "zod";
import { IsoDateTime } from "./common";

const Party = z.object({ id: z.string(), name: z.string() });

export const WorkspaceKind = z.enum(["sandbox", "shared"]).describe(
  "sandbox: the visitor's own in-memory copy of the demo; shared: the one persisted workspace the documented curl flows use",
);

export const WorkspaceAgentKey = z.object({
  buyer: Party,
  agent: Party.describe("The agent the buyer's mandate names; calls with this key act as it"),
  key: z.string().describe("Bearer token for REST, or ?key= in the MCP address"),
  mcpUrl: z.string().describe("The MCP address with the key in it, for chat apps that take no header"),
});

export const WorkspaceInfo = z.object({
  kind: WorkspaceKind,
  label: z.string().describe("Public name; never the cookie secret"),
  createdAt: IsoDateTime,
  expiresAt: IsoDateTime.optional().describe("When an unused sandbox is dropped; every call moves it on. Absent for the shared workspace"),
  agentKeys: z.array(WorkspaceAgentKey).describe("One per demo buyer. A sandbox's keys are random and work only in that sandbox"),
  mcpUrl: z.string(),
});
export type WorkspaceInfo = z.infer<typeof WorkspaceInfo>;

export const WorkspaceViewRequest = z.object({
  view: z.enum(["shared", "sandbox"]).describe("shared: look at the shared workspace, read-only without the passcode; sandbox: back to your own"),
});
