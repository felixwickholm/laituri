import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/LandingPage";
import { evidence } from "@/lib/evidence";
import { jsonLd } from "@/lib/evidence/structured";

const DESCRIPTION =
  "Laituri lets a customer's own AI purchasing agent buy from Valio Aimo over MCP or REST at a wholesaler-signed fixed price, inside limits the customer signed. Larger or unusual orders wait for a person; every step is in a signed, hash-chained record.";

export const metadata: Metadata = {
  title: "About",
  description: DESCRIPTION,
  alternates: { canonical: "/about" },
  openGraph: { title: "About Laituri", description: DESCRIPTION, url: "/about", type: "website", siteName: "Laituri", images: [{ url: "/brand/og-image.png", width: 1200, height: 630, alt: "Laituri" }] },
};

/** What Laituri is, for readers and answer engines. The product itself opens at /. */
export default function About() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd(evidence())).replace(/</g, "\\u003c") }} />
      <LandingPage />
    </>
  );
}
