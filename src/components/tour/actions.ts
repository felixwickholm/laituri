"use client";

import { consoleStore } from "@/lib/console/store";
import type { Scenario } from "@/lib/console/types";
import type { ActionId } from "@/lib/tour/steps";

/** What the tour types into the agent's composer, word for word the milk scene's request. */
export const MILK_REQUEST = "1,000 litres of lactose-free milk by Monday";
const TYPE_MS = 34;
const SETTLE_MS = 450;
const POLL_MS = 120;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function reducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Resolves true once `check` holds, false after `timeoutMs`. */
async function until(check: () => boolean, timeoutMs: number): Promise<boolean> {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    if (check()) return true;
    await sleep(POLL_MS);
  }
  return check();
}

async function element<T extends Element>(selector: string, timeoutMs: number): Promise<T | null> {
  await until(() => document.querySelector(selector) !== null, timeoutMs);
  return document.querySelector<T>(selector);
}

const idle = () => consoleStore.getSnapshot().run?.status !== "running";

/** Sets a React-controlled input the way typing does, so the panel's own state follows. */
function setInputValue(input: HTMLInputElement, value: string): void {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

/** Presses the panel's own scene button, or starts the scene directly when the panel is not on screen. */
async function startScene(scenario: Scenario): Promise<void> {
  await until(idle, 20_000);
  const button = await element<HTMLButtonElement>(`[data-tour-scene="${scenario}"]`, 3000);
  await until(() => !button?.disabled, 3000);
  if (button && !button.disabled) button.click();
  else await consoleStore.startRun({ scenario });
}

/** Types the request into the composer letter by letter, then sends the milk scene that asks exactly that. */
async function askForMilk(): Promise<void> {
  const input = await element<HTMLInputElement>("#live-agent-ask", 8000);
  await until(() => idle() && !input?.disabled, 10_000);
  if (input) {
    const step = reducedMotion() ? 0 : TYPE_MS;
    for (let index = 1; index <= MILK_REQUEST.length; index++) {
      setInputValue(input, MILK_REQUEST.slice(0, index));
      if (step) await sleep(step);
    }
    await sleep(SETTLE_MS);
    setInputValue(input, "");
  }
  await startScene("milk");
}

/** Taps Approve inside the phone frame, as Maria would; signs the approval directly if the frame is not reachable. */
async function approveOnPhone(): Promise<void> {
  const frame = document.querySelector<HTMLIFrameElement>("[data-tour-phone] iframe");
  const tap = () => {
    const button = frame?.contentDocument?.querySelector<HTMLButtonElement>("[data-phone-approve]");
    if (!button || button.disabled) return false;
    button.click();
    return true;
  };
  if (await until(tap, 4000)) return;
  const order = consoleStore.getSnapshot().orders.find((item) => item.status === "pending_approval" && !item.seeded);
  if (order) consoleStore.apply(await consoleStore.decide(order, { decision: "approved" }));
}

/** Presses the log page's own tamper control; changes the entry directly if the control is missing. */
async function tamperLog(): Promise<void> {
  const button = await element<HTMLButtonElement>('[data-tour="tamper"]', 6000);
  if (button && !button.disabled) {
    button.scrollIntoView({ block: "center", behavior: reducedMotion() ? "auto" : "smooth" });
    await sleep(reducedMotion() ? 200 : 900);
    button.click();
  } else if (consoleStore.getSnapshot().chain.state !== "broken") {
    await consoleStore.tamper();
  }
}

export const ACTIONS: Record<ActionId, () => Promise<void>> = {
  askForMilk,
  startOverLimit: () => startScene("over-limit"),
  approveOnPhone,
  tamperLog,
};

/** Puts the changed log entry back, so approvals are not left paused after the tour. */
export async function restoreLog(): Promise<void> {
  await fetch("/api/v1/demo/tamper", { method: "DELETE", credentials: "same-origin" });
  await consoleStore.tick();
}

/** Signs in with demo access and resets the demo, so the story always runs from the same state. */
export async function prepareDemo(): Promise<void> {
  await consoleStore.signIn({ demo: true });
  await consoleStore.reset();
}
