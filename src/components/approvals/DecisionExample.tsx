/** A faint sketch of a decision card, so the empty pane shows what will arrive here. */
export function DecisionExample() {
  return (
    <div className="example" aria-hidden="true">
      <p className="example-label">Example</p>
      <div className="decision ghost">
        <div className="flag">Needs your approval</div>
        <div className="amount-line">
          <span className="amount">€1,616.00</span>
          <span className="net">net</span>
        </div>
        <p className="ghost-reason">€116.00 over the €1,500.00 per-order limit.</p>
        <div className="decide">
          <span className="btn btn-primary big">Approve order</span>
          <span className="btn btn-ghost big">Reject</span>
        </div>
      </div>
    </div>
  );
}
