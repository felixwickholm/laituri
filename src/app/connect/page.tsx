import type { Metadata } from "next";
import { headers } from "next/headers";
import { ConnectTopBar } from "@/components/connect/ConnectTopBar";
import { ConnectWorkbench } from "@/components/connect/ConnectWorkbench";
import { TestOrder } from "@/components/connect/TestOrder";
import { ToolTable } from "@/components/connect/ToolTable";
import { SharedViewBanner } from "@/components/session/WorkspaceIndicator";
import { Toaster } from "@/components/ui/toast";
import { now } from "@/lib/clock";
import { nextMonday } from "@/lib/connect/requests";
import { PRIMARY_BUYER_ID } from "@/lib/mandate";

export const metadata: Metadata = {
  title: "Connect your agent · Laituri",
  description: "Connect any MCP or HTTP agent to buy from Valio Aimo inside a signed mandate.",
};

/** The server's best guess at the public origin; the browser replaces it with its own. */
async function serverOrigin(): Promise<string> {
  const list = await headers();
  const host = list.get("x-forwarded-host")?.split(",")[0].trim() || list.get("host") || "localhost:3210";
  const proto = list.get("x-forwarded-proto")?.split(",")[0].trim() || (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export default async function ConnectPage() {
  const origin = await serverOrigin();
  const deliverBy = nextMonday(now());
  return (
    <div className="cx">
      <ConnectTopBar />
      <main className="cx-main">
        <SharedViewBanner />
        <header className="cx-head">
          <h1>Connect your agent</h1>
          <p>Any agent that speaks MCP or HTTP can buy here. Copy one line.</p>
        </header>
        <ConnectWorkbench serverOrigin={origin} deliverBy={deliverBy} primaryBuyerId={PRIMARY_BUYER_ID} />
        <TestOrder deliverBy={deliverBy} primaryBuyerId={PRIMARY_BUYER_ID} />
        <ToolTable />
        <footer className="cx-foot">
          <p>Product names and marks belong to their owners and are shown only to indicate compatibility.</p>
        </footer>
      </main>
      <Toaster />
    </div>
  );
}
