"use client";

import { createContext, useContext } from "react";

export interface ConsoleUi {
  openOrder: (orderId: string) => void;
}

export const UiContext = createContext<ConsoleUi>({ openOrder: () => undefined });

export function useUi(): ConsoleUi {
  return useContext(UiContext);
}
