"use client";

import { consoleStore } from "@/lib/console/store";
import type { ActionId } from "@/lib/tour/steps";
import type { TourScene } from "@/lib/tour/targets";
import { tourStore } from "./tour-store";

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

const runId = () => consoleStore.getSnapshot().run?.id;

/**
 * Presses the panel's own scene button, or starts the scene directly when the panel is not on screen, and records
 * the id of the run that started, so every later step follows exactly that run.
 */
async function startScene(scenario: TourScene): Promise<void> {
  await until(idle, 20_000);
  const before = runId();
  const button = await element<HTMLButtonElement>(`[data-tour-scene="${scenario}"]`, 3000);
  await until(() => !button?.disabled, 3000);
  let started: string | undefined;
  if (button && !button.disabled) {
    button.click();
    if (await until(() => runId() !== before, 5000)) started = runId();
  }
  started ??= await consoleStore.startRun({ scenario });
  tourStore.dispatch({ type: "run", scene: scenario, id: started });
}

/** Types the request into the composer letter by letter and leaves it there, unsent, for the person to read. */
async function typeRequest(): Promise<void> {
  const input = await element<HTMLInputElement>("#live-agent-ask", 8000);
  await until(() => idle() && !input?.disabled, 10_000);
  if (!input) return;
  const step = reducedMotion() ? 0 : TYPE_MS;
  for (let index = 1; index <= MILK_REQUEST.length; index++) {
    setInputValue(input, MILK_REQUEST.slice(0, index));
    if (step) await sleep(step);
  }
  await sleep(SETTLE_MS);
}

/** Sends what was typed: the scripted milk scene asks exactly those words, so the story is the same every time. */
async function sendRequest(): Promise<void> {
  const input = document.querySelector<HTMLInputElement>("#live-agent-ask");
  if (input) setInputValue(input, "");
  await startScene("milk");
}

/** Taps a button inside the phone frame once it is there and enabled. */
function tapInPhone(selector: string): () => boolean {
  return () => {
    const frame = document.querySelector<HTMLIFrameElement>("[data-tour-phone] iframe");
    const button = frame?.contentDocument?.querySelector<HTMLButtonElement>(selector);
    if (!button || button.disabled) return false;
    button.click();
    return true;
  };
}

/**
 * Taps Approve inside the phone frame, as Maria would, after continuing with demo access on the phone when it asks.
 * Signs in with demo access and signs the approval directly if the frame is not reachable.
 */
async function approveOnPhone(): Promise<void> {
  const approve = tapInPhone("[data-phone-approve]");
  if (!approve() && tapInPhone("[data-phone-demo]")()) await sleep(SETTLE_MS);
  if (await until(approve, 4000)) return;
  const order = consoleStore.getSnapshot().orders.find((item) => item.status === "pending_approval" && !item.seeded);
  if (!order) return;
  if (!consoleStore.getSnapshot().session?.signedIn) await consoleStore.signIn({ demo: true });
  consoleStore.apply(await consoleStore.decide(order, { decision: "approved" }));
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
  typeRequest,
  sendRequest,
  startOverLimit: () => startScene("over-limit"),
  approveOnPhone,
  tamperLog,
};

/**
 * Resets this browser's own sandbox, so the story always runs from the same state. No sign-in is needed: the reset
 * touches nobody else's copy. Approving on the phone signs in with demo access when the tour gets there.
 */
export async function prepareDemo(): Promise<void> {
  await consoleStore.reset();
}
