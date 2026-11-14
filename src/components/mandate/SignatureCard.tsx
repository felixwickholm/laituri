import { CircleCheck, CircleX, LoaderCircle } from "lucide-react";
import type { Mandate } from "@/lib/contracts";
import { day } from "@/lib/console/format/time";
import { TechDetails } from "../ui/TechDetails";
import type { SignatureState } from "./useMandateSignature";

const VERDICT: Record<SignatureState, string> = {
  valid: "Checked on your device",
  invalid: "Changed after it was signed",
  checking: "Checking on your device",
};

/** Who signed these limits, who approves past them, how long they hold. */
export function SignatureCard({ mandate, signature }: { mandate: Mandate; signature: SignatureState }) {
  return (
    <section className="glass signature-card" aria-labelledby="signature-title">
      <header className="signature-head">
        <h2 id="signature-title" className="card-title">
          Who signed
        </h2>
        <span className="signature-version">Version {mandate.version}</span>
      </header>
      <p className="signature-who">{mandate.buyer.name}</p>
      <p className="signature-when">
        {day(mandate.validFrom)} to {day(mandate.validUntil)}
      </p>
      <p className="signature-verdict-line" data-state={signature}>
        {signature === "valid" ? <CircleCheck aria-hidden="true" /> : signature === "invalid" ? <CircleX aria-hidden="true" /> : <LoaderCircle className="spin" aria-hidden="true" />}
        {VERDICT[signature]}
      </p>
      <TechDetails rows={[{ label: "Mandate ID", value: mandate.id, mono: true }]} />
    </section>
  );
}
