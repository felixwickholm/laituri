import type { WorkspaceInfo } from "@/lib/contracts";
import { DEMO_KEY } from "./requests";

export type AgentKey = WorkspaceInfo["agentKeys"][number];

/**
 * The key the page puts in every command for `buyerId`: this browser's own key for that buyer once the workspace
 * has answered, the shared public key before that.
 */
export function keyFor(info: WorkspaceInfo | undefined, buyerId: string): string {
  return info?.agentKeys.find((entry) => entry.buyer.id === buyerId)?.key ?? DEMO_KEY;
}

/** The demo buyers whose key can be copied, the given buyer first. */
export function buyersFirst(info: WorkspaceInfo | undefined, buyerId: string): AgentKey[] {
  const keys = info?.agentKeys ?? [];
  return [...keys.filter((entry) => entry.buyer.id === buyerId), ...keys.filter((entry) => entry.buyer.id !== buyerId)];
}

/** One plain line about where calls made with the shown key land. Nothing until the workspace is known. */
export function keyNote(kind: WorkspaceInfo["kind"] | undefined): string | undefined {
  if (kind === "sandbox") return "This key is yours: calls made with it appear in your own demo workspace.";
  if (kind === "shared") return "These are the shared keys: calls made with them reach the shared workspace that every visitor sees.";
  return undefined;
}
