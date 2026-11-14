import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { PRIMARY_BUYER_ID } from "@/lib/mandate";
import { OneLineCommand } from "../connect/OneLineCommand";
import { Reveal } from "./Reveal";
import { stagger } from "./stagger";

/** The one line that connects any MCP client to this server, as the primary demo buyer's agent. */
export function ConnectLine() {
  return (
    <Reveal className="lp-section lp-connect" aria-labelledby="lp-connect-title">
      <h2 id="lp-connect-title" className="lp-h2 rv" style={stagger(0)}>
        Connect your own agent in one line.
      </h2>
      <p className="lp-connect-lede rv" style={stagger(1)}>
        Claude, ChatGPT or any MCP client gets seven tools: search, product, quote, mandate, order, order status and a log check. Nothing else.
      </p>
      <OneLineCommand buyerId={PRIMARY_BUYER_ID} style={stagger(2)} />
      <Link href="/connect" className="lp-text-link rv" style={stagger(3)}>
        Other clients and the REST API <ArrowRight aria-hidden="true" />
      </Link>
    </Reveal>
  );
}
