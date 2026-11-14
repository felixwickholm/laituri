import type { OrbState } from "@/lib/console/orb-params";
import { Tour } from "../tour/Tour";
import { Toaster } from "../ui/toast";
import { ConnectLine } from "./ConnectLine";
import { Criteria } from "./Criteria";
import { FiveWays } from "./FiveWays";
import { Hero } from "./Hero";
import { LandingBar } from "./LandingBar";
import { LandingFooter } from "./LandingFooter";
import { LiveCounters } from "./LiveCounters";
import { TwoSides } from "./TwoSides";

/** The public front page: what Laituri is, proof it runs, both sides, how it fails safely, how to connect. */
export function LandingPage({ pinnedOrb }: { pinnedOrb?: OrbState }) {
  return (
    <div className="lp">
      <LandingBar />
      <main>
        <Hero pinned={pinnedOrb} />
        <LiveCounters />
        <TwoSides />
        <FiveWays />
        <Criteria />
        <ConnectLine />
      </main>
      <LandingFooter />
      <Toaster />
      <Tour />
    </div>
  );
}
