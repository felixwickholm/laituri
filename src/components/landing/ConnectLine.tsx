"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { CopyButton } from "../ui/CopyButton";
import { Reveal } from "./Reveal";
import { stagger } from "./stagger";

/** The demo agent's key: it names the agent in the mandate, so its orders are judged under that mandate. */
const DEMO_KEY = "demo-agent-token";
const noSubscription = () => () => undefined;

/** The one line that connects any MCP client to this server. */
export function ConnectLine() {
  const origin = useSyncExternalStore(noSubscription, () => window.location.origin, () => "https://laituri.example");
  const command = `claude mcp add --transport http laituri ${origin}/mcp?key=${DEMO_KEY}`;
  return (
    <Reveal className="lp-section lp-connect" aria-labelledby="lp-connect-title">
      <h2 id="lp-connect-title" className="lp-h2 rv" style={stagger(0)}>
        Connect your own agent in one line.
      </h2>
      <p className="lp-connect-lede rv" style={stagger(1)}>
        Claude, ChatGPT or any MCP client gets seven tools: search, product, quote, mandate, order, order status and a log check. Nothing else.
      </p>
      <div className="lp-command rv" style={stagger(2)}>
        <pre>
          <code>{command}</code>
        </pre>
        <CopyButton value={command} label="Copy the connect command" />
      </div>
      <Link href="/connect" className="lp-text-link rv" style={stagger(3)}>
        Other clients and the REST API <ArrowRight aria-hidden="true" />
      </Link>
    </Reveal>
  );
}
