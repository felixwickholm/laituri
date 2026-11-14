"use client";

import { useState } from "react";
import { TILES, type TileId } from "@/lib/connect/apps";
import { DEMO_KEY } from "@/lib/connect/requests";
import { mcpUrl } from "@/lib/connect/guides";
import { AppPicker } from "./AppPicker";
import { CodeBlock } from "./CodeBlock";
import { LiveCalls } from "./LiveCalls";
import { SetupGuide } from "./SetupGuide";
import { useOrigin } from "./useOrigin";

/** Pick an app, copy one line, and watch the call arrive next to it. */
export function ConnectWorkbench({ serverOrigin, deliverBy }: { serverOrigin: string; deliverBy: string }) {
  const origin = useOrigin(serverOrigin);
  const [tileId, setTileId] = useState<TileId>("claude");
  const tile = TILES.find((item) => item.id === tileId) ?? TILES[0];

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
            Streamable HTTP. Send <code className="mono">Authorization: Bearer {DEMO_KEY}</code>, or add{" "}
            <code className="mono">?key={DEMO_KEY}</code> to the address.
          </p>
        </div>
        <AppPicker value={tileId} onChange={setTileId} />
        <SetupGuide key={tile.id} tile={tile} origin={origin} deliverBy={deliverBy} />
      </section>
      <LiveCalls />
    </div>
  );
}
