"use client";

import { Play } from "lucide-react";
import { useEffect, useState } from "react";
import { withEuroSign } from "@/lib/console/format/money";
import { roundingNote } from "@/lib/console/format/packs";
import { tidyProductText } from "@/lib/console/format/product";
import { useConsole } from "@/lib/console/store";
import { supplierApi } from "@/lib/supplier-console/api";
import { KITCHENS, kitchenOutcomes, latestStep, runSentence } from "@/lib/supplier-console/format";
import { activityPoller, overviewPoller, useAllActivity } from "@/lib/supplier-console/hooks";
import type { ScenarioRun } from "@/lib/supplier-console/types";
import { useUi } from "../shell/ui-context";
import { StateWord } from "../ui/StateWord";
import { TechDetails } from "../ui/TechDetails";

const POLL_MS = 800;

type RunState = { kind: "idle" } | { kind: "running"; runId: string; run?: ScenarioRun } | { kind: "done"; run: ScenarioRun } | { kind: "error"; message: string };

/**
 * One sentence, sent by two buyers' agents. Valio Aimo signs the same kind of offer for both;
 * each buyer's own mandate decides what happens next, and the wholesaler sees both outcomes.
 */
export function TwoKitchens() {
  const ui = useUi();
  const { data: activity } = useAllActivity();
  const { orders } = useConsole();
  const [state, setState] = useState<RunState>({ kind: "idle" });
  const runId = state.kind === "running" ? state.runId : undefined;

  useEffect(() => {
    if (!runId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const run = await supplierApi.run(runId);
        if (cancelled) return;
        if (run.status === "running") {
          setState({ kind: "running", runId, run });
          timer = setTimeout(poll, POLL_MS);
        } else {
          setState({ kind: "done", run });
          void overviewPoller.refresh();
          void activityPoller.refresh();
        }
      } catch (error) {
        if (!cancelled) setState({ kind: "error", message: error instanceof Error ? error.message : "The run could not be read." });
      }
    };
    timer = setTimeout(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [runId]);

  async function start() {
    setState({ kind: "running", runId: "" });
    try {
      const { runId: id } = await supplierApi.startTwoKitchens();
      setState({ kind: "running", runId: id });
    } catch (error) {
      setState({ kind: "error", message: error instanceof Error ? error.message : "The run did not start." });
    }
  }

  const run = state.kind === "done" ? state.run : state.kind === "running" ? state.run : undefined;
  const outcomes = kitchenOutcomes(run?.results, (orderId) => activity?.find((item) => item.refs?.orderId === orderId)?.buyer?.name);
  const sentence = runSentence(activity ?? [], run?.startedAt);
  const busy = state.kind === "running";
  const pending = busy && outcomes.length === 0;

  return (
    <section className="block" aria-labelledby="kitchens-title">
      <header className="block-head">
        <h2 id="kitchens-title">Same sentence, two kitchens</h2>
        <button type="button" className="btn btn-secondary kitchens-run" onClick={() => void start()} disabled={busy}>
          <Play aria-hidden="true" />
          {busy ? "Running…" : state.kind === "done" ? "Run again" : "Run: same sentence, two kitchens"}
        </button>
      </header>
      <div className="card kitchens">
        <p className="kitchens-lede">
          The hotel&rsquo;s agent and the school&rsquo;s agent send Valio Aimo the same words. Each order is checked against its own buyer&rsquo;s signed mandate, and
          Valio Aimo sees how each one ends.
        </p>
        {sentence ? <p className="kitchens-sentence">&ldquo;{sentence}&rdquo;</p> : null}
        {pending ? (
          <div className="kitchens-pair" aria-live="polite">
            {KITCHENS.map((buyer) => (
              <article key={buyer} className="kitchen" data-tone="pending">
                <header>
                  <h3>{buyer}</h3>
                  <StateWord word="Working" tone="neutral" />
                </header>
                <p className="dim">{withEuroSign(tidyProductText(latestStep(activity ?? [], buyer, run?.startedAt) ?? "Waiting for its agent…"))}</p>
              </article>
            ))}
          </div>
        ) : outcomes.length > 0 ? (
          <div className="kitchens-pair" aria-live="polite">
            {outcomes.map((outcome) => {
              const order = outcome.orderId ? orders.find((item) => item.id === outcome.orderId) : undefined;
              const rounding = order && outcome.tone !== "danger" ? roundingNote(order.offer) : undefined;
              return (
                <article key={outcome.buyer} className="kitchen" data-tone={outcome.tone}>
                  <header>
                    <h3>{outcome.buyer}</h3>
                    <StateWord word={outcome.word} tone={outcome.tone} />
                  </header>
                  <p>{withEuroSign(tidyProductText(outcome.summary))}</p>
                  {rounding ? <p className="kitchen-rounding">{rounding}</p> : null}
                  <div className="kitchen-foot">
                    {order ? (
                      <button type="button" className="text-link" onClick={() => ui.openOrder(order.id)}>
                        Open the order
                      </button>
                    ) : null}
                    <TechDetails rows={[{ label: "Order id", value: outcome.orderId, mono: true }]} />
                  </div>
                </article>
              );
            })}
          </div>
        ) : null}
        {state.kind === "error" ? (
          <p className="kitchens-error" role="alert">
            {state.message}
          </p>
        ) : null}
      </div>
    </section>
  );
}
