import { CircleCheck, CircleX, LoaderCircle } from "lucide-react";
import type { Mandate } from "@/lib/contracts";
import { shortName } from "@/lib/console/format/rules";
import { day } from "@/lib/console/format/time";
import { TechDetails } from "../ui/TechDetails";
import type { SignatureState } from "./useMandateSignature";

const VERDICT: Record<SignatureState, string> = {
  valid: "Signature verified in your browser",
  invalid: "The signature does not verify",
  checking: "Checking the signature",
};

/** The signed mandate as a short summary: who signed it for which agent, who approves, how long it holds. */
export function SignatureCard({ mandate, signature }: { mandate: Mandate; signature: SignatureState }) {
  return (
    <section className="card signature-card" aria-labelledby="signature-title">
      <header className="signature-head">
        <h2 id="signature-title" className="card-title">
          Signed mandate
        </h2>
        <span className="signature-version">Version {mandate.version}</span>
      </header>
      <p className="signature-who">
        {mandate.buyer.name} signed it for {mandate.agent.name}. {shortName(mandate.approval.approver.name)} approves anything past a limit.
      </p>
      <p className="signature-when">
        Valid {day(mandate.validFrom)} to {day(mandate.validUntil)}. {mandate.supplier} checks it on every order.
      </p>
      <p className="signature-verdict-line" data-state={signature}>
        {signature === "valid" ? <CircleCheck aria-hidden="true" /> : signature === "invalid" ? <CircleX aria-hidden="true" /> : <LoaderCircle className="spin" aria-hidden="true" />}
        {VERDICT[signature]}
      </p>
      <TechDetails rows={[{ label: "Mandate ID", value: mandate.id, mono: true }]} />
    </section>
  );
}
