"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "./toast";

/** Copies a value; the icon turns into a check for 1.5 s. */
export function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [done, setDone] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setDone(true);
      toast("Copied");
      setTimeout(() => setDone(false), 1500);
    } catch {
      toast("Copy is blocked in this browser.", "danger");
    }
  }
  return (
    <button type="button" className="icon-btn" onClick={copy} aria-label={label} title={label}>
      {done ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
    </button>
  );
}
