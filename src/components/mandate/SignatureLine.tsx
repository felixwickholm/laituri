import { CircleCheck, CircleX, LoaderCircle } from "lucide-react";
import type { SignatureState } from "./useMandateSignature";

interface SignatureLineProps {
  state: SignatureState;
  signer: string;
  until: string;
  version?: number;
}

/** "Signed by Nordic Harbour Hotels · version 3 · valid until Sat 13 Feb", with the browser's verdict. */
export function SignatureLine({ state, signer, until, version }: SignatureLineProps) {
  const parts = [`Signed by ${signer}`, version !== undefined ? `version ${version}` : undefined, `valid until ${until}`].filter(Boolean).join(" · ");
  return (
    <p className="signature-line" data-state={state}>
      {state === "valid" ? <CircleCheck aria-hidden="true" /> : state === "invalid" ? <CircleX aria-hidden="true" /> : <LoaderCircle className="spin" aria-hidden="true" />}
      <span>
        {parts}
        <span className="signature-verdict">
          {state === "valid" ? " · signature verified in your browser" : state === "invalid" ? " · the signature does not verify" : " · checking the signature"}
        </span>
      </span>
    </p>
  );
}
