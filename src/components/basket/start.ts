"use client";

import { basketStore } from "@/lib/console/basket-store";
import type { CreateBasketRequest } from "@/lib/contracts";
import { toast } from "../ui/toast";

/** Starts this week's standing order. A failure says so in one sentence; nothing else changes. */
export async function startWeeklyOrder(): Promise<string | undefined> {
  try {
    return await basketStore.startWeekly();
  } catch (error) {
    toast(error instanceof Error ? error.message : "The weekly order did not start. Try again.", "danger");
    return undefined;
  }
}

/** Sends the lines a person changed by hand as one basket. */
export async function placeBasket(body: CreateBasketRequest): Promise<string | undefined> {
  try {
    return await basketStore.place(body);
  } catch (error) {
    toast(error instanceof Error ? error.message : "The order did not start. Try again.", "danger");
    return undefined;
  }
}
