import { Check, X } from "lucide-react";
import { RuleId } from "@/lib/contracts";

const RULES = RuleId.options.length;

/** A true-to-product crop of the buyer's approval card: the over-limit order from scene two. */
export function ApprovalFragment() {
  return (
    <div className="ui-card ui-approval" data-ui="approval" inert>
      <div className="ui-row">
        <span className="state" data-tone="waiting">
          Needs your OK
        </span>
        <span className="ui-muted">Offer valid 14:32</span>
      </div>
      <p className="ui-amount">
        €1,616.00 <span className="ui-muted">net</span>
      </p>
      <p className="ui-reason">€116.00 over the €1,500.00 per‑order limit.</p>
      <dl className="ui-lines">
        <div>
          <dt>1,600 × Valio Eila lactose-free milk drink 1 l</dt>
          <dd>€1.01</dd>
        </div>
        <div>
          <dt>Delivery</dt>
          <dd>Monday, in full</dd>
        </div>
        <div>
          <dt>Rules passed</dt>
          <dd>
            {RULES - 1} of {RULES}
          </dd>
        </div>
      </dl>
      <p className="ui-muted ui-by">Asked by Harbour purchasing agent · decides Maria Lind</p>
      <div className="ui-buttons">
        <span className="ui-button" data-kind="quiet">
          <X aria-hidden="true" /> Decline
        </span>
        <span className="ui-button" data-kind="primary">
          <Check aria-hidden="true" /> Approve and sign
        </span>
      </div>
    </div>
  );
}
