"use client";

import { ArrowUpRight } from "lucide-react";
import { useSyncExternalStore, useState } from "react";
import { Sheet } from "../ui/Sheet";
import { CopyButton } from "../ui/CopyButton";

type Client = "claude" | "chatgpt" | "curl";

const subscribe = () => () => undefined;

function steps(client: Client, origin: string): { lines: string[]; code: string } {
  const mcp = `${origin}/mcp`;
  switch (client) {
    case "claude":
      return {
        lines: ["Open Settings, then Connectors.", "Choose Add custom connector and paste the MCP server URL.", "Ask Claude to buy something. Its calls appear in pane 1."],
        code: `claude mcp add --transport http laituri ${mcp}`,
      };
    case "chatgpt":
      return {
        lines: ["Open Settings, then Apps and connectors, and turn on developer mode.", "Create a connector with the MCP server URL.", "Ask ChatGPT to order through Laituri. Approvals land in pane 2."],
        code: mcp,
      };
    default:
      return {
        lines: ["Search the catalogue with one POST.", "Ask for a quote, then place the order with the signed offer.", "The full contract is in the OpenAPI document."],
        code: `curl -s ${origin}/api/v1/products/search \\\n  -H 'content-type: application/json' \\\n  -d '{"query":"lactose-free milk 1 l"}'`,
      };
  }
}

const LINKS = [
  { href: "/api/v1/openapi.json", label: "OpenAPI 3.1 document" },
  { href: "/llms.txt", label: "llms.txt" },
  { href: "/.well-known/jwks.json", label: "Public signing keys (JWKS)" },
  { href: "/.well-known/agent-card.json", label: "Agent card" },
];

export function ConnectSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const origin = useSyncExternalStore(subscribe, () => window.location.origin, () => "");
  const [client, setClient] = useState<Client>("claude");
  const guide = steps(client, origin);
  const mcp = `${origin}/mcp`;
  return (
    <Sheet open={open} onClose={onClose} title="Connect an agent" lede="Any agent that speaks MCP or HTTP can buy here, inside the signed mandate.">
      <section className="section">
        <h3>MCP server URL</h3>
        <div className="hash-well endpoint">
          <span className="mono">{mcp}</span>
          <CopyButton value={mcp} label="Copy MCP server URL" />
        </div>
      </section>
      <section className="section">
        <div className="segmented" role="tablist" aria-label="Client">
          {(["claude", "chatgpt", "curl"] as const).map((id) => (
            <button key={id} type="button" role="tab" aria-selected={client === id} onClick={() => setClient(id)}>
              {id === "claude" ? "Claude" : id === "chatgpt" ? "ChatGPT" : "curl"}
            </button>
          ))}
        </div>
        <ol className="connect-steps">
          {guide.lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ol>
        <div className="code-well">
          <pre className="mono">{guide.code}</pre>
          <CopyButton value={guide.code} label="Copy" />
        </div>
      </section>
      <section className="section">
        <h3>For developers</h3>
        <ul className="link-list">
          {LINKS.map((link) => (
            <li key={link.href}>
              <a href={link.href} target="_blank" rel="noreferrer">
                <span>{link.label}</span>
                <span className="mono path">{link.href}</span>
                <ArrowUpRight width={14} height={14} aria-hidden="true" />
              </a>
            </li>
          ))}
        </ul>
        <p className="section-note standards">MCP · OpenAPI 3.1 · JWS and JWKS · AP2-style mandate · Peppol order response codes · GS1 GTIN</p>
      </section>
    </Sheet>
  );
}
