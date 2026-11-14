"use client";

import { useEffect, useRef, useState } from "react";
import type { WorkspaceInfo } from "@/lib/contracts";
import { buyersFirst, keyFor } from "@/lib/connect/keys";
import { CodeBlock } from "./CodeBlock";

interface Props {
  info: WorkspaceInfo | undefined;
  primaryBuyerId: string;
  buyerId: string;
  onBuyer: (buyerId: string) => void;
}

/** True while a sideways-scrolling row has more to show at its right edge, so the edge can fade. */
function useMoreRight<T extends HTMLElement>(items: number) {
  const ref = useRef<T>(null);
  const [more, setMore] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const measure = () => setMore(node.scrollLeft + node.clientWidth < node.scrollWidth - 2);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    node.addEventListener("scroll", measure, { passive: true });
    return () => {
      observer.disconnect();
      node.removeEventListener("scroll", measure);
    };
  }, [items]);
  return [ref, more] as const;
}

/** The agent key every command on this page carries, and which customer it acts for. */
export function AgentKeyPanel({ info, primaryBuyerId, buyerId, onBuyer }: Props) {
  const buyers = buyersFirst(info, primaryBuyerId);
  const chosen = buyers.find((entry) => entry.buyer.id === buyerId);
  const [rowRef, more] = useMoreRight<HTMLDivElement>(buyers.length);

  return (
    <div className="cx-key" data-tour="connect-key">
      <div className="cx-key-head">
        <h3>Agent key</h3>
        {chosen && <p className="cx-key-agent">Acts as {chosen.agent.name}</p>}
      </div>
      {buyers.length > 1 && (
        <div ref={rowRef} className="segmented inline cx-buyers" role="group" aria-label="Customer" data-overflow={more || undefined}>
          {buyers.map((entry) => (
            <button key={entry.buyer.id} type="button" aria-pressed={entry.buyer.id === buyerId} onClick={() => onBuyer(entry.buyer.id)}>
              {entry.buyer.name}
            </button>
          ))}
        </div>
      )}
      <CodeBlock code={{ value: keyFor(info, buyerId), label: `Copy the agent key${chosen ? ` for ${chosen.buyer.name}` : ""}` }} />
    </div>
  );
}
