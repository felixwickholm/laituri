/** The calm moment while the agent reads the event and checks prices and stock. */
export function PlanningState() {
  return (
    <div className="page plan-page">
      <section className="planning" role="status" aria-live="polite">
        <span className="planning-dots" aria-hidden>
          <span />
          <span />
          <span />
        </span>
        <p className="planning-lead">Reading your event.</p>
        <p className="planning-sub">Checking prices and stock.</p>
      </section>
    </div>
  );
}
