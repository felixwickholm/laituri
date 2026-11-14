"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { mandateSummary } from "@/lib/console/format/mandate";
import { day } from "@/lib/console/format/time";
import type { Jwks, SignedMandate } from "@/lib/console/types";
import { SignatureLine } from "./SignatureLine";
import { useMandateSignature } from "./useMandateSignature";

/** The mandate in two sentences, its signature, and the way to change it. */
export function MandateCard({ mandate, jwks }: { mandate?: SignedMandate; jwks?: Jwks }) {
  const signature = useMandateSignature(mandate, jwks);
  if (!mandate) {
    return (
      <section className="block" aria-labelledby="mandate-card-title">
        <header className="block-head">
          <h2 id="mandate-card-title">Your mandate</h2>
        </header>
        <p className="empty-frame">Loading the signed mandate…</p>
      </section>
    );
  }
  const m = mandate.mandate;
  const summary = mandateSummary(m);
  return (
    <section className="block" aria-labelledby="mandate-card-title">
      <header className="block-head">
        <h2 id="mandate-card-title">Your mandate</h2>
        <span className="block-meta">Version {m.version}</span>
      </header>
      <div className="card mandate-card">
        <p className="mandate-may">{summary.may}</p>
        <p className="mandate-limits">{summary.limits}</p>
        <SignatureLine state={signature} signer={m.buyer.name} until={day(m.validUntil)} />
        <Link href="/buyer/mandate" className="text-link strong">
          Open the mandate
          <ChevronRight aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
