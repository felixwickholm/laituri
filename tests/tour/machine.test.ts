import { describe, expect, it } from "vitest";
import { CLOSED, canGoNext, fromUrl, pressPending, reduce, restore, type PlanStep, type TourEvent, type TourState } from "@/lib/tour/machine";
import { STEPS } from "@/lib/tour/steps";

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
    expect(run([{ type: "back" }], end)).toMatchObject({ status: "step", index: 2 });
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

describe("tour resume", () => {
  it("restores a saved state and rejects anything malformed", () => {
    const saved = run([...started, { type: "outcome", step: "a", outcome: "done" }, { type: "next" }]);
    expect(restore(PLAN, JSON.parse(JSON.stringify(saved)))).toEqual({ ...saved, error: undefined });
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
});
