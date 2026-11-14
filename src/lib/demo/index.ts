import { demoState } from "./state";

export { RunActiveError, getRun, startRun, type StartRun } from "./runs";
export { SCENARIOS, MILK_REQUEST, OVER_LIMIT_REQUEST, SHORT_STOCK_REQUEST, TWO_KITCHENS_REQUEST, WEEKLY_TITLE } from "./scenarios";
export { restoreAudit, tamperAudit } from "./tamper";
export type { DemoRun, ScenarioId } from "./state";

/** Forget every run and any tampered entry. Call after the store is reset; a run still going stops at its next step. */
export function resetDemo(): void {
  const state = demoState();
  state.generation += 1;
  state.runs.clear();
  state.active = undefined;
  state.tampered = undefined;
}
