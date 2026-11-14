import { CircleCheck, CircleDashed, CircleX, LoaderCircle } from "lucide-react";
import type { Buyer } from "./types";
import { shortHash } from "@/lib/console/format/activity";
import { CopyButton } from "../ui/CopyButton";
import { TechDetails } from "../ui/TechDetails";
import type { SignatureRow } from "./useOrderProof";

function keyName(row: SignatureRow, buyer: Buyer): string {
  if (row.role === "supplier") return "Valio Aimo’s key";
  if (row.role === "buyer") return `${buyer.name}’s key`;
  return `the ${buyer.approver.toLowerCase()}’s key`;
}

function stateLine(row: SignatureRow, buyer: Buyer) {
  switch (row.state) {
    case "valid":
      return (
        <span className="sig-state tone-success">
          <CircleCheck aria-hidden="true" />
          Checked with {keyName(row, buyer)}
        </span>
      );
    case "invalid":
      return (
        <span className="sig-state tone-danger">
          <CircleX aria-hidden="true" />
          Does not check out{row.note ? `: ${row.note}` : ""}
        </span>
      );
    case "missing":
      return (
        <span className="sig-state">
          <CircleDashed aria-hidden="true" />
          {row.label === "Approval" ? "No person had to decide" : "Not issued for this order"}
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

/** Who vouched for each part of the order, checked on this device; the raw signatures behind Technical details. */
export function Signatures({ rows, offerHash, buyer }: { rows: SignatureRow[]; offerHash?: string; buyer: Buyer }) {
  const hash = (value: string, copy: string, label: string) => (
    <span className="hash-well">
      <span className="mono">{value}</span>
      <CopyButton value={copy} label={label} />
    </span>
  );
  return (
    <section className="section">
      <h3>Who signed</h3>
      <ul className="sigs">
        {rows.map((row) => (
          <li key={row.label}>
            <div className="sig-head">
              <span className="sig-label">
                {row.label}
              </span>
              {stateLine(row, buyer)}
            </div>
          </li>
        ))}
      </ul>
      <TechDetails
        rows={[
          ...rows.filter((row) => row.jws).map((row) => ({
            label: `${row.label} signature`,
            value: hash(shortHash((row.jws ?? "").split(".")[2]), row.jws ?? "", `Copy ${row.label.toLowerCase()} signature`),
          })),
          ...(offerHash ? [{ label: "Offer hash", value: hash(`sha256:${shortHash(offerHash)}`, offerHash, "Copy offer hash") }] : []),
          { label: "Public keys", value: "/.well-known/jwks.json", mono: true },
        ]}
      />
    </section>
  );
}
