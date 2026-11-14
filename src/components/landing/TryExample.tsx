"use client";

import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { consoleStore } from "@/lib/console/store";
import { toast } from "../ui/toast";

/**
 * One tap runs the challenge sheet's own example in the visitor's private demo copy (the milk scene, the same words
 * every time) and opens the kitchen's Today, where the request and its result appear.
 */
export function TryExample({ className }: { className?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      await consoleStore.startRun({ scenario: "milk" });
      router.push("/buyer");
    } catch {
      toast("The example did not start. Try again.", "danger");
      setBusy(false);
    }
  }

  return (
    <button type="button" className={className} onClick={() => void run()} disabled={busy}>
      {busy ? <LoaderCircle className="spin" aria-hidden="true" /> : null}
      Try the example
    </button>
  );
}
