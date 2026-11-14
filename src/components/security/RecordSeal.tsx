"use client";

import { CircleCheck, CircleX, FileWarning, LoaderCircle, RefreshCw, RotateCcw } from "lucide-react";
import { useState } from "react";
import { consoleStore, useConsole } from "@/lib/console/store";
import { sealView } from "@/lib/security-console/seal";
import { useVerifyReplay } from "../proof/useVerifyReplay";
import { VerifySteps } from "../proof/VerifySteps";

/**
 * The record's seal, checked on this device with the same replay the log pages use. The two buttons change one
 * stored entry on the server and put it back, so a visitor can watch the check fail and pass.
 */
export function RecordSeal() {
  const { audit, chain } = useConsole();
  const { state: replay, replay: checkAgain } = useVerifyReplay(audit, chain);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastSeq = audit.length ? audit[audit.length - 1].seq : 0;
  const checking = replay.status === "running";
  const seal = sealView(chain, lastSeq, checking, replay.status === "broken" ? replay.brokenAt : undefined);
  const changed = seal.state === "changed";

  async function act(run: () => Promise<unknown>, failure: string) {
    setBusy(true);
    setError(null);
    try {
      await run();
    } catch {
      setError(failure);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="sec-block" aria-labelledby="record-title">
      <h2 id="record-title" className="section-title">
        The record
      </h2>
      <div className="glass pad sec-seal" data-state={seal.state} data-tour="record-seal">
        <div className="sec-seal-verdict">
          <span className="sec-seal-icon" aria-hidden="true">
            {seal.state === "verified" ? <CircleCheck /> : changed ? <CircleX /> : <LoaderCircle className={checking ? "spin" : undefined} />}
          </span>
          <div>
            <p className="sec-seal-title" aria-live="polite">
              {seal.title}
            </p>
            <p className="sec-seal-line">{seal.line}</p>
          </div>
        </div>
        {changed ? (
          <p className="sec-seal-alarm" role="alert">
            Approvals pause until the record is put back.
          </p>
        ) : null}
        <VerifySteps state={replay} />
        <div className="sec-seal-actions">
          <button type="button" className="btn btn-secondary" onClick={checkAgain} disabled={checking || audit.length === 0}>
            <RefreshCw aria-hidden="true" className={checking ? "spin" : undefined} />
            Check again
          </button>
          {changed ? (
            <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void act(() => consoleStore.restoreLog(), "The record could not be put back.")}>
              <RotateCcw aria-hidden="true" />
              {busy ? "Putting it back…" : "Put it back"}
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-quiet"
              disabled={busy || audit.length === 0}
              onClick={() => void act(() => consoleStore.tamper(), "The entry could not be changed.")}
            >
              <FileWarning aria-hidden="true" />
              {busy ? "Changing…" : "Change one entry"}
            </button>
          )}
        </div>
        {error ? (
          <p className="sec-error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </section>
  );
}
