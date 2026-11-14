"use client";

import { Gauge } from "lucide-react";
import { useConsole } from "@/lib/console/store";
import { upstreamLine } from "@/lib/security-console/trust";

/** How few products the wholesaler's price and stock systems were asked about. Renders only when the server reports it. */
export function UpstreamLine() {
  const line = upstreamLine(useConsole().health);
  if (!line) return null;
  return (
    <p className="upstream-line">
      <Gauge aria-hidden="true" />
      {line}
    </p>
  );
}
