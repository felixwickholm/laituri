import Link from "next/link";
import type { Facts } from "@/lib/evidence/types";
import { tokenTypes } from "@/lib/security-console/trust";
import { TechDetails } from "../ui/TechDetails";
import { UpstreamLine } from "./UpstreamLine";

/** The proof under the counts: how few products upstream was asked about, the evidence page, and the technical detail. */
export function Tested({ facts }: { facts: Facts }) {
  return (
    <section className="sec-block" aria-labelledby="tested-title">
      <h2 id="tested-title" className="section-title">
        Proof
      </h2>
      <div className="glass pad sec-proof">
        <UpstreamLine />
        <p className="sec-more">
          <Link href="/evidence" className="text-link strong">
            Every result
          </Link>
        </p>
        <TechDetails
          rows={[
            { label: "Three keys", value: `${facts.signingKeys.join(", ")}. Each signs only its own kind of object.` },
            { label: "Token types", value: tokenTypes(), mono: true },
            { label: "Fixed-price offers", value: "Signed by Valio Aimo, valid 15 minutes, good for one order only." },
            { label: "Workspace binding", value: "Offers and limits work only in the workspace that signed them." },
            { label: "The record", value: "Each entry is hashed into the next and signed. Your browser checks the whole chain." },
            { label: "Trust protocol", value: "docs/trust-protocol.md", mono: true },
            {
              label: "Public keys",
              value: (
                <a href="/.well-known/jwks.json" target="_blank" rel="noreferrer">
                  /.well-known/jwks.json
                </a>
              ),
              mono: true,
            },
          ]}
        />
      </div>
    </section>
  );
}
