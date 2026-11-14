"use client";

import { count, eur } from "@/lib/console/format/money";
import { useWorkspace } from "@/lib/console/workspace-store";
import { Dash } from "../ui/Dash";
import { landingFigures, shown, type LandingFigures } from "./counts";
import { stagger } from "./stagger";
import { useOverview } from "./useOverview";

const FIGURES: { key: keyof LandingFigures; label: string; format: (value: number) => string }[] = [
  { key: "agents", label: "Agents connected", format: count },
  { key: "requests", label: "Requests", format: count },
  { key: "ordersConfirmed", label: "Orders confirmed", format: count },
  { key: "confirmedNet", label: "Confirmed, net", format: eur },
];

/**
 * The foot of the first screen: four figures from this visitor's own workspace, read from the same overview and the
 * same seven days as the Valio Aimo side, so both screens show the same numbers.
 */
export function LiveCounters() {
  const overview = useOverview();
  const info = useWorkspace();
  const figures = landingFigures(overview ?? undefined);
  const where = info?.kind === "shared" ? "the shared demo workspace" : "your demo workspace";
  // Without a credential the overview answers 401: the band steps aside quietly and the hero keeps the space.
  if (overview === null) return null;

  return (
    <div className="lp-band enter" style={stagger(4)} aria-label="Live figures" role="group">
      <dl className="lp-band-figures" aria-busy={overview === undefined}>
        {FIGURES.map((figure) => {
          const value = figures[figure.key];
          return (
            <div key={figure.key} className="lp-band-figure">
              <dt>{figure.label}</dt>
              <dd className="lp-band-value" data-ready={overview === undefined ? undefined : ""}>
                {overview === undefined ? "\u00a0" : shown(value) ? figure.format(value) : <Dash />}
              </dd>
            </div>
          );
        })}
      </dl>
      <p className="lp-band-note">
        <span className="lp-band-window">Last 7 days in {where}.</span> Prices and stock are live from the challenge&apos;s mock
        API. Orders are simulated.
      </p>
    </div>
  );
}
