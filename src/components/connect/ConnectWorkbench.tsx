"use client";

import { useState, type ReactNode } from "react";
import { TILES, type TileId } from "@/lib/connect/apps";
import { mcpUrl } from "@/lib/connect/guides";
import { keyFor } from "@/lib/connect/keys";
import { useWorkspace } from "@/lib/console/workspace-store";
import { TechDetails } from "../ui/TechDetails";
import { AgentKeyPanel } from "./AgentKeyPanel";
import { AppPicker } from "./AppPicker";
import { LiveCalls } from "./LiveCalls";
import { McpAddress } from "./McpAddress";
import { SetupGuide } from "./SetupGuide";
import { TestOrder } from "./TestOrder";
import { useOrigin } from "./useOrigin";

interface Props {
  serverOrigin: string;
  deliverBy: string;
  /** The buyer whose key is shown first. */
  primaryBuyerId: string;
  /** The count tiles, placed between the verdict and the detail. */
  counts?: ReactNode;
}

/** The verdict (copy one line, watch the call arrive), then the steps for the chosen app and a test order from this browser. */
export function ConnectWorkbench({ serverOrigin, deliverBy, primaryBuyerId, counts }: Props) {
  const origin = useOrigin(serverOrigin);
  const info = useWorkspace();
  const [buyerId, setBuyerId] = useState(primaryBuyerId);
  const [tileId, setTileId] = useState<TileId>("claude");
  const tile = TILES.find((item) => item.id === tileId) ?? TILES[0];
  const key = keyFor(info, buyerId);

  return (
    <>
      <section className="glass pad cx-verdict" aria-labelledby="cx-verdict-title">
        <div className="verdict">
          <p className="verdict-label">Your MCP address</p>
          <h2 id="cx-verdict-title" className="verdict-title">
            Paste one line into your agent.
          </h2>
          <McpAddress serverOrigin={serverOrigin} buyerId={buyerId} />
        </div>
        <LiveCalls />
      </section>
      {counts}
      <div className="cx-work">
        <section className="glass pad cx-setup" aria-labelledby="cx-setup-title">
          <h2 id="cx-setup-title" className="section-title">
            Set up
          </h2>
          <AgentKeyPanel info={info} primaryBuyerId={primaryBuyerId} buyerId={buyerId} onBuyer={setBuyerId} />
          <AppPicker value={tileId} onChange={setTileId} />
          <SetupGuide key={tile.id} tile={tile} origin={origin} agentKey={key} deliverBy={deliverBy} />
          <TechDetails
            label="Send the key as a header"
            rows={[
              { label: "Address", value: mcpUrl(origin), mono: true },
              { label: "Header", value: "Authorization: Bearer <agent key>", mono: true },
            ]}
          />
        </section>
        <TestOrder deliverBy={deliverBy} primaryBuyerId={primaryBuyerId} />
      </div>
    </>
  );
}
