"use client";

import { useCallback, useState } from "react";
import { handoffContext } from "@/lib/console/basket";
import { basketStore } from "@/lib/console/basket-store";
import type { BasketLine, LineOption } from "@/lib/contracts";
import { pausedMessage } from "@/lib/console/paused";
import { withApprover } from "../session/gate";
import { toast } from "../ui/toast";
import { askValioAimo } from "./handoff";

export interface Resolver {
  /** The line being sent right now, so its buttons wait. */
  busy: string | null;
  choose: (line: BasketLine, option: LineOption, anchor: Element | null) => Promise<boolean>;
  ask: (line: BasketLine) => void;
}

/** Taking an option on a line needs the purchasing manager: demo access first, the passcode second. */
export function useResolve(basketId: string): Resolver {
  const [busy, setBusy] = useState<string | null>(null);

  const ask = useCallback((line: BasketLine) => askValioAimo({ basketId, lineId: line.id, context: handoffContext(line) }), [basketId]);

  const choose = useCallback(
    async (line: BasketLine, option: LineOption, anchor: Element | null) => {
      if (option.kind === "handoff") {
        ask(line);
        return false;
      }
      setBusy(line.id);
      try {
        const basket = await withApprover(anchor, () => basketStore.resolve(basketId, line.id, option.id));
        if (!basket) return false;
        const done = basket.lines.find((item) => item.id === line.id)?.resolved;
        toast(done?.sentence ?? `${option.label}. Saved.`, "success");
        return true;
      } catch (error) {
        toast(pausedMessage(error) ?? (error instanceof Error ? error.message : "That did not save. Try again."), "danger");
        return false;
      } finally {
        setBusy(null);
      }
    },
    [basketId, ask],
  );

  return { busy, choose, ask };
}
