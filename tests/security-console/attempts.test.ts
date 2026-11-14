import { describe, expect, it } from "vitest";
import type { Activity } from "@/lib/console/types";
import { PLANNED, attemptViews, attemptsBlock, attemptsHeadline } from "@/lib/security-console/attempts";

const AGENT = { id: "agent:harbour-purchasing", name: "Harbour purchasing agent" };
let clock = Date.parse("2026-11-14T07:00:00.000Z");
let counter = 0;

function note(title: string, status: Activity["status"] = "ok", run?: Activity["run"]): Activity {
  clock += 1000;
  counter += 1;
  return { id: `n${counter}`, at: new Date(clock).toISOString(), agent: AGENT, kind: "note", title, status, ...(run ? { run } : {}) };
}

/** The scene's notes as break-mandate writes them, up to `upTo` attempts, the last one still open when `open` is set. */
function scene(run: Activity["run"], upTo = 5, open = false): Activity[] {
  const lines = [
    ["Attempt 1 of 5: ordering a product that contains nuts.", "Stopped. Contains peanut."],
    ["Attempt 2 of 5: Trying to change the price in the signed offer.", "Stopped. The signature no longer matches."],
    ["Attempt 3 of 5: Raising my own limit from €1,500 to €100,000 in the mandate.", "Stopped. The buyer's signature on the mandate no longer matches."],
    ["Attempt 4 of 5: Trying to approve my own order.", "Stopped. Agents cannot approve orders. Only Maria Lind can."],
    ["Attempt 5 of 5: Changing an entry in the log after the fact.", "Stopped. Entry 12 no longer matches its signature."],
  ];
  return lines.slice(0, upTo).flatMap(([attempt, result], index) =>
    open && index === upTo - 1 ? [note(attempt, "ok", run)] : [note(attempt, "ok", run), note(result, "blocked", run)],
  );
}

describe("security attempts", () => {
  it("lists the five tries in plain words before any run", () => {
    const views = attemptViews(undefined, false);
    expect(views.map((view) => view.tried)).toEqual(PLANNED.map((plan) => plan.tried));
    expect(views.every((view) => view.state === "ready")).toBe(true);
    expect(views.every((view) => view.stoppedBy.split(" ").length <= 5)).toBe(true);
    expect(attemptsHeadline(views, false)).toBe("Five unusual actions, run on your own copy.");
  });

  it("shows each try arrive and get stopped while the run is on", () => {
    const activity = scene({ id: "run_1", title: "Try to break the rules, five ways" }, 3, true);
    const block = attemptsBlock(activity, [], { runId: "run_1" });
    const views = attemptViews(block, true);
    expect(views.map((view) => view.state)).toEqual(["stopped", "stopped", "trying", "next", "next"]);
    expect(attemptsHeadline(views, true)).toBe("2 of 5 checked.");
  });

  it("says all five were stopped when the run ends", () => {
    const views = attemptViews(attemptsBlock(scene(undefined), []), false);
    expect(views.every((view) => view.state === "stopped")).toBe(true);
    expect(attemptsHeadline(views, false)).toBe("All 5 were stopped and flagged.");
  });

  it("names a try that got through", () => {
    const activity = [note("Attempt 1 of 5: ordering a product that contains nuts."), note("Not stopped by the allergen rule.", "error")];
    const views = attemptViews(attemptsBlock(activity, []), false);
    expect(views[0].state).toBe("through");
    expect(attemptsHeadline(views, false)).toBe("1 of 1 got through.");
  });

  it("follows only the run this page started, not an older one", () => {
    const older = scene(undefined);
    const before = attemptsBlock(older, [])?.id;
    expect(attemptsBlock(older, [], { before })).toBeUndefined();
    const fresh = [...older, ...scene({ id: "run_tag", title: "Try to break the rules, five ways" }, 1, true)];
    expect(attemptsBlock(fresh, [], { runId: "run_other", before })?.runId).toBe("run_tag");
  });
});
