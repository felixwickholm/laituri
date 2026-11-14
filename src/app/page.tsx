import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/LandingPage";
import { ORB_STATES, type OrbState } from "@/lib/console/orb-params";

const TITLE = "Laituri · The loading dock for AI agents";
const DESCRIPTION =
  "An open front door, over MCP and REST, where a customer's own AI agent buys from Valio Aimo at a signed fixed price, inside limits a person signed, with a log anyone can verify.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: "website",
    siteName: "Laituri",
    locale: "en_GB",
  },
  twitter: { card: "summary", title: TITLE, description: DESCRIPTION },
};

function isOrbState(value: unknown): value is OrbState {
  return typeof value === "string" && (ORB_STATES as readonly string[]).includes(value);
}

/** `/?orb=approval` (any orb state) holds the hero orb in that state, for review and screenshots. */
export default async function Home({ searchParams }: PageProps<"/">) {
  const { orb } = await searchParams;
  return <LandingPage pinnedOrb={isOrbState(orb) ? orb : undefined} />;
}
