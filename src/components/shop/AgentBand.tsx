import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { McpAddress } from "../connect/McpAddress";

/** The quiet offer: the same shop, open to the visitor's own agent. */
export function AgentBand({ serverOrigin, buyerId }: { serverOrigin: string; buyerId: string }) {
  return (
    <section className="store-band" data-tour="shop-agent-band" aria-labelledby="store-band-title">
      <h2 id="store-band-title">Or let your agent do it</h2>
      <p>Paste this address into Claude or ChatGPT. Your agent then shops here, inside your limits. You see each step.</p>
      <McpAddress serverOrigin={serverOrigin} buyerId={buyerId} compact />
      <Link href="/connect" className="text-link">
        See how
        <ChevronRight aria-hidden="true" />
      </Link>
    </section>
  );
}
