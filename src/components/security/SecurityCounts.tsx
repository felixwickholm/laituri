"use client";

import { count } from "@/lib/console/format/money";
import { useConsole } from "@/lib/console/store";

interface Suite {
  id: string;
  passed: number;
  total: number;
}

const WORD: Record<string, string> = { guardrails: "guardrail checks", trust: "trust checks" };

/** Four proof numbers: sealed steps read live from the record, the measured check suites, and the signing keys. */
export function SecurityCounts({ suites, keys }: { suites: Suite[]; keys: number }) {
  const { chain } = useConsole();
  const sealed = "entries" in chain ? chain.entries : undefined;
  return (
    <ul className="count-tiles" aria-label="Proof">
      <li className="count-tile" data-tone={chain.state === "broken" ? "danger" : chain.state === "verified" ? "success" : undefined}>
        <span className="count-tile-number">{sealed === undefined ? "–" : count(sealed)}</span>
        <span className="count-tile-word">sealed steps</span>
      </li>
      {suites.map((suite) => (
        <li key={suite.id} className="count-tile" data-tone={suite.passed === suite.total ? "success" : "danger"}>
          <span className="count-tile-number">
            {count(suite.passed)}/{count(suite.total)}
          </span>
          <span className="count-tile-word">{WORD[suite.id] ?? suite.id}</span>
        </li>
      ))}
      <li className="count-tile">
        <span className="count-tile-number">{count(keys)}</span>
        <span className="count-tile-word">signing keys</span>
      </li>
    </ul>
  );
}
