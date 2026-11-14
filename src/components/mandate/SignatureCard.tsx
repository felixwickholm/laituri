import type { Mandate } from "@/lib/contracts";
import { shortName } from "@/lib/console/format/rules";
import { day } from "@/lib/console/format/time";
import { CopyButton } from "../ui/CopyButton";

/** Who signed the mandate, for whom, and for how long, as a key-value record. */
export function SignatureCard({ mandate }: { mandate: Mandate }) {
  return (
    <div className="card">
      <h2 className="card-title">Signed mandate</h2>
      <dl className="kv">
        <dt>Signed by</dt>
        <dd>{mandate.buyer.name}</dd>
        <dt>Agent</dt>
        <dd>{mandate.agent.name}</dd>
        <dt>Approver</dt>
        <dd>{shortName(mandate.approval.approver.name)}</dd>
        <dt>Supplier</dt>
        <dd>{mandate.supplier}</dd>
        <dt>Version</dt>
        <dd className="num">{mandate.version}</dd>
        <dt>Valid</dt>
        <dd>
          {day(mandate.validFrom)} to {day(mandate.validUntil)}
        </dd>
        <dt>Mandate ID</dt>
        <dd className="id-cell">
          <span className="mono">{mandate.id}</span>
          <CopyButton value={mandate.id} label="Copy mandate ID" />
        </dd>
      </dl>
    </div>
  );
}
