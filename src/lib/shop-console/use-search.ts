"use client";

import { useEffect, useState } from "react";
import type { SearchHit, SearchPreference } from "@/lib/contracts";
import { shopApi } from "./api";

const DEBOUNCE_MS = 280;
const LIMIT = 24;

export interface SearchState {
  status: "idle" | "loading" | "done" | "failed";
  hits: SearchHit[];
  /** The API's own sentence when the request was unclear. */
  note?: string;
  error?: string;
  /** The query and filter these hits answer. */
  for?: string;
}

/** Searches as the person types: one request at a time, the older one cancelled, after a short pause. */
export function useShopSearch(query: string, group: string | undefined, prefer: SearchPreference): SearchState {
  const [state, setState] = useState<SearchState>({ status: "idle", hits: [] });
  const text = query.trim();
  const key = `${text}|${group ?? ""}|${prefer}`;

  useEffect(() => {
    if (text.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setState((previous) => ({ ...previous, status: "loading" }));
      shopApi
        .search({ query: text, limit: LIMIT, prefer, ...(group ? { filters: { categoryGroup: group } } : {}) }, controller.signal)
        .then((response) =>
          setState({ status: "done", hits: response.hits, note: response.interpretation.note, for: key }),
        )
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          setState({ status: "failed", hits: [], error: error instanceof Error ? error.message : "The search did not answer.", for: key });
        });
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [key, text, group, prefer]);

  return text.length < 2 ? { status: "idle", hits: [] } : state;
}
