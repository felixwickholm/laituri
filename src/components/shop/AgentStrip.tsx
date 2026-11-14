"use client";

import { Bot, ChevronRight } from "lucide-react";
import Link from "next/link";
import type { AgentStep } from "@/lib/shop-console/agent-watch";

/** Shown while an agent works in this workspace: its latest step in plain words, and a way to see what it saw. */
export function AgentStrip({ step, onShow }: { step: AgentStep; onShow: (query: string) => void }) {
  return (
    <div className="store-strip" role="status" aria-live="polite">
      <span className="store-strip-mark" aria-hidden="true">
        <Bot />
      </span>
      <p>
        <strong>Your agent is shopping.</strong> <span key={step.id}>{step.sentence}</span>
      </p>
      <div className="store-strip-actions">
        {step.query ? (
          <button type="button" className="btn btn-quiet" onClick={() => onShow(step.query as string)}>
            Show what it found
          </button>
        ) : null}
        <Link href="/buyer" className="text-link">
          Today
          <ChevronRight aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
