import { ExternalLink, OctagonPause } from "lucide-react";
import { SUPPLIER_CONTACT, suspensionLine, type AgentSuspension } from "@/lib/console/suspension";

/** Across Today when Valio Aimo has suspended this buyer's agent: who did it, when, why, and whom to call. */
export function SuspensionBanner({ suspension, agent }: { suspension: AgentSuspension; agent: string }) {
  return (
    <section className="suspension" role="alert" aria-labelledby="suspension-title">
      <OctagonPause className="suspension-icon" aria-hidden="true" />
      <div className="suspension-text">
        <h2 id="suspension-title">Valio Aimo has suspended your agent</h2>
        <p>{suspensionLine(suspension)}</p>
        <p className="suspension-effect">Valio Aimo refuses every call from {agent} until it is resumed. Nothing is ordered meanwhile.</p>
      </div>
      <a className="btn btn-secondary" href={SUPPLIER_CONTACT} target="_blank" rel="noreferrer">
        Contact Valio Aimo
        <ExternalLink aria-hidden="true" />
      </a>
    </section>
  );
}
