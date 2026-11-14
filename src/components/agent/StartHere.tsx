"use client";

import { Play } from "lucide-react";
import { useState } from "react";
import { consoleStore } from "@/lib/console/store";
import { toast } from "../ui/toast";

const FIRST_REQUEST = "1,000 litres of lactose-free milk by Monday";

/** The first thing to do on an empty screen: one real request, one button. */
export function StartHere() {
  const [busy, setBusy] = useState(false);
  async function start() {
    setBusy(true);
    try {
      await consoleStore.startRun({ scenario: "milk" });
    } catch (error) {
      toast(error instanceof Error ? error.message : "The scene could not start.", "danger");
      setBusy(false);
    }
  }
  return (
    <div className="start-here">
      <p className="start-quote">“{FIRST_REQUEST}”</p>
      <p className="start-body">The agent finds it, gets a price Valio Aimo signs, and orders inside its limits.</p>
      <button type="button" className="btn btn-primary cta" onClick={start} disabled={busy}>
        <Play aria-hidden="true" />
        {busy ? "Starting…" : "Run scene 1"}
      </button>
    </div>
  );
}
