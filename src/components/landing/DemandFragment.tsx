"use client";

import { useMemo } from "react";
import { count, eur } from "@/lib/console/format/money";
import type { SupplierOverview } from "@/lib/contracts";
import { DemandFlow, weekFlow } from "../valio/DemandFlow";
import { AgentsFragment } from "./AgentsFragment";
import { demandKey } from "./demand-key";
import { FragmentBoundary } from "./FragmentBoundary";
import { useOverview } from "./useOverview";

/**
 * A crop of Valio Aimo's overview: "Where demand went" in miniature, from this visitor's own workspace over the same
 * seven days as the figures on the first screen, with a three-line key. Without the overview it shows the agents crop.
 */
export function DemandFragment() {
  return (
    <FragmentBoundary fallback={<AgentsFragment />}>
      <LiveDemand />
    </FragmentBoundary>
  );
}

function LiveDemand() {
  const overview = useOverview();
  if (overview === null) return <AgentsFragment />;
  return (
    <div className="ui-card ui-demand" data-ui="demand" inert>
      <div className="ui-row">
        <span className="ui-title">Where demand went</span>
        <span className="ui-muted">Last 7 days</span>
      </div>
      {overview ? <Drawn overview={overview} /> : <div className="ui-flow-space" aria-hidden="true" />}
    </div>
  );
}

function Drawn({ overview }: { overview: SupplierOverview }) {
  const key = useMemo(() => demandKey(weekFlow(overview)), [overview]);
  return (
    <>
      <div className="ui-flow">
        <DemandFlow overview={overview} variant="mini" />
      </div>
      <ul className="ui-key">
        <li data-tone="served">
          <span className="ui-key-figure">{count(key.served)}</span> served with a signed offer
        </li>
        <li data-tone="unserved">
          <span className="ui-key-figure">{count(key.unserved)}</span> could not be served
          {key.unservedNet > 0 ? <span className="ui-muted"> · {eur(key.unservedNet)} est.</span> : null}
        </li>
        <li data-tone="served">
          <span className="ui-key-figure">{count(key.ordered)}</span> led to an order
        </li>
      </ul>
    </>
  );
}
