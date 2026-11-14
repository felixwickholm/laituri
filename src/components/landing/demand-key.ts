import type { FlowModel } from "@/lib/supplier-console/flow";

/** The three lines under the landing page's miniature flow, in requests over the same seven days. */
export interface DemandKey {
  served: number;
  unserved: number;
  /** Estimated net of the unserved requests that had a price. */
  unservedNet: number;
  ordered: number;
}

export function demandKey(model: FlowModel): DemandKey {
  const unservedNodes = model.nodes.filter((node) => node.tone === "unserved");
  return {
    served: model.served,
    unserved: Math.max(0, model.requests - model.served),
    unservedNet: unservedNodes.reduce((cents, node) => cents + Math.round((node.net ?? 0) * 100), 0) / 100,
    ordered: model.ordered,
  };
}
