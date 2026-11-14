/** A missing or zero value: a dash, and a short reason in small type. Never a large "€0.00" or "No price". */
export function Dash({ reason }: { reason?: string }) {
  return (
    <span className="dash">
      <span className="dash-mark" aria-hidden="true">
        –
      </span>
      {reason ? <span className="dash-reason">{reason}</span> : <span className="sr-only">none</span>}
    </span>
  );
}
