import { CircleCheck, CircleDashed, CircleX, LoaderCircle } from "lucide-react";
import type { Buyer } from "./types";
import { shortHash } from "@/lib/console/format/activity";
import { CopyButton } from "../ui/CopyButton";
import type { SignatureRow } from "./useOrderProof";

function keyName(row: SignatureRow, buyer: Buyer): string {
  if (row.role === "supplier") return "Valio Aimo key";
  if (row.role === "buyer") return `${buyer.name} key`;
  return `approver key (${buyer.approver})`;
}

function stateLine(row: SignatureRow, buyer: Buyer) {
  switch (row.state) {
    case "valid":
      return (
        <span className="sig-state tone-success">
          <CircleCheck aria-hidden="true" />
          Verified against {keyName(row, buyer)}
        </span>
      );
    case "invalid":
      return (
        <span className="sig-state tone-danger">
          <CircleX aria-hidden="true" />
          Signature does not match{row.note ? `: ${row.note}` : ""}
        </span>
      );
    case "missing":
      return (
        <span className="sig-state">
          <CircleDashed aria-hidden="true" />
          {row.label === "Approval" ? "No person signed this order" : "Not issued for this order"}
        </span>
      );
    default:
      return (
        <span className="sig-state">
          <LoaderCircle aria-hidden="true" />
          Checking
        </span>
      );
  }
}

/** Each signature checked in this browser against the published keys. */
export function Signatures({ rows, offerHash, buyer, simulated }: { rows: SignatureRow[]; offerHash?: string; buyer: Buyer; simulated: boolean }) {
  return (
    <section className="section">
      <h3>Signatures</h3>
      <p className="section-note">Checked in your browser with the public keys at /.well-known/jwks.json.</p>
      <ul className="sigs">
        {rows.map((row) => (
          <li key={row.label}>
            <div className="sig-head">
              <span className="sig-label">
                {row.label}
                {row.label === "Receipt" && simulated && row.jws ? <span className="state-word"> · Simulated order</span> : null}
              </span>
              {stateLine(row, buyer)}
            </div>
            {row.jws ? (
              <div className="hash-well">
                <span className="mono">{shortHash(row.jws.split(".")[2])}</span>
                <CopyButton value={row.jws} label={`Copy ${row.label.toLowerCase()} signature`} />
              </div>
            ) : null}
          </li>
        ))}
        {offerHash ? (
          <li>
            <div className="sig-head">
              <span className="sig-label">Offer hash</span>
              <span className="sig-state">SHA-256 of the offer</span>
            </div>
            <div className="hash-well">
              <span className="mono">sha256:{shortHash(offerHash)}</span>
              <CopyButton value={offerHash} label="Copy offer hash" />
            </div>
          </li>
        ) : null}
      </ul>
    </section>
  );
}
