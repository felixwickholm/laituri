"use client";

import { useEffect, useRef, useState } from "react";
import type { AuditEntry, Order } from "@/lib/contracts";
import { count } from "@/lib/console/format/money";
import { landingCounts, type LandingCounts } from "./counts";
import { Reveal } from "./Reveal";
import { stagger } from "./stagger";
import { loadOverview } from "./useOverview";

const COUNT_MS = 900;

const FIGURES: { key: keyof LandingCounts; label: string }[] = [
  { key: "signedOffers", label: "offers signed by the wholesaler" },
  { key: "ordersConfirmed", label: "orders confirmed inside a mandate" },
  { key: "logSteps", label: "steps in the verified log" },
  { key: "connectedAgents", label: "agents connected" },
  { key: "secondsToOrder", label: "seconds from signed offer to order, median" },
];

async function getJson(path: string): Promise<unknown> {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) throw new Error(`${path} answered ${response.status}`);
  return response.json();
}

function list<T>(body: unknown, key: string): T[] | undefined {
  const value = Array.isArray(body) ? body : (body as Record<string, unknown> | null)?.[key];
  return Array.isArray(value) ? (value as T[]) : undefined;
}

/** Reads the live figures once. Each source fails on its own. */
async function loadCounts(): Promise<LandingCounts> {
  const [orders, audit, overview] = await Promise.allSettled([getJson("/api/v1/orders"), getJson("/api/v1/audit"), loadOverview()]);
  return landingCounts({
    orders: orders.status === "fulfilled" ? list<Order>(orders.value, "orders") : undefined,
    audit: audit.status === "fulfilled" ? list<AuditEntry>(audit.value, "entries") : undefined,
    overview: overview.status === "fulfilled" ? overview.value : undefined,
  });
}

/** Counts up from zero once, when the figure first arrives. Reduced motion shows it at once. */
function Figure({ value }: { value?: number }) {
  const shownRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const shown = shownRef.current;
    if (!shown || value === undefined) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      shown.textContent = count(value);
      return;
    }
    let frame = 0;
    const countUp = () => {
      const began = performance.now();
      frame = requestAnimationFrame(function step(now) {
        const t = Math.min(1, (now - began) / COUNT_MS);
        shown.textContent = count(Math.round(value * (1 - Math.pow(1 - t, 4))));
        if (t < 1) frame = requestAnimationFrame(step);
      });
    };
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      countUp();
    });
    observer.observe(shown);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [value]);
  return (
    <span className="lp-figure-value" aria-hidden="true">
      <span ref={shownRef}>{value === undefined ? "–" : "0"}</span>
    </span>
  );
}

/** Five figures read from this server's own API, with a plain note on what is live and what is demo. */
export function LiveCounters() {
  const [counts, setCounts] = useState<LandingCounts>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void loadCounts().then((next) => {
      if (cancelled) return;
      setCounts(next);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Reveal className="lp-section lp-counters" aria-labelledby="lp-counters-title">
      <h2 id="lp-counters-title" className="lp-h2 rv" style={stagger(0)}>
        Running on this server, right now.
      </h2>
      <dl className="lp-figures" aria-busy={!loaded}>
        {FIGURES.map((figure, index) => (
          <div key={figure.key} className="lp-figure rv" style={stagger(index + 1)}>
            <dt>{figure.label}</dt>
            <dd>
              <Figure key={String(counts[figure.key])} value={counts[figure.key]} />
              <span className="sr-only">{counts[figure.key] === undefined ? "not available" : count(counts[figure.key] as number)}</span>
            </dd>
          </div>
        ))}
      </dl>
      <p className="lp-honest rv" style={stagger(FIGURES.length + 1)}>
        Prices and stock are live from the challenge&apos;s mock API. Orders are simulated. History is demo data.
      </p>
    </Reveal>
  );
}
