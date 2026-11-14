const KEY = "laituri.guide.seen";

/** Whether this browser has finished or closed the guide. Storage can be blocked, so every access is guarded. */
export function guideSeen(): boolean {
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function markGuideSeen(): void {
  try {
    window.localStorage.setItem(KEY, "1");
  } catch {
    // Without storage the guide simply shows again next time.
  }
}

export interface GuideStep {
  target: string;
  title: string;
  body: string;
}

/** Targets are `data-guide` attribute values on the control room. */
export const GUIDE_STEPS: GuideStep[] = [
  { target: "dock", title: "Start a scene here", body: "Each scene sends the buyer agent a real request. Watch it move through the three panes." },
  { target: "agent", title: "1 · What the agent does", body: "Every call the purchasing agent makes arrives here as it happens." },
  { target: "approvals", title: "2 · What waits for you", body: "Orders over a limit stop here. You approve or reject, and your decision is signed." },
  { target: "proof", title: "3 · What was logged", body: "Each step is signed and chained. Your browser checks the chain with the public keys." },
];
