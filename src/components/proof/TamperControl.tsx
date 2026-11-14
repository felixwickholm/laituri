"use client";

import { FileWarning } from "lucide-react";
import { useState } from "react";
import { consoleStore } from "@/lib/console/store";
import { toast } from "../ui/toast";

/** A demo control: change one stored entry, so the browser check can be seen failing. Reset restores it. */
export function TamperControl({ broken }: { broken: boolean }) {
  const [busy, setBusy] = useState(false);

  async function tamper() {
    setBusy(true);
    try {
      const seq = await consoleStore.tamper();
      toast(`Entry ${seq} was changed on the server. Watch the check fail.`, "neutral");
    } catch {
      toast("The log could not be changed.", "danger");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="demo-control">
      <span className="demo-tag">demo control</span>
      <p>
        <strong>Tamper with the log.</strong> Changes one stored entry on the server, the way an attacker would. Your browser&rsquo;s check catches it. Reset demo
        restores the log.
      </p>
      <button type="button" className="btn btn-secondary" onClick={tamper} disabled={busy || broken} data-tour="tamper">
        <FileWarning aria-hidden="true" />
        {broken ? "Log already changed" : busy ? "Changing…" : "Change one entry"}
      </button>
    </div>
  );
}
