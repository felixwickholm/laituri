"use client";

import { useState } from "react";
import { TILES, type TileId } from "@/lib/connect/apps";
import { mcpUrl } from "@/lib/connect/guides";
import { keyFor } from "@/lib/connect/keys";
import { useWorkspace } from "@/lib/console/workspace-store";
import { AgentKeyPanel } from "./AgentKeyPanel";
import { AppPicker } from "./AppPicker";
import { CodeBlock } from "./CodeBlock";
import { LiveCalls } from "./LiveCalls";
import { SetupGuide } from "./SetupGuide";
import { TestOrder } from "./TestOrder";
import { useOrigin } from "./useOrigin";

interface Props {
  serverOrigin: string;
  deliverBy: string;
  /** The buyer whose key is shown first. */
  primaryBuyerId: string;
}

/** Pick an app and copy one line with this visitor's own key; beside it, watch the call arrive or send a test order. */
export function ConnectWorkbench({ serverOrigin, deliverBy, primaryBuyerId }: Props) {
  const origin = useOrigin(serverOrigin);
  const info = useWorkspace();
  const [buyerId, setBuyerId] = useState(primaryBuyerId);
  const [tileId, setTileId] = useState<TileId>("claude");
  const tile = TILES.find((item) => item.id === tileId) ?? TILES[0];
  const key = keyFor(info, buyerId);

  return (
    <div className="cx-work">
      <section className="cx-setup" aria-labelledby="cx-setup-title">
        <h2 id="cx-setup-title" className="sr-only">
          Set up your agent app
        </h2>
        <div className="cx-endpoint">
          <h3>MCP endpoint</h3>
          <CodeBlock code={{ value: mcpUrl(origin), label: "Copy MCP endpoint" }} />
          <p className="cx-sub">
            Streamable HTTP. Send the agent key below as <code className="mono">Authorization: Bearer</code>, or add{" "}
            <code className="mono">?key=</code> and the key to the address.
          </p>
        </div>
        <AgentKeyPanel info={info} primaryBuyerId={primaryBuyerId} buyerId={buyerId} onBuyer={setBuyerId} />
        <AppPicker value={tileId} onChange={setTileId} />
        <SetupGuide key={tile.id} tile={tile} origin={origin} agentKey={key} deliverBy={deliverBy} />
      </section>
      <aside className="cx-aside" aria-label="Live">
        <LiveCalls />
        <TestOrder deliverBy={deliverBy} primaryBuyerId={primaryBuyerId} />
      </aside>
    </div>
  );
}
