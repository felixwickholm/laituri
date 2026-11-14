import type { Metadata } from "next";
import { ConnectWorkbench } from "@/components/connect/ConnectWorkbench";
import { ToolTable } from "@/components/connect/ToolTable";
import { AppShell, type Side } from "@/components/shell/AppShell";
import { now } from "@/lib/clock";
import { nextMonday } from "@/lib/connect/requests";
import { serverOrigin } from "@/lib/connect/origin";
import { FACTS } from "@/lib/evidence";
import { PRIMARY_BUYER_ID } from "@/lib/mandate";
import { pageDate } from "@/lib/security-console/page-date";

export const metadata: Metadata = {
  title: "Connect your agent",
  description: "Connect your own AI purchasing agent to Valio Aimo over MCP or REST in one line: search, signed fixed-price offers and orders inside your limits.",
};

/** Four numbers an integrator checks first, all measured by `npm run evidence`. */
function counts() {
  const openness = FACTS.evals.suites.find((suite) => suite.id === "openness");
  return [
    { number: String(FACTS.mcpTools), word: "MCP tools" },
    { number: String(FACTS.restOperations), word: "REST endpoints" },
    { number: String(FACTS.discoveryDocuments), word: "discovery files" },
    ...(openness ? [{ number: `${openness.passed}/${openness.total}`, word: "openness checks", tone: openness.passed === openness.total ? "success" : "danger" }] : []),
  ];
}

export default async function ConnectPage({ searchParams }: PageProps<"/connect">) {
  const [origin, { side: asked }] = await Promise.all([serverOrigin(), searchParams]);
  const side: Side = asked === "valio" ? "valio" : "buyer";
  const deliverBy = nextMonday(now());
  return (
    <AppShell side={side}>
      <div className="page cx-page">
        <header className="page-head">
          <div>
            <h1>Connect your agent</h1>
            <p className="page-date">{pageDate()}</p>
          </div>
        </header>
        <ConnectWorkbench
          serverOrigin={origin}
          deliverBy={deliverBy}
          primaryBuyerId={PRIMARY_BUYER_ID}
          counts={
            <ul className="count-tiles" aria-label="What an agent gets">
              {counts().map((tile) => (
                <li key={tile.word} className="count-tile" data-tone={tile.tone}>
                  <span className="count-tile-number">{tile.number}</span>
                  <span className="count-tile-word">{tile.word}</span>
                </li>
              ))}
            </ul>
          }
        />
        <ToolTable />
        <p className="cx-foot">Prices and stock come live from Valio Aimo&apos;s test system. Product names and marks belong to their owners.</p>
      </div>
    </AppShell>
  );
}
