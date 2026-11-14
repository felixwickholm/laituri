"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { consoleStore } from "@/lib/console/store";
import { CONDITIONS, storyFacts } from "@/lib/tour/facts";
import { pressSettles, readKey, readMsOf, type TourState } from "@/lib/tour/machine";
import { MAIN_TARGET, STEPS, type TourStep } from "@/lib/tour/steps";
import { resolveTargets } from "@/lib/tour/targets";
import { ACTIONS, prepareDemo, runSettled } from "./actions";
import { tourStore } from "./tour-store";

const WATCH_MS = 250;

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

/** The step's own targets are on screen; the page's main region is only a fallback and never counts. */
function targetShown(step: TourStep, runs: TourState["runs"]): boolean {
  const own = step.target.filter((selector) => selector !== MAIN_TARGET);
  const selectors = resolveTargets(own, runs);
  if (step.shownWhen && !document.querySelector(step.shownWhen)) return false;
  return own.length === 0 || selectors.some((selector) => document.querySelector(selector) !== null);
}

function outcomeReached(step: TourStep, runs: TourState["runs"]): boolean {
  const snapshot = consoleStore.getSnapshot();
  return CONDITIONS[step.until](snapshot, storyFacts(snapshot)) && targetShown(step, runs);
}

function urlParam(state: TourState): string | null {
  if (state.status === "step") return STEPS[state.index].id;
  if (state.status === "intro" || state.status === "starting") return "start";
  return null;
}

/**
 * Carries out what the machine decides: signs in and resets on Start, moves between pages, performs each
 * step's action once, watches for its outcome with a timeout, and restores the log when the tour closes.
 */
export function useTourRunner(state: TourState): void {
  const router = useRouter();
  const pathname = usePathname();
  const step = state.status === "step" ? STEPS[state.index] : undefined;
  const outcome = step ? state.outcomes[step.id] : undefined;
  const pressed = step ? state.pressed.includes(step.id) : false;
  const settled = step ? state.settled.includes(step.id) : false;
  const onRoute = step !== undefined && pathname === step.route;
  const reading = step ? readKey(step, state) : undefined;
  const readLeft = step ? readMsOf(step, state) : 0;

  useEffect(() => {
    if (state.status !== "starting") return;
    once("start", async () => {
      try {
        await prepareDemo();
        watchedSince.clear();
        tourStore.readSince.clear();
        tourStore.dispatch({ type: "started" });
      } catch {
        tourStore.dispatch({ type: "failed", message: "The demo could not be reset. Check the connection and press Start again." });
      }
    });
  }, [state.status]);

  useEffect(() => {
    if (step && !onRoute) router.push(`${step.route}?tour=${step.id}`);
  }, [step, onRoute, router]);

  useEffect(() => {
    if (step && !onRoute) return;
    const url = new URL(window.location.href);
    const value = urlParam(state);
    if (url.searchParams.get("tour") === value) return;
    if (value === null) url.searchParams.delete("tour");
    else url.searchParams.set("tour", value);
    window.history.replaceState(null, "", url);
  }, [state, step, onRoute, pathname]);

  useEffect(() => {
    if (!step?.enter || !onRoute || state.performed.includes(step.id)) return;
    const action = step.enter;
    tourStore.dispatch({ type: "performed", step: step.id });
    // The cheating scene edits a log entry in this browser's sandbox; the tour owes the person a restored log.
    if (action === "startBreakMandate" || action === "awaitLogEdit") tourStore.dispatch({ type: "tampered", value: true });
    once(`enter:${step.id}`, ACTIONS[action]);
  }, [step, onRoute, state.performed]);

  useEffect(() => {
    // The reading time starts once the sentence it is for is on screen: the outcome is in, or the press settled.
    if (!onRoute || !reading || readLeft === 0 || !outcome) return;
    const since = tourStore.readSince.get(reading) ?? Date.now();
    tourStore.readSince.set(reading, since);
    const timer = setTimeout(() => tourStore.dispatch({ type: "read", key: reading }), Math.max(0, readLeft - (Date.now() - since)));
    return () => clearTimeout(timer);
  }, [onRoute, reading, readLeft, outcome]);

  useEffect(() => {
    if (!step || !onRoute || outcome === "done") return;
    if (!watchedSince.has(step.id)) watchedSince.set(step.id, Date.now());
    const since = watchedSince.get(step.id) ?? Date.now();
    const watch = () => {
      if (!inFlight.has(`enter:${step.id}`) && outcomeReached(step, tourStore.getSnapshot().runs)) tourStore.dispatch({ type: "outcome", step: step.id, outcome: "done" });
      else if (!outcome && Date.now() - since > step.timeoutMs) tourStore.dispatch({ type: "outcome", step: step.id, outcome: "timeout" });
    };
    watch();
    const timer = setInterval(watch, WATCH_MS);
    return () => clearInterval(timer);
  }, [step, onRoute, outcome]);

  useEffect(() => {
    const press = step?.pressAction;
    if (!step || !press || settled) return;
    if (pressed) once(`press:${step.id}`, ACTIONS[press.action]);
    const since = Date.now();
    const watch = () => {
      const snapshot = consoleStore.getSnapshot();
      const done = CONDITIONS[press.until](snapshot, storyFacts(snapshot)) && !inFlight.has(`press:${step.id}`);
      if (pressSettles(press, pressed, done, Date.now() - since > press.timeoutMs)) tourStore.dispatch({ type: "settled", step: step.id });
    };
    const timer = setInterval(watch, WATCH_MS);
    return () => clearInterval(timer);
  }, [step, pressed, settled]);

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
      // A change still on its way to the server would land after the restore and leave the log broken.
      await Promise.all([...inFlight].filter(([key]) => key.startsWith("enter:")).map(([, running]) => running));
      await runSettled();
      // Puts the changed log entry back, so approvals are not left paused after the tour.
      await consoleStore.restoreLog();
      tourStore.dispatch({ type: "tampered", value: false });
    });
  }, [state.tampered, state.status]);
}
