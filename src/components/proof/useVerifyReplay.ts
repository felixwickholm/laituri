"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import type { AuditEntry } from "@/lib/contracts";
import { api } from "@/lib/console/api";
import { consoleStore } from "@/lib/console/store";
import type { ChainState } from "@/lib/console/types";
import { REPLAY_IDLE, replayReducer, runReplay, type ReplayEvent, type ReplayState } from "@/lib/console/verify-replay";

const BATCHES = 20;
const BATCH_MS = 30;

type Action = ReplayEvent | { type: "set"; state: ReplayState };

function reducer(state: ReplayState, action: Action): ReplayState {
  return action.type === "set" ? action.state : replayReducer(state, action);
}

/**
 * Drives the "Verify again" stepper from the real check: once when the log first loads, on every press, and again
 * when the console's own check comes to a different verdict (a changed entry, or a restored log).
 * With reduced motion the steps do not tick; the final state shows at once.
 */
export function useVerifyReplay(audit: AuditEntry[], chain: ChainState): { state: ReplayState; replay: () => void } {
  const [state, dispatch] = useReducer(reducer, REPLAY_IDLE);
  const token = useRef(0);
  const auditRef = useRef(audit);
  useEffect(() => {
    auditRef.current = audit;
  });

  const replay = useCallback(() => {
    const mine = ++token.current;
    const entries = auditRef.current;
    if (entries.length === 0) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const send = (event: ReplayEvent) => {
      if (token.current === mine) dispatch(event);
    };
    const confirm = () => consoleStore.verifyNow();
    if (reduced) {
      const events: ReplayEvent[] = [];
      void runReplay(entries, (event) => events.push(event), { fetchKeys: api.jwks, confirm }).then(() => {
        if (token.current === mine) dispatch({ type: "set", state: events.reduce(replayReducer, REPLAY_IDLE) });
      });
      return;
    }
    const pace = () => new Promise<void>((resolve) => setTimeout(resolve, BATCH_MS));
    void runReplay(entries, send, { fetchKeys: api.jwks, confirm, pace, batches: BATCHES }).catch(() => {
      send({ type: "broken", brokenAt: 0, reason: "The public keys could not be fetched. Try again." });
    });
  }, []);

  const loaded = audit.length > 0;
  useEffect(() => {
    if (loaded) replay();
  }, [loaded, replay]);

  // The console's own check disagrees with the last replay: run the replay again so the steps show why.
  const settled = state.status === "verified" || state.status === "broken";
  const disagrees = settled && (chain.state === "verified" || chain.state === "broken") && chain.state !== state.status;
  useEffect(() => {
    if (disagrees) replay();
  }, [disagrees, replay]);

  return { state, replay };
}
