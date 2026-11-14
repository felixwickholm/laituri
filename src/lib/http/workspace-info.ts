import type { WorkspaceInfo } from "@/lib/contracts";
import { currentMandate } from "@/lib/mandate";
import { inWorkspace, sandboxes, type Workspace } from "@/lib/workspace";
import { DEMO_TOKENS } from "./agent";

/** The workspace's agent keys: the fixed public demo tokens for the shared one, random keys for a sandbox. */
function keysOf(workspace: Workspace): { buyerId: string; key: string }[] {
  if (workspace.kind === "sandbox") return sandboxes().info(workspace)?.agentKeys ?? [];
  return Object.entries(DEMO_TOKENS).map(([key, buyerId]) => ({ buyerId, key }));
}

export function describeWorkspace(workspace: Workspace, origin: string): Promise<WorkspaceInfo> {
  return inWorkspace(workspace, async () => {
    const mcpUrl = `${origin}/mcp`;
    const agentKeys = await Promise.all(
      keysOf(workspace).map(async ({ buyerId, key }) => {
        const { mandate } = await currentMandate(buyerId);
        return {
          buyer: { id: mandate.buyer.id, name: mandate.buyer.name },
          agent: { id: mandate.agent.id, name: mandate.agent.name },
          key,
          mcpUrl: `${mcpUrl}?key=${encodeURIComponent(key)}`,
        };
      }),
    );
    const expiresAt = workspace.kind === "sandbox" ? sandboxes().info(workspace)?.expiresAt : undefined;
    return {
      kind: workspace.kind,
      label: workspace.label,
      createdAt: workspace.createdAt,
      ...(expiresAt ? { expiresAt } : {}),
      agentKeys,
      mcpUrl,
    };
  });
}
