"use client";

import { basketStore } from "@/lib/console/basket-store";
import { consoleStore } from "@/lib/console/store";
import type { Basket, BasketLine } from "@/lib/contracts";
import { tourBasket } from "@/lib/tour/facts";
import type { ActionId } from "@/lib/tour/steps";
import { tourStore } from "./tour-store";

const POLL_MS = 100;
/** How long the tour waits for the basket the page's own button started to appear in the list. */
const BUTTON_MS = 10_000;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Resolves true once `check` holds, false after `timeoutMs`. */
async function until(check: () => boolean, timeoutMs: number): Promise<boolean> {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    if (check()) return true;
    await sleep(POLL_MS);
  }
  return check();
}

function currentBasket(): Basket | undefined {
  const { basketId, since } = tourStore.getSnapshot();
  return tourBasket(basketStore.getSnapshot().baskets, basketId, since);
}

/**
 * Signs this browser in as the purchasing manager with demo access, so the phone opens on the lines themselves and the
 * first tap is the decision. A workspace without demo access keeps the phone's own sign-in.
 */
async function signInManager(): Promise<void> {
  if (consoleStore.getSnapshot().session?.signedIn) return;
  await consoleStore.signIn({ demo: true }).catch(() => undefined);
}

/**
 * Presses the page's own "start the weekly order" button, as a person would, and follows the basket it starts. Only
 * when the button is not on screen does the tour start the same standing order directly, so there is never a second
 * basket competing for the same stock.
 */
async function startWeekly(): Promise<void> {
  const signIn = signInManager();
  const button = document.querySelector<HTMLButtonElement>('[data-tour="start-weekly"]');
  if (button && !button.disabled) {
    button.click();
    void basketStore.tick();
    if (await until(() => currentBasket() !== undefined, BUTTON_MS)) tourStore.dispatch({ type: "basket", id: (currentBasket() as Basket).id });
  } else if (!currentBasket()) {
    tourStore.dispatch({ type: "basket", id: await basketStore.startWeekly() });
  }
  await signIn;
}

/** The option a person takes first on a waiting line: approve, else the first that orders something. */
function firstOption(line: BasketLine) {
  return line.options?.find((option) => option.kind === "approve") ?? line.options?.find((option) => option.kind !== "handoff" && option.kind !== "skip");
}

/**
 * Leaving the phone step: if the visitor did not tap, the tour taps the first answer on the phone, as the purchasing
 * manager would, or takes the same option directly when the phone frame is not reachable.
 */
async function resolveOnPhone(): Promise<void> {
  await basketStore.tick();
  const basket = currentBasket();
  const line = basket?.lines.find((item) => item.state === "orange" && !item.resolved);
  // The visitor tapped already: one answer is the story, the other line keeps waiting for them.
  if (!basket || !line || basket.lines.some((item) => item.resolved !== undefined)) return;
  const frame = document.querySelector<HTMLIFrameElement>("[data-tour-phone] iframe");
  const button = frame?.contentDocument?.querySelector<HTMLButtonElement>('[data-tour="resolve"]');
  if (button && !button.disabled) {
    button.click();
    return;
  }
  const option = firstOption(line);
  if (!option) return;
  await signInManager();
  await basketStore.resolve(basket.id, line.id, option.id).catch(() => undefined);
}

/** How long the tour looks for the example's button while Today is still drawing. */
const EXAMPLE_MS = 5_000;

/**
 * Presses the challenge's own example on Today, as a person would: "1,000 litres of lactose-free milk by Monday".
 * The page runs it and shows the four steps inline; a build without the button simply shows the box.
 */
async function pressExample(): Promise<void> {
  const find = () => document.querySelector<HTMLButtonElement>('[data-tour="milk-example"]');
  if (!(await until(() => find() !== null && !find()?.disabled, EXAMPLE_MS))) return;
  find()?.click();
}

export const ACTIONS: Record<ActionId, () => Promise<void>> = { pressExample, startWeekly, resolveOnPhone };

/** Resets this browser's own sandbox, so the story always runs from the same state. Nobody else's copy changes. */
export async function prepareDemo(): Promise<void> {
  await consoleStore.reset();
  await basketStore.tick();
}

/** Picks each step's page: the first of its pages that this build serves. */
export async function chooseRoutes(steps: readonly { id: string; routes: readonly string[] }[]): Promise<Record<string, string>> {
  const chosen: Record<string, string> = {};
  await Promise.all(
    steps.map(async (step) => {
      for (const route of step.routes.slice(0, -1)) {
        const response = await fetch(route, { method: "HEAD", cache: "no-store" }).catch(() => undefined);
        if (response?.ok) {
          chosen[step.id] = route;
          return;
        }
      }
      chosen[step.id] = step.routes[step.routes.length - 1];
    }),
  );
  return chosen;
}
