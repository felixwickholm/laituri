"use client";

import { mcpUrlWithKey } from "@/lib/connect/guides";
import { keyFor } from "@/lib/connect/keys";
import { useWorkspace } from "@/lib/console/workspace-store";
import { CopyButton } from "../ui/CopyButton";
import { QrCode } from "./QrCode";
import { useOrigin } from "./useOrigin";

interface Props {
  serverOrigin: string;
  buyerId: string;
  /** Smaller QR code for a band; the Connect page shows a larger one. */
  compact?: boolean;
}

/** This visitor's own MCP address, with its key inside, one copy button and a QR code for a phone. */
export function McpAddress({ serverOrigin, buyerId, compact }: Props) {
  const origin = useOrigin(serverOrigin);
  const info = useWorkspace();
  const address = mcpUrlWithKey(origin, keyFor(info, buyerId));
  return (
    <div className="mcp-address" data-compact={compact ? "" : undefined}>
      <div className="mcp-address-line">
        <code className="mono" translate="no">
          {address}
        </code>
        <CopyButton value={address} label="Copy your MCP address" />
      </div>
      <QrCode value={address} label="QR code of your MCP address" size={compact ? 96 : 128} />
    </div>
  );
}
