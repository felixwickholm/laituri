"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { consoleStore } from "@/lib/console/store";
import { CONDITIONS } from "@/lib/tour/facts";
import type { TourState } from "@/lib/tour/machine";
import { MAIN_TARGET, STEPS, routeOf, type TourStep } from "@/lib/tour/steps";
import { ACTIONS, chooseRoutes, prepareDemo } from "./actions";
import { tourStore } from "./tour-store";
import { readTourFacts } from "./useTourFacts";

const WATCH_MS = 150;

/** One-shot work already under way in this tab, so a remount or a second render never repeats it. */
const inFlight = new Map<string, Promise<void>>();
/** When this tab began waiting for each step, so a page change does not restart its timeout. */
const watchedSince = new Map<string, number>();
/** The page the end card first showed on: it stays there and never follows the person to another page. */
let endedOn: string | null = null;

function once(key: string, work: () => Promise<void>): void {
  if (inFlight.has(key)) return;
  const running = work()
    .catch(() => undefined)
    .finally(() => inFlight.delete(key));
  inFlight.set(key, running);
}

/** The step's result is in the product and on screen: its condition holds, and its own target (not the fallback) shows. */
function resultShown(step: TourStep, state: TourState): boolean {
  if (!CONDITIONS[step.until](readTourFacts(state))) return false;
  if (step.shownWhen && !document.querySelector(step.shownWhen)) return false;
  return step.view === "phone" || step.target.some((selector) => selector !== MAIN_TARGET && document.querySelector(selector) !== null);
}

/** Leaves a step forward: its leave action starts, without waiting, and the next card shows at once. */
export function goNext(state: TourState): void {
  const step = state.status === "step" ? STEPS[state.index] : undefined;
  if (step?.leave && !state.performed.includes(`leave:${step.id}`)) {
    tourStore.dispatch({ type: "performed", key: `leave:${step.id}` });
    once(`leave:${step.id}`, ACTIONS[step.leave]);
  }
  tourStore.dispatch({ type: "next" });
}

function urlParam(state: TourState): string | null {
  if (state.status === "step") return STEPS[state.index].id;
  if (state.status === "intro" || state.status === "starting") return "start";
  return null;
}

/**
 * Carries out what the machine decides: resets the visitor's copy on Start, moves between pages, performs each step's
 * action once, watches for its result with a timeout, and puts the record back when the tour closes or ends.
 */
export function useTourRunner(state: TourState): void {
  const router = useRouter();
  const pathname = usePathname();
  const step = state.status === "step" ? STEPS[state.index] : undefined;
  const route = step ? routeOf(step, state.routes) : undefined;
  const outcome = step ? state.outcomes[step.id] : undefined;
  const onRoute = step !== undefined && pathname === route;

  useEffect(() => {
    if (state.status !== "starting") return;
    once("start", async () => {
      try {
        const [routes] = await Promise.all([chooseRoutes(STEPS), prepareDemo()]);
        watchedSince.clear();
        tourStore.dispatch({ type: "started", routes });
      } catch {
        tourStore.dispatch({ type: "failed", message: "The walkthrough could not start. Check the connection and press Start again." });
      }
    });
  }, [state.status]);

  useEffect(() => {
    if (step && route && !onRoute) router.push(`${route}?tour=${step.id}`);
  }, [step, route, onRoute, router]);

  useEffect(() => {
    if (step && !onRoute) return;
    const url = new URL(window.location.href);
    const value = urlParam(state);
    if (url.searchParams.get("tour") === value) return;
    if (value === null) url.searchParams.delete("tour");
    else url.searchParams.set("tour", value);
    window.history.replaceState(window.history.state, "", url);
  }, [state, step, onRoute, pathname]);

  useEffect(() => {
    if (!step?.enter || !onRoute || state.performed.includes(`enter:${step.id}`)) return;
    tourStore.dispatch({ type: "performed", key: `enter:${step.id}` });
    once(`enter:${step.id}`, ACTIONS[step.enter]);
  }, [step, onRoute, state.performed]);

  useEffect(() => {
    if (!step || !onRoute || outcome === "done") return;
    if (!watchedSince.has(step.id)) watchedSince.set(step.id, Date.now());
    const since = watchedSince.get(step.id) ?? Date.now();
    const watch = () => {
      const current = tourStore.getSnapshot();
      if (!inFlight.has(`enter:${step.id}`) && resultShown(step, current)) tourStore.dispatch({ type: "outcome", step: step.id, outcome: "done" });
      else if (!outcome && Date.now() - since > step.timeoutMs) tourStore.dispatch({ type: "outcome", step: step.id, outcome: "timeout" });
    };
    watch();
    const timer = setInterval(watch, WATCH_MS);
    return () => clearInterval(timer);
  }, [step, onRoute, outcome]);

  useEffect(() => {
    if (state.status !== "end") {
      endedOn = null;
      return;
    }
    endedOn ??= pathname;
    if (endedOn !== pathname) tourStore.dispatch({ type: "close" });
  }, [state.status, pathname]);

  useEffect(() => {
    if (!state.tampered || state.status === "step" || state.status === "starting") return;
    once("restore", async () => {
      // A change still on its way to the server would land after the restore and leave the record broken.
      await Promise.all([...inFlight].filter(([key]) => key.startsWith("enter:")).map(([, running]) => running));
      await consoleStore.restoreLog();
      tourStore.dispatch({ type: "tampered", value: false });
    });
  }, [state.tampered, state.status]);
}
