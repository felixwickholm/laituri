import { describe, expect, it } from "vitest";
import { CLOSED, canGoNext, fromUrl, pressPending, pressSettles, readKey, readMsOf, reduce, restore, type PlanStep, type TourEvent, type TourState } from "@/lib/tour/machine";
import { STEPS, copyOf, spotOf } from "@/lib/tour/steps";
import { storyFacts } from "@/lib/tour/facts";

const PLAN: PlanStep[] = [{ id: "a" }, { id: "b", press: true }, { id: "c" }];

function run(events: TourEvent[], from: TourState = CLOSED): TourState {
  return events.reduce((state, event) => reduce(PLAN, state, event), from);
}

const started: TourEvent[] = [{ type: "open" }, { type: "begin" }, { type: "started" }];

describe("tour machine", () => {
  it("opens on the intro, starts only through begin and started, and lands on the first step", () => {
    expect(run([{ type: "open" }]).status).toBe("intro");
    expect(run([{ type: "open" }, { type: "started" }]).status).toBe("intro");
    const state = run(started);
    expect(state).toMatchObject({ status: "step", index: 0 });
  });

  it("returns to the intro with the reason when starting fails", () => {
    const state = run([{ type: "open" }, { type: "begin" }, { type: "failed", message: "No server." }]);
    expect(state).toMatchObject({ status: "intro", error: "No server." });
    expect(run([{ type: "begin" }], state).error).toBeUndefined();
  });

  it("waits: Next does nothing until the step's outcome is in", () => {
    const waiting = run(started);
    expect(canGoNext(PLAN, waiting)).toBe(false);
    expect(run([{ type: "next" }], waiting)).toBe(waiting);
    const ready = run([{ type: "outcome", step: "a", outcome: "done" }], waiting);
    expect(canGoNext(PLAN, ready)).toBe(true);
    expect(run([{ type: "next" }], ready).index).toBe(1);
  });

  it("lets a timed-out step go on, and a later done replaces the timeout but not the reverse", () => {
    const timedOut = run([...started, { type: "outcome", step: "a", outcome: "timeout" }]);
    expect(canGoNext(PLAN, timedOut)).toBe(true);
    const done = run([{ type: "outcome", step: "a", outcome: "done" }], timedOut);
    expect(done.outcomes.a).toBe("done");
    expect(run([{ type: "outcome", step: "a", outcome: "timeout" }], done).outcomes.a).toBe("done");
  });

  it("makes the first Next on a press step perform the press, then waits for it to settle", () => {
    const atB = run([...started, { type: "outcome", step: "a", outcome: "done" }, { type: "next" }, { type: "outcome", step: "b", outcome: "done" }]);
    expect(pressPending(PLAN, atB)).toBe(true);
    const pressed = run([{ type: "next" }], atB);
    expect(pressed).toMatchObject({ index: 1, pressed: ["b"] });
    expect(canGoNext(PLAN, pressed)).toBe(false);
    const settled = run([{ type: "settled", step: "b" }], pressed);
    expect(pressPending(PLAN, settled)).toBe(false);
    expect(run([{ type: "next" }], settled).index).toBe(2);
  });

  it("skips the press when the person already did it", () => {
    const atB = run([...started, { type: "outcome", step: "a", outcome: "done" }, { type: "next" }, { type: "outcome", step: "b", outcome: "done" }, { type: "settled", step: "b" }]);
    expect(run([{ type: "next" }], atB).index).toBe(2);
  });

  it("goes back without forgetting outcomes, and ends after the last step", () => {
    let state = run([...started, { type: "outcome", step: "a", outcome: "done" }, { type: "next" }]);
    state = run([{ type: "back" }], state);
    expect(state.index).toBe(0);
    expect(canGoNext(PLAN, state)).toBe(true);
    expect(run([{ type: "back" }], state).index).toBe(0);
    const last = { ...state, index: 2, outcomes: { ...state.outcomes, c: "done" as const } };
    const end = run([{ type: "next" }], last);
    expect(end.status).toBe("end");
    expect(run([{ type: "back" }], end)).toBe(end);
    expect(run([{ type: "close" }], end)).toEqual({ ...CLOSED });
  });

  it("pauses on close mid-story and resumes at the same step", () => {
    const state = run([...started, { type: "outcome", step: "a", outcome: "done" }, { type: "next" }]);
    const paused = run([{ type: "close" }], state);
    expect(paused).toMatchObject({ status: "paused", index: 1 });
    expect(run([{ type: "resume" }], paused)).toMatchObject({ status: "step", index: 1 });
    expect(run([{ type: "close" }], paused).status).toBe("closed");
  });

  it("keeps the tampered mark through closing, so the runner can restore the log", () => {
    const state = run([...started, { type: "tampered", value: true }, { type: "close" }, { type: "close" }]);
    expect(state).toMatchObject({ status: "closed", tampered: true });
    expect(run([{ type: "tampered", value: false }], state).tampered).toBe(false);
  });

  it("records an entry action once", () => {
    const state = run([...started, { type: "performed", step: "a" }, { type: "performed", step: "a" }]);
    expect(state.performed).toEqual(["a"]);
  });
});

describe("the tour's own runs", () => {
  it("remembers the run each scene started, and forgets them when a new tour starts", () => {
    const state = run([...started, { type: "run", scene: "milk", id: "run_1" }, { type: "run", scene: "over-limit", id: "run_2" }]);
    expect(state.runs).toEqual({ milk: "run_1", "over-limit": "run_2" });
    expect(run(started, state).runs).toEqual({});
  });
});

describe("tour resume", () => {
  it("restores a saved state and rejects anything malformed", () => {
    const saved = run([...started, { type: "run", scene: "milk", id: "run_1" }, { type: "outcome", step: "a", outcome: "done" }, { type: "next" }]);
    expect(restore(PLAN, JSON.parse(JSON.stringify(saved)))).toEqual({ ...saved, error: undefined });
    expect(restore(PLAN, { ...saved, runs: { milk: 7 } }).runs).toEqual({});
    expect(restore(PLAN, { status: "step", index: 9 })).toBe(CLOSED);
    expect(restore(PLAN, { status: "dancing", index: 0 })).toBe(CLOSED);
    expect(restore(PLAN, "nonsense")).toBe(CLOSED);
    expect(restore(PLAN, { ...saved, outcomes: { a: "maybe" } }).outcomes).toEqual({});
  });

  it("resumes a save made mid-start at the intro", () => {
    expect(restore(PLAN, { ...CLOSED, status: "starting" }).status).toBe("intro");
  });

  it("reads ?tour=: start opens the intro, a reached step resumes there, an unreached one keeps the place", () => {
    expect(fromUrl(PLAN, CLOSED, "start").status).toBe("intro");
    expect(fromUrl(PLAN, CLOSED, "1").status).toBe("intro");
    expect(fromUrl(PLAN, CLOSED, "b").status).toBe("intro");
    const atA = run([...started, { type: "outcome", step: "a", outcome: "done" }]);
    expect(fromUrl(PLAN, atA, "b")).toMatchObject({ status: "step", index: 1 });
    expect(fromUrl(PLAN, atA, "c")).toMatchObject({ status: "step", index: 0 });
    expect(fromUrl(PLAN, { ...atA, status: "paused" }, "a")).toMatchObject({ status: "step", index: 0 });
    expect(fromUrl(PLAN, atA, null)).toBe(atA);
    expect(fromUrl(PLAN, { ...atA, status: "end" }, "start").status).toBe("intro");
  });

  it("shows the end card once: a saved or addressed end never brings it back", () => {
    const ended = { ...run(started), status: "end" as const, tampered: true };
    expect(restore(PLAN, JSON.parse(JSON.stringify(ended)))).toEqual({ ...CLOSED, tampered: true });
    expect(fromUrl(PLAN, CLOSED, "end")).toBe(CLOSED);
    expect(fromUrl(PLAN, restore(PLAN, ended), "end").status).toBe("closed");
    expect(fromUrl(PLAN, CLOSED, "start").status).toBe("intro");
  });
});

describe("reading time", () => {
  const READ: PlanStep[] = [{ id: "a", readMs: 5000 }, { id: "b", press: true, readMs: 4000, pressReadMs: 3000 }, { id: "c" }];
  const go = (events: TourEvent[], from: TourState = CLOSED) => events.reduce((state, event) => reduce(READ, state, event), from);

  it("keeps Next waiting until the card has been read, even with the outcome in", () => {
    const done = go([...started, { type: "outcome", step: "a", outcome: "done" }]);
    expect(readMsOf(READ[0], done)).toBe(5000);
    expect(canGoNext(READ, done)).toBe(false);
    const read = go([{ type: "read", key: "a" }], done);
    expect(readMsOf(READ[0], read)).toBe(0);
    expect(canGoNext(READ, read)).toBe(true);
  });

  it("asks for a second read once a press has settled, under its own key", () => {
    let state = go([...started, { type: "outcome", step: "a", outcome: "done" }, { type: "read", key: "a" }, { type: "next" }, { type: "outcome", step: "b", outcome: "done" }, { type: "read", key: "b" }]);
    expect(readKey(READ[1], state)).toBe("b");
    state = go([{ type: "next" }, { type: "settled", step: "b" }], state);
    expect(readKey(READ[1], state)).toBe("b:press");
    expect(canGoNext(READ, state)).toBe(false);
    state = go([{ type: "read", key: "b:press" }], state);
    expect(go([{ type: "next" }], state).index).toBe(2);
  });

  it("asks nothing of a step without a reading time", () => {
    expect(readMsOf(READ[2], { settled: [], read: [] })).toBe(0);
  });
});

describe("press actions", () => {
  it("settles when its outcome is in, or after a press that ran out of time", () => {
    expect(pressSettles({}, false, true, false)).toBe(true);
    expect(pressSettles({}, false, false, true)).toBe(false);
    expect(pressSettles({}, true, false, true)).toBe(true);
    expect(pressSettles({}, true, false, false)).toBe(false);
  });

  it("waits for Next when only Next may settle it", () => {
    expect(pressSettles({ requirePress: true }, false, true, false)).toBe(false);
    expect(pressSettles({ requirePress: true }, true, true, false)).toBe(true);
  });
});

describe("the walkthrough's steps", () => {
  it("has unique ids, a press only where a press action exists, and a target for every step", () => {
    expect(new Set(STEPS.map((step) => step.id)).size).toBe(STEPS.length);
    for (const step of STEPS) {
      expect(Boolean(step.press)).toBe(Boolean(step.pressAction));
      expect(step.target.length).toBeGreaterThan(0);
      expect(step.route.startsWith("/")).toBe(true);
    }
  });

  it("tells eight beats in order, the cheating scene before the edited log", () => {
    expect(STEPS.map((step) => step.id)).toEqual(["request", "offer", "rules", "phone", "stock", "valio", "cheat", "log"]);
    expect(STEPS[0]).toMatchObject({ pinTop: true, nextLabel: "Send it" });
    expect(STEPS.find((step) => step.id === "cheat")).toMatchObject({ enter: "startBreakMandate", until: "rulesRefused" });
  });

  it("moves Valio Aimo's spotlight from the agents to the demand only after Next, with the sentence to match", () => {
    const valio = STEPS.find((step) => step.id === "valio");
    if (!valio) throw new Error("no valio step");
    const facts = storyFacts({ ready: true, online: true, activity: [], orders: [], audit: [], chain: { state: "empty" } });
    const before = { outcomes: {}, settled: [] as string[] };
    const after = { outcomes: {}, settled: ["valio"] };
    expect(spotOf(valio, before).target[0]).toBe('[data-tour="valio-agents"]');
    expect(spotOf(valio, after).target[0]).toBe('[data-tour="valio-flow"]');
    expect(spotOf(valio, after).target).toContain('[data-tour="valio-unserved"]');
    expect(copyOf(valio, before, facts).title).toMatch(/every agent/);
    expect(copyOf(valio, after, facts).title).toMatch(/could not serve/);
    expect(valio.pressAction?.requirePress).toBe(true);
  });
});
