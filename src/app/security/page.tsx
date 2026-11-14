import type { Metadata } from "next";
import { BreakIt } from "@/components/security/BreakIt";
import { IfWrong } from "@/components/security/IfWrong";
import { RecordSeal } from "@/components/security/RecordSeal";
import { SecurityCounts } from "@/components/security/SecurityCounts";
import { Tested } from "@/components/security/Tested";
import { WhoCanDo } from "@/components/security/WhoCanDo";
import { AppShell, type Side } from "@/components/shell/AppShell";
import { FACTS } from "@/lib/evidence";
import { pageDate } from "@/lib/security-console/page-date";

export const metadata: Metadata = {
  title: "Security",
  description: "Every order is checked against the customer's limits and Valio Aimo's signed price. See unusual actions stopped, and check the sealed record on your own device.",
};

/** Both sides open this page; `?side=valio` keeps the wholesaler's frame, anything else shows the customer's. */
export default async function SecurityPage({ searchParams }: PageProps<"/security">) {
  const { side: asked } = await searchParams;
  const side: Side = asked === "valio" ? "valio" : "buyer";
  const suites = FACTS.evals.suites.filter((suite) => suite.id === "guardrails" || suite.id === "trust");
  return (
    <AppShell side={side}>
      <div className="page sec-page">
        <header className="page-head">
          <div>
            <h1>Security</h1>
            <p className="page-date">{pageDate()}</p>
          </div>
        </header>
        <BreakIt />
        <SecurityCounts suites={suites.map(({ id, passed, total }) => ({ id, passed, total }))} keys={FACTS.signingKeys.length} />
        <RecordSeal />
        <WhoCanDo side={side} />
        <IfWrong side={side} />
        <Tested facts={FACTS} />
      </div>
    </AppShell>
  );
}
