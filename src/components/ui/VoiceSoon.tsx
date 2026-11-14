"use client";

import { MicOff } from "lucide-react";
import { toast } from "./toast";

/** Where this browser cannot listen: a small quiet mic that says voice is coming, so typing stays the way in. */
export function VoiceSoon({ className }: { className?: string }) {
  return (
    <button
      type="button"
      className={`voice-soon ${className ?? ""}`.trim()}
      title="Voice coming soon"
      aria-label="Voice coming soon. Type instead."
      onClick={() => toast("Voice is coming soon in this browser. Typing works now.", "neutral")}
    >
      <MicOff aria-hidden="true" />
    </button>
  );
}
