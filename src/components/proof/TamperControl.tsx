"use client";

import { FileWarning, FlaskConical, RotateCcw } from "lucide-react";
import { useState } from "react";
import { consoleStore } from "@/lib/console/store";
import { toast } from "../ui/toast";

/**
 * A demo control: change one stored entry, so the browser check can be seen failing, then put it back.
 * In production the log is restored from the last signed checkpoint; here the changed entry is put back as signed.
 */
export function TamperControl({ broken }: { broken: boolean }) {
  const [busy, setBusy] = useState(false);

  async function act(run: () => Promise<string>, failure: string) {
    setBusy(true);
    try {
      toast(await run(), "neutral");
    } catch {
      toast(failure, "danger");
    } finally {
      setBusy(false);
    }
  }

  const tamper = () => act(async () => `Entry ${await consoleStore.tamper()} was changed on the server. Watch the check fail.`, "The log could not be changed.");
  const restore = () =>
    act(async () => {
      await consoleStore.restoreLog();
      return "The changed entry is back as it was signed. The log verifies again.";
    }, "The log could not be restored.");

  return (
    <div className="demo-control">
      <FlaskConical aria-hidden="true" />
      <p>
        <strong>Try it: tamper with the log.</strong> This demo control changes one stored entry on the server, the way an attacker would. The check above
        catches it.
      </p>
      {broken ? (
        <button type="button" className="btn btn-secondary" onClick={restore} disabled={busy}>
          <RotateCcw aria-hidden="true" />
          {busy ? "Restoring…" : "Restore the log (demo)"}
        </button>
      ) : (
        <button type="button" className="btn btn-secondary" onClick={tamper} disabled={busy} data-tour="tamper">
          <FileWarning aria-hidden="true" />
          {busy ? "Changing…" : "Change one entry"}
        </button>
      )}
    </div>
  );
}
