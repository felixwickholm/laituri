"use client";

import { createContext, useContext } from "react";

export type SheetName = "mandate" | "connect";

export interface ConsoleUi {
  openOrder: (orderId: string) => void;
  openSheet: (sheet: SheetName) => void;
  openGuide: () => void;
}

const noop = () => undefined;

export const UiContext = createContext<ConsoleUi>({ openOrder: noop, openSheet: noop, openGuide: noop });

export function useUi(): ConsoleUi {
  return useContext(UiContext);
}
