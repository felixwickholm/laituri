import { describe, expect, it } from "vitest";
import { CLOSED, autoOpen, fromUrl, reduce, restore, type TourEvent, type TourState } from "@/lib/tour/machine";

const PLAN = [{ id: "a" }, { id: "b" }, { id: "c" }];
const run = (events: TourEvent[], from: TourState = CLOSED) => events.reduce((state, event) => reduce(PLAN, state, event), from);
const started = () => run([{ type: "open" }, { type: "begin", at: "2026-11-14T10:00:00.000Z" }, { type: "started", routes: { c: "/security" } }]);

describe("the walkthrough machine", () => {
  it("opens on the Start card and starts only after the reset", () => {
    expect(run([{ type: "open" }]).status).toBe("intro");
    expect(run([{ type: "open" }, { type: "begin", at: "x" }]).status).toBe("starting");
    const state = started();
    expect(state).toMatchObject({ status: "step", index: 0, since: "2026-11-14T10:00:00.000Z", routes: { c: "/security" } });
  });

  it("goes back to the Start card with the reason when the reset fails", () => {
    const state = run([{ type: "open" }, { type: "begin", at: "x" }, { type: "failed", message: "No connection." }]);
    expect(state).toMatchObject({ status: "intro", error: "No connection." });
  });

  it("moves on at once on Next, whether or not the result is in", () => {
    const state = run([{ type: "next" }], started());
    expect(state.index).toBe(1);
    expect(state.outcomes).toEqual({});
  });

  it("ends after the last step and shows the end card once", () => {
    const end = run([{ type: "next" }, { type: "next" }, { type: "next" }], started());
    expect(end.status).toBe("end");
    expect(run([{ type: "back" }], end).status).toBe("end");
    expect(restore(PLAN, JSON.parse(JSON.stringify(end))).status).toBe("closed");
  });

  it("pauses on Escape and resumes where it stopped", () => {
    const paused = run([{ type: "next" }, { type: "close" }], started());
    expect(paused).toMatchObject({ status: "paused", index: 1 });
    expect(run([{ type: "resume" }], paused)).toMatchObject({ status: "step", index: 1 });
  });

  it("goes back one step, never before the first", () => {
    expect(run([{ type: "next" }, { type: "back" }], started()).index).toBe(0);
    expect(run([{ type: "back" }], started()).index).toBe(0);
  });

  it("keeps a result once it is in", () => {
    const state = run([{ type: "outcome", step: "a", outcome: "done" }, { type: "outcome", step: "a", outcome: "timeout" }], started());
    expect(state.outcomes.a).toBe("done");
  });

  it("remembers the basket it started, the actions it did and that the record needs putting back", () => {
    const state = run([{ type: "basket", id: "bsk_1" }, { type: "performed", key: "enter:b" }, { type: "tampered", value: true }], started());
    expect(state).toMatchObject({ basketId: "bsk_1", performed: ["enter:b"], tampered: true });
    expect(run([{ type: "close" }, { type: "close" }], state)).toMatchObject({ status: "closed", tampered: true });
  });

  it("restores a saved story across pages, and a half-done start as the Start card", () => {
    const saved = JSON.parse(JSON.stringify(run([{ type: "next" }, { type: "basket", id: "bsk_1" }], started())));
    expect(restore(PLAN, saved)).toMatchObject({ status: "step", index: 1, basketId: "bsk_1", routes: { c: "/security" } });
    expect(restore(PLAN, { ...saved, status: "starting" }).status).toBe("intro");
    expect(restore(PLAN, { status: "step", index: 9 })).toEqual(CLOSED);
    expect(restore(PLAN, "nonsense")).toEqual(CLOSED);
  });

  it("reads ?tour= from the address", () => {
    const on = run([{ type: "next" }, { type: "next" }], started());
    expect(fromUrl(PLAN, CLOSED, "start").status).toBe("intro");
    expect(fromUrl(PLAN, on, "b")).toMatchObject({ status: "step", index: 1 });
    expect(fromUrl(PLAN, CLOSED, "b").status).toBe("intro");
    expect(fromUrl(PLAN, on, "end")).toBe(on);
    expect(fromUrl(PLAN, on, null)).toBe(on);
  });

  it("opens the Start card by itself on a product page until the visitor closes it once", () => {
    const where = { path: "/buyer", param: null, dismissed: false };
    expect(autoOpen(CLOSED, where).status).toBe("intro");
    expect(autoOpen(CLOSED, { ...where, path: "/valio/demand" }).status).toBe("intro");
    expect(autoOpen(CLOSED, { ...where, dismissed: true })).toBe(CLOSED);
    expect(autoOpen(CLOSED, { ...where, path: "/approve/basket/bsk_1" })).toBe(CLOSED);
    expect(autoOpen(CLOSED, { ...where, path: "/about" })).toBe(CLOSED);
    expect(autoOpen(CLOSED, { ...where, param: "b" })).toBe(CLOSED);
    const on = run([{ type: "next" }], started());
    expect(autoOpen(on, where)).toBe(on);
  });

  it("keeps the walkthrough closed with ?tour=off", () => {
    expect(fromUrl(PLAN, run([{ type: "open" }]), "off")).toEqual(CLOSED);
  });
});
